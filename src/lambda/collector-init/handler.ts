/**
 * Lambda Collector-Init Handler
 *
 * Step Functions移行: 初期化ステップ
 * 収集パラメータの検証、実行状態の初期化、TDnet APIからのメタデータ取得を担当。
 *
 * Requirements: 要件1.1, 1.2, 5.1, 5.2
 * 
 * 関連ドキュメント:
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/development/lambda-implementation.md
 * - .kiro/steering/core/error-handling-patterns.md
 */

import { Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric } from '../../utils/cloudwatch-metrics';
import { ValidationError } from '../../errors';

/**
 * 初期化イベント
 */
export interface InitEvent {
  /** 実行ID（Collect関数から渡される） */
  execution_id: string;

  /** モード（batch: 日次バッチ、on-demand: オンデマンド） */
  mode: 'batch' | 'on-demand';

  /** 開始日（ISO 8601形式、YYYY-MM-DD）- on-demandモードで必須 */
  start_date?: string;

  /** 終了日（ISO 8601形式、YYYY-MM-DD）- on-demandモードで必須 */
  end_date?: string;

  /** 最大収集件数（オプション、デフォルト: 制限なし） */
  max_items?: number;
}

/**
 * 初期化レスポンス
 */
export interface InitResponse {
  /** 実行ID */
  execution_id: string;

  /** 収集対象日付リスト（YYYY-MM-DD形式） */
  dates: string[];

  /** 総日数 */
  total_days: number;

  /** 最大収集件数（オプション） */
  max_items?: number;

  /** 推定総件数 */
  estimated_total: number;
}

/**
 * Lambda Collector-Initハンドラー
 *
 * @param event InitEvent
 * @param context Lambda Context
 * @returns InitResponse
 *
 * @example
 * ```typescript
 * // バッチモード（前日のデータを収集）
 * const response = await handler({
 *   execution_id: 'exec_1234567890_abc123_12345678',
 *   mode: 'batch'
 * }, context);
 *
 * // オンデマンドモード（指定期間のデータを収集）
 * const response = await handler({
 *   execution_id: 'exec_1234567890_abc123_12345678',
 *   mode: 'on-demand',
 *   start_date: '2024-01-15',
 *   end_date: '2024-01-20',
 *   max_items: 1000
 * }, context);
 * ```
 */
export async function handler(
  event: InitEvent,
  context: Context
): Promise<InitResponse> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Collector-Init started', {
      event,
      execution_id: event.execution_id,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // イベントのバリデーション
    validateEvent(event);

    // モード別処理
    let dates: string[];
    if (event.mode === 'batch') {
      // バッチモード: 前日の日付を取得
      const yesterday = getYesterday();
      const dateStr = formatDate(yesterday);
      dates = [dateStr];

      logger.info('Batch mode: target date', {
        execution_id: event.execution_id,
        date: dateStr,
      });
    } else {
      // オンデマンドモード: 日付範囲を生成
      dates = generateDateRange(event.start_date!, event.end_date!);

      logger.info('On-demand mode: date range', {
        execution_id: event.execution_id,
        start_date: event.start_date,
        end_date: event.end_date,
        total_days: dates.length,
      });
    }

    // 実行状態を初期化（pending）
    await updateExecutionStatus(event.execution_id, 'pending', 0);

    // max_itemsのデフォルト値設定（未指定時は9999）
    const maxItems = event.max_items ?? 9999;

    // 推定総件数を計算（簡易版: 1日あたり平均200件と仮定）
    const estimatedPerDay = 200;
    const estimatedTotal = dates.length * estimatedPerDay;

    const response: InitResponse = {
      execution_id: event.execution_id,
      dates,
      total_days: dates.length,
      max_items: maxItems,
      estimated_total: estimatedTotal,
    };

    const duration = Date.now() - startTime;

    logger.info('Lambda Collector-Init completed', {
      execution_id: event.execution_id,
      total_days: dates.length,
      max_items: maxItems,
      estimated_total: estimatedTotal,
      duration_ms: duration,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Collector-Init failed',
      createErrorContext(error as Error, {
        execution_id: event.execution_id,
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'CollectorInit',
      { Mode: event.mode }
    );

    // 実行状態を更新（failed）
    await updateExecutionStatus(
      event.execution_id,
      'failed',
      0,
      0,
      0,
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}

/**
 * イベントのバリデーション
 *
 * @param event InitEvent
 * @throws ValidationError バリデーションエラー
 */
export function validateEvent(event: InitEvent): void {
  // execution_idのバリデーション
  if (!event.execution_id || typeof event.execution_id !== 'string') {
    throw new ValidationError(
      'execution_id is required and must be a string'
    );
  }

  // モードのバリデーション
  if (!event.mode || !['batch', 'on-demand'].includes(event.mode)) {
    throw new ValidationError(
      `Invalid mode: ${event.mode}. Expected 'batch' or 'on-demand'.`
    );
  }

  // on-demandモードの場合、日付範囲が必須
  if (event.mode === 'on-demand') {
    if (!event.start_date || !event.end_date) {
      throw new ValidationError(
        'start_date and end_date are required for on-demand mode'
      );
    }

    // 日付フォーマットのバリデーション（YYYY-MM-DD）
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(event.start_date)) {
      throw new ValidationError(
        `Invalid start_date format: ${event.start_date}. Expected YYYY-MM-DD format.`
      );
    }
    if (!dateRegex.test(event.end_date)) {
      throw new ValidationError(
        `Invalid end_date format: ${event.end_date}. Expected YYYY-MM-DD format.`
      );
    }

    // 日付の有効性チェック
    const startDate = new Date(event.start_date);
    const endDate = new Date(event.end_date);

    if (isNaN(startDate.getTime())) {
      throw new ValidationError(
        `Invalid start_date: ${event.start_date}. Date does not exist.`
      );
    }
    if (isNaN(endDate.getTime())) {
      throw new ValidationError(
        `Invalid end_date: ${event.end_date}. Date does not exist.`
      );
    }

    // 日付順序チェック
    if (startDate > endDate) {
      throw new ValidationError(
        `start_date (${event.start_date}) must be before or equal to end_date (${event.end_date})`
      );
    }

    // 範囲チェック（過去1年以内）
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (startDate < oneYearAgo) {
      throw new ValidationError(
        `start_date (${event.start_date}) is too old. Maximum range is 1 year.`
      );
    }

    // 未来日チェック
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (endDate > tomorrow) {
      throw new ValidationError(
        `end_date (${event.end_date}) cannot be in the future.`
      );
    }
  }

  // max_itemsのバリデーション
  if (event.max_items !== undefined) {
    if (typeof event.max_items !== 'number' || event.max_items <= 0) {
      throw new ValidationError(
        `Invalid max_items: ${event.max_items}. Must be a positive number.`
      );
    }
  }
}

/**
 * 前日の日付を取得（JST基準）
 *
 * JST（日本標準時、UTC+9）基準で前日の日付を計算します。
 * 例: 現在時刻が 2024-01-15 00:30 JST の場合、2024-01-14 を返します。
 *
 * @returns 前日の日付文字列（YYYY-MM-DD形式）
 */
export function getYesterday(): Date {
  const now = new Date();
  // JSTに変換（UTC+9時間）
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  
  // JST基準で前日を計算
  const jstYesterday = new Date(jstNow);
  jstYesterday.setUTCDate(jstYesterday.getUTCDate() - 1);
  
  return jstYesterday;
}

/**
 * DateオブジェクトをYYYY-MM-DD形式にフォーマット
 *
 * JST変換済みのDateオブジェクトをYYYY-MM-DD形式の文字列に変換します。
 * getUTCFullYear(), getUTCMonth(), getUTCDate()を使用することで、
 * JST変換後の日付を正しく抽出します。
 *
 * @param date JST変換済みのDateオブジェクト
 * @returns YYYY-MM-DD形式の文字列
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付範囲を生成
 *
 * YYYY-MM-DD形式の開始日と終了日から、その間のすべての日付を生成します。
 * 日付の比較と増分はUTC基準で行われます。
 *
 * @param start_date 開始日（YYYY-MM-DD）
 * @param end_date 終了日（YYYY-MM-DD）
 * @returns 日付の配列（YYYY-MM-DD形式）
 *
 * @example
 * generateDateRange('2024-01-15', '2024-01-17')
 * // => ['2024-01-15', '2024-01-16', '2024-01-17']
 */
export function generateDateRange(start_date: string, end_date: string): string[] {
  const dates: string[] = [];
  const current = new Date(start_date + 'T00:00:00Z'); // UTC midnight
  const end = new Date(end_date + 'T00:00:00Z'); // UTC midnight

  while (current <= end) {
    // YYYY-MM-DD形式で日付を抽出
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    
    // 次の日に進む（UTC基準）
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

// 既存のupdateExecutionStatus関数をインポート
import { updateExecutionStatus } from '../collector/update-execution-status';

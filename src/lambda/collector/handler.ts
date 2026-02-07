/**
 * Lambda Collector Handler
 *
 * TDnet開示情報を収集するLambda関数のメインハンドラー。
 * バッチモード（日次自動実行）とオンデマンドモード（手動実行）をサポート。
 *
 * Requirements: 要件1.1, 1.2, 5.1, 5.2
 */

import { Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';
import { ValidationError } from '../../errors';
import { scrapeTdnetList } from './scrape-tdnet-list';

/**
 * Lambda Collectorイベント
 */
export interface CollectorEvent {
  /** モード（batch: 日次バッチ、on-demand: オンデマンド） */
  mode: 'batch' | 'on-demand';

  /** 開始日（ISO 8601形式、YYYY-MM-DD）- on-demandモードで必須 */
  start_date?: string;

  /** 終了日（ISO 8601形式、YYYY-MM-DD）- on-demandモードで必須 */
  end_date?: string;
}

/**
 * Lambda Collectorレスポンス
 */
export interface CollectorResponse {
  /** 実行ID */
  execution_id: string;

  /** 状態 */
  status: 'success' | 'partial_success' | 'failed';

  /** メッセージ */
  message: string;

  /** 収集成功件数 */
  collected_count: number;

  /** 収集失敗件数 */
  failed_count: number;
}

/**
 * Lambda Collectorハンドラー
 *
 * @param event CollectorEvent
 * @param context Lambda Context
 * @returns CollectorResponse
 *
 * @example
 * ```typescript
 * // バッチモード（前日のデータを収集）
 * const response = await handler({ mode: 'batch' }, context);
 *
 * // オンデマンドモード（指定期間のデータを収集）
 * const response = await handler({
 *   mode: 'on-demand',
 *   start_date: '2024-01-15',
 *   end_date: '2024-01-20',
 * }, context);
 * ```
 */
export async function handler(
  event: CollectorEvent,
  context: Context
): Promise<CollectorResponse> {
  const execution_id = generateExecutionId(context);
  const startTime = Date.now();

  try {
    logger.info('Lambda Collector started', {
      event,
      execution_id,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // イベントのバリデーション
    validateEvent(event);

    // モード別処理
    let response: CollectorResponse;
    if (event.mode === 'batch') {
      response = await handleBatchMode(execution_id);
    } else {
      response = await handleOnDemandMode(
        execution_id,
        event.start_date!,
        event.end_date!
      );
    }

    const duration = Date.now() - startTime;

    logger.info('Lambda Collector completed', {
      execution_id,
      status: response.status,
      collected_count: response.collected_count,
      failed_count: response.failed_count,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'Collector', Mode: event.mode },
      },
      {
        name: 'DisclosuresCollected',
        value: response.collected_count,
        unit: 'Count',
        dimensions: { Mode: event.mode },
      },
      {
        name: 'DisclosuresFailed',
        value: response.failed_count,
        unit: 'Count',
        dimensions: { Mode: event.mode },
      },
    ]);

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Collector failed',
      createErrorContext(error as Error, {
        execution_id,
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'Collector',
      { Mode: event.mode }
    );

    return {
      execution_id,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
      collected_count: 0,
      failed_count: 0,
    };
  }
}

/**
 * イベントのバリデーション
 *
 * @param event CollectorEvent
 * @throws ValidationError バリデーションエラー
 */
function validateEvent(event: CollectorEvent): void {
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
}

/**
 * バッチモードの処理
 * 前日のデータを収集
 *
 * @param execution_id 実行ID
 * @returns CollectorResponse
 */
async function handleBatchMode(
  execution_id: string
): Promise<CollectorResponse> {
  logger.info('Batch mode: collecting yesterday\'s data', { execution_id });

  // 前日の日付を取得（JST基準）
  const yesterday = getYesterday();
  const dateStr = formatDate(yesterday);

  logger.info('Target date for batch mode', {
    execution_id,
    date: dateStr,
  });

  // 前日のデータを収集
  return await collectDisclosuresForDateRange(
    execution_id,
    dateStr,
    dateStr
  );
}

/**
 * オンデマンドモードの処理
 * 指定期間のデータを収集
 *
 * @param execution_id 実行ID
 * @param start_date 開始日（YYYY-MM-DD）
 * @param end_date 終了日（YYYY-MM-DD）
 * @returns CollectorResponse
 */
async function handleOnDemandMode(
  execution_id: string,
  start_date: string,
  end_date: string
): Promise<CollectorResponse> {
  logger.info('On-demand mode: collecting data for specified range', {
    execution_id,
    start_date,
    end_date,
  });

  return await collectDisclosuresForDateRange(
    execution_id,
    start_date,
    end_date
  );
}

/**
 * 指定期間のデータを収集
 *
 * @param execution_id 実行ID
 * @param start_date 開始日（YYYY-MM-DD）
 * @param end_date 終了日（YYYY-MM-DD）
 * @returns CollectorResponse
 */
async function collectDisclosuresForDateRange(
  execution_id: string,
  start_date: string,
  end_date: string
): Promise<CollectorResponse> {
  const dates = generateDateRange(start_date, end_date);
  let collected_count = 0;
  let failed_count = 0;

  logger.info('Collecting disclosures for date range', {
    execution_id,
    start_date,
    end_date,
    total_days: dates.length,
  });

  // 各日付のデータを順次収集
  for (const date of dates) {
    try {
      logger.info('Scraping TDnet list for date', {
        execution_id,
        date,
      });

      const disclosures = await scrapeTdnetList(date);

      logger.info('TDnet list scraped successfully', {
        execution_id,
        date,
        count: disclosures.length,
      });

      // TODO: Task 8.3, 8.4, 8.6, 8.8で実装
      // - 開示IDの生成
      // - DynamoDBへの保存
      // - PDFダウンロード
      // - S3へのアップロード

      collected_count += disclosures.length;
    } catch (error) {
      logger.error(
        'Failed to collect disclosures for date',
        createErrorContext(error as Error, {
          execution_id,
          date,
        })
      );
      failed_count++;
    }
  }

  // ステータスの決定
  let status: 'success' | 'partial_success' | 'failed';
  if (failed_count === 0) {
    status = 'success';
  } else if (collected_count > 0) {
    status = 'partial_success';
  } else {
    status = 'failed';
  }

  return {
    execution_id,
    status,
    message: `Collected ${collected_count} disclosures, ${failed_count} days failed`,
    collected_count,
    failed_count,
  };
}

/**
 * 実行IDを生成
 *
 * @param context Lambda Context
 * @returns 実行ID
 */
function generateExecutionId(context: Context): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `exec_${timestamp}_${random}_${context.awsRequestId.substring(0, 8)}`;
}

/**
 * 前日の日付を取得（JST基準）
 *
 * @returns 前日のDateオブジェクト
 */
function getYesterday(): Date {
  const now = new Date();
  // JSTに変換（UTC+9時間）
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  // 前日
  jstNow.setDate(jstNow.getDate() - 1);
  return jstNow;
}

/**
 * DateオブジェクトをYYYY-MM-DD形式にフォーマット
 *
 * @param date Dateオブジェクト
 * @returns YYYY-MM-DD形式の文字列
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 日付範囲を生成
 *
 * @param start_date 開始日（YYYY-MM-DD）
 * @param end_date 終了日（YYYY-MM-DD）
 * @returns 日付の配列（YYYY-MM-DD形式）
 */
function generateDateRange(start_date: string, end_date: string): string[] {
  const dates: string[] = [];
  const current = new Date(start_date);
  const end = new Date(end_date);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

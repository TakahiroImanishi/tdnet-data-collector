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
import {
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../../utils/metrics';
import { ValidationError } from '../../errors';
import { scrapeTdnetList } from './scrape-tdnet-list';
import { downloadPdf } from './download-pdf';
import { saveMetadata } from './save-metadata';
import { updateExecutionStatus } from './update-execution-status';
import { generateDisclosureId } from '../../utils/disclosure-id';
import { Disclosure } from '../../types';
import { DisclosureMetadata } from '../../scraper/html-parser';

/**
 * Lambda Collectorイベント
 */
export interface CollectorEvent {
  /** 実行ID（Collect関数から渡される） */
  execution_id?: string;

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
  // Collect関数から渡されたexecution_idを使用、なければ生成
  const execution_id = event.execution_id || generateExecutionId(context);
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

    // カスタムメトリクス送信（タスク16.2）
    const totalCount = response.collected_count + response.failed_count;
    const successRate = totalCount > 0 
      ? (response.collected_count / totalCount) * 100 
      : 0;

    await Promise.all([
      // 収集成功件数
      sendDisclosuresCollectedMetric(response.collected_count, context.functionName),
      // 収集失敗件数
      sendDisclosuresFailedMetric(response.failed_count, context.functionName),
      // 収集成功率
      sendCollectionSuccessRateMetric(successRate, context.functionName),
      // 実行時間メトリクス（既存）
      sendMetrics([
        {
          name: 'LambdaExecutionTime',
          value: duration,
          unit: 'Milliseconds',
          dimensions: { FunctionName: 'Collector', Mode: event.mode },
        },
      ]),
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

  // 実行状態を初期化（pending）
  await updateExecutionStatus(execution_id, 'pending', 0);

  // 実行状態を更新（running）
  await updateExecutionStatus(execution_id, 'running', 0);

  // 各日付のデータを順次収集
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    try {
      logger.info('Scraping TDnet list for date', {
        execution_id,
        date,
        progress: `${i + 1}/${dates.length}`,
      });

      const disclosureMetadata = await scrapeTdnetList(date);

      logger.info('TDnet list scraped successfully', {
        execution_id,
        date,
        count: disclosureMetadata.length,
      });

      // 並列処理（並列度5）
      const results = await processDisclosuresInParallel(
        disclosureMetadata,
        execution_id,
        5
      );

      collected_count += results.success;
      failed_count += results.failed;

      // 進捗率を更新（日付単位）
      const progress = Math.floor(((i + 1) / dates.length) * 100);
      await updateExecutionStatus(
        execution_id,
        'running',
        progress,
        collected_count,
        failed_count
      );
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

  // 実行状態を更新（completed/failed）
  await updateExecutionStatus(
    execution_id,
    status === 'failed' ? 'failed' : 'completed',
    100,
    collected_count,
    failed_count,
    status === 'failed' ? 'Collection failed' : undefined
  );

  return {
    execution_id,
    status,
    message: `Collected ${collected_count} disclosures, ${failed_count} failed`,
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
 * JST（日本標準時、UTC+9）基準で前日の日付を計算します。
 * 例: 現在時刻が 2024-01-15 00:30 JST の場合、2024-01-14 を返します。
 *
 * @returns 前日の日付文字列（YYYY-MM-DD形式）
 */
function getYesterday(): Date {
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
function formatDate(date: Date): string {
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
function generateDateRange(start_date: string, end_date: string): string[] {
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

/**
 * 開示情報を並列処理
 *
 * Promise.allSettledを使用して、一部が失敗しても他の処理を継続します。
 *
 * @param disclosureMetadata 開示情報メタデータリスト
 * @param execution_id 実行ID
 * @param concurrency 並列度（デフォルト: 5）
 * @returns 処理結果（成功件数、失敗件数）
 */
async function processDisclosuresInParallel(
  disclosureMetadata: DisclosureMetadata[],
  execution_id: string,
  concurrency: number = 5
): Promise<{ success: number; failed: number }> {
  const results = { success: 0, failed: 0 };

  // 並列度を制限して処理
  for (let i = 0; i < disclosureMetadata.length; i += concurrency) {
    const batch = disclosureMetadata.slice(i, i + concurrency);
    const promises = batch.map((metadata, index) =>
      processDisclosure(metadata, execution_id, i + index + 1)
    );

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.success++;
      } else {
        results.failed++;
        logger.error('Failed to process disclosure', {
          execution_id,
          error: result.reason,
        });
      }
    }
  }

  return results;
}

/**
 * 単一の開示情報を処理
 *
 * 1. 開示IDを生成
 * 2. PDFをダウンロードしてS3に保存
 * 3. メタデータをDynamoDBに保存
 *
 * @param metadata 開示情報メタデータ
 * @param execution_id 実行ID
 * @param sequence 連番（同一日・同一企業の複数開示を区別）
 */
async function processDisclosure(
  metadata: DisclosureMetadata,
  execution_id: string,
  sequence: number
): Promise<void> {
  try {
    // 開示IDを生成
    const disclosure_id = generateDisclosureId(
      metadata.disclosed_at,
      metadata.company_code,
      sequence
    );

    logger.info('Processing disclosure', {
      execution_id,
      disclosure_id,
      company_code: metadata.company_code,
      title: metadata.title,
    });

    // PDFをダウンロードしてS3に保存
    const s3_key = await downloadPdf(
      disclosure_id,
      metadata.pdf_url,
      metadata.disclosed_at
    );

    // DisclosureMetadataからDisclosureに変換
    const disclosure: Disclosure = {
      disclosure_id,
      company_code: metadata.company_code,
      company_name: metadata.company_name,
      disclosure_type: metadata.disclosure_type,
      title: metadata.title,
      disclosed_at: metadata.disclosed_at,
      pdf_url: metadata.pdf_url,
      pdf_s3_key: s3_key,
      downloaded_at: new Date().toISOString(),
      date_partition: '', // saveMetadata内で自動生成
    };

    // メタデータをDynamoDBに保存
    await saveMetadata(disclosure, s3_key);

    logger.info('Successfully processed disclosure', {
      execution_id,
      disclosure_id,
      s3_key,
    });
  } catch (error) {
    logger.error(
      'Failed to process disclosure',
      createErrorContext(error as Error, {
        execution_id,
        company_code: metadata.company_code,
        title: metadata.title,
      })
    );
    throw error;
  }
}


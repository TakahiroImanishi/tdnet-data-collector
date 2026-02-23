/**
 * Lambda Collector-Save Handler
 *
 * Step Functions移行: データ保存ステップ
 * 開示情報のPDFダウンロード、S3アップロード、DynamoDBメタデータ保存を実行します。
 *
 * Requirements: 要件1.3, 1.4, 3.3, 6.1
 * 
 * 関連ドキュメント:
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/core/error-handling-patterns.md
 */

import { Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric } from '../../utils/cloudwatch-metrics';
import { downloadPdf } from '../collector/download-pdf';
import { saveMetadata } from '../collector/save-metadata';
import { generateDisclosureId } from '../../utils/disclosure-id';
import { Disclosure } from '../../types';
import { DisclosureMetadata } from '../../scraper/html-parser';

/**
 * Lambda Collector-Save イベント
 */
export interface SaveEvent {
  /** 実行ID */
  execution_id: string;

  /** ページ番号（日付文字列、YYYY-MM-DD形式） */
  page_number: string;

  /** 開示情報メタデータリスト */
  items: DisclosureMetadata[];
}

/**
 * Lambda Collector-Save レスポンス
 */
export interface SaveResponse {
  /** 実行ID */
  execution_id: string;

  /** ページ番号（日付文字列） */
  page_number: string;

  /** 保存成功件数 */
  saved_count: number;

  /** 保存失敗件数 */
  failed_count: number;

  /** 失敗した開示情報リスト */
  failed_items: Array<{
    disclosure_id: string;
    error: string;
  }>;
}

/**
 * Lambda Collector-Save ハンドラー
 *
 * 開示情報リストを受け取り、各開示情報のPDFダウンロード、S3アップロード、
 * DynamoDBメタデータ保存を並列実行します。
 * 部分的失敗を許容し、成功分はコミット、失敗分は記録します。
 *
 * @param event SaveEvent
 * @param context Lambda Context
 * @returns SaveResponse
 *
 * @example
 * ```typescript
 * const response = await handler({
 *   execution_id: 'exec_1234567890_abc123_12345678',
 *   page_number: 1,
 *   items: [
 *     {
 *       company_code: '1234',
 *       company_name: '株式会社サンプル',
 *       disclosure_type: '決算短信',
 *       title: '2024年3月期 第3四半期決算短信',
 *       disclosed_at: '2024-01-15T10:30:00Z',
 *       pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
 *     },
 *   ],
 * }, context);
 * ```
 */
export async function handler(
  event: SaveEvent,
  context: Context
): Promise<SaveResponse> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Collector-Save started', {
      event,
      execution_id: event.execution_id,
      page_number: event.page_number,
      items_count: event.items.length,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // 並列処理（並列度5）
    const results = await processDisclosuresInParallel(
      event.items,
      event.execution_id,
      5
    );

    const duration = Date.now() - startTime;

    logger.info('Lambda Collector-Save completed', {
      execution_id: event.execution_id,
      page_number: event.page_number,
      saved_count: results.success,
      failed_count: results.failed,
      failed_items: results.failedItems,
      duration_ms: duration,
    });

    return {
      execution_id: event.execution_id,
      page_number: event.page_number,
      saved_count: results.success,
      failed_count: results.failed,
      failed_items: results.failedItems,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Collector-Save failed',
      createErrorContext(error as Error, {
        execution_id: event.execution_id,
        page_number: event.page_number,
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'CollectorSave',
      { ExecutionId: event.execution_id }
    );

    throw error;
  }
}

/**
 * 開示情報を並列処理
 *
 * Promise.allSettledを使用して、一部が失敗しても他の処理を継続します。
 *
 * @param disclosureMetadata 開示情報メタデータリスト
 * @param execution_id 実行ID
 * @param concurrency 並列度（デフォルト: 5）
 * @returns 処理結果（成功件数、失敗件数、失敗アイテム）
 */
async function processDisclosuresInParallel(
  disclosureMetadata: DisclosureMetadata[],
  execution_id: string,
  concurrency: number = 5
): Promise<{
  success: number;
  failed: number;
  failedItems: Array<{ disclosure_id: string; error: string }>;
}> {
  const results = { success: 0, failed: 0, failedItems: [] as Array<{ disclosure_id: string; error: string }> };
  const totalCount = disclosureMetadata.length;

  // 並列度を制限して処理
  for (let i = 0; i < disclosureMetadata.length; i += concurrency) {
    const batch = disclosureMetadata.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(totalCount / concurrency);

    // バッチ開始ログ
    logger.info('Processing batch', {
      execution_id,
      batch_number: batchNumber,
      total_batches: totalBatches,
      batch_size: batch.length,
      processed_so_far: results.success + results.failed,
      total_count: totalCount,
      progress_percent: Math.floor(((results.success + results.failed) / totalCount) * 100),
    });

    const promises = batch.map((metadata, index) =>
      processDisclosure(metadata, execution_id, i + index + 1)
    );

    const settled = await Promise.allSettled(promises);

    const batchSuccess = settled.filter((r) => r.status === 'fulfilled').length;
    const batchFailed = settled.filter((r) => r.status === 'rejected').length;

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.success++;
      } else {
        results.failed++;
        const error = result.reason;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // disclosure_idを抽出（エラーメッセージから）
        const disclosureIdMatch = errorMessage.match(/disclosure_id: ([^\s,]+)/);
        const disclosureId = disclosureIdMatch ? disclosureIdMatch[1] : 'unknown';
        
        results.failedItems.push({
          disclosure_id: disclosureId,
          error: errorMessage,
        });

        logger.error('Failed to process disclosure', {
          execution_id,
          disclosure_id: disclosureId,
          error_type: error instanceof Error ? error.constructor.name : 'Unknown',
          error_message: errorMessage,
        });
      }
    }

    // バッチ完了ログ
    logger.info('Batch completed', {
      execution_id,
      batch_number: batchNumber,
      batch_success: batchSuccess,
      batch_failed: batchFailed,
      total_success: results.success,
      total_failed: results.failed,
      progress_percent: Math.floor(((results.success + results.failed) / totalCount) * 100),
    });
  }

  // 最終結果ログ
  logger.info('All batches completed', {
    execution_id,
    total_success: results.success,
    total_failed: results.failed,
    total_count: totalCount,
    success_rate: totalCount > 0 ? Math.floor((results.success / totalCount) * 100) : 0,
  });

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
  // 開示IDを生成
  const disclosure_id = generateDisclosureId(
    metadata.disclosed_at,
    metadata.company_code,
    sequence
  );

  // 処理開始ログ
  logger.info('Processing disclosure started', {
    execution_id,
    disclosure_id,
    sequence,
    company_code: metadata.company_code,
    company_name: metadata.company_name,
    title: metadata.title,
  });

  try {
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

    // 処理完了ログ
    logger.info('Processing disclosure completed', {
      execution_id,
      disclosure_id,
      sequence,
      s3_key,
    });
  } catch (error) {
    // エラーログ（詳細）
    logger.error(
      'Processing disclosure failed',
      createErrorContext(error as Error, {
        execution_id,
        disclosure_id,
        sequence,
        company_code: metadata.company_code,
        title: metadata.title,
        pdf_url: metadata.pdf_url,
      })
    );
    throw error;
  }
}

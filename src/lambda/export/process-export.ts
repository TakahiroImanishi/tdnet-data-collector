/**
 * エクスポート処理
 *
 * データ取得、進捗更新、S3へのエクスポート、署名付きURL生成を実行します。
 *
 * Requirements: 要件5.1, 5.4（エクスポート、進捗）
 */

import { logger, createErrorContext } from '../../utils/logger';
import { ExportRequestBody } from './types';
import { queryDisclosures } from './query-disclosures';
import { exportToS3 } from './export-to-s3';
import { updateExportStatus } from './update-export-status';
import { generateSignedUrl } from './generate-signed-url';

/**
 * エクスポート処理を実行
 *
 * 1. データ取得（queryDisclosures使用）
 * 2. 進捗更新（10%、50%、90%、100%）
 * 3. S3へのエクスポート
 * 4. 署名付きURL生成（有効期限7日）
 *
 * @param export_id エクスポートID
 * @param requestBody エクスポートリクエストボディ
 */
export async function processExport(
  export_id: string,
  requestBody: ExportRequestBody
): Promise<void> {
  try {
    logger.info('Starting export processing', {
      export_id,
      format: requestBody.format,
      filter: requestBody.filter,
    });

    // ステータスを processing に更新（進捗10%）
    await updateExportStatus(export_id, 'processing', 10);

    // データ取得
    logger.info('Querying disclosures', {
      export_id,
      filter: requestBody.filter,
    });

    const disclosures = await queryDisclosures(requestBody.filter);

    logger.info('Disclosures queried successfully', {
      export_id,
      count: disclosures.length,
    });

    // 進捗更新（50%）
    await updateExportStatus(export_id, 'processing', 50);

    // S3へのエクスポート
    logger.info('Exporting to S3', {
      export_id,
      format: requestBody.format,
      count: disclosures.length,
    });

    const s3_key = await exportToS3(export_id, disclosures, requestBody.format);

    logger.info('Exported to S3 successfully', {
      export_id,
      s3_key,
    });

    // 進捗更新（90%）
    await updateExportStatus(export_id, 'processing', 90);

    // 署名付きURL生成（有効期限7日）
    logger.info('Generating signed URL', {
      export_id,
      s3_key,
    });

    const download_url = await generateSignedUrl(s3_key, 7 * 24 * 60 * 60); // 7日間

    logger.info('Signed URL generated successfully', {
      export_id,
      download_url,
    });

    // ステータスを completed に更新（進捗100%）
    await updateExportStatus(export_id, 'completed', 100, s3_key, download_url);

    logger.info('Export processing completed successfully', {
      export_id,
      s3_key,
      download_url,
    });
  } catch (error) {
    logger.error(
      'Export processing failed',
      createErrorContext(error as Error, {
        export_id,
      })
    );

    // ステータスを failed に更新
    await updateExportStatus(
      export_id,
      'failed',
      0,
      undefined,
      undefined,
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}

/**
 * エクスポートジョブ作成
 *
 * エクスポートIDを生成し、実行状態をDynamoDBに保存します。
 *
 * Requirements: 要件5.1（エクスポート）
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { ExportRequestBody, ExportStatusItem } from './types';

// DynamoDBクライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
  }),
});

// 環境変数
const EXPORT_STATUS_TABLE = process.env.EXPORT_STATUS_TABLE_NAME || 'tdnet-export-status';

/**
 * エクスポートジョブを作成
 *
 * @param requestBody エクスポートリクエストボディ
 * @param requestId リクエストID
 * @returns エクスポートステータス
 */
export async function createExportJob(
  requestBody: ExportRequestBody,
  requestId: string
): Promise<ExportStatusItem> {
  // エクスポートIDを生成
  const export_id = generateExportId(requestId);

  // 現在時刻（ISO 8601形式、UTC）
  const requested_at = new Date().toISOString();

  // TTL（30日後に自動削除）
  const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

  // エクスポートステータスアイテム
  const exportStatus: ExportStatusItem = {
    export_id,
    status: 'pending',
    requested_at,
    progress: 0,
    ttl,
    format: requestBody.format,
    filter: JSON.stringify(requestBody.filter),
  };

  logger.info('Creating export job', {
    export_id,
    format: requestBody.format,
    filter: requestBody.filter,
  });

  // DynamoDBに保存
  await retryWithBackoff(
    async () => {
      await dynamoClient.send(
        new PutItemCommand({
          TableName: EXPORT_STATUS_TABLE,
          Item: {
            export_id: { S: exportStatus.export_id },
            status: { S: exportStatus.status },
            requested_at: { S: exportStatus.requested_at },
            progress: { N: String(exportStatus.progress) },
            ttl: { N: String(exportStatus.ttl) },
            format: { S: exportStatus.format },
            filter: { S: exportStatus.filter },
          },
          ConditionExpression: 'attribute_not_exists(export_id)',
        })
      );
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      jitter: true,
      shouldRetry: (error) => {
        return error.name === 'ProvisionedThroughputExceededException';
      },
    }
  );

  logger.info('Export job created successfully', {
    export_id,
    status: exportStatus.status,
  });

  return exportStatus;
}

/**
 * エクスポートIDを生成
 *
 * フォーマット: export_タイムスタンプ_ランダム文字列_リクエストID先頭8文字
 * 例: export_1705305600000_abc123_12345678
 *
 * @param requestId リクエストID
 * @returns エクスポートID
 */
function generateExportId(requestId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const requestIdPrefix = requestId.substring(0, 8);
  return `export_${timestamp}_${random}_${requestIdPrefix}`;
}

/**
 * エクスポートステータス更新
 *
 * エクスポート状態の更新、エラー時のエラーメッセージ記録を行います。
 *
 * Requirements: 要件5.4（進捗）
 */

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';

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
 * エクスポートステータスを更新
 *
 * @param export_id エクスポートID
 * @param status 状態（pending, processing, completed, failed）
 * @param progress 進捗率（0〜100）
 * @param s3_key S3キー（オプション）
 * @param download_url ダウンロードURL（オプション）
 * @param error_message エラーメッセージ（オプション）
 */
export async function updateExportStatus(
  export_id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  progress: number,
  s3_key?: string,
  download_url?: string,
  error_message?: string
): Promise<void> {
  logger.info('Updating export status', {
    export_id,
    status,
    progress,
    s3_key,
    download_url,
    error_message,
  });

  // 更新式を構築
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // status
  updateExpressions.push('#status = :status');
  expressionAttributeNames['#status'] = 'status';
  expressionAttributeValues[':status'] = { S: status };

  // progress
  updateExpressions.push('#progress = :progress');
  expressionAttributeNames['#progress'] = 'progress';
  expressionAttributeValues[':progress'] = { N: String(progress) };

  // completed_at（completedまたはfailedの場合）
  if (status === 'completed' || status === 'failed') {
    updateExpressions.push('#completed_at = :completed_at');
    expressionAttributeNames['#completed_at'] = 'completed_at';
    expressionAttributeValues[':completed_at'] = { S: new Date().toISOString() };
  }

  // s3_key（オプション）
  if (s3_key) {
    updateExpressions.push('#s3_key = :s3_key');
    expressionAttributeNames['#s3_key'] = 's3_key';
    expressionAttributeValues[':s3_key'] = { S: s3_key };
  }

  // download_url（オプション）
  if (download_url) {
    updateExpressions.push('#download_url = :download_url');
    expressionAttributeNames['#download_url'] = 'download_url';
    expressionAttributeValues[':download_url'] = { S: download_url };
  }

  // error_message（オプション）
  if (error_message) {
    updateExpressions.push('#error_message = :error_message');
    expressionAttributeNames['#error_message'] = 'error_message';
    expressionAttributeValues[':error_message'] = { S: error_message };
  }

  // DynamoDBを更新
  await retryWithBackoff(
    async () => {
      await dynamoClient.send(
        new UpdateItemCommand({
          TableName: EXPORT_STATUS_TABLE,
          Key: {
            export_id: { S: export_id },
          },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
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

  logger.info('Export status updated successfully', {
    export_id,
    status,
    progress,
  });
}

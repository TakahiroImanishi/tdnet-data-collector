/**
 * 署名付きURL生成
 *
 * S3オブジェクトの署名付きURLを生成します（有効期限7日）。
 *
 * Requirements: 要件5.1（エクスポート）
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../utils/logger';
import { RetryableError } from '../../errors';

// S3クライアント（グローバルスコープで初期化）
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const EXPORT_BUCKET = process.env.EXPORT_BUCKET_NAME || 'tdnet-exports';

/**
 * 署名付きURLを生成
 *
 * @param s3_key S3キー
 * @param expiresIn 有効期限（秒）
 * @returns 署名付きURL
 * @throws {RetryableError} S3アクセスエラー時
 */
export async function generateSignedUrl(
  s3_key: string,
  expiresIn: number = 7 * 24 * 60 * 60 // デフォルト: 7日間
): Promise<string> {
  try {
    logger.info('Generating signed URL', {
      s3_key,
      expires_in: expiresIn,
    });

    // GetObjectCommandを作成
    const command = new GetObjectCommand({
      Bucket: EXPORT_BUCKET,
      Key: s3_key,
    });

    // 署名付きURLを生成
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

    logger.info('Signed URL generated successfully', {
      s3_key,
      signed_url: signedUrl,
    });

    return signedUrl;
  } catch (error) {
    // エラーオブジェクトのプロパティを安全に取得
    const errorObj = error as any;
    const errorType = errorObj?.name;
    const errorMessage = errorObj?.message;
    const stackTrace = errorObj?.stack;

    logger.error('Failed to generate signed URL', {
      error_type: errorType,
      error_message: errorMessage,
      context: { s3_key, expires_in: expiresIn },
      stack_trace: stackTrace,
    });

    // S3エラーは再試行可能
    throw new RetryableError('Failed to generate signed URL', error as Error);
  }
}

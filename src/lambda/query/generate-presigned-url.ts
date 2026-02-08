/**
 * Generate Presigned URL
 *
 * S3署名付きURLを生成します。
 * PDFファイルのダウンロード用に使用されます。
 *
 * Requirements: 要件4.4（PDFダウンロード）
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../utils/logger';

// S3クライアント（グローバルスコープで初期化）
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs';
const URL_EXPIRATION_SECONDS = 3600; // 1時間

/**
 * S3署名付きURLを生成
 *
 * @param s3Key S3キー（PDFファイルのパス）
 * @param expiresIn 有効期限（秒）デフォルト: 3600秒（1時間）
 * @returns 署名付きURL
 *
 * @example
 * ```typescript
 * const url = await generatePresignedUrl('2024/01/15/TD20240115001_7203.pdf');
 * // => "https://tdnet-pdfs.s3.amazonaws.com/2024/01/15/TD20240115001_7203.pdf?X-Amz-..."
 * ```
 */
export async function generatePresignedUrl(
  s3Key: string,
  expiresIn: number = URL_EXPIRATION_SECONDS
): Promise<string> {
  try {
    logger.info('Generating presigned URL', {
      s3_key: s3Key,
      bucket: BUCKET_NAME,
      expires_in: expiresIn,
    });

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn,
    });

    logger.info('Presigned URL generated successfully', {
      s3_key: s3Key,
      url_length: url.length,
    });

    return url;
  } catch (error) {
    logger.error('Failed to generate presigned URL', {
      s3_key: s3Key,
      bucket: BUCKET_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 複数のS3署名付きURLを一括生成
 *
 * @param s3Keys S3キーのリスト
 * @param expiresIn 有効期限（秒）デフォルト: 3600秒（1時間）
 * @returns 署名付きURLのマップ（キー: S3キー、値: 署名付きURL）
 */
export async function generatePresignedUrls(
  s3Keys: string[],
  expiresIn: number = URL_EXPIRATION_SECONDS
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  await Promise.all(
    s3Keys.map(async (s3Key) => {
      try {
        const url = await generatePresignedUrl(s3Key, expiresIn);
        urlMap.set(s3Key, url);
      } catch (error) {
        logger.error('Failed to generate presigned URL for key', {
          s3_key: s3Key,
          error: error instanceof Error ? error.message : String(error),
        });
        // エラーが発生してもスキップして継続
      }
    })
  );

  return urlMap;
}

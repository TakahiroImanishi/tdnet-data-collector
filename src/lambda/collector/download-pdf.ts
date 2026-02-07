/**
 * PDFダウンロード機能
 *
 * TDnetからPDFファイルをダウンロードし、S3に保存します。
 * ファイル整合性検証と再試行ロジックを含みます。
 *
 * Requirements: 要件1.3, 3.3, 6.1（PDFダウンロード、S3保存、エラーハンドリング）
 */

import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { validatePdfFile } from '../../scraper/pdf-downloader';
import { RateLimiter } from '../../utils/rate-limiter';
import { retryWithBackoff } from '../../utils/retry';
import { logger } from '../../utils/logger';
import { sendErrorMetric, sendSuccessMetric } from '../../utils/cloudwatch-metrics';
import { RetryableError } from '../../errors';

// S3クライアントはグローバルスコープで初期化（再利用される）
const s3Client = new S3Client({});

// レート制限設定（PDFダウンロードも2秒間隔）
const rateLimiter = new RateLimiter({ minDelayMs: 2000 });

// 環境変数は関数内で取得（テスト時の柔軟性のため）
function getS3Bucket(): string {
  return process.env.S3_BUCKET || 'tdnet-data-collector-pdfs';
}

/**
 * PDFファイルをダウンロードしてS3に保存
 *
 * @param disclosure_id - 開示ID
 * @param pdf_url - PDF URL
 * @param disclosed_at - 開示日時（ISO 8601形式）
 * @returns S3キー（保存先パス）
 * @throws RetryableError ネットワークエラー、サーバーエラー
 * @throws ValidationError PDFファイルが不正な場合
 *
 * @example
 * ```typescript
 * const s3Key = await downloadPdf(
 *   'TD20240115001',
 *   'https://www.release.tdnet.info/inbs/140120240115001.pdf',
 *   '2024-01-15T10:30:00Z'
 * );
 * console.log(`PDF saved to: ${s3Key}`);
 * // Output: PDF saved to: 2024/01/15/TD20240115001.pdf
 * ```
 */
export async function downloadPdf(
  disclosure_id: string,
  pdf_url: string,
  disclosed_at: string
): Promise<string> {
  try {
    logger.info('Downloading PDF', { disclosure_id, pdf_url });

    // PDFをダウンロード（再試行あり）
    const pdfBuffer = await retryWithBackoff(
      async () => {
        try {
          const response = await axios.get(pdf_url, {
            responseType: 'arraybuffer',
            timeout: 60000, // 60秒タイムアウト
            headers: {
              'User-Agent': 'TDnet-Data-Collector/1.0',
            },
          });
          return Buffer.from(response.data);
        } catch (error) {
          if (axios.isAxiosError(error)) {
            // タイムアウトエラー
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
              throw new RetryableError(`Timeout downloading PDF: ${pdf_url}`, error);
            }
            // 5xxエラー
            if (error.response && error.response.status >= 500) {
              throw new RetryableError(
                `Server error (${error.response.status}): ${pdf_url}`,
                error
              );
            }
            // 429 Too Many Requests
            if (error.response && error.response.status === 429) {
              throw new RetryableError(`Rate limit exceeded: ${pdf_url}`, error);
            }
          }
          throw error;
        }
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        jitter: true,
      }
    );

    // PDFファイル整合性検証
    validatePdfFile(pdfBuffer);

    // S3パス生成（YYYY/MM/DD/disclosure_id.pdf）
    const s3Key = generateS3Key(disclosure_id, disclosed_at);

    // S3にアップロード
    await s3Client.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        Metadata: {
          disclosure_id,
          disclosed_at,
          uploaded_at: new Date().toISOString(),
        },
      })
    );

    logger.info('PDF uploaded to S3', {
      disclosure_id,
      s3_key: s3Key,
      size: pdfBuffer.length,
    });

    return s3Key;
  } catch (error) {
    logger.error('Failed to download PDF', {
      disclosure_id,
      pdf_url,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * S3キーを生成（YYYY/MM/DD/disclosure_id.pdf形式）
 *
 * JSTに変換してYYYY/MM/DD形式を生成します。
 * TDnetは日本の開示情報サービスであり、開示時刻は日本時間（JST, UTC+9）で管理されます。
 *
 * @param disclosure_id - 開示ID
 * @param disclosed_at - 開示日時（ISO 8601形式）
 * @returns S3キー
 *
 * @example
 * ```typescript
 * // UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00
 * const key = generateS3Key('TD20240131001', '2024-01-31T15:30:00Z');
 * console.log(key); // Output: 2024/02/01/TD20240131001.pdf
 * ```
 */
function generateS3Key(disclosure_id: string, disclosed_at: string): string {
  // UTCからJSTに変換（UTC+9時間）
  const date = new Date(disclosed_at);
  const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');

  return `${year}/${month}/${day}/${disclosure_id}.pdf`;
}

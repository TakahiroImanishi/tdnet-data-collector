/**
 * PDFダウンローダー
 *
 * TDnetからPDFファイルをダウンロードし、バリデーションを行います。
 *
 * Requirements: 要件1.3, 2.3（PDFダウンロード、整合性検証）
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { RetryableError, ValidationError } from '../errors';
import { retryWithBackoff } from '../utils/retry';

/**
 * PDFファイルをダウンロード
 *
 * @param url PDF URL
 * @returns PDFファイルのバイナリデータ
 * @throws RetryableError ネットワークエラー
 * @throws ValidationError PDFファイルが不正な場合
 */
export async function downloadPdf(url: string): Promise<Buffer> {
  return await retryWithBackoff(
    async () => {
      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000, // 30秒タイムアウト
          headers: {
            'User-Agent': 'TDnet-Data-Collector/1.0',
          },
        });

        const buffer = Buffer.from(response.data);

        // PDFファイルのバリデーション
        validatePdfFile(buffer);

        logger.info('PDF downloaded successfully', {
          url,
          size: buffer.length,
        });

        return buffer;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            throw new RetryableError(`Timeout downloading PDF: ${url}`);
          }
          if (error.response && error.response.status >= 500) {
            throw new RetryableError(`Server error (${error.response.status}): ${url}`);
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
}

/**
 * PDFファイルのバリデーション
 *
 * @param buffer PDFファイルのバイナリデータ
 * @throws ValidationError PDFファイルが不正な場合
 */
export function validatePdfFile(buffer: Buffer): void {
  // ファイルサイズチェック（10KB〜50MB）
  const minSize = 10 * 1024; // 10KB
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (buffer.length < minSize) {
    throw new ValidationError(`PDF file too small: ${buffer.length} bytes (min: ${minSize})`);
  }

  if (buffer.length > maxSize) {
    throw new ValidationError(`PDF file too large: ${buffer.length} bytes (max: ${maxSize})`);
  }

  // PDFヘッダーチェック（%PDF-で開始）
  const header = buffer.slice(0, 5).toString('utf-8');
  if (!header.startsWith('%PDF-')) {
    throw new ValidationError(`Invalid PDF header: ${header}`);
  }
}

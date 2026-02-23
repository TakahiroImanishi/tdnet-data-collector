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
import { HTTP_TIMEOUT_MS, USER_AGENT_SHORT } from '../constants/http-config';
import { MIN_PDF_SIZE, MAX_PDF_SIZE } from '../constants';

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
          timeout: HTTP_TIMEOUT_MS,
          headers: {
            'User-Agent': USER_AGENT_SHORT,
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
  if (buffer.length < MIN_PDF_SIZE) {
    throw new ValidationError(`PDF file too small: ${buffer.length} bytes (min: ${MIN_PDF_SIZE})`);
  }

  if (buffer.length > MAX_PDF_SIZE) {
    throw new ValidationError(`PDF file too large: ${buffer.length} bytes (max: ${MAX_PDF_SIZE})`);
  }

  // PDFヘッダーチェック（%PDF-で開始）
  const header = buffer.slice(0, 5).toString('utf-8');
  if (!header.startsWith('%PDF-')) {
    throw new ValidationError(`Invalid PDF header: ${header}`);
  }
}

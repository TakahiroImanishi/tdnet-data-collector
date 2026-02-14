/**
 * TDnet List Scraper
 *
 * 指定日のTDnet開示情報リストを取得し、メタデータを抽出します。
 * レート制限と再試行ロジックを適用して、TDnetサーバーへの負荷を最小化します。
 *
 * Requirements: 要件1.1, 9.1
 */

import axios, { AxiosError } from 'axios';
import { parseDisclosureList, DisclosureMetadata } from '../../scraper/html-parser';
import { RateLimiter } from '../../utils/rate-limiter';
import { retryWithBackoff } from '../../utils/retry';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendSuccessMetric } from '../../utils/cloudwatch-metrics';
import { RetryableError, ValidationError } from '../../errors';

/**
 * レート制限設定（2秒間隔）
 * TDnetサーバーへの過度な負荷を防ぐため
 */
const rateLimiter = new RateLimiter({ minDelayMs: 2000 });

/**
 * HTTPタイムアウト設定（30秒）
 */
const HTTP_TIMEOUT_MS = 30000;

/**
 * User-Agent設定
 */
const USER_AGENT = 'TDnet-Data-Collector/1.0 (https://github.com/your-org/tdnet-data-collector)';

/**
 * 指定日のTDnet開示情報リストを取得
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @returns 開示情報メタデータの配列
 * @throws ValidationError 日付フォーマットが不正な場合
 * @throws RetryableError ネットワークエラーまたはHTTPエラー
 *
 * @example
 * ```typescript
 * const disclosures = await scrapeTdnetList('2024-01-15');
 * console.log(`Found ${disclosures.length} disclosures`);
 * ```
 */
export async function scrapeTdnetList(date: string): Promise<DisclosureMetadata[]> {
  // 日付フォーマットのバリデーション
  validateDateFormat(date);

  try {
    logger.info('Scraping TDnet list', { date });

    // レート制限を適用
    await rateLimiter.waitIfNeeded();

    // TDnetからHTMLを取得（再試行あり）
    const html = await fetchTdnetHtml(date);

    // HTMLをパース（日付を渡す）
    const disclosures = parseDisclosureList(html, date);

    logger.info('TDnet list scraped successfully', {
      date,
      count: disclosures.length,
    });

    // 成功メトリクス送信
    await sendSuccessMetric(disclosures.length, 'ScrapeTdnetList', {
      Date: date,
    });

    return disclosures;
  } catch (error) {
    logger.error(
      'Failed to scrape TDnet list',
      createErrorContext(error as Error, { date })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'ScrapeTdnetList',
      { Date: date }
    );

    throw error;
  }
}

/**
 * 日付フォーマットのバリデーション
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @throws ValidationError 日付フォーマットが不正な場合
 *
 * @remarks
 * 以下のバリデーションを実施：
 * 1. フォーマット検証（YYYY-MM-DD形式）
 * 2. 存在する日付の検証（2024-02-30などを拒否）
 * 3. 範囲検証（1970-01-01以降、現在+1日以内）
 */
function validateDateFormat(date: string): void {
  // 1. フォーマット検証
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError(
      `Invalid date format: ${date}. Expected YYYY-MM-DD format.`
    );
  }

  // 2. 存在する日付の検証
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    throw new ValidationError(
      `Invalid date: ${date}. Date does not exist.`
    );
  }

  // 日付の各部分を抽出して検証
  const [year, month, day] = date.split('-').map(Number);
  const reconstructedDate = new Date(year, month - 1, day);
  
  // 日付が正規化されていないか確認（例: 2024-02-30 → 2024-03-02）
  if (
    reconstructedDate.getFullYear() !== year ||
    reconstructedDate.getMonth() !== month - 1 ||
    reconstructedDate.getDate() !== day
  ) {
    throw new ValidationError(
      `Invalid date: ${date}. Date does not exist (e.g., February 30th).`
    );
  }

  // 3. 範囲検証（1970-01-01以降、現在+1日以内）
  const minDate = new Date('1970-01-01T00:00:00Z');
  const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 現在時刻+1日
  
  if (dateObj < minDate) {
    throw new ValidationError(
      `Date out of range: ${date}. Must be on or after 1970-01-01.`
    );
  }
  
  if (dateObj > maxDate) {
    throw new ValidationError(
      `Date out of range: ${date}. Must be within 1 day of current date.`
    );
  }
}

/**
 * TDnetからHTMLを取得（再試行あり）
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @returns HTMLコンテンツ（UTF-8にデコード済み）
 * @throws RetryableError ネットワークエラーまたはHTTPエラー
 */
async function fetchTdnetHtml(date: string): Promise<string> {
  const url = buildTdnetUrl(date);

  return await retryWithBackoff(
    async () => {
      try {
        logger.debug('Fetching TDnet HTML', { url, date });

        const response = await axios.get(url, {
          timeout: HTTP_TIMEOUT_MS,
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
          },
          // Shift_JISエンコーディング対応
          responseType: 'arraybuffer',
          validateStatus: (status) => status >= 200 && status < 300,
        });

        // Shift_JISからUTF-8にデコード
        const html = decodeShiftJIS(response.data);

        logger.debug('TDnet HTML fetched successfully', {
          url,
          date,
          status: response.status,
          content_length: html.length,
        });

        return html;
      } catch (error) {
        // AxiosErrorを適切なエラーに変換
        throw convertAxiosError(error as AxiosError, url);
      }
    },
    {
      maxRetries: 3,
      initialDelay: 2000,
      backoffMultiplier: 2,
      jitter: true,
      shouldRetry: (error) => {
        // RetryableErrorのみ再試行
        return error instanceof RetryableError;
      },
    }
  );
}

/**
 * Shift_JISバイト配列をUTF-8文字列にデコード
 *
 * @param buffer Shift_JISエンコードされたバイト配列またはUTF-8文字列
 * @returns UTF-8文字列
 */
function decodeShiftJIS(buffer: ArrayBuffer | string): string {
  // 既に文字列の場合はそのまま返す（テスト互換性のため）
  if (typeof buffer === 'string') {
    return buffer;
  }

  try {
    // TextDecoderを使用してShift_JISをデコード
    const decoder = new TextDecoder('shift_jis');
    return decoder.decode(buffer);
  } catch (error) {
    logger.error('Failed to decode Shift_JIS', {
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
    // フォールバック: UTF-8として解釈
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }
}

/**
 * TDnet URLを構築
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @returns TDnet URL
 *
 * @remarks
 * TDnetの実際のURL形式: https://www.release.tdnet.info/inbs/I_list_001_YYYYMMDD.html
 * 日付はハイフンなしの8桁形式（例: 20260214）
 */
function buildTdnetUrl(date: string): string {
  const baseUrl = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info/inbs';
  // YYYY-MM-DD → YYYYMMDD に変換
  const dateWithoutHyphens = date.replace(/-/g, '');
  return `${baseUrl}/I_list_001_${dateWithoutHyphens}.html`;
}

/**
 * AxiosErrorを適切なエラーに変換
 *
 * @param error AxiosError
 * @param url リクエストURL
 * @returns 変換されたエラー
 */
function convertAxiosError(error: AxiosError, url: string): Error {
  // ネットワークエラー
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return new RetryableError(
      `Network error: ${error.code} - ${error.message}`,
      error
    );
  }

  // タイムアウトエラー
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return new RetryableError(
      `Request timeout: ${error.message}`,
      error
    );
  }

  // HTTPエラー
  if (error.response) {
    const status = error.response.status;

    // 5xxエラー（サーバーエラー）- 再試行可能
    if (status >= 500) {
      return new RetryableError(
        `Server error: ${status} ${error.response.statusText}`,
        error
      );
    }

    // 429エラー（レート制限）- 再試行可能
    if (status === 429) {
      return new RetryableError(
        `Rate limit exceeded: ${status} ${error.response.statusText}`,
        error
      );
    }

    // 404エラー（ページが存在しない）- 再試行不可
    if (status === 404) {
      return new ValidationError(
        `TDnet page not found: ${url}. The specified date may not have any disclosures.`
      );
    }

    // その他のHTTPエラー - 再試行不可
    return new Error(
      `HTTP error: ${status} ${error.response.statusText}`
    );
  }

  // その他のエラー
  return new Error(
    `Failed to fetch TDnet HTML: ${error.message}`
  );
}

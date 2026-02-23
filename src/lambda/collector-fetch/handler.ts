/**
 * Lambda Collector-Fetch Handler
 *
 * Step Functions用のデータ取得Lambda関数。
 * TDnet APIから1ページ分のデータを取得し、レート制限を適用します。
 *
 * Requirements: 要件1.1, 1.2, 5.1, 5.2
 *
 * 関連ドキュメント:
 * - .kiro/steering/core/tdnet-implementation-rules.md - 実装ルール
 * - .kiro/steering/development/lambda-implementation.md - Lambda実装ガイド
 * - .kiro/steering/core/error-handling-patterns.md - エラーハンドリング
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md - アーキテクチャ設計
 */

import { Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendSuccessMetric } from '../../utils/cloudwatch-metrics';
import { ValidationError, RetryableError } from '../../errors';
import { RateLimiter } from '../../utils/rate-limiter';
import { retryWithBackoff } from '../../utils/retry';
import { DisclosureMetadata } from '../../scraper/html-parser';
import axios, { AxiosError } from 'axios';
import * as iconv from 'iconv-lite';
import { parseDisclosureList } from '../../scraper/html-parser';
import { HTTP_TIMEOUT_MS, USER_AGENT_FULL } from '../../constants/http-config';
import { TDNET_MIN_DELAY_MS } from '../../constants/rate-limits';

/**
 * レート制限設定
 * TDnetサーバーへの過度な負荷を防ぐため
 */
const rateLimiter = new RateLimiter({ minDelayMs: TDNET_MIN_DELAY_MS });

/**
 * Lambda Collector-Fetchイベント
 */
export interface FetchEvent {
  /** 実行ID（Step Functionsから渡される） */
  execution_id: string;

  /** ページ番号（日付文字列、YYYY-MM-DD形式） */
  page_number: string;

  /** 開始日（ISO 8601形式、YYYY-MM-DD） */
  start_date: string;

  /** 終了日（ISO 8601形式、YYYY-MM-DD） */
  end_date: string;

  /** 最大収集件数（オプション） */
  max_items?: number;
}

/**
 * Lambda Collector-Fetchレスポンス
 */
export interface FetchResponse {
  /** 実行ID */
  execution_id: string;

  /** ページ番号（日付文字列） */
  page_number: string;

  /** 開示情報メタデータリスト */
  items: DisclosureMetadata[];

  /** 取得件数 */
  count: number;
}

/**
 * Lambda Collector-Fetchハンドラー
 *
 * TDnet APIから1ページ分のデータを取得します。
 * レート制限を適用し、エラーハンドリングを実施します。
 *
 * @param event FetchEvent
 * @param context Lambda Context
 * @returns FetchResponse
 *
 * @example
 * ```typescript
 * const response = await handler({
 *   execution_id: 'exec_123',
 *   page_number: 1,
 *   start_date: '2024-01-15',
 *   end_date: '2024-01-15',
 * }, context);
 * ```
 */
export async function handler(event: FetchEvent, context: Context): Promise<FetchResponse> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Collector-Fetch started', {
      event,
      execution_id: event.execution_id,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // イベントのバリデーション
    validateEvent(event);

    // レート制限を適用
    await rateLimiter.waitIfNeeded();

    // TDnetから1ページ分のデータを取得（page_numberは日付文字列）
    const items = await fetchTdnetPage(
      event.page_number,
      1 // 常に1ページ目を取得
    );

    const duration = Date.now() - startTime;

    logger.info('Lambda Collector-Fetch completed', {
      execution_id: event.execution_id,
      page_number: event.page_number,
      count: items.length,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendSuccessMetric(items.length, 'CollectorFetch', {
      ExecutionId: event.execution_id,
      PageNumber: String(event.page_number),
    });

    return {
      execution_id: event.execution_id,
      page_number: event.page_number,
      items,
      count: items.length,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Collector-Fetch failed',
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
      'CollectorFetch',
      {
        ExecutionId: event.execution_id,
        PageNumber: String(event.page_number),
      }
    );

    throw error;
  }
}

/**
 * イベントのバリデーション
 *
 * @param event FetchEvent
 * @throws ValidationError バリデーションエラー
 */
function validateEvent(event: FetchEvent): void {
  // 日付フォーマットのバリデーション用正規表現（YYYY-MM-DD）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  // execution_idのバリデーション
  if (!event.execution_id || typeof event.execution_id !== 'string') {
    throw new ValidationError(
      `Invalid execution_id: ${event.execution_id}. Expected non-empty string.`
    );
  }

  // page_numberのバリデーション（日付文字列、YYYY-MM-DD形式）
  if (!event.page_number || typeof event.page_number !== 'string') {
    throw new ValidationError(
      `Invalid page_number: ${event.page_number}. Expected non-empty string (YYYY-MM-DD format).`
    );
  }

  if (!dateRegex.test(event.page_number)) {
    throw new ValidationError(
      `Invalid page_number format: ${event.page_number}. Expected YYYY-MM-DD format.`
    );
  }

  // start_dateのバリデーション
  if (!event.start_date || typeof event.start_date !== 'string') {
    throw new ValidationError(
      `Invalid start_date: ${event.start_date}. Expected non-empty string.`
    );
  }

  if (!dateRegex.test(event.start_date)) {
    throw new ValidationError(
      `Invalid start_date format: ${event.start_date}. Expected YYYY-MM-DD format.`
    );
  }

  // end_dateのバリデーション
  if (!event.end_date || typeof event.end_date !== 'string') {
    throw new ValidationError(`Invalid end_date: ${event.end_date}. Expected non-empty string.`);
  }

  if (!dateRegex.test(event.end_date)) {
    throw new ValidationError(
      `Invalid end_date format: ${event.end_date}. Expected YYYY-MM-DD format.`
    );
  }

  // 日付の有効性チェック
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);

  if (isNaN(startDate.getTime())) {
    throw new ValidationError(`Invalid start_date: ${event.start_date}. Date does not exist.`);
  }
  if (isNaN(endDate.getTime())) {
    throw new ValidationError(`Invalid end_date: ${event.end_date}. Date does not exist.`);
  }

  // 日付順序チェック
  if (startDate > endDate) {
    throw new ValidationError(
      `start_date (${event.start_date}) must be before or equal to end_date (${event.end_date})`
    );
  }
}

/**
 * TDnetから1ページ分のデータを取得
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @param pageNumber ページ番号
 * @returns 開示情報メタデータの配列
 * @throws RetryableError ネットワークエラーまたはHTTPエラー
 * @throws ValidationError 日付フォーマットが不正な場合
 */
async function fetchTdnetPage(date: string, pageNumber: number): Promise<DisclosureMetadata[]> {
  const url = buildTdnetUrl(date, pageNumber);

  return await retryWithBackoff(
    async () => {
      try {
        logger.debug('Fetching TDnet page', { url, date, pageNumber });

        const response = await axios.get(url, {
          timeout: HTTP_TIMEOUT_MS,
          headers: {
            'User-Agent': USER_AGENT_FULL,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            Connection: 'keep-alive',
          },
          // Shift_JISエンコーディング対応
          responseType: 'arraybuffer',
          validateStatus: (status) => status >= 200 && status < 300,
        });

        // Shift_JISからUTF-8にデコード
        const html = decodeShiftJIS(response.data);

        logger.debug('TDnet page fetched successfully', {
          url,
          date,
          pageNumber,
          status: response.status,
          content_length: html.length,
        });

        // HTMLをパース
        const disclosures = parseDisclosureList(html, date);

        logger.info('TDnet page parsed', {
          date,
          pageNumber,
          count: disclosures.length,
        });

        return disclosures;
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
    // iconv-liteを使用してShift_JISをデコード
    // ArrayBufferをBufferに変換
    const uint8Array = new Uint8Array(buffer);
    const nodeBuffer = Buffer.from(uint8Array);

    // Shift_JISからUTF-8にデコード
    const decoded = iconv.decode(nodeBuffer, 'shift_jis');

    logger.debug('Shift_JIS decoded successfully', {
      buffer_size: nodeBuffer.length,
      decoded_length: decoded.length,
    });

    return decoded;
  } catch (error) {
    logger.error('Failed to decode Shift_JIS', {
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });

    // フォールバック: UTF-8として解釈
    try {
      const uint8Array = new Uint8Array(buffer);
      const nodeBuffer = Buffer.from(uint8Array);
      return iconv.decode(nodeBuffer, 'utf-8');
    } catch (fallbackError) {
      logger.error('Fallback UTF-8 decode also failed', {
        error_type: fallbackError instanceof Error ? fallbackError.constructor.name : 'Unknown',
        error_message:
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
      // 最終フォールバック: 空文字列を返す
      return '';
    }
  }
}

/**
 * TDnet URLを構築
 *
 * @param date 日付（YYYY-MM-DD形式）
 * @param pageNumber ページ番号（デフォルト: 1）
 * @returns TDnet URL
 *
 * @remarks
 * TDnetの実際のURL形式:
 * - 1ページ目: https://www.release.tdnet.info/inbs/I_list_001_YYYYMMDD.html
 * - 2ページ目: https://www.release.tdnet.info/inbs/I_list_002_YYYYMMDD.html
 * - 3ページ目: https://www.release.tdnet.info/inbs/I_list_003_YYYYMMDD.html
 * 日付はハイフンなしの8桁形式（例: 20260214）
 */
function buildTdnetUrl(date: string, pageNumber: number = 1): string {
  const baseUrl = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info/inbs';
  // YYYY-MM-DD → YYYYMMDD に変換
  const dateWithoutHyphens = date.replace(/-/g, '');
  // ページ番号を3桁にゼロパディング（例: 1 → 001, 2 → 002）
  const pageNumberPadded = String(pageNumber).padStart(3, '0');
  return `${baseUrl}/I_list_${pageNumberPadded}_${dateWithoutHyphens}.html`;
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
    return new RetryableError(`Network error: ${error.code} - ${error.message}`, error);
  }

  // タイムアウトエラー
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return new RetryableError(`Request timeout: ${error.message}`, error);
  }

  // HTTPエラー
  if (error.response) {
    const status = error.response.status;

    // 5xxエラー（サーバーエラー）- 再試行可能
    if (status >= 500) {
      return new RetryableError(`Server error: ${status} ${error.response.statusText}`, error);
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
    return new Error(`HTTP error: ${status} ${error.response.statusText}`);
  }

  // その他のエラー
  return new Error(`Failed to fetch TDnet page: ${error.message}`);
}

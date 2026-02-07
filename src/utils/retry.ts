/**
 * 再試行ロジック（指数バックオフ）
 *
 * 一時的なエラーに対して、指数バックオフアルゴリズムを使用した再試行を実行します。
 * ジッター（ランダム遅延）を追加することで、複数のクライアントが同時に再試行する際の
 * サンダリングハード問題を回避します。
 *
 * Requirements: 要件6.2（再試行ロジック）
 */

import { RetryableError } from '../errors';

/**
 * 再試行オプション
 */
export interface RetryOptions {
  /**
   * 最大再試行回数（デフォルト: 3）
   */
  maxRetries: number;

  /**
   * 初期遅延時間（ミリ秒、デフォルト: 2000）
   */
  initialDelay: number;

  /**
   * バックオフ倍率（デフォルト: 2）
   */
  backoffMultiplier: number;

  /**
   * ジッター（ランダム遅延）を追加するか（デフォルト: true）
   */
  jitter: boolean;

  /**
   * カスタム再試行判定関数（オプション）
   * エラーが再試行可能かどうかを判定します。
   * 指定しない場合は、RetryableErrorのみ再試行します。
   */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * デフォルトの再試行オプション
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 2000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * デフォルトの再試行判定関数
 * RetryableErrorのみ再試行します。
 */
function defaultShouldRetry(error: Error): boolean {
  return error instanceof RetryableError;
}

/**
 * 指数バックオフを使用した再試行ロジック
 *
 * @param operation 実行する非同期処理
 * @param options 再試行オプション
 * @returns 処理の結果
 * @throws 最大再試行回数に達した場合、または再試行不可能なエラーの場合
 *
 * @example
 * ```typescript
 * // 基本的な使用例
 * const result = await retryWithBackoff(
 *   async () => await fetchData(),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 2000,
 *     backoffMultiplier: 2,
 *     jitter: true,
 *   }
 * );
 *
 * // カスタム再試行判定
 * const result = await retryWithBackoff(
 *   async () => await fetchData(),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     backoffMultiplier: 2,
 *     jitter: true,
 *     shouldRetry: (error) => {
 *       // ネットワークエラーのみ再試行
 *       return error.message.includes('ECONNRESET');
 *     },
 *   }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || defaultShouldRetry;

  let lastError: Error | undefined;
  let attempt = 0;

  while (attempt <= opts.maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最大再試行回数に達した場合は、エラーをスロー
      if (attempt >= opts.maxRetries) {
        throw lastError;
      }

      // 再試行不可能なエラーの場合は、即座にスロー
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // 遅延時間を計算（指数バックオフ）
      const delay = calculateDelay(attempt, opts);

      // 遅延後に再試行
      await sleep(delay);
      attempt++;
    }
  }

  // この行には到達しないはずだが、TypeScriptの型チェックのために必要
  throw lastError || new Error('Unexpected error in retryWithBackoff');
}

/**
 * 遅延時間を計算（指数バックオフ + ジッター）
 *
 * @param attempt 現在の試行回数（0から始まる）
 * @param options 再試行オプション
 * @returns 遅延時間（ミリ秒）
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  // 指数バックオフ: initialDelay * (backoffMultiplier ^ attempt)
  const exponentialDelay =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt);

  // ジッターを追加（0〜exponentialDelayのランダム値）
  if (options.jitter) {
    return Math.random() * exponentialDelay;
  }

  return exponentialDelay;
}

/**
 * 指定時間スリープ
 *
 * @param ms スリープ時間（ミリ秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 再試行可能なエラーかどうかを判定するヘルパー関数
 *
 * @param error エラーオブジェクト
 * @returns 再試行可能な場合はtrue
 *
 * @example
 * ```typescript
 * try {
 *   await operation();
 * } catch (error) {
 *   if (isRetryableError(error)) {
 *     // 再試行ロジック
 *   } else {
 *     // 即座に失敗
 *   }
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  // RetryableErrorまたはそのサブクラス
  if (error instanceof RetryableError) {
    return true;
  }

  // ネットワークエラー
  const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
  if (networkErrors.some((code) => error.message.includes(code))) {
    return true;
  }

  // HTTPタイムアウト
  if (error.message.includes('timeout')) {
    return true;
  }

  // AWS一時的エラー
  const awsErrors = ['ThrottlingException', 'ServiceUnavailable', 'RequestTimeout'];
  if (awsErrors.some((code) => error.message.includes(code))) {
    return true;
  }

  return false;
}

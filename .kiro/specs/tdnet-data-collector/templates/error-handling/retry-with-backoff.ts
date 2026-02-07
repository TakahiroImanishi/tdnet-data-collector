/**
 * Retry with Exponential Backoff Implementation
 * 
 * このファイルは、指数バックオフを使用した再試行ロジックの実装例です。
 * 
 * 使用方法:
 * ```typescript
 * import { retryWithBackoff, RetryableError } from './retry-with-backoff';
 * 
 * const result = await retryWithBackoff(
 *     async () => {
 *         // 再試行可能な処理
 *         const response = await axios.get(url);
 *         return response.data;
 *     },
 *     {
 *         maxRetries: 3,
 *         initialDelay: 1000,
 *         maxDelay: 60000,
 *         backoffMultiplier: 2,
 *         jitter: true,
 *     }
 * );
 * ```
 */

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    jitter?: boolean;
}

export class RetryableError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'RetryableError';
    }
}

export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 60000,
        backoffMultiplier = 2,
        jitter = true,
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // 再試行不可能なエラーは即座に失敗
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            
            // 最後の試行で失敗した場合
            if (attempt === maxRetries) {
                console.error('Max retries exceeded', {
                    attempts: attempt + 1,
                    error: lastError.message,
                });
                throw lastError;
            }
            
            // 待機時間を計算（指数バックオフ）
            let delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );
            
            // ジッター追加（ランダム性）
            if (jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            console.warn('Retrying after error', {
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastError.message,
            });
            
            await sleep(delay);
        }
    }
    
    throw lastError!;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * エラーが再試行可能かどうかを判定
 */
export function isRetryableError(error: any): boolean {
    // ネットワークエラー
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
        return true;
    }
    
    // HTTPステータスコード
    if (error.response?.status) {
        const status = error.response.status;
        return status === 429 || status === 503 || status >= 500;
    }
    
    // AWS SDKエラー
    if (error.name === 'ThrottlingException' ||
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'ServiceUnavailable') {
        return true;
    }
    
    return false;
}

/**
 * スマート再試行: エラーの種類を自動判定して再試行
 */
export async function processWithSmartRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    return retryWithBackoff(
        async () => {
            try {
                return await fn();
            } catch (error) {
                if (isRetryableError(error)) {
                    throw new RetryableError(
                        `Retryable error: ${error.message}`,
                        error
                    );
                }
                throw error;
            }
        },
        options
    );
}

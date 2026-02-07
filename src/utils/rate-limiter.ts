/**
 * RateLimiter - リクエストレート制限クラス
 * 
 * TDnetへのリクエストを適切に制限し、過度な負荷をかけないようにする。
 * 連続リクエスト間で最小遅延時間を確保する。
 * 
 * Steering準拠:
 * - development/tdnet-scraping-patterns.md: レート制限実装パターン
 * - core/error-handling-patterns.md: 構造化ログの記録
 * 
 * @example
 * ```typescript
 * const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
 * 
 * for (const url of urls) {
 *     await rateLimiter.waitIfNeeded();
 *     const data = await fetchData(url);
 * }
 * ```
 */

import { logger } from './logger';

/**
 * RateLimiterのオプション
 */
export interface RateLimiterOptions {
    /**
     * 最小遅延時間（ミリ秒）
     * @default 2000
     */
    minDelayMs: number;
}

/**
 * レート制限を管理するクラス
 * 
 * 連続リクエスト間で最小遅延時間を確保し、
 * 外部サービスへの過度な負荷を防ぐ。
 */
export class RateLimiter {
    private lastRequestTime: number | null = null;
    private minDelayMs: number;

    /**
     * RateLimiterを初期化
     * 
     * @param options - レート制限のオプション
     */
    constructor(options: RateLimiterOptions = { minDelayMs: 2000 }) {
        this.minDelayMs = options.minDelayMs;
    }

    /**
     * リクエスト前に呼び出し、必要に応じて待機する
     * 
     * 最後のリクエストから最小遅延時間が経過していない場合、
     * 残り時間だけ待機する。
     * 
     * Steering準拠: 構造化ログを記録（development/tdnet-scraping-patterns.md）
     * 
     * @returns Promise<void>
     * 
     * @example
     * ```typescript
     * const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
     * 
     * await rateLimiter.waitIfNeeded(); // 最初のリクエスト（即座に実行）
     * await rateLimiter.waitIfNeeded(); // 2回目のリクエスト（2000ms待機）
     * ```
     */
    async waitIfNeeded(): Promise<void> {
        if (this.lastRequestTime === null) {
            // 最初のリクエストは即座に実行
            this.lastRequestTime = Date.now();
            logger.debug('Rate limiter: first request, no delay');
            return;
        }

        const elapsed = Date.now() - this.lastRequestTime;
        const delay = this.minDelayMs - elapsed;

        if (delay > 0) {
            // 最小遅延時間が経過していない場合、残り時間だけ待機
            logger.debug('Rate limiting: waiting', {
                waitTime: delay,
                minDelayMs: this.minDelayMs,
                elapsed,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * 最後のリクエスト時刻をリセット
     * 
     * リセット後の最初のリクエストは即座に実行される。
     * 
     * @example
     * ```typescript
     * const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
     * 
     * await rateLimiter.waitIfNeeded(); // 最初のリクエスト
     * rateLimiter.reset(); // リセット
     * await rateLimiter.waitIfNeeded(); // リセット後の最初のリクエスト（即座に実行）
     * ```
     */
    reset(): void {
        this.lastRequestTime = null;
    }

    /**
     * 最小遅延時間を取得
     * 
     * @returns 最小遅延時間（ミリ秒）
     */
    getMinDelayMs(): number {
        return this.minDelayMs;
    }

    /**
     * 最後のリクエスト時刻を取得
     * 
     * @returns 最後のリクエスト時刻（Unix時刻）、またはnull（リクエスト未実行）
     */
    getLastRequestTime(): number | null {
        return this.lastRequestTime;
    }
}

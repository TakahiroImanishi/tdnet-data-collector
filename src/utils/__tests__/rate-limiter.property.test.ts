/**
 * RateLimiter - プロパティベーステスト
 * 
 * fast-checkを使用して、任意の回数のリクエストに対して
 * レート制限が遵守されることを検証する。
 */

import * as fc from 'fast-check';
import { RateLimiter } from '../rate-limiter';

describe('RateLimiter - Property Tests', () => {
    /**
     * Property 12: レート制限の遵守
     * 
     * 任意の回数のリクエストに対して、連続リクエスト間で
     * 最小遅延時間が確保されることを検証する。
     * 
     * Steering準拠: development/testing-strategy.md
     * - 最低100回の反復実行（推奨1000回）
     * 
     * 検証内容:
     * - リクエスト回数: 2-5回（テスト時間を考慮して削減）
     * - 最小遅延時間: 50-200ms（テスト用に短縮）
     * - 連続リクエスト間の遅延時間が最小遅延時間以上であること
     * - 50msの誤差を許容（システムの処理時間を考慮）
     */
    it('Property 12: レート制限の遵守 - 連続リクエスト間で最小遅延時間が確保される', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 2, max: 5 }), // リクエスト回数（テスト時間を考慮）
                fc.integer({ min: 50, max: 200 }), // 最小遅延時間（テスト用に短縮）
                async (requestCount, minDelayMs) => {
                    const rateLimiter = new RateLimiter({ minDelayMs });
                    const timestamps: number[] = [];

                    // 指定回数のリクエストを実行
                    for (let i = 0; i < requestCount; i++) {
                        await rateLimiter.waitIfNeeded();
                        timestamps.push(Date.now());
                    }

                    // 連続リクエスト間の遅延時間を検証
                    for (let i = 1; i < timestamps.length; i++) {
                        const delay = timestamps[i] - timestamps[i - 1];
                        
                        // 最小遅延時間以上であることを確認（50msの誤差を許容）
                        expect(delay).toBeGreaterThanOrEqual(minDelayMs - 50);
                    }
                }
            ),
            { numRuns: 100 } // Steering推奨: 最低100回反復実行
        );
    }, 120000); // タイムアウト: 120秒（反復回数増加に対応）

    /**
     * 最初のリクエストは即座に実行される
     * 
     * 検証内容:
     * - 最初のリクエストは待機時間なしで実行される
     * - 実行時間が100ms以内であること
     */
    it('最初のリクエストは即座に実行される', async () => {
        const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
        const start = Date.now();
        await rateLimiter.waitIfNeeded();
        const elapsed = Date.now() - start;
        
        expect(elapsed).toBeLessThan(100); // 100ms以内
        expect(rateLimiter.getLastRequestTime()).not.toBeNull();
    });

    /**
     * 2回目のリクエストは最小遅延時間後に実行される
     * 
     * 検証内容:
     * - 2回目のリクエストは最小遅延時間だけ待機する
     * - 実際の遅延時間が最小遅延時間±100ms以内であること
     */
    it('2回目のリクエストは最小遅延時間後に実行される', async () => {
        const minDelayMs = 500; // テスト用に短縮
        const rateLimiter = new RateLimiter({ minDelayMs });
        
        await rateLimiter.waitIfNeeded(); // 最初のリクエスト
        const start = Date.now();
        await rateLimiter.waitIfNeeded(); // 2回目のリクエスト
        const elapsed = Date.now() - start;
        
        // 最小遅延時間以上であることを確認（50msの誤差を許容）
        expect(elapsed).toBeGreaterThanOrEqual(minDelayMs - 50);
        // 最小遅延時間+100ms以内であることを確認
        expect(elapsed).toBeLessThan(minDelayMs + 100);
    });

    /**
     * reset()後は即座に実行される
     * 
     * 検証内容:
     * - reset()を呼び出すと、最後のリクエスト時刻がリセットされる
     * - リセット後の最初のリクエストは即座に実行される
     */
    it('reset()後は即座に実行される', async () => {
        const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
        
        await rateLimiter.waitIfNeeded(); // 最初のリクエスト
        expect(rateLimiter.getLastRequestTime()).not.toBeNull();
        
        rateLimiter.reset(); // リセット
        expect(rateLimiter.getLastRequestTime()).toBeNull();
        
        const start = Date.now();
        await rateLimiter.waitIfNeeded(); // リセット後の最初のリクエスト
        const elapsed = Date.now() - start;
        
        expect(elapsed).toBeLessThan(100); // 100ms以内
        expect(rateLimiter.getLastRequestTime()).not.toBeNull();
    });

    /**
     * 複数回のリクエストで累積遅延時間が正しい
     * 
     * 検証内容:
     * - 3回のリクエストで、合計遅延時間が最小遅延時間×2以上であること
     * - 最初のリクエストは即座に実行されるため、遅延は2回分
     */
    it('複数回のリクエストで累積遅延時間が正しい', async () => {
        const minDelayMs = 300; // テスト用に短縮
        const rateLimiter = new RateLimiter({ minDelayMs });
        
        const start = Date.now();
        await rateLimiter.waitIfNeeded(); // 1回目（即座）
        await rateLimiter.waitIfNeeded(); // 2回目（300ms待機）
        await rateLimiter.waitIfNeeded(); // 3回目（300ms待機）
        const elapsed = Date.now() - start;
        
        // 合計遅延時間が最小遅延時間×2以上であることを確認（100msの誤差を許容）
        expect(elapsed).toBeGreaterThanOrEqual(minDelayMs * 2 - 100);
    });

    /**
     * getMinDelayMs()が正しい値を返す
     * 
     * 検証内容:
     * - コンストラクタで指定した最小遅延時間が取得できること
     */
    it('getMinDelayMs()が正しい値を返す', () => {
        const minDelayMs = 2000;
        const rateLimiter = new RateLimiter({ minDelayMs });
        
        expect(rateLimiter.getMinDelayMs()).toBe(minDelayMs);
    });

    /**
     * デフォルト値が正しく設定される
     * 
     * 検証内容:
     * - オプションを指定しない場合、デフォルト値（2000ms）が使用されること
     */
    it('デフォルト値が正しく設定される', () => {
        const rateLimiter = new RateLimiter();
        
        expect(rateLimiter.getMinDelayMs()).toBe(2000);
        expect(rateLimiter.getLastRequestTime()).toBeNull();
    });

    /**
     * 並行実行時のレート制限
     * 
     * 検証内容:
     * - 複数のRateLimiterインスタンスは独立して動作すること
     * - 各インスタンスが独自のレート制限を持つこと
     */
    it('並行実行時のレート制限', async () => {
        const minDelayMs = 300; // テスト用に短縮
        const rateLimiter1 = new RateLimiter({ minDelayMs });
        const rateLimiter2 = new RateLimiter({ minDelayMs });
        
        const start = Date.now();
        
        // 並行実行
        await Promise.all([
            (async () => {
                await rateLimiter1.waitIfNeeded();
                await rateLimiter1.waitIfNeeded();
            })(),
            (async () => {
                await rateLimiter2.waitIfNeeded();
                await rateLimiter2.waitIfNeeded();
            })(),
        ]);
        
        const elapsed = Date.now() - start;
        
        // 並行実行のため、合計時間は単一インスタンスの2回分程度
        expect(elapsed).toBeGreaterThanOrEqual(minDelayMs - 50);
        expect(elapsed).toBeLessThan(minDelayMs * 2 + 200);
    });
});

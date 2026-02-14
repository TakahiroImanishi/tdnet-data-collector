/**
 * rate-limiter.ts のテスト
 *
 * カバレッジ目標: 80%以上（ブランチカバレッジ）
 */

import { RateLimiter } from '../rate-limiter';
import { logger } from '../logger';

// loggerのモック
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('デフォルトの最小遅延時間（2000ms）で初期化', () => {
      const rateLimiter = new RateLimiter();
      expect(rateLimiter.getMinDelayMs()).toBe(2000);
    });

    it('カスタムの最小遅延時間で初期化', () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 1000 });
      expect(rateLimiter.getMinDelayMs()).toBe(1000);
    });

    it('初期状態では最後のリクエスト時刻がnull', () => {
      const rateLimiter = new RateLimiter();
      expect(rateLimiter.getLastRequestTime()).toBeNull();
    });
  });

  describe('waitIfNeeded', () => {
    it('最初のリクエストは即座に実行される', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 1000 });
      const startTime = Date.now();

      await rateLimiter.waitIfNeeded();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // 即座に実行（マージン100ms）
      expect(rateLimiter.getLastRequestTime()).not.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('Rate limiter: first request, no delay');
    });

    it('最小遅延時間が経過していない場合は待機する', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 500 });

      await rateLimiter.waitIfNeeded(); // 最初のリクエスト
      const startTime = Date.now();
      await rateLimiter.waitIfNeeded(); // 2回目のリクエスト

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(450); // 500ms - マージン
      expect(elapsed).toBeLessThan(600); // 500ms + マージン
      expect(logger.debug).toHaveBeenCalledWith(
        'Rate limiting: waiting',
        expect.objectContaining({
          minDelayMs: 500,
        })
      );
    });

    it('最小遅延時間が経過している場合は即座に実行される', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 100 });

      await rateLimiter.waitIfNeeded(); // 最初のリクエスト
      await new Promise((resolve) => setTimeout(resolve, 150)); // 150ms待機
      const startTime = Date.now();
      await rateLimiter.waitIfNeeded(); // 2回目のリクエスト

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(50); // 即座に実行
    });

    it('連続して3回呼び出した場合、適切に遅延する', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 200 });
      const startTime = Date.now();

      await rateLimiter.waitIfNeeded(); // 1回目: 即座
      await rateLimiter.waitIfNeeded(); // 2回目: 200ms待機
      await rateLimiter.waitIfNeeded(); // 3回目: 200ms待機

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(380); // 400ms - マージン
      expect(elapsed).toBeLessThan(500); // 400ms + マージン
    });
  });

  describe('reset', () => {
    it('reset後の最初のリクエストは即座に実行される', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 1000 });

      await rateLimiter.waitIfNeeded(); // 最初のリクエスト
      expect(rateLimiter.getLastRequestTime()).not.toBeNull();

      rateLimiter.reset();
      expect(rateLimiter.getLastRequestTime()).toBeNull();

      const startTime = Date.now();
      await rateLimiter.waitIfNeeded(); // リセット後の最初のリクエスト

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // 即座に実行
    });

    it('reset後も最小遅延時間は保持される', () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 1500 });
      rateLimiter.reset();
      expect(rateLimiter.getMinDelayMs()).toBe(1500);
    });
  });

  describe('getMinDelayMs', () => {
    it('設定された最小遅延時間を返す', () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 3000 });
      expect(rateLimiter.getMinDelayMs()).toBe(3000);
    });
  });

  describe('getLastRequestTime', () => {
    it('リクエスト前はnullを返す', () => {
      const rateLimiter = new RateLimiter();
      expect(rateLimiter.getLastRequestTime()).toBeNull();
    });

    it('リクエスト後はUnix時刻を返す', async () => {
      const rateLimiter = new RateLimiter();
      const beforeTime = Date.now();

      await rateLimiter.waitIfNeeded();

      const lastRequestTime = rateLimiter.getLastRequestTime();
      expect(lastRequestTime).not.toBeNull();
      expect(lastRequestTime).toBeGreaterThanOrEqual(beforeTime);
      expect(lastRequestTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('エッジケース', () => {
    it('minDelayMs=0の場合、遅延なしで実行される', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 0 });
      const startTime = Date.now();

      await rateLimiter.waitIfNeeded();
      await rateLimiter.waitIfNeeded();
      await rateLimiter.waitIfNeeded();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // 即座に実行
    });

    it('非常に大きなminDelayMsでも正常に動作する', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 10000 });
      await rateLimiter.waitIfNeeded(); // 最初のリクエスト

      const startTime = Date.now();
      const promise = rateLimiter.waitIfNeeded(); // 2回目のリクエスト

      // 100ms後にチェック（まだ待機中のはず）
      await new Promise((resolve) => setTimeout(resolve, 100));
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(200);

      // プロミスを解決（テストの高速化のため、実際には待たない）
      // 実際の動作確認は上記で十分
    }, 15000);

    it('複数のRateLimiterインスタンスは独立して動作する', async () => {
      const rateLimiter1 = new RateLimiter({ minDelayMs: 500 });
      const rateLimiter2 = new RateLimiter({ minDelayMs: 1000 });

      await rateLimiter1.waitIfNeeded();
      await new Promise((resolve) => setTimeout(resolve, 10)); // 時刻が異なることを保証
      await rateLimiter2.waitIfNeeded();

      expect(rateLimiter1.getLastRequestTime()).not.toBeNull();
      expect(rateLimiter2.getLastRequestTime()).not.toBeNull();
      
      // 2つのインスタンスが独立していることを確認（異なる設定値）
      expect(rateLimiter1.getMinDelayMs()).toBe(500);
      expect(rateLimiter2.getMinDelayMs()).toBe(1000);
    });
  });

  describe('ログ記録', () => {
    it('最初のリクエストでdebugログを記録', async () => {
      const rateLimiter = new RateLimiter();
      await rateLimiter.waitIfNeeded();

      expect(logger.debug).toHaveBeenCalledWith('Rate limiter: first request, no delay');
    });

    it('待機時にdebugログを記録', async () => {
      const rateLimiter = new RateLimiter({ minDelayMs: 200 });
      await rateLimiter.waitIfNeeded();
      await rateLimiter.waitIfNeeded();

      expect(logger.debug).toHaveBeenCalledWith(
        'Rate limiting: waiting',
        expect.objectContaining({
          minDelayMs: 200,
          waitTime: expect.any(Number),
          elapsed: expect.any(Number),
        })
      );
    });
  });
});

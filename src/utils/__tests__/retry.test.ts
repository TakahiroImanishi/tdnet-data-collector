/**
 * retry.ts のテスト
 *
 * カバレッジ目標: 80%以上（ブランチカバレッジ）
 * 現状: 66.66% (10/15ブランチ) → 目標: 80%以上 (12/15ブランチ以上)
 */

import { retryWithBackoff, isRetryableError, RetryOptions } from '../retry';
import { RetryableError, ValidationError, NotFoundError } from '../../errors';

describe('retry.ts', () => {
  describe('retryWithBackoff()', () => {
    it('成功時は即座に結果を返す', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('RetryableErrorの場合は再試行する', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Temporary error'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
        jitter: false,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('最大再試行回数に達したらエラーをスロー', async () => {
      const error = new RetryableError('Persistent error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 2,
          initialDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
        })
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3); // 初回 + 2回再試行
    });

    it('再試行不可能なエラーは即座にスロー', async () => {
      const error = new ValidationError('Invalid input');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 3,
          initialDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
        })
      ).rejects.toThrow('Invalid input');

      expect(operation).toHaveBeenCalledTimes(1); // 再試行なし
    });

    it('カスタムshouldRetry関数を使用', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 10,
        backoffMultiplier: 2,
        jitter: false,
        shouldRetry: (error) => error.message.includes('ECONNRESET'),
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('カスタムshouldRetryで再試行不可と判定されたら即座にスロー', async () => {
      const error = new Error('Non-retryable error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 3,
          initialDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
          shouldRetry: () => false,
        })
      ).rejects.toThrow('Non-retryable error');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('指数バックオフで遅延時間が増加する（ジッターなし）', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error 1'))
        .mockRejectedValueOnce(new RetryableError('Error 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });

      const elapsedTime = Date.now() - startTime;

      // 1回目: 100ms, 2回目: 200ms = 合計300ms以上
      expect(elapsedTime).toBeGreaterThanOrEqual(290);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('ジッターありの場合、遅延時間がランダム化される', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error 1'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: true,
      });

      const elapsedTime = Date.now() - startTime;

      // ジッターにより0〜100msの範囲でランダム
      expect(elapsedTime).toBeGreaterThanOrEqual(0);
      expect(elapsedTime).toBeLessThan(150); // 100ms + マージン
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('非Errorオブジェクトのエラーを適切に処理', async () => {
      const operation = jest.fn().mockRejectedValue('String error');

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 1,
          initialDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
        })
      ).rejects.toThrow('String error');

      // 非Errorオブジェクトは再試行不可能と判定されるため、1回のみ実行
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('デフォルトオプションを使用', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('部分的なオプション指定でデフォルト値がマージされる', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error'))
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(operation, {
        maxRetries: 5, // カスタム
        // 他はデフォルト値を使用
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('attempt=0の場合の遅延時間計算（ジッターなし）', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });

      const elapsedTime = Date.now() - startTime;

      // attempt=0: 100 * (2^0) = 100ms
      expect(elapsedTime).toBeGreaterThanOrEqual(90);
      expect(elapsedTime).toBeLessThan(150);
    });

    it('attempt=1の場合の遅延時間計算（ジッターなし）', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new RetryableError('Error 1'))
        .mockRejectedValueOnce(new RetryableError('Error 2'))
        .mockResolvedValueOnce('success');

      const startTime = Date.now();

      await retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });

      const elapsedTime = Date.now() - startTime;

      // attempt=0: 100ms, attempt=1: 200ms = 合計300ms
      expect(elapsedTime).toBeGreaterThanOrEqual(290);
      expect(elapsedTime).toBeLessThan(350);
    });

    it('maxRetries=0の場合、再試行なし', async () => {
      const error = new RetryableError('Error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        retryWithBackoff(operation, {
          maxRetries: 0,
          initialDelay: 10,
          backoffMultiplier: 2,
          jitter: false,
        })
      ).rejects.toThrow('Error');

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryableError()', () => {
    it('RetryableErrorの場合はtrue', () => {
      const error = new RetryableError('Temporary error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ValidationErrorの場合はfalse', () => {
      const error = new ValidationError('Invalid input');
      expect(isRetryableError(error)).toBe(false);
    });

    it('NotFoundErrorの場合はfalse', () => {
      const error = new NotFoundError('Resource not found');
      expect(isRetryableError(error)).toBe(false);
    });

    it('ECONNRESETエラーの場合はtrue', () => {
      const error = new Error('Connection reset: ECONNRESET');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ETIMEDOUTエラーの場合はtrue', () => {
      const error = new Error('Connection timed out: ETIMEDOUT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ENOTFOUNDエラーの場合はtrue', () => {
      const error = new Error('DNS lookup failed: ENOTFOUND');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ECONNREFUSEDエラーの場合はtrue', () => {
      const error = new Error('Connection refused: ECONNREFUSED');
      expect(isRetryableError(error)).toBe(true);
    });

    it('timeoutを含むエラーの場合はtrue', () => {
      const error = new Error('Request timeout occurred');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ThrottlingExceptionの場合はtrue', () => {
      const error = new Error('ThrottlingException: Rate exceeded');
      expect(isRetryableError(error)).toBe(true);
    });

    it('ServiceUnavailableの場合はtrue', () => {
      const error = new Error('ServiceUnavailable: Service is down');
      expect(isRetryableError(error)).toBe(true);
    });

    it('RequestTimeoutの場合はtrue', () => {
      const error = new Error('RequestTimeout: Request timed out');
      expect(isRetryableError(error)).toBe(true);
    });

    it('非Errorオブジェクトの場合はfalse', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(123)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError({})).toBe(false);
    });

    it('通常のErrorの場合はfalse', () => {
      const error = new Error('Generic error');
      expect(isRetryableError(error)).toBe(false);
    });

    it('空のエラーメッセージの場合はfalse', () => {
      const error = new Error('');
      expect(isRetryableError(error)).toBe(false);
    });
  });
});

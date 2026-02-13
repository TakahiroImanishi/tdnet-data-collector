/**
 * 再試行ロジックのプロパティテスト
 *
 * fast-checkを使用して、再試行ロジックの性質を検証します。
 * プロパティテストは、多数のランダムな入力に対してテストを実行し、
 * コードの性質（プロパティ）が常に成立することを確認します。
 *
 * Requirements: 要件6.2（再試行ロジック）
 */

import * as fc from 'fast-check';
import { retryWithBackoff, isRetryableError } from '../retry';
import { RetryableError, ValidationError } from '../../errors';

describe('retryWithBackoff - Property Tests', () => {
  /**
   * Property: 再試行回数の上限
   *
   * 任意のエラーに対して、retryWithBackoffが最大3回まで再試行することを検証します。
   * 100回以上の反復実行により、再試行回数が上限を超えないことを確認します。
   */
  it('should never exceed maxRetries attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // maxRetries: 1〜3（テスト時間短縮）
        fc.integer({ min: 10, max: 50 }), // initialDelay: 10〜50ms（テスト時間短縮）
        async (maxRetries, initialDelay) => {
          let attemptCount = 0;

          const operation = async () => {
            attemptCount++;
            throw new RetryableError('Test error');
          };

          try {
            await retryWithBackoff(operation, {
              maxRetries,
              initialDelay,
              backoffMultiplier: 2,
              jitter: false, // ジッターを無効化してテストを安定化
            });
          } catch (error) {
            // エラーが発生することを期待
          }

          // 試行回数は maxRetries + 1（初回 + 再試行）を超えない
          expect(attemptCount).toBeLessThanOrEqual(maxRetries + 1);
        }
      ),
      { numRuns: 1000 } // 1000回の反復実行
    );
  }, 180000); // 180秒のタイムアウト（1000回反復に対応）

  /**
   * Property: 再試行不可能なエラーは即座に失敗
   *
   * ValidationErrorなどの再試行不可能なエラーは、再試行せずに即座に失敗することを検証します。
   */
  it('should not retry non-retryable errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }), // エラーメッセージ
        async (errorMessage) => {
          let attemptCount = 0;

          const operation = async () => {
            attemptCount++;
            throw new ValidationError(errorMessage);
          };

          try {
            await retryWithBackoff(operation, {
              maxRetries: 3,
              initialDelay: 10, // テスト時間短縮
              backoffMultiplier: 2,
              jitter: false,
            });
          } catch (error) {
            // ValidationErrorが発生することを期待
            expect(error).toBeInstanceOf(ValidationError);
          }

          // 再試行せずに即座に失敗（試行回数は1回のみ）
          expect(attemptCount).toBe(1);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: 成功した場合は結果を返す
   *
   * 操作が成功した場合、retryWithBackoffは結果を正しく返すことを検証します。
   */
  it('should return result on success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.anything(), // 任意の戻り値
        async (expectedResult) => {
          const operation = async () => expectedResult;

          const result = await retryWithBackoff(operation, {
            maxRetries: 3,
            initialDelay: 10, // テスト時間短縮
            backoffMultiplier: 2,
            jitter: false,
          });

          expect(result).toEqual(expectedResult);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: 指数バックオフの遅延時間
   *
   * 再試行時の遅延時間が指数的に増加することを検証します。
   * ジッターを無効化した場合、遅延時間は initialDelay * (backoffMultiplier ^ attempt) になります。
   */
  it('should apply exponential backoff delays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }), // initialDelay（テスト時間短縮）
        fc.integer({ min: 2, max: 2 }), // backoffMultiplier（固定値でテスト時間短縮）
        async (initialDelay, backoffMultiplier) => {
          let attemptCount = 0;

          const operation = async () => {
            attemptCount++;
            throw new RetryableError('Test error');
          };

          const startTime = Date.now();

          try {
            await retryWithBackoff(operation, {
              maxRetries: 2,
              initialDelay,
              backoffMultiplier,
              jitter: false,
            });
          } catch (error) {
            // エラーが発生することを期待
          }

          const totalTime = Date.now() - startTime;

          // 期待される総遅延時間を計算
          // attempt 0: initialDelay * (backoffMultiplier ^ 0) = initialDelay
          // attempt 1: initialDelay * (backoffMultiplier ^ 1) = initialDelay * backoffMultiplier
          const expectedTotalDelay =
            initialDelay * (1 + backoffMultiplier);

          // 実際の総時間は期待される遅延時間以上である
          // （処理時間を考慮して、±50msの誤差を許容）
          expect(totalTime).toBeGreaterThanOrEqual(expectedTotalDelay - 50);
        }
      ),
      { numRuns: 100 } // 100回の反復実行（時間がかかるため）
    );
  }, 30000); // 30秒のタイムアウト

  /**
   * Property: カスタム再試行判定関数
   *
   * shouldRetryオプションが正しく機能することを検証します。
   */
  it('should respect custom shouldRetry function', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // shouldRetryの戻り値
        async (shouldRetryResult) => {
          let attemptCount = 0;

          const operation = async () => {
            attemptCount++;
            throw new Error('Test error');
          };

          try {
            await retryWithBackoff(operation, {
              maxRetries: 3,
              initialDelay: 10, // テスト時間短縮
              backoffMultiplier: 2,
              jitter: false,
              shouldRetry: () => shouldRetryResult,
            });
          } catch (error) {
            // エラーが発生することを期待
          }

          if (shouldRetryResult) {
            // 再試行する場合、試行回数は maxRetries + 1
            expect(attemptCount).toBe(4); // 初回 + 3回の再試行
          } else {
            // 再試行しない場合、試行回数は1回のみ
            expect(attemptCount).toBe(1);
          }
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  }, 30000); // 30秒のタイムアウト（100回反復に対応）
});

describe('isRetryableError - Property Tests', () => {
  /**
   * Property: RetryableErrorは常に再試行可能
   *
   * RetryableErrorまたはそのサブクラスは、常に再試行可能と判定されることを検証します。
   */
  it('should always return true for RetryableError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // エラーメッセージ
        (errorMessage) => {
          const error = new RetryableError(errorMessage);
          expect(isRetryableError(error)).toBe(true);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: ValidationErrorは常に再試行不可能
   *
   * ValidationErrorは、常に再試行不可能と判定されることを検証します。
   */
  it('should always return false for ValidationError', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // エラーメッセージ
        (errorMessage) => {
          const error = new ValidationError(errorMessage);
          expect(isRetryableError(error)).toBe(false);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: ネットワークエラーは常に再試行可能
   *
   * ネットワークエラー（ECONNRESET, ETIMEDOUT, ENOTFOUND）は、
   * 常に再試行可能と判定されることを検証します。
   */
  it('should return true for network errors', () => {
    const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];

    fc.assert(
      fc.property(
        fc.constantFrom(...networkErrors), // ネットワークエラーコード
        fc.string({ minLength: 0, maxLength: 50 }), // 追加メッセージ
        (errorCode, additionalMessage) => {
          const error = new Error(`${errorCode}: ${additionalMessage}`);
          expect(isRetryableError(error)).toBe(true);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: AWS一時的エラーは常に再試行可能
   *
   * AWS一時的エラー（ThrottlingException, ServiceUnavailable）は、
   * 常に再試行可能と判定されることを検証します。
   */
  it('should return true for AWS temporary errors', () => {
    const awsErrors = ['ThrottlingException', 'ServiceUnavailable', 'RequestTimeout'];

    fc.assert(
      fc.property(
        fc.constantFrom(...awsErrors), // AWSエラーコード
        fc.string({ minLength: 0, maxLength: 50 }), // 追加メッセージ
        (errorCode, additionalMessage) => {
          const error = new Error(`${errorCode}: ${additionalMessage}`);
          expect(isRetryableError(error)).toBe(true);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });

  /**
   * Property: 非Errorオブジェクトは常に再試行不可能
   *
   * Errorオブジェクト以外は、常に再試行不可能と判定されることを検証します。
   */
  it('should return false for non-Error objects', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.object()
        ),
        (value) => {
          expect(isRetryableError(value)).toBe(false);
        }
      ),
      { numRuns: 100 } // 100回の反復実行
    );
  });
});

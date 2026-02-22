/**
 * Secrets Manager ユーティリティ
 *
 * Secrets Managerからシークレットを取得し、メモリキャッシュで効率化します。
 *
 * 機能:
 * - Secrets Managerからのシークレット取得
 * - メモリキャッシュ（TTL付き）
 * - 指数バックオフ再試行
 * - エラーハンドリング
 *
 * 関連ドキュメント:
 * - .kiro/steering/core/tdnet-implementation-rules.md - 実装ルール
 * - .kiro/steering/development/lambda-guide.md - Lambda実装ガイド
 * - .kiro/steering/core/error-handling-patterns.md - エラーハンドリング
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';
import { retryWithBackoff } from './retry';
import { RetryableError } from '../errors';

/**
 * Secrets Managerクライアント（グローバルスコープで初期化）
 */
const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  maxAttempts: 3,
  retryMode: 'adaptive',
});

/**
 * キャッシュエントリ
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * メモリキャッシュ
 */
const cache = new Map<string, CacheEntry>();

/**
 * デフォルトキャッシュTTL（5分）
 */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Secrets Managerからシークレットを取得
 *
 * メモリキャッシュを使用してパフォーマンスを最適化します。
 * キャッシュが有効な場合はキャッシュから返却し、無効な場合はSecrets Managerから取得します。
 *
 * @param secretId シークレットID（例: '/tdnet/api-key'）
 * @param options オプション
 * @returns シークレット値
 * @throws RetryableError Secrets Manager取得失敗時
 *
 * @example
 * ```typescript
 * const apiKey = await getSecret('/tdnet/api-key');
 * ```
 */
export async function getSecret(
  secretId: string,
  options: {
    /** キャッシュTTL（ミリ秒、デフォルト: 5分） */
    cacheTtlMs?: number;
    /** キャッシュを無効化（デフォルト: false） */
    noCache?: boolean;
  } = {}
): Promise<string> {
  const { cacheTtlMs = DEFAULT_CACHE_TTL_MS, noCache = false } = options;

  // キャッシュチェック
  if (!noCache) {
    const cached = getCachedSecret(secretId);
    if (cached) {
      logger.debug('Secret retrieved from cache', { secret_id: secretId });
      return cached;
    }
  }

  // Secrets Managerから取得
  logger.info('Fetching secret from Secrets Manager', { secret_id: secretId });

  const secretValue = await retryWithBackoff(
    async () => {
      try {
        const response = await secretsManagerClient.send(
          new GetSecretValueCommand({ SecretId: secretId })
        );

        if (!response.SecretString) {
          throw new Error(`Secret ${secretId} has no SecretString value`);
        }

        return response.SecretString;
      } catch (error: any) {
        // AWS SDKエラーを適切なエラーに変換
        if (error.name === 'ResourceNotFoundException') {
          throw new Error(`Secret not found: ${secretId}`);
        }

        if (error.name === 'InvalidRequestException') {
          throw new Error(`Invalid request for secret: ${secretId}`);
        }

        // ThrottlingException, InternalServiceErrorなどは再試行可能
        if (
          error.name === 'ThrottlingException' ||
          error.name === 'InternalServiceError' ||
          error.name === 'ServiceUnavailableException'
        ) {
          throw new RetryableError(
            `Secrets Manager error: ${error.name} - ${error.message}`,
            error
          );
        }

        // その他のエラー
        throw new Error(`Failed to get secret ${secretId}: ${error.message}`);
      }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      jitter: true,
      shouldRetry: (error) => error instanceof RetryableError,
    }
  );

  // キャッシュに保存
  if (!noCache) {
    setCachedSecret(secretId, secretValue, cacheTtlMs);
  }

  logger.info('Secret fetched successfully', { secret_id: secretId });

  return secretValue;
}

/**
 * キャッシュからシークレットを取得
 *
 * @param secretId シークレットID
 * @returns キャッシュされたシークレット値（有効期限内の場合）、なければnull
 */
function getCachedSecret(secretId: string): string | null {
  const entry = cache.get(secretId);

  if (!entry) {
    return null;
  }

  // 有効期限チェック
  if (Date.now() > entry.expiresAt) {
    cache.delete(secretId);
    logger.debug('Cache expired', { secret_id: secretId });
    return null;
  }

  return entry.value;
}

/**
 * シークレットをキャッシュに保存
 *
 * @param secretId シークレットID
 * @param value シークレット値
 * @param ttlMs キャッシュTTL（ミリ秒）
 */
function setCachedSecret(secretId: string, value: string, ttlMs: number): void {
  const expiresAt = Date.now() + ttlMs;

  cache.set(secretId, { value, expiresAt });

  logger.debug('Secret cached', {
    secret_id: secretId,
    ttl_ms: ttlMs,
    expires_at: new Date(expiresAt).toISOString(),
  });
}

/**
 * キャッシュをクリア
 *
 * テスト用途やキャッシュを強制的にクリアする場合に使用します。
 *
 * @param secretId シークレットID（指定しない場合は全キャッシュをクリア）
 */
export function clearCache(secretId?: string): void {
  if (secretId) {
    cache.delete(secretId);
    logger.debug('Cache cleared for secret', { secret_id: secretId });
  } else {
    cache.clear();
    logger.debug('All cache cleared');
  }
}

/**
 * APIキーを取得
 *
 * Secrets Managerから'/tdnet/api-key'を取得します。
 * 環境変数API_KEY_SECRET_NAMEでシークレット名をカスタマイズ可能です。
 *
 * @returns APIキー
 * @throws Error APIキー取得失敗時
 *
 * @example
 * ```typescript
 * const apiKey = await getApiKey();
 * ```
 */
export async function getApiKey(): Promise<string> {
  const secretName = process.env.API_KEY_SECRET_NAME || '/tdnet/api-key';

  try {
    return await getSecret(secretName);
  } catch (error) {
    logger.error('Failed to get API key from Secrets Manager', {
      secret_name: secretName,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });

    throw new Error(`Failed to get API key: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Secrets Manager ユーティリティのテスト
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { getSecret, getApiKey, clearCache } from '../secrets-manager';
import { RetryableError } from '../../errors';

// モック
const secretsManagerMock = mockClient(SecretsManagerClient);

describe('Secrets Manager Utility', () => {
  beforeEach(() => {
    secretsManagerMock.reset();
    clearCache(); // 各テスト前にキャッシュをクリア
    jest.clearAllMocks();
  });

  describe('getSecret', () => {
    it('should fetch secret from Secrets Manager', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: secretValue,
      });

      // Act
      const result = await getSecret(secretId);

      // Assert
      expect(result).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it('should return cached secret on second call', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: secretValue,
      });

      // Act
      const result1 = await getSecret(secretId);
      const result2 = await getSecret(secretId);

      // Assert
      expect(result1).toBe(secretValue);
      expect(result2).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(1); // 1回のみ呼び出し
    });

    it('should bypass cache when noCache option is true', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: secretValue,
      });

      // Act
      const result1 = await getSecret(secretId, { noCache: true });
      const result2 = await getSecret(secretId, { noCache: true });

      // Assert
      expect(result1).toBe(secretValue);
      expect(result2).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(2); // 2回呼び出し
    });

    it('should fetch new secret after cache expires', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';
      const cacheTtlMs = 100; // 100ms

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: secretValue,
      });

      // Act
      const result1 = await getSecret(secretId, { cacheTtlMs });

      // キャッシュ有効期限を待つ
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await getSecret(secretId, { cacheTtlMs });

      // Assert
      expect(result1).toBe(secretValue);
      expect(result2).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(2); // 2回呼び出し（キャッシュ期限切れ）
    });

    it('should throw error when secret not found', async () => {
      // Arrange
      const secretId = '/test/nonexistent';

      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'ResourceNotFoundException',
        message: 'Secret not found',
      });

      // Act & Assert
      await expect(getSecret(secretId)).rejects.toThrow('Secret not found: /test/nonexistent');
      expect(secretsManagerMock.calls()).toHaveLength(1);
    });

    it('should throw error when SecretString is missing', async () => {
      // Arrange
      const secretId = '/test/secret';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: undefined,
      });

      // Act & Assert
      await expect(getSecret(secretId)).rejects.toThrow(
        'Secret /test/secret has no SecretString value'
      );
    });

    it('should retry on ThrottlingException', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock
        .on(GetSecretValueCommand)
        .rejectsOnce({
          name: 'ThrottlingException',
          message: 'Rate exceeded',
        })
        .resolves({
          SecretString: secretValue,
        });

      // Act
      const result = await getSecret(secretId);

      // Assert
      expect(result).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(2); // 1回失敗、1回成功
    });

    it('should retry on InternalServiceError', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock
        .on(GetSecretValueCommand)
        .rejectsOnce({
          name: 'InternalServiceError',
          message: 'Internal error',
        })
        .resolves({
          SecretString: secretValue,
        });

      // Act
      const result = await getSecret(secretId);

      // Assert
      expect(result).toBe(secretValue);
      expect(secretsManagerMock.calls()).toHaveLength(2);
    });

    it('should not retry on InvalidRequestException', async () => {
      // Arrange
      const secretId = '/test/secret';

      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'InvalidRequestException',
        message: 'Invalid request',
      });

      // Act & Assert
      await expect(getSecret(secretId)).rejects.toThrow('Invalid request for secret: /test/secret');
      expect(secretsManagerMock.calls()).toHaveLength(1); // 再試行なし
    });

    it('should fail after max retries on retryable errors', async () => {
      // Arrange
      const secretId = '/test/secret';

      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'ThrottlingException',
        message: 'Rate exceeded',
      });

      // Act & Assert
      await expect(getSecret(secretId)).rejects.toThrow('Rate exceeded');
      expect(secretsManagerMock.calls()).toHaveLength(4); // 初回 + 3回再試行
    });
  });

  describe('getApiKey', () => {
    it('should fetch API key from default secret name', async () => {
      // Arrange
      const apiKey = 'test-api-key-12345';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: apiKey,
      });

      // Act
      const result = await getApiKey();

      // Assert
      expect(result).toBe(apiKey);
      expect(secretsManagerMock.calls()).toHaveLength(1);
      expect(secretsManagerMock.calls()[0].args[0].input).toEqual({
        SecretId: '/tdnet/api-key',
      });
    });

    it('should fetch API key from custom secret name', async () => {
      // Arrange
      const customSecretName = '/custom/api-key';
      const apiKey = 'custom-api-key-67890';

      process.env.API_KEY_SECRET_NAME = customSecretName;

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: apiKey,
      });

      // Act
      const result = await getApiKey();

      // Assert
      expect(result).toBe(apiKey);
      expect(secretsManagerMock.calls()[0].args[0].input).toEqual({
        SecretId: customSecretName,
      });

      // Cleanup
      delete process.env.API_KEY_SECRET_NAME;
    });

    it('should throw error when API key fetch fails', async () => {
      // Arrange
      secretsManagerMock.on(GetSecretValueCommand).rejects({
        name: 'ResourceNotFoundException',
        message: 'Secret not found',
      });

      // Act & Assert
      await expect(getApiKey()).rejects.toThrow('Failed to get API key');
    });

    it('should use cache for subsequent API key requests', async () => {
      // Arrange
      const apiKey = 'test-api-key-12345';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: apiKey,
      });

      // Act
      const result1 = await getApiKey();
      const result2 = await getApiKey();

      // Assert
      expect(result1).toBe(apiKey);
      expect(result2).toBe(apiKey);
      expect(secretsManagerMock.calls()).toHaveLength(1); // キャッシュ使用
    });
  });

  describe('clearCache', () => {
    it('should clear specific secret from cache', async () => {
      // Arrange
      const secretId = '/test/secret';
      const secretValue = 'test-secret-value';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: secretValue,
      });

      // Act
      await getSecret(secretId);
      clearCache(secretId);
      await getSecret(secretId);

      // Assert
      expect(secretsManagerMock.calls()).toHaveLength(2); // キャッシュクリア後に再取得
    });

    it('should clear all cache when no secretId specified', async () => {
      // Arrange
      const secret1 = '/test/secret1';
      const secret2 = '/test/secret2';

      secretsManagerMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test-value',
      });

      // Act
      await getSecret(secret1);
      await getSecret(secret2);
      clearCache(); // 全キャッシュクリア
      await getSecret(secret1);
      await getSecret(secret2);

      // Assert
      expect(secretsManagerMock.calls()).toHaveLength(4); // 各シークレット2回ずつ
    });
  });
});

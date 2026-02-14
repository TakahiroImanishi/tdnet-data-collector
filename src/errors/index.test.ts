/**
 * カスタムエラークラスのユニットテスト
 *
 * Requirements: 要件6.1（エラーハンドリング）
 */

import {
  TDnetError,
  RetryableError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  AuthenticationError,
  ConfigurationError,
  DownloadError,
} from './index';

describe('カスタムエラークラス', () => {
  describe('TDnetError', () => {
    it('基本的なエラーメッセージを設定できる', () => {
      const error = new TDnetError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('TDnetError');
    });

    it('causeを設定できる', () => {
      const cause = new Error('Original error');
      const error = new TDnetError('Test error', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('RetryableError', () => {
    it('再試行可能なエラーを作成できる', () => {
      const error = new RetryableError('Network error');
      expect(error.message).toBe('Network error');
      expect(error.name).toBe('RetryableError');
      expect(error).toBeInstanceOf(TDnetError);
    });

    it('causeを設定できる', () => {
      const cause = new Error('ECONNRESET');
      const error = new RetryableError('Connection reset', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('ValidationError', () => {
    it('バリデーションエラーを作成できる', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('ValidationError');
      expect(error).toBeInstanceOf(TDnetError);
    });

    it('詳細情報を設定できる', () => {
      const details = { field: 'date', value: '2024/01/15' };
      const error = new ValidationError('Invalid date format', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('リソース不存在エラーを作成できる', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(TDnetError);
    });

    it('リソースIDを設定できる', () => {
      const error = new NotFoundError('Disclosure not found', 'TD20240115001');
      expect(error.resourceId).toBe('TD20240115001');
    });
  });

  describe('RateLimitError', () => {
    it('レート制限エラーを作成できる', () => {
      const error = new RateLimitError('Rate limit exceeded');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.name).toBe('RateLimitError');
      expect(error).toBeInstanceOf(RetryableError);
    });

    it('retryAfterを設定できる', () => {
      const error = new RateLimitError('Rate limit exceeded', 60);
      expect(error.retryAfter).toBe(60);
    });

    it('causeを設定できる', () => {
      const cause = new Error('429 Too Many Requests');
      const error = new RateLimitError('Rate limit exceeded', 60, cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('AuthenticationError', () => {
    it('認証エラーを作成できる', () => {
      const error = new AuthenticationError('Unauthorized');
      expect(error.message).toBe('Unauthorized');
      expect(error.name).toBe('AuthenticationError');
      expect(error).toBeInstanceOf(TDnetError);
    });
  });

  describe('ConfigurationError', () => {
    it('設定エラーを作成できる', () => {
      const error = new ConfigurationError('Missing configuration');
      expect(error.message).toBe('Missing configuration');
      expect(error.name).toBe('ConfigurationError');
      expect(error).toBeInstanceOf(TDnetError);
    });

    it('設定キーを設定できる', () => {
      const error = new ConfigurationError('Missing environment variable', 'API_KEY');
      expect(error.configKey).toBe('API_KEY');
    });
  });

  describe('DownloadError', () => {
    it('ダウンロードエラーを作成できる', () => {
      const error = new DownloadError('PDF download failed');
      expect(error.message).toBe('PDF download failed');
      expect(error.name).toBe('DownloadError');
      expect(error).toBeInstanceOf(RetryableError);
    });

    it('causeを設定できる', () => {
      const cause = new Error('Network timeout');
      const error = new DownloadError('PDF download failed', cause);
      expect(error.cause).toBe(cause);
    });

    it('RetryableErrorを継承しているため再試行可能', () => {
      const error = new DownloadError('PDF download failed');
      expect(error).toBeInstanceOf(RetryableError);
      expect(error).toBeInstanceOf(TDnetError);
    });
  });
});

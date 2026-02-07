/**
 * カスタムエラークラス
 *
 * TDnet Data Collectorで使用するカスタムエラークラスを定義します。
 * エラーの種類に応じて適切なエラークラスを使用することで、
 * エラーハンドリングを統一し、再試行ロジックを適切に適用できます。
 *
 * Requirements: 要件6.1, 6.2（エラーハンドリング）
 */

/**
 * 基底エラークラス
 */
export class TDnetError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 再試行可能なエラー
 *
 * 一時的な問題である可能性が高いため、再試行すべきエラー：
 * - ネットワークエラー（ECONNRESET, ETIMEDOUT, ENOTFOUND）
 * - HTTPタイムアウト
 * - 5xxエラー（500 Internal Server Error, 503 Service Unavailable）
 * - AWS一時的エラー（ThrottlingException, ServiceUnavailable）
 * - レート制限（429 Too Many Requests）
 */
export class RetryableError extends TDnetError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
  }
}

/**
 * バリデーションエラー
 *
 * 入力データが不正な場合のエラー。再試行しても解決しないため、
 * 即座に失敗として扱います。
 *
 * 例：
 * - 不正なフォーマット（ISO8601以外）
 * - 存在しない日付（2024-02-30）
 * - 範囲外の日付（1970年以前、現在+1日以降）
 * - 必須フィールドの欠落
 */
export class ValidationError extends TDnetError {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

/**
 * リソース不存在エラー
 *
 * 指定されたリソースが存在しない場合のエラー。
 * 再試行しても解決しないため、即座に失敗として扱います。
 *
 * 例：
 * - 404 Not Found
 * - DynamoDBアイテムが存在しない
 * - S3オブジェクトが存在しない
 */
export class NotFoundError extends TDnetError {
  constructor(
    message: string,
    public readonly resourceId?: string
  ) {
    super(message);
  }
}

/**
 * レート制限エラー
 *
 * レート制限に達した場合のエラー。
 * 再試行可能ですが、適切な遅延時間を設けてから再試行する必要があります。
 *
 * 例：
 * - 429 Too Many Requests
 * - TDnetサーバーからのレート制限
 */
export class RateLimitError extends RetryableError {
  constructor(
    message: string,
    public readonly retryAfter?: number, // 秒単位
    cause?: Error
  ) {
    super(message, cause);
  }
}

/**
 * 認証エラー
 *
 * 認証に失敗した場合のエラー。
 * 再試行しても解決しないため、即座に失敗として扱います。
 *
 * 例：
 * - 401 Unauthorized
 * - 403 Forbidden
 * - 無効なAPIキー
 */
export class AuthenticationError extends TDnetError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * 設定エラー
 *
 * 設定が不正な場合のエラー。
 * 再試行しても解決しないため、即座に失敗として扱います。
 *
 * 例：
 * - 環境変数未設定
 * - 不正な設定値
 */
export class ConfigurationError extends TDnetError {
  constructor(
    message: string,
    public readonly configKey?: string
  ) {
    super(message);
  }
}

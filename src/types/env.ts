/**
 * Lambda環境変数型定義
 *
 * Lambda関数で使用される環境変数の型安全性を保証します。
 * CDKスタックで設定される環境変数と一致する必要があります。
 *
 * Requirements: 要件11.2（型安全性）
 *
 * 関連ドキュメント:
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/infrastructure/environment-variables.md
 * - cdk/lib/stacks/compute-stack.ts
 */

/**
 * Lambda環境変数の基本型
 *
 * すべてのLambda関数で共通して使用される環境変数を定義します。
 */
export interface BaseLambdaEnvironment {
  /**
   * AWSリージョン
   * @example 'ap-northeast-1'
   */
  AWS_REGION: string;

  /**
   * Lambda関数名
   * @example 'tdnet-collector-prod'
   */
  AWS_LAMBDA_FUNCTION_NAME: string;

  /**
   * ログレベル
   * @default 'INFO'
   */
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

  /**
   * 環境名
   * @example 'dev' | 'prod'
   */
  ENVIRONMENT: 'local' | 'dev' | 'prod';

  /**
   * Node.jsオプション
   * @default '--enable-source-maps'
   */
  NODE_OPTIONS: string;
}

/**
 * Collector Lambda環境変数
 *
 * データ収集Lambda（collector）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collector/handler.ts
 */
export interface CollectorEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE: string;

  /** DynamoDB実行状態テーブル名 */
  DYNAMODB_EXECUTIONS_TABLE: string;

  /** S3 PDFバケット名 */
  S3_BUCKET: string;

  /** TDnet APIベースURL */
  TDNET_BASE_URL: string;
}

/**
 * Query Lambda環境変数
 *
 * 検索API Lambda（query）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/query/handler.ts
 */
export interface QueryEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE_NAME: string;

  /** S3 PDFバケット名 */
  S3_BUCKET_NAME: string;

  /** APIキー（Secrets Managerから取得） */
  API_KEY?: string;
}

/**
 * Export Lambda環境変数
 *
 * エクスポートAPI Lambda（export）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/export/handler.ts
 */
export interface ExportEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE_NAME: string;

  /** DynamoDBエクスポート状態テーブル名 */
  EXPORT_STATUS_TABLE_NAME: string;

  /** S3エクスポートバケット名 */
  S3_EXPORTS_BUCKET: string;

  /** APIキー（Secrets Managerから取得） */
  API_KEY?: string;
}

/**
 * Step Functions統合Lambda環境変数（collector-init）
 *
 * Step Functions初期化Lambda（collector-init）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collector-init/handler.ts
 */
export interface CollectorInitEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB実行状態テーブル名 */
  EXECUTION_STATE_TABLE: string;
}

/**
 * Step Functions統合Lambda環境変数（collector-fetch）
 *
 * Step FunctionsフェッチLambda（collector-fetch）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collector-fetch/handler.ts
 */
export interface CollectorFetchEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB実行状態テーブル名 */
  EXECUTION_STATE_TABLE: string;

  /** TDnet APIベースURL */
  TDNET_BASE_URL: string;
}

/**
 * Step Functions統合Lambda環境変数（collector-save）
 *
 * Step Functions保存Lambda（collector-save）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collector-save/handler.ts
 */
export interface CollectorSaveEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE: string;

  /** S3 PDFバケット名 */
  S3_BUCKET: string;
}

/**
 * Step Functions統合Lambda環境変数（collector-aggregate）
 *
 * Step Functions集約Lambda（collector-aggregate）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collector-aggregate/handler.ts
 */
export interface CollectorAggregateEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB実行状態テーブル名 */
  EXECUTION_STATE_TABLE: string;
}

/**
 * Collect Lambda環境変数
 *
 * 収集トリガーLambda（collect）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collect/handler.ts
 */
export interface CollectEnvironment extends BaseLambdaEnvironment {
  /** Collector Lambda関数名 */
  COLLECTOR_FUNCTION_NAME: string;

  /** State Machine ARN（Step Functions有効時） */
  STATE_MACHINE_ARN?: string;
}

/**
 * Collect Status Lambda環境変数
 *
 * 収集状態確認Lambda（collect-status）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/collect-status/handler.ts
 */
export interface CollectStatusEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB実行状態テーブル名 */
  DYNAMODB_EXECUTIONS_TABLE: string;

  /** State Machine ARN（Step Functions有効時） */
  STATE_MACHINE_ARN?: string;
}

/**
 * Export Status Lambda環境変数
 *
 * エクスポート状態確認Lambda（export-status）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/export-status/handler.ts
 */
export interface ExportStatusEnvironment extends BaseLambdaEnvironment {
  /** DynamoDBエクスポート状態テーブル名 */
  EXPORT_STATUS_TABLE_NAME: string;
}

/**
 * Get Disclosure Lambda環境変数
 *
 * 開示情報取得Lambda（get-disclosure）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/get-disclosure/handler.ts
 */
export interface GetDisclosureEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE_NAME: string;

  /** S3 PDFバケット名 */
  S3_BUCKET_NAME: string;

  /** APIキー（Secrets Managerから取得） */
  API_KEY?: string;
}

/**
 * Health Lambda環境変数
 *
 * ヘルスチェックLambda（health）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/health/handler.ts
 */
export interface HealthEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE_NAME: string;

  /** S3 PDFバケット名 */
  S3_BUCKET_NAME: string;
}

/**
 * Stats Lambda環境変数
 *
 * 統計情報Lambda（stats）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/stats/handler.ts
 */
export interface StatsEnvironment extends BaseLambdaEnvironment {
  /** DynamoDB開示情報テーブル名 */
  DYNAMODB_TABLE_NAME: string;
}

/**
 * DLQ Processor Lambda環境変数
 *
 * DLQプロセッサーLambda（dlq-processor）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/dlq-processor/handler.ts
 */
export interface DlqProcessorEnvironment extends BaseLambdaEnvironment {
  /** アラート通知用SNSトピックARN */
  ALERT_TOPIC_ARN: string;
}

/**
 * API Key Rotation Lambda環境変数
 *
 * APIキーローテーションLambda（api-key-rotation）で使用される環境変数。
 *
 * 使用Lambda:
 * - src/lambda/api-key-rotation/handler.ts
 */
export interface ApiKeyRotationEnvironment extends BaseLambdaEnvironment {
  /** Secrets Manager シークレット名 */
  API_KEY_SECRET_NAME?: string;
}

/**
 * 環境変数検証関数
 *
 * Lambda関数の起動時に必須環境変数が設定されているかを検証します。
 * 未設定の環境変数がある場合、エラーをスローします。
 *
 * @param required 必須環境変数のキー配列
 * @throws Error 未設定の環境変数がある場合
 *
 * @example
 * ```typescript
 * // Lambda handler内で使用
 * validateEnvironment(['DYNAMODB_TABLE', 'S3_BUCKET', 'LOG_LEVEL']);
 * ```
 */
export function validateEnvironment(required: string[]): void {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Please check CDK stack configuration.`
    );
  }
}

/**
 * 環境変数取得ヘルパー関数
 *
 * 環境変数を型安全に取得します。未設定の場合はデフォルト値を返します。
 *
 * @param key 環境変数のキー
 * @param defaultValue デフォルト値（オプション）
 * @returns 環境変数の値またはデフォルト値
 * @throws Error 環境変数が未設定でデフォルト値もない場合
 *
 * @example
 * ```typescript
 * const logLevel = getEnv('LOG_LEVEL', 'INFO');
 * const tableName = getEnv('DYNAMODB_TABLE'); // 必須
 * ```
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(
      `Environment variable ${key} is not set and no default value provided. ` +
        `Please check CDK stack configuration.`
    );
  }

  return value;
}

/**
 * 環境変数取得ヘルパー関数（オプショナル）
 *
 * 環境変数を型安全に取得します。未設定の場合はundefinedを返します。
 *
 * @param key 環境変数のキー
 * @returns 環境変数の値またはundefined
 *
 * @example
 * ```typescript
 * const stateMachineArn = getEnvOptional('STATE_MACHINE_ARN');
 * if (stateMachineArn) {
 *   // Step Functions有効時の処理
 * }
 * ```
 */
export function getEnvOptional(key: string): string | undefined {
  return process.env[key];
}

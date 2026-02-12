/**
 * Lambda Collector Dependencies
 *
 * 依存関係の注入（DI）パターンを実装し、テスト時にモックを注入可能にする。
 *
 * Requirements: テスト環境の整備（Task 9.4）
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { RateLimiter } from '../../utils/rate-limiter';

/**
 * Lambda Collector依存関係
 */
export interface CollectorDependencies {
  /** DynamoDB Document Client */
  dynamoClient: DynamoDBDocumentClient;

  /** S3 Client */
  s3Client: S3Client;

  /** CloudWatch Client */
  cloudWatchClient: CloudWatchClient;

  /** Rate Limiter */
  rateLimiter: RateLimiter;
}

/**
 * デフォルトの依存関係を作成
 *
 * 本番環境では、この関数で作成した依存関係を使用する。
 * テスト環境では、モックを注入する。
 *
 * @returns CollectorDependencies
 */
export function createDefaultDependencies(): CollectorDependencies {
  // DynamoDB Client
  const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
  const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  });

  // S3 Client
  const s3Client = new S3Client({ region: 'ap-northeast-1' });

  // CloudWatch Client
  const cloudWatchClient = new CloudWatchClient({ region: 'ap-northeast-1' });

  // Rate Limiter（最小遅延2秒）
  const rateLimiter = new RateLimiter({ minDelayMs: 2000 });

  return {
    dynamoClient: docClient,
    s3Client,
    cloudWatchClient,
    rateLimiter,
  };
}

/**
 * グローバルスコープで依存関係を初期化（Lambda実行間で再利用）
 *
 * テスト環境では、setDependencies()でモックを注入できる。
 */
let dependencies: CollectorDependencies | null = null;

/**
 * 依存関係を取得
 *
 * 初回呼び出し時にデフォルトの依存関係を作成し、以降は再利用する。
 * テスト環境では、setDependencies()で事前にモックを注入できる。
 *
 * @returns CollectorDependencies
 */
export function getDependencies(): CollectorDependencies {
  if (!dependencies) {
    dependencies = createDefaultDependencies();
  }
  return dependencies;
}

/**
 * 依存関係を設定（テスト用）
 *
 * テスト環境でモックを注入するために使用する。
 *
 * @param deps CollectorDependencies
 */
export function setDependencies(deps: CollectorDependencies): void {
  dependencies = deps;
}

/**
 * 依存関係をリセット（テスト用）
 *
 * テスト終了後にクリーンアップするために使用する。
 */
export function resetDependencies(): void {
  dependencies = null;
}

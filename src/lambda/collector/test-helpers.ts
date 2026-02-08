/**
 * Test Helpers for Lambda Collector
 *
 * テスト環境でのモック設定を簡素化するヘルパー関数。
 *
 * Requirements: テスト環境の整備（Task 9.4）
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { RateLimiter } from '../../../utils/rate-limiter';
import { CollectorDependencies, setDependencies, resetDependencies } from '../dependencies';

/**
 * AWS SDKモッククライアント
 */
export const dynamoMock = mockClient(DynamoDBDocumentClient);
export const s3Mock = mockClient(S3Client);
export const cloudWatchMock = mockClient(CloudWatchClient);

/**
 * RateLimiterモック
 */
export class MockRateLimiter extends RateLimiter {
  constructor() {
    super(0); // 遅延なし
  }

  async waitIfNeeded(): Promise<void> {
    // テスト環境では遅延なし
    return Promise.resolve();
  }
}

/**
 * テスト用の依存関係をセットアップ
 *
 * beforeEach()で呼び出して、モックを注入する。
 *
 * @returns CollectorDependencies
 */
export function setupTestDependencies(): CollectorDependencies {
  // モックをリセット
  dynamoMock.reset();
  s3Mock.reset();
  cloudWatchMock.reset();

  // デフォルトのモック動作を設定
  dynamoMock.on(PutCommand).resolves({});
  dynamoMock.on(GetCommand).resolves({ Item: undefined });
  dynamoMock.on(UpdateCommand).resolves({});
  dynamoMock.on(QueryCommand).resolves({ Items: [] });

  s3Mock.on(PutObjectCommand).resolves({});
  s3Mock.on(GetObjectCommand).resolves({
    Body: Buffer.from('mock pdf content'),
  } as any);

  cloudWatchMock.on(PutMetricDataCommand).resolves({});

  // モック依存関係を作成
  const deps: CollectorDependencies = {
    dynamoClient: dynamoMock as any,
    s3Client: s3Mock as any,
    cloudWatchClient: cloudWatchMock as any,
    rateLimiter: new MockRateLimiter(),
  };

  // 依存関係を注入
  setDependencies(deps);

  return deps;
}

/**
 * テスト用の依存関係をクリーンアップ
 *
 * afterEach()で呼び出して、モックをリセットする。
 */
export function cleanupTestDependencies(): void {
  dynamoMock.reset();
  s3Mock.reset();
  cloudWatchMock.reset();
  resetDependencies();
}

/**
 * DynamoDBモックの設定: 開示情報の取得
 *
 * @param disclosureId 開示ID
 * @param item 返却するアイテム
 */
export function mockGetDisclosure(disclosureId: string, item: any): void {
  dynamoMock.on(GetCommand, {
    TableName: process.env.DYNAMODB_TABLE,
    Key: { disclosure_id: disclosureId },
  }).resolves({ Item: item });
}

/**
 * DynamoDBモックの設定: 開示情報の保存
 *
 * @param success 成功するかどうか
 */
export function mockPutDisclosure(success: boolean = true): void {
  if (success) {
    dynamoMock.on(PutCommand).resolves({});
  } else {
    dynamoMock.on(PutCommand).rejects(new Error('DynamoDB PutItem failed'));
  }
}

/**
 * DynamoDBモックの設定: 実行状態の更新
 *
 * @param success 成功するかどうか
 */
export function mockUpdateExecutionStatus(success: boolean = true): void {
  if (success) {
    dynamoMock.on(UpdateCommand).resolves({});
  } else {
    dynamoMock.on(UpdateCommand).rejects(new Error('DynamoDB UpdateItem failed'));
  }
}

/**
 * S3モックの設定: PDFアップロード
 *
 * @param success 成功するかどうか
 */
export function mockPutPdf(success: boolean = true): void {
  if (success) {
    s3Mock.on(PutObjectCommand).resolves({});
  } else {
    s3Mock.on(PutObjectCommand).rejects(new Error('S3 PutObject failed'));
  }
}

/**
 * S3モックの設定: PDFダウンロード
 *
 * @param content PDFコンテンツ
 */
export function mockGetPdf(content: Buffer = Buffer.from('mock pdf content')): void {
  s3Mock.on(GetObjectCommand).resolves({
    Body: content,
  } as any);
}

/**
 * CloudWatchモックの設定: メトリクス送信
 *
 * @param success 成功するかどうか
 */
export function mockPutMetrics(success: boolean = true): void {
  if (success) {
    cloudWatchMock.on(PutMetricDataCommand).resolves({});
  } else {
    cloudWatchMock.on(PutMetricDataCommand).rejects(new Error('CloudWatch PutMetricData failed'));
  }
}

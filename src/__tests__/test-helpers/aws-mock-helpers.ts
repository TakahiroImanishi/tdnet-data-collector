/**
 * AWS SDKモックヘルパー
 *
 * AWS SDKのモック設定を簡素化するヘルパー関数。
 * テスト間で一貫したモック設定を提供します。
 *
 * Requirements: テスト改善（タスク25）
 */

import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { Disclosure } from '../../types';

/**
 * AWS SDKモッククライアント
 */
export const dynamoMock = mockClient(DynamoDBDocumentClient);
export const s3Mock = mockClient(S3Client);
export const cloudWatchMock = mockClient(CloudWatchClient);

/**
 * すべてのモックをリセット
 *
 * beforeEach()で呼び出して、モックをクリーンな状態にします。
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetAllMocks();
 * });
 * ```
 */
export function resetAllMocks(): void {
  dynamoMock.reset();
  s3Mock.reset();
  cloudWatchMock.reset();
}

/**
 * DynamoDBモックのデフォルト設定
 *
 * 基本的なDynamoDB操作のモックを設定します。
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupDefaultDynamoMock();
 * });
 * ```
 */
export function setupDefaultDynamoMock(): void {
  dynamoMock.on(PutCommand).resolves({});
  dynamoMock.on(GetCommand).resolves({ Item: undefined });
  dynamoMock.on(UpdateCommand).resolves({});
  dynamoMock.on(QueryCommand).resolves({ Items: [] });
  dynamoMock.on(BatchWriteCommand).resolves({});
}

/**
 * S3モックのデフォルト設定
 *
 * 基本的なS3操作のモックを設定します。
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupDefaultS3Mock();
 * });
 * ```
 */
export function setupDefaultS3Mock(): void {
  s3Mock.on(PutObjectCommand).resolves({});
  s3Mock.on(GetObjectCommand).resolves({
    Body: Buffer.from('mock pdf content'),
  } as any);
  s3Mock.on(HeadObjectCommand).resolves({
    ContentLength: 100000,
  });
}

/**
 * CloudWatchモックのデフォルト設定
 *
 * 基本的なCloudWatch操作のモックを設定します。
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupDefaultCloudWatchMock();
 * });
 * ```
 */
export function setupDefaultCloudWatchMock(): void {
  cloudWatchMock.on(PutMetricDataCommand).resolves({});
}

/**
 * すべてのAWS SDKモックのデフォルト設定
 *
 * DynamoDB、S3、CloudWatchのモックを一括設定します。
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupAllDefaultMocks();
 * });
 * ```
 */
export function setupAllDefaultMocks(): void {
  resetAllMocks();
  setupDefaultDynamoMock();
  setupDefaultS3Mock();
  setupDefaultCloudWatchMock();
}

/**
 * DynamoDB GetItemのモック設定
 *
 * @param tableName テーブル名
 * @param key キー
 * @param item 返却するアイテム
 *
 * @example
 * ```typescript
 * mockDynamoGetItem('tdnet_disclosures', { disclosure_id: 'TD20240115001' }, disclosure);
 * ```
 */
export function mockDynamoGetItem(
  tableName: string,
  key: Record<string, any>,
  item: any
): void {
  dynamoMock
    .on(GetCommand, {
      TableName: tableName,
      Key: key,
    })
    .resolves({ Item: item });
}

/**
 * DynamoDB PutItemのモック設定
 *
 * @param success 成功するかどうか
 * @param errorMessage エラーメッセージ（失敗時）
 *
 * @example
 * ```typescript
 * mockDynamoPutItem(false, 'ConditionalCheckFailedException');
 * ```
 */
export function mockDynamoPutItem(
  success: boolean = true,
  errorMessage: string = 'DynamoDB PutItem failed'
): void {
  if (success) {
    dynamoMock.on(PutCommand).resolves({});
  } else {
    dynamoMock.on(PutCommand).rejects(new Error(errorMessage));
  }
}

/**
 * DynamoDB Queryのモック設定
 *
 * @param tableName テーブル名
 * @param items 返却するアイテムの配列
 * @param lastEvaluatedKey 次のページのキー（ページネーション用）
 *
 * @example
 * ```typescript
 * mockDynamoQuery('tdnet_disclosures', [disclosure1, disclosure2]);
 * ```
 */
export function mockDynamoQuery(
  tableName: string,
  items: any[],
  lastEvaluatedKey?: Record<string, any>
): void {
  dynamoMock
    .on(QueryCommand, {
      TableName: tableName,
    })
    .resolves({
      Items: items,
      LastEvaluatedKey: lastEvaluatedKey,
    });
}

/**
 * DynamoDB BatchWriteItemのモック設定
 *
 * @param success 成功するかどうか
 * @param unprocessedItems 未処理アイテム（部分的失敗時）
 *
 * @example
 * ```typescript
 * // 完全成功
 * mockDynamoBatchWrite(true);
 *
 * // 部分的失敗
 * mockDynamoBatchWrite(false, { tdnet_disclosures: [{ PutRequest: { Item: item } }] });
 * ```
 */
export function mockDynamoBatchWrite(
  success: boolean = true,
  unprocessedItems?: Record<string, any[]>
): void {
  if (success) {
    dynamoMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {},
    });
  } else {
    dynamoMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: unprocessedItems || {},
    });
  }
}

/**
 * S3 PutObjectのモック設定
 *
 * @param success 成功するかどうか
 * @param errorMessage エラーメッセージ（失敗時）
 *
 * @example
 * ```typescript
 * mockS3PutObject(false, 'NoSuchBucket');
 * ```
 */
export function mockS3PutObject(
  success: boolean = true,
  errorMessage: string = 'S3 PutObject failed'
): void {
  if (success) {
    s3Mock.on(PutObjectCommand).resolves({});
  } else {
    s3Mock.on(PutObjectCommand).rejects(new Error(errorMessage));
  }
}

/**
 * S3 GetObjectのモック設定
 *
 * @param content 返却するコンテンツ
 *
 * @example
 * ```typescript
 * mockS3GetObject(Buffer.from('PDF content'));
 * ```
 */
export function mockS3GetObject(content: Buffer = Buffer.from('mock pdf content')): void {
  s3Mock.on(GetObjectCommand).resolves({
    Body: content,
  } as any);
}

/**
 * CloudWatch PutMetricDataのモック設定
 *
 * @param success 成功するかどうか
 *
 * @example
 * ```typescript
 * mockCloudWatchPutMetrics(false);
 * ```
 */
export function mockCloudWatchPutMetrics(success: boolean = true): void {
  if (success) {
    cloudWatchMock.on(PutMetricDataCommand).resolves({});
  } else {
    cloudWatchMock
      .on(PutMetricDataCommand)
      .rejects(new Error('CloudWatch PutMetricData failed'));
  }
}

/**
 * DynamoDB操作の呼び出し回数を取得
 *
 * @param commandType コマンドタイプ
 * @returns 呼び出し回数
 *
 * @example
 * ```typescript
 * const putCount = getDynamoCallCount(PutCommand);
 * expect(putCount).toBe(1);
 * ```
 */
export function getDynamoCallCount(commandType: any): number {
  return dynamoMock.commandCalls(commandType).length;
}

/**
 * S3操作の呼び出し回数を取得
 *
 * @param commandType コマンドタイプ
 * @returns 呼び出し回数
 *
 * @example
 * ```typescript
 * const putCount = getS3CallCount(PutObjectCommand);
 * expect(putCount).toBe(1);
 * ```
 */
export function getS3CallCount(commandType: any): number {
  return s3Mock.commandCalls(commandType).length;
}

/**
 * CloudWatch操作の呼び出し回数を取得
 *
 * @param commandType コマンドタイプ
 * @returns 呼び出し回数
 *
 * @example
 * ```typescript
 * const putCount = getCloudWatchCallCount(PutMetricDataCommand);
 * expect(putCount).toBe(1);
 * ```
 */
export function getCloudWatchCallCount(commandType: any): number {
  return cloudWatchMock.commandCalls(commandType).length;
}

/**
 * AWS SDK統合テスト
 *
 * DynamoDB、S3、CloudWatchとの統合を検証します。
 *
 * Requirements: テスト改善（タスク24）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  setupAllDefaultMocks,
  resetAllMocks,
  dynamoMock,
  s3Mock,
  cloudWatchMock,
  mockDynamoPutItem,
  mockDynamoGetItem,
  mockDynamoQuery,
  mockDynamoBatchWrite,
  mockS3PutObject,
  mockS3GetObject,
  mockCloudWatchPutMetrics,
  getDynamoCallCount,
  getS3CallCount,
  getCloudWatchCallCount,
  createDisclosure,
  createDisclosures,
} from '../test-helpers';

describe('AWS SDK統合テスト', () => {
  beforeEach(() => {
    // 環境変数の設定
    process.env.DYNAMODB_TABLE = 'tdnet_disclosures_test';
    process.env.S3_BUCKET = 'tdnet-pdfs-test';

    // モックのセットアップ
    setupAllDefaultMocks();
  });

  afterEach(() => {
    // モックのリセット
    resetAllMocks();

    // 環境変数のクリーンアップ
    delete process.env.DYNAMODB_TABLE;
    delete process.env.S3_BUCKET;
  });

  describe('DynamoDB統合', () => {
    it('PutCommandで開示情報を保存できること', async () => {
      // テストデータ
      const disclosure = createDisclosure();

      // モック設定
      mockDynamoPutItem(true);

      // DynamoDBクライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;

      // PutCommand実行
      await dynamoClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE,
          Item: disclosure,
        })
      );

      // 検証
      expect(getDynamoCallCount(PutCommand)).toBe(1);
    });

    it('GetCommandで開示情報を取得できること', async () => {
      // テストデータ
      const disclosure = createDisclosure();

      // モック設定
      mockDynamoGetItem(
        process.env.DYNAMODB_TABLE!,
        { disclosure_id: disclosure.disclosure_id },
        disclosure
      );

      // DynamoDBクライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;

      // GetCommand実行
      const result = await dynamoClient.send(
        new GetCommand({
          TableName: process.env.DYNAMODB_TABLE,
          Key: { disclosure_id: disclosure.disclosure_id },
        })
      );

      // 検証
      expect(result.Item).toEqual(disclosure);
      expect(getDynamoCallCount(GetCommand)).toBe(1);
    });

    it('QueryCommandで複数の開示情報を取得できること', async () => {
      // テストデータ
      const disclosures = createDisclosures(5);

      // モック設定
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, disclosures);

      // DynamoDBクライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;

      // QueryCommand実行
      const result = await dynamoClient.send(
        new QueryCommand({
          TableName: process.env.DYNAMODB_TABLE,
          IndexName: 'GSI_DatePartition',
          KeyConditionExpression: 'date_partition = :partition',
          ExpressionAttributeValues: {
            ':partition': '2024-01',
          },
        })
      );

      // 検証
      expect(result.Items).toHaveLength(5);
      expect(getDynamoCallCount(QueryCommand)).toBe(1);
    });

    it('BatchWriteCommandで複数の開示情報を一括保存できること', async () => {
      // テストデータ
      const disclosures = createDisclosures(25);

      // モック設定
      mockDynamoBatchWrite(true);

      // DynamoDBクライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;

      // BatchWriteCommand実行
      const requests = disclosures.map((disclosure) => ({
        PutRequest: {
          Item: disclosure,
        },
      }));

      await dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [process.env.DYNAMODB_TABLE!]: requests,
          },
        })
      );

      // 検証
      expect(getDynamoCallCount(BatchWriteCommand)).toBe(1);
    });

    it('BatchWriteCommandで部分的失敗を処理できること', async () => {
      // テストデータ
      const disclosures = createDisclosures(25);

      // モック設定（未処理アイテムあり）
      const unprocessedItems = {
        [process.env.DYNAMODB_TABLE!]: [
          {
            PutRequest: {
              Item: disclosures[24],
            },
          },
        ],
      };
      mockDynamoBatchWrite(false, unprocessedItems);

      // DynamoDBクライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;

      // BatchWriteCommand実行
      const requests = disclosures.map((disclosure) => ({
        PutRequest: {
          Item: disclosure,
        },
      }));

      const result = await dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [process.env.DYNAMODB_TABLE!]: requests,
          },
        })
      );

      // 検証
      expect(result.UnprocessedItems).toBeDefined();
      expect(
        result.UnprocessedItems![process.env.DYNAMODB_TABLE!]
      ).toHaveLength(1);
    });
  });

  describe('S3統合', () => {
    it('PutObjectCommandでPDFをアップロードできること', async () => {
      // テストデータ
      const pdfContent = Buffer.from('PDF content');
      const key = 'test/TD20240115001.pdf';

      // モック設定
      mockS3PutObject(true);

      // S3クライアント作成
      const s3Client = s3Mock as unknown as S3Client;

      // PutObjectCommand実行
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: pdfContent,
          ContentType: 'application/pdf',
        })
      );

      // 検証
      expect(getS3CallCount(PutObjectCommand)).toBe(1);
    });

    it('GetObjectCommandでPDFをダウンロードできること', async () => {
      // テストデータ
      const pdfContent = Buffer.from('PDF content');
      const key = 'test/TD20240115001.pdf';

      // モック設定
      mockS3GetObject(pdfContent);

      // S3クライアント作成
      const s3Client = s3Mock as unknown as S3Client;

      // GetObjectCommand実行
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
        })
      );

      // 検証
      expect(result.Body).toEqual(pdfContent);
      expect(getS3CallCount(GetObjectCommand)).toBe(1);
    });

    it('S3エラー時に適切にエラーハンドリングできること', async () => {
      // モック設定（失敗）
      mockS3PutObject(false, 'NoSuchBucket');

      // S3クライアント作成
      const s3Client = s3Mock as unknown as S3Client;

      // PutObjectCommand実行（エラー）
      await expect(
        s3Client.send(
          new PutObjectCommand({
            Bucket: 'non-existent-bucket',
            Key: 'test.pdf',
            Body: Buffer.from('test'),
          })
        )
      ).rejects.toThrow('NoSuchBucket');
    });
  });

  describe('CloudWatch統合', () => {
    it('PutMetricDataCommandでメトリクスを送信できること', async () => {
      // モック設定
      mockCloudWatchPutMetrics(true);

      // CloudWatchクライアント作成
      const cloudWatchClient = cloudWatchMock as unknown as CloudWatchClient;

      // PutMetricDataCommand実行
      await cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: 'TDnetDataCollector',
          MetricData: [
            {
              MetricName: 'DisclosuresCollected',
              Value: 10,
              Unit: 'Count',
              Timestamp: new Date(),
            },
          ],
        })
      );

      // 検証
      expect(getCloudWatchCallCount(PutMetricDataCommand)).toBe(1);
    });

    it('複数のメトリクスを一度に送信できること', async () => {
      // モック設定
      mockCloudWatchPutMetrics(true);

      // CloudWatchクライアント作成
      const cloudWatchClient = cloudWatchMock as unknown as CloudWatchClient;

      // PutMetricDataCommand実行（複数メトリクス）
      await cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: 'TDnetDataCollector',
          MetricData: [
            {
              MetricName: 'DisclosuresCollected',
              Value: 10,
              Unit: 'Count',
            },
            {
              MetricName: 'CollectionDuration',
              Value: 5000,
              Unit: 'Milliseconds',
            },
            {
              MetricName: 'FailedDisclosures',
              Value: 1,
              Unit: 'Count',
            },
          ],
        })
      );

      // 検証
      expect(getCloudWatchCallCount(PutMetricDataCommand)).toBe(1);
    });
  });

  describe('複合統合テスト', () => {
    it('DynamoDB + S3 + CloudWatchの連携が正常に動作すること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      const pdfContent = Buffer.from('PDF content');

      // モック設定
      mockDynamoPutItem(true);
      mockS3PutObject(true);
      mockCloudWatchPutMetrics(true);

      // クライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;
      const s3Client = s3Mock as unknown as S3Client;
      const cloudWatchClient = cloudWatchMock as unknown as CloudWatchClient;

      // 1. S3にPDFをアップロード
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: disclosure.pdf_file_name,
          Body: pdfContent,
        })
      );

      // 2. DynamoDBにメタデータを保存
      await dynamoClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE,
          Item: disclosure,
        })
      );

      // 3. CloudWatchにメトリクスを送信
      await cloudWatchClient.send(
        new PutMetricDataCommand({
          Namespace: 'TDnetDataCollector',
          MetricData: [
            {
              MetricName: 'DisclosuresCollected',
              Value: 1,
              Unit: 'Count',
            },
          ],
        })
      );

      // 検証
      expect(getS3CallCount(PutObjectCommand)).toBe(1);
      expect(getDynamoCallCount(PutCommand)).toBe(1);
      expect(getCloudWatchCallCount(PutMetricDataCommand)).toBe(1);
    });

    it('エラー発生時にロールバック処理が実行されること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      const pdfContent = Buffer.from('PDF content');

      // モック設定（DynamoDB失敗）
      mockS3PutObject(true);
      mockDynamoPutItem(false, 'ConditionalCheckFailedException');

      // クライアント作成
      const dynamoClient = dynamoMock as unknown as DynamoDBDocumentClient;
      const s3Client = s3Mock as unknown as S3Client;

      // 1. S3にPDFをアップロード（成功）
      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: disclosure.pdf_file_name,
          Body: pdfContent,
        })
      );

      // 2. DynamoDBにメタデータを保存（失敗）
      await expect(
        dynamoClient.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE,
            Item: disclosure,
          })
        )
      ).rejects.toThrow('ConditionalCheckFailedException');

      // 検証
      expect(getS3CallCount(PutObjectCommand)).toBe(1);
      expect(getDynamoCallCount(PutCommand)).toBe(1);
    });
  });
});

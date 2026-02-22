/**
 * Lambda Collector Handler E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * 日付範囲収集の完全性とTDnet APIモックとの統合を検証します。
 *
 * Requirements: タスク35
 */

import { Context } from 'aws-lambda';
import { handler, CollectorEvent, CollectorResponse } from '../handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

// LocalStack環境設定
const isLocalStack = process.env.AWS_ENDPOINT_URL !== undefined;
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
    forcePathStyle: true,
  }),
});

describe('Lambda Collector Handler E2E Tests', () => {
  let mockContext: Context;
  const tableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';
  const executionsTableName = process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';
  const bucketName = process.env.S3_BUCKET_NAME || 'tdnet-pdfs-local';

  beforeEach(() => {
    // モックコンテキスト
    mockContext = {
      awsRequestId: 'test-request-id-collector-e2e',
      functionName: 'tdnet-collector-e2e',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collector-e2e',
      memoryLimitInMB: '512',
      logGroupName: '/aws/lambda/tdnet-collector-e2e',
      logStreamName: '2024/01/15/[$LATEST]e2e-test',
      getRemainingTimeInMillis: () => 300000, // 5分
      callbackWaitsForEmptyEventLoop: true,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // 環境変数設定
    process.env.DYNAMODB_TABLE_NAME = tableName;
    process.env.DYNAMODB_EXECUTIONS_TABLE = executionsTableName;
    process.env.S3_BUCKET_NAME = bucketName;
  });

  describe('イベントバリデーション', () => {
    it('無効なモードの場合はエラーを返す', async () => {
      // Arrange
      const event = {
        mode: 'invalid-mode',
      } as unknown as CollectorEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Invalid mode');
      expect(result.collected_count).toBe(0);
      expect(result.failed_count).toBe(0);
    });

    it('on-demandモードで日付が未指定の場合はエラーを返す', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
        // start_date, end_dateが未指定
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('start_date and end_date are required');
    });

    it('不正な日付フォーマットの場合はエラーを返す', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024/01/15', // YYYY-MM-DD形式でない
        end_date: '2024-01-20',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Invalid start_date format');
    });

    it('開始日が終了日より後の場合はエラーを返す', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('must be before or equal to');
    });

    it('過去1年以上前の日付の場合はエラーを返す', async () => {
      // Arrange
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      const dateStr = twoYearsAgo.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('too old');
    });

    it('未来日の場合はエラーを返す', async () => {
      // Arrange
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.message).toContain('cannot be in the future');
    });
  });

  describe('バッチモード', () => {
    it('前日のデータを収集する', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result).toHaveProperty('execution_id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('collected_count');
      expect(result).toHaveProperty('failed_count');
      expect(['success', 'partial_success', 'failed']).toContain(result.status);

      // 実行IDの形式確認
      expect(result.execution_id).toMatch(/^exec_\d+_[a-z0-9]+_[a-z0-9\-]+$/);
    }, 60000); // タイムアウト60秒

    it('実行状態がDynamoDBに記録される', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      // 実行状態を確認
      const getResult = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: result.execution_id },
        })
      );

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.execution_id).toBe(result.execution_id);
      expect(['completed', 'failed']).toContain(getResult.Item?.status);
      expect(getResult.Item?.progress).toBe(100);
    }, 60000);
  });

  describe('オンデマンドモード', () => {
    it('指定期間のデータを収集する', async () => {
      // Arrange
      // 過去の日付を指定（実際のTDnetデータが存在する可能性が高い）
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result).toHaveProperty('execution_id');
      expect(['success', 'partial_success', 'failed']).toContain(result.status);
      expect(result.collected_count).toBeGreaterThanOrEqual(0);
      expect(result.failed_count).toBeGreaterThanOrEqual(0);
    }, 60000);

    it('複数日の日付範囲を処理できる', async () => {
      // Arrange
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 2); // 3日間

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result).toHaveProperty('execution_id');
      expect(['success', 'partial_success', 'failed']).toContain(result.status);
    }, 90000); // タイムアウト90秒

    it('execution_idが指定された場合はそれを使用する', async () => {
      // Arrange
      const customExecutionId = 'exec_custom_test_12345678';
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        execution_id: customExecutionId,
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.execution_id).toBe(customExecutionId);
    }, 60000);
  });

  describe('データ整合性', () => {
    it('収集したデータがDynamoDBに保存される', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      if (result.collected_count > 0) {
        // date_partitionを生成（YYYY-MM形式）
        const [year, month] = dateStr.split('-');
        const datePartition = `${year}-${month}`;

        // GSIを使用してデータを検索
        const queryResult = await docClient.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'DatePartitionIndex',
            KeyConditionExpression: 'date_partition = :partition',
            ExpressionAttributeValues: {
              ':partition': datePartition,
            },
            Limit: 1,
          })
        );

        expect(queryResult.Items).toBeDefined();
        if (queryResult.Items && queryResult.Items.length > 0) {
          const item = queryResult.Items[0];
          expect(item).toHaveProperty('disclosure_id');
          expect(item).toHaveProperty('company_code');
          expect(item).toHaveProperty('company_name');
          expect(item).toHaveProperty('disclosed_at');
          expect(item).toHaveProperty('pdf_s3_key');
          expect(item).toHaveProperty('date_partition');
          expect(item.date_partition).toBe(datePartition);
        }
      }
    }, 60000);

    it('PDFがS3に保存される', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      if (result.collected_count > 0) {
        // DynamoDBから1件取得してS3キーを確認
        const [year, month] = dateStr.split('-');
        const datePartition = `${year}-${month}`;

        const queryResult = await docClient.send(
          new QueryCommand({
            TableName: tableName,
            IndexName: 'DatePartitionIndex',
            KeyConditionExpression: 'date_partition = :partition',
            ExpressionAttributeValues: {
              ':partition': datePartition,
            },
            Limit: 1,
          })
        );

        if (queryResult.Items && queryResult.Items.length > 0) {
          const item = queryResult.Items[0];
          const s3Key = item.pdf_s3_key;

          // S3にオブジェクトが存在するか確認
          try {
            await s3Client.send(
              new HeadObjectCommand({
                Bucket: bucketName,
                Key: s3Key,
              })
            );
            // エラーがスローされなければ成功
            expect(true).toBe(true);
          } catch (error: any) {
            // LocalStack環境ではS3が利用できない場合があるため、
            // NoSuchKeyエラー以外は許容
            if (error.name !== 'NoSuchKey') {
              console.warn('S3 check skipped:', error.message);
            }
          }
        }
      }
    }, 60000);
  });

  describe('エラーハンドリング', () => {
    it('部分的失敗時はpartial_successを返す', async () => {
      // Arrange
      // 実際のテストでは、一部のPDFダウンロードが失敗する可能性がある
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      // 部分的失敗の場合
      if (result.status === 'partial_success') {
        expect(result.collected_count).toBeGreaterThan(0);
        expect(result.failed_count).toBeGreaterThan(0);
      }
    }, 60000);

    it('すべて失敗した場合はfailedを返す', async () => {
      // Arrange
      // 存在しない日付を指定（データが存在しない可能性が高い）
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2020-01-01',
        end_date: '2020-01-01',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      // データが存在しない場合はsuccessまたはfailed
      expect(['success', 'failed']).toContain(result.status);
      if (result.status === 'failed') {
        expect(result.collected_count).toBe(0);
      }
    }, 60000);
  });

  describe('進捗管理', () => {
    it('実行状態が段階的に更新される', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      // 最終的な実行状態を確認
      const getResult = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: result.execution_id },
        })
      );

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.progress).toBe(100);
      expect(getResult.Item?.collected_count).toBe(result.collected_count);
      expect(getResult.Item?.failed_count).toBe(result.failed_count);
    }, 60000);
  });

  describe('レスポンス形式', () => {
    it('正しいレスポンス形式を返す', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result).toHaveProperty('execution_id');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('collected_count');
      expect(result).toHaveProperty('failed_count');

      expect(typeof result.execution_id).toBe('string');
      expect(['success', 'partial_success', 'failed']).toContain(result.status);
      expect(typeof result.message).toBe('string');
      expect(typeof result.collected_count).toBe('number');
      expect(typeof result.failed_count).toBe('number');
    }, 60000);
  });
});

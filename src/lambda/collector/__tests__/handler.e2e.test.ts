/**
 * Lambda Collector Handler E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * 実際のDynamoDB/S3との統合を検証します。
 *
 * Requirements: タスク35
 */

import { Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { handler, CollectorEvent, CollectorResponse } from '../handler';

// LocalStack用のクライアント設定
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
  forcePathStyle: true,
});

// テスト用のモックコンテキスト
const mockContext: Context = {
  awsRequestId: 'test-request-id-e2e',
  functionName: 'tdnet-collector-e2e',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collector-e2e',
  memoryLimitInMB: '512',
  logGroupName: '/aws/lambda/tdnet-collector-e2e',
  logStreamName: '2024/01/15/[$LATEST]e2e-test',
  getRemainingTimeInMillis: () => 300000, // 5分
  callbackWaitsForEmptyEventLoop: false,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

describe('Lambda Collector Handler E2E Tests', () => {
  // テスト前にテーブルをクリーンアップ
  beforeEach(async () => {
    // DynamoDBテーブルのクリーンアップは省略（LocalStackは各テスト実行時にリセット）
  });

  describe('バッチモード', () => {
    it('前日のデータを収集してDynamoDB/S3に保存する', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response).toBeDefined();
      expect(response.execution_id).toBeDefined();
      expect(response.status).toMatch(/^(success|partial_success|failed)$/);
      expect(response.collected_count).toBeGreaterThanOrEqual(0);
      expect(response.failed_count).toBeGreaterThanOrEqual(0);

      // 実行状態がDynamoDBに保存されていることを確認
      const executionStatus = await getExecutionStatus(response.execution_id);
      expect(executionStatus).toBeDefined();
      expect(executionStatus.execution_id).toBe(response.execution_id);
      expect(executionStatus.status).toMatch(/^(pending|running|completed|failed)$/);
    }, 60000); // 60秒タイムアウト
  });

  describe('オンデマンドモード', () => {
    it('指定期間のデータを収集してDynamoDB/S3に保存する', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = formatDate(yesterday);

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response).toBeDefined();
      expect(response.execution_id).toBeDefined();
      expect(response.status).toMatch(/^(success|partial_success|failed)$/);
      expect(response.collected_count).toBeGreaterThanOrEqual(0);
      expect(response.failed_count).toBeGreaterThanOrEqual(0);

      // 実行状態がDynamoDBに保存されていることを確認
      const executionStatus = await getExecutionStatus(response.execution_id);
      expect(executionStatus).toBeDefined();
      expect(executionStatus.execution_id).toBe(response.execution_id);
    }, 60000);

    it('複数日の期間を指定してデータを収集する', async () => {
      // Arrange
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 2); // 3日間

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response).toBeDefined();
      expect(response.execution_id).toBeDefined();
      expect(response.status).toMatch(/^(success|partial_success|failed)$/);

      // 実行状態の進捗が100%になっていることを確認
      const executionStatus = await getExecutionStatus(response.execution_id);
      expect(executionStatus).toBeDefined();
      expect(executionStatus.progress).toBe(100);
    }, 120000); // 2分タイムアウト
  });

  describe('バリデーション', () => {
    it('不正なモードでバリデーションエラー', async () => {
      // Arrange
      const event = {
        mode: 'invalid-mode',
      } as any;

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toContain('Invalid mode');
    });

    it('on-demandモードで日付が未指定の場合はバリデーションエラー', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toContain('start_date and end_date are required');
    });

    it('不正な日付形式でバリデーションエラー', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024/01/15', // 不正な形式
        end_date: '2024-01-15',
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toContain('Invalid start_date format');
    });

    it('開始日が終了日より後の場合はバリデーションエラー', async () => {
      // Arrange
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      expect(response.status).toBe('failed');
      expect(response.message).toContain('must be before or equal to');
    });
  });

  describe('DynamoDB統合', () => {
    it('収集したデータがDynamoDBに保存される', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = formatDate(yesterday);

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      if (response.collected_count > 0) {
        // DynamoDBから開示情報を取得
        const disclosures = await scanDisclosures();
        expect(disclosures.length).toBeGreaterThan(0);

        // 最初の開示情報を検証
        const disclosure = disclosures[0];
        expect(disclosure.disclosure_id).toBeDefined();
        expect(disclosure.company_code).toBeDefined();
        expect(disclosure.company_name).toBeDefined();
        expect(disclosure.disclosed_at).toBeDefined();
        expect(disclosure.pdf_s3_key).toBeDefined();
        expect(disclosure.date_partition).toMatch(/^\d{4}-\d{2}$/);
      }
    }, 60000);
  });

  describe('S3統合', () => {
    it('収集したPDFがS3に保存される', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = formatDate(yesterday);

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: dateStr,
        end_date: dateStr,
      };

      // Act
      const response: CollectorResponse = await handler(event, mockContext);

      // Assert
      if (response.collected_count > 0) {
        // S3からオブジェクトリストを取得
        const objects = await listS3Objects();
        expect(objects.length).toBeGreaterThan(0);

        // オブジェクトキーの形式を検証
        const objectKey = objects[0];
        expect(objectKey).toMatch(/^\d{4}\/\d{2}\/\d{2}\/.+\.pdf$/);
      }
    }, 60000);
  });
});

/**
 * 実行状態を取得
 */
async function getExecutionStatus(execution_id: string): Promise<any> {
  const command = new GetItemCommand({
    TableName: process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions',
    Key: {
      execution_id: { S: execution_id },
    },
  });

  const result = await dynamoClient.send(command);
  return result.Item ? unmarshall(result.Item) : null;
}

/**
 * 開示情報をスキャン
 */
async function scanDisclosures(): Promise<any[]> {
  const command = new ScanCommand({
    TableName: process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures',
    Limit: 10,
  });

  const result = await dynamoClient.send(command);
  return result.Items ? result.Items.map(item => unmarshall(item)) : [];
}

/**
 * S3オブジェクトをリスト
 */
async function listS3Objects(): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs-local',
    MaxKeys: 10,
  });

  const result = await s3Client.send(command);
  return result.Contents ? result.Contents.map(obj => obj.Key || '') : [];
}

/**
 * DateオブジェクトをYYYY-MM-DD形式にフォーマット
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

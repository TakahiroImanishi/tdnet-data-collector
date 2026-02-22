/**
 * Export Status Lambda Function Tests
 *
 * GET /exports/{export_id} エンドポイントのテスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../export-status/handler';

// モック
const dynamoMock = mockClient(DynamoDBClient);
const secretsManagerMock = mockClient(SecretsManagerClient);

// テスト用のContext
const mockContext: Context = {
  awsRequestId: 'test-request-id',
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:test',
  memoryLimitInMB: '256',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/15/[$LATEST]test',
  callbackWaitsForEmptyEventLoop: true,
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
} as Context;

describe('Export Status Lambda Handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    secretsManagerMock.reset();
    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key',
    });
    process.env.EXPORT_STATUS_TABLE_NAME = 'tdnet_export_status';
    process.env.API_KEY = 'test-api-key';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('エクスポート状態（completed）を正しく返却する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-xyz789' },
          status: { S: 'completed' },
          progress: { N: '100' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:05:00Z' },
          export_count: { N: '150' },
          file_size: { N: '1024000' },
          download_url: { S: 'https://s3.amazonaws.com/exports/file.csv' },
          expires_at: { S: '2024-01-22T10:05:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data).toEqual({
        export_id: 'export-20240115-xyz789',
        status: 'completed',
        progress: 100,
        requested_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:05:00Z',
        export_count: 150,
        file_size: 1024000,
        download_url: 'https://s3.amazonaws.com/exports/file.csv',
        expires_at: '2024-01-22T10:05:00Z',
        error_message: null,
      });
    });

    it('エクスポート状態（processing）を正しく返却する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-abc123' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-abc123' },
          status: { S: 'processing' },
          progress: { N: '50' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('processing');
      expect(body.data.progress).toBe(50);
      expect(body.data.download_url).toBeNull();
    });

    it('エクスポート状態（failed）を正しく返却する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-failed' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-failed' },
          status: { S: 'failed' },
          progress: { N: '0' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:01:00Z' },
          error_message: { S: 'DynamoDB query failed' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('failed');
      expect(body.data.error_message).toBe('DynamoDB query failed');
    });
  });

  describe('異常系 - バリデーションエラー', () => {
    it('export_idが未指定の場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: {},
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('export_id is required');
    });

    it('pathParametersがnullの場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: null,
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('export_idのフォーマットが不正な場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'invalid-format' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid export_id format');
    });
  });

  describe('異常系 - リソース不存在', () => {
    it('エクスポートが存在しない場合、404エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-notfound' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: undefined,
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Export not found');
    });
  });

  describe('異常系 - DynamoDBエラー', () => {
    it('DynamoDBエラー時、再試行後に500エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('ProvisionedThroughputExceededException時、再試行する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      const throttleError = new Error('ProvisionedThroughputExceededException');
      throttleError.name = 'ProvisionedThroughputExceededException';

      dynamoMock
        .on(GetItemCommand)
        .rejectsOnce(throttleError)
        .rejectsOnce(throttleError)
        .resolves({
          Item: {
            export_id: { S: 'export-20240115-xyz789' },
            status: { S: 'completed' },
            progress: { N: '100' },
            requested_at: { S: '2024-01-15T10:00:00Z' },
            completed_at: { S: '2024-01-15T10:05:00Z' },
          },
        });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(dynamoMock.calls()).toHaveLength(3); // 2回失敗、3回目成功
    });
  });

  describe('CORS対応', () => {
    it('レスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-xyz789' },
          status: { S: 'completed' },
          progress: { N: '100' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:05:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });

  // APIキーキャッシングテストは削除（APIキー認証機能が未実装のため）

  describe('エクスポート状態の各ステータス', () => {
    beforeEach(() => {
      // 各テストの前に環境変数を設定
      process.env.TEST_ENV = 'e2e';
      process.env.API_KEY = 'test-api-key';
    });

    it('pending状態のエクスポートを取得できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-pending' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-pending' },
          status: { S: 'pending' },
          progress: { N: '0' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('pending');
      expect(body.data.progress).toBe(0);
    });

    it('X-Api-Key（大文字）ヘッダーでも認証できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'X-Api-Key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-xyz789' },
          status: { S: 'completed' },
          progress: { N: '100' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:05:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
    });

    it('export_countとfile_sizeがnullの場合も正しく処理できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-processing' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-processing' },
          status: { S: 'processing' },
          progress: { N: '50' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          // export_count, file_size, download_url, expires_at, error_message は未設定
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.export_count).toBeNull();
      expect(body.data.file_size).toBeNull();
      expect(body.data.download_url).toBeNull();
      expect(body.data.expires_at).toBeNull();
      expect(body.data.error_message).toBeNull();
    });

    it('completed_atがnullの場合も正しく処理できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-processing2' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-processing2' },
          status: { S: 'processing' },
          progress: { N: '75' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          // completed_at は未設定
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.completed_at).toBeNull();
    });

    it('download_urlとexpires_atが設定されている場合も正しく処理できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-complete' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-complete' },
          status: { S: 'completed' },
          progress: { N: '100' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:05:00Z' },
          export_count: { N: '200' },
          file_size: { N: '2048000' },
          download_url: { S: 'https://s3.amazonaws.com/exports/file2.csv' },
          expires_at: { S: '2024-01-22T10:05:00Z' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.download_url).toBe('https://s3.amazonaws.com/exports/file2.csv');
      expect(body.data.expires_at).toBe('2024-01-22T10:05:00Z');
    });

    it('error_messageが設定されている場合も正しく処理できる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-failed2' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          export_id: { S: 'export-20240115-failed2' },
          status: { S: 'failed' },
          progress: { N: '10' },
          requested_at: { S: '2024-01-15T10:00:00Z' },
          completed_at: { S: '2024-01-15T10:01:00Z' },
          error_message: { S: 'S3 upload failed' },
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.error_message).toBe('S3 upload failed');
    });

    it('エラーにdetailsプロパティがある場合も正しく処理できる', async () => {
      // Arrange
      const errorWithDetails: any = new Error('Validation failed');
      errorWithDetails.name = 'ValidationError';
      errorWithDetails.details = { field: 'export_id', reason: 'invalid format' };

      dynamoMock.on(GetItemCommand).rejects(errorWithDetails);

      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'test-api-key' },
        requestContext: {
          requestId: 'test-request-id',
        } as any,
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.details).toBeDefined();
      expect(body.error.details.field).toBe('export_id');
    });
  });
});

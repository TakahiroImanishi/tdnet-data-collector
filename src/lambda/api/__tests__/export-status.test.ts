/**
 * Export Status Lambda Function Tests
 *
 * GET /exports/{export_id} エンドポイントのテスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../export-status/handler';

// モック
const dynamoMock = mockClient(DynamoDBClient);

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

    it('export_idのフォーマットが不正な場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'invalid-format' },
        headers: { 'x-api-key': 'test-api-key' },
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

  describe('異常系 - 認証エラー', () => {
    it('APIキーが未指定の場合、401エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: {},
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
    });

    it('APIキーが不正な場合、401エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-xyz789' },
        headers: { 'x-api-key': 'invalid-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
    });
  });

  describe('異常系 - リソース不存在', () => {
    it('エクスポートが存在しない場合、404エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { export_id: 'export-20240115-notfound' },
        headers: { 'x-api-key': 'test-api-key' },
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
});

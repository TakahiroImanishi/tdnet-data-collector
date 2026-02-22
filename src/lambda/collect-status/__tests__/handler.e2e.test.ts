/**
 * Lambda Collect Status Handler E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * 実際のDynamoDBとの統合を検証します。
 *
 * Requirements: タスク35
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { handler } from '../handler';

// LocalStack用のクライアント設定
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
});

// テスト用のモックコンテキスト
const mockContext: Context = {
  awsRequestId: 'test-request-id-e2e',
  functionName: 'tdnet-collect-status-e2e',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collect-status-e2e',
  memoryLimitInMB: '256',
  logGroupName: '/aws/lambda/tdnet-collect-status-e2e',
  logStreamName: '2024/01/15/[$LATEST]e2e-test',
  getRemainingTimeInMillis: () => 30000,
  callbackWaitsForEmptyEventLoop: false,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

describe('Lambda Collect Status Handler E2E Tests', () => {
  describe('実行状態取得', () => {
    it('存在する実行IDの状態を取得できる', async () => {
      // Arrange
      const execution_id = `test_exec_${Date.now()}`;
      const executionStatus = {
        execution_id,
        status: 'running',
        progress: 50,
        collected_count: 10,
        failed_count: 2,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // DynamoDBにテストデータを挿入
      await putExecutionStatus(executionStatus);

      const event: APIGatewayProxyEvent = createMockEvent(execution_id);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(200);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('success');
      expect(body.data).toBeDefined();
      expect(body.data.execution_id).toBe(execution_id);
      expect(body.data.status).toBe('running');
      expect(body.data.progress).toBe(50);
      expect(body.data.collected_count).toBe(10);
      expect(body.data.failed_count).toBe(2);
    });

    it('完了状態の実行IDを取得できる', async () => {
      // Arrange
      const execution_id = `test_exec_completed_${Date.now()}`;
      const executionStatus = {
        execution_id,
        status: 'completed',
        progress: 100,
        collected_count: 50,
        failed_count: 0,
        started_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 30000).toISOString(),
        completed_at: new Date(Date.now() - 30000).toISOString(),
      };

      await putExecutionStatus(executionStatus);

      const event: APIGatewayProxyEvent = createMockEvent(execution_id);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('completed');
      expect(body.data.progress).toBe(100);
      expect(body.data.completed_at).toBeDefined();
    });

    it('失敗状態の実行IDを取得できる', async () => {
      // Arrange
      const execution_id = `test_exec_failed_${Date.now()}`;
      const executionStatus = {
        execution_id,
        status: 'failed',
        progress: 30,
        collected_count: 5,
        failed_count: 10,
        started_at: new Date(Date.now() - 60000).toISOString(),
        updated_at: new Date(Date.now() - 30000).toISOString(),
        completed_at: new Date(Date.now() - 30000).toISOString(),
        error_message: 'Network error occurred',
      };

      await putExecutionStatus(executionStatus);

      const event: APIGatewayProxyEvent = createMockEvent(execution_id);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('failed');
      expect(body.data.error_message).toBe('Network error occurred');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しない実行IDの場合は404エラー', async () => {
      // Arrange
      const execution_id = 'non_existent_execution_id';
      const event: APIGatewayProxyEvent = createMockEvent(execution_id);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Content-Type', 'application/json');
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');

      const body = JSON.parse(response.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Execution not found');
    });

    it('execution_idが未指定の場合は400エラー', async () => {
      // Arrange
      const event: APIGatewayProxyEvent = createMockEvent(null);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(400);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('execution_id is required');
    });
  });

  describe('CORS対応', () => {
    it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange
      const execution_id = `test_exec_cors_${Date.now()}`;
      const executionStatus = {
        execution_id,
        status: 'running',
        progress: 25,
        collected_count: 5,
        failed_count: 0,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await putExecutionStatus(executionStatus);

      const event: APIGatewayProxyEvent = createMockEvent(execution_id);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });

    it('エラーレスポンスにもCORSヘッダーが含まれる', async () => {
      // Arrange
      const event: APIGatewayProxyEvent = createMockEvent('non_existent');

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.statusCode).toBe(404);
      expect(response.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });
  });
});

/**
 * DynamoDBに実行状態を挿入
 */
async function putExecutionStatus(executionStatus: any): Promise<void> {
  const command = new PutItemCommand({
    TableName: process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions',
    Item: marshall(executionStatus),
  });

  await dynamoClient.send(command);
}

/**
 * モックイベントを作成
 */
function createMockEvent(execution_id: string | null): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: `/collect/${execution_id}`,
    pathParameters: execution_id ? { execution_id } : null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      path: `/collect/${execution_id}`,
      stage: 'prod',
      requestId: 'test-request-id',
      requestTime: '15/Jan/2024:10:30:00 +0000',
      requestTimeEpoch: 1705315800000,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '192.168.1.1',
        user: null,
        userAgent: 'Mozilla/5.0',
        userArn: null,
      },
      authorizer: null,
      domainName: 'api.example.com',
      domainPrefix: 'api',
      resourceId: 'test-resource-id',
      resourcePath: '/collect/{execution_id}',
    },
    resource: '/collect/{execution_id}',
  };
}

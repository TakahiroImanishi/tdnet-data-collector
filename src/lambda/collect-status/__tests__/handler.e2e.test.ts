/**
 * Lambda Collect Status Handler E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * 実行状態取得とDynamoDB統合を検証します。
 *
 * Requirements: タスク35
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

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

describe('Lambda Collect Status Handler E2E Tests', () => {
  let mockContext: Context;
  let mockEvent: APIGatewayProxyEvent;
  const executionsTableName = process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';

  beforeAll(async () => {
    // テストデータをDynamoDBに挿入
    const testExecutions = [
      {
        execution_id: 'exec_test_pending_12345678',
        status: 'pending',
        progress: 0,
        collected_count: 0,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      },
      {
        execution_id: 'exec_test_running_12345678',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 2,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:05:00Z',
      },
      {
        execution_id: 'exec_test_completed_12345678',
        status: 'completed',
        progress: 100,
        collected_count: 50,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:10:00Z',
        completed_at: '2024-01-15T10:10:00Z',
      },
      {
        execution_id: 'exec_test_failed_12345678',
        status: 'failed',
        progress: 30,
        collected_count: 10,
        failed_count: 20,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:03:00Z',
        completed_at: '2024-01-15T10:03:00Z',
        error_message: 'Network error occurred',
      },
    ];

    for (const execution of testExecutions) {
      try {
        await docClient.send(
          new PutCommand({
            TableName: executionsTableName,
            Item: execution,
          })
        );
        console.log('Test execution data inserted:', execution.execution_id);
      } catch (error) {
        console.error('Failed to insert test execution data:', error);
        throw error;
      }
    }
  });

  beforeEach(() => {
    // モックコンテキスト
    mockContext = {
      awsRequestId: 'test-request-id-collect-status-e2e',
      functionName: 'tdnet-collect-status-e2e',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collect-status-e2e',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/tdnet-collect-status-e2e',
      logStreamName: '2024/01/15/[$LATEST]e2e-test',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // モックイベント（基本）
    mockEvent = {
      body: null,
      headers: {},
      multiValueHeaders: {},
      httpMethod: 'GET',
      isBase64Encoded: false,
      path: '/collect/{execution_id}',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api-id-e2e',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/collect/{execution_id}',
        stage: 'test',
        requestId: 'test-request-id-e2e',
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

    // 環境変数設定
    process.env.DYNAMODB_EXECUTIONS_TABLE = executionsTableName;
  });

  describe('実行状態取得', () => {
    it('pending状態の実行状態を取得できる', async () => {
      // Arrange
      mockEvent.pathParameters = {
        execution_id: 'exec_test_pending_12345678',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data).toHaveProperty('execution_id');
      expect(body.data).toHaveProperty('status');
      expect(body.data).toHaveProperty('progress');
      expect(body.data).toHaveProperty('collected_count');
      expect(body.data).toHaveProperty('failed_count');
      expect(body.data).toHaveProperty('started_at');
      expect(body.data).toHaveProperty('updated_at');

      expect(body.data.execution_id).toBe('exec_test_pending_12345678');
      expect(body.data.status).toBe('pending');
      expect(body.data.progress).toBe(0);
      expect(body.data.collected_count).toBe(0);
      expect(body.data.failed_count).toBe(0);
    });

    it('running状態の実行状態を取得できる', async () => {
      // Arrange
      mockEvent.pathParameters = {
        execution_id: 'exec_test_running_12345678',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data.execution_id).toBe('exec_test_running_12345678');
      expect(body.data.status).toBe('running');
      expect(body.data.progress).toBe(50);
      expect(body.data.collected_count).toBe(25);
      expect(body.data.failed_count).toBe(2);
    });

    it('completed状態の実行状態を取得できる', async () => {
      // Arrange
      mockEvent.pathParameters = {
        execution_id: 'exec_test_completed_12345678',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data.execution_id).toBe('exec_test_completed_12345678');
      expect(body.data.status).toBe('completed');
      expect(body.data.progress).toBe(100);
      expect(body.data.collected_count).toBe(50);
      expect(body.data.failed_count).toBe(0);
      expect(body.data).toHaveProperty('completed_at');
      expect(body.data.completed_at).toBe('2024-01-15T10:10:00Z');
    });

    it('failed状態の実行状態を取得できる'
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

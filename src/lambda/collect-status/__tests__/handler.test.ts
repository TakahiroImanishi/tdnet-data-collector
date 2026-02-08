/**
 * Lambda Collect Status Handler Tests
 *
 * GET /collect/{execution_id} エンドポイントのユニットテスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../handler';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mock
const dynamoMock = mockClient(DynamoDBClient);

// Mock Context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'tdnet-collect-status',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collect-status',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id-12345',
  logGroupName: '/aws/lambda/tdnet-collect-status',
  logStreamName: '2024/01/15/[$LATEST]abcdef',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('GET /collect/{execution_id} Handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'tdnet_executions';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.DYNAMODB_EXECUTIONS_TABLE;
    delete process.env.AWS_REGION;
  });

  describe('正常系', () => {
    it('実行状態が存在する場合は200を返す', async () => {
      const executionStatus = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:05:00Z',
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall(executionStatus),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_1234567890_abc123_test1234',
        pathParameters: {
          execution_id: 'exec_1234567890_abc123_test1234',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data).toEqual(executionStatus);
    });

    it('完了状態の実行を取得できる', async () => {
      const executionStatus = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'completed',
        progress: 100,
        collected_count: 50,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:10:00Z',
        completed_at: '2024-01-15T10:10:00Z',
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall(executionStatus),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_1234567890_abc123_test1234',
        pathParameters: {
          execution_id: 'exec_1234567890_abc123_test1234',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('completed');
      expect(body.data.completed_at).toBe('2024-01-15T10:10:00Z');
    });

    it('失敗状態の実行を取得できる', async () => {
      const executionStatus = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'failed',
        progress: 30,
        collected_count: 15,
        failed_count: 5,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:05:00Z',
        completed_at: '2024-01-15T10:05:00Z',
        error_message: 'Network error occurred',
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall(executionStatus),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_1234567890_abc123_test1234',
        pathParameters: {
          execution_id: 'exec_1234567890_abc123_test1234',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('failed');
      expect(body.data.error_message).toBe('Network error occurred');
    });
  });

  describe('バリデーションエラー', () => {
    it('execution_idがない場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('execution_id is required');
    });
  });

  describe('Not Foundエラー', () => {
    it('実行状態が存在しない場合は404を返す', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: undefined,
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_nonexistent',
        pathParameters: {
          execution_id: 'exec_nonexistent',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Execution not found');
    });
  });

  describe('DynamoDBエラー', () => {
    it('DynamoDBの取得に失敗した場合は500を返す', async () => {
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_1234567890_abc123_test1234',
        pathParameters: {
          execution_id: 'exec_1234567890_abc123_test1234',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Failed to retrieve execution status');
    });
  });
});

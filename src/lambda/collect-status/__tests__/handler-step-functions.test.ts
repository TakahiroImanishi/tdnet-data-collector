/**
 * Lambda Collect Status Handler Tests (Step Functions)
 *
 * GET /collect/{execution_id} エンドポイントのStep Functions統合テスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../handler';
import { SFNClient, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mocks
const sfnMock = mockClient(SFNClient);
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

describe('GET /collect/{execution_id} Handler (Step Functions)', () => {
  beforeEach(() => {
    sfnMock.reset();
    dynamoMock.reset();
    process.env.STATE_MACHINE_ARN =
      'arn:aws:states:ap-northeast-1:123456789012:stateMachine:tdnet-collector-workflow';
    process.env.EXECUTION_STATE_TABLE = 'test-execution-state-table';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.STATE_MACHINE_ARN;
    delete process.env.EXECUTION_STATE_TABLE;
    delete process.env.AWS_REGION;
  });

  describe('正常系', () => {
    it('実行中のStep Functions実行状態を取得できる', async () => {
      const execution_id = 'test-execution-id-123';

      sfnMock.on(DescribeExecutionCommand).resolves({
        executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:tdnet-collector-workflow:${execution_id}`,
        stateMachineArn:
          'arn:aws:states:ap-northeast-1:123456789012:stateMachine:tdnet-collector-workflow',
        name: execution_id,
        status: 'RUNNING',
        startDate: new Date('2024-01-15T10:00:00Z'),
        input: JSON.stringify({ start_date: '2024-01-01', end_date: '2024-01-15' }),
      });

      // 実行状態テーブルから進捗情報を取得
      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall({
          execution_id,
          collected_count: 25,
          failed_count: 2,
        }),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: `/collect/${execution_id}`,
        pathParameters: {
          execution_id,
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
      expect(body.status).toBe('success');
      expect(body.data.execution_id).toBe(execution_id);
      expect(body.data.status).toBe('running');
      expect(body.data.start_time).toBe('2024-01-15T10:00:00.000Z');
      expect(body.data.progress).toEqual({
        collected_count: 25,
        failed_count: 2,
      });
    });

    it('成功したStep Functions実行状態を取得できる', async () => {
      const execution_id = 'test-execution-id-456';

      sfnMock.on(DescribeExecutionCommand).resolves({
        executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:tdnet-collector-workflow:${execution_id}`,
        stateMachineArn:
          'arn:aws:states:ap-northeast-1:123456789012:stateMachine:tdnet-collector-workflow',
        name: execution_id,
        status: 'SUCCEEDED',
        startDate: new Date('2024-01-15T10:00:00Z'),
        stopDate: new Date('2024-01-15T10:10:00Z'),
        input: JSON.stringify({ start_date: '2024-01-01', end_date: '2024-01-15' }),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: `/collect/${execution_id}`,
        pathParameters: {
          execution_id,
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
      expect(body.data.status).toBe('succeeded');
      expect(body.data.end_time).toBe('2024-01-15T10:10:00.000Z');
      expect(body.data.progress).toBeUndefined(); // 完了時は進捗情報なし
    });

    it('失敗したStep Functions実行状態を取得できる', async () => {
      const execution_id = 'test-execution-id-789';

      sfnMock.on(DescribeExecutionCommand).resolves({
        executionArn: `arn:aws:states:ap-northeast-1:123456789012:execution:tdnet-collector-workflow:${execution_id}`,
        stateMachineArn:
          'arn:aws:states:ap-northeast-1:123456789012:stateMachine:tdnet-collector-workflow',
        name: execution_id,
        status: 'FAILED',
        startDate: new Date('2024-01-15T10:00:00Z'),
        stopDate: new Date('2024-01-15T10:05:00Z'),
        error: 'States.TaskFailed',
        cause: 'Lambda function failed',
        input: JSON.stringify({ start_date: '2024-01-01', end_date: '2024-01-15' }),
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: `/collect/${execution_id}`,
        pathParameters: {
          execution_id,
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
      expect(body.data.error_message).toBe('States.TaskFailed');
    });
  });

  describe('エラー処理', () => {
    it('存在しない実行IDの場合は404を返す', async () => {
      const execution_id = 'nonexistent-execution-id';

      const error: any = new Error('Execution does not exist');
      error.name = 'ExecutionDoesNotExist';
      sfnMock.on(DescribeExecutionCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: `/collect/${execution_id}`,
        pathParameters: {
          execution_id,
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
    });

    it('Step Functions APIエラーの場合は500を返す', async () => {
      const execution_id = 'test-execution-id';

      sfnMock.on(DescribeExecutionCommand).rejects(new Error('Step Functions API error'));

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: `/collect/${execution_id}`,
        pathParameters: {
          execution_id,
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
    });
  });
});

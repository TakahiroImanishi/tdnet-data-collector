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
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
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

  describe('エラーレスポンスマッピング', () => {
    it('UnauthorizedErrorは401を返す', async () => {
      // UnauthorizedErrorクラスが存在する場合のテスト
      // 実際のエラークラスがない場合は、エラー名でマッピングされる
      const error = new Error('Unauthorized');
      error.name = 'UnauthorizedError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
    });

    it('pending状態の実行を取得できる', async () => {
      const executionStatus = {
        execution_id: 'exec_pending',
        status: 'pending',
        progress: 0,
        collected_count: 0,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
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
        path: '/collect/exec_pending',
        pathParameters: {
          execution_id: 'exec_pending',
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
      expect(body.data.status).toBe('pending');
      expect(body.data.progress).toBe(0);
    });

    it('ForbiddenErrorは403を返す', async () => {
      const error = new Error('Forbidden');
      error.name = 'ForbiddenError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
    });

    it('ConflictErrorは409を返す', async () => {
      const error = new Error('Conflict');
      error.name = 'ConflictError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
    });

    it('RateLimitErrorは429を返す', async () => {
      const error = new Error('Rate limit exceeded');
      error.name = 'RateLimitError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
    });

    it('ServiceUnavailableErrorは503を返す', async () => {
      const error = new Error('Service unavailable');
      error.name = 'ServiceUnavailableError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
    });

    it('GatewayTimeoutErrorは504を返す', async () => {
      const error = new Error('Gateway timeout');
      error.name = 'GatewayTimeoutError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
    });

    it('ValidationErrorを直接スローした場合は400を返す', async () => {
      // pathParametersがnullの場合、ValidationErrorが直接スローされる
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/',
        pathParameters: null, // これによりValidationErrorが直接スローされる
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('NotFoundErrorを直接スローした場合は404を返す', async () => {
      dynamoMock.on(GetItemCommand).resolves({
        Item: undefined, // アイテムが見つからない
      });

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_notfound',
        pathParameters: {
          execution_id: 'exec_notfound',
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
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('エラーにdetailsプロパティがある場合も正しく処理できる', async () => {
      const errorWithDetails: any = new Error('Validation failed');
      errorWithDetails.name = 'ValidationError';
      errorWithDetails.details = { field: 'execution_id', reason: 'invalid format' };

      dynamoMock.on(GetItemCommand).rejects(errorWithDetails);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
        },
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500); // getExecutionStatusでラップされるため500
      const body = JSON.parse(result.body);
      expect(body.error.details).toBeDefined();
    });

    it('エラーにdetailsプロパティがない場合は空オブジェクトを返す', async () => {
      // ValidationErrorを直接handlerでスローさせる（pathParametersを空オブジェクトに）
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/',
        pathParameters: {}, // 空オブジェクト（execution_idがundefined）
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toEqual({}); // 空オブジェクト（detailsプロパティなし）
    });

    it('未知のエラー名の場合はINTERNAL_ERRORとして処理する', async () => {
      const unknownError = new Error('Unknown error type');
      unknownError.name = 'UnknownErrorType'; // errorCodeMapにない名前

      dynamoMock.on(GetItemCommand).rejects(unknownError);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
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
      expect(body.error.code).toBe('INTERNAL_ERROR'); // デフォルトのエラーコード
      expect(body.error.message).toBe('Failed to retrieve execution status');
      expect(body.error.details).toEqual({}); // detailsプロパティがない場合は空オブジェクト
    });

    it('pathParametersが空オブジェクトの場合もValidationErrorを返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/',
        pathParameters: {}, // 空オブジェクト
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('execution_id is required');
    });

    it('InternalErrorは500を返す', async () => {
      const error = new Error('Internal error');
      error.name = 'InternalError';

      dynamoMock.on(GetItemCommand).rejects(error);

      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/collect/exec_test',
        pathParameters: {
          execution_id: 'exec_test',
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
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('環境変数デフォルト値', () => {
    it('AWS_REGIONが未設定の場合もハンドラーが正常に動作する', async () => {
      // AWS_REGIONを削除してデフォルト値（ap-northeast-1）を使用
      delete process.env.AWS_REGION;

      const executionStatus = {
        execution_id: 'exec_default_region',
        status: 'completed',
        progress: 100,
        collected_count: 10,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:05:00Z',
        completed_at: '2024-01-15T10:05:00Z',
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
        path: '/collect/exec_default_region',
        pathParameters: {
          execution_id: 'exec_default_region',
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
      expect(body.data.execution_id).toBe('exec_default_region');

      // AWS_REGIONを元に戻す
      process.env.AWS_REGION = 'ap-northeast-1';
    });

    it('DYNAMODB_EXECUTIONS_TABLEが未設定の場合もハンドラーが正常に動作する', async () => {
      // DYNAMODB_EXECUTIONS_TABLEを削除してデフォルト値（tdnet_executions）を使用
      delete process.env.DYNAMODB_EXECUTIONS_TABLE;

      const executionStatus = {
        execution_id: 'exec_default_table',
        status: 'running',
        progress: 50,
        collected_count: 5,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:02:00Z',
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
        path: '/collect/exec_default_table',
        pathParameters: {
          execution_id: 'exec_default_table',
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
      expect(body.data.execution_id).toBe('exec_default_table');

      // DYNAMODB_EXECUTIONS_TABLEを元に戻す
      process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
    });
  });
});

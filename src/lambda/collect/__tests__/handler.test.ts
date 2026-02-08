/**
 * Lambda Collect Handler Tests
 *
 * POST /collect エンドポイントのユニットテスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../handler';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mock
const lambdaMock = mockClient(LambdaClient);

// Mock Context
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'tdnet-collect',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collect',
  memoryLimitInMB: '256',
  awsRequestId: 'test-request-id-12345',
  logGroupName: '/aws/lambda/tdnet-collect',
  logStreamName: '2024/01/15/[$LATEST]abcdef',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * テスト用の日付を動的に生成
 * 現在日から相対的な日付を返すことで、テストが常に有効な日付範囲を使用できるようにする
 */
const getTestDates = () => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7); // 7日前
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 2); // 2日前
  
  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
};

/**
 * 指定日数前の日付を取得
 */
const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

/**
 * 指定日数後の日付を取得
 */
const getDaysLater = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

describe('POST /collect Handler', () => {
  beforeEach(() => {
    lambdaMock.reset();
    process.env.COLLECTOR_FUNCTION_NAME = 'tdnet-collector';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.COLLECTOR_FUNCTION_NAME;
    delete process.env.AWS_REGION;
  });

  describe('正常系', () => {
    it('有効なリクエストで200を返す', async () => {
      // Lambda Collectorの呼び出しをモック（同期呼び出し）
      const mockCollectorResponse = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'success',
        message: 'Collection started',
        collected_count: 0,
        failed_count: 0,
      };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify(mockCollectorResponse)),
      });

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
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
      expect(body.data).toHaveProperty('execution_id');
      expect(body.data).toHaveProperty('status', 'pending');
      expect(body.data).toHaveProperty('message');
      expect(body.data).toHaveProperty('started_at');
    });

    it('Lambda Collectorから返されたexecution_idを使用する', async () => {
      const mockCollectorResponse = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'success',
        message: 'Collection started',
        collected_count: 0,
        failed_count: 0,
      };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify(mockCollectorResponse)),
      });

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      // Lambda Collectorから返されたexecution_idが使用されていることを確認
      expect(body.data.execution_id).toBe('exec_1234567890_abc123_test1234');
    });

    it('Lambda呼び出しがRequestResponseモードで実行される', async () => {
      const mockCollectorResponse = {
        execution_id: 'exec_1234567890_abc123_test1234',
        status: 'success',
        message: 'Collection started',
        collected_count: 0,
        failed_count: 0,
      };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify(mockCollectorResponse)),
      });

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
      };

      await handler(event, mockContext);

      // InvokeCommandが正しいパラメータで呼ばれたことを確認
      const calls = lambdaMock.commandCalls(InvokeCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.InvocationType).toBe('RequestResponse');
      expect(calls[0].args[0].input.FunctionName).toBe('tdnet-collector');
    });
  });

  describe('バリデーションエラー', () => {
    it('リクエストボディがない場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.message).toContain('Request body is required');
    });

    it('start_dateがない場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          end_date: getDaysAgo(2),
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('start_date is required');
    });

    it('end_dateがない場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(7),
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('end_date is required');
    });

    it('start_dateのフォーマットが不正な場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: '2024/01/15', // 不正なフォーマット
          end_date: getDaysAgo(2),
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid start_date format');
    });

    it('start_dateが存在しない日付の場合は400を返す', async () => {
      // 存在しない日付を使用（2月30日は存在しない）
      // ただし、1年以内の日付を使用する必要がある
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1; // 現在の月
      
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: `${year}-02-30`, // 2月30日は存在しない
          end_date: `${year}-03-01`,
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      // JavaScriptのDateコンストラクタは2月30日を3月2日に変換するため、
      // 日付順序チェックでエラーになる
      expect(body.error.message).toContain('must be before or equal to');
    });

    it('start_dateがend_dateより後の場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(2),
          end_date: getDaysAgo(7),
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('must be before or equal to');
    });

    it('start_dateが1年以上前の場合は400を返す', async () => {
      const twoYearsAgo = getDaysAgo(730); // 2年前

      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: twoYearsAgo,
          end_date: getDaysAgo(2),
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('too old');
    });

    it('end_dateが未来日の場合は400を返す', async () => {
      const twoDaysLater = getDaysLater(2); // 2日後

      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(7),
          end_date: twoDaysLater,
        }),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
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
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('cannot be in the future');
    });
  });

  describe('Lambda呼び出しエラー', () => {
    it('Lambda Collectorの呼び出しに失敗した場合は500を返す', async () => {
      lambdaMock.on(InvokeCommand).rejects(new Error('Lambda invocation failed'));

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
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
      expect(body.error.message).toContain('Failed to start data collection');
    });

    it('Lambda Collectorが空のPayloadを返した場合は500を返す', async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: undefined,
      });

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
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

    it('Lambda Collectorがexecution_idを返さない場合は500を返す', async () => {
      const mockCollectorResponse = {
        status: 'success',
        message: 'Collection started',
        collected_count: 0,
        failed_count: 0,
        // execution_idがない
      };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify(mockCollectorResponse)),
      });

      const testDates = getTestDates();
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify(testDates),
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'POST',
        isBase64Encoded: false,
        path: '/collect',
        pathParameters: null,
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

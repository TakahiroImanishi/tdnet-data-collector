/**
 * Lambda Collect Handler Tests
 *
 * POST /collect エンド�Eイント�EユニットテスチE
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler, clearApiKeyCache } from '../handler';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mocks
const lambdaMock = mockClient(LambdaClient);
const secretsMock = mockClient(SecretsManagerClient);

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
 * チE��ト用の日付を動的に生�E
 * 現在日から相対皁E��日付を返すことで、テストが常に有効な日付篁E��を使用できるようにする
 */
const getTestDates = () => {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 7); // 7日剁E
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 2); // 2日剁E
  
  return {
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
};

/**
 * 持E��日数前�E日付を取征E
 */
const getDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

/**
 * 持E��日数後�E日付を取征E
 */
const getDaysLater = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

/**
 * テスト用のAPIGatewayProxyEventを作成
 */
const createTestEvent = (body: any, apiKey: string = 'test-api-key-12345'): APIGatewayProxyEvent => {
  return {
    body: body === null ? null : JSON.stringify(body),
    headers: {
      'x-api-key': apiKey,
    },
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
};

describe('POST /collect Handler', () => {
  beforeEach(() => {
    lambdaMock.reset();
    secretsMock.reset();
    
    // APIキーキャッシュをクリア
    clearApiKeyCache();
    
    // Secrets Managerのモック設定（APIキーを返す）
    secretsMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key-12345',
    });
    
    process.env.COLLECTOR_FUNCTION_NAME = 'tdnet-collector';
    process.env.AWS_REGION = 'ap-northeast-1';
    process.env.API_KEY_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:tdnet-api-key';
    
    // APIキーキャッシュをクリア（テスト間の影響を防ぐ）
    // Note: キャッシュはモジュールスコープにあるため、直接アクセスできない
    // 代わりに、各テストで新しいAPIキーを使用するか、TEST_ENVを設定する
    delete process.env.TEST_ENV;
    delete process.env.API_KEY;
  });

  afterEach(() => {
    delete process.env.COLLECTOR_FUNCTION_NAME;
    delete process.env.AWS_REGION;
    delete process.env.API_KEY_SECRET_ARN;
    delete process.env.TEST_ENV;
    delete process.env.API_KEY;
  });

  describe('正常系', () => {
    it('有効なリクエストで200を返す', async () => {
      // Lambda Collectorの呼び出しをモチE���E�同期呼び出し！E
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
      const event = createTestEvent(testDates);

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
      const event = createTestEvent(testDates);

      const result = await handler(event, mockContext);
      const body = JSON.parse(result.body);

      // Lambda Collectorから返されたexecution_idが使用されてぁE��ことを確誁E
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
      const event = createTestEvent(testDates);

      await handler(event, mockContext);

      // InvokeCommandが正しいパラメータで呼ばれたことを確認
      const calls = lambdaMock.commandCalls(InvokeCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input.InvocationType).toBe('RequestResponse');
      expect(calls[0].args[0].input.FunctionName).toBe('test-collector-function');
    });
  });

  describe('バリチE�Eションエラー', () => {
    it('リクエスト�EチE��がなぁE��合�E400を返す', async () => {
      const event = createTestEvent(null);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Request body is required');
    });

    it('start_dateがなぁE��合�E400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          end_date: getDaysAgo(2),
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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

    it('end_dateがなぁE��合�E400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(7),
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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

    it('start_dateのフォーマットが不正な場合�E400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: '2024/01/15', // 不正なフォーマッチE
          end_date: getDaysAgo(2),
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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

    it('start_dateが存在しなぁE��付�E場合�E400を返す', async () => {
      // 存在しなぁE��付を使用�E�E朁E0日は存在しなぁE��E
      // ただし、E年以冁E�E日付を使用する忁E��がある
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1; // 現在の朁E
      
      const event = createTestEvent({
          start_date: `${year}-02-30`, // 2朁E0日は存在しなぁE
          end_date: `${year}-03-01`,
        });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      // 日付�E整合性チェチE��で無効な日付を検�E
      expect(body.error.message).toContain('Invalid start_date');
    });

    it('start_dateがend_dateより後�E場合�E400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(2),
          end_date: getDaysAgo(7),
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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

    it('start_dateぁE年以上前の場合�E400を返す', async () => {
      const twoYearsAgo = getDaysAgo(730); // 2年剁E

      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: twoYearsAgo,
          end_date: getDaysAgo(2),
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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

    it('end_dateが未来日の場合�E400を返す', async () => {
      const twoDaysLater = getDaysLater(2); // 2日征E

      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(7),
          end_date: twoDaysLater,
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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
    it('Lambda Collectorの呼び出しに失敗した場合�E500を返す', async () => {
      lambdaMock.on(InvokeCommand).rejects(new Error('Lambda invocation failed'));

      const testDates = getTestDates();
      const event = createTestEvent(testDates);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Failed to start data collection');
    });

    it('Lambda Collectorが空のPayloadを返した場合�E500を返す', async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: undefined,
      });

      const testDates = getTestDates();
      const event = createTestEvent(testDates);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('Lambda Collectorがexecution_idを返さなぁE��合�E500を返す', async () => {
      const mockCollectorResponse = {
        status: 'success',
        message: 'Collection started',
        collected_count: 0,
        failed_count: 0,
        // execution_idがなぁE
      };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: Buffer.from(JSON.stringify(mockCollectorResponse)),
      });

      const testDates = getTestDates();
      const event = createTestEvent(testDates);

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('APIキー認証エラー', () => {
    it('APIキーヘッダーがない場合は401を返す', async () => {
      const testDates = getTestDates();
      const event = createTestEvent(testDates, '');
      delete event.headers['x-api-key'];

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
    });

    it('無効なAPIキーの場合は401を返す', async () => {
      const testDates = getTestDates();
      const event = createTestEvent(testDates, 'invalid-api-key');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
    });

    it('Secrets Manager取得エラーの場合は401を返す', async () => {
      // キャッシュをクリアするために、異なるAPIキーを使用
      // これにより、キャッシュされたAPIキーと一致しなくなり、Secrets Managerが呼び出される
      const testDates = getTestDates();
      const event = createTestEvent(testDates, 'different-api-key-to-bypass-cache');

      // Secrets Managerのモックを完全にリセットして、エラーを発生させる
      secretsMock.reset();
      secretsMock.on(GetSecretValueCommand).rejects(new Error('Secrets Manager error'));

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      // Secrets Manager取得エラーの場合は"Failed to retrieve API key"が返される
      expect(body.error.message).toContain('Failed to retrieve API key');
    });

    it('Secrets ManagerがSecretStringを返さない場合は401を返す', async () => {
      // キャッシュをクリアするために、異なるAPIキーを使用
      const testDates = getTestDates();
      const event = createTestEvent(testDates, 'another-different-api-key');

      // Secrets Managerのモックをリセットして空のレスポンスを返す
      secretsMock.reset();
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: undefined,
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      // SecretStringが空の場合は"Failed to retrieve API key"が返される
      expect(body.error.message).toContain('Failed to retrieve API key');
    });

    it('API_KEY_SECRET_ARN環境変数が設定されていない場合は401を返す', async () => {
      const originalArn = process.env.API_KEY_SECRET_ARN;
      delete process.env.API_KEY_SECRET_ARN;

      // キャッシュをクリアするために、異なるAPIキーを使用
      const testDates = getTestDates();
      const event = createTestEvent(testDates, 'yet-another-different-api-key');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      // API_KEY_SECRET_ARNが未設定の場合は"Failed to retrieve API key"が返される
      expect(body.error.message).toContain('Failed to retrieve API key');

      // 環境変数を復元
      if (originalArn) {
        process.env.API_KEY_SECRET_ARN = originalArn;
      }
    });
  });

  describe('バリデーションエラー（追加）', () => {
    it('end_dateのフォーマットが不正な場合は400を返す', async () => {
      const event: APIGatewayProxyEvent = {
        body: JSON.stringify({
          start_date: getDaysAgo(7),
          end_date: '2024/01/15', // 不正なフォーマット
        }),
        headers: {
          'x-api-key': 'test-api-key-12345',
        },
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
      expect(body.error.message).toContain('Invalid end_date format');
    });

    it('end_dateが存在しない日付の場合は400を返す', async () => {
      const today = new Date();
      const year = today.getFullYear();
      
      const event = createTestEvent({
        start_date: `${year}-02-01`,
        end_date: `${year}-02-30`, // 2月30日は存在しない
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid end_date');
    });

    it('end_dateが無効な日付（NaN）の場合は400を返す', async () => {
      const event = createTestEvent({
        start_date: getDaysAgo(7),
        end_date: '2024-13-01', // 13月は存在しない
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid end_date');
    });

    it('start_dateが無効な日付（NaN）の場合は400を返す', async () => {
      const event = createTestEvent({
        start_date: '2024-13-01', // 13月は存在しない
        end_date: getDaysAgo(2),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid start_date');
    });
  });

  describe('APIキー認証（追加）', () => {
    it('X-Api-Key（大文字）ヘッダーでも認証できる', async () => {
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
      const event = createTestEvent(testDates);
      // x-api-keyを削除してX-Api-Keyを設定
      delete event.headers['x-api-key'];
      event.headers['X-Api-Key'] = 'test-api-key-12345';

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
    });
  });

  describe('Secrets Managerエラーハンドリング', () => {
    beforeEach(() => {
      // TEST_ENV='test'を設定してキャッシュを無効化
      process.env.TEST_ENV = 'test';
      delete process.env.API_KEY;
      
      // API_KEY_SECRET_ARNを設定
      process.env.API_KEY_SECRET_ARN = 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:tdnet-api-key';
      
      // Secrets Managerモックをリセット
      secretsMock.reset();
    });

    afterEach(() => {
      // 環境変数を復元
      process.env.TEST_ENV = 'e2e';
      process.env.API_KEY = 'test-api-key-12345';
      
      // Secrets Managerモックを復元
      secretsMock.reset();
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test-api-key-12345',
      });
    });

    it('SecretStringが空の場合は401エラーを返す', async () => {
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: '', // 空文字列
      });

      const testDates = getTestDates();
      // 異なるAPIキーを使用してキャッシュをバイパス
      const event = createTestEvent(testDates, 'unique-key-for-empty-secret-test');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Failed to retrieve API key');
    });

    it('Secrets Manager取得エラーの場合は401エラーを返す', async () => {
      secretsMock.on(GetSecretValueCommand).rejects(
        new Error('AccessDeniedException: User is not authorized')
      );

      const testDates = getTestDates();
      // 異なるAPIキーを使用してキャッシュをバイパス
      const event = createTestEvent(testDates, 'unique-key-for-access-denied-test');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Failed to retrieve API key');
    });

    it('Secrets Managerネットワークエラーの場合は401エラーを返す', async () => {
      secretsMock.on(GetSecretValueCommand).rejects(
        new Error('NetworkingError: Connection timeout')
      );

      const testDates = getTestDates();
      // 異なるAPIキーを使用してキャッシュをバイパス
      const event = createTestEvent(testDates, 'unique-key-for-network-error-test');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('APIキーキャッシュ', () => {
    beforeEach(() => {
      // キャッシュをクリア
      delete process.env.TEST_ENV;
      delete process.env.API_KEY;
      
      // Secrets Managerモックをリセット
      secretsMock.reset();
      secretsMock.on(GetSecretValueCommand).resolves({
        SecretString: 'test-api-key-12345',
      });
    });

    it('TEST_ENV=e2eの場合はAPI_KEY環境変数から取得する', async () => {
      // TEST_ENV=e2eを設定
      process.env.TEST_ENV = 'e2e';
      process.env.API_KEY = 'e2e-test-api-key';

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
      const event = createTestEvent(testDates, 'e2e-test-api-key');

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      
      // Secrets Managerが呼ばれていないことを確認
      const secretsCalls = secretsMock.commandCalls(GetSecretValueCommand);
      expect(secretsCalls.length).toBe(0);
    });

    it('キャッシュが有効な場合はSecrets Managerを呼ばない', async () => {
      // テスト環境でキャッシュを有効化するため、NODE_ENVを一時的に変更
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        // 最初のリクエスト（キャッシュミス）
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
        const event1 = createTestEvent(testDates, 'test-api-key-12345');

        await handler(event1, mockContext);

        // Secrets Managerが1回呼ばれたことを確認
        let secretsCalls = secretsMock.commandCalls(GetSecretValueCommand);
        expect(secretsCalls.length).toBe(1);

        // 2回目のリクエスト（キャッシュヒット）
        // モックをリセットして、呼ばれないことを確認
        secretsMock.reset();
        secretsMock.on(GetSecretValueCommand).resolves({
          SecretString: 'test-api-key-12345',
        });

        const event2 = createTestEvent(testDates, 'test-api-key-12345');
        await handler(event2, mockContext);

        // Secrets Managerが呼ばれていないことを確認（キャッシュから取得）
        secretsCalls = secretsMock.commandCalls(GetSecretValueCommand);
        expect(secretsCalls.length).toBe(0);
      } finally {
        // NODE_ENVを元に戻す
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});

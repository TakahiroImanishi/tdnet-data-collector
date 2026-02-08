/**
 * Lambda Query Handler E2E Tests
 *
 * Property 9: APIキー認証の必須性
 *
 * Requirements: 要件11.3, 14.4（E2Eテスト、API認証）
 *
 * このE2Eテストは、LocalStack環境または開発環境で実行され、
 * 実際のAWS SDKクライアントを使用してAPIキー認証を検証します。
 */

import { Context, APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handler';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Disclosure } from '../../../types';

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

describe('Lambda Query Handler E2E Tests - Property 9: API Key Authentication', () => {
  let mockContext: Context;
  let mockEvent: APIGatewayProxyEvent;
  const tableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet-disclosures-local';

  beforeAll(async () => {
    // テストデータをDynamoDBに挿入
    const testDisclosure: Disclosure = {
      disclosure_id: 'TD20240115001',
      company_code: '7203',
      company_name: 'トヨタ自動車',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-15T10:30:00Z',
      pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
      s3_key: '2024/01/15/TD20240115001_7203.pdf',
      collected_at: '2024-01-15T10:35:00Z',
      date_partition: '2024-01',
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: testDisclosure,
        })
      );
      console.log('Test data inserted successfully');
    } catch (error) {
      console.error('Failed to insert test data:', error);
      throw error;
    }
  });

  beforeEach(() => {
    // モックコンテキスト
    mockContext = {
      awsRequestId: 'test-request-id-e2e',
      functionName: 'tdnet-query-e2e',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-query-e2e',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/tdnet-query-e2e',
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
      path: '/disclosures',
      pathParameters: null,
      queryStringParameters: null,
      multiValueQueryStringParameters: null,
      stageVariables: null,
      requestContext: {
        accountId: '123456789012',
        apiId: 'test-api-id-e2e',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/disclosures',
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
        resourcePath: '/disclosures',
      },
      resource: '/disclosures',
    };

    // 環境変数設定
    process.env.API_KEY = 'test-api-key-e2e';
    process.env.DYNAMODB_TABLE_NAME = tableName;
    process.env.S3_BUCKET_NAME = 'tdnet-pdfs-local';
  });

  describe('Property 9.1: 無効なAPIキーで401 Unauthorizedが返される', () => {
    it('無効なAPIキーの場合は401エラーを返す', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'invalid-api-key',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('UNAUTHORIZED');
      expect(body.message).toContain('Invalid API key');
      expect(body.request_id).toBe(mockContext.awsRequestId);

      // CORSヘッダーの確認
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('APIキーが未設定の場合は401エラーを返す', async () => {
      // Arrange
      mockEvent.headers = {}; // APIキーなし

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('UNAUTHORIZED');
      expect(body.message).toContain('API key is required');
      expect(body.request_id).toBe(mockContext.awsRequestId);

      // CORSヘッダーの確認
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('大文字小文字が異なるヘッダー名でも認証が機能する', async () => {
      // Arrange
      mockEvent.headers = {
        'X-Api-Key': 'invalid-api-key', // 大文字
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('UNAUTHORIZED');
      expect(body.message).toContain('Invalid API key');
    });
  });

  describe('Property 9.2: 有効なAPIキーで正常にレスポンスが返される', () => {
    it('有効なAPIキーで認証成功し、データが取得できる', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        company_code: '7203',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('application/json');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('disclosures');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('count');
      expect(body).toHaveProperty('offset');
      expect(body).toHaveProperty('limit');

      // データの検証
      expect(Array.isArray(body.disclosures)).toBe(true);
      if (body.disclosures.length > 0) {
        const disclosure = body.disclosures[0];
        expect(disclosure).toHaveProperty('disclosure_id');
        expect(disclosure).toHaveProperty('company_code');
        expect(disclosure).toHaveProperty('company_name');
        expect(disclosure).toHaveProperty('disclosed_at');
      }
    });

    it('有効なAPIキーで日付範囲検索が機能する', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        start_date: '2024-01-15',
        end_date: '2024-01-20',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('disclosures');
      expect(body).toHaveProperty('total');
    });

    it('有効なAPIキーでCSV形式のレスポンスが取得できる', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        format: 'csv',
        company_code: '7203',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.headers['Content-Type']).toBe('text/csv');
      expect(result.headers['Content-Disposition']).toContain('attachment');
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');

      // CSVヘッダーの確認
      expect(result.body).toContain('disclosure_id');
      expect(result.body).toContain('company_code');
      expect(result.body).toContain('company_name');
    });
  });

  describe('Property 9.3: APIキー認証とバリデーションの組み合わせ', () => {
    it('有効なAPIキーでも不正なクエリパラメータは400エラーを返す', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        company_code: '123', // 4桁でない
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid company_code');
    });

    it('有効なAPIキーでも不正な日付形式は400エラーを返す', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        start_date: '2024/01/15', // YYYY-MM-DD形式でない
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('Invalid start_date format');
    });

    it('有効なAPIキーでも開始日が終了日より後の場合は400エラーを返す', async () => {
      // Arrange
      mockEvent.headers = {
        'x-api-key': 'test-api-key-e2e',
      };
      mockEvent.queryStringParameters = {
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error_code).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('start_date');
      expect(body.message).toContain('must be before or equal to');
      expect(body.message).toContain('end_date');
    });
  });

  describe('Property 9.4: エラーレスポンスの一貫性', () => {
    it('すべてのエラーレスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange: APIキーなし
      mockEvent.headers = {};

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('すべてのエラーレスポンスにrequest_idが含まれる', async () => {
      // Arrange: 無効なAPIキー
      mockEvent.headers = {
        'x-api-key': 'invalid-api-key',
      };

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.request_id).toBe(mockContext.awsRequestId);
    });

    it('エラーレスポンスの構造が一貫している', async () => {
      // Arrange: APIキーなし
      mockEvent.headers = {};

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('error_code');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('request_id');
      expect(typeof body.error_code).toBe('string');
      expect(typeof body.message).toBe('string');
      expect(typeof body.request_id).toBe('string');
    });
  });
});

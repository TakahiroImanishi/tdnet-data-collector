/**
 * Date Range Validation Property Tests
 *
 * Property 8: 日付範囲の順序性
 * Validates: Requirements 5.2
 *
 * 開始日が終了日より後の場合はバリデーションエラーを返すことを検証
 *
 * Requirements: 要件14.2（プロパティテスト）
 */

import * as fc from 'fast-check';
import { Context, APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handler';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

// モック
jest.mock('../query-disclosures');
jest.mock('../format-csv');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/cloudwatch-metrics');

// Secrets Managerモック
const secretsManagerMock = mockClient(SecretsManagerClient);

describe('Property 8: 日付範囲の順序性', () => {
  let mockContext: Context;
  let baseEvent: APIGatewayProxyEvent;

  beforeEach(() => {
    // Secrets Managerモックのセットアップ
    secretsManagerMock.reset();
    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key',
    });

    // モックコンテキスト
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'tdnet-query',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-query',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/tdnet-query',
      logStreamName: '2024/01/15/[$LATEST]abcdef',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // ベースイベント
    baseEvent = {
      body: null,
      headers: {
        'x-api-key': 'test-api-key',
      },
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
        apiId: 'test-api-id',
        protocol: 'HTTP/1.1',
        httpMethod: 'GET',
        path: '/disclosures',
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
        resourcePath: '/disclosures',
      },
      resource: '/disclosures',
    };

    // 環境変数設定
    process.env.API_KEY = 'test-api-key';
    process.env.DYNAMODB_TABLE_NAME = 'tdnet_disclosures';
    process.env.S3_BUCKET_NAME = 'tdnet-pdfs';

    jest.clearAllMocks();
  });

  /**
   * 日付文字列生成（YYYY-MM-DD形式）
   */
  const dateArbitrary = fc.date({
    min: new Date('2020-01-01'),
    max: new Date('2025-12-31'),
  }).map((date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  it('Property 8.1: 開始日が終了日より後の場合は必ずバリデーションエラー', async () => {
    await fc.assert(
      fc.asyncProperty(dateArbitrary, dateArbitrary, async (date1, date2) => {
        // date1 > date2 となるペアのみテスト
        if (date1 <= date2) {
          return true; // スキップ
        }

        const event = {
          ...baseEvent,
          queryStringParameters: {
            start_date: date1, // 後の日付
            end_date: date2, // 前の日付
          },
        };

        const result = await handler(event, mockContext);

        // バリデーションエラー（400）が返されることを確認
        expect(result.statusCode).toBe(400);

        const body = JSON.parse(result.body);
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toContain('start_date');
        expect(body.error.message).toContain('must be before or equal to');
        expect(body.error.message).toContain('end_date');

        return true;
      }),
      { numRuns: 1000 } // 1000回反復実行
    );
  });

  it('Property 8.2: 開始日が終了日と同じ場合は成功', async () => {
    await fc.assert(
      fc.asyncProperty(dateArbitrary, async (date) => {
        const event = {
          ...baseEvent,
          queryStringParameters: {
            start_date: date,
            end_date: date, // 同じ日付
          },
        };

        const result = await handler(event, mockContext);

        // バリデーションエラーではないことを確認（200または500）
        expect(result.statusCode).not.toBe(400);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  it('Property 8.3: 開始日が終了日より前の場合は成功', async () => {
    await fc.assert(
      fc.asyncProperty(dateArbitrary, dateArbitrary, async (date1, date2) => {
        // date1 < date2 となるペアのみテスト
        if (date1 >= date2) {
          return true; // スキップ
        }

        const event = {
          ...baseEvent,
          queryStringParameters: {
            start_date: date1, // 前の日付
            end_date: date2, // 後の日付
          },
        };

        const result = await handler(event, mockContext);

        // バリデーションエラーではないことを確認
        expect(result.statusCode).not.toBe(400);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  describe('エッジケース', () => {
    it('月またぎの日付範囲', async () => {
      const event = {
        ...baseEvent,
        queryStringParameters: {
          start_date: '2024-01-31',
          end_date: '2024-02-01',
        },
      };

      const result = await handler(event, mockContext);

      // バリデーションエラーではないことを確認
      expect(result.statusCode).not.toBe(400);
    });

    it('年またぎの日付範囲', async () => {
      const event = {
        ...baseEvent,
        queryStringParameters: {
          start_date: '2023-12-31',
          end_date: '2024-01-01',
        },
      };

      const result = await handler(event, mockContext);

      // バリデーションエラーではないことを確認
      expect(result.statusCode).not.toBe(400);
    });

    it('うるう年の2月29日', async () => {
      const event = {
        ...baseEvent,
        queryStringParameters: {
          start_date: '2024-02-29', // うるう年
          end_date: '2024-03-01',
        },
      };

      const result = await handler(event, mockContext);

      // バリデーションエラーではないことを確認
      expect(result.statusCode).not.toBe(400);
    });

    it('非うるう年の2月29日はバリデーションエラー', async () => {
      const event = {
        ...baseEvent,
        queryStringParameters: {
          start_date: '2023-02-29', // 非うるう年
          end_date: '2023-03-01',
        },
      };

      const result = await handler(event, mockContext);

      // バリデーションエラー（存在しない日付）
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Date does not exist');
    });
  });
});

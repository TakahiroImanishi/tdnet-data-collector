/**
 * Lambda Query Handler Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

import { Context, APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handler';
import * as queryDisclosures from '../query-disclosures';
import * as formatCsv from '../format-csv';
import { Disclosure } from '../../../types';

// モック
jest.mock('../query-disclosures');
jest.mock('../format-csv');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/cloudwatch-metrics');

describe('Lambda Query Handler', () => {
  let mockContext: Context;
  let mockEvent: APIGatewayProxyEvent;

  beforeEach(() => {
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

    // モックイベント（基本）
    mockEvent = {
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
    process.env.TEST_ENV = 'e2e'; // テスト環境として設定
    process.env.API_KEY = 'test-api-key';
    process.env.DYNAMODB_TABLE_NAME = 'tdnet_disclosures';
    process.env.S3_BUCKET_NAME = 'tdnet-pdfs';

    // モックのリセット
    jest.clearAllMocks();
  });

  describe('APIキー認証', () => {
    it('有効なAPIキーで認証成功', async () => {
      const mockDisclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '7203',
          company_name: 'トヨタ自動車',
          disclosure_type: '決算短信',
          title: '2024年3月期 第3四半期決算短信',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://www.release.tdnet.info/...',
          pdf_s3_key: '2024/01/15/TD20240115001_7203.pdf',
          downloaded_at: '2024-01-15T10:35:00Z',
          date_partition: '2024-01',
        },
      ];

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: mockDisclosures,
        total: 1,
        count: 1,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({
        disclosures: mockDisclosures,
        total: 1,
        count: 1,
        offset: 0,
        limit: 100,
      });
    });

    it('APIキーが未設定の場合は401エラー', async () => {
      mockEvent.headers = {};

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
      expect(body.request_id).toBe('test-request-id');
    });

    it('無効なAPIキーの場合は401エラー', async () => {
      mockEvent.headers = {
        'x-api-key': 'invalid-api-key',
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
      expect(body.request_id).toBe('test-request-id');
    });
  });

  describe('クエリパラメータのバリデーション', () => {
    it('企業コードでフィルタリング', async () => {
      mockEvent.queryStringParameters = {
        company_code: '7203',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          company_code: '7203',
        })
      );
    });

    it('日付範囲でフィルタリング', async () => {
      mockEvent.queryStringParameters = {
        start_date: '2024-01-15',
        end_date: '2024-01-20',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          start_date: '2024-01-15',
          end_date: '2024-01-20',
        })
      );
    });

    it('不正な企業コード形式でバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        company_code: '123', // 4桁でない
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid company_code');
      expect(body.request_id).toBe('test-request-id');
    });

    it('不正な日付形式でバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        start_date: '2024/01/15', // YYYY-MM-DD形式でない
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid start_date format');
      expect(body.request_id).toBe('test-request-id');
    });

    it('存在しない日付でバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        start_date: '2024-13-01', // 存在しない月
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Date does not exist');
      expect(body.request_id).toBe('test-request-id');
    });

    it('開始日が終了日より後の場合はバリデーションエラー（Property 8）', async () => {
      mockEvent.queryStringParameters = {
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('start_date');
      expect(body.error.message).toContain('must be before or equal to');
      expect(body.error.message).toContain('end_date');
      expect(body.request_id).toBe('test-request-id');
    });

    it('limitのバリデーション（範囲内）', async () => {
      mockEvent.queryStringParameters = {
        limit: '50',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 50,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });

    it('limitが範囲外の場合はバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        limit: '2000', // 最大1000を超える
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid limit');
      expect(body.request_id).toBe('test-request-id');
    });

    it('offsetのバリデーション', async () => {
      mockEvent.queryStringParameters = {
        offset: '100',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 100,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          offset: 100,
        })
      );
    });

    it('offsetが負の数の場合はバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        offset: '-10',
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid offset');
      expect(body.request_id).toBe('test-request-id');
    });

    it('monthパラメータでフィルタリング', async () => {
      mockEvent.queryStringParameters = {
        month: '2024-01',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          month: '2024-01',
          start_date: undefined,
          end_date: undefined,
        })
      );
    });

    it('monthが指定された場合、start_dateとend_dateは無視される', async () => {
      mockEvent.queryStringParameters = {
        month: '2024-01',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      };

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(queryDisclosures.queryDisclosures).toHaveBeenCalledWith(
        expect.objectContaining({
          month: '2024-01',
          start_date: undefined,
          end_date: undefined,
        })
      );
    });

    it('不正なmonth形式でバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        month: '2024/01', // YYYY-MM形式でない
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid month format');
      expect(body.request_id).toBe('test-request-id');
    });

    it('monthの月が範囲外の場合はバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        month: '2024-13', // 13月は存在しない
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Month must be between 01 and 12');
      expect(body.request_id).toBe('test-request-id');
    });

    it('monthの年が範囲外の場合はバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        month: '1899-01', // 1900年未満
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Year must be between 1900 and 2100');
      expect(body.request_id).toBe('test-request-id');
    });
  });

  describe('レスポンス形式', () => {
    it('JSON形式（デフォルト）', async () => {
      const mockDisclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '7203',
          company_name: 'トヨタ自動車',
          disclosure_type: '決算短信',
          title: '2024年3月期 第3四半期決算短信',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://www.release.tdnet.info/...',
          pdf_s3_key: '2024/01/15/TD20240115001_7203.pdf',
          downloaded_at: '2024-01-15T10:35:00Z',
          date_partition: '2024-01',
        },
      ];

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: mockDisclosures,
        total: 1,
        count: 1,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers!['Content-Type']).toBe('application/json');
      expect(JSON.parse(result.body)).toEqual({
        disclosures: mockDisclosures,
        total: 1,
        count: 1,
        offset: 0,
        limit: 100,
      });
    });

    it('CSV形式', async () => {
      mockEvent.queryStringParameters = {
        format: 'csv',
      };

      const mockDisclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '7203',
          company_name: 'トヨタ自動車',
          disclosure_type: '決算短信',
          title: '2024年3月期 第3四半期決算短信',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://www.release.tdnet.info/...',
          pdf_s3_key: '2024/01/15/TD20240115001_7203.pdf',
          downloaded_at: '2024-01-15T10:35:00Z',
          date_partition: '2024-01',
        },
      ];

      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: mockDisclosures,
        total: 1,
        count: 1,
        offset: 0,
        limit: 100,
      });

      (formatCsv.formatAsCsv as jest.Mock).mockReturnValue(
        'disclosure_id,company_code,company_name,...\nTD20240115001,7203,トヨタ自動車,...'
      );

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(result.headers!['Content-Type']).toBe('text/csv');
      expect(result.headers!['Content-Disposition']).toContain('attachment');
      expect(result.body).toContain('disclosure_id,company_code');
    });

    it('不正なフォーマット指定でバリデーションエラー', async () => {
      mockEvent.queryStringParameters = {
        format: 'xml', // サポートされていない形式
      };

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid format');
      expect(body.request_id).toBe('test-request-id');
    });
  });

  describe('CORS対応', () => {
    it('すべてのレスポンスにCORSヘッダーが含まれる', async () => {
      (queryDisclosures.queryDisclosures as jest.Mock).mockResolvedValue({
        disclosures: [],
        total: 0,
        count: 0,
        offset: 0,
        limit: 100,
      });

      const result = await handler(mockEvent, mockContext);

      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });

    it('エラーレスポンスにもCORSヘッダーが含まれる', async () => {
      mockEvent.headers = {}; // APIキーなし

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(401);
      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('エラーハンドリング', () => {
    it('内部エラーは500エラーとして返却', async () => {
      (queryDisclosures.queryDisclosures as jest.Mock).mockRejectedValue(
        new Error('Internal error')
      );

      const result = await handler(mockEvent, mockContext);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toBe('Internal error');
      expect(body.request_id).toBe('test-request-id');
    });

    it('本番環境ではスタックトレースを含めない', async () => {
      process.env.NODE_ENV = 'production';

      (queryDisclosures.queryDisclosures as jest.Mock).mockRejectedValue(
        new Error('Internal error')
      );

      const result = await handler(mockEvent, mockContext);

      const body = JSON.parse(result.body);
      expect(body.error.stack).toBeUndefined();

      delete process.env.NODE_ENV;
    });
  });

  describe('異常系: queryDisclosures失敗', () => {
    it('queryDisclosuresが失敗した場合は500エラーを返す', async () => {
      // Arrange
      (queryDisclosures.queryDisclosures as jest.Mock).mockRejectedValue(
        new Error('DynamoDB query failed')
      );

      // Act
      const result = await handler(mockEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).error.code).toBe('INTERNAL_ERROR');
      expect(JSON.parse(result.body).error.message).toContain('DynamoDB query failed');
    });
  });
});

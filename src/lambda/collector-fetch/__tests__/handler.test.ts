/**
 * Lambda Collector-Fetch Handler Unit Tests
 *
 * collector-fetch Lambda関数のユニットテスト。
 * モックを使用してTDnet APIとの連携をテストします。
 */

import { Context } from 'aws-lambda';
import { handler, FetchEvent, FetchResponse } from '../handler';
import { ValidationError, RetryableError } from '../../../errors';
import { DisclosureMetadata } from '../../../scraper/html-parser';
import axios from 'axios';
import * as iconv from 'iconv-lite';

// モック設定
jest.mock('axios');
jest.mock('iconv-lite');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/cloudwatch-metrics');
jest.mock('../../../scraper/html-parser');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedIconv = iconv as jest.Mocked<typeof iconv>;

// parseDisclosureListのモック
const { parseDisclosureList } = require('../../../scraper/html-parser');

describe('Lambda Collector-Fetch Handler', () => {
  let mockContext: Context;

  beforeEach(() => {
    // Lambda Contextのモック
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'collector-fetch',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:collector-fetch',
      memoryLimitInMB: '512',
      logGroupName: '/aws/lambda/collector-fetch',
      logStreamName: '2024/01/15/[$LATEST]test',
      getRemainingTimeInMillis: () => 30000,
      callbackWaitsForEmptyEventLoop: true,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // モックのリセット
    jest.clearAllMocks();

    // デフォルトのモック設定
    mockedIconv.decode.mockReturnValue('<html>mock html</html>');
  });

  describe('正常系', () => {
    it('1ページ分のデータを正常に取得できる', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [
        {
          company_code: '1234',
          company_name: 'テスト株式会社',
          disclosure_type: '決算短信',
          title: '2024年3月期 決算短信',
          disclosed_at: '2024-01-15T09:00:00+09:00',
          pdf_url: 'https://www.release.tdnet.info/inbs/test.pdf',
        },
        {
          company_code: '5678',
          company_name: 'サンプル株式会社',
          disclosure_type: '業績予想の修正',
          title: '業績予想の修正に関するお知らせ',
          disclosed_at: '2024-01-15T10:00:00+09:00',
          pdf_url: 'https://www.release.tdnet.info/inbs/test2.pdf',
        },
      ];

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('<html>mock html</html>'),
      });

      parseDisclosureList.mockReturnValue(mockDisclosures);

      // Act
      const response: FetchResponse = await handler(event, mockContext);

      // Assert
      expect(response).toEqual({
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        items: mockDisclosures,
        count: 2,
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.release.tdnet.info/inbs/I_list_001_20240115.html',
        expect.objectContaining({
          timeout: 30000,
          responseType: 'arraybuffer',
        })
      );

      expect(parseDisclosureList).toHaveBeenCalledWith('<html>mock html</html>', '2024-01-15');
    });

    it('2ページ目のデータを正常に取得できる', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_456',
        page_number: '2024-01-16',
        start_date: '2024-01-15',
        end_date: '2024-01-16',
      };

      const mockDisclosures: DisclosureMetadata[] = [
        {
          company_code: '9999',
          company_name: 'テスト2株式会社',
          disclosure_type: '決算短信',
          title: '2024年3月期 決算短信',
          disclosed_at: '2024-01-15T11:00:00+09:00',
          pdf_url: 'https://www.release.tdnet.info/inbs/test3.pdf',
        },
      ];

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('<html>mock html page 2</html>'),
      });

      parseDisclosureList.mockReturnValue(mockDisclosures);

      // Act
      const response: FetchResponse = await handler(event, mockContext);

      // Assert
      expect(response.page_number).toBe('2024-01-16');
      expect(response.count).toBe(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.release.tdnet.info/inbs/I_list_001_20240116.html',
        expect.any(Object)
      );
    });

    it('開示情報が0件の場合も正常に処理できる', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_789',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('<html>empty page</html>'),
      });

      parseDisclosureList.mockReturnValue([]);

      // Act
      const response: FetchResponse = await handler(event, mockContext);

      // Assert
      expect(response.count).toBe(0);
      expect(response.items).toEqual([]);
    });
  });

  describe('バリデーション', () => {
    it('execution_idが空の場合はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: '',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('Invalid execution_id');
    });

    it('page_numberが不正な形式の場合はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: 'invalid',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('Invalid page_number');
    });

    it('start_dateのフォーマットが不正な場合はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024/01/15', // スラッシュ区切り
        end_date: '2024-01-15',
      };

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('Invalid start_date format');
    });

    it('end_dateのフォーマットが不正な場合はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '20240115', // ハイフンなし
      };

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('Invalid end_date format');
    });

    it('start_dateがend_dateより後の場合はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-20',
        end_date: '2024-01-15',
      };

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('must be before or equal to');
    });
  });

  describe('エラーハンドリング', () => {
    it('ネットワークエラー時はRetryableErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const networkError = new Error('Network error') as any;
      networkError.code = 'ECONNRESET';
      mockedAxios.get.mockRejectedValue(networkError);

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(RetryableError);
      await expect(handler(event, mockContext)).rejects.toThrow('Network error');
    });

    it('タイムアウトエラー時はRetryableErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const timeoutError = new Error('timeout of 30000ms exceeded') as any;
      timeoutError.code = 'ECONNABORTED';
      mockedAxios.get.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(RetryableError);
      await expect(handler(event, mockContext)).rejects.toThrow('Request timeout');
    });

    it('5xxエラー時はRetryableErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const serverError = {
        response: {
          status: 503,
          statusText: 'Service Unavailable',
        },
      } as any;
      mockedAxios.get.mockRejectedValue(serverError);

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(RetryableError);
      await expect(handler(event, mockContext)).rejects.toThrow('Server error: 503');
    });

    it('429エラー時はRetryableErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const rateLimitError = {
        response: {
          status: 429,
          statusText: 'Too Many Requests',
        },
      } as any;
      mockedAxios.get.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(RetryableError);
      await expect(handler(event, mockContext)).rejects.toThrow('Rate limit exceeded');
    });

    it('404エラー時はValidationErrorをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const notFoundError = {
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      } as any;
      mockedAxios.get.mockRejectedValue(notFoundError);

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow(ValidationError);
      await expect(handler(event, mockContext)).rejects.toThrow('TDnet page not found');
    });
  });

  describe('レート制限', () => {
    it('連続リクエスト時にレート制限が適用される', async () => {
      // Arrange
      const event1: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const event2: FetchEvent = {
        execution_id: 'exec_123',
        page_number: '2024-01-16',
        start_date: '2024-01-15',
        end_date: '2024-01-16',
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: Buffer.from('<html>mock html</html>'),
      });

      parseDisclosureList.mockReturnValue([]);

      // Act
      const startTime = Date.now();
      await handler(event1, mockContext);
      await handler(event2, mockContext);
      const duration = Date.now() - startTime;

      // Assert
      // 2回目のリクエストは2秒待機するため、合計2秒以上かかる
      expect(duration).toBeGreaterThanOrEqual(2000);
    });
  });
});

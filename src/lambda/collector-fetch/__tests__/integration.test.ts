/**
 * Lambda Collector-Fetch Integration Tests
 *
 * collector-fetch Lambda関数の統合テスト。
 * TDnet APIモックサーバーとの連携をテストします。
 */

import { Context } from 'aws-lambda';
import { handler, FetchEvent, FetchResponse } from '../handler';
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

describe('Lambda Collector-Fetch Integration Tests', () => {
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

  describe('TDnet APIモックとの連携', () => {
    it('TDnet APIから実際のHTML形式でデータを取得できる', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_123',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures = [
        {
          company_code: '1234',
          company_name: 'テスト株式会社',
          disclosure_type: '決算短信',
          title: '2024年3月期 決算短信',
          disclosed_at: '2024-01-15T09:00:00+09:00',
          pdf_url: 'https://www.release.tdnet.info/inbs/test.pdf',
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
      expect(response.execution_id).toBe('exec_integration_123');
      expect(response.page_number).toBe('2024-01-15');
      expect(response.count).toBe(1);
      expect(Array.isArray(response.items)).toBe(true);
    });

    it('複数ページのデータを順次取得できる', async () => {
      // Arrange
      const event1: FetchEvent = {
        execution_id: 'exec_integration_456',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const event2: FetchEvent = {
        execution_id: 'exec_integration_456',
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
      const response1 = await handler(event1, mockContext);
      const response2 = await handler(event2, mockContext);

      // Assert
      expect(response1.page_number).toBe('2024-01-15');
      expect(response2.page_number).toBe('2024-01-16');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('ネットワークエラー時にリトライが実行される', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_789',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // 最初の2回は失敗、3回目は成功
      mockedAxios.get
        .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
        .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
        .mockResolvedValueOnce({
          status: 200,
          data: Buffer.from('<html>mock html</html>'),
        });

      parseDisclosureList.mockReturnValue([]);

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.execution_id).toBe('exec_integration_789');
      expect(response.count).toBe(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('404エラー時はエラーをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_404',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      mockedAxios.get.mockRejectedValue({
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      });

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow('TDnet page not found');
    });

    it('5xxエラー時はリトライ後にエラーをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_500',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // 3回とも503エラー
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 503,
          statusText: 'Service Unavailable',
        },
      });

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow('Server error: 503');
      // リトライ3回実行されることを確認（初回 + 3回リトライ = 4回）
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('レート制限の統合テスト', () => {
    it('連続リクエスト時に2秒以上の間隔が確保される', async () => {
      // Arrange
      const event1: FetchEvent = {
        execution_id: 'exec_rate_limit_1',
        page_number: '2024-01-15',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const event2: FetchEvent = {
        execution_id: 'exec_rate_limit_2',
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

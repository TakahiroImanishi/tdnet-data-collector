/**
 * Lambda Collector-Fetch Integration Tests
 *
 * collector-fetch Lambda関数の統合テスト。
 * TDnet APIモックサーバーとの連携をテストします。
 */

import { Context } from 'aws-lambda';
import { handler, FetchEvent, FetchResponse } from '../handler';
import nock from 'nock';

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

    // nockのクリーンアップ
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('TDnet APIモックサーバーとの連携', () => {
    it('TDnet APIから実際のHTML形式でデータを取得できる', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_123',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // TDnet APIのモックレスポンス（簡略版HTML）
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr>
                <td>09:00</td>
                <td><a href="/inbs/test.pdf">1234</a></td>
                <td>テスト株式会社</td>
                <td>決算短信</td>
                <td>2024年3月期 決算短信</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      // Shift_JISエンコード（実際のTDnetはShift_JIS）
      const iconv = require('iconv-lite');
      const shiftJisBuffer = iconv.encode(mockHtml, 'shift_jis');

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .reply(200, shiftJisBuffer, {
          'Content-Type': 'text/html; charset=Shift_JIS',
        });

      // Act
      const response: FetchResponse = await handler(event, mockContext);

      // Assert
      expect(response.execution_id).toBe('exec_integration_123');
      expect(response.page_number).toBe(1);
      expect(response.count).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(response.items)).toBe(true);
    });

    it('複数ページのデータを順次取得できる', async () => {
      // Arrange
      const event1: FetchEvent = {
        execution_id: 'exec_integration_456',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const event2: FetchEvent = {
        execution_id: 'exec_integration_456',
        page_number: 2,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockHtml1 = '<html><body><table></table></body></html>';
      const mockHtml2 = '<html><body><table></table></body></html>';

      const iconv = require('iconv-lite');

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .reply(200, iconv.encode(mockHtml1, 'shift_jis'));

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_002_20240115.html')
        .reply(200, iconv.encode(mockHtml2, 'shift_jis'));

      // Act
      const response1 = await handler(event1, mockContext);
      const response2 = await handler(event2, mockContext);

      // Assert
      expect(response1.page_number).toBe(1);
      expect(response2.page_number).toBe(2);
    });

    it('ネットワークエラー時にリトライが実行される', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_789',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockHtml = '<html><body><table></table></body></html>';
      const iconv = require('iconv-lite');

      // 最初の2回は失敗、3回目は成功
      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .replyWithError({ code: 'ECONNRESET', message: 'Connection reset' });

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .replyWithError({ code: 'ECONNRESET', message: 'Connection reset' });

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .reply(200, iconv.encode(mockHtml, 'shift_jis'));

      // Act
      const response = await handler(event, mockContext);

      // Assert
      expect(response.execution_id).toBe('exec_integration_789');
      expect(response.count).toBeGreaterThanOrEqual(0);
    });

    it('404エラー時はエラーをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_404',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .reply(404, 'Not Found');

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow('TDnet page not found');
    });

    it('5xxエラー時はリトライ後にエラーをスロー', async () => {
      // Arrange
      const event: FetchEvent = {
        execution_id: 'exec_integration_500',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      // 3回とも503エラー
      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .times(3)
        .reply(503, 'Service Unavailable');

      // Act & Assert
      await expect(handler(event, mockContext)).rejects.toThrow('Server error: 503');
    });
  });

  describe('レート制限の統合テスト', () => {
    it('連続リクエスト時に2秒以上の間隔が確保される', async () => {
      // Arrange
      const event1: FetchEvent = {
        execution_id: 'exec_rate_limit_1',
        page_number: 1,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const event2: FetchEvent = {
        execution_id: 'exec_rate_limit_2',
        page_number: 2,
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockHtml = '<html><body><table></table></body></html>';
      const iconv = require('iconv-lite');

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_20240115.html')
        .reply(200, iconv.encode(mockHtml, 'shift_jis'));

      nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_002_20240115.html')
        .reply(200, iconv.encode(mockHtml, 'shift_jis'));

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

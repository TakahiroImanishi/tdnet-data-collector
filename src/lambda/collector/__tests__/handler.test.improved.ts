/**
 * Lambda Collector Handler - Improved Unit Tests
 *
 * このファイルは、DI パターンと aws-sdk-client-mock を使用した改善版テストの例です。
 * 既存の handler.test.ts を置き換える際の参考にしてください。
 *
 * Requirements: テスト環境の整備（Task 9.4）
 */

import { Context } from 'aws-lambda';
import { handler, CollectorEvent } from '../handler';
import { scrapeTdnetList } from '../scrape-tdnet-list';
import {
  setupTestDependencies,
  cleanupTestDependencies,
  dynamoMock,
  s3Mock,
  // cloudWatchMock, // Unused but may be needed for future tests
  mockPutDisclosure,
  mockUpdateExecutionStatus,
  mockPutPdf,
} from './test-helpers';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';

// Mock dependencies
jest.mock('../scrape-tdnet-list');
const mockScrapeTdnetList = scrapeTdnetList as jest.MockedFunction<typeof scrapeTdnetList>;

describe('Lambda Collector Handler - Improved Tests', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();

    // テスト用依存関係をセットアップ（DI + aws-sdk-client-mock）
    setupTestDependencies();

    // Mock Lambda Context
    mockContext = {
      awsRequestId: 'test-request-id-12345',
      functionName: 'test-collector-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '512',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2024/01/15/[$LATEST]test',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
      callbackWaitsForEmptyEventLoop: true,
    };

    // 環境変数を設定
    process.env.DYNAMODB_TABLE = 'test-disclosures-table';
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
    process.env.S3_BUCKET = 'test-pdfs-bucket';
    process.env.LOG_LEVEL = 'error'; // テスト時はエラーログのみ
  });

  afterEach(() => {
    // テスト用依存関係をクリーンアップ
    cleanupTestDependencies();
  });

  describe('Batch Mode', () => {
    it('should collect yesterday\'s data in batch mode', async () => {
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // スクレイピング結果をモック
      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1234',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test Disclosure',
          disclosed_at: '2024-01-15T01:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        },
      ]);

      // DynamoDB/S3の成功をモック
      mockUpdateExecutionStatus(true);
      mockPutDisclosure(true);
      mockPutPdf(true);

      const response = await handler(event, mockContext);

      // レスポンス検証
      expect(response.status).toBe('success');
      expect(response.collected_count).toBeGreaterThan(0);
      expect(response.failed_count).toBe(0);
      expect(response.execution_id).toMatch(/^exec_\d+_[a-z0-9]+_test-req/);

      // スクレイピングが呼ばれたことを確認
      expect(mockScrapeTdnetList).toHaveBeenCalled();

      // DynamoDB/S3が呼ばれたことを確認
      expect(dynamoMock.commandCalls(PutCommand).length).toBeGreaterThan(0);
      expect(dynamoMock.commandCalls(UpdateCommand).length).toBeGreaterThan(0);
      expect(s3Mock.commandCalls(PutObjectCommand).length).toBeGreaterThan(0);
    });

    it('should handle scraping errors gracefully in batch mode', async () => {
      const event: CollectorEvent = {
        mode: 'batch',
      };

      // スクレイピングエラーをモック
      mockScrapeTdnetList.mockRejectedValue(new Error('Network error'));

      // 実行状態更新は成功
      mockUpdateExecutionStatus(true);

      const response = await handler(event, mockContext);

      // エラーハンドリングの検証
      expect(response.status).toBe('failed');
      expect(response.collected_count).toBe(0);
      expect(response.failed_count).toBeGreaterThan(0);

      // 実行状態が更新されたことを確認
      expect(dynamoMock.commandCalls(UpdateCommand).length).toBeGreaterThan(0);
    });
  });

  describe('On-Demand Mode', () => {
    it('should collect data for specified date range', async () => {
      // Use recent dates (within 1 year)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: threeDaysAgo.toISOString().substring(0, 10),
        end_date: yesterday.toISOString().substring(0, 10),
      };

      // スクレイピング結果をモック
      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1234',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test Disclosure',
          disclosed_at: '2024-01-15T01:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        },
      ]);

      // DynamoDB/S3の成功をモック
      mockUpdateExecutionStatus(true);
      mockPutDisclosure(true);
      mockPutPdf(true);

      const response = await handler(event, mockContext);

      // レスポンス検証
      expect(response.status).toBe('success');
      expect(response.collected_count).toBeGreaterThan(0);

      // 3日分のスクレイピングが実行されたことを確認
      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in on-demand mode', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: threeDaysAgo.toISOString().substring(0, 10),
        end_date: yesterday.toISOString().substring(0, 10),
      };

      // 部分的失敗をモック（1日目成功、2日目失敗、3日目成功）
      mockScrapeTdnetList
        .mockResolvedValueOnce([
          {
            company_code: '1234',
            company_name: 'Test Company',
            disclosure_type: '決算短信',
            title: 'Test Disclosure',
            disclosed_at: '2024-01-15T01:30:00Z',
            pdf_url: 'https://example.com/test.pdf',
          },
        ])
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          {
            company_code: '5678',
            company_name: 'Another Company',
            disclosure_type: '有価証券報告書',
            title: 'Another Disclosure',
            disclosed_at: '2024-01-17T02:00:00Z',
            pdf_url: 'https://example.com/test2.pdf',
          },
        ]);

      // DynamoDB/S3の成功をモック
      mockUpdateExecutionStatus(true);
      mockPutDisclosure(true);
      mockPutPdf(true);

      const response = await handler(event, mockContext);

      // 部分的成功の検証
      expect(response.status).toBe('partial_success');
      expect(response.collected_count).toBeGreaterThan(0);
      expect(response.failed_count).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should reject invalid mode', async () => {
      const event = {
        mode: 'invalid',
      } as any;

      const response = await handler(event, mockContext);

      expect(response.status).toBe('failed');
      expect(response.message).toContain('Invalid mode');
    });

    it('should reject on-demand mode without start_date', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        end_date: '2024-01-15',
      };

      const response = await handler(event, mockContext);

      expect(response.status).toBe('failed');
      expect(response.message).toContain('start_date and end_date are required');
    });

    it('should reject invalid date format', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024/01/15',
        end_date: '2024-01-20',
      };

      const response = await handler(event, mockContext);

      expect(response.status).toBe('failed');
      expect(response.message).toContain('Invalid start_date format');
    });
  });

  describe('AWS SDK Mock Verification', () => {
    it('should verify DynamoDB calls with aws-sdk-client-mock', async () => {
      const event: CollectorEvent = {
        mode: 'batch',
      };

      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1234',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test Disclosure',
          disclosed_at: '2024-01-15T01:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        },
      ]);

      mockUpdateExecutionStatus(true);
      mockPutDisclosure(true);
      mockPutPdf(true);

      await handler(event, mockContext);

      // aws-sdk-client-mockの検証機能を使用
      const putCalls = dynamoMock.commandCalls(PutCommand);
      const updateCalls = dynamoMock.commandCalls(UpdateCommand);

      expect(putCalls.length).toBeGreaterThan(0);
      expect(updateCalls.length).toBeGreaterThan(0);

      // 呼び出しパラメータの検証
      const firstPutCall = putCalls[0];
      expect(firstPutCall.args[0].input.TableName).toBe('test-disclosures-table');
    });

    it('should verify S3 calls with aws-sdk-client-mock', async () => {
      const event: CollectorEvent = {
        mode: 'batch',
      };

      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1234',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test Disclosure',
          disclosed_at: '2024-01-15T01:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        },
      ]);

      mockUpdateExecutionStatus(true);
      mockPutDisclosure(true);
      mockPutPdf(true);

      await handler(event, mockContext);

      // S3呼び出しの検証
      const s3Calls = s3Mock.commandCalls(PutObjectCommand);
      expect(s3Calls.length).toBeGreaterThan(0);

      // 呼び出しパラメータの検証
      const firstS3Call = s3Calls[0];
      expect(firstS3Call.args[0].input.Bucket).toBe('test-pdfs-bucket');
    });
  });
});

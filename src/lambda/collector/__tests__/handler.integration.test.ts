/**
 * Lambda Collector統合テスト
 * Property 1: 日付範囲収集の完全性
 * Property 2: メタデータとPDFの同時取得
 * Requirements: 要件1.1, 1.2, 1.3, 1.4
 */

import { Context } from 'aws-lambda';
import { handler, CollectorEvent } from '../handler';
import { scrapeTdnetList } from '../scrape-tdnet-list';
import { downloadPdf } from '../download-pdf';
import { saveMetadata } from '../save-metadata';
import { updateExecutionStatus } from '../update-execution-status';

jest.mock('../scrape-tdnet-list');
jest.mock('../download-pdf');
jest.mock('../save-metadata');
jest.mock('../update-execution-status');

const mockScrapeTdnetList = scrapeTdnetList as jest.MockedFunction<typeof scrapeTdnetList>;
const mockDownloadPdf = downloadPdf as jest.MockedFunction<typeof downloadPdf>;
const mockSaveMetadata = saveMetadata as jest.MockedFunction<typeof saveMetadata>;
const mockUpdateExecutionStatus = updateExecutionStatus as jest.MockedFunction<typeof updateExecutionStatus>;

describe('Lambda Collector Integration Tests', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'test-function',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
      memoryLimitInMB: '512',
      logGroupName: '/aws/lambda/test',
      logStreamName: '2024/01/15/test',
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
      callbackWaitsForEmptyEventLoop: true,
    };

    mockUpdateExecutionStatus.mockResolvedValue({
      execution_id: 'test-exec',
      status: 'running',
      progress: 0,
      collected_count: 0,
      failed_count: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockDownloadPdf.mockResolvedValue('s3://bucket/test.pdf');
    mockSaveMetadata.mockResolvedValue(undefined);
  });

  describe('Property 1: 日付範囲収集の完全性', () => {
    it('指定期間内のすべての日付をスクレイピングする（1週間）', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-01',
        end_date: '2026-02-07',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1001',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-01T10:00:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(7);
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-01');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-02');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-03');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-04');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-05');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-06');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-07');
      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(7);
    });

    it('日付の抜けがないことを検証する', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-01',
        end_date: '2026-02-06',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-01T10:00:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(6);
      const calledDates = mockScrapeTdnetList.mock.calls.map((call) => call[0]);
      expect(calledDates).toEqual([
        '2026-02-01', '2026-02-02', '2026-02-03',
        '2026-02-04', '2026-02-05', '2026-02-06',
      ]);
      expect(response.status).toBe('success');
    });

    it('1日だけの範囲でも正しく処理される', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-05T10:00:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(1);
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2026-02-05');
      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(1);
    });

    it('開示情報が0件の日があっても処理を継続する', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-01',
        end_date: '2026-02-03',
      };

      mockScrapeTdnetList.mockImplementation(async (date: string) => {
        if (date === '2026-02-01') return [{
          company_code: '1001',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test',
          disclosed_at: '2026-02-01T10:00:00Z',
          pdf_url: 'https://example.com/test.pdf',
        }];
        if (date === '2026-02-02') return [];
        if (date === '2026-02-03') return [{
          company_code: '1003',
          company_name: 'Test Company',
          disclosure_type: '決算短信',
          title: 'Test',
          disclosed_at: '2026-02-03T10:00:00Z',
          pdf_url: 'https://example.com/test.pdf',
        }];
        return [];
      });

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(3);
      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(2);
    });
  });

  describe('Property 2: メタデータとPDFの同時取得', () => {
    it('メタデータとPDFの両方が永続化される', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-05T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      mockDownloadPdf.mockResolvedValue('2026/02/05/TD20260205001.pdf');

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).toHaveBeenCalledTimes(1);
      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(1);
    });

    it('disclosure_idでメタデータとPDFが紐付けられる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-05T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      let capturedDisclosureId: string | undefined;

      mockDownloadPdf.mockImplementation(async (disclosure_id) => {
        capturedDisclosureId = disclosure_id;
        return `2026/02/05/${disclosure_id}.pdf`;
      });

      mockSaveMetadata.mockImplementation(async (disclosure, s3_key) => {
        expect(disclosure.disclosure_id).toBe(capturedDisclosureId);
        expect(s3_key).toContain(capturedDisclosureId!);
      });

      const response = await handler(event, mockContext);

      expect(response.status).toBe('success');
      expect(capturedDisclosureId).toBeDefined();
    });

    it('PDFダウンロード失敗時はメタデータも保存されない', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-05T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      mockDownloadPdf.mockRejectedValue(new Error('PDF download failed'));

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).not.toHaveBeenCalled();
      expect(response.status).toBe('failed');
      expect(response.collected_count).toBe(0);
      expect(response.failed_count).toBe(1);
    });

    it('メタデータ保存失敗時は失敗としてカウントされる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test',
        disclosed_at: '2026-02-05T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }]);

      mockDownloadPdf.mockResolvedValue('2026/02/05/TD20260205001.pdf');
      mockSaveMetadata.mockRejectedValue(new Error('DynamoDB error'));

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).toHaveBeenCalledTimes(1);
      expect(response.status).toBe('failed');
      expect(response.collected_count).toBe(0);
      expect(response.failed_count).toBe(1);
    });

    it('一部成功・一部失敗でpartial_successになる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1001',
          company_name: 'Test Company A',
          disclosure_type: '決算短信',
          title: 'Test 1',
          disclosed_at: '2026-02-05T10:00:00Z',
          pdf_url: 'https://example.com/test1.pdf',
        },
        {
          company_code: '1002',
          company_name: 'Test Company B',
          disclosure_type: '決算短信',
          title: 'Test 2',
          disclosed_at: '2026-02-05T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
        },
        {
          company_code: '1003',
          company_name: 'Test Company C',
          disclosure_type: '決算短信',
          title: 'Test 3',
          disclosed_at: '2026-02-05T12:00:00Z',
          pdf_url: 'https://example.com/test3.pdf',
        },
      ]);

      mockDownloadPdf.mockResolvedValueOnce('2026/02/05/TD20260205001.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      mockDownloadPdf.mockRejectedValueOnce(new Error('PDF download failed'));

      mockDownloadPdf.mockResolvedValueOnce('2026/02/05/TD20260205003.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      const response = await handler(event, mockContext);

      expect(response.status).toBe('partial_success');
      expect(response.collected_count).toBe(2);
      expect(response.failed_count).toBe(1);
    });

    it('両方成功時のみcollected_countがインクリメントされる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2026-02-05',
        end_date: '2026-02-05',
      };

      mockScrapeTdnetList.mockResolvedValue([
        {
          company_code: '1001',
          company_name: 'Test Company A',
          disclosure_type: '決算短信',
          title: 'Test 1',
          disclosed_at: '2026-02-05T10:00:00Z',
          pdf_url: 'https://example.com/test1.pdf',
        },
        {
          company_code: '1002',
          company_name: 'Test Company B',
          disclosure_type: '決算短信',
          title: 'Test 2',
          disclosed_at: '2026-02-05T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
        },
      ]);

      mockDownloadPdf.mockResolvedValueOnce('2026/02/05/TD20260205001.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      mockDownloadPdf.mockResolvedValueOnce('2026/02/05/TD20260205002.pdf');
      mockSaveMetadata.mockRejectedValueOnce(new Error('DynamoDB error'));

      const response = await handler(event, mockContext);

      expect(response.status).toBe('partial_success');
      expect(response.collected_count).toBe(1);
      expect(response.failed_count).toBe(1);
    });
  });
});

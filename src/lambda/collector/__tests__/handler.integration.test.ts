/**
 * Lambda Collector統合テスト
 *
 * Property 1: 日付範囲収集の完全性
 * Property 2: メタデータとPDFの同時取得
 *
 * Requirements: 要件1.1, 1.2, 1.3, 1.4
 */

import { Context } from 'aws-lambda';
import { handler, CollectorEvent } from '../handler';
import { scrapeTdnetList } from '../scrape-tdnet-list';
import { downloadPdf } from '../download-pdf';
import { saveMetadata } from '../save-metadata';
import { updateExecutionStatus } from '../update-execution-status';
import { DisclosureMetadata } from '../../../scraper/html-parser';

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
    it('指定期間内のすべての日付のTDnetリストページをスクレイピングする（1週間）', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
      };

      const mockDisclosuresByDate: Record<string, DisclosureMetadata[]> = {
        '2024-01-01': [{
          company_code: '1001',
          company_name: '株式会社A',
          disclosure_type: '決算短信',
          title: '2024年1月1日の開示',
          disclosed_at: '2024-01-01T10:00:00Z',
          pdf_url: 'https://example.com/20240101.pdf',
        }],
        '2024-01-02': [{
          company_code: '1002',
          company_name: '株式会社B',
          disclosure_type: '有価証券報告書',
          title: '2024年1月2日の開示',
          disclosed_at: '2024-01-02T11:00:00Z',
          pdf_url: 'https://example.com/20240102.pdf',
        }],
        '2024-01-03': [{
          company_code: '1003',
          company_name: '株式会社C',
          disclosure_type: '適時開示',
          title: '2024年1月3日の開示',
          disclosed_at: '2024-01-03T12:00:00Z',
          pdf_url: 'https://example.com/20240103.pdf',
        }],
        '2024-01-04': [{
          company_code: '1004',
          company_name: '株式会社D',
          disclosure_type: '決算短信',
          title: '2024年1月4日の開示',
          disclosed_at: '2024-01-04T13:00:00Z',
          pdf_url: 'https://example.com/20240104.pdf',
        }],
        '2024-01-05': [{
          company_code: '1005',
          company_name: '株式会社E',
          disclosure_type: '有価証券報告書',
          title: '2024年1月5日の開示',
          disclosed_at: '2024-01-05T14:00:00Z',
          pdf_url: 'https://example.com/20240105.pdf',
        }],
        '2024-01-06': [{
          company_code: '1006',
          company_name: '株式会社F',
          disclosure_type: '適時開示',
          title: '2024年1月6日の開示',
          disclosed_at: '2024-01-06T15:00:00Z',
          pdf_url: 'https://example.com/20240106.pdf',
        }],
        '2024-01-07': [{
          company_code: '1007',
          company_name: '株式会社G',
          disclosure_type: '決算短信',
          title: '2024年1月7日の開示',
          disclosed_at: '2024-01-07T16:00:00Z',
          pdf_url: 'https://example.com/20240107.pdf',
        }],
      };

      mockScrapeTdnetList.mockImplementation(async (date: string) => {
        return mockDisclosuresByDate[date] || [];
      });

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(7);
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-01');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-02');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-03');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-04');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-05');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-06');
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-07');

      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(7);
      expect(response.failed_count).toBe(0);
    });

    it('日付の抜けがないことを検証する（開始日と終了日を含む）', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-20',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test Disclosure',
        disclosed_at: '2024-01-15T10:00:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(6);

      const calledDates = mockScrapeTdnetList.mock.calls.map((call) => call[0]);
      const expectedDates = [
        '2024-01-15',
        '2024-01-16',
        '2024-01-17',
        '2024-01-18',
        '2024-01-19',
        '2024-01-20',
      ];

      expect(calledDates).toEqual(expectedDates);
      expect(calledDates).toContain('2024-01-15');
      expect(calledDates).toContain('2024-01-20');
      expect(response.status).toBe('success');
    });

    it('1日だけの範囲でも正しく処理される', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: 'Test Company',
        disclosure_type: '決算短信',
        title: 'Test Disclosure',
        disclosed_at: '2024-01-15T10:00:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);

      const response = await handler(event, mockContext);

      expect(mockScrapeTdnetList).toHaveBeenCalledTimes(1);
      expect(mockScrapeTdnetList).toHaveBeenCalledWith('2024-01-15');
      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(1);
    });
  });
});

  describe('Property 2: メタデータとPDFの同時取得', () => {
    it('メタデータとPDFファイルの両方が取得され、永続化される', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: 'テスト開示',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);
      mockDownloadPdf.mockResolvedValue('2024/01/15/TD20240115001.pdf');
      mockSaveMetadata.mockResolvedValue(undefined);

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).toHaveBeenCalledTimes(1);

      expect(mockDownloadPdf).toHaveBeenCalledWith(
        expect.stringMatching(/^TD\d{8}\d{3}$/),
        'https://example.com/test.pdf',
        '2024-01-15T10:30:00Z'
      );

      expect(mockSaveMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          company_code: '1234',
          company_name: '株式会社サンプル',
          disclosure_type: '決算短信',
          title: 'テスト開示',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://example.com/test.pdf',
        }),
        '2024/01/15/TD20240115001.pdf'
      );

      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(1);
    });

    it('disclosure_idでメタデータとPDFが紐付けられる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: 'テスト開示',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);

      let capturedDisclosureId: string | undefined;

      mockDownloadPdf.mockImplementation(async (disclosure_id) => {
        capturedDisclosureId = disclosure_id;
        return `2024/01/15/${disclosure_id}.pdf`;
      });

      mockSaveMetadata.mockImplementation(async (disclosure, s3_key) => {
        expect(disclosure.disclosure_id).toBe(capturedDisclosureId);
        expect(s3_key).toContain(capturedDisclosureId!);
      });

      const response = await handler(event, mockContext);

      expect(response.status).toBe('success');
      expect(response.collected_count).toBe(1);
      expect(capturedDisclosureId).toBeDefined();
    });

    it('PDFダウンロードが失敗した場合、メタデータも保存されない', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: 'テスト開示',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);
      mockDownloadPdf.mockRejectedValue(new Error('PDF download failed'));

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).not.toHaveBeenCalled();
      expect(response.status).toBe('failed');
      expect(response.collected_count).toBe(0);
      expect(response.failed_count).toBe(1);
    });

    it('メタデータ保存が失敗した場合、失敗としてカウントされる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [{
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: 'テスト開示',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/test.pdf',
      }];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);
      mockDownloadPdf.mockResolvedValue('2024/01/15/TD20240115001.pdf');
      mockSaveMetadata.mockRejectedValue(new Error('DynamoDB error'));

      const response = await handler(event, mockContext);

      expect(mockDownloadPdf).toHaveBeenCalledTimes(1);
      expect(mockSaveMetadata).toHaveBeenCalledTimes(1);
      expect(response.status).toBe('failed');
      expect(response.collected_count).toBe(0);
      expect(response.failed_count).toBe(1);
    });

    it('複数の開示情報で、一部が成功し一部が失敗した場合、partial_successになる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [
        {
          company_code: '1001',
          company_name: '株式会社A',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:00:00Z',
          pdf_url: 'https://example.com/test1.pdf',
        },
        {
          company_code: '1002',
          company_name: '株式会社B',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
        },
        {
          company_code: '1003',
          company_name: '株式会社C',
          disclosure_type: '適時開示',
          title: 'テスト開示3',
          disclosed_at: '2024-01-15T12:00:00Z',
          pdf_url: 'https://example.com/test3.pdf',
        },
      ];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);

      mockDownloadPdf.mockResolvedValueOnce('2024/01/15/TD20240115001.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      mockDownloadPdf.mockRejectedValueOnce(new Error('PDF download failed'));

      mockDownloadPdf.mockResolvedValueOnce('2024/01/15/TD20240115003.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      const response = await handler(event, mockContext);

      expect(response.status).toBe('partial_success');
      expect(response.collected_count).toBe(2);
      expect(response.failed_count).toBe(1);
    });

    it('両方の操作が成功した場合のみ、collected_countがインクリメントされる', async () => {
      const event: CollectorEvent = {
        mode: 'on-demand',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
      };

      const mockDisclosures: DisclosureMetadata[] = [
        {
          company_code: '1001',
          company_name: '株式会社A',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:00:00Z',
          pdf_url: 'https://example.com/test1.pdf',
        },
        {
          company_code: '1002',
          company_name: '株式会社B',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
        },
      ];

      mockScrapeTdnetList.mockResolvedValue(mockDisclosures);

      mockDownloadPdf.mockResolvedValueOnce('2024/01/15/TD20240115001.pdf');
      mockSaveMetadata.mockResolvedValueOnce(undefined);

      mockDownloadPdf.mockResolvedValueOnce('2024/01/15/TD20240115002.pdf');
      mockSaveMetadata.mockRejectedValueOnce(new Error('DynamoDB error'));

      const response = await handler(event, mockContext);

      expect(response.status).toBe('partial_success');
      expect(response.collected_count).toBe(1);
      expect(response.failed_count).toBe(1);
    });
  });
});

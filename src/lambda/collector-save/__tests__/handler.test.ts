/**
 * Lambda Collector-Save Handler ユニットテスト
 *
 * collector-save Lambda関数のユニットテストです。
 * DynamoDB、S3、PDFダウンロードをモック化してテストします。
 */

import { Context } from 'aws-lambda';
import { handler, SaveEvent, SaveResponse } from '../handler';
import { DisclosureMetadata } from '../../../scraper/html-parser';
import * as downloadPdfModule from '../../collector/download-pdf';
import * as saveMetadataModule from '../../collector/save-metadata';
import * as disclosureIdModule from '../../../utils/disclosure-id';

// モック
jest.mock('../../collector/download-pdf');
jest.mock('../../collector/save-metadata');
jest.mock('../../../utils/disclosure-id');
jest.mock('../../../utils/cloudwatch-metrics');

describe('Lambda Collector-Save Handler', () => {
  // テスト用のLambda Context
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'collector-save',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:collector-save',
    memoryLimitInMB: '512',
    logGroupName: '/aws/lambda/collector-save',
    logStreamName: '2024/01/15/[$LATEST]test',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  // テスト用の開示情報メタデータ
  const mockDisclosureMetadata: DisclosureMetadata[] = [
    {
      company_code: '1234',
      company_name: '株式会社サンプル',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-15T10:30:00Z',
      pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
    },
    {
      company_code: '5678',
      company_name: '株式会社テスト',
      disclosure_type: '適時開示',
      title: '業績予想の修正に関するお知らせ',
      disclosed_at: '2024-01-15T11:00:00Z',
      pdf_url: 'https://www.release.tdnet.info/inbs/140120240115002.pdf',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック実装
    (disclosureIdModule.generateDisclosureId as jest.Mock).mockImplementation(
      (disclosedAt: string, companyCode: string, sequence: number) => {
        const date = new Date(disclosedAt);
        const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const year = jstDate.getUTCFullYear();
        const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(jstDate.getUTCDate()).padStart(2, '0');
        const seq = String(sequence).padStart(4, '0');
        return `${year}${month}${day}_${companyCode}_${seq}`;
      }
    );

    (downloadPdfModule.downloadPdf as jest.Mock).mockResolvedValue('2024/01/15/test.pdf');
    (saveMetadataModule.saveMetadata as jest.Mock).mockResolvedValue(undefined);
  });

  describe('正常系', () => {
    it('全件保存成功', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: mockDisclosureMetadata,
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_123',
        page_number: 1,
        saved_count: 2,
        failed_count: 0,
        failed_items: [],
      });

      expect(downloadPdfModule.downloadPdf).toHaveBeenCalledTimes(2);
      expect(saveMetadataModule.saveMetadata).toHaveBeenCalledTimes(2);
    });

    it('空の開示情報リスト', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: [],
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_123',
        page_number: 1,
        saved_count: 0,
        failed_count: 0,
        failed_items: [],
      });

      expect(downloadPdfModule.downloadPdf).not.toHaveBeenCalled();
      expect(saveMetadataModule.saveMetadata).not.toHaveBeenCalled();
    });
  });

  describe('異常系', () => {
    it('部分的失敗（1件目成功、2件目失敗）', async () => {
      // 2件目のPDFダウンロードを失敗させる
      (downloadPdfModule.downloadPdf as jest.Mock)
        .mockResolvedValueOnce('2024/01/15/test1.pdf')
        .mockRejectedValueOnce(new Error('PDF download failed'));

      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: mockDisclosureMetadata,
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response.saved_count).toBe(1);
      expect(response.failed_count).toBe(1);
      expect(response.failed_items).toHaveLength(1);
      expect(response.failed_items[0].error).toContain('PDF download failed');

      expect(downloadPdfModule.downloadPdf).toHaveBeenCalledTimes(2);
      expect(saveMetadataModule.saveMetadata).toHaveBeenCalledTimes(1);
    });

    it('DynamoDB書き込みエラー', async () => {
      (saveMetadataModule.saveMetadata as jest.Mock).mockRejectedValue(
        new Error('DynamoDB write failed')
      );

      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: [mockDisclosureMetadata[0]],
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response.saved_count).toBe(0);
      expect(response.failed_count).toBe(1);
      expect(response.failed_items).toHaveLength(1);
      expect(response.failed_items[0].error).toContain('DynamoDB write failed');
    });

    it('S3アップロードエラー', async () => {
      (downloadPdfModule.downloadPdf as jest.Mock).mockRejectedValue(
        new Error('S3 upload failed')
      );

      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: [mockDisclosureMetadata[0]],
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response.saved_count).toBe(0);
      expect(response.failed_count).toBe(1);
      expect(response.failed_items).toHaveLength(1);
      expect(response.failed_items[0].error).toContain('S3 upload failed');
    });

    it('全件失敗', async () => {
      (downloadPdfModule.downloadPdf as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: mockDisclosureMetadata,
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response.saved_count).toBe(0);
      expect(response.failed_count).toBe(2);
      expect(response.failed_items).toHaveLength(2);
    });
  });

  describe('並列処理', () => {
    it('並列度5で処理', async () => {
      // 10件の開示情報を作成
      const items: DisclosureMetadata[] = Array.from({ length: 10 }, (_, i) => ({
        company_code: `${1000 + i}`,
        company_name: `株式会社テスト${i}`,
        disclosure_type: '決算短信',
        title: `テストタイトル${i}`,
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: `https://www.release.tdnet.info/inbs/test${i}.pdf`,
      }));

      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items,
      };

      const response: SaveResponse = await handler(event, mockContext);

      expect(response.saved_count).toBe(10);
      expect(response.failed_count).toBe(0);
      expect(downloadPdfModule.downloadPdf).toHaveBeenCalledTimes(10);
      expect(saveMetadataModule.saveMetadata).toHaveBeenCalledTimes(10);
    });
  });

  describe('開示ID生成', () => {
    it('正しい開示IDが生成される', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: [mockDisclosureMetadata[0]],
      };

      await handler(event, mockContext);

      expect(disclosureIdModule.generateDisclosureId).toHaveBeenCalledWith(
        '2024-01-15T10:30:00Z',
        '1234',
        1
      );
    });

    it('連番が正しく割り当てられる', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_test_123',
        page_number: 1,
        items: mockDisclosureMetadata,
      };

      await handler(event, mockContext);

      expect(disclosureIdModule.generateDisclosureId).toHaveBeenNthCalledWith(
        1,
        '2024-01-15T10:30:00Z',
        '1234',
        1
      );
      expect(disclosureIdModule.generateDisclosureId).toHaveBeenNthCalledWith(
        2,
        '2024-01-15T11:00:00Z',
        '5678',
        2
      );
    });
  });
});

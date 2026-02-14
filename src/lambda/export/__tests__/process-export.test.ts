/**
 * Process Export Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
jest.mock('../query-disclosures');
jest.mock('../export-to-s3');
jest.mock('../update-export-status');
jest.mock('../generate-signed-url');
jest.mock('../../../utils/logger');

import { processExport } from '../process-export';
import { queryDisclosures } from '../query-disclosures';
import { exportToS3 } from '../export-to-s3';
import { updateExportStatus } from '../update-export-status';
import { generateSignedUrl } from '../generate-signed-url';
import { Disclosure } from '../../../types';
import { ExportRequestBody } from '../types';

// モック関数の型定義
const mockQueryDisclosures = queryDisclosures as jest.MockedFunction<typeof queryDisclosures>;
const mockExportToS3 = exportToS3 as jest.MockedFunction<typeof exportToS3>;
const mockUpdateExportStatus = updateExportStatus as jest.MockedFunction<typeof updateExportStatus>;
const mockGenerateSignedUrl = generateSignedUrl as jest.MockedFunction<typeof generateSignedUrl>;

describe('processExport', () => {
  const mockDisclosures: Disclosure[] = [
    {
      disclosure_id: '20240115_1234_001',
      company_code: '1234',
      company_name: 'テスト株式会社',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-15T10:30:00Z',
      pdf_url: 'https://example.com/pdf/20240115_1234_001.pdf',
      pdf_s3_key: 'pdfs/2024/01/15/20240115_1234_001.pdf',
      downloaded_at: '2024-01-15T10:35:00Z',
      date_partition: '2024-01',
    },
    {
      disclosure_id: '20240115_5678_001',
      company_code: '5678',
      company_name: 'サンプル株式会社',
      disclosure_type: '有価証券報告書',
      title: '第50期有価証券報告書',
      disclosed_at: '2024-01-15T11:00:00Z',
      pdf_url: 'https://example.com/pdf/20240115_5678_001.pdf',
      pdf_s3_key: 'pdfs/2024/01/15/20240115_5678_001.pdf',
      downloaded_at: '2024-01-15T11:05:00Z',
      date_partition: '2024-01',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック実装
    mockQueryDisclosures.mockResolvedValue(mockDisclosures);
    mockExportToS3.mockResolvedValue('exports/2024/01/15/export_1705305600000_abc123_12345678.json');
    mockUpdateExportStatus.mockResolvedValue();
    mockGenerateSignedUrl.mockResolvedValue('https://s3.amazonaws.com/signed-url?expires=...');
  });

  describe('正常系: エクスポート処理の完全な実行', () => {
    it('JSON形式でエクスポート処理が正常に完了する', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        },
      };

      // Act
      await processExport(export_id, requestBody);

      // Assert
      // 1. データ取得
      expect(mockQueryDisclosures).toHaveBeenCalledWith(requestBody.filter);

      // 2. 進捗更新（10%, 50%, 90%, 100%）
      expect(mockUpdateExportStatus).toHaveBeenCalledTimes(4);
      expect(mockUpdateExportStatus).toHaveBeenNthCalledWith(1, export_id, 'processing', 10);
      expect(mockUpdateExportStatus).toHaveBeenNthCalledWith(2, export_id, 'processing', 50);
      expect(mockUpdateExportStatus).toHaveBeenNthCalledWith(3, export_id, 'processing', 90);

      // 3. S3へのエクスポート
      expect(mockExportToS3).toHaveBeenCalledWith(export_id, mockDisclosures, 'json');

      // 4. 署名付きURL生成（有効期限7日）
      expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
        'exports/2024/01/15/export_1705305600000_abc123_12345678.json',
        7 * 24 * 60 * 60
      );

      // 5. 完了ステータス更新（100%）
      expect(mockUpdateExportStatus).toHaveBeenNthCalledWith(
        4,
        export_id,
        'completed',
        100,
        'exports/2024/01/15/export_1705305600000_abc123_12345678.json',
        'https://s3.amazonaws.com/signed-url?expires=...'
      );
    });

    it('CSV形式でエクスポート処理が正常に完了する', async () => {
      // Arrange
      const export_id = 'export_1705305600000_def456_87654321';
      const requestBody: ExportRequestBody = {
        format: 'csv',
        filter: {
          company_code: '1234',
        },
      };

      mockExportToS3.mockResolvedValue('exports/2024/01/15/export_1705305600000_def456_87654321.csv');

      // Act
      await processExport(export_id, requestBody);

      // Assert
      expect(mockQueryDisclosures).toHaveBeenCalledWith(requestBody.filter);
      expect(mockExportToS3).toHaveBeenCalledWith(export_id, mockDisclosures, 'csv');
      expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
        'exports/2024/01/15/export_1705305600000_def456_87654321.csv',
        7 * 24 * 60 * 60
      );
    });

    it('進捗更新が正しい順序で実行される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_ghi789_11111111';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      // Act
      await processExport(export_id, requestBody);

      // Assert
      const calls = mockUpdateExportStatus.mock.calls;
      expect(calls[0]).toEqual([export_id, 'processing', 10]);
      expect(calls[1]).toEqual([export_id, 'processing', 50]);
      expect(calls[2]).toEqual([export_id, 'processing', 90]);
      expect(calls[3]).toEqual([
        export_id,
        'completed',
        100,
        'exports/2024/01/15/export_1705305600000_abc123_12345678.json',
        'https://s3.amazonaws.com/signed-url?expires=...',
      ]);
    });

    it('空のデータセットでもエクスポート処理が完了する', async () => {
      // Arrange
      const export_id = 'export_1705305600000_jkl012_22222222';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {
          company_code: '9999',
        },
      };

      mockQueryDisclosures.mockResolvedValue([]);
      mockExportToS3.mockResolvedValue('exports/2024/01/15/export_1705305600000_jkl012_22222222.json');

      // Act
      await processExport(export_id, requestBody);

      // Assert
      expect(mockQueryDisclosures).toHaveBeenCalledWith(requestBody.filter);
      expect(mockExportToS3).toHaveBeenCalledWith(export_id, [], 'json');
      expect(mockUpdateExportStatus).toHaveBeenLastCalledWith(
        export_id,
        'completed',
        100,
        'exports/2024/01/15/export_1705305600000_jkl012_22222222.json',
        'https://s3.amazonaws.com/signed-url?expires=...'
      );
    });

    it('大量データのエクスポート処理が完了する', async () => {
      // Arrange
      const export_id = 'export_1705305600000_mno345_33333333';
      const requestBody: ExportRequestBody = {
        format: 'csv',
        filter: {
          start_date: '2024-01-01',
          end_date: '2024-12-31',
        },
      };

      // 1000件のモックデータ
      const largeDataset: Disclosure[] = Array.from({ length: 1000 }, (_, i) => ({
        disclosure_id: `20240115_${String(i).padStart(4, '0')}_001`,
        company_code: String(i).padStart(4, '0'),
        company_name: `企業${i}`,
        disclosure_type: '決算短信',
        title: `タイトル${i}`,
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: `https://example.com/pdf/${i}.pdf`,
        pdf_s3_key: `pdfs/2024/01/15/${i}.pdf`,
        downloaded_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-01',
      }));

      mockQueryDisclosures.mockResolvedValue(largeDataset);
      mockExportToS3.mockResolvedValue('exports/2024/01/15/export_1705305600000_mno345_33333333.csv');

      // Act
      await processExport(export_id, requestBody);

      // Assert
      expect(mockQueryDisclosures).toHaveBeenCalledWith(requestBody.filter);
      expect(mockExportToS3).toHaveBeenCalledWith(export_id, largeDataset, 'csv');
      expect(mockUpdateExportStatus).toHaveBeenLastCalledWith(
        export_id,
        'completed',
        100,
        'exports/2024/01/15/export_1705305600000_mno345_33333333.csv',
        'https://s3.amazonaws.com/signed-url?expires=...'
      );
    });
  });

  describe('異常系: データ取得失敗', () => {
    it('DynamoDB例外が発生した場合、failedステータスに更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_pqr678_44444444';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('ProvisionedThroughputExceededException');
      error.name = 'ProvisionedThroughputExceededException';
      mockQueryDisclosures.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow(
        'ProvisionedThroughputExceededException'
      );

      // failedステータスに更新されることを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'ProvisionedThroughputExceededException'
      );
    });

    it('クエリタイムアウトが発生した場合、failedステータスに更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_stu901_55555555';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('Query timeout');
      mockQueryDisclosures.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow('Query timeout');

      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'Query timeout'
      );
    });
  });

  describe('異常系: S3エクスポート失敗', () => {
    it('S3 PutObject失敗時、failedステータスに更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_vwx234_66666666';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('S3 PutObject failed');
      mockExportToS3.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow('S3 PutObject failed');

      // 進捗10%, 50%まで更新された後、failedになることを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 10);
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 50);
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'S3 PutObject failed'
      );
    });

    it('S3アクセス拒否エラー時、failedステータスに更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_yza567_77777777';
      const requestBody: ExportRequestBody = {
        format: 'csv',
        filter: {},
      };

      const error = new Error('Access Denied');
      error.name = 'AccessDenied';
      mockExportToS3.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow('Access Denied');

      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'Access Denied'
      );
    });
  });

  describe('異常系: 署名付きURL生成失敗', () => {
    it('署名付きURL生成失敗時、failedステータスに更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_bcd890_88888888';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('Failed to generate signed URL');
      mockGenerateSignedUrl.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow(
        'Failed to generate signed URL'
      );

      // 進捗10%, 50%, 90%まで更新された後、failedになることを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 10);
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 50);
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 90);
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'Failed to generate signed URL'
      );
    });
  });

  describe('異常系: 進捗更新失敗', () => {
    it('進捗更新失敗時もエラーが伝播される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_efg123_99999999';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('DynamoDB UpdateItem failed');
      mockUpdateExportStatus.mockRejectedValueOnce(error); // 最初の呼び出しで失敗

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow(
        'DynamoDB UpdateItem failed'
      );

      // 最初の進捗更新で失敗することを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(export_id, 'processing', 10);
    });
  });

  describe('異常系: エラー時のステータス更新確認', () => {
    it('エラー発生時、エラーメッセージが正しく記録される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_hij456_00000000';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      const error = new Error('Unexpected error occurred');
      mockQueryDisclosures.mockRejectedValue(error);

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toThrow(
        'Unexpected error occurred'
      );

      // failedステータス更新時にエラーメッセージが含まれることを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'Unexpected error occurred'
      );
    });

    it('非Errorオブジェクトのエラー時も文字列化される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_klm789_11111112';
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      mockQueryDisclosures.mockRejectedValue('String error');

      // Act & Assert
      await expect(processExport(export_id, requestBody)).rejects.toBe('String error');

      // failedステータス更新時にエラーが文字列化されることを確認
      expect(mockUpdateExportStatus).toHaveBeenCalledWith(
        export_id,
        'failed',
        0,
        undefined,
        undefined,
        'String error'
      );
    });
  });
});

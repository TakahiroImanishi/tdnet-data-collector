/**
 * Export to S3 Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actualModule,
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

jest.mock('../../../utils/logger');
jest.mock('../../../utils/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()), // retryをバイパス
}));

import { exportToS3 } from '../export-to-s3';
import { Disclosure } from '../../../types';
import { PutObjectCommand } from '@aws-sdk/client-s3';

describe('exportToS3', () => {
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
    mockSend.mockClear();
    mockSend.mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
      ETag: '"mock-etag"',
    });
    
    process.env.EXPORT_BUCKET_NAME = 'test-exports-bucket';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  describe('JSON形式のエクスポート', () => {
    it('JSON形式でS3にエクスポートできる', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const format = 'json';

      // Act
      const s3_key = await exportToS3(export_id, mockDisclosures, format);

      // Assert
      expect(s3_key).toMatch(/^exports\/\d{4}\/\d{2}\/\d{2}\/export_\d+_[a-z0-9]+_[a-z0-9]+\.json$/);
      
      expect(mockSend).toHaveBeenCalledTimes(1);
      
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.Bucket).toBe('test-exports-bucket');
      expect(command.input.Key).toBe(s3_key);
      expect(command.input.ContentType).toBe('application/json');
      expect(command.input.Tagging).toBe('auto-delete=true');
    });

    it('JSONに件数とデータが含まれる', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const format = 'json';

      // Act
      await exportToS3(export_id, mockDisclosures, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;
      const parsed = JSON.parse(body);

      expect(parsed).toHaveProperty('count', 2);
      expect(parsed).toHaveProperty('disclosures');
      expect(parsed.disclosures).toHaveLength(2);
      expect(parsed.disclosures[0]).toEqual(mockDisclosures[0]);
    });
  });

  describe('CSV形式のエクスポート', () => {
    it('CSV形式でS3にエクスポートできる', async () => {
      // Arrange
      const export_id = 'export_1705305600000_def456_87654321';
      const format = 'csv';

      // Act
      const s3_key = await exportToS3(export_id, mockDisclosures, format);

      // Assert
      expect(s3_key).toMatch(/^exports\/\d{4}\/\d{2}\/\d{2}\/export_\d+_[a-z0-9]+_[a-z0-9]+\.csv$/);
      
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.Bucket).toBe('test-exports-bucket');
      expect(command.input.Key).toBe(s3_key);
      expect(command.input.ContentType).toBe('text/csv');
      expect(command.input.Tagging).toBe('auto-delete=true');
    });

    it('CSVヘッダーが正しく出力される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_def456_87654321';
      const format = 'csv';

      // Act
      await exportToS3(export_id, mockDisclosures, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;
      const lines = body.split('\n');

      expect(lines[0]).toBe(
        'disclosure_id,company_code,company_name,disclosure_type,title,disclosed_at,pdf_url,s3_key,collected_at,date_partition'
      );
    });

    it('CSVデータ行が正しく出力される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_def456_87654321';
      const format = 'csv';

      // Act
      await exportToS3(export_id, mockDisclosures, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;
      const lines = body.split('\n');

      expect(lines[1]).toBe(
        '20240115_1234_001,1234,テスト株式会社,決算短信,2024年3月期 第3四半期決算短信,2024-01-15T10:30:00Z,https://example.com/pdf/20240115_1234_001.pdf,pdfs/2024/01/15/20240115_1234_001.pdf,2024-01-15T10:35:00Z,2024-01'
      );
      expect(lines[2]).toBe(
        '20240115_5678_001,5678,サンプル株式会社,有価証券報告書,第50期有価証券報告書,2024-01-15T11:00:00Z,https://example.com/pdf/20240115_5678_001.pdf,pdfs/2024/01/15/20240115_5678_001.pdf,2024-01-15T11:05:00Z,2024-01'
      );
    });

    it('カンマを含む値が正しくエスケープされる', async () => {
      // Arrange
      const disclosuresWithComma: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル, カンマ含む',
        },
      ];
      const export_id = 'export_1705305600000_ghi789_11111111';
      const format = 'csv';

      // Act
      await exportToS3(export_id, disclosuresWithComma, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;
      const lines = body.split('\n');

      expect(lines[1]).toContain('"タイトル, カンマ含む"');
    });

    it('ダブルクォートを含む値が正しくエスケープされる', async () => {
      // Arrange
      const disclosuresWithQuote: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル"引用符"含む',
        },
      ];
      const export_id = 'export_1705305600000_jkl012_22222222';
      const format = 'csv';

      // Act
      await exportToS3(export_id, disclosuresWithQuote, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;
      const lines = body.split('\n');

      expect(lines[1]).toContain('"タイトル""引用符""含む"');
    });

    it('改行を含む値が正しくエスケープされる', async () => {
      // Arrange
      const disclosuresWithNewline: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル\n改行含む',
        },
      ];
      const export_id = 'export_1705305600000_mno345_33333333';
      const format = 'csv';

      // Act
      await exportToS3(export_id, disclosuresWithNewline, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      const body = command.input.Body as string;

      // 改行を含む値はダブルクォートで囲まれる
      expect(body).toContain('"タイトル\n改行含む"');
    });
  });

  describe('S3キー生成', () => {
    it('S3キーが正しいフォーマットで生成される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const format = 'json';

      // Act
      const s3_key = await exportToS3(export_id, mockDisclosures, format);

      // Assert
      // フォーマット: exports/YYYY/MM/DD/export_id.format
      expect(s3_key).toMatch(/^exports\/\d{4}\/\d{2}\/\d{2}\/export_\d+_[a-z0-9]+_[a-z0-9]+\.json$/);
    });
  });

  describe('ライフサイクルポリシー', () => {
    it('auto-deleteタグが設定される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const format = 'json';

      // Act
      await exportToS3(export_id, mockDisclosures, format);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutObjectCommand;
      expect(command.input.Tagging).toBe('auto-delete=true');
    });
  });
});

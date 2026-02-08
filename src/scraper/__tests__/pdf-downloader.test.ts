/**
 * PDFダウンローダーのユニットテスト
 *
 * Requirements: 要件1.3, 2.3（PDFダウンロード、整合性検証）
 */

import axios from 'axios';
import { downloadPdf, validatePdfFile } from '../pdf-downloader';
import { RetryableError, ValidationError } from '../../errors';

// モック設定
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('downloadPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('PDFファイルをダウンロードできる', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const pdfBuffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(20000)); // 20KB

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      // Act
      const result = await downloadPdf(url);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(pdfBuffer.length);
      expect(mockedAxios.get).toHaveBeenCalledWith(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'TDnet-Data-Collector/1.0',
        },
      });
    });
  });

  describe('異常系 - Retryable Errors', () => {
    it('ECONNABORTED エラーで RetryableError をスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Connection aborted');
      (error as any).code = 'ECONNABORTED';
      (error as any).isAxiosError = true;

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow(RetryableError);
      await expect(downloadPdf(url)).rejects.toThrow('Timeout downloading PDF');
    });

    it('ETIMEDOUT エラーで RetryableError をスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Connection timeout');
      (error as any).code = 'ETIMEDOUT';
      (error as any).isAxiosError = true;

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow(RetryableError);
      await expect(downloadPdf(url)).rejects.toThrow('Timeout downloading PDF');
    });

    it('500 エラーで RetryableError をスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Internal Server Error');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 500 };

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow(RetryableError);
      await expect(downloadPdf(url)).rejects.toThrow('Server error (500)');
    });

    it('503 エラーで RetryableError をスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Service Unavailable');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 503 };

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow(RetryableError);
      await expect(downloadPdf(url)).rejects.toThrow('Server error (503)');
    });
  });

  describe('異常系 - Non-Retryable Errors', () => {
    it('Axios以外のエラーはそのままスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Unknown error');

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow('Unknown error');
      await expect(downloadPdf(url)).rejects.not.toThrow(RetryableError);
    });

    it('404 エラーはそのままスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Not Found');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 404 };

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow('Not Found');
      await expect(downloadPdf(url)).rejects.not.toThrow(RetryableError);
    });

    it('400 エラーはそのままスローする', async () => {
      // Arrange
      const url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const error = new Error('Bad Request');
      (error as any).isAxiosError = true;
      (error as any).response = { status: 400 };

      mockedAxios.isAxiosError = jest.fn().mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(error);

      // Act & Assert
      await expect(downloadPdf(url)).rejects.toThrow('Bad Request');
      await expect(downloadPdf(url)).rejects.not.toThrow(RetryableError);
    });
  });
});

describe('validatePdfFile', () => {
  describe('正常系', () => {
    it('有効なPDFファイルを検証できる（最小サイズ）', () => {
      // Arrange: 10KB（最小サイズ）
      const buffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(10 * 1024 - 9));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('有効なPDFファイルを検証できる（最大サイズ）', () => {
      // Arrange: 50MB（最大サイズ）
      const buffer = Buffer.alloc(50 * 1024 * 1024);
      buffer.write('%PDF-1.4\n');

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('有効なPDFファイルを検証できる（中間サイズ）', () => {
      // Arrange: 1MB
      const buffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(1024 * 1024));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('PDF-1.5 ヘッダーを検証できる', () => {
      // Arrange
      const buffer = Buffer.from('%PDF-1.5\n' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('PDF-1.7 ヘッダーを検証できる', () => {
      // Arrange
      const buffer = Buffer.from('%PDF-1.7\n' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });
  });

  describe('異常系 - ファイルサイズ', () => {
    it('ファイルサイズが小さすぎる場合、ValidationError をスローする', () => {
      // Arrange: 9KB（10KB未満）
      const buffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(9 * 1024));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('PDF file too small');
    });

    it('ファイルサイズが大きすぎる場合、ValidationError をスローする', () => {
      // Arrange: 51MB（50MB超過）
      const buffer = Buffer.alloc(51 * 1024 * 1024);
      buffer.write('%PDF-1.4\n');

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('PDF file too large');
    });

    it('空のバッファの場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.alloc(0);

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('PDF file too small');
    });
  });

  describe('異常系 - PDFヘッダー', () => {
    it('PDFヘッダーがない場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.from('Not a PDF file' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('Invalid PDF header');
    });

    it('PDFヘッダーが不完全な場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.from('%PDF' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('Invalid PDF header');
    });

    it('HTMLファイルの場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.from('<html><body>Not a PDF</body></html>' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('Invalid PDF header');
    });

    it('バイナリデータだがPDFでない場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.from('\x89PNG\r\n\x1a\n' + 'a'.repeat(20000));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('Invalid PDF header');
    });
  });

  describe('エッジケース', () => {
    it('ちょうど10KBのPDFファイルを検証できる', () => {
      // Arrange: 10KB（境界値）
      const buffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(10 * 1024 - 9));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('ちょうど50MBのPDFファイルを検証できる', () => {
      // Arrange: 50MB（境界値）
      const buffer = Buffer.alloc(50 * 1024 * 1024);
      buffer.write('%PDF-1.4\n');

      // Act & Assert
      expect(() => validatePdfFile(buffer)).not.toThrow();
    });

    it('10KB - 1バイトの場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.from('%PDF-1.4\n' + 'a'.repeat(10 * 1024 - 10));

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('PDF file too small');
    });

    it('50MB + 1バイトの場合、ValidationError をスローする', () => {
      // Arrange
      const buffer = Buffer.alloc(50 * 1024 * 1024 + 1);
      buffer.write('%PDF-1.4\n');

      // Act & Assert
      expect(() => validatePdfFile(buffer)).toThrow(ValidationError);
      expect(() => validatePdfFile(buffer)).toThrow('PDF file too large');
    });
  });
});

/**
 * downloadPdf関数のユニットテスト
 *
 * Requirements: 要件1.3, 3.3, 6.1（PDFダウンロード、S3保存、エラーハンドリング）
 */

import axios from 'axios';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { downloadPdf } from '../download-pdf';
import { ValidationError } from '../../../errors';
import * as pdfDownloader from '../../../scraper/pdf-downloader';

// モック設定
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const s3Mock = mockClient(S3Client);

// axios.isAxiosErrorのモック（型エラー回避のためanyにキャスト）
(mockedAxios.isAxiosError as any) = jest.fn();

// validatePdfFileのモック
jest.spyOn(pdfDownloader, 'validatePdfFile').mockImplementation(() => {});

describe('downloadPdf', () => {
  const originalEnv = process.env.S3_BUCKET;

  beforeEach(() => {
    jest.clearAllMocks();
    s3Mock.reset();
    process.env.S3_BUCKET = 'test-bucket';
  });

  afterEach(() => {
    process.env.S3_BUCKET = originalEnv;
  });

  describe('正常系', () => {
    it('PDFをダウンロードしてS3に保存できる', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await downloadPdf(disclosure_id, pdf_url, disclosed_at);

      // Assert
      expect(result).toBe('2024/01/15/TD20240115001.pdf');
      expect(mockedAxios.get).toHaveBeenCalledWith(pdf_url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'TDnet-Data-Collector/1.0',
        },
      });
      expect(s3Mock.calls()).toHaveLength(1);
      expect(s3Mock.call(0).args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: '2024/01/15/TD20240115001.pdf',
        ContentType: 'application/pdf',
      });
    });

    it('月またぎ（UTC→JST）のS3キーを正しく生成できる', async () => {
      // Arrange: UTC 2024-01-31 15:30 → JST 2024-02-01 00:30
      const disclosure_id = 'TD20240131001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240131001.pdf';
      const disclosed_at = '2024-01-31T15:30:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await downloadPdf(disclosure_id, pdf_url, disclosed_at);

      // Assert
      expect(result).toBe('2024/02/01/TD20240131001.pdf');
    });

    it('年またぎ（UTC→JST）のS3キーを正しく生成できる', async () => {
      // Arrange: UTC 2023-12-31 15:30 → JST 2024-01-01 00:30
      const disclosure_id = 'TD20231231001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120231231001.pdf';
      const disclosed_at = '2023-12-31T15:30:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await downloadPdf(disclosure_id, pdf_url, disclosed_at);

      // Assert
      expect(result).toBe('2024/01/01/TD20231231001.pdf');
    });
  });

  describe('異常系', () => {
    it('タイムアウトエラーで再試行する', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';

      const timeoutError = new Error('Timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      (timeoutError as any).isAxiosError = true;

      // axios.isAxiosErrorがtrueを返すようにモック
      (mockedAxios.isAxiosError as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(downloadPdf(disclosure_id, pdf_url, disclosed_at)).rejects.toThrow();
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 初回 + 3回再試行
    });

    it('5xxエラーで再試行する', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';

      const serverError = new Error('Server Error');
      (serverError as any).isAxiosError = true;
      (serverError as any).response = { status: 503 };

      // axios.isAxiosErrorがtrueを返すようにモック
      (mockedAxios.isAxiosError as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(serverError);

      // Act & Assert
      await expect(downloadPdf(disclosure_id, pdf_url, disclosed_at)).rejects.toThrow();
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 初回 + 3回再試行
    });

    it('429エラーで再試行する', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';

      const rateLimitError = new Error('Too Many Requests');
      (rateLimitError as any).isAxiosError = true;
      (rateLimitError as any).response = { status: 429 };

      // axios.isAxiosErrorがtrueを返すようにモック
      (mockedAxios.isAxiosError as jest.Mock).mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(downloadPdf(disclosure_id, pdf_url, disclosed_at)).rejects.toThrow();
      expect(mockedAxios.get).toHaveBeenCalledTimes(4); // 初回 + 3回再試行
    });

    it('PDFバリデーションエラーで即座に失敗する', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';
      const invalidPdfBuffer = Buffer.from('not a pdf');

      mockedAxios.get.mockResolvedValue({
        data: invalidPdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      // validatePdfFileのモックを一時的に解除
      (pdfDownloader.validatePdfFile as jest.Mock).mockImplementationOnce(() => {
        throw new ValidationError('Invalid PDF header');
      });

      // Act & Assert
      await expect(downloadPdf(disclosure_id, pdf_url, disclosed_at)).rejects.toThrow(
        ValidationError
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // 再試行しない
    });

    it('S3アップロードエラーで失敗する', async () => {
      // Arrange
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).rejects(new Error('S3 upload failed'));

      // Act & Assert
      await expect(downloadPdf(disclosure_id, pdf_url, disclosed_at)).rejects.toThrow(
        'S3 upload failed'
      );
    });
  });

  describe('エッジケース', () => {
    it('うるう年2月末（UTC→JST）のS3キーを正しく生成できる', async () => {
      // Arrange: UTC 2024-02-29 15:00 → JST 2024-03-01 00:00
      const disclosure_id = 'TD20240229001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240229001.pdf';
      const disclosed_at = '2024-02-29T15:00:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await downloadPdf(disclosure_id, pdf_url, disclosed_at);

      // Assert
      expect(result).toBe('2024/03/01/TD20240229001.pdf');
    });

    it('環境変数S3_BUCKETが未設定の場合、デフォルト値を使用する', async () => {
      // Arrange
      delete process.env.S3_BUCKET;
      const disclosure_id = 'TD20240115001';
      const pdf_url = 'https://www.release.tdnet.info/inbs/140120240115001.pdf';
      const disclosed_at = '2024-01-15T10:30:00Z';
      const pdfBuffer = Buffer.from('%PDF-1.4\n%test content');

      mockedAxios.get.mockResolvedValue({
        data: pdfBuffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      await downloadPdf(disclosure_id, pdf_url, disclosed_at);

      // Assert
      const input = s3Mock.call(0).args[0].input as any;
      expect(input.Bucket).toBe('tdnet-data-collector-pdfs');
    });
  });
});

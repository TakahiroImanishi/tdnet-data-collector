/**
 * Generate Presigned URL Unit Tests
 *
 * Requirements: 要件4.4（PDFダウンロード）、要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actualModule,
    S3Client: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock('../../../utils/logger');

import { generatePresignedUrl, generatePresignedUrls } from '../generate-presigned-url';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('generatePresignedUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-pdfs-bucket';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  describe('正常系', () => {
    it('S3署名付きURLを生成できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expectedUrl =
        'https://test-pdfs-bucket.s3.amazonaws.com/2024/01/15/TD20240115001.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      const url = await generatePresignedUrl(s3Key);

      // Assert
      expect(url).toBe(expectedUrl);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      );
    });

    it('GetObjectCommandに正しいパラメータが設定される', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key);

      // Assert
      const command = mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand;
      expect(command.input.Bucket).toBe('test-pdfs-bucket');
      expect(command.input.Key).toBe(s3Key);
    });

    it('カスタム有効期限を指定できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expiresIn = 7200; // 2時間
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key, expiresIn);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 7200,
      });
    });

    it('デフォルト有効期限は3600秒（1時間）', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });
  });

  describe('異常系', () => {
    it('S3エラーで失敗する', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const s3Error = new Error('NoSuchKey');
      s3Error.name = 'NoSuchKey';

      mockGetSignedUrl.mockRejectedValue(s3Error);

      // Act & Assert
      await expect(generatePresignedUrl(s3Key)).rejects.toThrow('NoSuchKey');
    });

    it('AccessDeniedエラーで失敗する', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const accessDeniedError = new Error('AccessDenied');
      accessDeniedError.name = 'AccessDenied';

      mockGetSignedUrl.mockRejectedValue(accessDeniedError);

      // Act & Assert
      await expect(generatePresignedUrl(s3Key)).rejects.toThrow('AccessDenied');
    });

    it('ネットワークエラーで失敗する', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const networkError = new Error('Network error');

      mockGetSignedUrl.mockRejectedValue(networkError);

      // Act & Assert
      await expect(generatePresignedUrl(s3Key)).rejects.toThrow('Network error');
    });

    it('非Errorオブジェクトのエラーで失敗する', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const stringError = 'String error message';

      mockGetSignedUrl.mockRejectedValue(stringError);

      // Act & Assert
      await expect(generatePresignedUrl(s3Key)).rejects.toBe(stringError);
    });
  });

  describe('エッジケース', () => {
    it('環境変数S3_BUCKET_NAMEが設定されている', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key);

      // Assert
      const command = mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand;
      expect(command.input.Bucket).toBe('test-pdfs-bucket');
    });

    it('S3キーに日本語が含まれる場合も処理できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/決算短信_TD20240115001.pdf';
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      const url = await generatePresignedUrl(s3Key);

      // Assert
      expect(url).toBe(expectedUrl);
      const command = mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand;
      expect(command.input.Key).toBe(s3Key);
    });

    it('S3キーにスペースが含まれる場合も処理できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD 20240115 001.pdf';
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      const url = await generatePresignedUrl(s3Key);

      // Assert
      expect(url).toBe(expectedUrl);
      const command = mockGetSignedUrl.mock.calls[0][1] as GetObjectCommand;
      expect(command.input.Key).toBe(s3Key);
    });

    it('有効期限が0秒の場合も処理できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expiresIn = 0;
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key, expiresIn);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 0,
      });
    });

    it('有効期限が最大値（604800秒=7日）の場合も処理できる', async () => {
      // Arrange
      const s3Key = '2024/01/15/TD20240115001.pdf';
      const expiresIn = 604800; // 7日
      const expectedUrl = 'https://test-pdfs-bucket.s3.amazonaws.com/...';

      mockGetSignedUrl.mockResolvedValue(expectedUrl);

      // Act
      await generatePresignedUrl(s3Key, expiresIn);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 604800,
      });
    });
  });
});

describe('generatePresignedUrls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-pdfs-bucket';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  describe('正常系', () => {
    it('複数のS3署名付きURLを一括生成できる', async () => {
      // Arrange
      const s3Keys = [
        '2024/01/15/TD20240115001.pdf',
        '2024/01/15/TD20240115002.pdf',
        '2024/01/16/TD20240116001.pdf',
      ];

      mockGetSignedUrl.mockImplementation(async (_client, command) => {
        const key = (command as GetObjectCommand).input.Key;
        return `https://test-pdfs-bucket.s3.amazonaws.com/${key}?X-Amz-...`;
      });

      // Act
      const urlMap = await generatePresignedUrls(s3Keys);

      // Assert
      expect(urlMap.size).toBe(3);
      expect(urlMap.get(s3Keys[0])).toContain(s3Keys[0]);
      expect(urlMap.get(s3Keys[1])).toContain(s3Keys[1]);
      expect(urlMap.get(s3Keys[2])).toContain(s3Keys[2]);
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(3);
    });

    it('空配列の場合、空のMapを返す', async () => {
      // Arrange
      const s3Keys: string[] = [];

      // Act
      const urlMap = await generatePresignedUrls(s3Keys);

      // Assert
      expect(urlMap.size).toBe(0);
      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });

    it('カスタム有効期限を指定できる', async () => {
      // Arrange
      const s3Keys = ['2024/01/15/TD20240115001.pdf', '2024/01/15/TD20240115002.pdf'];
      const expiresIn = 7200; // 2時間

      mockGetSignedUrl.mockImplementation(async (_client, command) => {
        const key = (command as GetObjectCommand).input.Key;
        return `https://test-pdfs-bucket.s3.amazonaws.com/${key}?X-Amz-...`;
      });

      // Act
      await generatePresignedUrls(s3Keys, expiresIn);

      // Assert
      expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
      mockGetSignedUrl.mock.calls.forEach((call) => {
        expect(call[2]).toEqual({ expiresIn: 7200 });
      });
    });
  });

  describe('部分的失敗', () => {
    it('一部のURLが失敗しても、成功したURLは返す', async () => {
      // Arrange
      const s3Keys = [
        '2024/01/15/TD20240115001.pdf',
        '2024/01/15/TD20240115002.pdf',
        '2024/01/16/TD20240116001.pdf',
      ];

      mockGetSignedUrl.mockImplementation(async (_client, command) => {
        const key = (command as GetObjectCommand).input.Key;
        if (key === s3Keys[1]) {
          throw new Error('NoSuchKey');
        }
        return `https://test-pdfs-bucket.s3.amazonaws.com/${key}?X-Amz-...`;
      });

      // Act
      const urlMap = await generatePresignedUrls(s3Keys);

      // Assert
      expect(urlMap.size).toBe(2);
      expect(urlMap.has(s3Keys[0])).toBe(true);
      expect(urlMap.has(s3Keys[1])).toBe(false); // 失敗したキーは含まれない
      expect(urlMap.has(s3Keys[2])).toBe(true);
    });

    it('全てのURLが失敗した場合、空のMapを返す', async () => {
      // Arrange
      const s3Keys = ['2024/01/15/TD20240115001.pdf', '2024/01/15/TD20240115002.pdf'];

      mockGetSignedUrl.mockRejectedValue(new Error('AccessDenied'));

      // Act
      const urlMap = await generatePresignedUrls(s3Keys);

      // Assert
      expect(urlMap.size).toBe(0);
    });

    it('非Errorオブジェクトのエラーでも処理を継続する', async () => {
      // Arrange
      const s3Keys = [
        '2024/01/15/TD20240115001.pdf',
        '2024/01/15/TD20240115002.pdf',
        '2024/01/16/TD20240116001.pdf',
      ];

      mockGetSignedUrl.mockImplementation(async (_client, command) => {
        const key = (command as GetObjectCommand).input.Key;
        if (key === s3Keys[1]) {
          throw 'String error'; // 非Errorオブジェクト
        }
        return `https://test-pdfs-bucket.s3.amazonaws.com/${key}?X-Amz-...`;
      });

      // Act
      const urlMap = await generatePresignedUrls(s3Keys);

      // Assert
      expect(urlMap.size).toBe(2);
      expect(urlMap.has(s3Keys[0])).toBe(true);
      expect(urlMap.has(s3Keys[1])).toBe(false); // 失敗したキーは含まれない
      expect(urlMap.has(s3Keys[2])).toBe(true);
    });
  });

  describe('並行処理', () => {
    it('複数のURLを並行生成する', async () => {
      // Arrange
      const s3Keys = [
        '2024/01/15/TD20240115001.pdf',
        '2024/01/15/TD20240115002.pdf',
        '2024/01/16/TD20240116001.pdf',
        '2024/01/16/TD20240116002.pdf',
        '2024/01/17/TD20240117001.pdf',
      ];

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockGetSignedUrl.mockImplementation(async (_client, command) => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);

        // 非同期処理をシミュレート
        await new Promise((resolve) => setTimeout(resolve, 10));

        concurrentCalls--;
        const key = (command as GetObjectCommand).input.Key;
        return `https://test-pdfs-bucket.s3.amazonaws.com/${key}?X-Amz-...`;
      });

      // Act
      await generatePresignedUrls(s3Keys);

      // Assert
      expect(maxConcurrentCalls).toBeGreaterThan(1); // 並行実行されている
    });
  });
});

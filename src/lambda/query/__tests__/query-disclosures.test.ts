/**
 * Query Disclosures Unit Tests
 *
 * Requirements: 要件4.1（検索API）、要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actualModule,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

jest.mock('../../../utils/logger');
jest.mock('../../../utils/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()), // retryをバイパス
}));

import { queryDisclosures, QueryParams } from '../query-disclosures';
import { QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Disclosure } from '../../../types';

describe('queryDisclosures', () => {
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
      disclosure_id: '20240115_1234_002',
      company_code: '1234',
      company_name: 'テスト株式会社',
      disclosure_type: '有価証券報告書',
      title: '第50期有価証券報告書',
      disclosed_at: '2024-01-15T11:00:00Z',
      pdf_url: 'https://example.com/pdf/20240115_1234_002.pdf',
      pdf_s3_key: 'pdfs/2024/01/15/20240115_1234_002.pdf',
      downloaded_at: '2024-01-15T11:05:00Z',
      date_partition: '2024-01',
    },
    {
      disclosure_id: '20240116_5678_001',
      company_code: '5678',
      company_name: 'サンプル株式会社',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-16T09:00:00Z',
      pdf_url: 'https://example.com/pdf/20240116_5678_001.pdf',
      pdf_s3_key: 'pdfs/2024/01/16/20240116_5678_001.pdf',
      downloaded_at: '2024-01-16T09:05:00Z',
      date_partition: '2024-01',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    process.env.DYNAMODB_TABLE_NAME = 'test-disclosures-table';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  describe('企業コードでクエリ（GSI_CompanyCode_DiscloseDate使用）', () => {
    it('企業コードで開示情報を検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(result.disclosures[0].company_code).toBe('1234');
      expect(result.disclosures[1].company_code).toBe('1234');
      expect(result.total).toBe(2);
      expect(result.count).toBe(2);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.IndexName).toBe('GSI_CompanyCode_DiscloseDate');
      expect(command.input.KeyConditionExpression).toBe('company_code = :company_code');
    });

    it('企業コードと開始日で検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        start_date: '2024-01-15',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.KeyConditionExpression).toContain('disclosed_at >= :start_date');
    });

    it('企業コードと終了日で検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        end_date: '2024-01-15',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.KeyConditionExpression).toContain('disclosed_at <= :end_date');
    });

    it('企業コードと日付範囲で検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        start_date: '2024-01-15',
        end_date: '2024-01-15',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.KeyConditionExpression).toContain(
        'disclosed_at BETWEEN :start_date AND :end_date'
      );
    });
  });

  describe('日付範囲でクエリ（GSI_DatePartition使用）', () => {
    it('日付範囲で開示情報を検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        start_date: '2024-01-15',
        end_date: '2024-01-16',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(3);
      expect(result.total).toBe(3);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.IndexName).toBe('GSI_DatePartition');
      expect(command.input.KeyConditionExpression).toBe('date_partition = :partition');
    });

    it('開始日のみ指定した場合、今日までの範囲で検索する', async () => {
      // Arrange
      const params: QueryParams = {
        start_date: '2024-01-15',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures.length).toBeGreaterThan(0);
      expect(mockSend).toHaveBeenCalled();
    });

    it('複数月にまたがる日付範囲で検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        start_date: '2024-01-15',
        end_date: '2024-02-15',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      // Note: result is intentionally unused as we only test the mock calls
      await queryDisclosures(params);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(2); // 2024-01と2024-02の2回
      const command1 = mockSend.mock.calls[0][0] as QueryCommand;
      const command2 = mockSend.mock.calls[1][0] as QueryCommand;
      expect(command1.input.ExpressionAttributeValues?.[':partition'].S).toBe('2024-01');
      expect(command2.input.ExpressionAttributeValues?.[':partition'].S).toBe('2024-02');
    });
  });

  describe('フィルタなしクエリ（Scan使用）', () => {
    it('フィルタなしで全件検索できる', async () => {
      // Arrange
      const params: QueryParams = {
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(3);
      expect(result.total).toBe(3);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0] as ScanCommand;
      expect(command.input.TableName).toBe('test-disclosures-table');
    });
  });

  describe('開示種類フィルタリング', () => {
    it('開示種類でフィルタリングできる', async () => {
      // Arrange
      const params: QueryParams = {
        disclosure_type: '決算短信',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(result.disclosures.every((d) => d.disclosure_type === '決算短信')).toBe(true);
    });

    it('企業コードと開示種類で複合フィルタリングできる', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        disclosure_type: '決算短信',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(1);
      expect(result.disclosures[0].company_code).toBe('1234');
      expect(result.disclosures[0].disclosure_type).toBe('決算短信');
    });
  });

  describe('ソート', () => {
    it('開示日時で降順ソートされる', async () => {
      // Arrange
      const params: QueryParams = {
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(3);
      expect(result.disclosures[0].disclosed_at).toBe('2024-01-16T09:00:00Z');
      expect(result.disclosures[1].disclosed_at).toBe('2024-01-15T11:00:00Z');
      expect(result.disclosures[2].disclosed_at).toBe('2024-01-15T10:30:00Z');
    });
  });

  describe('ページネーション', () => {
    it('limitで取得件数を制限できる', async () => {
      // Arrange
      const params: QueryParams = {
        format: 'json',
        limit: 2,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('offsetで開始位置を指定できる', async () => {
      // Arrange
      const params: QueryParams = {
        format: 'json',
        limit: 2,
        offset: 1,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.total).toBe(3);
      expect(result.offset).toBe(1);
      expect(result.disclosures[0].disclosed_at).toBe('2024-01-15T11:00:00Z');
    });

    it('offsetが全件数を超える場合、空配列を返す', async () => {
      // Arrange
      const params: QueryParams = {
        format: 'json',
        limit: 10,
        offset: 10,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures.map((d) => marshall(d)),
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.total).toBe(3);
    });
  });

  describe('DynamoDBページネーション（LastEvaluatedKey）', () => {
    it('LastEvaluatedKeyがある場合、複数回クエリする', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      // 1回目のレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [marshall(mockDisclosures[0])],
        LastEvaluatedKey: { disclosure_id: { S: '20240115_1234_001' } },
      });

      // 2回目のレスポンス
      mockSend.mockResolvedValueOnce({
        Items: [marshall(mockDisclosures[1])],
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('エラーハンドリング', () => {
    it('DynamoDB ThrottlingExceptionで再試行する', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      const throttlingError = new Error('ThrottlingException');
      throttlingError.name = 'ThrottlingException';

      // retryWithBackoffのモックを一時的に変更
      const { retryWithBackoff } = require('../../../utils/retry');
      (retryWithBackoff as jest.Mock).mockImplementationOnce(async (_fn, options) => {
        // shouldRetryをテスト
        expect(options.shouldRetry(throttlingError)).toBe(true);
        // 実際には再試行せず、エラーをスロー
        throw throttlingError;
      });

      // Act & Assert
      await expect(queryDisclosures(params)).rejects.toThrow('ThrottlingException');
    });

    it('DynamoDB ProvisionedThroughputExceededExceptionで再試行する', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      const throughputError = new Error('ProvisionedThroughputExceededException');
      throughputError.name = 'ProvisionedThroughputExceededException';

      // retryWithBackoffのモックを一時的に変更
      const { retryWithBackoff } = require('../../../utils/retry');
      (retryWithBackoff as jest.Mock).mockImplementationOnce(async (_fn, options) => {
        // shouldRetryをテスト
        expect(options.shouldRetry(throughputError)).toBe(true);
        // 実際には再試行せず、エラーをスロー
        throw throughputError;
      });

      // Act & Assert
      await expect(queryDisclosures(params)).rejects.toThrow(
        'ProvisionedThroughputExceededException'
      );
    });

    it('その他のDynamoDBエラーで即座に失敗する', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      const validationError = new Error('ValidationException');
      validationError.name = 'ValidationException';

      mockSend.mockRejectedValue(validationError);

      // Act & Assert
      await expect(queryDisclosures(params)).rejects.toThrow('ValidationException');
    });
  });

  describe('エッジケース', () => {
    it('検索結果が0件の場合、空配列を返す', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '9999',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: [],
      });

      // Act
      const result = await queryDisclosures(params);

      // Assert
      expect(result.disclosures).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
    });

    it('環境変数DYNAMODB_TABLE_NAMEが設定されている', async () => {
      // Arrange
      const params: QueryParams = {
        company_code: '1234',
        format: 'json',
        limit: 10,
        offset: 0,
      };

      mockSend.mockResolvedValue({
        Items: mockDisclosures
          .filter((d) => d.company_code === '1234')
          .map((d) => marshall(d)),
      });

      // Act
      await queryDisclosures(params);

      // Assert
      const command = mockSend.mock.calls[0][0] as QueryCommand;
      expect(command.input.TableName).toBe('test-disclosures-table');
    });
  });
});

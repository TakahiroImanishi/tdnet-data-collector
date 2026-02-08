/**
 * Create Export Job Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
const mockSend = jest.fn();
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actualModule,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
}));

// retryWithBackoffは実際の実装を使用（ブランチカバレッジのため）
jest.mock('../../../utils/retry', () => {
  const actual = jest.requireActual('../../../utils/retry');
  return {
    retryWithBackoff: actual.retryWithBackoff,
  };
});

import { createExportJob } from '../create-export-job';
import { ExportRequestBody } from '../types';
import { PutItemCommand } from '@aws-sdk/client-dynamodb';

describe('createExportJob', () => {
  const mockRequestBody: ExportRequestBody = {
    format: 'json',
    filter: {
      company_code: '1234',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      disclosure_type: '決算短信',
    },
  };

  const mockRequestId = 'test-request-id-12345678';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerError.mockClear();

    // デフォルトでDynamoDB操作は成功
    mockSend.mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
    });

    // 環境変数設定
    process.env.EXPORT_STATUS_TABLE_NAME = 'test-export-status-table';
    process.env.AWS_REGION = 'ap-northeast-1';
    delete process.env.AWS_ENDPOINT_URL; // デフォルトでは未設定

    // Date.now()をモック（一貫したタイムスタンプ）
    jest.spyOn(Date, 'now').mockReturnValue(1705305600000); // 2024-01-15 10:00:00 UTC
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-15T10:00:00.000Z');
    jest.spyOn(Math, 'random').mockReturnValue(0.123456); // 一貫したランダム値
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('エクスポートジョブ作成成功', () => {
    it('エクスポートジョブを正常に作成できる', async () => {
      // Act
      const result = await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(result).toMatchObject({
        status: 'pending',
        requested_at: '2024-01-15T10:00:00.000Z',
        progress: 0,
        format: 'json',
        filter: JSON.stringify(mockRequestBody.filter),
      });

      expect(result.export_id).toMatch(/^export_\d+_[a-z0-9]+_.+$/);
      expect(result.ttl).toBeGreaterThan(Date.now() / 1000);
    });

    it('DynamoDBにPutItemCommandを送信する', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command).toBeInstanceOf(PutItemCommand);
      expect(command.input.TableName).toBe('test-export-status-table');
    });

    it('ログに作成開始と完了を記録する', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Creating export job',
        expect.objectContaining({
          format: 'json',
          filter: mockRequestBody.filter,
        })
      );

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Export job created successfully',
        expect.objectContaining({
          status: 'pending',
        })
      );

      // export_idが両方のログに含まれることを確認
      expect(mockLoggerInfo.mock.calls[0][1]).toHaveProperty('export_id');
      expect(mockLoggerInfo.mock.calls[1][1]).toHaveProperty('export_id');
    });
  });

  describe('エクスポートID生成', () => {
    it('エクスポートIDが正しいフォーマットで生成される', async () => {
      // Act
      const result = await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      // フォーマット: export_タイムスタンプ_ランダム文字列_リクエストID先頭8文字
      expect(result.export_id).toMatch(/^export_\d+_[a-z0-9]+_.+$/);
      expect(result.export_id).toContain('export_');
    });

    it('エクスポートIDにタイムスタンプが含まれる', async () => {
      // Act
      const result = await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(result.export_id).toContain('1705305600000');
    });

    it('エクスポートIDにリクエストIDの先頭8文字が含まれる', async () => {
      // Act
      const result = await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(result.export_id).toContain('test-req');
    });

    it('異なるリクエストIDで異なるエクスポートIDが生成される', async () => {
      // Arrange
      const requestId1 = 'request-id-1-12345678';
      const requestId2 = 'request-id-2-87654321';

      // Act
      const result1 = await createExportJob(mockRequestBody, requestId1);
      
      // 2回目の呼び出しで異なるランダム値を返す
      jest.spyOn(Math, 'random').mockReturnValue(0.987654);
      const result2 = await createExportJob(mockRequestBody, requestId2);

      // Assert
      expect(result1.export_id).not.toBe(result2.export_id);
    });
  });

  describe('DynamoDB保存', () => {
    it('ステータスがpendingで保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.status).toEqual({ S: 'pending' });
    });

    it('進捗率が0で保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.progress).toEqual({ N: '0' });
    });

    it('リクエスト日時がISO 8601形式で保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.requested_at).toEqual({ S: '2024-01-15T10:00:00.000Z' });
    });

    it('フォーマットが保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.format).toEqual({ S: 'json' });
    });

    it('フィルターがJSON文字列として保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.filter).toEqual({
        S: JSON.stringify(mockRequestBody.filter),
      });
    });

    it('CSV形式のリクエストも正しく保存される', async () => {
      // Arrange
      const csvRequestBody: ExportRequestBody = {
        format: 'csv',
        filter: {
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        },
      };

      // Act
      await createExportJob(csvRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.format).toEqual({ S: 'csv' });
    });
  });

  describe('TTL設定', () => {
    it('TTLが30日後に設定される', async () => {
      // Arrange
      const now = Date.now() / 1000; // Unix timestamp (秒)
      const expectedTtl = now + 30 * 24 * 60 * 60; // 30日後

      // Act
      const result = await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(result.ttl).toBeCloseTo(expectedTtl, 0);
    });

    it('TTLがDynamoDBに保存される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.Item?.ttl).toEqual({
        N: expect.stringMatching(/^\d+$/),
      });

      const ttlValue = parseInt(command.input.Item?.ttl?.N || '0', 10);
      const now = Date.now() / 1000;
      const expectedTtl = now + 30 * 24 * 60 * 60;
      expect(ttlValue).toBeCloseTo(expectedTtl, 0);
    });
  });

  describe('ConditionExpression（重複防止）', () => {
    it('ConditionExpressionが設定される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.ConditionExpression).toBe('attribute_not_exists(export_id)');
    });
  });

  describe('再試行設定', () => {
    it('ProvisionedThroughputExceededExceptionで再試行する', async () => {
      // Arrange
      let attemptCount = 0;
      mockSend.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Provisioned throughput exceeded');
          error.name = 'ProvisionedThroughputExceededException';
          return Promise.reject(error);
        }
        return Promise.resolve({ $metadata: { httpStatusCode: 200 } });
      });

      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(3);
      expect(attemptCount).toBe(3);
    });

    it('その他のエラーでは再試行しない', async () => {
      // Arrange
      const error = new Error('Validation error');
      error.name = 'ValidationException';
      mockSend.mockRejectedValue(error);

      // Act & Assert
      await expect(createExportJob(mockRequestBody, mockRequestId)).rejects.toThrow(
        'Validation error'
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('ResourceNotFoundExceptionでは再試行しない', async () => {
      // Arrange
      const error = new Error('Resource not found');
      error.name = 'ResourceNotFoundException';
      mockSend.mockRejectedValue(error);

      // Act & Assert
      await expect(createExportJob(mockRequestBody, mockRequestId)).rejects.toThrow(
        'Resource not found'
      );
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('DynamoDBエラーが発生した場合、エラーを伝播する', async () => {
      // Arrange
      const dynamoError = new Error('DynamoDB error');
      dynamoError.name = 'InternalServerError';
      mockSend.mockRejectedValue(dynamoError);

      // Act & Assert
      await expect(createExportJob(mockRequestBody, mockRequestId)).rejects.toThrow(
        'DynamoDB error'
      );
    });

    it('ProvisionedThroughputExceededExceptionが発生した場合、再試行後にエラーを伝播する', async () => {
      // Arrange
      const throughputError = new Error('Provisioned throughput exceeded');
      throughputError.name = 'ProvisionedThroughputExceededException';
      mockSend.mockRejectedValue(throughputError);

      // Act & Assert
      await expect(createExportJob(mockRequestBody, mockRequestId)).rejects.toThrow(
        'Provisioned throughput exceeded'
      );
      // 再試行されることを確認（maxRetries: 3 + 初回 = 4回）
      expect(mockSend).toHaveBeenCalledTimes(4);
    });

    it('ConditionalCheckFailedExceptionが発生した場合、エラーを伝播する', async () => {
      // Arrange
      const conditionalError = new Error('Conditional check failed');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(conditionalError);

      // Act & Assert
      await expect(createExportJob(mockRequestBody, mockRequestId)).rejects.toThrow(
        'Conditional check failed'
      );
      // 再試行されないことを確認
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('環境変数', () => {
    it('EXPORT_STATUS_TABLE_NAMEが使用される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      // beforeEachで設定された環境変数が使用されることを確認
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.TableName).toBe('test-export-status-table');
      expect(process.env.EXPORT_STATUS_TABLE_NAME).toBe('test-export-status-table');
    });

    it('環境変数が正しく読み込まれる', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      // 環境変数が設定されていることを確認
      expect(process.env.EXPORT_STATUS_TABLE_NAME).toBeDefined();
      expect(process.env.AWS_REGION).toBeDefined();
    });

    it('テーブル名が環境変数から取得される', async () => {
      // Act
      await createExportJob(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      // 環境変数で設定されたテーブル名が使用される
      expect(command.input.TableName).toBe(process.env.EXPORT_STATUS_TABLE_NAME);
    });

    it('EXPORT_STATUS_TABLE_NAMEが未設定の場合、デフォルト値が使用される', async () => {
      // Arrange
      delete process.env.EXPORT_STATUS_TABLE_NAME;
      
      // モジュールを再読み込みしてデフォルト値を適用
      jest.resetModules();
      const { createExportJob: createExportJobReloaded } = require('../create-export-job');

      // Act
      await createExportJobReloaded(mockRequestBody, mockRequestId);

      // Assert
      const command = mockSend.mock.calls[0][0] as PutItemCommand;
      expect(command.input.TableName).toBe('tdnet-export-status');
    });

    it('AWS_ENDPOINT_URLが設定されている場合、エンドポイントが使用される', async () => {
      // Arrange
      process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
      
      // モジュールを再読み込みしてエンドポイント設定を適用
      jest.resetModules();
      jest.mock('@aws-sdk/client-dynamodb', () => {
        const actualModule = jest.requireActual('@aws-sdk/client-dynamodb');
        return {
          ...actualModule,
          DynamoDBClient: jest.fn().mockImplementation((config) => {
            // エンドポイントが設定されていることを確認
            expect(config.endpoint).toBe('http://localhost:4566');
            return { send: mockSend };
          }),
        };
      });
      
      const { createExportJob: createExportJobReloaded } = require('../create-export-job');

      // Act
      await createExportJobReloaded(mockRequestBody, mockRequestId);

      // Assert
      expect(mockSend).toHaveBeenCalled();
    });

    it('AWS_REGIONが未設定の場合、デフォルトリージョンが使用される', async () => {
      // Arrange
      delete process.env.AWS_REGION;
      
      // モジュールを再読み込みしてデフォルトリージョンを適用
      jest.resetModules();
      jest.mock('@aws-sdk/client-dynamodb', () => {
        const actualModule = jest.requireActual('@aws-sdk/client-dynamodb');
        return {
          ...actualModule,
          DynamoDBClient: jest.fn().mockImplementation((config) => {
            // デフォルトリージョンが設定されていることを確認
            expect(config.region).toBe('ap-northeast-1');
            return { send: mockSend };
          }),
        };
      });
      
      const { createExportJob: createExportJobReloaded } = require('../create-export-job');

      // Act
      await createExportJobReloaded(mockRequestBody, mockRequestId);

      // Assert
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('フィルター条件のバリエーション', () => {
    it('企業コードのみのフィルターで作成できる', async () => {
      // Arrange
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {
          company_code: '1234',
        },
      };

      // Act
      const result = await createExportJob(requestBody, mockRequestId);

      // Assert
      expect(result.filter).toBe(JSON.stringify({ company_code: '1234' }));
    });

    it('日付範囲のみのフィルターで作成できる', async () => {
      // Arrange
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        },
      };

      // Act
      const result = await createExportJob(requestBody, mockRequestId);

      // Assert
      expect(result.filter).toBe(
        JSON.stringify({
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        })
      );
    });

    it('開示種類のみのフィルターで作成できる', async () => {
      // Arrange
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {
          disclosure_type: '決算短信',
        },
      };

      // Act
      const result = await createExportJob(requestBody, mockRequestId);

      // Assert
      expect(result.filter).toBe(JSON.stringify({ disclosure_type: '決算短信' }));
    });

    it('空のフィルターで作成できる', async () => {
      // Arrange
      const requestBody: ExportRequestBody = {
        format: 'json',
        filter: {},
      };

      // Act
      const result = await createExportJob(requestBody, mockRequestId);

      // Assert
      expect(result.filter).toBe(JSON.stringify({}));
    });
  });
});

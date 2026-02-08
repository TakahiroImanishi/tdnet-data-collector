/**
 * Lambda Export Handler Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

import { Context } from 'aws-lambda';
import { handler } from '../handler';
import { ExportEvent } from '../types';
import * as createExportJob from '../create-export-job';
import * as processExport from '../process-export';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

// モック
jest.mock('../create-export-job');
jest.mock('../process-export');
jest.mock('../../../utils/logger');
jest.mock('../../../utils/cloudwatch-metrics');

// Secrets Managerモック
const secretsManagerMock = mockClient(SecretsManagerClient);

describe('Lambda Export Handler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'tdnet-export',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-export',
    memoryLimitInMB: '512',
    logGroupName: '/aws/lambda/tdnet-export',
    logStreamName: '2024/01/15/[$LATEST]test',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeEach(() => {
    // Secrets Managerモックのセットアップ
    secretsManagerMock.reset();
    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key',
    });

    jest.clearAllMocks();
    process.env.API_KEY = 'test-api-key';
  });

  describe('正常系', () => {
    it('JSON形式のエクスポートリクエストを受け付ける', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      const mockExportJob = {
        export_id: 'export_1705305600000_abc123_12345678',
        status: 'pending' as const,
        requested_at: '2024-01-15T10:00:00Z',
        progress: 0,
        ttl: 1707897600,
        format: 'json' as const,
        filter: JSON.stringify({ start_date: '2024-01-15', end_date: '2024-01-20' }),
      };

      jest.spyOn(createExportJob, 'createExportJob').mockResolvedValue(mockExportJob);
      jest.spyOn(processExport, 'processExport').mockResolvedValue(undefined);

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(202);
      expect(JSON.parse(result.body)).toEqual({
        export_id: mockExportJob.export_id,
        status: 'pending',
        message: 'Export job created successfully',
        progress: 0,
      });
      expect(createExportJob.createExportJob).toHaveBeenCalledWith(
        {
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        },
        mockContext.awsRequestId
      );
    });

    it('CSV形式のエクスポートリクエストを受け付ける', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'csv',
          filter: {
            company_code: '1234',
            start_date: '2024-01-01',
            end_date: '2024-01-31',
          },
        }),
      } as ExportEvent;

      const mockExportJob = {
        export_id: 'export_1705305600000_def456_87654321',
        status: 'pending' as const,
        requested_at: '2024-01-15T10:00:00Z',
        progress: 0,
        ttl: 1707897600,
        format: 'csv' as const,
        filter: JSON.stringify({
          company_code: '1234',
          start_date: '2024-01-01',
          end_date: '2024-01-31',
        }),
      };

      jest.spyOn(createExportJob, 'createExportJob').mockResolvedValue(mockExportJob);
      jest.spyOn(processExport, 'processExport').mockResolvedValue(undefined);

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(202);
      expect(JSON.parse(result.body)).toEqual({
        export_id: mockExportJob.export_id,
        status: 'pending',
        message: 'Export job created successfully',
        progress: 0,
      });
    });
  });

  describe('異常系: APIキー認証', () => {
    it('APIキーが未指定の場合は401エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {},
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key is required',
          details: {},
        },
        request_id: mockContext.awsRequestId,
      });
    });

    it('APIキーが不正な場合は401エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'invalid-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      expect(JSON.parse(result.body)).toEqual({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
          details: {},
        },
        request_id: mockContext.awsRequestId,
      });
    });
  });

  describe('異常系: バリデーション', () => {
    it('リクエストボディが空の場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: '',
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なJSON形式の場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: 'invalid json',
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なフォーマットの場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'xml', // 不正なフォーマット
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toContain('Invalid format');
    });

    it('不正な日付フォーマットの場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024/01/15', // 不正なフォーマット
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toContain('Invalid start_date format');
    });

    it('開始日が終了日より後の場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-20',
            end_date: '2024-01-15', // 開始日より前
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toContain(
        'start_date (2024-01-20) must be before or equal to end_date (2024-01-15)'
      );
    });

    it('不正な企業コードの場合は400エラーを返す', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            company_code: '12345', // 5桁（不正）
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body).error.message).toContain('Invalid company_code format');
    });
  });

  describe('CORS対応', () => {
    it('レスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange
      const event: ExportEvent = {
        headers: {
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as ExportEvent;

      const mockExportJob = {
        export_id: 'export_1705305600000_abc123_12345678',
        status: 'pending' as const,
        requested_at: '2024-01-15T10:00:00Z',
        progress: 0,
        ttl: 1707897600,
        format: 'json' as const,
        filter: JSON.stringify({ start_date: '2024-01-15', end_date: '2024-01-20' }),
      };

      jest.spyOn(createExportJob, 'createExportJob').mockResolvedValue(mockExportJob);
      jest.spyOn(processExport, 'processExport').mockResolvedValue(undefined);

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.headers).toEqual({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
      });
    });
  });
});

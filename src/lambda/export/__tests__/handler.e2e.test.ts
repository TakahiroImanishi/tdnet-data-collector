/**
 * Lambda Export Handler E2E Tests
 *
 * Property 9: APIキー認証の必須性
 *
 * Requirements: 要件11.3, 14.4（E2Eテスト、API認証）
 *
 * このE2Eテストは、LocalStack環境または開発環境で実行され、
 * 実際のAWS SDKクライアントを使用してAPIキー認証を検証します。
 */

import { Context } from 'aws-lambda';
import { handler } from '../handler';
import { ExportEvent } from '../types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';

// Secrets Managerモック
const secretsManagerMock = mockClient(SecretsManagerClient);

// LocalStack環境設定
const isLocalStack = process.env.AWS_ENDPOINT_URL !== undefined;
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

describe('Lambda Export Handler E2E Tests - Property 9: API Key Authentication', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id-e2e-export',
    functionName: 'tdnet-export-e2e',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-export-e2e',
    memoryLimitInMB: '512',
    logGroupName: '/aws/lambda/tdnet-export-e2e',
    logStreamName: '2024/01/15/[$LATEST]e2e-test',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  const tableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet-disclosures-local';
  const exportTableName = process.env.EXPORT_STATUS_TABLE_NAME || 'tdnet_executions';

  beforeEach(() => {
    // Secrets Managerモックのセットアップ
    secretsManagerMock.reset();
    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key-e2e-export',
    });

    // 環境変数設定
    process.env.API_KEY = 'test-api-key-e2e-export';
    process.env.DYNAMODB_TABLE_NAME = tableName;
    process.env.EXPORT_STATUS_TABLE_NAME = exportTableName;
    process.env.S3_BUCKET_NAME = 'tdnet-pdfs-local';
  });

  describe('Property 9.1: 無効なAPIキーで401 Unauthorizedが返される', () => {
    it('APIキーが未指定の場合は401エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {},
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
      expect(body.request_id).toBe(mockContext.awsRequestId);

      // CORSヘッダーの確認
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Headers']).toContain('X-Api-Key');
    });

    it('APIキーが不正な場合は401エラーを返す', async () => {
      // Arrange
      const event = {
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
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('error');
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
      expect(body.request_id).toBe(mockContext.awsRequestId);

      // CORSヘッダーの確認
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('大文字小文字が異なるヘッダー名でも認証が機能する', async () => {
      // Arrange
      const event = {
        headers: {
          'X-Api-Key': 'invalid-api-key', // 大文字
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
    });

    it('空文字列のAPIキーは401エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': '', // 空文字列
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Property 9.2: 有効なAPIキーで正常にレスポンスが返される', () => {
    it('JSON形式のエクスポートリクエストが受け付けられる', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(202); // Accepted
      expect(result.headers?.['Content-Type']).toBe('application/json');
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');

      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('export_id');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('progress');

      // エクスポートIDの形式確認（base36形式: 数字とa-zの小文字、requestIdPrefixにはハイフンも含まれる）
      expect(body.export_id).toMatch(/^export_\d+_[a-z0-9]+_[a-z0-9\-]+$/);
      expect(body.status).toBe('pending');
      expect(body.message).toContain('Export job created successfully');
      expect(body.progress).toBe(0);

      // DynamoDBにエクスポートジョブが作成されたか確認
      const getResult = await docClient.send(
        new GetCommand({
          TableName: exportTableName,
          Key: { export_id: body.export_id },
        })
      );

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.export_id).toBe(body.export_id);
      // ステータスは pending または processing（バックグラウンド処理が開始されている場合）
      expect(['pending', 'processing']).toContain(getResult.Item?.status);
      expect(getResult.Item?.format).toBe('json');
    });

    it('CSV形式のエクスポートリクエストが受け付けられる', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'csv',
          filter: {
            company_code: '1234',
            start_date: '2024-01-01',
            end_date: '2024-01-31',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.export_id).toBeDefined();
      expect(body.status).toBe('pending');

      // DynamoDBにエクスポートジョブが作成されたか確認
      const getResult = await docClient.send(
        new GetCommand({
          TableName: exportTableName,
          Key: { export_id: body.export_id },
        })
      );

      expect(getResult.Item).toBeDefined();
      expect(getResult.Item?.format).toBe('csv');
      const filter = JSON.parse(getResult.Item?.filter || '{}');
      expect(filter.company_code).toBe('1234');
    });

    it('有効なAPIキーで複数のエクスポートリクエストが処理できる', async () => {
      // Arrange
      const event1 = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      const event2 = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'csv',
          filter: {
            start_date: '2024-01-01',
            end_date: '2024-01-31',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result1 = await handler(event1, mockContext);
      const result2 = await handler(event2, mockContext);

      // Assert
      expect(result1.statusCode).toBe(202);
      expect(result2.statusCode).toBe(202);

      const body1 = JSON.parse(result1.body);
      const body2 = JSON.parse(result2.body);

      // 異なるエクスポートIDが生成される
      expect(body1.export_id).not.toBe(body2.export_id);
    });
  });

  describe('Property 9.3: APIキー認証とバリデーションの組み合わせ', () => {
    it('有効なAPIキーでも不正なフォーマットは400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'xml', // 不正なフォーマット
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid format');
    });

    it('有効なAPIキーでも不正な日付フォーマットは400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024/01/15', // 不正なフォーマット
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid start_date format');
    });

    it('有効なAPIキーでも開始日が終了日より後の場合は400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-20',
            end_date: '2024-01-15', // 開始日より前
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('start_date');
      expect(body.error.message).toContain('must be before or equal to');
      expect(body.error.message).toContain('end_date');
    });

    it('有効なAPIキーでも不正な企業コードは400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: JSON.stringify({
          format: 'json',
          filter: {
            company_code: '12345', // 5桁（不正）
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid company_code format');
    });

    it('有効なAPIキーでもリクエストボディが空の場合は400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: '',
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('有効なAPIキーでも不正なJSON形式は400エラーを返す', async () => {
      // Arrange
      const event = {
        headers: {
          'x-api-key': 'test-api-key-e2e-export',
        },
        body: 'invalid json',
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Property 9.4: エラーレスポンスの一貫性', () => {
    it('すべてのエラーレスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange: APIキーなし
      const event = {
        headers: {},
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*');
      expect(result.headers?.['Access-Control-Allow-Headers']).toContain('X-Api-Key');
      expect(result.headers?.['Content-Type']).toBe('application/json');
    });

    it('すべてのエラーレスポンスにrequest_idが含まれる', async () => {
      // Arrange: 無効なAPIキー
      const event = {
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
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.request_id).toBe(mockContext.awsRequestId);
    });

    it('エラーレスポンスの構造が一貫している', async () => {
      // Arrange: APIキーなし
      const event = {
        headers: {},
        body: JSON.stringify({
          format: 'json',
          filter: {
            start_date: '2024-01-15',
            end_date: '2024-01-20',
          },
        }),
      } as unknown as ExportEvent;

      // Act
      const result = await handler(event, mockContext);

      // Assert
      const body = JSON.parse(result.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('request_id');
      expect(body.status).toBe('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
      expect(body.error).toHaveProperty('details');
      expect(typeof body.error.code).toBe('string');
      expect(typeof body.error.message).toBe('string');
      expect(typeof body.error.details).toBe('object');
    });
  });
});

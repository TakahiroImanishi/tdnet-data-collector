/**
 * Lambda PDF Download Handler Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

import { Context } from 'aws-lambda';
import { handler } from '../handler';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// モック
jest.mock('../../../../utils/logger');
jest.mock('../../../../utils/cloudwatch-metrics');
jest.mock('@aws-sdk/s3-request-presigner');

// AWS SDKモック
const dynamoMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);
const secretsManagerMock = mockClient(SecretsManagerClient);

describe('Lambda PDF Download Handler', () => {
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'tdnet-pdf-download',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-pdf-download',
    memoryLimitInMB: '512',
    logGroupName: '/aws/lambda/tdnet-pdf-download',
    logStreamName: '2024/01/15/[$LATEST]test',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  beforeEach(() => {
    // モックのリセット
    dynamoMock.reset();
    s3Mock.reset();
    secretsManagerMock.reset();
    jest.clearAllMocks();

    // デフォルトのモック設定
    process.env.API_KEY = 'test-api-key';
    process.env.DYNAMODB_TABLE_NAME = 'tdnet_disclosures';
    process.env.S3_BUCKET_NAME = 'tdnet-pdfs';

    secretsManagerMock.on(GetSecretValueCommand).resolves({
      SecretString: 'test-api-key',
    });

    (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.amazonaws.com/signed-url');
  });

  describe('正常系', () => {
    it('PDF署名付きURLを正常に生成する', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        queryStringParameters: {
          expiration: '3600',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: 'pdfs/2024/01/20240115_7203_001.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data.download_url).toBe('https://s3.amazonaws.com/signed-url');
      expect(body.data.expires_at).toBeDefined();
    });

    it('デフォルトの有効期限（3600秒）を使用する', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        queryStringParameters: {},
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: 'pdfs/2024/01/20240115_7203_001.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
    });
  });

  describe('異常系: APIキー認証', () => {
    it('APIキーが未指定の場合は401エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {},
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
    });

    it('APIキーが不正な場合は401エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {
          'x-api-key': 'invalid-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
    });
  });

  describe('異常系: バリデーション', () => {
    it('disclosure_idが未指定の場合は400エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {},
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('disclosure_id is required');
    });

    it('disclosure_idのフォーマットが不正な場合は400エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: 'invalid-format',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid disclosure_id format');
    });

    it('expirationが数値でない場合は400エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        queryStringParameters: {
          expiration: 'invalid',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid expiration format');
    });

    it('expirationが範囲外の場合は400エラーを返す（最小値未満）', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        queryStringParameters: {
          expiration: '30', // 60秒未満
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Expiration out of range');
    });

    it('expirationが範囲外の場合は400エラーを返す（最大値超過）', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        queryStringParameters: {
          expiration: '90000', // 86400秒超過
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Expiration out of range');
    });
  });

  describe('異常系: データ取得', () => {
    it('開示情報が見つからない場合は404エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: undefined,
      });

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Disclosure not found');
    });

    it('pdf_s3_keyが存在しない場合は404エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          // pdf_s3_keyなし
        },
      });

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('PDF file not found');
    });

    it('S3オブジェクトが存在しない場合は404エラーを返す', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: 'pdfs/2024/01/20240115_7203_001.pdf' },
        },
      });

      const notFoundError: any = new Error('NotFound');
      notFoundError.name = 'NotFound';
      notFoundError.$metadata = { httpStatusCode: 404 };
      s3Mock.on(HeadObjectCommand).rejects(notFoundError);

      // Act
      const result = await handler(event, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('PDF file not found in S3');
    });
  });

  describe('CORS対応', () => {
    it('レスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange
      const event: any = {
        pathParameters: {
          disclosure_id: '20240115_7203_001',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: 'pdfs/2024/01/20240115_7203_001.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

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

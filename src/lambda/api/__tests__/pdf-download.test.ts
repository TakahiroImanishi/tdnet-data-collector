/**
 * PDF Download Lambda Function Tests
 *
 * GET /disclosures/{disclosure_id}/pdf エンドポイントのテスト
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { handler } from '../pdf-download/handler';

// モック
const dynamoMock = mockClient(DynamoDBClient);
const s3Mock = mockClient(S3Client);

// getSignedUrlのモック
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/signed-url'),
}));

// テスト用のContext
const mockContext: Context = {
  awsRequestId: 'test-request-id',
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:test',
  memoryLimitInMB: '256',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/15/[$LATEST]test',
  callbackWaitsForEmptyEventLoop: true,
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
} as Context;

describe('PDF Download Lambda Handler', () => {
  beforeEach(() => {
    dynamoMock.reset();
    s3Mock.reset();
    process.env.DYNAMODB_TABLE_NAME = 'tdnet_disclosures';
    process.env.S3_BUCKET_NAME = 'tdnet-data-collector-pdfs';
    process.env.API_KEY = 'test-api-key';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('正常系', () => {
    it('署名付きURLを正しく生成して返却する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        queryStringParameters: {},
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: '2024/01/15/TD20240115001_7203.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.status).toBe('success');
      expect(body.data).toHaveProperty('download_url');
      expect(body.data).toHaveProperty('expires_at');
      expect(body.data.download_url).toBe('https://s3.amazonaws.com/signed-url');
    });

    it('カスタムexpiration（7200秒）で署名付きURLを生成する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        queryStringParameters: { expiration: '7200' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: '2024/01/15/TD20240115001_7203.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.download_url).toBe('https://s3.amazonaws.com/signed-url');
    });
  });

  describe('異常系 - バリデーションエラー', () => {
    it('disclosure_idが未指定の場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: {},
        headers: { 'x-api-key': 'test-api-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('disclosure_id is required');
    });

    it('disclosure_idのフォーマットが不正な場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: 'invalid-format' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid disclosure_id format');
    });

    it('expirationが範囲外の場合、400エラーを返す（最小値未満）', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        queryStringParameters: { expiration: '30' }, // 60秒未満
        headers: { 'x-api-key': 'test-api-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Expiration out of range');
    });

    it('expirationが範囲外の場合、400エラーを返す（最大値超過）', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        queryStringParameters: { expiration: '90000' }, // 86400秒超過
        headers: { 'x-api-key': 'test-api-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Expiration out of range');
    });

    it('expirationが数値でない場合、400エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        queryStringParameters: { expiration: 'invalid' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain('Invalid expiration format');
    });
  });

  describe('異常系 - 認証エラー', () => {
    it('APIキーが未指定の場合、401エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: {},
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('API key is required');
    });

    it('APIキーが不正な場合、401エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'invalid-key' },
      };

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Invalid API key');
    });
  });

  describe('異常系 - リソース不存在', () => {
    it('開示情報が存在しない場合、404エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_9999_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: undefined,
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('Disclosure not found');
    });

    it('pdf_s3_keyが存在しない場合、404エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          // pdf_s3_keyが存在しない
        },
      });

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('PDF file not found');
    });

    it('S3オブジェクトが存在しない場合、404エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: '2024/01/15/TD20240115001_7203.pdf' },
        },
      });

      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      (notFoundError as any).$metadata = { httpStatusCode: 404 };
      s3Mock.on(HeadObjectCommand).rejects(notFoundError);

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
      expect(body.error.message).toContain('PDF file not found in S3');
    });
  });

  describe('異常系 - DynamoDBエラー', () => {
    it('DynamoDBエラー時、再試行後に500エラーを返す', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('ProvisionedThroughputExceededException時、再試行する', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      const throttleError = new Error('ProvisionedThroughputExceededException');
      throttleError.name = 'ProvisionedThroughputExceededException';

      dynamoMock
        .on(GetItemCommand)
        .rejectsOnce(throttleError)
        .resolves({
          Item: {
            disclosure_id: { S: '20240115_7203_001' },
            company_code: { S: '7203' },
            company_name: { S: 'トヨタ自動車株式会社' },
            pdf_s3_key: { S: '2024/01/15/TD20240115001_7203.pdf' },
          },
        });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(dynamoMock.calls()).toHaveLength(2); // 1回失敗、2回目成功
    });
  });

  describe('CORS対応', () => {
    it('レスポンスにCORSヘッダーが含まれる', async () => {
      // Arrange
      const event: Partial<APIGatewayProxyEvent> = {
        pathParameters: { disclosure_id: '20240115_7203_001' },
        headers: { 'x-api-key': 'test-api-key' },
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          disclosure_id: { S: '20240115_7203_001' },
          company_code: { S: '7203' },
          company_name: { S: 'トヨタ自動車株式会社' },
          pdf_s3_key: { S: '2024/01/15/TD20240115001_7203.pdf' },
        },
      });

      s3Mock.on(HeadObjectCommand).resolves({});

      // Act
      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      // Assert
      expect(result.headers).toHaveProperty('Access-Control-Allow-Origin', '*');
      expect(result.headers).toHaveProperty('Access-Control-Allow-Headers');
    });
  });
});

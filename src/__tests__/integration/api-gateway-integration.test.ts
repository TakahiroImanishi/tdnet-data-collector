/**
 * API Gateway統合テスト
 *
 * API Gateway、CORS設定、認証、レート制限、エンドポイント統合を検証します。
 *
 * Requirements: タスク40（統合テストの拡充）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Context } from 'aws-lambda';
import { handler as queryHandler } from '../../lambda/query/handler';
import { handler as getDisclosureHandler } from '../../lambda/get-disclosure/handler';
import { handler as healthHandler } from '../../lambda/health/handler';
import {
  setupAllDefaultMocks,
  resetAllMocks,
  mockDynamoQuery,
  mockDynamoGetItem,
  createDisclosure,
} from '../test-helpers';

// モックContext
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:test',
  memoryLimitInMB: '512',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: '2024/01/01/[$LATEST]test',
  getRemainingTimeInMillis: () => 300000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('API Gateway統合テスト', () => {
  beforeEach(() => {
    // 環境変数の設定
    process.env.DYNAMODB_TABLE = 'tdnet_disclosures_test';
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'tdnet_executions_test';
    process.env.S3_BUCKET = 'tdnet-pdfs-test';
    process.env.LOG_LEVEL = 'ERROR';

    // モックのセットアップ
    setupAllDefaultMocks();
  });

  afterEach(() => {
    // モックのリセット
    resetAllMocks();

    // 環境変数のクリーンアップ
    delete process.env.DYNAMODB_TABLE;
    delete process.env.DYNAMODB_EXECUTIONS_TABLE;
    delete process.env.S3_BUCKET;
    delete process.env.LOG_LEVEL;
  });

  describe('CORS設定', () => {
    it('すべてのエンドポイントでCORSヘッダーが返されること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      // Query実行
      const queryEvent = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(queryEvent as any, mockContext);

      // CORSヘッダーの検証
      expect(response.headers).toBeDefined();
      expect(response.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers!['Access-Control-Allow-Methods']).toContain('GET');
      expect(response.headers!['Access-Control-Allow-Headers']).toContain('Content-Type');
    });

    it('OPTIONSリクエストで200が返されること', async () => {
      // OPTIONSリクエスト（プリフライト）
      const optionsEvent = {
        httpMethod: 'OPTIONS',
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await healthHandler(optionsEvent as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);

      // CORSヘッダーの検証
      expect(response.headers).toBeDefined();
      expect(response.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('認証', () => {
    it('APIキーなしでリクエストが成功すること（認証なしエンドポイント）', async () => {
      // ヘルスチェックエンドポイント
      const event = {
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await healthHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);
    });

    it('APIキーありでリクエストが成功すること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      // APIキー付きリクエスト
      const event = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        headers: {
          'x-api-key': 'test-api-key',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);
    });
  });

  describe('レート制限', () => {
    it('連続リクエストが処理されること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      // 連続リクエスト（5回）
      const requests = Array.from({ length: 5 }, (_, i) => ({
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        requestContext: {
          requestId: `test-request-id-${i}`,
        },
      }));

      const responses = await Promise.all(
        requests.map((event) => queryHandler(event as any, mockContext))
      );

      // すべてのリクエストが成功すること
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });
  });

  describe('エンドポイント統合', () => {
    it('GET /health エンドポイントが正常に動作すること', async () => {
      const event = {
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await healthHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);

      // レスポンスボディの検証
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
    });

    it('GET /disclosures エンドポイントが正常に動作すること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      const event = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);

      // レスポンスボディの検証
      const body = JSON.parse(response.body);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('GET /disclosures/{disclosure_id} エンドポイントが正常に動作すること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoGetItem(
        process.env.DYNAMODB_TABLE!,
        { disclosure_id: disclosure.disclosure_id },
        disclosure
      );

      const event = {
        pathParameters: {
          disclosure_id: disclosure.disclosure_id,
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await getDisclosureHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(200);

      // レスポンスボディの検証
      const body = JSON.parse(response.body);
      expect(body.disclosure_id).toBe(disclosure.disclosure_id);
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なクエリパラメータで400が返されること', async () => {
      const event = {
        queryStringParameters: {
          // company_codeが欠落
          format: 'json',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(400);

      // エラーメッセージの検証
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('存在しないdisclosure_idで404が返されること', async () => {
      // 存在しないdisclosure_id
      mockDynamoGetItem(
        process.env.DYNAMODB_TABLE!,
        { disclosure_id: 'TD20240115999999' },
        undefined
      );

      const event = {
        pathParameters: {
          disclosure_id: 'TD20240115999999',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await getDisclosureHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(404);

      // エラーメッセージの検証
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Disclosure not found');
    });

    it('内部エラーで500が返されること', async () => {
      // DynamoDBエラーをシミュレート
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [], undefined, new Error('Internal error'));

      const event = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // ステータスコードの検証
      expect(response.statusCode).toBe(500);

      // エラーメッセージの検証
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });

  describe('レスポンス形式', () => {
    it('JSONレスポンスが正しい形式であること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      const event = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // Content-Typeヘッダーの検証
      expect(response.headers).toBeDefined();
      expect(response.headers!['Content-Type']).toBe('application/json');

      // レスポンスボディがJSONとしてパース可能であること
      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('CSVレスポンスが正しい形式であること', async () => {
      // テストデータ
      const disclosure = createDisclosure();
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, [disclosure]);

      const event = {
        queryStringParameters: {
          company_code: '7203',
          format: 'csv',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const response = await queryHandler(event as any, mockContext);

      // Content-Typeヘッダーの検証
      expect(response.headers).toBeDefined();
      expect(response.headers!['Content-Type']).toBe('text/csv');

      // レスポンスボディがCSV形式であること
      expect(response.body).toContain('disclosure_id');
      expect(response.body).toContain('company_code');
    });
  });
});

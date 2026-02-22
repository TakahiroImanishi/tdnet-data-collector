/**
 * Lambda関数間統合テスト
 *
 * 複数のLambda関数が連携して動作することを検証します。
 *
 * Requirements: テスト改善（タスク24）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Context } from 'aws-lambda';
import { handler as queryHandler } from '../../lambda/query/handler';
import { handler as getDisclosureHandler } from '../../lambda/get-disclosure/handler';
import {
  setupAllDefaultMocks,
  resetAllMocks,
  mockDynamoQuery,
  mockDynamoGetItem,
  createDisclosure,
  createDisclosures,
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

describe('Lambda関数間統合テスト', () => {
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

  describe('Query → GetDisclosure統合', () => {
    it('Queryで取得したdisclosure_idでGetDisclosureを実行できること', async () => {
      // テストデータ
      const disclosure = createDisclosure({
        company_code: '7203',
        company_name: 'トヨタ自動車株式会社',
      });

      // Queryのモック設定
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

      const queryResponse = await queryHandler(queryEvent as any, mockContext);
      const queryBody = JSON.parse(queryResponse.body);
      const disclosureId = queryBody.data[0].disclosure_id;

      // GetDisclosureのモック設定
      mockDynamoGetItem(
        process.env.DYNAMODB_TABLE!,
        { disclosure_id: disclosureId },
        disclosure
      );

      // GetDisclosure実行
      const getEvent = {
        pathParameters: {
          disclosure_id: disclosureId,
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const getResponse = await getDisclosureHandler(getEvent as any, mockContext);

      // 検証
      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.disclosure_id).toBe(disclosureId);
      expect(getBody.company_code).toBe('7203');
    });
  });

  describe('エラーハンドリング統合', () => {
    it('Queryで空の結果が返ること', async () => {
      // Queryのモック設定（空の結果）
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, []);

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

      const queryResponse = await queryHandler(queryEvent as any, mockContext);

      // 検証
      expect(queryResponse.statusCode).toBe(200);
      const body = JSON.parse(queryResponse.body);
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });

    it('存在しないdisclosure_idでGetDisclosureを実行すると404が返ること', async () => {
      // GetDisclosureのモック設定（存在しない）
      mockDynamoGetItem(
        process.env.DYNAMODB_TABLE!,
        { disclosure_id: 'TD20240115999999' },
        undefined
      );

      // GetDisclosure実行
      const getEvent = {
        pathParameters: {
          disclosure_id: 'TD20240115999999',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const getResponse = await getDisclosureHandler(getEvent as any, mockContext);

      // 検証
      expect(getResponse.statusCode).toBe(404);
      const body = JSON.parse(getResponse.body);
      expect(body.error).toBe('Disclosure not found');
    });
  });

  describe('ページネーション統合', () => {
    it('Queryで複数ページにまたがるデータを取得できること', async () => {
      // テストデータ（150件）
      const allDisclosures = createDisclosures(150, {
        company_code: '7203',
      });

      // 1ページ目のモック設定
      const page1 = allDisclosures.slice(0, 100);
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, page1, {
        disclosure_id: page1[99].disclosure_id,
      });

      // 1ページ目のQuery実行
      const queryEvent1 = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
          limit: '100',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const queryResponse1 = await queryHandler(queryEvent1 as any, mockContext);

      // 1ページ目の検証
      expect(queryResponse1.statusCode).toBe(200);
      const body1 = JSON.parse(queryResponse1.body);
      expect(body1.data).toHaveLength(100);
      expect(body1.has_more).toBe(true);

      // 2ページ目のモック設定
      const page2 = allDisclosures.slice(100, 150);
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, page2);

      // 2ページ目のQuery実行
      const queryEvent2 = {
        queryStringParameters: {
          company_code: '7203',
          format: 'json',
          limit: '100',
          offset: '100',
        },
        requestContext: {
          requestId: 'test-request-id',
        },
      };

      const queryResponse2 = await queryHandler(queryEvent2 as any, mockContext);

      // 2ページ目の検証
      expect(queryResponse2.statusCode).toBe(200);
      const body2 = JSON.parse(queryResponse2.body);
      expect(body2.data).toHaveLength(50);
      expect(body2.has_more).toBe(false);
    });
  });

  describe('複数件クエリ統合', () => {
    it('複数の開示情報をクエリできること', async () => {
      // テストデータ（5件）
      const disclosures = createDisclosures(5, {
        company_code: '7203',
        company_name: 'トヨタ自動車株式会社',
      });

      // モック設定
      mockDynamoQuery(process.env.DYNAMODB_TABLE!, disclosures);

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

      const queryResponse = await queryHandler(queryEvent as any, mockContext);

      // 検証
      expect(queryResponse.statusCode).toBe(200);
      const body = JSON.parse(queryResponse.body);
      expect(body.data).toHaveLength(5);
      expect(body.total).toBe(5);
    });
  });
});

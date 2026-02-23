/**
 * Lambda Collector-Save Handler 統合テスト
 *
 * LocalStackを使用したDynamoDB/S3連携テストです。
 * 実際のAWSサービスとの統合をテストします。
 */

import { Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { handler, SaveEvent } from '../handler';
import { DisclosureMetadata } from '../../../scraper/html-parser';
import * as downloadPdfModule from '../../collector/download-pdf';

// LocalStack設定
const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566';
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'tdnet_disclosures';
const S3_BUCKET = process.env.S3_BUCKET || 'tdnet-data-collector-pdfs';

// AWS SDK クライアント（LocalStack用）
const dynamoClient = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: 'ap-northeast-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});

const s3Client = new S3Client({
  endpoint: LOCALSTACK_ENDPOINT,
  region: 'ap-northeast-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  forcePathStyle: true,
});

// PDFダウンロードをモック化（実際のTDnetへのアクセスを避ける）
jest.mock('../../collector/download-pdf');

describe('Lambda Collector-Save Integration Test', () => {
  // テスト用のLambda Context
  const mockContext: Context = {
    awsRequestId: 'test-request-id',
    functionName: 'collector-save',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:collector-save',
    memoryLimitInMB: '512',
    logGroupName: '/aws/lambda/collector-save',
    logStreamName: '2024/01/15/[$LATEST]test',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => 30000,
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };

  // テスト用の開示情報メタデータ
  const mockDisclosureMetadata: DisclosureMetadata = {
    company_code: '1234',
    company_name: '株式会社サンプル',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T10:30:00Z',
    pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
  };

  beforeAll(() => {
    // 環境変数を設定
    process.env.DYNAMODB_TABLE = DYNAMODB_TABLE;
    process.env.S3_BUCKET = S3_BUCKET;
    process.env.AWS_ENDPOINT = LOCALSTACK_ENDPOINT;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // PDFダウンロードをモック化（テスト用のPDFバッファを返す）
    (downloadPdfModule.downloadPdf as jest.Mock).mockImplementation(
      async (disclosure_id: string) => {
        // テスト用のPDFバッファを作成してS3にアップロード
        const testPdfBuffer = Buffer.from('%PDF-1.4 test content');
        const s3Key = `2024/01/15/${disclosure_id}.pdf`;

        // S3にアップロード
        await s3Client
          .send(
            new GetObjectCommand({
              Bucket: S3_BUCKET,
              Key: s3Key,
            })
          )
          .catch(async () => {
            // オブジェクトが存在しない場合は作成
            const { PutObjectCommand } = await import('@aws-sdk/client-s3');
            await s3Client.send(
              new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: testPdfBuffer,
                ContentType: 'application/pdf',
              })
            );
          });

        return s3Key;
      }
    );
  });

  describe('DynamoDB/S3連携テスト', () => {
    it('DynamoDBにメタデータが保存される', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_integration_test_123',
        page_number: 1,
        items: [mockDisclosureMetadata],
      };

      const response = await handler(event, mockContext);

      expect(response.saved_count).toBe(1);
      expect(response.failed_count).toBe(0);

      // DynamoDBから取得して確認
      const disclosure_id = '20240115_1234_0001';
      const result = await dynamoClient.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: {
            disclosure_id: { S: disclosure_id },
          },
        })
      );

      expect(result.Item).toBeDefined();
      const item = unmarshall(result.Item!);
      expect(item.disclosure_id).toBe(disclosure_id);
      expect(item.company_code).toBe('1234');
      expect(item.company_name).toBe('株式会社サンプル');
      expect(item.disclosure_type).toBe('決算短信');
      expect(item.date_partition).toBe('2024-01');
    }, 30000);

    it('S3にPDFがアップロードされる', async () => {
      const event: SaveEvent = {
        execution_id: 'exec_integration_test_456',
        page_number: 1,
        items: [mockDisclosureMetadata],
      };

      const response = await handler(event, mockContext);

      expect(response.saved_count).toBe(1);
      expect(response.failed_count).toBe(0);

      // S3から取得して確認
      const disclosure_id = '20240115_1234_0001';
      const s3Key = `2024/01/15/${disclosure_id}.pdf`;

      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
        })
      );

      expect(result.ContentType).toBe('application/pdf');
      expect(result.Metadata).toBeDefined();
    }, 30000);

    it('複数の開示情報が正しく保存される', async () => {
      const items: DisclosureMetadata[] = [
        mockDisclosureMetadata,
        {
          company_code: '5678',
          company_name: '株式会社テスト',
          disclosure_type: '適時開示',
          title: '業績予想の修正に関するお知らせ',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://www.release.tdnet.info/inbs/140120240115002.pdf',
        },
      ];

      const event: SaveEvent = {
        execution_id: 'exec_integration_test_789',
        page_number: 1,
        items,
      };

      const response = await handler(event, mockContext);

      expect(response.saved_count).toBe(2);
      expect(response.failed_count).toBe(0);

      // DynamoDBから両方取得して確認
      const disclosure_id1 = '20240115_1234_0001';
      const disclosure_id2 = '20240115_5678_0002';

      const result1 = await dynamoClient.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: { disclosure_id: { S: disclosure_id1 } },
        })
      );

      const result2 = await dynamoClient.send(
        new GetItemCommand({
          TableName: DYNAMODB_TABLE,
          Key: { disclosure_id: { S: disclosure_id2 } },
        })
      );

      expect(result1.Item).toBeDefined();
      expect(result2.Item).toBeDefined();
    }, 30000);
  });

  describe('エラーハンドリング', () => {
    it('DynamoDB書き込みエラー時に適切にハンドリング', async () => {
      // 不正なテーブル名を設定してエラーを発生させる
      process.env.DYNAMODB_TABLE = 'non_existent_table';

      const event: SaveEvent = {
        execution_id: 'exec_error_test_123',
        page_number: 1,
        items: [mockDisclosureMetadata],
      };

      const response = await handler(event, mockContext);

      expect(response.saved_count).toBe(0);
      expect(response.failed_count).toBe(1);
      expect(response.failed_items).toHaveLength(1);

      // 環境変数を元に戻す
      process.env.DYNAMODB_TABLE = DYNAMODB_TABLE;
    }, 30000);
  });
});

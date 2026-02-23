/**
 * batch-write.ts ユニットテスト
 */

import { DynamoDBClient, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { batchWriteItems } from '../batch-write';

// logger のモック
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// DynamoDBクライアントのモック
const dynamoMock = mockClient(DynamoDBClient);

describe('batch-write', () => {
  beforeEach(() => {
    dynamoMock.reset();
    jest.clearAllMocks();
  });

  describe('batchWriteItems', () => {
    it('空配列の場合は何もせず成功を返す', async () => {
      const result = await batchWriteItems('test-table', []);

      expect(result).toEqual({
        successCount: 0,
        failedCount: 0,
        unprocessedItems: [],
      });
      expect(dynamoMock.calls()).toHaveLength(0);
    });

    it('25アイテム以下の場合は1回のバッチで書き込む', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      dynamoMock.on(BatchWriteItemCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('test-table', items);

      expect(result).toEqual({
        successCount: 10,
        failedCount: 0,
        unprocessedItems: [],
      });
      expect(dynamoMock.calls()).toHaveLength(1);
    });

    it('25アイテムを超える場合は複数バッチに分割して書き込む', async () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      dynamoMock.on(BatchWriteItemCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems('test-table', items);

      expect(result).toEqual({
        successCount: 60,
        failedCount: 0,
        unprocessedItems: [],
      });
      // 60アイテム = 3バッチ（25 + 25 + 10）
      expect(dynamoMock.calls()).toHaveLength(3);
    });

    it('未処理アイテムがある場合は再試行する', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      // 1回目: 2アイテムが未処理
      dynamoMock
        .on(BatchWriteItemCommand)
        .resolvesOnce({
          UnprocessedItems: {
            'test-table': [
              {
                PutRequest: {
                  Item: {
                    id: { S: 'item-3' },
                    value: { N: '3' },
                  },
                },
              },
              {
                PutRequest: {
                  Item: {
                    id: { S: 'item-4' },
                    value: { N: '4' },
                  },
                },
              },
            ],
          },
        })
        // 2回目: すべて成功
        .resolves({
          UnprocessedItems: {},
        });

      const result = await batchWriteItems('test-table', items);

      expect(result.successCount).toBe(5);
      expect(result.failedCount).toBe(0);
      expect(result.unprocessedItems).toHaveLength(0);
      expect(dynamoMock.calls()).toHaveLength(2);
    });

    it('最大再試行回数を超えた場合は未処理アイテムを返す', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      // 常に未処理アイテムを返す
      dynamoMock.on(BatchWriteItemCommand).resolves({
        UnprocessedItems: {
          'test-table': [
            {
              PutRequest: {
                Item: {
                  id: { S: 'item-4' },
                  value: { N: '4' },
                },
              },
            },
          ],
        },
      });

      const result = await batchWriteItems('test-table', items, 2);

      expect(result.successCount).toBe(4);
      expect(result.failedCount).toBe(1);
      expect(result.unprocessedItems).toHaveLength(1);
      expect(result.unprocessedItems[0]).toMatchObject({
        id: 'item-4',
        value: 4,
      });
    });

    it('バッチ書き込みが完全に失敗した場合はエラーをスロー', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      dynamoMock.on(BatchWriteItemCommand).rejects(new Error('DynamoDB error'));

      const result = await batchWriteItems('test-table', items, 0);

      // エラーをキャッチして失敗としてカウント
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(5);
      expect(result.unprocessedItems).toHaveLength(5);
    });

    it('スロットリングエラーの場合は再試行する', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      // 1回目: スロットリングエラー
      const throttlingError = new Error('Throttling');
      throttlingError.name = 'ProvisionedThroughputExceededException';

      dynamoMock
        .on(BatchWriteItemCommand)
        .rejectsOnce(throttlingError)
        // 2回目: 成功
        .resolves({
          UnprocessedItems: {},
        });

      const result = await batchWriteItems('test-table', items);

      expect(result.successCount).toBe(5);
      expect(result.failedCount).toBe(0);
      expect(dynamoMock.calls().length).toBeGreaterThanOrEqual(2);
    });

    it('複数バッチで一部が失敗した場合は部分的成功を返す', async () => {
      const items = Array.from({ length: 30 }, (_, i) => ({
        id: `item-${i}`,
        value: i,
      }));

      // 1バッチ目: 成功
      dynamoMock
        .on(BatchWriteItemCommand)
        .resolvesOnce({
          UnprocessedItems: {},
        })
        // 2バッチ目: 失敗
        .rejectsOnce(new Error('DynamoDB error'));

      const result = await batchWriteItems('test-table', items, 0);

      expect(result.successCount).toBe(25);
      expect(result.failedCount).toBe(5);
      expect(result.unprocessedItems).toHaveLength(5);
    });

    it('型安全性: ジェネリック型パラメータが正しく機能する', async () => {
      interface TestItem {
        disclosure_id: string;
        company_code: string;
        disclosed_at: string;
      }

      const items: TestItem[] = [
        {
          disclosure_id: 'TD001',
          company_code: '1234',
          disclosed_at: '2024-01-15T10:00:00Z',
        },
        {
          disclosure_id: 'TD002',
          company_code: '5678',
          disclosed_at: '2024-01-15T11:00:00Z',
        },
      ];

      dynamoMock.on(BatchWriteItemCommand).resolves({
        UnprocessedItems: {},
      });

      const result = await batchWriteItems<TestItem>('test-table', items);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.unprocessedItems).toHaveLength(0);
    });
  });
});

/**
 * 統合テスト用ヘルパー関数
 *
 * Lambda統合テストとAPI Gateway統合テストで使用する共通ヘルパー。
 *
 * Requirements: タスク34（カバレッジ測定の修正）
 */

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { Disclosure } from '../types';

/**
 * AWS SDKモッククライアント
 */
export const dynamoMock = mockClient(DynamoDBClient);

/**
 * すべてのデフォルトモックをセットアップ
 */
export function setupAllDefaultMocks(): void {
  dynamoMock.reset();
  
  // デフォルトのモック動作
  dynamoMock.on(QueryCommand).resolves({ Items: [] });
  dynamoMock.on(GetItemCommand).resolves({ Item: undefined });
}

/**
 * すべてのモックをリセット
 */
export function resetAllMocks(): void {
  dynamoMock.reset();
}

/**
 * DynamoDBクエリのモック設定
 *
 * @param tableName テーブル名
 * @param items 返却するアイテム配列
 * @param lastEvaluatedKey 最後に評価されたキー（ページネーション用）
 * @param error エラーをスローする場合
 */
export function mockDynamoQuery(
  tableName: string,
  items: Disclosure[],
  lastEvaluatedKey?: { disclosure_id: string },
  error?: Error
): void {
  if (error) {
    dynamoMock.on(QueryCommand).rejects(error);
    return;
  }

  const marshalledItems = items.map((item) => marshall(item));
  const response: any = {
    Items: marshalledItems,
    Count: items.length,
  };

  if (lastEvaluatedKey) {
    response.LastEvaluatedKey = marshall(lastEvaluatedKey);
  }

  dynamoMock.on(QueryCommand).resolves(response);
}

/**
 * DynamoDB GetItemのモック設定
 *
 * @param tableName テーブル名
 * @param key キー
 * @param item 返却するアイテム（undefinedの場合は存在しない）
 */
export function mockDynamoGetItem(
  tableName: string,
  key: { disclosure_id: string },
  item: Disclosure | undefined
): void {
  const response: any = item ? { Item: marshall(item) } : { Item: undefined };
  dynamoMock.on(GetItemCommand).resolves(response);
}

/**
 * テスト用の開示情報を作成
 *
 * @param overrides 上書きするプロパティ
 * @returns Disclosure
 */
export function createDisclosure(overrides: Partial<Disclosure> = {}): Disclosure {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000);
  
  return {
    disclosure_id: `TD20240115${String(randomId).padStart(3, '0')}`,
    company_code: '7203',
    company_name: 'トヨタ自動車株式会社',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: new Date(timestamp).toISOString(),
    pdf_url: `https://www.release.tdnet.info/inbs/140120240115${String(randomId).padStart(3, '0')}.pdf`,
    pdf_s3_key: `2024/01/15/TD20240115${String(randomId).padStart(3, '0')}.pdf`,
    collected_at: new Date(timestamp).toISOString(),
    date_partition: '2024-01',
    ...overrides,
  };
}

/**
 * 複数のテスト用開示情報を作成
 *
 * @param count 作成する件数
 * @param overrides 上書きするプロパティ
 * @returns Disclosure[]
 */
export function createDisclosures(
  count: number,
  overrides: Partial<Disclosure> = {}
): Disclosure[] {
  return Array.from({ length: count }, (_, i) => {
    const timestamp = Date.now() + i * 1000;
    const id = String(i + 1).padStart(3, '0');
    
    return createDisclosure({
      disclosure_id: `TD20240115${id}`,
      disclosed_at: new Date(timestamp).toISOString(),
      pdf_url: `https://www.release.tdnet.info/inbs/140120240115${id}.pdf`,
      pdf_s3_key: `2024/01/15/TD20240115${id}.pdf`,
      collected_at: new Date(timestamp).toISOString(),
      ...overrides,
    });
  });
}

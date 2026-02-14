/**
 * DynamoDB BatchWriteItem ユーティリティ
 *
 * 複数のアイテムを効率的にDynamoDBに書き込むためのユーティリティ。
 * BatchWriteItemは最大25アイテムまで一度に書き込み可能。
 *
 * Requirements: 要件9.1（パフォーマンス最適化）
 */

import {
  DynamoDBClient,
  BatchWriteItemCommand,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { logger } from './logger';
import { retryWithBackoff } from './retry';

// DynamoDBクライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  maxAttempts: 3,
});

/**
 * バッチ書き込み結果
 */
export interface BatchWriteResult {
  /** 成功件数 */
  successCount: number;
  /** 失敗件数 */
  failedCount: number;
  /** 未処理アイテム */
  unprocessedItems: any[];
}

/**
 * DynamoDBにアイテムをバッチ書き込み
 *
 * 最大25アイテムずつバッチ処理し、未処理アイテムは指数バックオフで再試行します。
 *
 * @param tableName - DynamoDBテーブル名
 * @param items - 書き込むアイテムの配列
 * @param maxRetries - 最大再試行回数（デフォルト: 3）
 * @returns バッチ書き込み結果
 *
 * @example
 * ```typescript
 * const items = [
 *   { disclosure_id: 'TD001', company_code: '1234', ... },
 *   { disclosure_id: 'TD002', company_code: '5678', ... },
 * ];
 *
 * const result = await batchWriteItems('tdnet_disclosures', items);
 * console.log(`成功: ${result.successCount}, 失敗: ${result.failedCount}`);
 * ```
 */
export async function batchWriteItems(
  tableName: string,
  items: any[],
  maxRetries: number = 3
): Promise<BatchWriteResult> {
  if (items.length === 0) {
    return { successCount: 0, failedCount: 0, unprocessedItems: [] };
  }

  logger.info('Starting batch write', {
    tableName,
    itemCount: items.length,
  });

  let successCount = 0;
  let failedCount = 0;
  const unprocessedItems: any[] = [];

  // 25アイテムずつバッチ処理
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    try {
      const result = await writeBatch(tableName, batch, maxRetries);
      successCount += result.successCount;
      failedCount += result.failedCount;
      unprocessedItems.push(...result.unprocessedItems);
    } catch (error) {
      logger.error('Batch write failed', {
        tableName,
        batchIndex: Math.floor(i / batchSize),
        error: error instanceof Error ? error.message : String(error),
      });
      failedCount += batch.length;
      unprocessedItems.push(...batch);
    }
  }

  logger.info('Batch write completed', {
    tableName,
    totalItems: items.length,
    successCount,
    failedCount,
    unprocessedCount: unprocessedItems.length,
  });

  return { successCount, failedCount, unprocessedItems };
}

/**
 * 単一バッチを書き込み（最大25アイテム）
 *
 * @param tableName - DynamoDBテーブル名
 * @param items - 書き込むアイテムの配列（最大25）
 * @param maxRetries - 最大再試行回数
 * @returns バッチ書き込み結果
 */
async function writeBatch(
  tableName: string,
  items: any[],
  maxRetries: number
): Promise<BatchWriteResult> {
  if (items.length > 25) {
    throw new Error('Batch size must be 25 or less');
  }

  // WriteRequestsを作成
  const writeRequests: WriteRequest[] = items.map((item) => ({
    PutRequest: {
      Item: marshall(item),
    },
  }));

  let unprocessedItems = writeRequests;
  let retryCount = 0;
  let successCount = 0;

  while (unprocessedItems.length > 0 && retryCount <= maxRetries) {
    try {
      const response = await retryWithBackoff(
        async () => {
          return await dynamoClient.send(
            new BatchWriteItemCommand({
              RequestItems: {
                [tableName]: unprocessedItems,
              },
            })
          );
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          backoffMultiplier: 2,
          jitter: true,
          shouldRetry: (error) => {
            return (
              error.name === 'ProvisionedThroughputExceededException' ||
              error.name === 'ThrottlingException'
            );
          },
        }
      );

      // 成功したアイテム数を計算
      const processedCount =
        unprocessedItems.length -
        (response.UnprocessedItems?.[tableName]?.length || 0);
      successCount += processedCount;

      // 未処理アイテムを取得
      if (response.UnprocessedItems && response.UnprocessedItems[tableName]) {
        unprocessedItems = response.UnprocessedItems[tableName];

        if (unprocessedItems.length > 0) {
          logger.warn('Unprocessed items detected, retrying', {
            tableName,
            unprocessedCount: unprocessedItems.length,
            retryCount: retryCount + 1,
          });

          // 指数バックオフ
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retryCount++;
        }
      } else {
        // すべて処理完了
        unprocessedItems = [];
      }
    } catch (error) {
      logger.error('Batch write request failed', {
        tableName,
        retryCount,
        error: error instanceof Error ? error.message : String(error),
      });

      if (retryCount >= maxRetries) {
        throw error;
      }

      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const failedCount = unprocessedItems.length;

  return {
    successCount,
    failedCount,
    unprocessedItems: unprocessedItems.map((req) => req.PutRequest?.Item),
  };
}

/**
 * バッチ書き込みのベストプラクティス
 *
 * 1. **バッチサイズ**: 最大25アイテム
 * 2. **再試行**: 未処理アイテムは指数バックオフで再試行
 * 3. **エラーハンドリング**: ProvisionedThroughputExceededExceptionは再試行
 * 4. **並列処理**: 複数のバッチを並列実行しない（スロットリング回避）
 * 5. **ログ**: 成功・失敗・未処理アイテムをログに記録
 *
 * ## 使用例
 *
 * ### 基本的な使用
 *
 * ```typescript
 * import { batchWriteItems } from './utils/batch-write';
 *
 * const disclosures = [
 *   { disclosure_id: 'TD001', company_code: '1234', ... },
 *   { disclosure_id: 'TD002', company_code: '5678', ... },
 *   // ... 最大25アイテム
 * ];
 *
 * const result = await batchWriteItems('tdnet_disclosures', disclosures);
 * console.log(`成功: ${result.successCount}, 失敗: ${result.failedCount}`);
 * ```
 *
 * ### 大量データの処理
 *
 * ```typescript
 * // 100アイテムを処理（自動的に25アイテムずつバッチ処理）
 * const allDisclosures = [...]; // 100アイテム
 * const result = await batchWriteItems('tdnet_disclosures', allDisclosures);
 *
 * if (result.failedCount > 0) {
 *   logger.error('Some items failed to write', {
 *     failedCount: result.failedCount,
 *     unprocessedItems: result.unprocessedItems,
 *   });
 * }
 * ```
 *
 * ### エラーハンドリング
 *
 * ```typescript
 * try {
 *   const result = await batchWriteItems('tdnet_disclosures', items);
 *
 *   if (result.failedCount > 0) {
 *     // 失敗したアイテムを個別に再試行
 *     for (const item of result.unprocessedItems) {
 *       await saveMetadata(item, item.s3_key);
 *     }
 *   }
 * } catch (error) {
 *   logger.error('Batch write completely failed', { error });
 *   throw error;
 * }
 * ```
 *
 * ## パフォーマンス比較
 *
 * ### 個別PutItem（現在の実装）
 * - 100アイテム: 約10秒（1アイテム/100ms）
 * - ネットワークオーバーヘッド: 高
 * - スロットリングリスク: 高
 *
 * ### BatchWriteItem（最適化後）
 * - 100アイテム: 約2秒（25アイテム/500ms × 4バッチ）
 * - ネットワークオーバーヘッド: 低
 * - スロットリングリスク: 低
 *
 * **パフォーマンス向上**: 約5倍
 *
 * ## 注意事項
 *
 * 1. **重複チェック**: BatchWriteItemはConditionExpressionをサポートしないため、
 *    重複チェックが必要な場合は個別PutItemを使用してください。
 *
 * 2. **トランザクション**: BatchWriteItemはトランザクションではありません。
 *    一部が失敗しても他は成功します。
 *
 * 3. **順序保証**: アイテムの書き込み順序は保証されません。
 *
 * 4. **容量ユニット**: 各アイテムは1KB単位で計算されます。
 *    大きなアイテムは複数の容量ユニットを消費します。
 */

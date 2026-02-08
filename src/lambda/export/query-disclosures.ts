/**
 * 開示情報クエリ
 *
 * フィルター条件に基づいて開示情報を取得します。
 *
 * Requirements: 要件5.1（エクスポート）
 */

import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { Disclosure } from '../../types';
import { generateDatePartition, generateMonthRange } from '../../utils/date-partition';

// DynamoDBクライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
  }),
});

// 環境変数
const DISCLOSURES_TABLE = process.env.DYNAMODB_TABLE_NAME || 'tdnet-disclosures';
const DATE_PARTITION_INDEX = 'DatePartitionIndex';

/**
 * クエリフィルター
 */
export interface QueryFilter {
  /** 企業コード */
  company_code?: string;

  /** 開始日（ISO 8601形式、YYYY-MM-DD） */
  start_date?: string;

  /** 終了日（ISO 8601形式、YYYY-MM-DD） */
  end_date?: string;

  /** 開示種類 */
  disclosure_type?: string;
}

/**
 * 開示情報をクエリ
 *
 * @param filter クエリフィルター
 * @returns 開示情報のリスト
 */
export async function queryDisclosures(filter: QueryFilter): Promise<Disclosure[]> {
  logger.info('Querying disclosures', { filter });

  // 日付範囲が指定されている場合は、date_partitionを使用してクエリ
  if (filter.start_date && filter.end_date) {
    return await queryByDateRange(filter);
  }

  // 企業コードのみが指定されている場合は、Scanを使用
  if (filter.company_code) {
    return await scanByCompanyCode(filter);
  }

  // フィルターが指定されていない場合は、全件取得（Scan）
  return await scanAll(filter);
}

/**
 * 日付範囲でクエリ（date_partitionを使用）
 *
 * @param filter クエリフィルター
 * @returns 開示情報のリスト
 */
async function queryByDateRange(filter: QueryFilter): Promise<Disclosure[]> {
  const startPartition = generateDatePartition(filter.start_date! + 'T00:00:00Z');
  const endPartition = generateDatePartition(filter.end_date! + 'T23:59:59Z');

  // 月範囲を生成
  const partitions = generateMonthRange(startPartition, endPartition);

  logger.info('Querying by date range', {
    start_partition: startPartition,
    end_partition: endPartition,
    partitions,
  });

  // 並行クエリ
  const results = await Promise.all(
    partitions.map((partition) => queryByPartition(partition, filter))
  );

  // 結果を統合してフィルタリング
  const disclosures = results.flat();

  // 日付範囲でフィルタリング
  const startDate = new Date(filter.start_date! + 'T00:00:00Z');
  const endDate = new Date(filter.end_date! + 'T23:59:59Z');

  return disclosures
    .filter((disclosure) => {
      const disclosedAt = new Date(disclosure.disclosed_at);
      return disclosedAt >= startDate && disclosedAt <= endDate;
    })
    .sort((a, b) => new Date(b.disclosed_at).getTime() - new Date(a.disclosed_at).getTime());
}

/**
 * パーティションでクエリ
 *
 * @param partition date_partition（YYYY-MM形式）
 * @param filter クエリフィルター
 * @returns 開示情報のリスト
 */
async function queryByPartition(
  partition: string,
  filter: QueryFilter
): Promise<Disclosure[]> {
  const items: Disclosure[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await retryWithBackoff(
      async () => {
        return await dynamoClient.send(
          new QueryCommand({
            TableName: DISCLOSURES_TABLE,
            IndexName: DATE_PARTITION_INDEX,
            KeyConditionExpression: 'date_partition = :partition',
            ExpressionAttributeValues: {
              ':partition': { S: partition },
            },
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: (error) => {
          return error.name === 'ProvisionedThroughputExceededException';
        },
      }
    );

    if (result.Items) {
      items.push(...result.Items.map(fromDynamoDBItem));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // 追加フィルタリング
  return applyFilters(items, filter);
}

/**
 * 企業コードでScan
 *
 * @param filter クエリフィルター
 * @returns 開示情報のリスト
 */
async function scanByCompanyCode(filter: QueryFilter): Promise<Disclosure[]> {
  const items: Disclosure[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await retryWithBackoff(
      async () => {
        return await dynamoClient.send(
          new ScanCommand({
            TableName: DISCLOSURES_TABLE,
            FilterExpression: 'company_code = :company_code',
            ExpressionAttributeValues: {
              ':company_code': { S: filter.company_code! },
            },
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: (error) => {
          return error.name === 'ProvisionedThroughputExceededException';
        },
      }
    );

    if (result.Items) {
      items.push(...result.Items.map(fromDynamoDBItem));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // 追加フィルタリング
  return applyFilters(items, filter);
}

/**
 * 全件Scan
 *
 * @param filter クエリフィルター
 * @returns 開示情報のリスト
 */
async function scanAll(filter: QueryFilter): Promise<Disclosure[]> {
  const items: Disclosure[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await retryWithBackoff(
      async () => {
        return await dynamoClient.send(
          new ScanCommand({
            TableName: DISCLOSURES_TABLE,
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: (error) => {
          return error.name === 'ProvisionedThroughputExceededException';
        },
      }
    );

    if (result.Items) {
      items.push(...result.Items.map(fromDynamoDBItem));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // 追加フィルタリング
  return applyFilters(items, filter);
}

/**
 * 追加フィルタリング
 *
 * @param items 開示情報のリスト
 * @param filter クエリフィルター
 * @returns フィルタリング後の開示情報のリスト
 */
function applyFilters(items: Disclosure[], filter: QueryFilter): Disclosure[] {
  let filtered = items;

  // 企業コードでフィルタリング
  if (filter.company_code) {
    filtered = filtered.filter((item) => item.company_code === filter.company_code);
  }

  // 開示種類でフィルタリング
  if (filter.disclosure_type) {
    filtered = filtered.filter((item) => item.disclosure_type === filter.disclosure_type);
  }

  return filtered;
}

/**
 * DynamoDBアイテムをDisclosureに変換
 *
 * @param item DynamoDBアイテム
 * @returns Disclosure
 */
function fromDynamoDBItem(item: Record<string, any>): Disclosure {
  return {
    disclosure_id: item.disclosure_id?.S ?? '',
    company_code: item.company_code?.S ?? '',
    company_name: item.company_name?.S ?? '',
    disclosure_type: item.disclosure_type?.S ?? '',
    title: item.title?.S ?? '',
    disclosed_at: item.disclosed_at?.S ?? '',
    pdf_url: item.pdf_url?.S ?? '',
    s3_key: item.s3_key?.S ?? '',
    collected_at: item.collected_at?.S ?? '',
    date_partition: item.date_partition?.S ?? '',
  };
}

/**
 * Query Disclosures
 *
 * DynamoDBから開示情報を検索します。
 * GSI（Global Secondary Index）を使用して効率的にクエリします。
 *
 * Requirements: 要件4.1（検索API）
 */

import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  QueryCommandInput,
  ScanCommandInput,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { Disclosure } from '../../types';
import { generateDatePartition } from '../../utils/date-partition';

// DynamoDBクライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  maxAttempts: 3,
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';

/**
 * クエリパラメータ
 */
export interface QueryParams {
  company_code?: string;
  start_date?: string;
  end_date?: string;
  disclosure_type?: string;
  format: 'json' | 'csv';
  limit: number;
  offset: number;
}

/**
 * クエリ結果
 */
export interface QueryResult {
  disclosures: Disclosure[];
  total: number;
  count: number;
  offset: number;
  limit: number;
}

/**
 * 開示情報を検索
 *
 * @param params クエリパラメータ
 * @returns クエリ結果
 */
export async function queryDisclosures(params: QueryParams): Promise<QueryResult> {
  logger.info('Querying disclosures', { params });

  let disclosures: Disclosure[];

  // クエリ戦略の選択
  if (params.company_code) {
    // 企業コードでクエリ（GSI_CompanyCode_DiscloseDate使用）
    disclosures = await queryByCompanyCode(params);
  } else if (params.start_date && params.end_date) {
    // 日付範囲でクエリ（GSI_DatePartition使用）
    disclosures = await queryByDateRange(params);
  } else if (params.start_date) {
    // 開始日のみ指定（GSI_DatePartition使用）
    disclosures = await queryByDateRange({
      ...params,
      end_date: new Date().toISOString().split('T')[0], // 今日まで
    });
  } else {
    // フィルタなし（Scan）
    disclosures = await scanDisclosures(params);
  }

  // 開示種類でフィルタリング
  if (params.disclosure_type) {
    disclosures = disclosures.filter(
      (d) => d.disclosure_type === params.disclosure_type
    );
  }

  // 開示日時で降順ソート
  disclosures.sort((a, b) => {
    return new Date(b.disclosed_at).getTime() - new Date(a.disclosed_at).getTime();
  });

  // ページネーション
  const total = disclosures.length;
  const paginatedDisclosures = disclosures.slice(
    params.offset,
    params.offset + params.limit
  );

  logger.info('Query completed', {
    total,
    count: paginatedDisclosures.length,
    offset: params.offset,
    limit: params.limit,
  });

  return {
    disclosures: paginatedDisclosures,
    total,
    count: paginatedDisclosures.length,
    offset: params.offset,
    limit: params.limit,
  };
}

/**
 * 企業コードでクエリ
 *
 * GSI_CompanyCode_DiscloseDate（パーティションキー: company_code、ソートキー: disclosed_at）を使用
 *
 * @param params クエリパラメータ
 * @returns 開示情報リスト
 */
async function queryByCompanyCode(params: QueryParams): Promise<Disclosure[]> {
  logger.info('Querying by company code', { company_code: params.company_code });

  const queryInput: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI_CompanyCode_DiscloseDate',
    KeyConditionExpression: 'company_code = :company_code',
    ExpressionAttributeValues: {
      ':company_code': { S: params.company_code! },
    },
  };

  // 日付範囲フィルタ
  if (params.start_date && params.end_date) {
    queryInput.KeyConditionExpression += ' AND disclosed_at BETWEEN :start_date AND :end_date';
    queryInput.ExpressionAttributeValues![':start_date'] = { S: params.start_date };
    queryInput.ExpressionAttributeValues![':end_date'] = { S: params.end_date };
  } else if (params.start_date) {
    queryInput.KeyConditionExpression += ' AND disclosed_at >= :start_date';
    queryInput.ExpressionAttributeValues![':start_date'] = { S: params.start_date };
  } else if (params.end_date) {
    queryInput.KeyConditionExpression += ' AND disclosed_at <= :end_date';
    queryInput.ExpressionAttributeValues![':end_date'] = { S: params.end_date };
  }

  return await executeQuery(queryInput);
}

/**
 * 日付範囲でクエリ
 *
 * GSI_DatePartition（パーティションキー: date_partition、ソートキー: disclosed_at）を使用
 * 複数の月を並行クエリして結果を統合
 *
 * @param params クエリパラメータ
 * @returns 開示情報リスト
 */
async function queryByDateRange(params: QueryParams): Promise<Disclosure[]> {
  logger.info('Querying by date range', {
    start_date: params.start_date,
    end_date: params.end_date,
  });

  // 開始月と終了月を生成
  const startPartition = generateDatePartition(params.start_date! + 'T00:00:00Z');
  const endPartition = generateDatePartition(params.end_date! + 'T00:00:00Z');

  // 月のリストを生成
  const partitions = generateMonthRange(startPartition, endPartition);

  logger.info('Querying multiple partitions', {
    partitions,
    count: partitions.length,
  });

  // 並行クエリ
  const results = await Promise.all(
    partitions.map((partition) => queryByPartition(partition, params))
  );

  // 結果を統合
  const allDisclosures = results.flat();

  // 日付範囲でフィルタリング
  return allDisclosures.filter((disclosure) => {
    const disclosedAt = disclosure.disclosed_at.split('T')[0]; // YYYY-MM-DD部分を抽出
    return disclosedAt >= params.start_date! && disclosedAt <= params.end_date!;
  });
}

/**
 * 単一パーティションでクエリ
 *
 * @param partition date_partition（YYYY-MM形式）
 * @param params クエリパラメータ
 * @returns 開示情報リスト
 */
async function queryByPartition(
  partition: string,
  params: QueryParams
): Promise<Disclosure[]> {
  const queryInput: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'GSI_DatePartition',
    KeyConditionExpression: 'date_partition = :partition',
    ExpressionAttributeValues: {
      ':partition': { S: partition },
    },
  };

  return await executeQuery(queryInput);
}

/**
 * Scanでクエリ（フィルタなし）
 *
 * @param params クエリパラメータ
 * @returns 開示情報リスト
 */
async function scanDisclosures(params: QueryParams): Promise<Disclosure[]> {
  logger.warn('Scanning table without filters (inefficient)', { params });

  const scanInput: ScanCommandInput = {
    TableName: TABLE_NAME,
    Limit: params.limit + params.offset, // オフセット分も取得
  };

  return await executeScan(scanInput);
}

/**
 * DynamoDBクエリを実行
 *
 * @param input QueryCommandInput
 * @returns 開示情報リスト
 */
async function executeQuery(input: QueryCommandInput): Promise<Disclosure[]> {
  const disclosures: Disclosure[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const command = new QueryCommand({
      ...input,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await retryWithBackoff(
      async () => await dynamoClient.send(command),
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

    if (response.Items) {
      for (const item of response.Items) {
        disclosures.push(unmarshall(item) as Disclosure);
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return disclosures;
}

/**
 * DynamoDB Scanを実行
 *
 * @param input ScanCommandInput
 * @returns 開示情報リスト
 */
async function executeScan(input: ScanCommandInput): Promise<Disclosure[]> {
  const disclosures: Disclosure[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const command = new ScanCommand({
      ...input,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await retryWithBackoff(
      async () => await dynamoClient.send(command),
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

    if (response.Items) {
      for (const item of response.Items) {
        disclosures.push(unmarshall(item) as Disclosure);
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return disclosures;
}

/**
 * 月範囲を生成
 *
 * @param start 開始月（YYYY-MM）
 * @param end 終了月（YYYY-MM）
 * @returns 月のリスト（YYYY-MM形式）
 */
function generateMonthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

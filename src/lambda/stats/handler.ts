/**
 * Lambda Stats Handler
 *
 * 統計情報を取得するLambda関数のメインハンドラー。
 * DynamoDBから統計情報を集計して返却します。
 *
 * Requirements: 要件4.1, 4.3（検索API、認証）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';

// AWS クライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

/**
 * 統計情報レスポンス
 */
interface StatsResponse {
  total_disclosures: number;
  last_30_days: number;
  top_companies: Array<{
    company_code: string;
    company_name: string;
    count: number;
  }>;
}

/**
 * 総開示情報件数を取得（Scanを使用）
 * 注意: 大量データの場合はパフォーマンスに影響する可能性があります
 */
async function getTotalDisclosures(): Promise<number> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
  }

  try {
    const command = new ScanCommand({
      TableName: tableName,
      Select: 'COUNT',
    });

    const result = await docClient.send(command);
    return result.Count || 0;
  } catch (error) {
    logger.error('Failed to get total disclosures', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 直近30日の収集件数を取得（GSI_DatePartitionを使用）
 */
async function getLast30DaysCount(): Promise<number> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
  }

  // 30日前の日付を計算
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD

  // 現在の年月を取得
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const previousYearMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYearMonth = `${previousYearMonth.getFullYear()}-${String(previousYearMonth.getMonth() + 1).padStart(2, '0')}`;

  try {
    // 当月と前月のdate_partitionでクエリ
    const queries = [currentYearMonth, prevYearMonth].map(async (datePartition) => {
      const command = new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :datePartition AND disclosed_at >= :startDate',
        ExpressionAttributeValues: {
          ':datePartition': datePartition,
          ':startDate': startDate,
        },
        Select: 'COUNT',
      });

      const result = await docClient.send(command);
      return result.Count || 0;
    });

    const counts = await Promise.all(queries);
    return counts.reduce((sum, count) => sum + count, 0);
  } catch (error) {
    logger.error('Failed to get last 30 days count', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 企業別件数トップ10を取得
 * 注意: この実装は簡易版です。本番環境では集計テーブルを別途用意することを推奨します。
 */
async function getTopCompanies(): Promise<Array<{ company_code: string; company_name: string; count: number }>> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
  }

  try {
    // Scanで全データを取得し、メモリ上で集計
    // 注意: 大量データの場合はパフォーマンスに影響します
    const command = new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'company_code, company_name',
    });

    const result = await docClient.send(command);
    const items = result.Items || [];

    // 企業コード別に集計
    const companyMap = new Map<string, { company_name: string; count: number }>();

    for (const item of items) {
      const companyCode = item.company_code as string;
      const companyName = item.company_name as string;

      if (companyMap.has(companyCode)) {
        companyMap.get(companyCode)!.count++;
      } else {
        companyMap.set(companyCode, { company_name: companyName, count: 1 });
      }
    }

    // 件数でソートしてトップ10を取得
    const topCompanies = Array.from(companyMap.entries())
      .map(([company_code, data]) => ({
        company_code,
        company_name: data.company_name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return topCompanies;
  } catch (error) {
    logger.error('Failed to get top companies', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Lambda Statsハンドラー
 */
export async function handler(
  _event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Stats started', {
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // 統計情報を並行して取得
    const [totalDisclosures, last30Days, topCompanies] = await Promise.all([
      getTotalDisclosures(),
      getLast30DaysCount(),
      getTopCompanies(),
    ]);

    const response: StatsResponse = {
      total_disclosures: totalDisclosures,
      last_30_days: last30Days,
      top_companies: topCompanies,
    };

    const duration = Date.now() - startTime;

    logger.info('Lambda Stats completed', {
      request_id: context.awsRequestId,
      total_disclosures: totalDisclosures,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'Stats' },
      },
    ]);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300', // 5分キャッシュ
      },
      body: JSON.stringify({
        status: 'success',
        data: response,
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Stats failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'Stats'
    );

    return handleError(error as Error, context.awsRequestId);
  }
}

/**
 * エラーハンドリング
 */
function handleError(error: Error, requestId: string): APIGatewayProxyResult {
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let details: Record<string, any> = {};

  const errorResponse = {
    status: 'error',
    error: {
      code: errorCode,
      message: error.message,
      details,
    },
    request_id: requestId,
  };

  if (process.env.NODE_ENV !== 'production') {
    (errorResponse.error as any).stack = error.stack;
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(errorResponse),
  };
}

/**
 * Lambda Health Check Handler
 *
 * システムのヘルスチェックを実行するLambda関数のメインハンドラー。
 * DynamoDBとS3の接続確認を行い、システムの健全性を返却します。
 *
 * Requirements: 要件4.1（検索API）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { logger, createErrorContext } from '../../utils/logger';
import { sendMetrics } from '../../utils/cloudwatch-metrics';

// AWS クライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });

/**
 * サービスの健全性ステータス
 */
type ServiceStatus = 'healthy' | 'unhealthy' | 'unknown';

/**
 * ヘルスチェックレスポンス
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    dynamodb: ServiceStatus;
    s3: ServiceStatus;
  };
  details?: {
    dynamodb?: string;
    s3?: string;
  };
}

/**
 * DynamoDBの接続確認
 */
async function checkDynamoDB(): Promise<{ status: ServiceStatus; message?: string }> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    return {
      status: 'unknown',
      message: 'DYNAMODB_TABLE_NAME environment variable is not set',
    };
  }

  try {
    const command = new DescribeTableCommand({
      TableName: tableName,
    });

    const result = await dynamoClient.send(command);

    if (result.Table?.TableStatus === 'ACTIVE') {
      return { status: 'healthy' };
    } else {
      return {
        status: 'unhealthy',
        message: `Table status: ${result.Table?.TableStatus}`,
      };
    }
  } catch (error) {
    logger.error('DynamoDB health check failed', {
      error: error instanceof Error ? error.message : String(error),
      table_name: tableName,
    });

    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * S3の接続確認
 */
async function checkS3(): Promise<{ status: ServiceStatus; message?: string }> {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    return {
      status: 'unknown',
      message: 'S3_BUCKET_NAME environment variable is not set',
    };
  }

  try {
    const command = new HeadBucketCommand({
      Bucket: bucketName,
    });

    await s3Client.send(command);

    return { status: 'healthy' };
  } catch (error) {
    logger.error('S3 health check failed', {
      error: error instanceof Error ? error.message : String(error),
      bucket_name: bucketName,
    });

    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Lambda Health Checkハンドラー
 */
export async function handler(
  _event: APIGatewayProxyEvent, // Unused but required by Lambda signature
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Health Check started', {
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // 並行してヘルスチェックを実行
    const [dynamodbResult, s3Result] = await Promise.all([
      checkDynamoDB(),
      checkS3(),
    ]);

    // 全体のステータスを判定
    const overallStatus =
      dynamodbResult.status === 'healthy' && s3Result.status === 'healthy'
        ? 'healthy'
        : 'unhealthy';

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        dynamodb: dynamodbResult.status,
        s3: s3Result.status,
      },
    };

    // エラーメッセージがある場合は詳細を追加
    if (dynamodbResult.message || s3Result.message) {
      response.details = {};
      if (dynamodbResult.message) {
        response.details.dynamodb = dynamodbResult.message;
      }
      if (s3Result.message) {
        response.details.s3 = s3Result.message;
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Lambda Health Check completed', {
      request_id: context.awsRequestId,
      status: overallStatus,
      duration_ms: duration,
    });

    // メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'Health' },
      },
      {
        name: 'HealthCheckStatus',
        value: overallStatus === 'healthy' ? 1 : 0,
        unit: 'Count',
        dimensions: { Status: overallStatus },
      },
    ]);

    // ステータスコードは常に200（ヘルスチェックの結果はbodyで返す）
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Health Check failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーが発生した場合は503を返す
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          dynamodb: 'unknown',
          s3: 'unknown',
        },
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
    };
  }
}

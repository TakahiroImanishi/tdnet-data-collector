/**
 * Lambda Collect Status Handler
 *
 * GET /collect/{execution_id} エンドポイントのハンドラー。
 * 実行状態をDynamoDBから取得して返却します。
 *
 * Requirements: タスク13.2
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric } from '../../utils/cloudwatch-metrics';
import { ValidationError, NotFoundError } from '../../errors';

// DynamoDB クライアントはグローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const EXECUTIONS_TABLE_NAME = process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';

/**
 * 実行状態
 */
interface ExecutionStatus {
  /** 実行ID */
  execution_id: string;

  /** ステータス */
  status: 'pending' | 'running' | 'completed' | 'failed';

  /** 進捗率（0-100） */
  progress: number;

  /** 収集成功件数 */
  collected_count: number;

  /** 収集失敗件数 */
  failed_count: number;

  /** 開始日時（ISO 8601形式） */
  started_at: string;

  /** 更新日時（ISO 8601形式） */
  updated_at: string;

  /** 完了日時（ISO 8601形式、completed/failedの場合のみ） */
  completed_at?: string;

  /** エラーメッセージ（failedの場合のみ） */
  error_message?: string;
}

/**
 * GET /collect/{execution_id} レスポンス
 */
interface CollectStatusResponse {
  /** ステータス */
  status: 'success';

  /** データ */
  data: ExecutionStatus;
}

/**
 * Lambda Collect Status ハンドラー
 *
 * @param event API Gateway Proxy Event
 * @param context Lambda Context
 * @returns API Gateway Proxy Result
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('GET /collect/{execution_id} invoked', {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      pathParameters: event.pathParameters,
    });

    // パスパラメータの取得
    const execution_id = event.pathParameters?.execution_id;

    // バリデーション
    if (!execution_id) {
      throw new ValidationError('execution_id is required');
    }

    // 実行状態を取得
    const executionStatus = await getExecutionStatus(execution_id);

    // レスポンス
    const response: CollectStatusResponse = {
      status: 'success',
      data: executionStatus,
    };

    logger.info('GET /collect/{execution_id} completed', {
      requestId: context.awsRequestId,
      execution_id,
      status: executionStatus.status,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error(
      'GET /collect/{execution_id} failed',
      createErrorContext(error as Error, {
        requestId: context.awsRequestId,
        event,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'CollectStatus',
      {}
    );

    return toErrorResponse(error as Error, event.requestContext.requestId);
  }
}

/**
 * 実行状態を取得
 *
 * @param execution_id 実行ID
 * @returns 実行状態
 * @throws NotFoundError 実行状態が存在しない場合
 */
async function getExecutionStatus(execution_id: string): Promise<ExecutionStatus> {
  try {
    logger.info('Getting execution status from DynamoDB', {
      execution_id,
      tableName: EXECUTIONS_TABLE_NAME,
    });

    const command = new GetItemCommand({
      TableName: EXECUTIONS_TABLE_NAME,
      Key: {
        execution_id: { S: execution_id },
      },
    });

    const result = await dynamoClient.send(command);

    if (!result.Item) {
      throw new NotFoundError(`Execution not found: ${execution_id}`);
    }

    const item = unmarshall(result.Item) as ExecutionStatus;

    logger.info('Execution status retrieved successfully', {
      execution_id,
      status: item.status,
      progress: item.progress,
    });

    return item;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error(
      'Failed to get execution status from DynamoDB',
      createErrorContext(error as Error, {
        execution_id,
        tableName: EXECUTIONS_TABLE_NAME,
      })
    );

    throw new Error('Failed to retrieve execution status');
  }
}

/**
 * エラーレスポンスを生成
 *
 * @param error Error
 * @param requestId リクエストID
 * @returns API Gateway Proxy Result
 */
function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
  const errorCodeMap: Record<string, { statusCode: number; code: string }> = {
    ValidationError: { statusCode: 400, code: 'VALIDATION_ERROR' },
    UnauthorizedError: { statusCode: 401, code: 'UNAUTHORIZED' },
    ForbiddenError: { statusCode: 403, code: 'FORBIDDEN' },
    NotFoundError: { statusCode: 404, code: 'NOT_FOUND' },
    ConflictError: { statusCode: 409, code: 'CONFLICT' },
    RateLimitError: { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
    InternalError: { statusCode: 500, code: 'INTERNAL_ERROR' },
    ServiceUnavailableError: { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
    GatewayTimeoutError: { statusCode: 504, code: 'GATEWAY_TIMEOUT' },
  };

  const mapping = errorCodeMap[error.name] || {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
  };

  return {
    statusCode: mapping.statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      status: 'error',
      error: {
        code: mapping.code,
        message: error.message,
        details: (error as any).details || {},
      },
      request_id: requestId,
    }),
  };
}

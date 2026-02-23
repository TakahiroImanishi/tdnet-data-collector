/**
 * Lambda Collect Status Handler
 *
 * GET /collect/{execution_id} エンドポイントのハンドラー。
 * 実行状態をDynamoDBから取得して返却します。
 *
 * Requirements: タスク13.2
 *
 * 関連ドキュメント:
 * - .kiro/steering/core/tdnet-implementation-rules.md - 実装ルール
 * - .kiro/steering/development/lambda-implementation.md - Lambda実装ガイド
 * - .kiro/steering/core/error-handling-patterns.md - エラーハンドリング
 * - .kiro/steering/api/api-design-guidelines.md - API設計
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SFNClient, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric } from '../../utils/cloudwatch-metrics';
import { ValidationError, NotFoundError } from '../../errors';

// クライアントはグローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});
const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});

// 環境変数を取得する関数（遅延評価）
function getExecutionsTableName(): string {
  return (
    process.env.EXECUTION_STATE_TABLE || process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions'
  );
}

function getStateMachineArn(): string | undefined {
  return process.env.STATE_MACHINE_ARN;
}

/**
 * 実行状態（Step Functions対応）
 */
interface ExecutionStatus {
  /** 実行ID */
  execution_id: string;

  /** ステータス */
  status: 'running' | 'succeeded' | 'failed' | 'timed_out' | 'aborted' | 'pending' | 'completed';

  /** 開始日時（ISO 8601形式） */
  start_time: string;

  /** 終了日時（ISO 8601形式、完了時のみ） */
  end_time?: string;

  /** 進捗情報（Step Functions実行中のみ） */
  progress?: {
    /** 収集成功件数 */
    collected_count: number;
    /** 収集失敗件数 */
    failed_count: number;
  };

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

    // 実行状態を取得（Step Functions優先）
    const stateMachineArn = getStateMachineArn();
    const executionStatus = stateMachineArn
      ? await getStepFunctionsExecutionStatus(execution_id)
      : await getExecutionStatus(execution_id);

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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
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
 * Step Functions実行状態を取得
 *
 * @param execution_id 実行ID
 * @returns 実行状態
 * @throws NotFoundError 実行状態が存在しない場合
 */
async function getStepFunctionsExecutionStatus(execution_id: string): Promise<ExecutionStatus> {
  try {
    const stateMachineArn = getStateMachineArn();
    logger.info('Getting Step Functions execution status', {
      execution_id,
      stateMachineArn,
    });

    // Step Functions実行ARNを構築
    const executionArn = `${stateMachineArn?.replace(':stateMachine:', ':execution:')}:${execution_id}`;

    // Step Functions実行状態を取得
    const command = new DescribeExecutionCommand({
      executionArn,
    });

    const response = await sfnClient.send(command);

    // ステータスマッピング
    const statusMap: Record<string, ExecutionStatus['status']> = {
      RUNNING: 'running',
      SUCCEEDED: 'succeeded',
      FAILED: 'failed',
      TIMED_OUT: 'timed_out',
      ABORTED: 'aborted',
    };

    const status = statusMap[response.status || 'RUNNING'] || 'running';

    // 実行状態テーブルから詳細情報を取得（進捗情報）
    let progress: ExecutionStatus['progress'] | undefined;
    if (status === 'running') {
      try {
        const executionsTableName = getExecutionsTableName();
        const stateCommand = new GetItemCommand({
          TableName: executionsTableName,
          Key: {
            execution_id: { S: execution_id },
          },
        });

        const stateResult = await dynamoClient.send(stateCommand);
        if (stateResult.Item) {
          const stateItem = unmarshall(stateResult.Item) as any;
          progress = {
            collected_count: stateItem.collected_count || 0,
            failed_count: stateItem.failed_count || 0,
          };
        }
      } catch (error) {
        logger.warn('Failed to get execution state details', {
          execution_id,
          error: (error as Error).message,
        });
      }
    }

    const executionStatus: ExecutionStatus = {
      execution_id,
      status,
      start_time: response.startDate?.toISOString() || new Date().toISOString(),
      end_time: response.stopDate?.toISOString(),
      progress,
      error_message: response.error || response.cause,
    };

    logger.info('Step Functions execution status retrieved successfully', {
      execution_id,
      status: executionStatus.status,
    });

    return executionStatus;
  } catch (error) {
    if ((error as any).name === 'ExecutionDoesNotExist') {
      throw new NotFoundError(`Execution not found: ${execution_id}`);
    }

    logger.error(
      'Failed to get Step Functions execution status',
      createErrorContext(error as Error, {
        execution_id,
        stateMachineArn: getStateMachineArn(),
      })
    );

    throw new Error('Failed to retrieve execution status');
  }
}

/**
 * 実行状態を取得（レガシー: DynamoDBのみ）
 *
 * @param execution_id 実行ID
 * @returns 実行状態
 * @throws NotFoundError 実行状態が存在しない場合
 */
async function getExecutionStatus(execution_id: string): Promise<ExecutionStatus> {
  try {
    const executionsTableName = getExecutionsTableName();
    logger.info('Getting execution status from DynamoDB', {
      execution_id,
      tableName: executionsTableName,
      endpoint: process.env.AWS_ENDPOINT_URL,
      region: process.env.AWS_REGION,
    });

    const command = new GetItemCommand({
      TableName: executionsTableName,
      Key: {
        execution_id: { S: execution_id },
      },
    });

    const result = await dynamoClient.send(command);

    logger.info('DynamoDB GetItem result', {
      execution_id,
      hasItem: !!result.Item,
      itemKeys: result.Item ? Object.keys(result.Item) : [],
    });

    if (!result.Item) {
      throw new NotFoundError(`Execution not found: ${execution_id}`);
    }

    const item = unmarshall(result.Item) as any;

    // レガシー形式から新形式へ変換
    const status =
      item.status === 'completed'
        ? 'succeeded'
        : item.status === 'pending'
          ? 'running'
          : item.status;

    const executionStatus: ExecutionStatus = {
      execution_id,
      status,
      start_time: item.started_at,
      end_time: item.completed_at,
      // running状態（pendingから変換された場合も含む）の場合はprogressを含める
      progress:
        status === 'running'
          ? {
              collected_count: item.collected_count || 0,
              failed_count: item.failed_count || 0,
            }
          : undefined,
      error_message: item.error_message,
    };

    logger.info('Execution status retrieved successfully', {
      execution_id,
      status: executionStatus.status,
    });

    return executionStatus;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error(
      'Failed to get execution status from DynamoDB',
      createErrorContext(error as Error, {
        execution_id,
        tableName: getExecutionsTableName(),
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
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

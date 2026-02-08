/**
 * Lambda Collect Handler
 *
 * POST /collect エンドポイントのハンドラー。
 * Lambda Collectorを非同期で呼び出し、実行IDを返却します。
 *
 * Requirements: タスク13.1
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric } from '../../utils/cloudwatch-metrics';
import { ValidationError } from '../../errors';

// Lambda クライアントはグローバルスコープで初期化（再利用される）
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const COLLECTOR_FUNCTION_NAME = process.env.COLLECTOR_FUNCTION_NAME || 'tdnet-collector';

/**
 * POST /collect リクエストボディ
 */
interface CollectRequest {
  /** 開始日（YYYY-MM-DD形式） */
  start_date: string;

  /** 終了日（YYYY-MM-DD形式） */
  end_date: string;
}

/**
 * POST /collect レスポンス
 */
interface CollectResponse {
  /** ステータス */
  status: 'success';

  /** データ */
  data: {
    /** 実行ID */
    execution_id: string;

    /** 状態 */
    status: 'pending';

    /** メッセージ */
    message: string;

    /** 開始日時 */
    started_at: string;
  };
}

/**
 * Lambda Collect ハンドラー
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
    logger.info('POST /collect invoked', {
      requestId: context.requestId,
      functionName: context.functionName,
    });

    // リクエストボディのパース
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const request: CollectRequest = JSON.parse(event.body);

    // バリデーション
    validateRequest(request);

    // Lambda Collectorを非同期で呼び出し
    const execution_id = await invokeCollector(request, context);

    // レスポンス
    const response: CollectResponse = {
      status: 'success',
      data: {
        execution_id,
        status: 'pending',
        message: 'Data collection started successfully',
        started_at: new Date().toISOString(),
      },
    };

    logger.info('POST /collect completed', {
      requestId: context.requestId,
      execution_id,
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
      'POST /collect failed',
      createErrorContext(error as Error, {
        requestId: context.requestId,
        event,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'Collect',
      {}
    );

    return toErrorResponse(error as Error, context.requestId);
  }
}

/**
 * リクエストのバリデーション
 *
 * @param request CollectRequest
 * @throws ValidationError バリデーションエラー
 */
function validateRequest(request: CollectRequest): void {
  // start_date のバリデーション
  if (!request.start_date) {
    throw new ValidationError('start_date is required');
  }

  // end_date のバリデーション
  if (!request.end_date) {
    throw new ValidationError('end_date is required');
  }

  // 日付フォーマットのバリデーション（YYYY-MM-DD）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(request.start_date)) {
    throw new ValidationError(
      `Invalid start_date format: ${request.start_date}. Expected YYYY-MM-DD format.`
    );
  }
  if (!dateRegex.test(request.end_date)) {
    throw new ValidationError(
      `Invalid end_date format: ${request.end_date}. Expected YYYY-MM-DD format.`
    );
  }

  // 日付の有効性チェック
  const startDate = new Date(request.start_date);
  const endDate = new Date(request.end_date);

  if (isNaN(startDate.getTime())) {
    throw new ValidationError(
      `Invalid start_date: ${request.start_date}. Date does not exist.`
    );
  }
  if (isNaN(endDate.getTime())) {
    throw new ValidationError(
      `Invalid end_date: ${request.end_date}. Date does not exist.`
    );
  }

  // 日付の整合性チェック（パースした日付が入力と一致するか）
  // 例: '2024-02-30' は '2024-03-02' にパースされるため、不一致となる
  if (startDate.toISOString().split('T')[0] !== request.start_date) {
    throw new ValidationError(
      `Invalid start_date: ${request.start_date}. Date does not exist.`
    );
  }
  if (endDate.toISOString().split('T')[0] !== request.end_date) {
    throw new ValidationError(
      `Invalid end_date: ${request.end_date}. Date does not exist.`
    );
  }

  // 日付順序チェック
  if (startDate > endDate) {
    throw new ValidationError(
      `start_date (${request.start_date}) must be before or equal to end_date (${request.end_date})`
    );
  }

  // 範囲チェック（過去1年以内）
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (startDate < oneYearAgo) {
    throw new ValidationError(
      `start_date (${request.start_date}) is too old. Maximum range is 1 year.`
    );
  }

  // 未来日チェック
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (endDate > tomorrow) {
    throw new ValidationError(
      `end_date (${request.end_date}) cannot be in the future.`
    );
  }
}

/**
 * Lambda Collectorを非同期で呼び出し
 *
 * @param request CollectRequest
 * @param context Lambda Context
 * @returns 実行ID
 */
async function invokeCollector(
  request: CollectRequest,
  context: Context
): Promise<string> {
  // Lambda Collectorのイベント
  const collectorEvent = {
    mode: 'on-demand',
    start_date: request.start_date,
    end_date: request.end_date,
  };

  logger.info('Invoking Lambda Collector', {
    requestId: context.requestId,
    functionName: COLLECTOR_FUNCTION_NAME,
    event: collectorEvent,
  });

  try {
    // Lambda Collectorを同期で呼び出し（InvocationType: RequestResponse）
    // これにより、Collectorが生成した実際のexecution_idを取得できます
    const command = new InvokeCommand({
      FunctionName: COLLECTOR_FUNCTION_NAME,
      InvocationType: 'RequestResponse', // 同期呼び出し
      Payload: Buffer.from(JSON.stringify(collectorEvent)),
    });

    const response = await lambdaClient.send(command);

    logger.info('Lambda Collector invoked successfully', {
      requestId: context.requestId,
      statusCode: response.StatusCode,
    });

    // Lambda Collectorのレスポンスをパース
    if (!response.Payload) {
      throw new Error('Lambda Collector returned empty response');
    }

    const payloadString = Buffer.from(response.Payload).toString('utf-8');
    const collectorResponse = JSON.parse(payloadString);

    // Lambda Collectorが生成した実際のexecution_idを使用
    const execution_id = collectorResponse.execution_id;

    if (!execution_id) {
      throw new Error('Lambda Collector did not return execution_id');
    }

    logger.info('Received execution_id from Lambda Collector', {
      requestId: context.requestId,
      execution_id,
      status: collectorResponse.status,
    });

    return execution_id;
  } catch (error) {
    logger.error(
      'Failed to invoke Lambda Collector',
      createErrorContext(error as Error, {
        requestId: context.requestId,
        functionName: COLLECTOR_FUNCTION_NAME,
      })
    );
    throw new Error('Failed to start data collection');
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

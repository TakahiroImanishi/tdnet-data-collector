/**
 * Lambda Export Status Handler
 *
 * GET /exports/{export_id} エンドポイント
 * エクスポート状態をDynamoDBから取得して返却します。
 *
 * Requirements: タスク13.5
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { logger, createErrorContext } from '../../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../../utils/cloudwatch-metrics';
import { ValidationError, NotFoundError, AuthenticationError } from '../../../errors';
import { retryWithBackoff } from '../../../utils/retry';

// クライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const EXPORT_STATUS_TABLE = process.env.EXPORT_STATUS_TABLE_NAME || 'tdnet_export_status';

/**
 * Lambda Export Status Handler
 *
 * @param event APIGatewayProxyEvent
 * @param context Lambda Context
 * @returns APIGatewayProxyResult
 *
 * @example
 * ```typescript
 * // GET /exports/export-20240115-xyz789
 * const response = await handler({
 *   pathParameters: { export_id: 'export-20240115-xyz789' },
 *   headers: { 'x-api-key': 'your-api-key' },
 * }, context);
 * ```
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Export Status started', {
      request_id: context.awsRequestId,
      function_name: context.functionName,
      export_id: event.pathParameters?.export_id,
    });

    // export_idの取得とバリデーション
    const exportId = validateExportId(event);

    // DynamoDBからエクスポート状態を取得
    const exportStatus = await getExportStatus(exportId);

    const duration = Date.now() - startTime;

    logger.info('Lambda Export Status completed', {
      export_id: exportId,
      status: exportStatus.status,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'ExportStatus' },
      },
      {
        name: 'ExportStatusQueries',
        value: 1,
        unit: 'Count',
        dimensions: { Status: exportStatus.status },
      },
    ]);

    // レスポンス
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
      },
      body: JSON.stringify({
        status: 'success',
        data: exportStatus,
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Export Status failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        export_id: event.pathParameters?.export_id,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'ExportStatus'
    );

    // エラーレスポンス
    return handleError(error as Error, context.awsRequestId);
  }
}

/**
 * export_idのバリデーション
 *
 * @param event APIGatewayProxyEvent
 * @returns export_id
 * @throws ValidationError export_idが無効な場合
 */
function validateExportId(event: APIGatewayProxyEvent): string {
  const exportId = event.pathParameters?.export_id;

  if (!exportId) {
    throw new ValidationError('export_id is required');
  }

  // export_idのフォーマット検証（例: export-20240115-xyz789）
  if (!/^export-\d{8}-[a-z0-9]+$/.test(exportId)) {
    throw new ValidationError(
      `Invalid export_id format: ${exportId}. Expected format: export-YYYYMMDD-{id}`
    );
  }

  return exportId;
}

/**
 * DynamoDBからエクスポート状態を取得
 *
 * @param exportId エクスポートID
 * @returns エクスポート状態
 * @throws NotFoundError エクスポートが見つからない場合
 */
async function getExportStatus(exportId: string): Promise<ExportStatus> {
  logger.info('Fetching export status from DynamoDB', {
    export_id: exportId,
    table: EXPORT_STATUS_TABLE,
  });

  const result = await retryWithBackoff(
    async () => {
      return await dynamoClient.send(
        new GetItemCommand({
          TableName: EXPORT_STATUS_TABLE,
          Key: {
            export_id: { S: exportId },
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
        return error.name === 'ProvisionedThroughputExceededException';
      },
    }
  );

  if (!result.Item) {
    throw new NotFoundError(`Export not found: ${exportId}`);
  }

  // DynamoDBアイテムをExportStatusに変換
  const item = result.Item;

  const exportStatus: ExportStatus = {
    export_id: item.export_id.S!,
    status: item.status.S! as 'pending' | 'processing' | 'completed' | 'failed',
    progress: parseInt(item.progress.N!, 10),
    requested_at: item.requested_at.S!,
    completed_at: item.completed_at?.S || null,
    export_count: item.export_count?.N ? parseInt(item.export_count.N, 10) : null,
    file_size: item.file_size?.N ? parseInt(item.file_size.N, 10) : null,
    download_url: item.download_url?.S || null,
    expires_at: item.expires_at?.S || null,
    error_message: item.error_message?.S || null,
  };

  logger.info('Export status fetched successfully', {
    export_id: exportId,
    status: exportStatus.status,
    progress: exportStatus.progress,
  });

  return exportStatus;
}

/**
 * エラーハンドリング
 *
 * @param error エラーオブジェクト
 * @param requestId リクエストID
 * @returns APIGatewayProxyResult
 */
function handleError(error: Error, requestId: string): APIGatewayProxyResult {
  // エラー種別に応じたステータスコードとエラーコード
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';

  if (error instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error instanceof AuthenticationError) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
    },
    body: JSON.stringify({
      status: 'error',
      error: {
        code: errorCode,
        message: error.message,
        details: (error as any).details || {},
      },
      request_id: requestId,
    }),
  };
}

/**
 * エクスポート状態の型定義
 */
interface ExportStatus {
  export_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  requested_at: string;
  completed_at: string | null;
  export_count: number | null;
  file_size: number | null;
  download_url: string | null;
  expires_at: string | null;
  error_message: string | null;
}

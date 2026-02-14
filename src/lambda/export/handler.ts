/**
 * Lambda Export Handler
 *
 * TDnet開示情報をJSON/CSV形式でエクスポートするLambda関数のメインハンドラー。
 * APIキー認証を実装し、非同期でエクスポート処理を実行します。
 *
 * Requirements: 要件5.1, 5.2, 5.4, 11.1（エクスポート、認証）
 */

import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';
import { ValidationError, AuthenticationError } from '../../errors';
import { ExportEvent, ExportRequestBody, ExportResponse } from './types';
import { createExportJob } from './create-export-job';
import { processExport } from './process-export';

/**
 * Lambda Exportハンドラー
 *
 * @param event ExportEvent（API Gateway経由）
 * @param context Lambda Context
 * @returns APIGatewayProxyResult
 *
 * @example
 * ```typescript
 * // JSON形式でエクスポート
 * const response = await handler({
 *   headers: { 'x-api-key': 'your-api-key' },
 *   body: JSON.stringify({
 *     format: 'json',
 *     filter: {
 *       start_date: '2024-01-15',
 *       end_date: '2024-01-20',
 *     },
 *   }),
 * }, context);
 *
 * // CSV形式でエクスポート
 * const response = await handler({
 *   headers: { 'x-api-key': 'your-api-key' },
 *   body: JSON.stringify({
 *     format: 'csv',
 *     filter: {
 *       company_code: '1234',
 *       start_date: '2024-01-01',
 *       end_date: '2024-01-31',
 *     },
 *   }),
 * }, context);
 * ```
 */
export async function handler(
  event: ExportEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Export started', {
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // リクエストボディのパース
    const requestBody = parseRequestBody(event.body);

    // バリデーション
    validateRequestBody(requestBody);

    // エクスポートジョブを作成
    const exportJob = await createExportJob(requestBody, context.awsRequestId);

    // 非同期でエクスポート処理を開始（await しない）
    processExport(exportJob.export_id, requestBody)
      .catch((error) => {
        logger.error(
          'Export processing failed',
          createErrorContext(error as Error, {
            export_id: exportJob.export_id,
          })
        );
      });

    const duration = Date.now() - startTime;

    logger.info('Lambda Export completed', {
      export_id: exportJob.export_id,
      status: exportJob.status,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'Export' },
      },
      {
        name: 'ExportJobsCreated',
        value: 1,
        unit: 'Count',
        dimensions: { Format: requestBody.format },
      },
    ]);

    // レスポンス
    const response: ExportResponse = {
      export_id: exportJob.export_id,
      status: exportJob.status,
      message: 'Export job created successfully',
      progress: exportJob.progress,
    };

    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Export failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'Export'
    );

    // エラーレスポンス
    return handleError(error as Error, event.requestContext.requestId);
  }
}

/**
 * リクエストボディのパース
 *
 * @param body リクエストボディ（JSON文字列）
 * @returns ExportRequestBody
 * @throws ValidationError パースエラーの場合
 */
function parseRequestBody(body: string): ExportRequestBody {
  if (!body) {
    throw new ValidationError('Request body is required');
  }

  try {
    return JSON.parse(body) as ExportRequestBody;
  } catch (error) {
    throw new ValidationError('Invalid JSON format in request body', {
      body,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * リクエストボディのバリデーション
 *
 * @param requestBody ExportRequestBody
 * @throws ValidationError バリデーションエラーの場合
 */
function validateRequestBody(requestBody: ExportRequestBody): void {
  // フォーマットのバリデーション
  if (!requestBody.format || !['json', 'csv'].includes(requestBody.format)) {
    throw new ValidationError(
      `Invalid format: ${requestBody.format}. Expected 'json' or 'csv'.`
    );
  }

  // フィルターのバリデーション
  if (!requestBody.filter) {
    throw new ValidationError('Filter is required');
  }

  const { filter } = requestBody;

  // 日付フォーマットのバリデーション（YYYY-MM-DD）
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (filter.start_date && !dateRegex.test(filter.start_date)) {
    throw new ValidationError(
      `Invalid start_date format: ${filter.start_date}. Expected YYYY-MM-DD format.`
    );
  }

  if (filter.end_date && !dateRegex.test(filter.end_date)) {
    throw new ValidationError(
      `Invalid end_date format: ${filter.end_date}. Expected YYYY-MM-DD format.`
    );
  }

  // 日付の有効性チェック
  if (filter.start_date) {
    const startDate = new Date(filter.start_date);
    if (isNaN(startDate.getTime())) {
      throw new ValidationError(
        `Invalid start_date: ${filter.start_date}. Date does not exist.`
      );
    }
  }

  if (filter.end_date) {
    const endDate = new Date(filter.end_date);
    if (isNaN(endDate.getTime())) {
      throw new ValidationError(
        `Invalid end_date: ${filter.end_date}. Date does not exist.`
      );
    }
  }

  // 日付順序チェック
  if (filter.start_date && filter.end_date) {
    const startDate = new Date(filter.start_date);
    const endDate = new Date(filter.end_date);

    if (startDate > endDate) {
      throw new ValidationError(
        `start_date (${filter.start_date}) must be before or equal to end_date (${filter.end_date})`
      );
    }
  }

  // 企業コードのバリデーション（4桁の数字）
  if (filter.company_code && !/^\d{4}$/.test(filter.company_code)) {
    throw new ValidationError(
      `Invalid company_code format: ${filter.company_code}. Expected 4-digit number.`
    );
  }
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

/**
 * Lambda Query Handler
 *
 * TDnet開示情報を検索するLambda関数のメインハンドラー。
 * API Gateway統合により、RESTful APIとして公開されます。
 *
 * Requirements: 要件4.1, 4.3, 4.4, 5.2, 11.1（検索API、認証、PDFダウンロード、CSV形式）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';
import { ValidationError, NotFoundError } from '../../errors';
import { queryDisclosures } from './query-disclosures';
import { formatAsCsv } from './format-csv';
import { Disclosure } from '../../types';

// Secrets Managerクライアント（グローバルスコープで初期化）
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// APIキーキャッシュ（5分TTL）
let cachedApiKey: string | null = null;
let cacheExpiry: number = 0;

/**
 * Secrets ManagerからAPIキーを取得
 *
 * テスト環境（TEST_ENV=e2e）では、API_KEY環境変数から直接取得します。
 * 本番環境では、Secrets Managerから取得します。
 *
 * @returns APIキー
 * @throws Error Secrets Managerからの取得に失敗した場合
 */
async function getApiKey(): Promise<string> {
  // キャッシュチェック
  if (cachedApiKey && Date.now() < cacheExpiry) {
    return cachedApiKey;
  }

  // テスト環境: API_KEY環境変数から直接取得
  if (process.env.TEST_ENV === 'e2e' && process.env.API_KEY) {
    cachedApiKey = process.env.API_KEY;
    cacheExpiry = Date.now() + 5 * 60 * 1000;
    return cachedApiKey;
  }

  // 本番環境: Secrets Managerから取得
  const secretArn = process.env.API_KEY_SECRET_ARN;
  if (!secretArn) {
    throw new Error('API_KEY_SECRET_ARN environment variable is not set');
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    // APIキーをキャッシュ（5分TTL）
    cachedApiKey = response.SecretString;
    cacheExpiry = Date.now() + 5 * 60 * 1000;

    return cachedApiKey;
  } catch (error) {
    logger.error('Failed to retrieve API key from Secrets Manager', {
      error: error instanceof Error ? error.message : String(error),
      secret_arn: secretArn,
    });
    throw new Error('Failed to retrieve API key');
  }
}

/**
 * Lambda Queryイベント（API Gateway統合）
 */
export interface QueryEvent extends APIGatewayProxyEvent {
  queryStringParameters: {
    company_code?: string;
    start_date?: string;
    end_date?: string;
    disclosure_type?: string;
    format?: 'json' | 'csv';
    limit?: string;
    offset?: string;
  } | null;
}

/**
 * クエリレスポンス
 */
export interface QueryResponse {
  /** 検索結果 */
  disclosures: Disclosure[];

  /** 総件数 */
  total: number;

  /** 取得件数 */
  count: number;

  /** オフセット */
  offset: number;

  /** リミット */
  limit: number;
}

/**
 * Lambda Queryハンドラー
 *
 * @param event API Gateway Proxy Event
 * @param context Lambda Context
 * @returns API Gateway Proxy Result
 *
 * @example
 * ```typescript
 * // 企業コードで検索
 * GET /disclosures?company_code=7203
 *
 * // 日付範囲で検索
 * GET /disclosures?start_date=2024-01-15&end_date=2024-01-20
 *
 * // CSV形式で取得
 * GET /disclosures?format=csv&start_date=2024-01-15&end_date=2024-01-20
 * ```
 */
export async function handler(
  event: QueryEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Query started', {
      queryStringParameters: event.queryStringParameters,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // APIキー認証の検証
    await validateApiKey(event);

    // クエリパラメータのパース
    const params = parseQueryParameters(event);

    // 開示情報を検索
    const result = await queryDisclosures(params);

    const duration = Date.now() - startTime;

    logger.info('Lambda Query completed', {
      request_id: context.awsRequestId,
      count: result.count,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'Query' },
      },
      {
        name: 'QueryResultCount',
        value: result.count,
        unit: 'Count',
        dimensions: { Format: params.format },
      },
    ]);

    // フォーマット別レスポンス
    if (params.format === 'csv') {
      const csv = formatAsCsv(result.disclosures);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="disclosures-${Date.now()}.csv"`,
          'Access-Control-Allow-Origin': '*',
        },
        body: csv,
      };
    }

    // JSON形式（デフォルト）
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Query failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'Query'
    );

    return handleError(error as Error, context.awsRequestId);
  }
}

/**
 * 認証エラークラス
 */
class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * APIキー認証の検証
 *
 * @param event API Gateway Proxy Event
 * @throws UnauthorizedError APIキーが無効な場合
 */
async function validateApiKey(event: QueryEvent): Promise<void> {
  const apiKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];

  if (!apiKey) {
    throw new UnauthorizedError('API key is required. Please provide x-api-key header.');
  }

  // Secrets ManagerからAPIキーを取得
  const validApiKey = await getApiKey();

  if (apiKey !== validApiKey) {
    throw new UnauthorizedError('Invalid API key');
  }
}

/**
 * クエリパラメータのパース
 *
 * @param event API Gateway Proxy Event
 * @returns パース済みクエリパラメータ
 * @throws ValidationError バリデーションエラー
 */
function parseQueryParameters(event: QueryEvent): {
  company_code?: string;
  start_date?: string;
  end_date?: string;
  disclosure_type?: string;
  format: 'json' | 'csv';
  limit: number;
  offset: number;
} {
  const params = event.queryStringParameters || {};

  // フォーマットのバリデーション
  const format = (params.format || 'json') as 'json' | 'csv';
  if (!['json', 'csv'].includes(format)) {
    throw new ValidationError(
      `Invalid format: ${format}. Expected 'json' or 'csv'.`
    );
  }

  // リミットのバリデーション（デフォルト: 100、最大: 1000）
  let limit = 100;
  if (params.limit) {
    limit = parseInt(params.limit, 10);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      throw new ValidationError(
        `Invalid limit: ${params.limit}. Expected a number between 1 and 1000.`
      );
    }
  }

  // オフセットのバリデーション（デフォルト: 0）
  let offset = 0;
  if (params.offset) {
    offset = parseInt(params.offset, 10);
    if (isNaN(offset) || offset < 0) {
      throw new ValidationError(
        `Invalid offset: ${params.offset}. Expected a non-negative number.`
      );
    }
  }

  // 日付フォーマットのバリデーション
  if (params.start_date) {
    validateDateFormat(params.start_date, 'start_date');
  }
  if (params.end_date) {
    validateDateFormat(params.end_date, 'end_date');
  }

  // 日付範囲の順序性チェック（Property 8）
  if (params.start_date && params.end_date) {
    const startDate = new Date(params.start_date);
    const endDate = new Date(params.end_date);

    if (startDate > endDate) {
      throw new ValidationError(
        `start_date (${params.start_date}) must be before or equal to end_date (${params.end_date})`
      );
    }
  }

  // 企業コードのバリデーション（4桁の数字）
  if (params.company_code) {
    const companyCodeRegex = /^\d{4}$/;
    if (!companyCodeRegex.test(params.company_code)) {
      throw new ValidationError(
        `Invalid company_code: ${params.company_code}. Expected 4-digit number.`
      );
    }
  }

  return {
    company_code: params.company_code,
    start_date: params.start_date,
    end_date: params.end_date,
    disclosure_type: params.disclosure_type,
    format,
    limit,
    offset,
  };
}

/**
 * 日付フォーマットのバリデーション
 *
 * @param date 日付文字列（YYYY-MM-DD）
 * @param fieldName フィールド名
 * @throws ValidationError バリデーションエラー
 */
function validateDateFormat(date: string, fieldName: string): void {
  // YYYY-MM-DD形式のチェック
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    throw new ValidationError(
      `Invalid ${fieldName} format: ${date}. Expected YYYY-MM-DD format.`
    );
  }

  // 有効な日付かチェック
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    throw new ValidationError(
      `Invalid ${fieldName}: ${date}. Date does not exist.`
    );
  }
}

/**
 * エラーハンドリング
 *
 * カスタムエラーを適切なHTTPステータスコードとエラーコードに変換します。
 *
 * @param error エラーオブジェクト
 * @param requestId リクエストID
 * @returns API Gateway Proxy Result
 */
function handleError(error: Error, requestId: string): APIGatewayProxyResult {
  // エラー種別に応じたステータスコードとエラーコード
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';

  if (error instanceof ValidationError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (error instanceof UnauthorizedError) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (error.message.includes('API key')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  }

  // センシティブ情報を除外したエラーレスポンス
  const errorResponse = {
    error_code: errorCode,
    message: error.message,
    request_id: requestId,
  };

  // 本番環境ではスタックトレースを含めない
  if (process.env.NODE_ENV !== 'production') {
    (errorResponse as any).stack = error.stack;
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

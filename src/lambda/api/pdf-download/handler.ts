/**
 * Lambda PDF Download Handler
 *
 * GET /disclosures/{disclosure_id}/pdf エンドポイント
 * PDFファイルの署名付きURLを生成して返却します。
 *
 * Requirements: タスク13.6
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger, createErrorContext } from '../../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../../utils/cloudwatch-metrics';
import { ValidationError, NotFoundError, AuthenticationError } from '../../../errors';
import { retryWithBackoff } from '../../../utils/retry';

// クライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const DISCLOSURES_TABLE = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';
const PDF_BUCKET = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs';
const DEFAULT_EXPIRATION = 3600; // 1時間（秒）
const MAX_EXPIRATION = 86400; // 24時間（秒）
const MIN_EXPIRATION = 60; // 1分（秒）

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
 * Lambda PDF Download Handler
 *
 * @param event APIGatewayProxyEvent
 * @param context Lambda Context
 * @returns APIGatewayProxyResult
 *
 * @example
 * ```typescript
 * // GET /disclosures/20240115_7203_001/pdf
 * const response = await handler({
 *   pathParameters: { disclosure_id: '20240115_7203_001' },
 *   queryStringParameters: { expiration: '3600' },
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
    logger.info('Lambda PDF Download started', {
      request_id: context.awsRequestId,
      function_name: context.functionName,
      disclosure_id: event.pathParameters?.disclosure_id,
    });

    // APIキー認証
    await validateApiKey(event);

    // disclosure_idの取得とバリデーション
    const disclosureId = validateDisclosureId(event);

    // expirationパラメータの取得とバリデーション
    const expiration = validateExpiration(event);

    // DynamoDBから開示情報を取得
    const disclosure = await getDisclosure(disclosureId);

    // S3キーの検証
    if (!disclosure.pdf_s3_key) {
      throw new NotFoundError(`PDF file not found for disclosure: ${disclosureId}`);
    }

    // S3オブジェクトの存在確認
    await verifyS3ObjectExists(disclosure.pdf_s3_key);

    // 署名付きURLを生成
    const signedUrl = await generateSignedUrl(disclosure.pdf_s3_key, expiration);

    // 有効期限を計算
    const expiresAt = new Date(Date.now() + expiration * 1000).toISOString();

    const duration = Date.now() - startTime;

    logger.info('Lambda PDF Download completed', {
      disclosure_id: disclosureId,
      s3_key: disclosure.pdf_s3_key,
      expiration,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'PDFDownload' },
      },
      {
        name: 'PDFDownloadRequests',
        value: 1,
        unit: 'Count',
        dimensions: { Status: 'Success' },
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
        data: {
          download_url: signedUrl,
          expires_at: expiresAt,
        },
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda PDF Download failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        disclosure_id: event.pathParameters?.disclosure_id,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'PDFDownload'
    );

    // エラーレスポンス
    return handleError(error as Error, context.awsRequestId);
  }
}

/**
 * APIキー認証
 *
 * @param event APIGatewayProxyEvent
 * @throws AuthenticationError APIキーが無効な場合
 */
async function validateApiKey(event: APIGatewayProxyEvent): Promise<void> {
  const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];

  if (!apiKey) {
    throw new AuthenticationError('API key is required');
  }

  // Secrets ManagerからAPIキーを取得
  const validApiKey = await getApiKey();

  if (apiKey !== validApiKey) {
    throw new AuthenticationError('Invalid API key');
  }
}

/**
 * disclosure_idのバリデーション
 *
 * @param event APIGatewayProxyEvent
 * @returns disclosure_id
 * @throws ValidationError disclosure_idが無効な場合
 */
function validateDisclosureId(event: APIGatewayProxyEvent): string {
  const disclosureId = event.pathParameters?.disclosure_id;

  if (!disclosureId) {
    throw new ValidationError('disclosure_id is required');
  }

  // disclosure_idのフォーマット検証（例: 20240115_7203_001）
  if (!/^\d{8}_\d{4}_\d{3}$/.test(disclosureId)) {
    throw new ValidationError(
      `Invalid disclosure_id format: ${disclosureId}. Expected format: YYYYMMDD_CCCC_NNN`
    );
  }

  return disclosureId;
}

/**
 * expirationパラメータのバリデーション
 *
 * @param event APIGatewayProxyEvent
 * @returns expiration（秒）
 * @throws ValidationError expirationが無効な場合
 */
function validateExpiration(event: APIGatewayProxyEvent): number {
  const expirationParam = event.queryStringParameters?.expiration;

  if (!expirationParam) {
    return DEFAULT_EXPIRATION;
  }

  const expiration = parseInt(expirationParam, 10);

  if (isNaN(expiration)) {
    throw new ValidationError(
      `Invalid expiration format: ${expirationParam}. Expected integer.`
    );
  }

  if (expiration < MIN_EXPIRATION || expiration > MAX_EXPIRATION) {
    throw new ValidationError(
      `Expiration out of range: ${expiration}. Must be between ${MIN_EXPIRATION} and ${MAX_EXPIRATION} seconds.`
    );
  }

  return expiration;
}

/**
 * DynamoDBから開示情報を取得
 *
 * @param disclosureId 開示ID
 * @returns 開示情報
 * @throws NotFoundError 開示情報が見つからない場合
 */
async function getDisclosure(disclosureId: string): Promise<Disclosure> {
  logger.info('Fetching disclosure from DynamoDB', {
    disclosure_id: disclosureId,
    table: DISCLOSURES_TABLE,
  });

  const result = await retryWithBackoff(
    async () => {
      return await dynamoClient.send(
        new GetItemCommand({
          TableName: DISCLOSURES_TABLE,
          Key: {
            disclosure_id: { S: disclosureId },
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
    throw new NotFoundError(`Disclosure not found: ${disclosureId}`);
  }

  // DynamoDBアイテムをDisclosureに変換
  const item = result.Item;

  const disclosure: Disclosure = {
    disclosure_id: item.disclosure_id.S!,
    company_code: item.company_code.S!,
    company_name: item.company_name.S!,
    pdf_s3_key: item.pdf_s3_key?.S || null,
  };

  logger.info('Disclosure fetched successfully', {
    disclosure_id: disclosureId,
    pdf_s3_key: disclosure.pdf_s3_key,
  });

  return disclosure;
}

/**
 * S3オブジェクトの存在確認
 *
 * @param s3Key S3キー
 * @throws NotFoundError S3オブジェクトが存在しない場合
 */
async function verifyS3ObjectExists(s3Key: string): Promise<void> {
  logger.info('Verifying S3 object exists', {
    s3_key: s3Key,
    bucket: PDF_BUCKET,
  });

  try {
    await retryWithBackoff(
      async () => {
        await s3Client.send(
          new HeadObjectCommand({
            Bucket: PDF_BUCKET,
            Key: s3Key,
          })
        );
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        shouldRetry: (error) => {
          // 404エラーは再試行しない
          if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
          }
          // その他のエラーは再試行
          return true;
        },
      }
    );

    logger.info('S3 object exists', { s3_key: s3Key });
  } catch (error) {
    if ((error as any).name === 'NotFound' || (error as any).$metadata?.httpStatusCode === 404) {
      throw new NotFoundError(`PDF file not found in S3: ${s3Key}`);
    }
    throw error;
  }
}

/**
 * 署名付きURLを生成
 *
 * @param s3Key S3キー
 * @param expiresIn 有効期限（秒）
 * @returns 署名付きURL
 */
async function generateSignedUrl(s3Key: string, expiresIn: number): Promise<string> {
  logger.info('Generating signed URL', {
    s3_key: s3Key,
    bucket: PDF_BUCKET,
    expires_in: expiresIn,
  });

  const command = new GetObjectCommand({
    Bucket: PDF_BUCKET,
    Key: s3Key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });

  logger.info('Signed URL generated successfully', {
    s3_key: s3Key,
    url_length: signedUrl.length,
  });

  return signedUrl;
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
 * 開示情報の型定義（最小限）
 */
interface Disclosure {
  disclosure_id: string;
  company_code: string;
  company_name: string;
  pdf_s3_key: string | null;
}

/**
 * Lambda Get Disclosure Handler
 *
 * 開示情報の詳細を取得するLambda関数のメインハンドラー。
 * API Gateway統合により、RESTful APIとして公開されます。
 *
 * Requirements: 要件4.1, 4.3, 4.4（検索API、認証、PDFダウンロード）
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';
import { NotFoundError } from '../../errors';
import { Disclosure } from '../../types';

// AWS クライアント（グローバルスコープで初期化）
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });

/**
 * DynamoDBから開示情報を取得
 */
async function getDisclosureFromDB(disclosureId: string): Promise<Disclosure> {
  const tableName = process.env.DYNAMODB_TABLE_NAME;
  if (!tableName) {
    throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
  }

  const command = new GetCommand({
    TableName: tableName,
    Key: {
      disclosure_id: disclosureId,
    },
  });

  const result = await docClient.send(command);

  if (!result.Item) {
    throw new NotFoundError(`Disclosure not found: ${disclosureId}`);
  }

  return result.Item as Disclosure;
}

/**
 * S3署名付きURLを生成
 */
async function generateSignedUrl(s3Key: string, expirationSeconds: number = 3600): Promise<string> {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: expirationSeconds,
  });

  return signedUrl;
}

/**
 * Lambda Get Disclosureハンドラー
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Get Disclosure started', {
      pathParameters: event.pathParameters,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // パスパラメータからdisclosure_idを取得
    const disclosureId = event.pathParameters?.id;
    if (!disclosureId) {
      throw new Error('Disclosure ID is required');
    }

    // DynamoDBから開示情報を取得
    const disclosure = await getDisclosureFromDB(disclosureId);

    // S3署名付きURLを生成（PDFが存在する場合）
    let pdfUrl: string | null = null;
    if (disclosure.pdf_s3_key) {
      const expirationParam = event.queryStringParameters?.expiration;
      const expiration = expirationParam ? parseInt(expirationParam, 10) : 3600;
      
      // 有効期限のバリデーション（1秒〜7日）
      if (expiration < 1 || expiration > 604800) {
        throw new Error('Expiration must be between 1 and 604800 seconds');
      }

      pdfUrl = await generateSignedUrl(disclosure.pdf_s3_key, expiration);
    }

    const duration = Date.now() - startTime;

    logger.info('Lambda Get Disclosure completed', {
      request_id: context.awsRequestId,
      disclosure_id: disclosureId,
      duration_ms: duration,
    });

    // 成功メトリクス送信
    await sendMetrics([
      {
        name: 'LambdaExecutionTime',
        value: duration,
        unit: 'Milliseconds',
        dimensions: { FunctionName: 'GetDisclosure' },
      },
    ]);

    // レスポンス
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          ...disclosure,
          pdf_url: pdfUrl,
        },
      }),
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Get Disclosure failed',
      createErrorContext(error as Error, {
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'GetDisclosure'
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

  if (error instanceof NotFoundError) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (error.message.includes('Expiration')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  }

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

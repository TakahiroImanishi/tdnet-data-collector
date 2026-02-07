---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*|**/scraper/**/*|**/api/**/*'
---

# Error Handling Implementation

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの詳細な実装パターンをまとめたものです。

**基本原則については `core/error-handling-patterns.md` を参照してください。**

## 再試行戦略の実装

### 指数バックオフ（Exponential Backoff）

**型定義とシグネチャ:**

```typescript
interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    jitter?: boolean;
}

class RetryableError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'RetryableError';
    }
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    // 指数バックオフで再試行を実装
    // - maxRetriesまで再試行
    // - initialDelayから開始し、backoffMultiplierで増加
    // - maxDelayを超えない
    // - jitterでランダム性を追加（サンダリングハード問題を回避）
    // - RetryableErrorのみ再試行、それ以外は即座に失敗
    // 詳細な実装は src/utils/retry.ts を参照
}
```

**使用例:**

```typescript
async function downloadPDFWithRetry(url: string): Promise<Buffer> {
    return retryWithBackoff(
        async () => {
            try {
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });
                return Buffer.from(response.data);
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    // 再試行可能なエラー
                    if (
                        error.code === 'ECONNRESET' ||
                        error.code === 'ETIMEDOUT' ||
                        error.response?.status === 503 ||
                        error.response?.status === 429
                    ) {
                        throw new RetryableError(
                            `Retryable error: ${error.message}`,
                            error
                        );
                    }
                    
                    // 再試行不可能なエラー
                    if (error.response?.status === 404) {
                        throw new Error('PDF not found');
                    }
                }
                throw error;
            }
        },
        {
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: true,
        }
    );
}
```

### AWS SDK自動再試行の設定

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// DynamoDBクライアントの再試行設定
const dynamoClient = new DynamoDBClient({
    region: 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive', // adaptive, standard, legacy
});

// S3クライアントの再試行設定
const s3Client = new S3Client({
    region: 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

// カスタム再試行戦略
import { ConfiguredRetryStrategy } from '@aws-sdk/util-retry';

const customRetryStrategy = new ConfiguredRetryStrategy(
    3, // maxAttempts
    (attempt: number) => {
        // カスタムバックオフ計算
        return Math.min(1000 * Math.pow(2, attempt), 20000);
    }
);

const dynamoClientWithCustomRetry = new DynamoDBClient({
    region: 'ap-northeast-1',
    retryStrategy: customRetryStrategy,
});
```

### エラー分類ヘルパー

**シグネチャ:**

```typescript
function isRetryableError(error: any): boolean {
    // エラーが再試行可能かどうかを判定
    // - ネットワークエラー（ECONNRESET, ETIMEDOUT, ENOTFOUND）
    // - HTTPステータスコード（429, 503, 5xx）
    // - AWS SDKエラー（ThrottlingException, ServiceUnavailable等）
    // 詳細な実装は src/utils/error-classifier.ts を参照
}
```

**使用例:**

```typescript
async function processWithSmartRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    return retryWithBackoff(
        async () => {
            try {
                return await fn();
            } catch (error) {
                if (isRetryableError(error)) {
                    throw new RetryableError(
                        `Retryable error: ${error.message}`,
                        error
                    );
                }
                throw error;
            }
        },
        options
    );
}
```

### サーキットブレーカーパターン

連続して失敗が続く場合、一定期間リクエストを停止：

**シグネチャ:**

```typescript
class CircuitBreaker {
    constructor(
        private threshold: number = 5,
        private timeout: number = 60000
    ) {}
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // サーキットブレーカーパターンを実装
        // - CLOSED: 正常動作
        // - OPEN: 連続失敗（threshold超過）でリクエスト停止
        // - HALF_OPEN: タイムアウト後に再試行
        // 詳細な実装は src/utils/circuit-breaker.ts を参照
    }
}
```

**使用例:**

```typescript
const circuitBreaker = new CircuitBreaker(5, 60000);

async function fetchWithCircuitBreaker(url: string): Promise<any> {
    return circuitBreaker.execute(async () => {
        const response = await axios.get(url);
        return response.data;
    });
}
```

## エラーコード詳細

各エラーコードの詳細な使用方法、使用場面、実装例については、`../core/error-handling-patterns.md` のエラーコード標準化セクションを参照してください。

### エラーコード変換マップ

Lambda関数内でカスタムエラーをHTTPステータスコードに変換する際の参照表：

```typescript
const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'ForbiddenError': { statusCode: 403, code: 'FORBIDDEN' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    'ConflictError': { statusCode: 409, code: 'CONFLICT' },
    'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
    'InternalError': { statusCode: 500, code: 'INTERNAL_ERROR' },
    'ServiceUnavailableError': { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
    'GatewayTimeoutError': { statusCode: 504, code: 'GATEWAY_TIMEOUT' },
};
```

## エラーログ構造

### 標準エラーログフォーマット

```typescript
interface ErrorLog {
    level: 'error' | 'warn';
    timestamp: string; // ISO8601
    error_type: string;
    error_message: string;
    error_code?: string;
    context: {
        disclosure_id?: string;
        company_code?: string;
        retry_count?: number;
        execution_id?: string;
        [key: string]: any;
    };
    stack_trace?: string;
}

// 使用例
logger.error('Failed to download PDF', {
    error_type: 'NetworkError',
    error_message: error.message,
    error_code: error.code,
    context: {
        disclosure_id: 'TD20240115001',
        company_code: '7203',
        retry_count: 2,
        execution_id: context.requestId,
        pdf_url: 'https://...',
    },
    stack_trace: error.stack,
});
```

### エラー集約とアラート

**シグネチャ:**

```typescript
class ErrorAggregator {
    recordError(errorType: string): void {
        // エラーを集約し、閾値を超えたらアラート送信
        // - エラータイプごとにカウント
        // - 閾値（デフォルト10）を超えたらSNS経由でアラート
        // 詳細な実装は src/utils/error-aggregator.ts を参照
    }
}
```

**使用例:**

```typescript
const errorAggregator = new ErrorAggregator();

try {
    await processDisclosure(disclosure);
} catch (error) {
    errorAggregator.recordError(error.name);
    throw error;
}
```

## エラーハンドリングのベストプラクティス

### 1. エラーの適切な伝播

```typescript
// ❌ 悪い例: エラーを握りつぶす
try {
    await downloadPDF(url);
} catch (error) {
    console.log('Error occurred');
    // エラーが失われる
}

// ✅ 良い例: エラーを適切に伝播
try {
    await downloadPDF(url);
} catch (error) {
    logger.error('Failed to download PDF', { url, error });
    throw new DownloadError('PDF download failed', { cause: error });
}
```

### 2. エラーコンテキストの保持

```typescript
async function processDisclosure(disclosure: Disclosure) {
    const context = {
        disclosure_id: disclosure.disclosure_id,
        company_code: disclosure.company_code,
        execution_id: crypto.randomUUID(),
    };
    
    try {
        logger.info('Processing disclosure', context);
        
        const pdf = await downloadPDF(disclosure.pdf_url);
        await savePDF(pdf, disclosure.pdf_s3_key);
        await saveMetadata(disclosure);
        
        logger.info('Successfully processed disclosure', context);
    } catch (error) {
        logger.error('Failed to process disclosure', {
            ...context,
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}
```

### 3. Graceful Degradation（段階的機能低下）

```typescript
async function collectDisclosures(date: string): Promise<CollectionResult> {
    const disclosures = await scrapeDisclosureList(date);
    const results = {
        collected: 0,
        failed: 0,
        errors: [] as string[],
    };
    
    for (const disclosure of disclosures) {
        try {
            await processDisclosure(disclosure);
            results.collected++;
        } catch (error) {
            // 個別の失敗は記録するが、処理は継続
            results.failed++;
            results.errors.push(`${disclosure.disclosure_id}: ${error.message}`);
            logger.error('Failed to process disclosure', {
                disclosure_id: disclosure.disclosure_id,
                error,
            });
        }
    }
    
    // 一部失敗しても、成功した分は返す
    return results;
}
```

### 4. タイムアウトの設定

```typescript
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
}

// 使用例
const pdf = await withTimeout(
    downloadPDF(url),
    30000,
    'PDF download timed out after 30 seconds'
);
```

## Lambda固有のエラーハンドリング

### Lambda関数のエラーレスポンス

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'success',
                data: result,
            }),
        };
    } catch (error) {
        logger.error('Lambda execution failed', {
            event,
            requestId: context.requestId,
            error: error.message,
            stack: error.stack,
        });
        
        // エラーの種類に応じて適切なステータスコードを返す
        if (error instanceof ValidationError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    status: 'error',
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                    },
                }),
            };
        }
        
        if (error instanceof UnauthorizedError) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    status: 'error',
                    error: {
                        code: 'UNAUTHORIZED',
                        message: error.message,
                    },
                }),
            };
        }
        
        if (error instanceof NotFoundError) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    status: 'error',
                    error: {
                        code: 'NOT_FOUND',
                        message: error.message,
                    },
                }),
            };
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    request_id: context.requestId,
                },
            }),
        };
    }
};
```

### エラーレスポンス変換ヘルパー

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';

function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
        'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
        'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
        'ForbiddenError': { statusCode: 403, code: 'FORBIDDEN' },
        'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
        'ConflictError': { statusCode: 409, code: 'CONFLICT' },
        'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
        'InternalError': { statusCode: 500, code: 'INTERNAL_ERROR' },
        'ServiceUnavailableError': { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
        'GatewayTimeoutError': { statusCode: 504, code: 'GATEWAY_TIMEOUT' },
    };
    
    const mapping = ERROR_CODE_MAP[error.name] || {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
    };
    
    return {
        statusCode: mapping.statusCode,
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

// 使用例
export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'success',
                data: result,
            }),
        };
    } catch (error) {
        logger.error('Lambda execution failed', {
            event,
            requestId: context.requestId,
            error: error.message,
            stack: error.stack,
        });
        
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

### Dead Letter Queue（DLQ）の活用

```typescript
// CDKでDLQを設定
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';

const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    // ...
    deadLetterQueue: dlq,
    deadLetterQueueEnabled: true,
});

// DLQからのメッセージを処理する別のLambda
const dlqProcessorFn = new lambda.Function(this, 'DLQProcessor', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/dlq-processor'),
    environment: {
        ALERT_TOPIC_ARN: alertTopic.topicArn,
    },
});

dlq.grantConsumeMessages(dlqProcessorFn);

// DLQプロセッサーの実装例
export const handler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        const failedMessage = JSON.parse(record.body);
        
        logger.error('Processing DLQ message', {
            messageId: record.messageId,
            failedMessage,
        });
        
        // アラート送信
        await sns.publish({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: 'Lambda execution failed - DLQ message',
            Message: JSON.stringify({
                messageId: record.messageId,
                failedMessage,
                timestamp: new Date().toISOString(),
            }),
        });
    }
};
```

## まとめ

- 指数バックオフとジッターで再試行を実装
- AWS SDKの自動再試行機能を活用
- サーキットブレーカーで連続失敗を防止
- エラーログは構造化し、十分なコンテキストを含める
- Lambda関数では適切なHTTPステータスコードを返す
- DLQで失敗したメッセージを処理

## 関連ドキュメント

- **基本原則**: `../core/error-handling-patterns.md` - エラー分類とカスタムエラークラス
- **API設計**: `../api/api-design-guidelines.md` - APIエラーレスポンスの詳細
- **実装ルール**: `../core/tdnet-implementation-rules.md` - エラーハンドリングの基本原則
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - エラーアラートの設定
- **テスト戦略**: `testing-strategy.md` - エラーケースのテスト

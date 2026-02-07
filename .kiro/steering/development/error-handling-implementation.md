---
inclusion: fileMatch
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts'
---

# Error Handling Implementation - 詳細実装ガイド

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの**詳細な実装パターン**をまとめたものです。

## 役割分担

| ファイル | 役割 | 内容 |
|---------|------|------|
| **core/error-handling-patterns.md** | 基本原則 | エラー分類、カスタムエラークラス、再試行戦略の概要 |
| **api/error-codes.md** | エラーコード標準化 | HTTPステータスコード、エラーコード一覧、使用ガイドライン |
| **development/error-handling-implementation.md** (このファイル) | 詳細実装 | 具体的なコード例、AWS SDK設定、サーキットブレーカー、Lambda実装 |

**前提知識:**
- エラー分類（Retryable/Non-Retryable/Partial Failure）は `../core/error-handling-patterns.md` を参照
- カスタムエラークラス（ValidationError、RetryableError等）は `../core/error-handling-patterns.md` を参照
- エラーコード標準化（VALIDATION_ERROR、NOT_FOUND等）は `../api/error-codes.md` を参照

## 目次

1. [再試行戦略の実装](#再試行戦略の実装)
2. [AWS SDK設定](#aws-sdk設定)
3. [サーキットブレーカーパターン](#サーキットブレーカーパターン)
4. [エラーログ構造](#エラーログ構造)
5. [Lambda固有の実装](#lambda固有の実装)
6. [ベストプラクティス](#ベストプラクティス)

---

## 再試行戦略の実装

### 完全な指数バックオフ実装

**ファイル配置:** `src/utils/retry.ts`

```typescript
import { logger } from './logger';
import { RetryableError } from './errors';

interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    jitter?: boolean;
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 60000,
        backoffMultiplier = 2,
        jitter = true,
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // 再試行不可能なエラーは即座に失敗
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            
            // 最後の試行で失敗した場合
            if (attempt === maxRetries) {
                logger.error('Max retries exceeded', {
                    attempts: attempt + 1,
                    error: lastError.message,
                });
                throw lastError;
            }
            
            // 待機時間を計算（指数バックオフ）
            let delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );
            
            // ジッター追加（ランダム性でサンダリングハード問題を回避）
            if (jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            logger.warn('Retrying after error', {
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastError.message,
            });
            
            await sleep(delay);
        }
    }
    
    throw lastError!;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

**使用例:**

```typescript
import axios from 'axios';
import { retryWithBackoff } from './utils/retry';
import { RetryableError } from './utils/errors';

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

### エラー分類ヘルパーの実装

**ファイル配置:** `src/utils/error-classifier.ts`

```typescript
import { RetryableError } from './errors';
import { retryWithBackoff, RetryOptions } from './retry';

/**
 * エラーが再試行可能かどうかを判定
 * 
 * 再試行可能なエラー:
 * - ネットワークエラー（ECONNRESET, ETIMEDOUT, ENOTFOUND）
 * - HTTPステータスコード（429, 503, 5xx）
 * - AWS SDKエラー（ThrottlingException, ServiceUnavailable等）
 */
function isRetryableError(error: any): boolean {
    // ネットワークエラー
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
        return true;
    }
    
    // HTTPステータスコード
    if (error.response?.status) {
        const status = error.response.status;
        return status === 429 || status === 503 || status >= 500;
    }
    
    // AWS SDKエラー
    if (error.name === 'ThrottlingException' ||
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'ServiceUnavailable') {
        return true;
    }
    
    return false;
}

/**
 * スマート再試行ラッパー
 * エラーを自動的に分類し、再試行可能な場合のみ再試行
 */
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

---

## AWS SDK設定

### DynamoDBクライアントの再試行設定

**ファイル配置:** `src/config/aws-clients.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// 基本的な再試行設定
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive', // adaptive, standard, legacy
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
    },
});

export { dynamoClient, docClient };
```

### S3クライアントの再試行設定

```typescript
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

export { s3Client };
```

### カスタム再試行戦略

```typescript
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

### 再試行モードの比較

| モード | 説明 | 使用場面 |
|--------|------|---------|
| **adaptive** | トラフィックに応じて動的に調整 | 本番環境推奨（デフォルト） |
| **standard** | 標準的な指数バックオフ | 一般的な用途 |
| **legacy** | 旧バージョンとの互換性 | 移行期のみ |

---

## サーキットブレーカーパターン

連続して失敗が続く場合、一定期間リクエストを停止してシステムを保護します。

**ファイル配置:** `src/utils/circuit-breaker.ts`

### 完全な実装

```typescript
import { logger } from './logger';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    threshold?: number;
    timeout?: number;
    onStateChange?: (state: CircuitState) => void;
}

class CircuitBreaker {
    private failureCount = 0;
    private lastFailureTime: number | null = null;
    private state: CircuitState = 'CLOSED';
    private readonly threshold: number;
    private readonly timeout: number;
    private readonly onStateChange?: (state: CircuitState) => void;
    
    constructor(options: CircuitBreakerOptions = {}) {
        this.threshold = options.threshold || 5;
        this.timeout = options.timeout || 60000;
        this.onStateChange = options.onStateChange;
    }
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // OPEN状態の場合、タイムアウト経過をチェック
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime! > this.timeout) {
                this.transitionTo('HALF_OPEN');
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess() {
        this.failureCount = 0;
        this.transitionTo('CLOSED');
    }
    
    private onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.transitionTo('OPEN');
        }
    }
    
    private transitionTo(newState: CircuitState) {
        if (this.state !== newState) {
            logger.info('Circuit breaker state transition', {
                from: this.state,
                to: newState,
                failureCount: this.failureCount,
            });
            this.state = newState;
            this.onStateChange?.(newState);
        }
    }
    
    getState(): CircuitState {
        return this.state;
    }
    
    reset() {
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.transitionTo('CLOSED');
    }
}

export { CircuitBreaker, CircuitState, CircuitBreakerOptions };
```

### 使用例

```typescript
import { CircuitBreaker } from './utils/circuit-breaker';

// TDnetスクレイピング用のサーキットブレーカー
const tdnetCircuitBreaker = new CircuitBreaker({
    threshold: 5,
    timeout: 60000,
    onStateChange: (state) => {
        logger.warn('TDnet circuit breaker state changed', { state });
        if (state === 'OPEN') {
            // アラート送信
            sendAlert('TDnet circuit breaker opened');
        }
    },
});

async function scrapeTDnetWithCircuitBreaker(url: string): Promise<any> {
    return tdnetCircuitBreaker.execute(async () => {
        const response = await axios.get(url);
        return response.data;
    });
}
```

---

## エラーコード変換

**エラーコードの詳細については `../api/error-codes.md` を参照してください。**

### Lambda用エラーコード変換マップ

Lambda関数内でカスタムエラーをHTTPステータスコードに変換する際の参照表：

**ファイル配置:** `src/utils/error-response.ts`

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

export { ERROR_CODE_MAP };
```

---

## エラーログ構造

### 標準エラーログフォーマット

**ファイル配置:** `src/utils/logger.ts`

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

**ファイル配置:** `src/utils/error-aggregator.ts`

```typescript
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from './logger';

interface ErrorAggregatorOptions {
    threshold?: number;
    windowMs?: number;
    alertTopicArn?: string;
}

class ErrorAggregator {
    private errorCounts = new Map<string, number>();
    private windowStart = Date.now();
    private readonly threshold: number;
    private readonly windowMs: number;
    private readonly alertTopicArn?: string;
    private readonly snsClient: SNSClient;
    
    constructor(options: ErrorAggregatorOptions = {}) {
        this.threshold = options.threshold || 10;
        this.windowMs = options.windowMs || 60000; // 1分
        this.alertTopicArn = options.alertTopicArn || process.env.ALERT_TOPIC_ARN;
        this.snsClient = new SNSClient({ region: process.env.AWS_REGION });
    }
    
    recordError(errorType: string): void {
        // ウィンドウをリセット
        if (Date.now() - this.windowStart > this.windowMs) {
            this.errorCounts.clear();
            this.windowStart = Date.now();
        }
        
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
        
        // 閾値を超えたらアラート
        if (count + 1 === this.threshold) {
            this.sendAlert(errorType, count + 1);
        }
    }
    
    private async sendAlert(errorType: string, count: number): Promise<void> {
        if (!this.alertTopicArn) {
            logger.warn('Alert topic ARN not configured');
            return;
        }
        
        try {
            await this.snsClient.send(new PublishCommand({
                TopicArn: this.alertTopicArn,
                Subject: `High error rate detected: ${errorType}`,
                Message: JSON.stringify({
                    error_type: errorType,
                    count,
                    threshold: this.threshold,
                    window_ms: this.windowMs,
                    timestamp: new Date().toISOString(),
                }),
            }));
            
            logger.info('Error alert sent', { errorType, count });
        } catch (error) {
            logger.error('Failed to send error alert', { error });
        }
    }
    
    getErrorCounts(): Map<string, number> {
        return new Map(this.errorCounts);
    }
}

export { ErrorAggregator, ErrorAggregatorOptions };
```

**使用例:**

```typescript
import { ErrorAggregator } from './utils/error-aggregator';

const errorAggregator = new ErrorAggregator({
    threshold: 10,
    windowMs: 60000,
    alertTopicArn: process.env.ALERT_TOPIC_ARN,
});

try {
    await processDisclosure(disclosure);
} catch (error) {
    errorAggregator.recordError(error.name);
    throw error;
}
```

---

## ベストプラクティス

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

**ファイル配置:** `src/utils/timeout.ts`

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

export { withTimeout };
```

**使用例:**

```typescript
import { withTimeout } from './utils/timeout';

const pdf = await withTimeout(
    downloadPDF(url),
    30000,
    'PDF download timed out after 30 seconds'
);
```

---

## Lambda固有の実装

### Lambda関数の基本エラーハンドリング

**ファイル配置:** `lambda/*/index.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { toErrorResponse } from './utils/error-response';
import { logger } from './utils/logger';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
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

### エラーレスポンス変換ヘルパー

**ファイル配置:** `src/utils/error-response.ts`

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';
import { ERROR_CODE_MAP } from './error-code-map';

function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
    };
    
    return {
        statusCode: mapping.statusCode,
        headers: {
            'Content-Type': 'application/json',
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

export { toErrorResponse };
```

### Dead Letter Queue（DLQ）の設定と処理

#### CDKでのDLQ設定

**ファイル配置:** `cdk/lib/tdnet-stack.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

// DLQの作成
const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
    visibilityTimeout: cdk.Duration.minutes(5),
});

// Lambda関数にDLQを設定
const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/collector'),
    timeout: cdk.Duration.minutes(15),
    deadLetterQueue: dlq,
    deadLetterQueueEnabled: true,
    retryAttempts: 2, // Lambda非同期呼び出しの再試行回数
});

// DLQプロセッサーLambda
const dlqProcessorFn = new lambda.Function(this, 'DLQProcessor', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/dlq-processor'),
    environment: {
        ALERT_TOPIC_ARN: alertTopic.topicArn,
    },
});

// DLQをイベントソースとして設定
dlqProcessorFn.addEventSource(new lambdaEventSources.SqsEventSource(dlq, {
    batchSize: 10,
}));

dlq.grantConsumeMessages(dlqProcessorFn);
alertTopic.grantPublish(dlqProcessorFn);
```

#### DLQプロセッサーの実装

**ファイル配置:** `lambda/dlq-processor/index.ts`

```typescript
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from './utils/logger';

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const handler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        await processDLQMessage(record);
    }
};

async function processDLQMessage(record: SQSRecord): Promise<void> {
    try {
        const failedMessage = JSON.parse(record.body);
        
        logger.error('Processing DLQ message', {
            messageId: record.messageId,
            failedMessage,
            attributes: record.attributes,
        });
        
        // アラート送信
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: 'Lambda execution failed - DLQ message',
            Message: JSON.stringify({
                messageId: record.messageId,
                failedMessage,
                sentTimestamp: record.attributes.SentTimestamp,
                approximateReceiveCount: record.attributes.ApproximateReceiveCount,
                timestamp: new Date().toISOString(),
            }, null, 2),
        }));
        
        logger.info('DLQ alert sent', { messageId: record.messageId });
    } catch (error) {
        logger.error('Failed to process DLQ message', {
            messageId: record.messageId,
            error,
        });
        // DLQプロセッサー自体の失敗は再スローしない
        // （無限ループを避けるため）
    }
}
```

---

## まとめ

- 指数バックオフとジッターで再試行を実装
- AWS SDKの自動再試行機能を活用
- サーキットブレーカーで連続失敗を防止
- エラーログは構造化し、十分なコンテキストを含める
- Lambda関数では適切なHTTPステータスコードを返す
- DLQで失敗したメッセージを処理

## 関連ドキュメント

- **基本原則**: `../core/error-handling-patterns.md` - エラー分類とカスタムエラークラス
- **Lambda実装ガイド**: `lambda-implementation.md` - Lambda関数特有のエラーハンドリング基本パターン
- **API設計**: `../api/api-design-guidelines.md` - APIエラーレスポンスの詳細
- **実装ルール**: `../core/tdnet-implementation-rules.md` - エラーハンドリングの基本原則
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - エラーアラートの設定
- **テスト戦略**: `testing-strategy.md` - エラーケースのテスト


## まとめ

このファイルでは、エラーハンドリングの詳細な実装パターンを説明しました：

### 実装済みユーティリティ

| ユーティリティ | ファイル配置 | 用途 |
|--------------|------------|------|
| `retryWithBackoff` | `src/utils/retry.ts` | 指数バックオフによる再試行 |
| `isRetryableError` | `src/utils/error-classifier.ts` | エラー分類 |
| `processWithSmartRetry` | `src/utils/error-classifier.ts` | スマート再試行ラッパー |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` | サーキットブレーカー |
| `ErrorAggregator` | `src/utils/error-aggregator.ts` | エラー集約とアラート |
| `withTimeout` | `src/utils/timeout.ts` | タイムアウト設定 |
| `toErrorResponse` | `src/utils/error-response.ts` | Lambda用エラーレスポンス変換 |

### AWS SDK設定

- DynamoDBクライアント: `adaptive`モード、3回再試行
- S3クライアント: `adaptive`モード、3回再試行
- カスタム再試行戦略: 必要に応じて実装

### Lambda実装

- 基本エラーハンドリング: `toErrorResponse`ヘルパーを使用
- DLQ設定: CDKで設定、DLQプロセッサーでアラート送信
- 再試行回数: 非同期呼び出しで2回

### ベストプラクティス

1. エラーを適切に伝播する
2. エラーコンテキストを保持する
3. Graceful Degradationを実装する
4. タイムアウトを適切に設定する

---

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則（エラー分類とカスタムエラークラス）
- `../api/error-codes.md` - エラーコード標準（APIエラーコードの詳細定義）
- `lambda-implementation.md` - Lambda実装ガイド（Lambda関数特有のエラーハンドリング基本パターン）


---
inclusion: fileMatch
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts|**/models/**/*.ts|**/types/**/*.ts'
---

# Error Handling Implementation - 詳細実装ガイド

TDnet Data Collectorプロジェクトにおけるエラーハンドリングの詳細実装パターン。

## 役割分担

| ファイル | 役割 |
|---------|------|
| `core/error-handling-patterns.md` | エラー分類、カスタムエラークラス、再試行戦略の概要 |
| `api/error-codes.md` | HTTPステータスコード、エラーコード一覧 |
| このファイル | 具体的な実装パターン、AWS SDK設定、Lambda実装 |

---

## 再試行戦略の実装

### 基本実装

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
            
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            
            if (attempt === maxRetries) {
                logger.error('Max retries exceeded', {
                    attempts: attempt + 1,
                    error: lastError.message,
                });
                throw lastError;
            }
            
            let delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );
            
            if (jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            logger.warn('Retrying after error', {
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastError.message,
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError!;
}
```

### エラー分類ヘルパー

**ファイル配置:** `src/utils/error-classifier.ts`

```typescript
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
```

---

## AWS SDK設定

### 再試行設定（表形式）

| クライアント | 設定 | 値 |
|------------|------|-----|
| **DynamoDB** | maxAttempts | 3 |
| | retryMode | adaptive |
| **S3** | maxAttempts | 3 |
| | retryMode | adaptive |

**ファイル配置:** `src/config/aws-clients.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
    },
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

export { dynamoClient, docClient, s3Client };
```

### 再試行モード

| モード | 説明 | 使用場面 |
|--------|------|---------|
| **adaptive** | トラフィックに応じて動的に調整 | 本番環境推奨 |
| **standard** | 標準的な指数バックオフ | 一般的な用途 |
| **legacy** | 旧バージョンとの互換性 | 移行期のみ |

---

## サーキットブレーカーパターン

連続失敗時に一定期間リクエストを停止してシステムを保護。

**ファイル配置:** `src/utils/circuit-breaker.ts`

### 基本実装

```typescript
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    threshold?: number;      // 失敗回数の閾値（デフォルト: 5）
    timeout?: number;        // OPEN状態の継続時間（デフォルト: 60000ms）
}

class CircuitBreaker {
    private failureCount = 0;
    private lastFailureTime: number | null = null;
    private state: CircuitState = 'CLOSED';
    private readonly threshold: number;
    private readonly timeout: number;
    
    constructor(options: CircuitBreakerOptions = {}) {
        this.threshold = options.threshold || 5;
        this.timeout = options.timeout || 60000;
    }
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
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
        }
    }
}
```

---

## エラーログ構造

### 標準フォーマット

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
    },
    stack_trace: error.stack,
});
```

---

## Lambda固有の実装

### 基本エラーハンドリング

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
            headers: { 'Content-Type': 'application/json' },
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

### エラーレスポンス変換

**ファイル配置:** `src/utils/error-response.ts`

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';

const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'ForbiddenError': { statusCode: 403, code: 'FORBIDDEN' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    'ConflictError': { statusCode: 409, code: 'CONFLICT' },
    'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
    'InternalError': { statusCode: 500, code: 'INTERNAL_ERROR' },
    'ServiceUnavailableError': { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
};

function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
    };
    
    return {
        statusCode: mapping.statusCode,
        headers: { 'Content-Type': 'application/json' },
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
```

### DLQ設定

#### CDK設定

**ファイル配置:** `cdk/lib/tdnet-stack.ts`

```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
    visibilityTimeout: cdk.Duration.minutes(5),
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/collector'),
    timeout: cdk.Duration.minutes(15),
    deadLetterQueue: dlq,
    deadLetterQueueEnabled: true,
    retryAttempts: 2,
});
```

#### DLQプロセッサー

**ファイル配置:** `lambda/dlq-processor/index.ts`

```typescript
import { SQSEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const handler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        const failedMessage = JSON.parse(record.body);
        
        logger.error('Processing DLQ message', {
            messageId: record.messageId,
            failedMessage,
        });
        
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: 'Lambda execution failed - DLQ message',
            Message: JSON.stringify({
                messageId: record.messageId,
                failedMessage,
                timestamp: new Date().toISOString(),
            }, null, 2),
        }));
    }
};
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
const context = {
    disclosure_id: disclosure.disclosure_id,
    company_code: disclosure.company_code,
    execution_id: crypto.randomUUID(),
};

try {
    logger.info('Processing disclosure', context);
    await processDisclosure(disclosure);
    logger.info('Successfully processed disclosure', context);
} catch (error) {
    logger.error('Failed to process disclosure', {
        ...context,
        error: error.message,
        stack: error.stack,
    });
    throw error;
}
```

### 3. Graceful Degradation

```typescript
async function collectDisclosures(date: string): Promise<CollectionResult> {
    const disclosures = await scrapeDisclosureList(date);
    const results = { collected: 0, failed: 0, errors: [] as string[] };
    
    for (const disclosure of disclosures) {
        try {
            await processDisclosure(disclosure);
            results.collected++;
        } catch (error) {
            results.failed++;
            results.errors.push(`${disclosure.disclosure_id}: ${error.message}`);
            logger.error('Failed to process disclosure', {
                disclosure_id: disclosure.disclosure_id,
                error,
            });
        }
    }
    
    return results;
}
```

### 4. タイムアウト設定

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

// 使用例
const pdf = await withTimeout(
    downloadPDF(url),
    30000,
    'PDF download timed out after 30 seconds'
);
```

---

## 実装済みユーティリティ

| ユーティリティ | ファイル配置 | 用途 |
|--------------|------------|------|
| `retryWithBackoff` | `src/utils/retry.ts` | 指数バックオフによる再試行 |
| `isRetryableError` | `src/utils/error-classifier.ts` | エラー分類 |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` | サーキットブレーカー |
| `withTimeout` | `src/utils/timeout.ts` | タイムアウト設定 |
| `toErrorResponse` | `src/utils/error-response.ts` | Lambda用エラーレスポンス変換 |

---

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラー分類とカスタムエラークラス
- `../api/error-codes.md` - エラーコード標準
- `lambda-implementation.md` - Lambda関数特有のエラーハンドリング
- `../infrastructure/monitoring-alerts.md` - エラーアラートの設定

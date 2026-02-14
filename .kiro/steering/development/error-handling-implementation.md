---
inclusion: fileMatch
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/api/**/*.ts|**/lambda/**/*.ts|**/models/**/*.ts|**/types/**/*.ts'
---

# Error Handling Implementation

エラーハンドリングの詳細実装パターン。

## 役割分担

| ファイル | 役割 |
|---------|------|
| `core/error-handling-patterns.md` | エラー分類、再試行戦略の概要 |
| `api/error-codes.md` | HTTPステータスコード、エラーコード |
| このファイル | 実装パターン、AWS SDK設定 |

## 再試行実装

**ファイル:** `src/utils/retry.ts`

```typescript
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, backoffMultiplier = 2, jitter = true } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (!(error instanceof RetryableError) || attempt === maxRetries) throw error;
            
            let delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), 60000);
            if (jitter) delay *= (0.5 + Math.random() * 0.5);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

**エラー分類:** `src/utils/error-classifier.ts`

```typescript
function isRetryableError(error: any): boolean {
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' ||
           error.response?.status === 429 || error.response?.status >= 500 ||
           error.name === 'ThrottlingException';
}
```

## AWS SDK設定

| クライアント | maxAttempts | retryMode |
|------------|-------------|-----------|
| DynamoDB | 3 | adaptive |
| S3 | 3 | adaptive |

**ファイル:** `src/config/aws-clients.ts`

```typescript
const dynamoClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});
```

## サーキットブレーカー

**ファイル:** `src/utils/circuit-breaker.ts`

```typescript
class CircuitBreaker {
    private failureCount = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime! > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.failureCount = 0;
            this.state = 'CLOSED';
            return result;
        } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.threshold) this.state = 'OPEN';
            throw error;
        }
    }
}
```

## エラーログ構造

**ファイル:** `src/utils/logger.ts`

```typescript
logger.error('Failed to download PDF', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: {
        disclosure_id: 'TD20240115001',
        retry_count: 2,
        execution_id: context.requestId,
    },
    stack_trace: error.stack,
});
```

## Lambda実装

**基本ハンドラー:** `lambda/*/index.ts`

```typescript
export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
    try {
        const result = await processEvent(event);
        return { statusCode: 200, body: JSON.stringify({ status: 'success', data: result }) };
    } catch (error) {
        logger.error('Lambda execution failed', { requestId: context.requestId, error });
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

**エラーレスポンス:** `src/utils/error-response.ts`

```typescript
const ERROR_CODE_MAP = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
};

function toErrorResponse(error: Error, requestId: string) {
    const mapping = ERROR_CODE_MAP[error.name] || { statusCode: 500, code: 'INTERNAL_ERROR' };
    return {
        statusCode: mapping.statusCode,
        body: JSON.stringify({ status: 'error', error: { code: mapping.code, message: error.message }, request_id: requestId }),
    };
}
```

## DLQ設定

**CDK:** `cdk/lib/tdnet-stack.ts`

```typescript
const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    retentionPeriod: cdk.Duration.days(14),
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    deadLetterQueue: dlq,
    retryAttempts: 2,
});
```

**DLQプロセッサー:** `lambda/dlq-processor/index.ts`

```typescript
export const handler = async (event: SQSEvent) => {
    for (const record of event.Records) {
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: 'Lambda execution failed',
            Message: JSON.stringify({ messageId: record.messageId, failedMessage: JSON.parse(record.body) }),
        }));
    }
};
```

## ベストプラクティス

```typescript
// ✅ エラー伝播
try {
    await downloadPDF(url);
} catch (error) {
    logger.error('Failed to download PDF', { url, error });
    throw new DownloadError('PDF download failed', { cause: error });
}

// ✅ Graceful Degradation
async function collectDisclosures(date: string) {
    const results = { collected: 0, failed: 0 };
    for (const disclosure of disclosures) {
        try {
            await processDisclosure(disclosure);
            results.collected++;
        } catch (error) {
            results.failed++;
            logger.error('Failed', { disclosure_id: disclosure.disclosure_id, error });
        }
    }
    return results;
}

// ✅ タイムアウト
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
    return Promise.race([promise, new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs))]);
}
```

## 実装済みユーティリティ

| ユーティリティ | ファイル | 用途 |
|--------------|---------|------|
| `retryWithBackoff` | `src/utils/retry.ts` | 再試行 |
| `isRetryableError` | `src/utils/error-classifier.ts` | エラー分類 |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` | サーキットブレーカー |
| `withTimeout` | `src/utils/timeout.ts` | タイムアウト |
| `toErrorResponse` | `src/utils/error-response.ts` | エラーレスポンス変換 |

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラー分類
- `../api/error-codes.md` - エラーコード標準
- `../infrastructure/monitoring-alerts.md` - エラーアラート

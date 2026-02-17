---
inclusion: fileMatch
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/errors/**/*.ts'
---

# Error Handling Implementation

## 再試行実装

`src/utils/retry.ts`:
```typescript
async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, backoffMultiplier = 2, jitter = true } = options;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { return await fn(); }
        catch (error) {
            if (!(error instanceof RetryableError) || attempt === maxRetries) throw error;
            let delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), 60000);
            if (jitter) delay *= (0.5 + Math.random() * 0.5);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

`src/utils/error-classifier.ts`:
```typescript
function isRetryableError(error: any): boolean {
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' ||
           error.response?.status === 429 || error.response?.status >= 500 ||
           error.name === 'ThrottlingException';
}
```

## AWS SDK設定

`src/config/aws-clients.ts`:
```typescript
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1', maxAttempts: 3, retryMode: 'adaptive' });
const s3Client = new S3Client({ region: 'ap-northeast-1', maxAttempts: 3, retryMode: 'adaptive' });
```

## Lambda実装

`lambda/*/index.ts`:
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

## DLQ設定

CDK:
```typescript
const dlq = new sqs.Queue(this, 'CollectorDLQ', { retentionPeriod: cdk.Duration.days(14) });
const collectorFn = new lambda.Function(this, 'CollectorFunction', { deadLetterQueue: dlq, retryAttempts: 2 });
```

## ベストプラクティス

```typescript
// エラー伝播
try { await downloadPDF(url); }
catch (error) {
    logger.error('Failed', { url, error });
    throw new DownloadError('PDF download failed', { cause: error });
}

// Graceful Degradation
async function collectDisclosures(date: string) {
    const results = { collected: 0, failed: 0 };
    for (const disclosure of disclosures) {
        try { await processDisclosure(disclosure); results.collected++; }
        catch (error) { results.failed++; logger.error('Failed', { disclosure_id: disclosure.disclosure_id, error }); }
    }
    return results;
}
```

## 実装済みユーティリティ

| ユーティリティ | ファイル |
|--------------|---------|
| `retryWithBackoff` | `src/utils/retry.ts` |
| `isRetryableError` | `src/utils/error-classifier.ts` |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` |
| `withTimeout` | `src/utils/timeout.ts` |
| `toErrorResponse` | `src/utils/error-response.ts` |

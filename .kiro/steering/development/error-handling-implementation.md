---
inclusion: fileMatch
fileMatchPattern: '**/utils/error*.ts|**/utils/retry*.ts|**/utils/logger*.ts|**/errors/**/*.ts'
---

# Error Handling Implementation

## 再試行実装

```typescript
// src/utils/retry.ts
async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, backoffMultiplier = 2 } = options;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { return await fn(); }
        catch (error) {
            if (!isRetryableError(error) || attempt === maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(backoffMultiplier, attempt)));
        }
    }
}

// src/utils/error-classifier.ts
function isRetryableError(error: any): boolean {
    return error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' ||
           error.response?.status === 429 || error.response?.status >= 500;
}
```

## AWS SDK設定

```typescript
const dynamoClient = new DynamoDBClient({ maxAttempts: 3, retryMode: 'adaptive' });
const s3Client = new S3Client({ maxAttempts: 3, retryMode: 'adaptive' });
```

## Lambda実装

```typescript
export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
    try {
        const result = await processEvent(event);
        return { statusCode: 200, body: JSON.stringify({ status: 'success', data: result }) };
    } catch (error) {
        logger.error('Failed', { requestId: context.requestId, error });
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

## 実装済みユーティリティ

| ユーティリティ | ファイル |
|--------------|---------|
| `retryWithBackoff` | `src/utils/retry.ts` |
| `isRetryableError` | `src/utils/error-classifier.ts` |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` |
| `withTimeout` | `src/utils/timeout.ts` |
| `toErrorResponse` | `src/utils/error-response.ts` |

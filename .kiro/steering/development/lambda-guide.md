---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts'
---

# Lambda実装ガイド

Lambda関数とその内部実装（ユーティリティ、ヘルパー、ライブラリ）の実装ガイドライン。

## Lambda関数実装

### メモリとタイムアウト

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Parser（PDF解析） | 1024MB | 5分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 15分 |
| Step Functions統合 | 256-512MB | 5-15分 |

### 環境変数検証

```typescript
// handler.ts
const requiredEnvVars = ['TABLE_NAME', 'BUCKET_NAME', 'REGION'];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`環境変数 ${envVar} が設定されていません`);
    }
}
```

**詳細**: `error-handling-implementation.md`, `../infrastructure/environment-variables.md`

### エラーハンドリング

```typescript
import { logger } from '../utils/logger';
import { toErrorResponse } from '../utils/error-response';

export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
    try {
        const result = await processEvent(event);
        return { 
            statusCode: 200, 
            body: JSON.stringify({ status: 'success', data: result }) 
        };
    } catch (error) {
        logger.error('Failed', { 
            requestId: context.requestId, 
            error_type: error.name,
            error_message: error.message,
            stack_trace: error.stack
        });
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

**詳細**: `../core/error-handling-patterns.md`, `error-handling-implementation.md`, `../api/error-codes.md`

### パフォーマンス最適化

グローバルスコープで初期化（コールドスタート対策）

```typescript
// グローバルスコープ（コールドスタート時のみ実行）
const dynamoClient = new DynamoDBClient({ 
    region: process.env.AWS_REGION,
    maxAttempts: 3,
    retryMode: 'adaptive'
});

const s3Client = new S3Client({ 
    region: process.env.AWS_REGION,
    maxAttempts: 3,
    retryMode: 'adaptive'
});

// ハンドラー（リクエストごとに実行）
export const handler = async (event: any) => {
    // dynamoClient, s3Clientを使用
};
```

**詳細**: `../infrastructure/performance-optimization.md`

---

## ユーティリティ・ヘルパー実装

### ユーティリティ関数（utils/）

汎用的な処理を提供する関数

```typescript
// utils/date-formatter.ts
export function formatJSTDate(date: Date): string {
    return new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(date);
}

// utils/retry.ts
export async function retryWithBackoff<T>(
    fn: () => Promise<T>, 
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, backoffMultiplier = 2 } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { 
            return await fn(); 
        } catch (error) {
            if (!isRetryableError(error) || attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => 
                setTimeout(resolve, initialDelay * Math.pow(backoffMultiplier, attempt))
            );
        }
    }
}
```

### ヘルパー関数（helpers/）

特定のドメインロジックを提供する関数

```typescript
// helpers/validation.ts
export function validateDisclosureId(id: string): boolean {
    return /^TD\d{8}\d{3}$/.test(id);
}

// helpers/disclosure-id-generator.ts
export function generateDisclosureId(date: Date, sequence: number): string {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const seqStr = sequence.toString().padStart(3, '0');
    return `TD${dateStr}${seqStr}`;
}
```

### 共通ライブラリ（lib/）

複数の関数で共有されるライブラリ

```typescript
// lib/http-client.ts
import axios from 'axios';
import { retryWithBackoff } from '../utils/retry';

export async function fetchWithRetry(url: string) {
    return retryWithBackoff(async () => {
        const response = await axios.get(url);
        return response.data;
    });
}

// lib/dynamodb-client.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ 
    region: process.env.AWS_REGION,
    maxAttempts: 3,
    retryMode: 'adaptive'
});

export const docClient = DynamoDBDocumentClient.from(client);
```

---

## エラーハンドリング

### 再試行実装

```typescript
// utils/retry.ts
async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxRetries = 3, initialDelay = 1000, backoffMultiplier = 2 } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try { 
            return await fn(); 
        } catch (error) {
            if (!isRetryableError(error) || attempt === maxRetries) {
                throw error;
            }
            await new Promise(resolve => 
                setTimeout(resolve, initialDelay * Math.pow(backoffMultiplier, attempt))
            );
        }
    }
}

// utils/error-classifier.ts
function isRetryableError(error: any): boolean {
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           error.response?.status === 429 || 
           error.response?.status >= 500;
}
```

### AWS SDK設定

```typescript
const dynamoClient = new DynamoDBClient({ 
    maxAttempts: 3, 
    retryMode: 'adaptive' 
});

const s3Client = new S3Client({ 
    maxAttempts: 3, 
    retryMode: 'adaptive' 
});
```

### 実装済みユーティリティ

| ユーティリティ | ファイル | 用途 |
|--------------|---------|------|
| `retryWithBackoff` | `src/utils/retry.ts` | 指数バックオフ再試行 |
| `isRetryableError` | `src/utils/error-classifier.ts` | エラー分類 |
| `CircuitBreaker` | `src/utils/circuit-breaker.ts` | サーキットブレーカー |
| `withTimeout` | `src/utils/timeout.ts` | タイムアウト処理 |
| `toErrorResponse` | `src/utils/error-response.ts` | エラーレスポンス生成 |

---

## テスト戦略

### ユニットテスト

```typescript
// __tests__/handler.test.ts
describe('Lambda Handler', () => {
    it('should process event successfully', async () => {
        const event = { /* test event */ };
        const result = await handler(event, mockContext);
        expect(result.statusCode).toBe(200);
    });

    it('should handle errors gracefully', async () => {
        const invalidEvent = { /* invalid event */ };
        const result = await handler(invalidEvent, mockContext);
        expect(result.statusCode).toBe(400);
    });
});
```

### ユーティリティテスト

```typescript
// __tests__/utils/retry.test.ts
describe('retryWithBackoff', () => {
    it('should retry on retryable errors', async () => {
        const mockFn = jest.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValueOnce('success');
        
        const result = await retryWithBackoff(mockFn);
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
        const mockFn = jest.fn()
            .mockRejectedValue(new Error('ValidationError'));
        
        await expect(retryWithBackoff(mockFn)).rejects.toThrow('ValidationError');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});
```

**詳細**: `testing-strategy.md`

---

## 実装チェックリスト

### Lambda関数作成時

- [ ] 必須環境変数検証
- [ ] エラーハンドリング実装
- [ ] メモリ・タイムアウト設定
- [ ] コールドスタート対策（グローバルスコープ初期化）
- [ ] 構造化ログ実装
- [ ] ユニットテスト実装

### ユーティリティ作成時

- [ ] 単一責任の原則（1つの関数は1つの責務）
- [ ] エラーハンドリング実装
- [ ] ユニットテスト実装
- [ ] 型定義（TypeScript）
- [ ] JSDocコメント

### ヘルパー作成時

- [ ] ドメインロジックの明確化
- [ ] バリデーション実装
- [ ] ユニットテスト実装
- [ ] 型定義（TypeScript）

---

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - エラーハンドリング詳細実装
- `../infrastructure/environment-variables.md` - 環境変数管理
- `../infrastructure/performance-optimization.md` - パフォーマンス最適化
- `testing-strategy.md` - テスト戦略
- `step-functions-guide.md` - Step Functions統合Lambda

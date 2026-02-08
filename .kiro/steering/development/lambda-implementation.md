---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts'
---

# Lambda実装ガイド

**適用範囲:** `**/lambda/**/*.ts` - Lambda関数フォルダ内のすべてのTypeScriptファイル

## メモリとタイムアウトの設定

| 関数タイプ | メモリ | タイムアウト | 理由 |
|-----------|--------|------------|------|
| Collector（スクレイピング） | 512MB | 15分 | ネットワークI/O待機が多い |
| Parser（PDF解析） | 1024MB | 5分 | CPU集約的 |
| Query（API） | 256MB | 30秒 | 軽量なデータ取得 |
| Export（大量データ） | 1024MB | 15分 | メモリ集約的 |

## 環境変数の検証

### 必須環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| S3_BUCKET_NAME | PDFファイル保存先S3バケット名 | `tdnet-pdfs-prod` |
| DYNAMODB_TABLE_NAME | 開示情報メタデータテーブル名 | `tdnet-disclosures` |
| ALERT_TOPIC_ARN | エラーアラート送信先SNSトピックARN | `arn:aws:sns:...` |
| LOG_LEVEL | ログレベル | `info` / `debug` / `warn` / `error` |

### 検証パターン

```typescript
// config.ts
interface Config {
    s3BucketName: string;
    dynamoTableName: string;
    alertTopicArn: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function loadConfig(): Config {
    const required = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME', 'ALERT_TOPIC_ARN'];
    
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
    }
    
    return {
        s3BucketName: process.env.S3_BUCKET_NAME!,
        dynamoTableName: process.env.DYNAMODB_TABLE_NAME!,
        alertTopicArn: process.env.ALERT_TOPIC_ARN!,
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
    };
}

export const config = loadConfig();
```

## エラーハンドリング

### 基本パターン

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { toErrorResponse } from '../../utils/error-response';
import { logger } from '../../utils/logger';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        logger.info('Lambda invoked', { requestId: context.requestId });
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'success', data: result }),
        };
    } catch (error) {
        logger.error('Lambda execution failed', {
            requestId: context.requestId,
            error: error.message,
            stack: error.stack,
        });
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

### エラーレスポンス変換

```typescript
// src/utils/error-response.ts
import { APIGatewayProxyResult } from 'aws-lambda';

const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
    'InternalError': { statusCode: 500, code: 'INTERNAL_ERROR' },
};

export function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || { statusCode: 500, code: 'INTERNAL_ERROR' };
    
    return {
        statusCode: mapping.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: 'error',
            error: { code: mapping.code, message: error.message },
            request_id: requestId,
        }),
    };
}
```

**詳細な実装は以下を参照:**
- **再試行戦略**: `error-handling-implementation.md` - `retryWithBackoff`の完全実装
- **AWS SDK設定**: `error-handling-implementation.md` - DynamoDB/S3クライアントの再試行設定
- **DLQ設定**: `error-handling-implementation.md` - DLQプロセッサーの実装
- **エラーコード**: `../api/error-codes.md` - エラーコードマップの完全な定義
- **カスタムエラークラス**: `../core/error-handling-patterns.md` - エラー分類と定義

## パフォーマンス最適化

### コールドスタート対策

```typescript
// グローバルスコープで初期化（再利用される）
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'ap-northeast-1' });

const config = {
    tableName: process.env.DYNAMODB_TABLE_NAME!,
    bucketName: process.env.S3_BUCKET_NAME!,
};

export const handler = async (event: any): Promise<any> => {
    // 初期化済みのクライアントを使用
    const result = await docClient.send(new GetCommand({
        TableName: config.tableName,
        Key: { disclosure_id: event.id },
    }));
    return result.Item;
};
```

### Lambda内メモリキャッシュ

```typescript
// グローバルスコープでキャッシュ（Lambda実行間で共有）
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (!cached || Date.now() > cached.expires) {
        cache.delete(key);
        return null;
    }
    return cached.data as T;
}

function setCache<T>(key: string, data: T, ttlSeconds: number = 300): void {
    cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}
```

**詳細な最適化は以下を参照:**
- **バンドルサイズ最適化**: `../infrastructure/performance-optimization.md`
- **DynamoDB最適化**: `../infrastructure/performance-optimization.md`
- **並行処理制御**: `../infrastructure/performance-optimization.md`

## ベストプラクティス

### 1. エラーの適切な伝播

```typescript
// ❌ 悪い例: エラーを握りつぶす
try {
    await downloadPDF(url);
} catch (error) {
    console.log('Error occurred'); // エラーが失われる
}

// ✅ 良い例: エラーを適切に伝播
try {
    await downloadPDF(url);
} catch (error) {
    logger.error('Failed to download PDF', { url, error });
    throw new DownloadError('PDF download failed', { cause: error });
}
```

### 2. タイムアウトの設定

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
const pdf = await withTimeout(downloadPDF(url), 30000, 'PDF download timed out');
```

### 3. 並行処理の制御

```typescript
import pLimit from 'p-limit';

async function processDisclosuresWithLimit(
    disclosures: Disclosure[],
    concurrency: number = 5
): Promise<void> {
    const limit = pLimit(concurrency);
    const promises = disclosures.map(d => limit(() => processDisclosure(d)));
    await Promise.allSettled(promises);
}
```

## 実装チェックリスト

- [ ] 必須環境変数は検証されているか
- [ ] エラーハンドリングは適切に実装されているか
- [ ] メモリとタイムアウトは適切に設定されているか
- [ ] コールドスタート対策は実施されているか
- [ ] ログは構造化されているか

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - エラーハンドリング詳細実装
- `../infrastructure/environment-variables.md` - 環境変数の詳細定義
- `../infrastructure/performance-optimization.md` - パフォーマンス最適化
- `../infrastructure/monitoring-alerts.md` - 監視とアラート
- `testing-strategy.md` - テスト戦略
- `tdnet-file-naming.md` - ファイル命名規則

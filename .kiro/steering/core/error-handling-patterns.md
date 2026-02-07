# Error Handling Patterns

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの基本原則をまとめたものです。

**詳細な実装については以下を参照:**
- 再試行戦略・ログ構造: `../development/error-handling-implementation.md`
- APIエラーコード: `../api/error-codes.md`

## エラー分類

### Retryable Errors（再試行可能なエラー）

一時的な問題である可能性が高いため、再試行すべきエラー：

- **ネットワークエラー**: ECONNRESET, ETIMEDOUT, ENOTFOUND
- **HTTPタイムアウト**: リクエストタイムアウト、レスポンスタイムアウト
- **5xxエラー**: 500 Internal Server Error, 503 Service Unavailable
- **AWS一時的エラー**: ThrottlingException, ServiceUnavailable
- **レート制限**: 429 Too Many Requests

### Non-Retryable Errors（再試行不可能なエラー）

再試行しても解決しないため、即座に失敗として扱うべきエラー：

- **認証エラー**: 401 Unauthorized, 403 Forbidden
- **リソース不存在**: 404 Not Found
- **バリデーションエラー**: 400 Bad Request
- **設定エラー**: 環境変数未設定、不正な設定値
- **データ整合性エラー**: 重複キー、外部キー制約違反

### Partial Failure（部分的失敗）

一部の処理が成功し、一部が失敗した場合の対応：

- 成功した処理はコミット
- 失敗した処理はログに記録
- 全体としては警告レベルで完了
- 失敗した項目のリストを返却

## 再試行戦略の基本

### 指数バックオフ（Exponential Backoff）

再試行時は指数バックオフを使用：

```typescript
// 基本パターン
await retryWithBackoff(
    async () => await operation(),
    {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        jitter: true,
    }
);
```

**詳細な実装は `../development/error-handling-implementation.md` を参照。**

## エラーログ構造

### 標準ログフォーマット

```typescript
logger.error('Operation failed', {
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

## エラーハンドリングのベストプラクティス

### 1. エラーの適切な伝播

```typescript
// ✅ 良い例: エラーを適切に伝播
try {
    await operation();
} catch (error) {
    logger.error('Operation failed', { error });
    throw new CustomError('Operation failed', { cause: error });
}
```

### 2. カスタムエラークラスの使用

プロジェクト全体で統一されたエラークラスを使用：

- `RetryableError` - 再試行可能なエラー
- `ValidationError` - バリデーションエラー
- `NotFoundError` - リソース不存在
- その他のエラークラスは `../api/error-codes.md` を参照

### 3. Graceful Degradation（段階的機能低下）

```typescript
// 個別の失敗は記録するが、処理は継続
for (const item of items) {
    try {
        await processItem(item);
        results.success++;
    } catch (error) {
        results.failed++;
        logger.error('Item processing failed', { item, error });
    }
}
```

## エラーハンドリングの実装チェックリスト

### Lambda関数での必須実装

すべてのLambda関数は、以下の項目を実装する必要があります：

- [ ] **try-catchブロック**: すべての非同期処理をtry-catchで囲む
- [ ] **再試行ロジック**: Retryable Errorsに対して`retryWithBackoff`を使用
- [ ] **構造化ログ**: `error_type`, `error_message`, `context`, `stack_trace`を含む
- [ ] **カスタムエラークラス**: プロジェクト標準のエラークラスを使用
- [ ] **エラーメトリクス**: CloudWatchにカスタムメトリクスを送信
- [ ] **部分的失敗の処理**: バッチ処理では個別の失敗を記録して継続

**実装例:**
```typescript
import { retryWithBackoff } from './utils/retry';
import { logger } from './utils/logger';
import { RetryableError } from './errors';

export async function handler(event: any, context: any) {
    try {
        // メイン処理
        const results = await retryWithBackoff(
            async () => await fetchData(),
            {
                maxRetries: 3,
                initialDelay: 2000,
                backoffMultiplier: 2,
                jitter: true,
            }
        );
        
        return { statusCode: 200, body: JSON.stringify(results) };
    } catch (error) {
        logger.error('Lambda execution failed', {
            error_type: error.constructor.name,
            error_message: error.message,
            context: {
                request_id: context.requestId,
                function_name: context.functionName,
            },
            stack_trace: error.stack,
        });
        
        // CloudWatchメトリクス送信
        await sendMetric('LambdaError', 1, { ErrorType: error.constructor.name });
        
        throw error;
    }
}
```

### API Gatewayでの必須実装

すべてのAPIエンドポイントは、以下の項目を実装する必要があります：

- [ ] **適切なHTTPステータスコード**: エラー種別に応じた正しいステータスコード
- [ ] **標準エラーレスポンス**: プロジェクト標準のエラーレスポンス形式
- [ ] **センシティブ情報の除外**: スタックトレース、内部パスを含めない
- [ ] **エラーコードの使用**: `../api/error-codes.md`で定義されたエラーコード
- [ ] **CORS対応**: エラーレスポンスにもCORSヘッダーを含める

**実装例:**
```typescript
import { APIGatewayProxyResult } from 'aws-lambda';
import { ValidationError, NotFoundError } from './errors';

function handleError(error: Error): APIGatewayProxyResult {
    if (error instanceof ValidationError) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error_code: 'VALIDATION_ERROR',
                message: error.message,
                details: error.details,
            }),
        };
    }
    
    if (error instanceof NotFoundError) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error_code: 'NOT_FOUND',
                message: error.message,
            }),
        };
    }
    
    // デフォルト: 500 Internal Server Error
    logger.error('Unhandled error', { error });
    return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            error_code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        }),
    };
}
```

### DynamoDB操作での必須実装

DynamoDBとのやり取りでは、以下の項目を実装する必要があります：

- [ ] **条件付き書き込み**: 重複防止のため`ConditionExpression`を使用
- [ ] **トランザクション**: 複数項目の整合性が必要な場合は`TransactWriteItems`を使用
- [ ] **エラー分類**: `ConditionalCheckFailedException`などを適切に処理
- [ ] **再試行ロジック**: `ProvisionedThroughputExceededException`に対して再試行

**実装例:**
```typescript
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { retryWithBackoff } from './utils/retry';

async function saveToDynamoDB(item: any) {
    const client = new DynamoDBClient({});
    
    try {
        await retryWithBackoff(
            async () => {
                await client.send(new PutItemCommand({
                    TableName: 'Disclosures',
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(disclosure_id)',
                }));
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                shouldRetry: (error) => {
                    return error.name === 'ProvisionedThroughputExceededException';
                },
            }
        );
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            logger.warn('Duplicate item detected', { item });
            return; // 重複は無視
        }
        throw error;
    }
}
```

## エラーコード標準

エラーコードの詳細な定義と使用ガイドラインは、以下のドキュメントを参照してください：

- **エラーコード一覧**: `../api/error-codes.md` - すべてのエラーコードの定義と使用例

## 関連ドキュメント

- **詳細実装**: `../development/error-handling-implementation.md` - 再試行戦略、ログ構造、Lambda実装
- **エラーコード標準**: `../api/error-codes.md` - APIエラーコードの詳細定義
- **API設計**: `../api/api-design-guidelines.md` - APIエラーレスポンス形式
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - エラーアラート設定

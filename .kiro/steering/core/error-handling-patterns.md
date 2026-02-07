# Error Handling Patterns

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの基本原則をまとめたものです。

**詳細な実装については以下を参照:**
- 再試行戦略・ログ構造: `error-handling-implementation.md`
- APIエラーコード: `error-codes.md`

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

**詳細な実装は `error-handling-implementation.md` を参照。**

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
- その他のエラークラスは `error-codes.md` を参照

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

## 関連ドキュメント

- **詳細実装**: `error-handling-implementation.md` - 再試行戦略、ログ構造、Lambda実装
- **APIエラーコード**: `error-codes.md` - エラーコード標準化と実装例
- **API設計**: `api-design-guidelines.md` - APIエラーレスポンス形式
- **監視とアラート**: `monitoring-alerts.md` - エラーアラート設定

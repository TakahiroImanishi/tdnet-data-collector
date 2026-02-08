---
inclusion: always
description: "エラーハンドリングの基本原則とエラー分類"
---

# Error Handling Patterns

エラーハンドリングの基本原則。詳細実装: `../development/error-handling-implementation.md`, APIエラーコード: `../api/error-codes.md`

## エラー分類

| 分類 | 対応 | 例 |
|------|------|-----|
| **Retryable** | 再試行 | ネットワークエラー(ECONNRESET, ETIMEDOUT), 5xxエラー, AWS ThrottlingException, 429 Too Many Requests |
| **Non-Retryable** | 即座に失敗 | 401/403認証エラー, 404 Not Found, 400バリデーションエラー, 設定エラー, データ整合性エラー |
| **Partial Failure** | 成功分コミット、失敗分記録 | バッチ処理で一部失敗 |

## 再試行戦略

指数バックオフを使用:

```typescript
await retryWithBackoff(async () => await operation(), {
    maxRetries: 3, initialDelay: 2000, backoffMultiplier: 2, jitter: true
});
```

## ログ構造

```typescript
logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001', retry_count: 2 },
    stack_trace: error.stack
});
```

## ベストプラクティス

1. **エラー伝播**: カスタムエラークラス使用（RetryableError, ValidationError, NotFoundError等）
2. **Graceful Degradation**: バッチ処理で個別失敗を記録して継続
3. **構造化ログ**: error_type, error_message, context, stack_traceを含む

## 実装チェックリスト

- [ ] エラー分類（Retryable/Non-Retryable/Partial Failure）
- [ ] 指数バックオフ再試行（`retryWithBackoff`）
- [ ] 構造化ログ
- [ ] カスタムエラークラス
- [ ] CloudWatchメトリクス（Lambda）
- [ ] 部分的失敗処理（バッチ）

詳細: `../development/error-handling-implementation.md`, `../api/error-codes.md`, `../api/api-design-guidelines.md`, `../infrastructure/monitoring-alerts.md`

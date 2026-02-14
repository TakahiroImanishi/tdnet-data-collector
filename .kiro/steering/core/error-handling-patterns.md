# エラーハンドリングパターン

## エラー分類

| 分類 | 対応 | 例 |
|------|------|-----|
| **Retryable** | 再試行 | ECONNRESET, ETIMEDOUT, 5xx, ThrottlingException, 429 |
| **Non-Retryable** | 即座に失敗 | 401/403, 404, 400, 設定エラー, データ整合性エラー |
| **Partial Failure** | 成功分コミット、失敗分記録 | バッチ処理で一部失敗 |

## 再試行戦略

```typescript
import { retryWithBackoff } from '../utils/retry';

await retryWithBackoff(async () => await operation(), {
    maxRetries: 3, initialDelay: 2000, backoffMultiplier: 2, jitter: true
});
```

## ログ構造

```typescript
import { logger } from '../utils/logger';

logger.error('Operation failed', {
    error_type: 'NetworkError',
    error_message: error.message,
    context: { disclosure_id: 'TD20240115001', retry_count: 2 },
    stack_trace: error.stack
});
```

## 必須実装

- [ ] エラー分類（Retryable/Non-Retryable/Partial Failure）
- [ ] 指数バックオフ再試行（`retryWithBackoff`）
- [ ] 構造化ログ（error_type, error_message, context, stack_trace）
- [ ] カスタムエラークラス（`src/errors/index.ts`）
- [ ] CloudWatchメトリクス（Lambda）
- [ ] 部分的失敗処理（バッチ）
- [ ] DLQ設定（非同期Lambda/SQSのみ。API Gateway統合Lambdaは不要）
- [ ] CloudWatch Alarms（エラー率、DLQメッセージ数）

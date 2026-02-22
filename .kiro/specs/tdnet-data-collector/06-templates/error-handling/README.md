# エラーハンドリング実装テンプレート

このフォルダには、エラーハンドリングの実装例が含まれています。

## ファイル一覧

### retry-with-backoff.ts
指数バックオフを使用した再試行ロジックの実装例。

**主要な機能:**
- 指数バックオフ（Exponential Backoff）
- ジッター（ランダム性）の追加
- 再試行可能エラーの自動判定
- カスタマイズ可能な再試行設定

**使用例:**
```typescript
import { retryWithBackoff, RetryableError } from './retry-with-backoff';

const result = await retryWithBackoff(
    async () => {
        const response = await axios.get(url);
        return response.data;
    },
    {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        jitter: true,
    }
);
```

### circuit-breaker.ts
サーキットブレーカーパターンの実装例。

**主要な機能:**
- 連続失敗の検知
- 一定期間のリクエスト停止
- 自動復旧（HALF_OPEN状態）
- 状態管理（CLOSED/OPEN/HALF_OPEN）

**使用例:**
```typescript
import { CircuitBreaker } from './circuit-breaker';

const breaker = new CircuitBreaker(5, 60000);

const result = await breaker.execute(async () => {
    return await externalApiCall();
});
```

## 関連ドキュメント

- **エラーハンドリング基本**: `.kiro/steering/core/error-handling-patterns.md`
- **詳細実装**: `.kiro/steering/development/error-handling-implementation.md`
- **エラーコード標準**: `.kiro/steering/api/error-codes.md`

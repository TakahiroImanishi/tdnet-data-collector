# ユーティリティ関数

このディレクトリには、TDnet Data Collectorプロジェクト全体で使用される共通ユーティリティ関数が含まれています。

## 概要

| ファイル | 説明 | 主な関数 |
|---------|------|---------|
| `logger.ts` | 構造化ロガー | `logger.info()`, `logger.error()`, `logger.warn()` |
| `retry.ts` | 指数バックオフ再試行ロジック | `retryWithBackoff()` |
| `cloudwatch-metrics.ts` | CloudWatchメトリクス送信 | `sendMetric()`, `sendMetrics()` |
| `disclosure-id.ts` | 開示ID生成 | `generateDisclosureId()` |
| `date-partition.ts` | date_partition生成（YYYY-MM形式、JST基準） | `generateDatePartition()` |
| `rate-limiter.ts` | レート制限（1リクエスト/秒） | `RateLimiter` クラス |
| `batch-write.ts` | DynamoDBバッチ書き込み | `batchWriteItems()` |
| `metrics.ts` | メトリクス定義 | メトリクス名定数 |

## 使用例

### ロガー

```typescript
import { logger } from '../utils/logger';

// 情報ログ
logger.info('Data collection started', { date: '2024-01-15' });

// エラーログ（構造化）
logger.error('Failed to fetch data', {
  error_type: 'NetworkError',
  error_message: error.message,
  context: { disclosure_id: 'TD20240115001' },
  stack_trace: error.stack
});
```

### 再試行ロジック

```typescript
import { retryWithBackoff } from '../utils/retry';

const result = await retryWithBackoff(
  async () => await fetchData(),
  {
    maxRetries: 3,
    initialDelay: 2000,
    backoffMultiplier: 2,
    jitter: true
  }
);
```

### CloudWatchメトリクス

```typescript
import { sendMetric } from '../utils/cloudwatch-metrics';

await sendMetric('CollectionSuccess', 1, 'Count');
await sendMetric('CollectionDuration', 1234, 'Milliseconds');
```

### 開示ID生成

```typescript
import { generateDisclosureId } from '../utils/disclosure-id';

const disclosureId = generateDisclosureId({
  date: '2024-01-15',
  time: '12:34:56',
  companyCode: '7203'
});
// 結果: TD202401151234001
```

### date_partition生成

```typescript
import { generateDatePartition } from '../utils/date-partition';

const partition = generateDatePartition('2024-01-15T12:34:56+09:00');
// 結果: 2024-01
```

### レート制限

```typescript
import { RateLimiter } from '../utils/rate-limiter';

const limiter = new RateLimiter(1000); // 1リクエスト/秒

for (const item of items) {
  await limiter.wait();
  await processItem(item);
}
```

### DynamoDBバッチ書き込み

```typescript
import { batchWriteItems } from '../utils/batch-write';

await batchWriteItems(tableName, items);
// 25件ごとに自動的にバッチ化
```

## 実装ガイドライン

ユーティリティ関数の実装・使用時は、以下のドキュメントを参照してください：

- [Lambda Utils実装ガイド](../../.kiro/steering/development/lambda-utils-implementation.md) - ユーティリティ関数の実装パターン
- [エラーハンドリング実装](../../.kiro/steering/development/error-handling-implementation.md) - エラーハンドリングの実装方法
- [テスト戦略](../../.kiro/steering/development/testing-strategy.md) - ユニットテスト、プロパティベーステスト

## テスト

すべてのユーティリティ関数には、`__tests__/` ディレクトリにユニットテストが含まれています。

```bash
# ユーティリティ関数のテストを実行
npm test -- src/utils

# カバレッジレポート生成
npm run test:coverage -- src/utils
```

## 注意事項

### エラーハンドリング

- すべてのユーティリティ関数は適切なエラーハンドリングを実装しています
- 外部API呼び出しには `retryWithBackoff` を使用してください
- エラーログは構造化形式（error_type, error_message, context, stack_trace）で記録してください

### パフォーマンス

- `batchWriteItems` は25件ごとに自動的にバッチ化します（DynamoDBの制限）
- `RateLimiter` はTDnetのレート制限（1リクエスト/秒）を遵守します
- CloudWatchメトリクスは非同期で送信され、Lambda実行時間に影響しません

### データ整合性

- `generateDisclosureId` は一意性を保証します
- `generateDatePartition` はJST（日本標準時）基準で生成します
- すべての日時はISO 8601形式で扱います

## 関連ドキュメント

- [実装ルール](../../.kiro/steering/core/tdnet-implementation-rules.md) - プロジェクト全体の実装原則
- [エラーハンドリングパターン](../../.kiro/steering/core/error-handling-patterns.md) - エラー分類と再試行戦略

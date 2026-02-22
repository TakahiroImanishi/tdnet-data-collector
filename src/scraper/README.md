# Scraper - TDnetスクレイピング実装ガイド

このディレクトリには、TDnet（適時開示情報閲覧サービス）からデータを取得するスクレイピング機能が含まれています。

## 概要

TDnet Scraperは、日本取引所グループが提供するTDnet APIから上場企業の開示情報を自動収集するための機能です。レート制限、エラーハンドリング、データ整合性を考慮した堅牢な実装が求められます。

## 実装ガイドライン

### 必須参照ドキュメント

1. **TDnetスクレイピングパターン**  
   [`../../.kiro/steering/development/tdnet-scraping-patterns.md`](../../.kiro/steering/development/tdnet-scraping-patterns.md)
   - TDnet API仕様と制約
   - レート制限実装（1リクエスト/秒）
   - ページネーション処理
   - データ変換とマッピング

2. **エラーハンドリングパターン**  
   [`../../.kiro/steering/core/error-handling-patterns.md`](../../.kiro/steering/core/error-handling-patterns.md)
   - 再試行可能エラーの分類
   - 指数バックオフ再試行戦略
   - 構造化ログ実装
   - 部分的失敗の処理

3. **テスト戦略**  
   [`../../.kiro/steering/development/testing-strategy.md`](../../.kiro/steering/development/testing-strategy.md)
   - スクレイピングロジックの単体テスト
   - モックを使用したAPI呼び出しテスト
   - E2Eテスト（LocalStack環境）

## スクレイピング実装の基本原則

### 1. レート制限遵守
- **TDnet制約**: 1リクエスト/秒
- **実装**: `RateLimiter`クラス使用
- **並列実行**: 最大5並列（Lambda同時実行制限）
- **監視**: CloudWatchメトリクスでスロットリング検出

### 2. エラーハンドリング
- **再試行可能エラー**: ECONNRESET, ETIMEDOUT, 5xx, 429
- **再試行戦略**: 指数バックオフ（初期2秒、最大3回）
- **非再試行エラー**: 401, 403, 404, 400
- **ログ記録**: error_type, error_message, context, stack_trace

### 3. データ整合性
- **disclosure_id**: 一意性保証（`generateDisclosureId`）
- **date_partition**: YYYY-MM形式、JST基準
- **バリデーション**: Zodスキーマで必須フィールド検証
- **重複排除**: DynamoDB条件付き書き込み

## 主要コンポーネント

### TDnet API Client
- HTTPリクエスト送信
- レスポンスパース
- エラーハンドリング
- レート制限適用

### Data Transformer
- APIレスポンス → DynamoDBアイテム変換
- disclosure_id生成
- date_partition生成
- タイムゾーン変換（UTC → JST）

### Rate Limiter
- トークンバケットアルゴリズム
- 1リクエスト/秒制限
- 非同期待機処理

## 実装例

### レート制限付きAPI呼び出し

```typescript
import { RateLimiter } from '../utils/rate-limiter';
import { retryWithBackoff } from '../utils/retry';

const rateLimiter = new RateLimiter(1, 1000); // 1リクエスト/秒

async function fetchDisclosures(date: string) {
  await rateLimiter.acquire();
  
  return await retryWithBackoff(
    async () => {
      const response = await fetch(`https://api.tdnet.info/v1/disclosures?date=${date}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    },
    { maxRetries: 3, initialDelay: 2000 }
  );
}
```

### エラーハンドリング

```typescript
import { logger } from '../utils/logger';

try {
  const data = await fetchDisclosures(date);
  // 処理続行
} catch (error) {
  logger.error('Failed to fetch disclosures', {
    error_type: error.name,
    error_message: error.message,
    context: { date, retry_count: 3 },
    stack_trace: error.stack,
  });
  
  // 再試行不可エラーの場合は即座に失敗
  if (error.status === 401 || error.status === 403) {
    throw error;
  }
  
  // その他のエラーは再試行済みなので記録のみ
}
```

### データ変換

```typescript
import { generateDisclosureId, generateDatePartition } from '../utils/id-generator';

function transformDisclosure(apiData: any) {
  return {
    disclosure_id: generateDisclosureId(apiData),
    company_code: apiData.company_code,
    disclosed_at: apiData.disclosed_at,
    title: apiData.title,
    date_partition: generateDatePartition(apiData.disclosed_at),
    pdf_url: apiData.pdf_url,
    xbrl_url: apiData.xbrl_url,
  };
}
```

## テスト実装

### 単体テスト
- レート制限ロジック
- データ変換ロジック
- エラーハンドリング

### モックテスト
```typescript
import { jest } from '@jest/globals';

jest.mock('node-fetch');

test('should handle API error', async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
  
  await expect(fetchDisclosures('2024-01-15')).rejects.toThrow();
});
```

### E2Eテスト
- LocalStack環境でDynamoDB/S3統合テスト
- 実際のAPI呼び出しフロー検証

## パフォーマンス最適化

### メモリ効率
- ストリーミング処理（大量データ）
- バッチサイズ最適化（25件/バッチ）
- 不要なデータのフィルタリング

### 実行時間短縮
- 並列処理（最大5並列）
- 条件付きクエリ（date_partition GSI）
- Lambda予約済み同時実行数設定

## 監視とアラート

### CloudWatchメトリクス
- API呼び出し成功率
- レート制限超過回数
- エラー発生率
- 処理時間

### CloudWatch Alarms
- エラー率 > 5%
- スロットリング発生
- Lambda実行時間 > 閾値

## 開発ワークフロー

1. **API仕様確認**: TDnet APIドキュメント参照
2. **実装**: スクレイピングロジック作成
3. **単体テスト**: モックを使用したテスト
4. **E2Eテスト**: LocalStack環境で統合テスト
5. **デプロイ**: 本番環境へのデプロイ
6. **監視**: CloudWatchでメトリクス確認

## 関連ドキュメント

- [TDnetスクレイピングパターン](../../.kiro/steering/development/tdnet-scraping-patterns.md)
- [エラーハンドリングパターン](../../.kiro/steering/core/error-handling-patterns.md)
- [テスト戦略](../../.kiro/steering/development/testing-strategy.md)
- [TDnet実装ルール](../../.kiro/steering/core/tdnet-implementation-rules.md)
- [パフォーマンス最適化](../../.kiro/steering/infrastructure/performance-optimization.md)

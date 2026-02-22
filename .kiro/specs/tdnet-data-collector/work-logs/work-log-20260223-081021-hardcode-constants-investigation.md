# 作業記録: ハードコード定数調査

**作業日時**: 2026-02-23 08:10:21  
**作業概要**: その他の定数のハードコード調査  
**タスク**: tasks-hardcoded-values-improvement.md

---

## 1. 調査結果サマリー

### 発見された定数の総数
- **レート制限値**: 3箇所
- **リトライ設定**: 8箇所
- **タイムアウト値**: 15箇所
- **ページネーション設定**: 5箇所
- **バッチサイズ**: 2箇所
- **署名付きURL有効期限**: 3箇所
- **キャッシュTTL**: 1箇所
- **ファイルサイズ制限**: 2箇所
- **Lambda設定**: 環境設定ファイルで管理済み

**合計**: 約39箇所の定数を発見

### カテゴリ別の分類

| カテゴリ | 箇所数 | 環境依存性 | 優先度 |
|---------|--------|-----------|--------|
| レート制限 | 3 | あり | 高 |
| リトライ設定 | 8 | あり | 高 |
| タイムアウト | 15 | あり | 高 |
| ページネーション | 5 | なし | 中 |
| バッチサイズ | 2 | なし | 中 |
| 署名付きURL有効期限 | 3 | あり | 高 |
| キャッシュTTL | 1 | あり | 中 |
| ファイルサイズ制限 | 2 | なし | 低 |

### 環境依存性の有無
- **環境依存あり**: レート制限、リトライ設定、タイムアウト、署名付きURL有効期限、キャッシュTTL（計30箇所）
- **環境依存なし**: ページネーション、バッチサイズ、ファイルサイズ制限（計9箇所）

---

## 2. 詳細リスト

### 2.1 レート制限値

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/utils/rate-limiter.ts` | `minDelayMs: 2000` | TDnetリクエスト間隔（デフォルト2秒） | あり | 高 |
| `src/lambda/collector/scrape-tdnet-list.ts` | `minDelayMs: 2000` | TDnetスクレイピング時のレート制限 | あり | 高 |
| `cdk/lib/stacks/api-stack.ts` | `rateLimit: 100` | API Gateway レート制限（100リクエスト/分） | あり | 高 |
| `cdk/lib/stacks/api-stack.ts` | `burstLimit: 200` | API Gateway バースト制限 | あり | 高 |
| `cdk/lib/constructs/waf.ts` | `rateLimitPerFiveMinutes: 500` | WAF レート制限（5分間で500リクエスト） | あり | 高 |

### 2.2 リトライ設定

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/utils/retry.ts` | `maxRetries: 3` | デフォルト最大リトライ回数 | あり | 高 |
| `src/utils/retry.ts` | `initialDelay: 2000` | デフォルト初期遅延時間（2秒） | あり | 高 |
| `src/utils/retry.ts` | `backoffMultiplier: 2` | デフォルトバックオフ倍率 | あり | 高 |
| `src/utils/batch-write.ts` | `maxRetries: 3` | バッチ書き込みリトライ回数 | あり | 高 |
| `src/utils/batch-write.ts` | `initialDelay: 1000` | バッチ書き込み初期遅延（1秒） | あり | 高 |
| `src/utils/batch-write.ts` | `backoffMultiplier: 2` | バッチ書き込みバックオフ倍率 | あり | 高 |
| `src/lambda/api/pdf-download/handler.ts` | `maxRetries: 3` | PDF署名付きURL生成リトライ | あり | 高 |
| `src/lambda/api/pdf-download/handler.ts` | `initialDelay: 1000` | PDF署名付きURL生成初期遅延 | あり | 高 |

### 2.3 タイムアウト値

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/scraper/pdf-downloader.ts` | `timeout: 30000` | PDFダウンロードタイムアウト（30秒） | あり | 高 |
| `src/lambda/collector/scrape-tdnet-list.ts` | `HTTP_TIMEOUT_MS: 30000` | TDnet HTMLフェッチタイムアウト（30秒） | あり | 高 |
| `src/lambda/collector-fetch/handler.ts` | `HTTP_TIMEOUT_MS: 30000` | TDnet HTMLフェッチタイムアウト（30秒） | あり | 高 |
| `src/lambda/collector/download-pdf.ts` | `timeout: 60000` | PDFダウンロードタイムアウト（60秒） | あり | 高 |
| `dashboard/src/services/api.ts` | `timeout: 30000` | API クライアントタイムアウト（30秒） | あり | 高 |
| `cdk/lib/config/environment-config.ts` | Lambda各種タイムアウト | Lambda関数タイムアウト設定 | あり | 高 |

**Lambda タイムアウト設定（environment-config.ts）**:
- Collector: 900秒（本番）、300秒（ローカル）
- Query: 30秒（本番）、10秒（ローカル）
- Export: 300秒（本番）、120秒（ローカル）
- Collect: 30秒
- CollectStatus: 30秒
- ExportStatus: 30秒
- PdfDownload: 30秒
- Health: 10秒
- Stats: 30秒

### 2.4 ページネーション設定

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/lambda/query/handler.ts` | `limit: 100` | デフォルト取得件数 | なし | 中 |
| `src/validators/disclosure-schema.ts` | `max(1000)` | 最大取得件数 | なし | 中 |
| `src/lambda/collector/scrape-tdnet-list.ts` | `100` | TDnetページあたりの開示情報数 | なし | 低 |

### 2.5 バッチサイズ

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/utils/batch-write.ts` | `batchSize: 25` | DynamoDB BatchWriteItem最大サイズ | なし | 中 |
| `src/__tests__/integration/performance-benchmark.test.ts` | `batchSize: 25` | パフォーマンステスト用バッチサイズ | なし | 低 |

### 2.6 署名付きURL有効期限

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/lambda/query/generate-presigned-url.ts` | `URL_EXPIRATION_SECONDS: 3600` | PDF署名付きURL有効期限（1時間） | あり | 高 |
| `src/lambda/export/generate-signed-url.ts` | `expiresIn: 7 * 24 * 60 * 60` | エクスポート署名付きURL有効期限（7日） | あり | 高 |
| `src/lambda/api/pdf-download/handler.ts` | `DEFAULT_EXPIRATION: 3600` | PDF署名付きURLデフォルト有効期限（1時間） | あり | 高 |
| `src/lambda/api/pdf-download/handler.ts` | `MAX_EXPIRATION: 86400` | PDF署名付きURL最大有効期限（24時間） | あり | 高 |
| `src/lambda/api/pdf-download/handler.ts` | `MIN_EXPIRATION: 60` | PDF署名付きURL最小有効期限（1分） | あり | 高 |

### 2.7 キャッシュTTL

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/utils/secrets-manager.ts` | `DEFAULT_CACHE_TTL_MS: 5 * 60 * 1000` | Secrets Managerキャッシュ有効期限（5分） | あり | 中 |

### 2.8 ファイルサイズ制限

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/scraper/pdf-downloader.ts` | `minSize: 10 * 1024` | PDF最小サイズ（10KB） | なし | 低 |
| `src/scraper/pdf-downloader.ts` | `maxSize: 50 * 1024 * 1024` | PDF最大サイズ（50MB） | なし | 低 |
| `src/validators/disclosure-schema.ts` | `max(100 * 1024 * 1024)` | ファイルサイズ最大値（100MB） | なし | 低 |

### 2.9 並列実行数

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/lambda/collector-save/handler.ts` | `concurrency: 5` | PDF保存時の並列実行数 | あり | 高 |
| `src/__tests__/integration/performance-benchmark.test.ts` | `concurrency: 5` | パフォーマンステスト用並列実行数 | なし | 低 |

### 2.10 その他のビジネスロジック定数

| ファイルパス | 定数名/値 | 使用目的 | 環境依存性 | 優先度 |
|------------|----------|---------|-----------|--------|
| `src/lambda/collector-init/handler.ts` | `estimatedPerDay: 200` | 1日あたりの推定開示情報数 | なし | 低 |
| `src/lambda/collector/update-execution-status.ts` | `30 * 24 * 60 * 60` | 実行状態TTL（30日） | なし | 低 |

---

## 3. 対応方針の提案

### 3.1 `src/constants/`ディレクトリで管理すべき定数

#### 優先度: 高（環境依存あり）

**`src/constants/rate-limits.ts`**
```typescript
/**
 * レート制限設定
 */
export const RATE_LIMITS = {
  /** TDnetリクエスト間隔（ミリ秒） */
  TDNET_REQUEST_DELAY_MS: parseInt(process.env.TDNET_REQUEST_DELAY_MS || '2000', 10),
  
  /** API Gateway レート制限（リクエスト/分） */
  API_RATE_LIMIT: parseInt(process.env.API_RATE_LIMIT || '100', 10),
  
  /** API Gateway バースト制限 */
  API_BURST_LIMIT: parseInt(process.env.API_BURST_LIMIT || '200', 10),
  
  /** WAF レート制限（リクエスト/5分） */
  WAF_RATE_LIMIT: parseInt(process.env.WAF_RATE_LIMIT || '500', 10),
} as const;
```

**`src/constants/retry-config.ts`**
```typescript
/**
 * リトライ設定
 */
export const RETRY_CONFIG = {
  /** デフォルト最大リトライ回数 */
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),
  
  /** デフォルト初期遅延時間（ミリ秒） */
  INITIAL_DELAY_MS: parseInt(process.env.INITIAL_DELAY_MS || '2000', 10),
  
  /** デフォルトバックオフ倍率 */
  BACKOFF_MULTIPLIER: parseFloat(process.env.BACKOFF_MULTIPLIER || '2'),
  
  /** ジッター有効化 */
  JITTER_ENABLED: process.env.JITTER_ENABLED !== 'false',
} as const;
```

**`src/constants/timeouts.ts`**
```typescript
/**
 * タイムアウト設定
 */
export const TIMEOUTS = {
  /** HTTPリクエストタイムアウト（ミリ秒） */
  HTTP_REQUEST_MS: parseInt(process.env.HTTP_REQUEST_TIMEOUT_MS || '30000', 10),
  
  /** PDFダウンロードタイムアウト（ミリ秒） */
  PDF_DOWNLOAD_MS: parseInt(process.env.PDF_DOWNLOAD_TIMEOUT_MS || '60000', 10),
  
  /** API クライアントタイムアウト（ミリ秒） */
  API_CLIENT_MS: parseInt(process.env.API_CLIENT_TIMEOUT_MS || '30000', 10),
} as const;
```

**`src/constants/expiration.ts`**
```typescript
/**
 * 有効期限設定
 */
export const EXPIRATION = {
  /** 署名付きURLデフォルト有効期限（秒） */
  SIGNED_URL_DEFAULT_SEC: parseInt(process.env.SIGNED_URL_DEFAULT_SEC || '3600', 10),
  
  /** 署名付きURL最大有効期限（秒） */
  SIGNED_URL_MAX_SEC: parseInt(process.env.SIGNED_URL_MAX_SEC || '86400', 10),
  
  /** 署名付きURL最小有効期限（秒） */
  SIGNED_URL_MIN_SEC: parseInt(process.env.SIGNED_URL_MIN_SEC || '60', 10),
  
  /** エクスポート署名付きURL有効期限（秒） */
  EXPORT_SIGNED_URL_SEC: parseInt(process.env.EXPORT_SIGNED_URL_SEC || String(7 * 24 * 60 * 60), 10),
  
  /** Secrets Managerキャッシュ有効期限（ミリ秒） */
  SECRETS_CACHE_MS: parseInt(process.env.SECRETS_CACHE_MS || String(5 * 60 * 1000), 10),
} as const;
```

**`src/constants/concurrency.ts`**
```typescript
/**
 * 並列実行設定
 */
export const CONCURRENCY = {
  /** PDF保存時の並列実行数 */
  PDF_SAVE: parseInt(process.env.PDF_SAVE_CONCURRENCY || '5', 10),
} as const;
```

#### 優先度: 中（環境依存なし、ビジネスロジック）

**`src/constants/pagination.ts`**
```typescript
/**
 * ページネーション設定
 */
export const PAGINATION = {
  /** デフォルト取得件数 */
  DEFAULT_LIMIT: 100,
  
  /** 最大取得件数 */
  MAX_LIMIT: 1000,
  
  /** TDnetページあたりの開示情報数 */
  TDNET_PAGE_SIZE: 100,
} as const;
```

**`src/constants/batch.ts`**
```typescript
/**
 * バッチ処理設定
 */
export const BATCH = {
  /** DynamoDB BatchWriteItem最大サイズ */
  DYNAMODB_WRITE_SIZE: 25,
} as const;
```

#### 優先度: 低（技術的制約、変更不要）

**`src/constants/file-limits.ts`**
```typescript
/**
 * ファイルサイズ制限
 */
export const FILE_LIMITS = {
  /** PDF最小サイズ（バイト） */
  PDF_MIN_SIZE: 10 * 1024, // 10KB
  
  /** PDF最大サイズ（バイト） */
  PDF_MAX_SIZE: 50 * 1024 * 1024, // 50MB
  
  /** ファイルサイズ最大値（バイト） */
  FILE_MAX_SIZE: 100 * 1024 * 1024, // 100MB
} as const;
```

### 3.2 環境変数でオーバーライド可能にすべき定数

以下の定数は環境変数でオーバーライド可能にすることを推奨：

1. **レート制限値**: `TDNET_REQUEST_DELAY_MS`, `API_RATE_LIMIT`, `API_BURST_LIMIT`, `WAF_RATE_LIMIT`
2. **リトライ設定**: `MAX_RETRIES`, `INITIAL_DELAY_MS`, `BACKOFF_MULTIPLIER`
3. **タイムアウト値**: `HTTP_REQUEST_TIMEOUT_MS`, `PDF_DOWNLOAD_TIMEOUT_MS`, `API_CLIENT_TIMEOUT_MS`
4. **署名付きURL有効期限**: `SIGNED_URL_DEFAULT_SEC`, `SIGNED_URL_MAX_SEC`, `SIGNED_URL_MIN_SEC`, `EXPORT_SIGNED_URL_SEC`
5. **キャッシュTTL**: `SECRETS_CACHE_MS`
6. **並列実行数**: `PDF_SAVE_CONCURRENCY`

### 3.3 現状維持でよい定数

以下の定数は技術的制約やビジネスロジックの一部であり、現状維持でよい：

1. **ページネーション設定**: `DEFAULT_LIMIT`, `MAX_LIMIT`, `TDNET_PAGE_SIZE`
2. **バッチサイズ**: `DYNAMODB_WRITE_SIZE`（DynamoDB制約）
3. **ファイルサイズ制限**: `PDF_MIN_SIZE`, `PDF_MAX_SIZE`, `FILE_MAX_SIZE`
4. **ビジネスロジック定数**: `estimatedPerDay`, 実行状態TTL

### 3.4 定数ファイルの構造案

```
src/constants/
├── index.ts              # すべての定数をエクスポート
├── rate-limits.ts        # レート制限設定
├── retry-config.ts       # リトライ設定
├── timeouts.ts           # タイムアウト設定
├── expiration.ts         # 有効期限設定
├── concurrency.ts        # 並列実行設定
├── pagination.ts         # ページネーション設定
├── batch.ts              # バッチ処理設定
└── file-limits.ts        # ファイルサイズ制限
```

**`src/constants/index.ts`**
```typescript
export * from './rate-limits';
export * from './retry-config';
export * from './timeouts';
export * from './expiration';
export * from './concurrency';
export * from './pagination';
export * from './batch';
export * from './file-limits';
```

---

## 4. 実装計画

### フェーズ1: 定数ファイル作成（優先度: 高）
1. `src/constants/`ディレクトリ作成
2. 各定数ファイル作成（rate-limits.ts, retry-config.ts, timeouts.ts, expiration.ts, concurrency.ts）
3. `src/constants/index.ts`作成

### フェーズ2: 既存コードの移行（優先度: 高）
1. `src/utils/retry.ts`のデフォルト値を`RETRY_CONFIG`に置き換え
2. `src/utils/rate-limiter.ts`のデフォルト値を`RATE_LIMITS`に置き換え
3. `src/scraper/pdf-downloader.ts`のタイムアウトを`TIMEOUTS`に置き換え
4. `src/lambda/collector/scrape-tdnet-list.ts`のタイムアウトとレート制限を定数に置き換え
5. `src/lambda/api/pdf-download/handler.ts`の有効期限設定を`EXPIRATION`に置き換え
6. `src/lambda/query/generate-presigned-url.ts`の有効期限設定を`EXPIRATION`に置き換え
7. `src/lambda/export/generate-signed-url.ts`の有効期限設定を`EXPIRATION`に置き換え
8. `src/utils/secrets-manager.ts`のキャッシュTTLを`EXPIRATION`に置き換え
9. `src/lambda/collector-save/handler.ts`の並列実行数を`CONCURRENCY`に置き換え

### フェーズ3: CDK設定の移行（優先度: 高）
1. `cdk/lib/stacks/api-stack.ts`のレート制限を`RATE_LIMITS`に置き換え
2. `cdk/lib/constructs/waf.ts`のレート制限を`RATE_LIMITS`に置き換え

### フェーズ4: テスト更新（優先度: 高）
1. 各定数ファイルのユニットテスト作成
2. 既存テストの定数参照を更新

### フェーズ5: ドキュメント更新（優先度: 中）
1. README.mdに環境変数一覧を追加
2. `.env.example`に環境変数のサンプルを追加
3. steering filesに定数管理ガイドを追加

---

## 5. 成果物

### 作成予定ファイル
- `src/constants/index.ts`
- `src/constants/rate-limits.ts`
- `src/constants/retry-config.ts`
- `src/constants/timeouts.ts`
- `src/constants/expiration.ts`
- `src/constants/concurrency.ts`
- `src/constants/pagination.ts`
- `src/constants/batch.ts`
- `src/constants/file-limits.ts`

### 更新予定ファイル
- `src/utils/retry.ts`
- `src/utils/rate-limiter.ts`
- `src/scraper/pdf-downloader.ts`
- `src/lambda/collector/scrape-tdnet-list.ts`
- `src/lambda/api/pdf-download/handler.ts`
- `src/lambda/query/generate-presigned-url.ts`
- `src/lambda/export/generate-signed-url.ts`
- `src/utils/secrets-manager.ts`
- `src/lambda/collector-save/handler.ts`
- `cdk/lib/stacks/api-stack.ts`
- `cdk/lib/constructs/waf.ts`

---

## 6. 申し送り事項

### 次のタスクへの引き継ぎ
1. **定数ファイル作成**: フェーズ1の実装を優先的に実施
2. **環境変数設定**: `.env.example`に環境変数のサンプルを追加
3. **テスト更新**: 定数ファイル作成後、既存テストを更新
4. **ドキュメント更新**: README.mdに環境変数一覧を追加

### 注意事項
1. **環境変数のデフォルト値**: 既存のハードコード値をデフォルト値として使用
2. **型安全性**: `as const`を使用して型安全性を確保
3. **後方互換性**: 既存コードが動作し続けるように、段階的に移行
4. **テストカバレッジ**: 定数ファイルのユニットテストを必ず作成

---

## 7. 参考情報

### 関連ドキュメント
- `.kiro/steering/core/tdnet-implementation-rules.md` - 実装ルール
- `.kiro/steering/development/lambda-guide.md` - Lambda実装ガイド
- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリング
- `.kiro/steering/infrastructure/environment-variables.md` - 環境変数管理

### 参考実装
- `cdk/lib/config/environment-config.ts` - Lambda設定の環境別管理（既存）
- `src/utils/retry.ts` - リトライ設定のデフォルト値（既存）
- `src/utils/rate-limiter.ts` - レート制限の実装（既存）

---

**作業完了日時**: 2026-02-23 08:10:21

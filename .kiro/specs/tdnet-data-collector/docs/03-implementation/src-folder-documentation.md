# srcフォルダ ドキュメント

**最終更新**: 2026-02-15  
**バージョン**: 1.0.0

## 概要

`src/`フォルダはTDnet Data Collectorのコアロジックを含むTypeScriptソースコードです。Lambda関数、ユーティリティ、スクレイパー、型定義など、システムの主要コンポーネントが体系的に整理されています。

## ディレクトリ構造

```
src/
├── lambda/              # Lambda関数（11個）
│   ├── api/            # API Gateway統合Lambda
│   ├── api-key-rotation/  # APIキーローテーション
│   ├── collect/        # データ収集トリガー
│   ├── collect-status/ # 収集ステータス確認
│   ├── collector/      # TDnetスクレイピング・データ収集
│   ├── dlq-processor/  # DLQメッセージ処理
│   ├── export/         # データエクスポート
│   ├── get-disclosure/ # 個別開示取得
│   ├── health/         # ヘルスチェック
│   ├── query/          # データクエリAPI
│   └── stats/          # 統計情報
├── errors/             # カスタムエラークラス
├── models/             # データモデル
├── scraper/            # TDnetスクレイパー
├── types/              # TypeScript型定義
├── utils/              # ユーティリティ関数
└── __tests__/          # テストファイル
```

## 主要コンポーネント

### 1. Lambda関数 (`lambda/`)

#### 1.1 collector/ - データ収集エンジン

**役割**: TDnetから開示情報をスクレイピングし、DynamoDB/S3に保存

**主要ファイル**:
- `handler.ts` - Lambda エントリーポイント
- `scrape-tdnet-list.ts` - TDnet HTMLスクレイピング
- `download-pdf.ts` - PDFダウンロード・S3保存
- `save-metadata.ts` - DynamoDBメタデータ保存
- `update-execution-status.ts` - 実行ステータス管理
- `dependencies.ts` - 依存性注入（テスト容易性）

**処理フロー**:
1. イベント検証（バッチ/オンデマンドモード）
2. TDnet HTMLスクレイピング（レート制限付き）
3. PDFダウンロード・S3保存
4. メタデータDynamoDB保存
5. 実行ステータス更新

**エラーハンドリング**:
- 指数バックオフ再試行（`retryWithBackoff`）
- 部分的失敗許容（バッチ処理）
- 構造化ログ記録

#### 1.2 query/ - データクエリAPI

**役割**: DynamoDBから開示情報を検索・取得

**主要機能**:
- 日付範囲検索（GSI使用）
- 企業コード検索
- 開示種類フィルタリング
- ページネーション

#### 1.3 export/ - データエクスポート

**役割**: 開示情報をJSON/CSV形式でエクスポート

**主要機能**:
- 非同期エクスポート処理
- S3署名付きURL生成
- エクスポートステータス管理

#### 1.4 api/ - API Gateway統合

**役割**: API Gatewayリクエスト処理

**主要ファイル**:
- `export-status/handler.ts` - エクスポートステータス取得
- `pdf-download/handler.ts` - PDF署名付きURL生成

#### 1.5 その他Lambda関数

- **collect/** - データ収集トリガー（EventBridge/手動）
- **collect-status/** - 収集ステータス確認
- **get-disclosure/** - 個別開示取得
- **stats/** - 統計情報（件数、企業数など）
- **health/** - ヘルスチェック
- **dlq-processor/** - DLQメッセージ処理・再試行
- **api-key-rotation/** - APIキーローテーション（Secrets Manager）

### 2. エラークラス (`errors/`)

**ファイル**: `index.ts`

**エラー階層**:
```
TDnetError (基底クラス)
├── RetryableError (再試行可能)
│   ├── RateLimitError
│   └── DownloadError
├── ValidationError (再試行不可)
├── NotFoundError (再試行不可)
├── AuthenticationError (再試行不可)
└── ConfigurationError (再試行不可)
```

**使用例**:
```typescript
import { RetryableError, ValidationError } from '../errors';

// 再試行可能なエラー
throw new RetryableError('Network timeout', originalError);

// 再試行不可能なエラー
throw new ValidationError('Invalid date format', { date: '2024-13-01' });
```

### 3. データモデル (`models/`)

**ファイル**: `disclosure.ts`

**主要関数**:
- `validateDisclosure()` - Disclosureバリデーション
- `toDynamoDBItem()` - Disclosure → DynamoDBアイテム変換
- `fromDynamoDBItem()` - DynamoDBアイテム → Disclosure変換
- `createDisclosure()` - Disclosure作成ヘルパー

**バリデーションルール**:
- `disclosure_id`: 必須、一意
- `company_code`: 4桁の数字
- `disclosed_at`: ISO 8601形式
- `date_partition`: YYYY-MM形式

### 4. スクレイパー (`scraper/`)

#### 4.1 html-parser.ts

**役割**: TDnet HTMLをパースし、開示情報メタデータを抽出

**主要関数**:
- `parseDisclosureList()` - HTMLパース
- `extractPageDate()` - ページヘッダーから日付抽出
- `extractDisclosureType()` - タイトルから開示種類推測
- `buildAbsolutePdfUrl()` - 相対URL → 絶対URL変換
- `parseDisclosedAt()` - JST日時 → ISO 8601 UTC変換
- `detectHtmlStructureChange()` - HTML構造変更検知

**HTML構造**:
```html
<table id="main-list-table">
  <tr>
    <td>時刻</td>
    <td>企業コード</td>
    <td>企業名</td>
    <td>タイトル（PDFリンク）</td>
    <td>XBRL</td>
    <td>取引所</td>
    <td>履歴</td>
  </tr>
</table>
```

#### 4.2 pdf-downloader.ts

**役割**: PDFダウンロード・バリデーション

**主要関数**:
- `downloadPdf()` - PDFダウンロード（再試行付き）
- `validatePdfFile()` - PDFファイルバリデーション

**バリデーション**:
- ファイルサイズ: 10KB〜50MB
- PDFヘッダー: `%PDF-`で開始

### 5. 型定義 (`types/`)

**ファイル**: `index.ts`

**主要型**:
- `Disclosure` - 開示情報
- `CollectionResult` - 収集結果
- `ExecutionStatus` - 実行状態
- `QueryFilter` - クエリフィルター
- `ExportRequest` - エクスポートリクエスト
- `ExportStatus` - エクスポート状態
- `CollectorEvent` - Lambda Collectorイベント
- `CollectorResponse` - Lambda Collectorレスポンス

### 6. ユーティリティ (`utils/`)

#### 6.1 retry.ts - 再試行ロジック

**主要関数**:
- `retryWithBackoff()` - 指数バックオフ再試行
- `isRetryableError()` - 再試行可能エラー判定

**デフォルト設定**:
- 最大再試行回数: 3
- 初期遅延: 2000ms
- バックオフ倍率: 2
- ジッター: 有効

**使用例**:
```typescript
await retryWithBackoff(
  async () => await fetchData(),
  {
    maxRetries: 3,
    initialDelay: 2000,
    backoffMultiplier: 2,
    jitter: true,
  }
);
```

#### 6.2 rate-limiter.ts - レート制限

**クラス**: `RateLimiter`

**主要メソッド**:
- `waitIfNeeded()` - 必要に応じて待機
- `reset()` - 最後のリクエスト時刻リセット
- `getMinDelayMs()` - 最小遅延時間取得

**デフォルト設定**:
- 最小遅延: 2000ms（TDnet: 1リクエスト/秒）

**使用例**:
```typescript
const rateLimiter = new RateLimiter({ minDelayMs: 2000 });

for (const url of urls) {
  await rateLimiter.waitIfNeeded();
  const data = await fetchData(url);
}
```

#### 6.3 logger.ts - 構造化ログ

**主要関数**:
- `logger.debug()` - DEBUGログ
- `logger.info()` - INFOログ
- `logger.warn()` - WARNログ
- `logger.error()` - ERRORログ
- `createErrorContext()` - エラーコンテキスト生成
- `logLambdaError()` - Lambda実行コンテキスト付きエラーログ

**ログ構造**:
```typescript
logger.error('Operation failed', {
  error_type: 'NetworkError',
  error_message: error.message,
  context: { disclosure_id: 'TD20240115001', retry_count: 2 },
  stack_trace: error.stack,
});
```

**環境対応**:
- Lambda環境: `console.log` + JSON形式
- ローカル環境: Winston + カラー出力

#### 6.4 disclosure-id.ts - 開示ID生成

**主要関数**:
- `generateDisclosureId()` - 開示ID生成

**フォーマット**: `YYYYMMDD_企業コード_連番`

**例**: `20240115_1234_001`

**JST変換**:
- UTC時刻をJST（UTC+9）に変換してから日付抽出
- 月またぎのエッジケース対応

#### 6.5 date-partition.ts - date_partition生成

**主要関数**:
- `generateDatePartition()` - date_partition生成（JST基準）
- `validateDisclosedAt()` - disclosed_atバリデーション
- `generateMonthRange()` - 月範囲生成
- `validateYearMonth()` - YYYY-MMバリデーション

**フォーマット**: `YYYY-MM`（JST基準）

**例**: `2024-01`

**バリデーション**:
- ISO 8601形式チェック
- 有効な日付チェック
- 範囲チェック（1970-01-01以降、現在+1日以内）

#### 6.6 batch-write.ts - DynamoDB バッチ書き込み

**主要関数**:
- `batchWriteItems()` - バッチ書き込み（最大25アイテム）

**特徴**:
- 自動バッチ分割（25アイテムずつ）
- 未処理アイテム再試行（指数バックオフ）
- スロットリング対応

**パフォーマンス**:
- 個別PutItem: 100アイテム/約10秒
- BatchWriteItem: 100アイテム/約2秒（約5倍高速）

#### 6.7 その他ユーティリティ

- **cloudwatch-metrics.ts** - CloudWatchメトリクス送信
- **metrics.ts** - メトリクス収集

### 7. テスト (`__tests__/`)

**テスト種類**:
- **ユニットテスト**: 各関数・クラスの単体テスト
- **統合テスト**: `integration/` - Lambda関数統合テスト
- **負荷テスト**: `load/` - パフォーマンステスト
- **プロパティテスト**: `date-partition.property.test.ts` - fast-check使用

**主要テストファイル**:
- `ci-cd-verification.test.ts` - CI/CD検証
- `lambda-optimization.test.ts` - Lambda最適化検証
- `project-structure.test.ts` - プロジェクト構造検証
- `type-definitions.test.ts` - 型定義検証

## 実装パターン

### 1. エラーハンドリングパターン

```typescript
import { retryWithBackoff } from '../utils/retry';
import { logger, createErrorContext } from '../utils/logger';
import { RetryableError, ValidationError } from '../errors';

async function processData() {
  try {
    await retryWithBackoff(
      async () => await fetchData(),
      {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        jitter: true,
      }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      // 再試行不可能なエラー - 即座に失敗
      logger.error('Validation failed', createErrorContext(error));
      throw error;
    } else if (error instanceof RetryableError) {
      // 再試行可能なエラー - DLQへ
      logger.error('Retryable error occurred', createErrorContext(error));
      throw error;
    } else {
      // 予期しないエラー
      logger.error('Unexpected error', createErrorContext(error));
      throw error;
    }
  }
}
```

### 2. レート制限パターン

```typescript
import { RateLimiter } from '../utils/rate-limiter';

const rateLimiter = new RateLimiter({ minDelayMs: 2000 });

async function fetchMultiplePages(dates: string[]) {
  const results = [];
  
  for (const date of dates) {
    await rateLimiter.waitIfNeeded();
    const data = await fetchTdnetHtml(date);
    results.push(data);
  }
  
  return results;
}
```

### 3. バッチ処理パターン

```typescript
import { batchWriteItems } from '../utils/batch-write';

async function saveDisclosures(disclosures: Disclosure[]) {
  const result = await batchWriteItems(
    process.env.DYNAMODB_TABLE!,
    disclosures
  );
  
  if (result.failedCount > 0) {
    logger.error('Some items failed to write', {
      failedCount: result.failedCount,
      unprocessedItems: result.unprocessedItems,
    });
  }
  
  return result;
}
```

### 4. 依存性注入パターン（テスト容易性）

```typescript
// dependencies.ts
export interface CollectorDependencies {
  rateLimiter: RateLimiter;
  dynamoClient: DynamoDBClient;
  s3Client: S3Client;
}

let dependencies: CollectorDependencies | null = null;

export function getDependencies(): CollectorDependencies {
  if (!dependencies) {
    dependencies = createDefaultDependencies();
  }
  return dependencies;
}

export function setDependencies(deps: CollectorDependencies): void {
  dependencies = deps;
}

// テストコード
import { setDependencies } from './dependencies';

beforeEach(() => {
  setDependencies({
    rateLimiter: new MockRateLimiter(),
    dynamoClient: mockDynamoClient,
    s3Client: mockS3Client,
  });
});
```

## データフロー

### 1. データ収集フロー

```
EventBridge/手動トリガー
  ↓
Lambda: collect (トリガー)
  ↓
Lambda: collector (データ収集)
  ↓
┌─────────────────────────────────┐
│ 1. TDnet HTMLスクレイピング      │
│    - レート制限（1リクエスト/秒）│
│    - HTML構造変更検知            │
│    - メタデータ抽出              │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 2. PDFダウンロード               │
│    - 再試行（指数バックオフ）    │
│    - バリデーション              │
│    - S3保存                      │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 3. メタデータ保存                │
│    - DynamoDB BatchWriteItem     │
│    - date_partition生成（JST）   │
│    - disclosure_id生成           │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 4. 実行ステータス更新            │
│    - 成功/失敗件数               │
│    - 進捗率                      │
│    - エラーメッセージ            │
└─────────────────────────────────┘
```

### 2. データクエリフロー

```
API Gateway
  ↓
Lambda: query
  ↓
┌─────────────────────────────────┐
│ 1. クエリパラメータ検証          │
│    - 日付範囲                    │
│    - 企業コード                  │
│    - 開示種類                    │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 2. DynamoDB クエリ               │
│    - GSI使用（date_partition）   │
│    - 月単位並列クエリ            │
│    - ページネーション            │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 3. レスポンス生成                │
│    - JSON形式                    │
│    - CORS対応                    │
└─────────────────────────────────┘
```

### 3. データエクスポートフロー

```
API Gateway
  ↓
Lambda: export (非同期処理開始)
  ↓
┌─────────────────────────────────┐
│ 1. エクスポートリクエスト作成    │
│    - export_id生成               │
│    - ステータス: pending         │
└─────────────────────────────────┘
  ↓
Lambda: export-processor (バックグラウンド)
  ↓
┌─────────────────────────────────┐
│ 2. データ取得                    │
│    - DynamoDB クエリ             │
│    - フィルタリング              │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 3. フォーマット変換              │
│    - JSON/CSV                    │
│    - S3保存                      │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ 4. 署名付きURL生成               │
│    - 有効期限: 7日               │
│    - ステータス: completed       │
└─────────────────────────────────┘
```

## パフォーマンス最適化

### 1. Lambda最適化

- **メモリ設定**: 128-512MB（関数により調整）
- **タイムアウト**: 最小化（collector: 300秒、query: 30秒）
- **コールドスタート対策**: グローバルスコープでクライアント初期化

### 2. DynamoDB最適化

- **BatchWriteItem**: 最大25アイテム/リクエスト（約5倍高速）
- **GSI**: date_partition + disclosed_at（月単位クエリ高速化）
- **並列クエリ**: 複数月を並列クエリ

### 3. レート制限

- **TDnet**: 1リクエスト/秒（過度な負荷回避）
- **並列実行**: 最大5並列（Lambda同時実行制限）

## セキュリティ

### 1. 認証・認可

- **API Gateway**: APIキー認証
- **Secrets Manager**: APIキー管理・ローテーション
- **IAM**: 最小権限原則

### 2. データ保護

- **S3**: サーバーサイド暗号化（SSE-S3）
- **DynamoDB**: 保存時暗号化
- **CloudWatch Logs**: ログ暗号化

### 3. 入力バリデーション

- **Zod**: スキーマバリデーション
- **カスタムバリデーション**: 日付範囲、フォーマットチェック

## 監視・ログ

### 1. 構造化ログ

```typescript
logger.error('Operation failed', {
  error_type: 'NetworkError',
  error_message: error.message,
  context: { disclosure_id: 'TD20240115001', retry_count: 2 },
  stack_trace: error.stack,
});
```

### 2. CloudWatchメトリクス

- Lambda実行時間
- エラー率
- DLQメッセージ数
- API Gateway リクエスト数

### 3. CloudWatch Alarms

- エラー率 > 5%
- DLQメッセージ数 > 10
- Lambda実行時間 > 閾値

## テスト戦略

### 1. ユニットテスト

- **カバレッジ目標**: 80%以上
- **テストフレームワーク**: Jest
- **モック**: AWS SDK、外部API

### 2. 統合テスト

- **LocalStack**: DynamoDB、S3、Secrets Manager
- **E2Eテスト**: Lambda関数統合テスト

### 3. プロパティテスト

- **fast-check**: date_partition生成、disclosure_id生成

## 関連ドキュメント

- **実装ルール**: `.kiro/steering/core/tdnet-implementation-rules.md`
- **エラーハンドリング**: `.kiro/steering/core/error-handling-patterns.md`
- **テスト戦略**: `.kiro/steering/development/testing-strategy.md`
- **Lambda実装**: `.kiro/steering/development/lambda-implementation.md`
- **スクレイピングパターン**: `.kiro/steering/development/tdnet-scraping-patterns.md`
- **パフォーマンス最適化**: `.kiro/steering/infrastructure/performance-optimization.md`

## 今後の改善案

### 1. パフォーマンス

- [ ] DynamoDB BatchWriteItem完全移行（個別PutItem削減）
- [ ] Lambda Provisioned Concurrency（コールドスタート削減）
- [ ] DynamoDB DAX（キャッシュ層追加）

### 2. 機能拡張

- [ ] 開示種類の自動分類（機械学習）
- [ ] PDF全文検索（Elasticsearch統合）
- [ ] リアルタイム通知（SNS/SQS）

### 3. 運用改善

- [ ] 自動スケーリング調整
- [ ] コスト最適化（S3 Intelligent-Tiering）
- [ ] 監視ダッシュボード強化

## まとめ

`src/`フォルダは、TDnet Data Collectorの中核を担う高品質なTypeScriptコードベースです。エラーハンドリング、レート制限、バッチ処理、構造化ログなど、プロダクションレベルの実装パターンが体系的に整理されています。

**主要な特徴**:
- 型安全性（TypeScript + Zod）
- エラーハンドリング（カスタムエラークラス + 再試行戦略）
- パフォーマンス最適化（BatchWriteItem、GSI、並列処理）
- テスト容易性（依存性注入、モック）
- 運用性（構造化ログ、CloudWatchメトリクス）

このドキュメントは、新規開発者のオンボーディング、コードレビュー、システム保守の参考資料として活用できます。

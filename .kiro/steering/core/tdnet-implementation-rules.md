# TDnet Data Collector - 実装ルール

TDnetから上場企業の開示情報を自動収集するAWSサーバーレスシステムの実装原則。

## 言語設定

**重要: すべての作業は日本語で実施**

- **AI応答**: すべて日本語で記述（説明、提案、質問、エラーメッセージ）
- **コード**: コメント、変数名の説明、ログメッセージは日本語
- **ドキュメント**: README、作業記録、仕様書、コミットメッセージは日本語
- **例外**: TypeScript/JavaScript構文、AWS API名、技術用語は英語のまま

## 技術スタック

Lambda (Node.js 20.x, TypeScript) | DynamoDB | S3 | API Gateway | CDK | CloudWatch | WAF

## プロジェクト構造

### コアコンポーネント
- **src/lambda/**: 11個のLambda関数
  - `collector/` - TDnetスクレイピング・データ収集
  - `query/` - データクエリAPI
  - `export/` - データエクスポート
  - `api/` - API Gateway統合
  - `get-disclosure/` - 個別開示取得
  - `collect-status/` - 収集ステータス確認
  - `stats/` - 統計情報
  - `health/` - ヘルスチェック
  - `dlq-processor/` - DLQメッセージ処理
  - `api-key-rotation/` - APIキーローテーション
- **cdk/**: インフラコード（4スタック: Foundation, Compute, API, Monitoring）
- **dashboard/**: React Webアプリ（開示情報検索UI、PDF生成、Playwright E2Eテスト）
- **scripts/**: 運用スクリプト
  - デプロイ: `deploy-*.ps1`, `deploy-split-stacks.ps1`
  - セットアップ: `create-api-key-secret.ps1`, `generate-env-file.ps1`, `localstack-setup.ps1`
  - データ操作: `fetch-data-range.ps1`, `manual-data-collection.ps1`, `migrate-disclosure-fields.ts`
  - 監視: `check-iam-permissions.ps1`, `deploy-dashboard.ps1`
- **config/**: 環境別設定（.env.development, .env.production, .env.load-test, .env.local）
- **test/**: テスト設定（ユニット、統合、E2E）
- **docker/**: LocalStack開発環境（docker-compose.yml）

### 仕様・ドキュメント
- **.kiro/specs/tdnet-data-collector/**: 要件、設計、タスク、作業記録
- **.kiro/steering/**: 実装ルール（core, development, infrastructure, security, api）

## 必須実装ルール

### 1. コスト最適化
- AWS無料枠内で運用（Lambda 100万リクエスト/月、DynamoDB 25GB、S3 5GB）
- Lambda: メモリ128-512MB、タイムアウト最小化
- DynamoDB: オンデマンド課金、GSI最小限

### 2. エラーハンドリング
- 外部API: 指数バックオフ再試行（`retryWithBackoff`）
- バッチ処理: 部分的失敗を許容、失敗分をDLQへ
- 構造化ログ: error_type, error_message, context, stack_trace

### 3. レート制限
- TDnet: 1リクエスト/秒（`RateLimiter`使用）
- 並列実行: 最大5並列

### 4. データ整合性
- disclosure_id: 一意性保証（`generateDisclosureId`）
- date_partition: YYYY-MM形式、JST基準（`generateDatePartition`）
- バリデーション: Zod使用、必須フィールド検証

### 5. DynamoDB設計
- PK: `disclosure_id`
- GSI: `date_partition` + `disclosed_at`（月単位クエリ高速化）
- TTL: 不要データ自動削除

## 関連ドキュメント

- **タスク実行ルール**: `tdnet-data-collector.md` - タスク実行とフィードバックループ
- **エラーハンドリング基本原則**: `error-handling-patterns.md` - エラー分類と再試行戦略
- **ファイル命名規則**: `../development/tdnet-file-naming.md` - プロジェクト構造と命名規則
- **エラーハンドリング実装**: `../development/error-handling-implementation.md` - 詳細な実装パターン
- **テスト戦略**: `../development/testing-strategy.md` - ユニット、統合、プロパティテスト
- **データバリデーション**: `../development/data-validation.md` - バリデーションルール
- **スクレイピングパターン**: `../development/tdnet-scraping-patterns.md` - TDnetスクレイピングの詳細
- **デプロイメント**: `../infrastructure/deployment-checklist.md` - デプロイ手順とチェックリスト
- **環境変数**: `../infrastructure/environment-variables.md` - 環境変数の管理方法
- **パフォーマンス最適化**: `../infrastructure/performance-optimization.md` - コスト削減とパフォーマンス
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - CloudWatch設定
- **セキュリティベストプラクティス**: `../security/security-best-practices.md` - IAM、暗号化、監査
- **API設計ガイドライン**: `../api/api-design-guidelines.md` - RESTful API設計

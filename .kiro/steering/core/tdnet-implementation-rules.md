# TDnet Data Collector - 実装ルール

TDnetから上場企業の開示情報を自動収集するAWSサーバーレスシステムの実装原則。

## 技術スタック

Lambda (Node.js 20.x, TypeScript) | DynamoDB | S3 | API Gateway | CDK | CloudWatch | WAF

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

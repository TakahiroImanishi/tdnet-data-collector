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

## AWS認証

- **AWS SSO**: プロファイル`imanishi-awssso`を使用（`~/.aws/config`に設定済み）
- **使用方法**: `aws sso login --profile imanishi-awssso` でログイン後、CDKデプロイやスクリプト実行時に`--profile imanishi-awssso`を指定

## 運用スクリプト

### 環境情報の自動取得

すべての運用スクリプトは`scripts/lib/get-stack-outputs.ps1`を使用してCDK Outputsから環境情報を自動取得します。

**取得される環境情報**:
- `ApiEndpoint`: API Gateway URL
- `ApiKeySecretName`: Secrets Manager シークレット名
- `Region`: AWSリージョン
- `Environment`: 環境名（dev/prod）
- `StateMachineArn`: Step Functions ARN（Step Functions有効時のみ）

### 共通パラメータ

すべての運用スクリプトで以下のパラメータが使用可能:
- `-Environment`: 環境指定（dev/prod、デフォルト: prod）
- `-Profile`: AWS CLIプロファイル指定（デフォルト: imanishi-awssso）

### 使用例

```powershell
# 本番環境でデータ収集（デフォルト）
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21" -EndDate "2026-02-22"

# 開発環境でデータ収集
.\scripts\manual-data-collection.ps1 -Environment dev -StartDate "2026-02-21"

# Step Functions実行状態確認
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123

# Step Functions実行キャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123

# データ取得（日付指定）
.\scripts\fetch-data-range.ps1 -Date "2026-02-21"
```

### エラーハンドリング

運用スクリプトは以下のエラーを検出し、適切なメッセージを表示:
- `STACK_NOT_FOUND`: スタックが存在しない → CDKデプロイを確認
- `AUTH_EXPIRED`: AWS認証が期限切れ → `aws sso login`を実行
- `ACCESS_DENIED`: CloudFormationへのアクセス権限なし → IAMポリシーを確認
- `MISSING_OUTPUT`: 必須の出力が見つからない → CDK Outputsを確認

## プロジェクト構造

- **src/lambda/**: 11個のLambda関数（collector, query, export, api, get-disclosure, collect-status, stats, health, dlq-processor, api-key-rotation）
- **cdk/**: 4スタック（Foundation, Compute, API, Monitoring）
- **dashboard/**: React Webアプリ（検索UI、PDF生成、E2Eテスト）
- **scripts/**: 運用スクリプト（デプロイ、セットアップ、データ操作、監視）
- **config/**: 環境別設定
- **.kiro/specs/**: 要件、設計、タスク、作業記録
- **.kiro/steering/**: 実装ルール

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

## 関連

`tdnet-data-collector.md`, `error-handling-patterns.md`, `../development/tdnet-file-naming.md`, `../development/error-handling-implementation.md`, `../development/testing-strategy.md`, `../development/data-validation.md`, `../development/tdnet-scraping-patterns.md`, `../infrastructure/deployment-checklist.md`, `../infrastructure/environment-variables.md`, `../infrastructure/performance-optimization.md`, `../infrastructure/monitoring-alerts.md`, `../security/security-best-practices.md`, `../api/api-design-guidelines.md`

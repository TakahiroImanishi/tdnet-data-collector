---
inclusion: always
description: "TDnet Data Collectorプロジェクトの基本実装原則"
---

# TDnet Data Collector - 実装ルール

TDnetから上場企業の開示情報を自動収集するAWSサーバーレスシステムの実装原則。

## 技術スタック

Lambda (Node.js 20.x, TypeScript) | DynamoDB | S3 | API Gateway | CDK | CloudWatch | WAF

## 実装原則

### 1. コスト最適化最優先
AWS無料枠を最大活用。詳細: `../infrastructure/performance-optimization.md`

### 2. エラーハンドリング徹底
外部API呼び出しに再試行ロジック実装、部分的失敗を許容。詳細: `error-handling-patterns.md`, `../development/error-handling-implementation.md`

### 3. レート制限遵守
TDnetへのリクエスト間隔を適切に制御。詳細: `../development/tdnet-scraping-patterns.md`

### 4. データ整合性保証
重複チェックとデータ検証を徹底。詳細: `../development/data-validation.md`

### 5. date_partition活用
DynamoDB GSIで`date_partition`（YYYY-MM形式）を使用し月単位クエリを高速化。JST基準で`disclosed_at`から自動生成。詳細: `../development/data-validation.md`

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

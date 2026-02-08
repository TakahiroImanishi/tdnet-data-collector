---
inclusion: always
description: "TDnet Data Collectorプロジェクトの基本的な実装原則"
---

# TDnet Data Collector - 実装ルール

このファイルは、TDnet Data Collectorプロジェクトの基本的な実装原則をまとめたものです。詳細な実装ガイドラインは各専門ファイルを参照してください。

## プロジェクト概要

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

### 主要な技術スタック

- **実行環境**: AWS Lambda (Node.js 20.x, TypeScript)
- **データベース**: Amazon DynamoDB
- **ストレージ**: Amazon S3
- **API**: Amazon API Gateway
- **IaC**: AWS CDK (TypeScript)
- **監視**: CloudWatch Logs & Metrics
- **セキュリティ**: AWS WAF, Secrets Manager, CloudTrail

## 実装原則

### 1. コスト最適化を最優先

AWS無料枠を最大限活用し、サーバーレスアーキテクチャを採用してコストを最小化します。

**詳細**: `../infrastructure/performance-optimization.md` を参照

### 2. エラーハンドリングの徹底

すべての外部API呼び出しに再試行ロジックを実装し、部分的な失敗を許容する設計を採用します。

**詳細**: `error-handling-patterns.md` および `../development/error-handling-implementation.md` を参照

### 3. レート制限とマナー

TDnetへのリクエスト間隔を適切に制御し、過度な負荷をかけないようにします。

**詳細**: `../development/tdnet-scraping-patterns.md` を参照

### 4. データ整合性の保証

重複チェックとデータ検証を徹底し、メタデータとファイルの対応関係を厳密に管理します。

**詳細**: `../development/data-validation.md` を参照

### 5. date_partition による効率的なクエリ

DynamoDBのクエリ効率を最大化するため、`date_partition`（YYYY-MM形式）を使用します。

**設計原則:**
- `date_partition`は`disclosed_at`から自動生成（YYYY-MM形式）
- GSI（Global Secondary Index）のパーティションキーとして使用
- 月単位のクエリを高速化
- 日付範囲クエリは複数の月を並行クエリ

**重要な考慮事項:**

1. **タイムゾーン処理**: JST（日本標準時）を基準とする
   - TDnetは日本の開示情報サービスのため、開示時刻はJST（UTC+9）で管理
   - `disclosed_at`はISO 8601形式（UTC）を推奨: `"2024-01-15T01:30:00Z"`
   - 内部処理でJSTに変換してから`date_partition`を生成

2. **エッジケース**: 月またぎ、うるう年、年またぎに注意
   - 例: UTC `2024-01-31T15:30:00Z` → JST `2024-02-01T00:30:00` → `date_partition: "2024-02"`

3. **バリデーション**: ISO 8601形式、有効な日付、範囲チェック（1970-01-01以降）

4. **エラーハンドリング**: バリデーションエラーは即座に失敗（Non-Retryable Error）

**詳細な実装、バリデーション、テストケースは `../development/data-validation.md` を参照。**

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

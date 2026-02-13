# TDnet Data Collector

TDnet Data Collectorは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から上場企業の開示情報を自動収集するAWSベースのサーバーレスシステムです。

## 📋 目次

- [概要](#概要)
- [主要機能](#主要機能)
- [技術スタック](#技術スタック)
- [プロジェクト構造](#プロジェクト構造)
- [セットアップ](#セットアップ)
- [開発](#開発)
- [テスト](#テスト)
- [デプロイ](#デプロイ)
- [ドキュメント](#ドキュメント)
- [アーキテクチャ](#アーキテクチャ)
- [ライセンス](#ライセンス)

---

## 概要

TDnet Data Collectorは、日本の上場企業が公開する適時開示情報を自動的に収集・保存するシステムです。サーバーレスアーキテクチャを採用し、AWS無料枠内で運用可能なコスト効率の高い設計となっています。

**実装状況**: Phase 1-4完了（基本機能、API実装、Webダッシュボード、運用改善）、Phase 5未完了（本番運用後の自動化強化）

### 主要機能

#### ✅ 実装済み（Phase 1-4）

- ✅ **データ収集**: 指定期間の開示情報を手動で収集（オンデマンド収集）
- ✅ **PDFダウンロード**: 開示資料（PDF）を自動ダウンロードしてS3に保存
- ✅ **メタデータ管理**: 開示情報のメタデータをDynamoDBに保存
- ✅ **エラーハンドリング**: 部分的失敗を許容し、再試行ロジックを実装
- ✅ **実行状態管理**: 収集処理の進捗をリアルタイムで追跡
- ✅ **監視とアラート**: CloudWatchによる監視とメトリクス送信
- ✅ **検索API**: 企業コード、日付範囲、開示種別による検索
- ✅ **エクスポートAPI**: JSON/CSV形式でのデータエクスポート
- ✅ **APIキー認証**: Secrets Manager経由の安全な認証
- ✅ **Webダッシュボード**: 収集状況の可視化（Phase 3）
- ✅ **CI/CDパイプライン**: GitHub Actionsによる自動テスト・デプロイ（Phase 4）
- ✅ **セキュリティ強化**: CloudTrail監査ログ、WAF保護（Phase 4）

#### ⚠️ 未実装（Phase 5）

- ⚠️ **自動収集**: 毎日午前9時（JST）の自動収集（EventBridge未設定）
- ⚠️ **SNS通知**: エラー発生時・バッチ完了時の通知（SNS未設定）

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **ランタイム** | Node.js 20.x |
| **言語** | TypeScript 5.x |
| **コンピューティング** | AWS Lambda |
| **データベース** | Amazon DynamoDB |
| **ストレージ** | Amazon S3 |
| **API** | Amazon API Gateway (Phase 2以降) |
| **IaC** | AWS CDK (TypeScript) |
| **監視** | CloudWatch Logs & Metrics |
| **テスト** | Jest, fast-check (Property-Based Testing) |
| **コード品質** | ESLint, Prettier |

---

## プロジェクト構造

```
tdnet-data-collector/
├── src/                          # アプリケーションコード
│   ├── lambda/                   # Lambda関数
│   │   └── collector/            # 開示情報収集Lambda
│   │       ├── handler.ts        # メインハンドラー
│   │       ├── scrape-tdnet-list.ts  # TDnetスクレイピング
│   │       ├── download-pdf.ts   # PDFダウンロード
│   │       ├── save-metadata.ts  # メタデータ保存
│   │       └── update-execution-status.ts  # 実行状態管理
│   ├── utils/                    # ユーティリティ
│   │   ├── logger.ts             # 構造化ロガー
│   │   ├── cloudwatch-metrics.ts # メトリクス送信
│   │   ├── retry.ts              # 再試行ロジック
│   │   └── disclosure-id.ts      # 開示ID生成
│   ├── scraper/                  # スクレイピング
│   │   └── html-parser.ts        # HTMLパーサー
│   ├── types/                    # 型定義
│   │   └── index.ts              # 共通型定義
│   └── errors/                   # カスタムエラー
│       └── index.ts              # エラークラス定義
├── cdk/                          # CDKインフラコード（Phase 2以降）
│   ├── bin/                      # CDKアプリエントリーポイント
│   └── lib/                      # CDKスタック定義
├── docs/                         # ドキュメント
│   ├── architecture/             # アーキテクチャドキュメント
│   │   └── lambda-collector.md  # Lambda Collectorアーキテクチャ
│   └── guides/                   # 実装ガイド
│       ├── lambda-error-logging.md  # Lambda エラーログガイド
│       └── batch-metrics.md      # バッチメトリクスガイド
├── .kiro/                        # Kiro設定とSpec
│   ├── specs/                    # 仕様書とタスク
│   │   └── tdnet-data-collector/
│   │       ├── docs/             # 要件・設計書
│   │       ├── tasks.md          # タスクリスト
│   │       ├── work-logs/        # 作業記録
│   │       └── improvements/     # 改善記録
│   └── steering/                 # 実装ガイドライン
│       ├── core/                 # 基本ルール
│       ├── development/          # 開発ガイドライン
│       ├── infrastructure/       # インフラ・デプロイ
│       ├── security/             # セキュリティ
│       └── api/                  # API設計
└── __tests__/                    # テストコード
    ├── unit/                     # ユニットテスト
    ├── integration/              # 統合テスト
    └── property/                 # プロパティベーステスト
```

---

## セットアップ

### 前提条件

- **Node.js**: 20.x以上
- **npm**: 10.x以上
- **AWS CLI**: 設定済み（`aws configure`）
- **AWS CDK CLI**: `npm install -g aws-cdk`（Phase 2以降）

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-org/tdnet-data-collector.git
cd tdnet-data-collector

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

### 環境変数の設定

`.env.example` をコピーして `.env` を作成し、必要な環境変数を設定します。

```bash
cp .env.example .env
```

**必須環境変数**:

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `S3_BUCKET_NAME` | PDFファイル保存先S3バケット名 | `tdnet-pdfs-prod` |
| `DYNAMODB_TABLE_NAME` | 開示情報メタデータテーブル名 | `tdnet-disclosures` |
| `DYNAMODB_EXECUTIONS_TABLE` | 実行状態管理テーブル名 | `tdnet-executions` |
| `LOG_LEVEL` | ログレベル | `info` / `debug` / `warn` / `error` |

詳細は [環境変数ガイド](.kiro/steering/infrastructure/environment-variables.md) を参照してください。

---

## 開発

### ビルド

```bash
# TypeScriptをコンパイル
npm run build

# ファイル変更を監視してコンパイル
npm run watch
```

### コード品質

```bash
# ESLintでコードチェック
npm run lint

# ESLintで自動修正
npm run lint:fix

# Prettierでフォーマット
npm run format

# フォーマットチェック
npm run format:check
```

---

## テスト

### テスト実行

```bash
# すべてのテストを実行
npm test

# テスト監視モード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

### テストの種類

| テストタイプ | 説明 | 実行コマンド |
|------------|------|------------|
| **ユニットテスト** | 個別の関数・クラスのテスト | `npm test -- unit` |
| **統合テスト** | コンポーネント間の連携テスト | `npm test -- integration` |
| **プロパティベーステスト** | ランダム入力による網羅的テスト | `npm test -- property` |

### テストカバレッジ目標

- **ユニットテスト**: 80%以上
- **統合テスト**: 主要フロー100%
- **プロパティベーステスト**: 重要な関数100%

詳細は [テスト戦略ガイド](.kiro/steering/development/testing-strategy.md) を参照してください。

---

## デプロイ

### CDK操作（Phase 2以降）

```bash
# CDK環境の初期化（初回のみ）
cdk bootstrap

# 変更差分を確認
npm run cdk:diff

# CloudFormationテンプレート生成
npm run cdk:synth

# AWSにデプロイ
npm run cdk:deploy

# スタック削除
npm run cdk:destroy
```

### デプロイ前チェックリスト

- [ ] すべてのテストが成功している
- [ ] コードレビューが完了している
- [ ] 環境変数が正しく設定されている
- [ ] IAMロールと権限が適切に設定されている
- [ ] CloudWatchアラームが設定されている

詳細は [デプロイチェックリスト](.kiro/steering/infrastructure/deployment-checklist.md) を参照してください。

---

## 使用方法

### Lambda関数の手動実行

#### AWS CLIでの実行

```bash
# Collector Lambda（開示情報収集）を手動実行
aws lambda invoke \
  --function-name tdnet-collector \
  --payload '{"date":"2024-01-15"}' \
  response.json

# 実行結果を確認
cat response.json
```

#### AWS Consoleでの実行

1. AWS Consoleにログイン
2. Lambda > 関数 > `tdnet-collector` を選択
3. 「テスト」タブをクリック
4. テストイベントを作成:
   ```json
   {
     "date": "2024-01-15"
   }
   ```
5. 「テスト」ボタンをクリック

### EventBridgeスケジューラーの確認

```bash
# スケジュールルールの確認
aws events list-rules --name-prefix tdnet

# スケジュールの詳細を確認
aws events describe-rule --name tdnet-daily-collector
```

### DynamoDBデータの確認

```bash
# 開示情報の一覧を取得（最新10件）
aws dynamodb scan \
  --table-name tdnet-disclosures \
  --limit 10 \
  --output table

# 特定の開示情報を取得
aws dynamodb get-item \
  --table-name tdnet-disclosures \
  --key '{"disclosure_id":{"S":"TD202401151234001"}}'
```

### S3バケットの確認

```bash
# PDFファイルの一覧を取得
aws s3 ls s3://tdnet-pdfs-prod/ --recursive

# 特定のPDFファイルをダウンロード
aws s3 cp s3://tdnet-pdfs-prod/2024/01/TD202401151234001.pdf ./
```

### API呼び出し例（Phase 2以降）

#### 検索API

```bash
# 日付範囲で検索
curl -X GET "https://api.example.com/disclosures?start_date=2024-01-01&end_date=2024-01-31"

# 企業コードで検索
curl -X GET "https://api.example.com/disclosures?company_code=7203"

# 開示種別で検索
curl -X GET "https://api.example.com/disclosures?disclosure_type=決算短信"
```

#### エクスポートAPI

```bash
# CSVエクスポート
curl -X POST "https://api.example.com/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }'

# JSONエクスポート
curl -X POST "https://api.example.com/export" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "json",
    "company_code": "7203"
  }'
```

---

## トラブルシューティング

### デプロイエラー

#### 1. CDK Bootstrap未実行

**エラーメッセージ:**
```
This stack uses assets, so the toolkit stack must be deployed to the environment
```

**解決方法:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

#### 2. IAM権限不足

**エラーメッセージ:**
```
User: arn:aws:iam::123456789012:user/username is not authorized to perform: cloudformation:CreateStack
```

**解決方法:**
- AWS管理者に以下の権限を依頼:
  - `CloudFormationFullAccess`
  - `IAMFullAccess`
  - `LambdaFullAccess`
  - `DynamoDBFullAccess`
  - `S3FullAccess`

#### 3. スタック削除エラー

**エラーメッセージ:**
```
The bucket you tried to delete is not empty
```

**解決方法:**
```bash
# S3バケットを空にする
aws s3 rm s3://tdnet-pdfs-prod/ --recursive

# スタックを削除
cdk destroy
```

### Lambda実行エラー

#### 1. 環境変数未設定

**エラーメッセージ:**
```
Environment variable S3_BUCKET_NAME is not set
```

**解決方法:**
- Lambda関数の環境変数を確認・設定:
  ```bash
  aws lambda update-function-configuration \
    --function-name tdnet-collector \
    --environment Variables={S3_BUCKET_NAME=tdnet-pdfs-prod,DYNAMODB_TABLE_NAME=tdnet-disclosures}
  ```

#### 2. タイムアウト

**エラーメッセージ:**
```
Task timed out after 15.00 seconds
```

**解決方法:**
- Lambda関数のタイムアウトを延長:
  ```bash
  aws lambda update-function-configuration \
    --function-name tdnet-collector \
    --timeout 900
  ```

#### 3. メモリ不足

**エラーメッセージ:**
```
Runtime exited with error: signal: killed
```

**解決方法:**
- Lambda関数のメモリを増やす:
  ```bash
  aws lambda update-function-configuration \
    --function-name tdnet-collector \
    --memory-size 1024
  ```

### DynamoDBエラー

#### 1. スロットリング

**エラーメッセージ:**
```
ProvisionedThroughputExceededException
```

**解決方法:**
- オンデマンド課金モードに変更（推奨）
- または、プロビジョニング済みキャパシティを増やす

#### 2. アクセス拒否

**エラーメッセージ:**
```
User is not authorized to perform: dynamodb:PutItem
```

**解決方法:**
- Lambda実行ロールにDynamoDB権限を追加:
  ```json
  {
    "Effect": "Allow",
    "Action": [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan"
    ],
    "Resource": "arn:aws:dynamodb:REGION:ACCOUNT-ID:table/tdnet-disclosures"
  }
  ```

### S3エラー

#### 1. バケット未作成

**エラーメッセージ:**
```
The specified bucket does not exist
```

**解決方法:**
```bash
# S3バケットを作成
aws s3 mb s3://tdnet-pdfs-prod --region ap-northeast-1
```

#### 2. アクセス拒否

**エラーメッセージ:**
```
Access Denied
```

**解決方法:**
- Lambda実行ロールにS3権限を追加:
  ```json
  {
    "Effect": "Allow",
    "Action": [
      "s3:PutObject",
      "s3:GetObject"
    ],
    "Resource": "arn:aws:s3:::tdnet-pdfs-prod/*"
  }
  ```

### スクレイピングエラー

#### 1. TDnetサイト変更

**エラーメッセージ:**
```
Failed to parse HTML: selector not found
```

**解決方法:**
1. TDnetサイトのHTML構造を確認
2. `src/scraper/html-parser.ts` のセレクタを更新
3. テストを実行して動作確認

#### 2. ネットワークエラー

**エラーメッセージ:**
```
ECONNRESET: Connection reset by peer
```

**解決方法:**
- 再試行ロジックが自動的に実行されます（最大3回）
- それでも失敗する場合は、TDnetサイトの状態を確認

#### 3. レート制限

**エラーメッセージ:**
```
Too many requests
```

**解決方法:**
- レート制限設定を確認（デフォルト: 1リクエスト/秒）
- 必要に応じて `src/utils/rate-limiter.ts` の設定を調整

### ログの確認方法

```bash
# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector --follow

# 特定の期間のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --end-time $(date +%s)000
```

---

## コスト情報

### 月間コスト見積もり

詳細なコスト見積もりは [コスト見積もりドキュメント](docs/cost-estimation.md) を参照してください。

**概算（AWS無料枠適用後）:**
- **開発環境**: 約$0.02/月
- **本番環境**: 約$11.12/月

**主なコスト要因:**
1. AWS WAF: $8.00/月（72%）
2. CloudWatch カスタムメトリクス: $2.70/月（24%）
3. Secrets Manager: $0.40/月（4%）

### AWS無料枠の活用

以下のサービスでAWS無料枠を活用しています:

| サービス | 無料枠 | 使用量 |
|---------|--------|--------|
| Lambda | 100万リクエスト/月 | 約11,000リクエスト/月 |
| DynamoDB | 25GB、25 RCU、25 WCU | 約50MB、2,700 WRU、110,000 RRU |
| S3 | 5GB（12ヶ月間） | 約12GB |
| API Gateway | 100万APIコール/月（12ヶ月間） | 約11,600コール/月 |
| CloudWatch | 10メトリクス、10アラーム | 19メトリクス、10アラーム |

### コスト最適化のヒント

1. **WAFの最適化**
   - 開発環境ではWAFを無効化（$8.00削減）
   - レート制限をAPI Gatewayのスロットリング機能で代替

2. **CloudWatchメトリクスの削減**
   - 重要なメトリクスのみに絞る（10個以内で$2.70削減）
   - Lambda Insightsを活用

3. **Secrets Managerの代替**
   - Systems Manager Parameter Storeに移行（$0.40削減）

4. **S3ライフサイクルポリシー**
   - 90日後にStandard-IAに移行
   - 365日後にGlacierに移行

詳細は [パフォーマンス最適化ガイド](.kiro/steering/infrastructure/performance-optimization.md) を参照してください。

---

## CI/CD

### GitHub Actionsワークフロー

プロジェクトでは以下のGitHub Actionsワークフローを使用しています:

#### 1. Test Workflow (`.github/workflows/test.yml`)

**トリガー**: プルリクエスト、mainブランチへのプッシュ

**実行内容:**
- Lint（ESLint）
- 型チェック（TypeScript）
- ユニットテスト
- プロパティベーステスト
- カバレッジレポート生成（80%以上必須）
- セキュリティ監査（npm audit）

#### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

**トリガー**: mainブランチへのマージ

**実行内容:**
- CDK Diff実行
- CDK Deploy実行
- スモークテスト実行
- Slack通知

#### 3. Dependency Update Workflow (`.github/workflows/dependency-update.yml`)

**トリガー**: 毎週月曜日午前9時（JST）

**実行内容:**
- 依存関係の更新（npm update）
- セキュリティ監査（npm audit）
- テスト実行
- プルリクエスト作成

### テストカバレッジ要件

すべてのコードメトリクスで**80%以上**のカバレッジを維持する必要があります:

- **Statements**: 80%以上
- **Branches**: 80%以上
- **Functions**: 80%以上
- **Lines**: 80%以上

カバレッジが80%未満の場合、CI/CDパイプラインは失敗します。

詳細は [CI/CDパイプラインドキュメント](docs/ci-cd-pipeline.md) を参照してください。

---

## ドキュメント

### 仕様書

- [要件定義書](.kiro/specs/tdnet-data-collector/docs/requirements.md) - システム要件と機能仕様
- [設計書](.kiro/specs/tdnet-data-collector/docs/design.md) - アーキテクチャと設計判断
- [タスクリスト](.kiro/specs/tdnet-data-collector/tasks.md) - 開発タスクと進捗

### アーキテクチャドキュメント

- [Lambda Collector アーキテクチャ](docs/architecture/lambda-collector.md) - データフロー、コンポーネント構成、エラーハンドリング

### 実装ガイド

- [Lambda エラーログガイド](docs/guides/lambda-error-logging.md) - `logLambdaError()` の使用方法
- [バッチメトリクスガイド](docs/guides/batch-metrics.md) - `sendBatchResultMetrics()` の使用方法

### Steeringファイル（実装ガイドライン）

#### 基本ルール（常時読み込み）

- [実装ルール](.kiro/steering/core/tdnet-implementation-rules.md) - 基本的な実装原則
- [エラーハンドリングパターン](.kiro/steering/core/error-handling-patterns.md) - エラー分類と基本原則
- [タスク実行ルール](.kiro/steering/core/tdnet-data-collector.md) - タスク実行とフィードバックループ

#### 開発ガイドライン

- [テスト戦略](.kiro/steering/development/testing-strategy.md) - ユニット、統合、プロパティテスト
- [データバリデーション](.kiro/steering/development/data-validation.md) - バリデーションルール
- [TDnetスクレイピングパターン](.kiro/steering/development/tdnet-scraping-patterns.md) - スクレイピングのベストプラクティス
- [エラーハンドリング実装](.kiro/steering/development/error-handling-implementation.md) - 詳細な実装パターン
- [Lambda実装ガイド](.kiro/steering/development/lambda-implementation.md) - Lambda関数の実装ガイドライン

#### インフラ・デプロイ

- [デプロイチェックリスト](.kiro/steering/infrastructure/deployment-checklist.md) - デプロイ前後のチェックリスト
- [環境変数](.kiro/steering/infrastructure/environment-variables.md) - 環境変数の定義と管理方法
- [パフォーマンス最適化](.kiro/steering/infrastructure/performance-optimization.md) - コスト削減とパフォーマンス
- [監視とアラート](.kiro/steering/infrastructure/monitoring-alerts.md) - CloudWatch設定

#### セキュリティ

- [セキュリティベストプラクティス](.kiro/steering/security/security-best-practices.md) - IAM、暗号化、監査

#### API設計（Phase 2以降）

- [API設計ガイドライン](.kiro/steering/api/api-design-guidelines.md) - RESTful API設計
- [エラーコード](.kiro/steering/api/error-codes.md) - APIエラーコード標準

---

## アーキテクチャ

### システム概要図

```
┌─────────────────────────────────────────────────────────────────┐
│                     EventBridge (Scheduler)                      │
│                  毎日午前9時（JST）にトリガー                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Lambda Collector                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. TDnetから開示情報リストを取得（スクレイピング）        │   │
│  │  2. 各開示情報を並列処理（並列度5）                       │   │
│  │     ├─→ PDFをダウンロード → S3に保存                    │   │
│  │     └─→ メタデータをDynamoDBに保存                      │   │
│  │  3. 実行状態を更新（進捗率、成功/失敗件数）               │   │
│  │  4. メトリクスをCloudWatchに送信                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ↓                    ↓                    ↓
    ┌────────┐          ┌─────────┐         ┌──────────┐
    │ TDnet  │          │   S3    │         │ DynamoDB │
    │  Web   │          │ Bucket  │         │  Tables  │
    └────────┘          └─────────┘         └──────────┘
```

### データモデル

#### DynamoDB: Disclosures テーブル

| 属性名 | 型 | 説明 |
|--------|---|------|
| `disclosure_id` (PK) | String | 開示ID（例: TD202401151234001） |
| `company_code` | String | 企業コード（4桁） |
| `company_name` | String | 企業名 |
| `disclosure_type` | String | 開示種別 |
| `title` | String | 開示タイトル |
| `disclosed_at` | String | 開示日時（ISO 8601形式） |
| `date_partition` (GSI PK) | String | 日付パーティション（YYYY-MM形式、JST基準） |
| `pdf_url` | String | PDF URL |
| `s3_key` | String | S3キー |
| `collected_at` | String | 収集日時（ISO 8601形式） |

#### DynamoDB: Executions テーブル

| 属性名 | 型 | 説明 |
|--------|---|------|
| `execution_id` (PK) | String | 実行ID |
| `status` | String | ステータス（pending/running/completed/failed） |
| `progress` | Number | 進捗率（0-100） |
| `collected_count` | Number | 収集成功件数 |
| `failed_count` | Number | 収集失敗件数 |
| `started_at` | String | 開始日時 |
| `updated_at` | String | 更新日時 |
| `completed_at` | String | 完了日時（completed/failedの場合のみ） |
| `ttl` | Number | TTL（30日後に自動削除） |

詳細は [Lambda Collector アーキテクチャ](docs/architecture/lambda-collector.md) を参照してください。

---

## リスク管理

### 技術的リスクと対策

#### 1. TDnetのHTML構造変更リスク

**リスク**: TDnetのWebサイトがリニューアルされ、HTML構造が変更される可能性があります。

**影響**:
- スクレイピングロジックが動作しなくなる
- データ収集が停止する
- 開示情報の取得漏れが発生する

**対策**:
- **柔軟なセレクタ設計**: 複数のセレクタパターンを用意し、フォールバック機能を実装
- **構造化ログ**: HTML解析エラーを詳細にログ記録し、早期検知
- **監視とアラート**: 
  - スクレイピング成功率を監視（95%未満でアラート）
  - 連続失敗時にSNS通知（Phase 5で実装予定）
- **定期的な動作確認**: 週次でスクレイピングロジックの動作確認
- **バージョン管理**: HTML構造の変更履歴を記録し、迅速な対応を可能にする

**実装箇所**:
- `src/scraper/html-parser.ts` - 柔軟なセレクタ設計
- `src/utils/logger.ts` - 構造化ログ
- `.kiro/steering/development/tdnet-scraping-patterns.md` - スクレイピングパターンガイド

#### 2. AWS Lambda実行時間制限リスク

**リスク**: Lambda関数の最大実行時間（15分）を超える可能性があります。

**影響**:
- 大量の開示情報がある日（決算発表日など）に処理が完了しない
- 部分的なデータ収集のみで処理が中断される

**対策**:
- **適切なタイムアウト設定**: 
  - Collector Lambda: 15分（最大値）
  - PDF Download: 5分
  - Metadata Save: 3分
- **バッチ処理の分割**: 
  - 100件ごとにバッチを分割
  - 並列度を5に制限してタイムアウトを回避
- **部分的失敗の許容**: 
  - 成功した分はコミット
  - 失敗した分はDLQに送信して後で再処理
- **実行状態の追跡**: 
  - DynamoDB Executionsテーブルで進捗を記録
  - 中断された処理を再開可能にする
- **CloudWatchアラーム**: 
  - タイムアウト発生時にアラート
  - 実行時間が10分を超えた場合に警告

**実装箇所**:
- `src/lambda/collector/handler.ts` - バッチ処理とタイムアウト管理
- `src/lambda/collector/update-execution-status.ts` - 実行状態追跡
- `cdk/lib/constructs/lambda-construct.ts` - タイムアウト設定
- `.kiro/steering/development/lambda-implementation.md` - Lambda実装ガイド

#### 3. DynamoDBスロットリングリスク

**リスク**: 大量の書き込みリクエストによりDynamoDBがスロットリングされる可能性があります。

**影響**:
- データ保存の失敗
- Lambda関数の実行時間増加
- コストの増加（再試行による追加リクエスト）

**対策**:
- **オンデマンド課金モード**: 
  - トラフィックの急増に自動対応
  - プロビジョニング不要で運用が簡単
- **指数バックオフ再試行**: 
  - AWS SDKのデフォルト再試行ロジックを使用
  - 最大3回まで再試行
  - 再試行間隔: 2秒 → 4秒 → 8秒
- **バッチ書き込みの最適化**: 
  - `batchWriteItem` を使用して効率化
  - 25件ごとにバッチ化（DynamoDBの制限）
- **書き込みキャパシティの監視**: 
  - CloudWatchメトリクスで監視
  - スロットリング発生時にアラート
- **TTL設定**: 
  - 古いデータを自動削除してストレージコストを削減
  - Executionsテーブル: 30日後に削除

**実装箇所**:
- `src/lambda/collector/save-metadata.ts` - バッチ書き込み
- `src/utils/retry.ts` - 再試行ロジック
- `cdk/lib/constructs/dynamodb-construct.ts` - オンデマンドモード設定
- `.kiro/steering/infrastructure/performance-optimization.md` - パフォーマンス最適化ガイド

### 外部依存リスク

#### TDnet Webサイトの可用性

**リスク**: TDnetのWebサイトがダウンまたはメンテナンス中になる可能性があります。

**監視方法**:
- **CloudWatch Synthetics Canary**: 
  - 5分ごとにTDnetメインページをチェック
  - 15分ごとに開示情報一覧ページをチェック
  - 可用性が95%未満でアラート
- **Lambda関数内でのメトリクス記録**: 
  - リクエスト成功率を記録
  - レスポンス時間を記録
  - エラータイプ別に集計
- **CloudWatchダッシュボード**: 
  - TDnet可用性の可視化
  - レスポンス時間のトレンド分析
  - エラー率の監視

**対応フロー**:
1. **アラート受信**: SNS経由でメール通知
2. **状況確認**: CloudWatch Logsでエラーログを確認
3. **対応策の実施**: 
   - TDnetが完全にダウン → 収集処理を一時停止、復旧を待つ
   - 部分的な障害 → 再試行ロジックが自動対応
   - HTML構造変更 → スクレイピングロジックの修正
4. **事後対応**: インシデントレポート作成、再発防止策の検討

**詳細ドキュメント**:
- [外部依存監視ガイド](docs/external-dependency-monitoring.md) - 監視設定と対応フロー
- [TDnetスクレイピングパターン](.kiro/steering/development/tdnet-scraping-patterns.md) - スクレイピングのベストプラクティス

### コスト管理

#### AWS無料枠超過リスク

**リスク**: 想定以上の使用量により、AWS無料枠を超過してコストが発生する可能性があります。

**対策**:
- **AWS Budgets設定**: 
  - 月次予算: $5.00（開発環境）、$10.00（本番環境）
  - アラート閾値: 50%、80%、100%
  - SNS通知による早期警告
- **コスト監視**: 
  - Cost Explorerで日次コストを確認
  - サービス別コストの可視化
  - 異常なコスト増加の早期検知
- **コスト最適化**: 
  - Lambda: メモリサイズの最適化、不要なログの削減
  - DynamoDB: TTL設定、オンデマンドモード
  - S3: ライフサイクルポリシー、Intelligent-Tiering
  - CloudWatch: ログ保持期間の設定（30日）

**詳細ドキュメント**:
- [AWS Budgets設定手順書](docs/aws-budgets-setup.md) - 予算設定とアラート
- [コスト監視ガイド](docs/cost-monitoring.md) - コスト監視と最適化

### セキュリティリスク

#### 1. 認証情報の漏洩リスク

**対策**:
- Secrets Managerでの安全な管理
- IAMロールの最小権限原則
- CloudTrailによる監査ログ記録

#### 2. 不正アクセスリスク

**対策**:
- AWS WAFによる保護（Phase 4で実装済み）
- API Gatewayのスロットリング
- CloudWatch Logsでのアクセスログ記録

**詳細ドキュメント**:
- [セキュリティベストプラクティス](.kiro/steering/security/security-best-practices.md) - セキュリティガイド

---

## ライセンス

MIT License

Copyright (c) 2024 TDnet Data Collector Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

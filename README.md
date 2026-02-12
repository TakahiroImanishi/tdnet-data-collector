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

### 主要機能

- ✅ **自動収集**: 毎日午前9時（JST）に前日の開示情報を自動収集
- ✅ **オンデマンド収集**: 指定期間の開示情報を手動で収集
- ✅ **PDFダウンロード**: 開示資料（PDF）を自動ダウンロードしてS3に保存
- ✅ **メタデータ管理**: 開示情報のメタデータをDynamoDBに保存
- ✅ **エラーハンドリング**: 部分的失敗を許容し、再試行ロジックを実装
- ✅ **実行状態管理**: 収集処理の進捗をリアルタイムで追跡
- ✅ **監視とアラート**: CloudWatchによる監視とメトリクス送信

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

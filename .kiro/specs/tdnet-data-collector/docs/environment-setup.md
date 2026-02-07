# 環境設定ガイド

このドキュメントは、TDnet Data Collectorプロジェクトの開発環境と本番環境の設定方法をまとめたものです。

**最終更新:** 2026-02-07

---

## 関連ドキュメント

- **要件定義書**: `requirements.md` - 機能要件と非機能要件
- **設計書**: `design.md` - システムアーキテクチャと詳細設計
- **実装チェックリスト**: `implementation-checklist.md` - 実装前の確認項目
- **環境変数管理**: `../../steering/infrastructure/environment-variables.md` - 環境変数一覧と管理方法
- **デプロイチェックリスト**: `../../steering/infrastructure/deployment-checklist.md` - デプロイ前後の確認項目
- **テンプレート使用ガイド**: `../templates/README.md` - テンプレートファイルの使用方法

---

## 環境一覧

| 環境 | 用途 | AWSアカウント | リージョン | デプロイ方法 |
|------|------|--------------|-----------|------------|
| **local** | ローカル開発 | LocalStack | - | 手動 |
| **dev** | 開発環境 | 開発用アカウント | ap-northeast-1 | GitHub Actions（developブランチ） |
| **prod** | 本番環境 | 本番用アカウント | ap-northeast-1 | GitHub Actions（mainブランチ） |

---

## 環境変数一覧

### Lambda関数共通

| 変数名 | 説明 | local | dev | prod | 必須 |
|--------|------|-------|-----|------|------|
| `NODE_ENV` | 実行環境 | `development` | `development` | `production` | ✅ |
| `LOG_LEVEL` | ログレベル | `DEBUG` | `INFO` | `INFO` | ✅ |
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` | `ap-northeast-1` | `ap-northeast-1` | ✅ |

### Lambda Collector

| 変数名 | 説明 | local | dev | prod | 必須 |
|--------|------|-------|-----|------|------|
| `S3_BUCKET_NAME` | PDFファイル用S3バケット名 | `tdnet-pdfs-local` | `tdnet-pdfs-dev` | `tdnet-pdfs-prod` | ✅ |
| `DYNAMODB_TABLE_NAME` | 開示情報テーブル名 | `tdnet_disclosures_local` | `tdnet_disclosures_dev` | `tdnet_disclosures_prod` | ✅ |
| `EXECUTION_TABLE_NAME` | 実行状態テーブル名 | `tdnet_executions_local` | `tdnet_executions_dev` | `tdnet_executions_prod` | ✅ |
| `SCRAPING_RATE_LIMIT` | TDnetリクエスト間隔（ミリ秒） | `1000` | `2000` | `2000` | ✅ |
| `SCRAPING_TIMEOUT` | スクレイピングタイムアウト（ミリ秒） | `30000` | `30000` | `30000` | ✅ |
| `PDF_DOWNLOAD_TIMEOUT` | PDFダウンロードタイムアウト（ミリ秒） | `60000` | `60000` | `60000` | ✅ |
| `MAX_RETRIES` | 最大再試行回数 | `3` | `3` | `3` | ✅ |
| `SNS_TOPIC_ARN` | 通知用SNS Topic ARN | - | `arn:aws:sns:...` | `arn:aws:sns:...` | ❌ |

### Lambda Query

| 変数名 | 説明 | local | dev | prod | 必須 |
|--------|------|-------|-----|------|------|
| `DYNAMODB_TABLE_NAME` | 開示情報テーブル名 | `tdnet_disclosures_local` | `tdnet_disclosures_dev` | `tdnet_disclosures_prod` | ✅ |
| `API_KEY` | APIキー | `dev-api-key-12345` | Secrets Manager | Secrets Manager | ✅ |
| `CORS_ALLOWED_ORIGINS` | CORS許可オリジン | `*` | `https://dev.example.com` | `https://example.com` | ✅ |

### Lambda Export

| 変数名 | 説明 | local | dev | prod | 必須 |
|--------|------|-------|-----|------|------|
| `DYNAMODB_TABLE_NAME` | 開示情報テーブル名 | `tdnet_disclosures_local` | `tdnet_disclosures_dev` | `tdnet_disclosures_prod` | ✅ |
| `EXPORT_BUCKET_NAME` | エクスポートファイル用S3バケット名 | `tdnet-exports-local` | `tdnet-exports-dev` | `tdnet-exports-prod` | ✅ |
| `EXPORT_EXPIRATION_HOURS` | エクスポートファイル有効期限（時間） | `24` | `24` | `24` | ✅ |

---

## AWS設定

### S3バケット

#### PDFファイル用バケット

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| バケット名 | `tdnet-pdfs-local` | `tdnet-pdfs-dev` | `tdnet-pdfs-prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| バージョニング | 無効 | 無効 | 無効 |
| 暗号化 | - | SSE-S3 (AES256) | SSE-S3 (AES256) |
| パブリックアクセス | ブロック | ブロック | ブロック |
| ライフサイクルポリシー | なし | 90日後にIA、180日後にGlacier | 90日後にIA、180日後にGlacier |

#### エクスポートファイル用バケット

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| バケット名 | `tdnet-exports-local` | `tdnet-exports-dev` | `tdnet-exports-prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| バージョニング | 無効 | 無効 | 無効 |
| 暗号化 | - | SSE-S3 (AES256) | SSE-S3 (AES256) |
| パブリックアクセス | ブロック | ブロック | ブロック |
| ライフサイクルポリシー | なし | 1日後に削除 | 1日後に削除 |

#### Webダッシュボード用バケット

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| バケット名 | - | `tdnet-dashboard-dev` | `tdnet-dashboard-prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| バージョニング | - | 無効 | 無効 |
| 暗号化 | - | SSE-S3 (AES256) | SSE-S3 (AES256) |
| パブリックアクセス | - | CloudFront経由のみ | CloudFront経由のみ |
| 静的Webホスティング | - | 有効 | 有効 |

#### CloudTrailログ用バケット

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| バケット名 | - | `tdnet-cloudtrail-dev` | `tdnet-cloudtrail-prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| バージョニング | - | 無効 | 無効 |
| 暗号化 | - | SSE-S3 (AES256) | SSE-S3 (AES256) |
| パブリックアクセス | - | ブロック | ブロック |
| ライフサイクルポリシー | - | 90日後に削除 | 90日後に削除 |

### DynamoDB

#### 開示情報テーブル（tdnet_disclosures）

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| テーブル名 | `tdnet_disclosures_local` | `tdnet_disclosures_dev` | `tdnet_disclosures_prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| 課金モード | - | オンデマンド | オンデマンド |
| 暗号化 | - | AWS管理キー | AWS管理キー |
| PITR | - | 無効 | 無効 |
| ストリーム | - | 無効 | 無効 |

#### 実行状態テーブル（tdnet_executions）

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| テーブル名 | `tdnet_executions_local` | `tdnet_executions_dev` | `tdnet_executions_prod` |
| リージョン | - | `ap-northeast-1` | `ap-northeast-1` |
| 課金モード | - | オンデマンド | オンデマンド |
| 暗号化 | - | AWS管理キー | AWS管理キー |
| PITR | - | 無効 | 無効 |
| ストリーム | - | 無効 | 無効 |
| TTL | - | 有効（30日） | 有効（30日） |

### Lambda関数

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| ランタイム | Node.js 20.x | Node.js 20.x | Node.js 20.x |
| アーキテクチャ | - | arm64 | arm64 |
| Collector メモリ | - | 512MB | 512MB |
| Collector タイムアウト | - | 15分 | 15分 |
| Query メモリ | - | 256MB | 256MB |
| Query タイムアウト | - | 30秒 | 30秒 |
| Export メモリ | - | 512MB | 512MB |
| Export タイムアウト | - | 5分 | 5分 |
| 予約済み同時実行数 | - | なし | なし |
| X-Rayトレーシング | - | 有効 | 有効 |

### API Gateway

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| API名 | - | `tdnet-api-dev` | `tdnet-api-prod` |
| プロトコル | - | REST | REST |
| エンドポイントタイプ | - | Regional | Regional |
| ステージ名 | - | `v1` | `v1` |
| 認証 | - | APIキー | APIキー |
| WAF | - | 有効 | 有効 |
| CloudWatch Logs | - | 有効（INFO） | 有効（ERROR） |
| X-Rayトレーシング | - | 有効 | 有効 |

### EventBridge

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| ルール名 | - | `tdnet-daily-collection-dev` | `tdnet-daily-collection-prod` |
| スケジュール | - | `cron(0 6 * * ? *)` | `cron(0 6 * * ? *)` |
| ターゲット | - | Lambda Collector | Lambda Collector |
| 有効/無効 | - | 有効 | 有効 |

### SNS

| 設定項目 | local | dev | prod |
|---------|-------|-----|------|
| Topic名 | - | `tdnet-alerts-dev` | `tdnet-alerts-prod` |
| プロトコル | - | Email | Email |
| サブスクリプション | - | 開発者メール | 運用者メール |

### CloudWatch

#### ログ保持期間

| ロググループ | local | dev | prod |
|------------|-------|-----|------|
| `/aws/lambda/collector` | - | 7日 | 30日 |
| `/aws/lambda/query` | - | 7日 | 30日 |
| `/aws/lambda/export` | - | 7日 | 30日 |
| `/aws/apigateway/tdnet-api` | - | 7日 | 30日 |

#### アラーム

| アラーム名 | メトリクス | 閾値 | dev | prod |
|-----------|----------|------|-----|------|
| `collector-errors` | Lambda Errors | > 5 (5分間) | 有効 | 有効 |
| `collector-duration` | Lambda Duration | > 13分 | 有効 | 有効 |
| `api-5xx-errors` | API Gateway 5XXError | > 10 (5分間) | 有効 | 有効 |
| `dynamodb-throttles` | DynamoDB ThrottledRequests | > 0 | 有効 | 有効 |

---

## 環境構築手順

### ローカル環境（LocalStack）

#### 1. LocalStackのインストール

```bash
# Dockerを使用
docker pull localstack/localstack

# または、pipを使用
pip install localstack
```

#### 2. LocalStackの起動

```bash
# docker-compose.ymlを作成
cat > docker-compose.yml <<EOF
version: '3.8'
services:
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      - SERVICES=s3,dynamodb,lambda,apigateway
      - DEBUG=1
    volumes:
      - "./localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
EOF

# 起動
docker-compose up -d
```

#### 3. AWS CLIの設定

```bash
# ~/.aws/config
[profile localstack]
region = ap-northeast-1
output = json

# ~/.aws/credentials
[localstack]
aws_access_key_id = test
aws_secret_access_key = test
```

#### 4. ローカルリソースの作成

```bash
# S3バケット作成
aws --endpoint-url=http://localhost:4566 --profile localstack \
  s3 mb s3://tdnet-pdfs-local

aws --endpoint-url=http://localhost:4566 --profile localstack \
  s3 mb s3://tdnet-exports-local

# DynamoDBテーブル作成
aws --endpoint-url=http://localhost:4566 --profile localstack \
  dynamodb create-table \
  --table-name tdnet_disclosures_local \
  --attribute-definitions \
    AttributeName=disclosure_id,AttributeType=S \
  --key-schema \
    AttributeName=disclosure_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

#### 5. 環境変数の設定

```bash
# .env.local
NODE_ENV=development
LOG_LEVEL=DEBUG
AWS_REGION=ap-northeast-1
AWS_ENDPOINT=http://localhost:4566
S3_BUCKET_NAME=tdnet-pdfs-local
DYNAMODB_TABLE_NAME=tdnet_disclosures_local
EXECUTION_TABLE_NAME=tdnet_executions_local
SCRAPING_RATE_LIMIT=1000
API_KEY=dev-api-key-12345
```

### 開発環境（AWS）

#### 1. AWSアカウントの準備

- 開発用AWSアカウントを作成
- IAMユーザーまたはIAMロールを作成
- 必要な権限を付与（AdministratorAccess推奨）

#### 2. AWS CLIの設定

```bash
# ~/.aws/config
[profile tdnet-dev]
region = ap-northeast-1
output = json

# ~/.aws/credentials
[tdnet-dev]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

#### 3. CDKのブートストラップ

```bash
# CDKブートストラップ
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1 --profile tdnet-dev
```

#### 4. Secrets Managerの設定

```bash
# APIキーの保存
aws secretsmanager create-secret \
  --name /tdnet/dev/api-key \
  --secret-string "your-dev-api-key" \
  --profile tdnet-dev
```

#### 5. デプロイ

```bash
# 環境変数の設定
export AWS_PROFILE=tdnet-dev
export ENVIRONMENT=dev

# CDKデプロイ
npx cdk deploy --all
```

### 本番環境（AWS）

#### 1. AWSアカウントの準備

- 本番用AWSアカウントを作成（開発用とは別）
- IAMユーザーまたはIAMロールを作成
- 必要な権限を付与

#### 2. AWS CLIの設定

```bash
# ~/.aws/config
[profile tdnet-prod]
region = ap-northeast-1
output = json

# ~/.aws/credentials
[tdnet-prod]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

#### 3. CDKのブートストラップ

```bash
# CDKブートストラップ
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1 --profile tdnet-prod
```

#### 4. Secrets Managerの設定

```bash
# APIキーの保存
aws secretsmanager create-secret \
  --name /tdnet/prod/api-key \
  --secret-string "your-prod-api-key" \
  --profile tdnet-prod
```

#### 5. デプロイ

```bash
# 環境変数の設定
export AWS_PROFILE=tdnet-prod
export ENVIRONMENT=prod

# CDKデプロイ
npx cdk deploy --all
```

---

## GitHub Secrets設定

### 開発環境用

| Secret名 | 説明 | 値の例 |
|---------|------|--------|
| `AWS_ROLE_ARN_DEV` | 開発環境用IAMロールARN | `arn:aws:iam::123456789012:role/github-actions-dev` |
| `API_ENDPOINT_DEV` | 開発環境APIエンドポイント | `https://api-dev.example.com` |
| `API_KEY_DEV` | 開発環境APIキー | `dev-api-key-12345` |

### 本番環境用

| Secret名 | 説明 | 値の例 |
|---------|------|--------|
| `AWS_ROLE_ARN_PROD` | 本番環境用IAMロールARN | `arn:aws:iam::987654321098:role/github-actions-prod` |
| `API_ENDPOINT_PROD` | 本番環境APIエンドポイント | `https://api.example.com` |
| `API_KEY_PROD` | 本番環境APIキー | `prod-api-key-67890` |

### 共通

| Secret名 | 説明 | 値の例 |
|---------|------|--------|
| `SLACK_WEBHOOK` | Slack Webhook URL（オプション） | `https://hooks.slack.com/services/...` |

---

## 環境変数テンプレート

### .env.example

```bash
# 実行環境
NODE_ENV=development

# ログレベル（DEBUG, INFO, WARN, ERROR）
LOG_LEVEL=INFO

# AWSリージョン
AWS_REGION=ap-northeast-1

# S3バケット名
S3_BUCKET_NAME=tdnet-pdfs-dev
EXPORT_BUCKET_NAME=tdnet-exports-dev

# DynamoDBテーブル名
DYNAMODB_TABLE_NAME=tdnet_disclosures_dev
EXECUTION_TABLE_NAME=tdnet_executions_dev

# スクレイピング設定
SCRAPING_RATE_LIMIT=2000
SCRAPING_TIMEOUT=30000
PDF_DOWNLOAD_TIMEOUT=60000
MAX_RETRIES=3

# API設定
API_KEY=your-api-key-here
CORS_ALLOWED_ORIGINS=https://example.com

# エクスポート設定
EXPORT_EXPIRATION_HOURS=24

# 通知設定（オプション）
SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts
```

---

## トラブルシューティング

### LocalStackでS3バケットが作成できない

**症状:**
```
An error occurred (BucketAlreadyExists) when calling the CreateBucket operation
```

**解決方法:**
```bash
# 既存のバケットを削除
aws --endpoint-url=http://localhost:4566 --profile localstack \
  s3 rb s3://tdnet-pdfs-local --force

# 再作成
aws --endpoint-url=http://localhost:4566 --profile localstack \
  s3 mb s3://tdnet-pdfs-local
```

### CDKデプロイが失敗する

**症状:**
```
Error: Need to perform AWS calls for account 123456789012, but no credentials found
```

**解決方法:**
```bash
# AWS CLIの設定を確認
aws configure list --profile tdnet-dev

# 環境変数を設定
export AWS_PROFILE=tdnet-dev

# 再度デプロイ
npx cdk deploy
```

### Lambda関数が環境変数を読み込めない

**症状:**
```
Error: S3_BUCKET_NAME is required
```

**解決方法:**
```typescript
// CDKで環境変数を設定
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
  // ...
  environment: {
    S3_BUCKET_NAME: pdfBucket.bucketName,
    DYNAMODB_TABLE_NAME: table.tableName,
  },
});
```

---

## 関連ドキュメント

- **設計書**: `design.md`
- **実装チェックリスト**: `implementation-checklist.md`
- **デプロイチェックリスト**: `../../steering/infrastructure/deployment-checklist.md`
- **環境変数一覧**: `../../steering/infrastructure/environment-variables.md`

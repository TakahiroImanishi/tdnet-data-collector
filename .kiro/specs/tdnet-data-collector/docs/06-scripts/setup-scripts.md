# Setup Scripts

初回環境構築時に使用するセットアップスクリプトの詳細ガイド。

## 実行順序

```
1. create-api-key-secret.ps1    → Secrets ManagerにAPIキー作成
2. generate-env-file.ps1        → 環境変数ファイル生成
3. localstack-setup.ps1         → LocalStack環境構築（E2Eテスト用）
```

## create-api-key-secret.ps1

AWS Secrets Managerに`/tdnet/api-key`シークレットを作成します。

### 使用方法

```powershell
# 基本的な使用方法（ランダムAPIキー生成）
.\scripts\create-api-key-secret.ps1

# リージョン指定
.\scripts\create-api-key-secret.ps1 -Region ap-northeast-1

# カスタムAPIキー指定
.\scripts\create-api-key-secret.ps1 -ApiKey "your-custom-api-key-here"

# 既存シークレット更新
.\scripts\create-api-key-secret.ps1 -Force

# すべてのオプション指定
.\scripts\create-api-key-secret.ps1 `
    -Region ap-northeast-1 `
    -SecretName /tdnet/api-key `
    -ApiKey "your-custom-api-key" `
    -Force
```

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Region` | No | ap-northeast-1 | AWSリージョン |
| `-SecretName` | No | /tdnet/api-key | シークレット名 |
| `-ApiKey` | No | (自動生成) | APIキー（32文字の英数字） |
| `-Force` | No | false | 既存シークレット上書き |

### 実行フロー

1. **前提条件チェック**
   - AWS CLIインストール確認
   - AWS認証情報確認

2. **APIキー生成/取得**
   - `-ApiKey`未指定の場合、32文字のランダム英数字を生成
   - 指定された場合、そのまま使用

3. **既存シークレット確認**
   - シークレットが存在する場合:
     - `-Force`指定時: 更新
     - `-Force`未指定時: エラー終了

4. **シークレット作成/更新**
   - 新規作成または既存シークレット更新

### 出力例

```
========================================
TDnet API Key Secret Creation
========================================

✅ AWS CLI detected: aws-cli/2.x.x
✅ AWS credentials configured
   Account: 123456789012
   User/Role: arn:aws:iam::123456789012:user/admin

🔑 Generating random API key...
✅ API key generated: abcd1234...

🔍 Checking if secret already exists...
✅ Secret does not exist yet

📝 Creating new secret...
✅ Secret created successfully
   ARN: arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:/tdnet/api-key-AbCdEf
   Name: /tdnet/api-key

========================================
✅ API Key Secret Setup Complete
========================================

Next Steps:
  1. Run: .\scripts\generate-env-file.ps1
  2. Run: cdk bootstrap
  3. Run: cdk deploy

To retrieve the API key later:
  aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region ap-northeast-1 --query SecretString --output text
```

### トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| AWS CLI not found | AWS CLIが未インストール | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | AWS認証情報が未設定 | `aws configure` 実行 |
| Secret already exists | シークレットが既に存在 | `-Force` オプション使用、または既存シークレット削除 |
| Access Denied | IAM権限不足 | `secretsmanager:CreateSecret`権限を付与 |

### APIキー取得方法

```powershell
# AWS CLI
aws secretsmanager get-secret-value `
    --secret-id /tdnet/api-key `
    --region ap-northeast-1 `
    --query SecretString `
    --output text

# PowerShell
$secret = aws secretsmanager get-secret-value `
    --secret-id /tdnet/api-key `
    --region ap-northeast-1 `
    --output json | ConvertFrom-Json
$secret.SecretString
```

---

## generate-env-file.ps1

環境変数ファイル（`.env.development`）を自動生成します。

### 使用方法

```powershell
# 基本的な使用方法
.\scripts\generate-env-file.ps1

# リージョン指定
.\scripts\generate-env-file.ps1 -Region ap-northeast-1

# 出力ファイル指定
.\scripts\generate-env-file.ps1 -OutputFile config/.env.production

# 既存ファイル上書き
.\scripts\generate-env-file.ps1 -Force

# すべてのオプション指定
.\scripts\generate-env-file.ps1 `
    -Region ap-northeast-1 `
    -OutputFile config/.env.development `
    -Force
```

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Region` | No | ap-northeast-1 | AWSリージョン |
| `-OutputFile` | No | config/.env.development | 出力ファイルパス |
| `-Force` | No | false | 既存ファイル上書き（バックアップ作成） |

### 実行フロー

1. **前提条件チェック**
   - AWS CLIインストール確認
   - AWS認証情報確認

2. **AWS情報取得**
   - AWSアカウントID取得

3. **既存ファイル確認**
   - ファイルが存在する場合:
     - `-Force`指定時: バックアップ作成後、上書き
     - `-Force`未指定時: エラー終了

4. **環境変数ファイル生成**
   - テンプレートに基づいてファイル生成
   - AWSアカウントIDを自動挿入

### 生成される環境変数

```bash
# AWS Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=ap-northeast-1

# DynamoDB Tables
DYNAMODB_TABLE_NAME=tdnet_disclosures
DYNAMODB_EXECUTIONS_TABLE=tdnet_executions
EXPORT_STATUS_TABLE_NAME=tdnet_export_status

# S3 Buckets
S3_BUCKET_NAME=tdnet-data-collector-pdfs-123456789012
EXPORT_BUCKET_NAME=tdnet-data-collector-exports-123456789012
DASHBOARD_BUCKET_NAME=tdnet-dashboard-123456789012
CLOUDTRAIL_LOGS_BUCKET_NAME=tdnet-cloudtrail-logs-123456789012

# Lambda Configuration
COLLECTOR_FUNCTION_NAME=tdnet-collector
QUERY_FUNCTION_NAME=tdnet-query
EXPORT_FUNCTION_NAME=tdnet-export
COLLECT_FUNCTION_NAME=tdnet-collect
COLLECT_STATUS_FUNCTION_NAME=tdnet-collect-status

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
NODE_OPTIONS=--enable-source-maps

# Scraping Configuration
SCRAPING_RATE_LIMIT=2
SCRAPING_MAX_RETRIES=3
SCRAPING_TIMEOUT=30000
SCRAPING_USER_AGENT=TDnet-Data-Collector/1.0
SCRAPING_CONCURRENCY=2

# Batch Processing
BATCH_SIZE=100
BATCH_DATE_RANGE_DAYS=7

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=3600

# Error Handling
ERROR_THRESHOLD=10
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000
```

### 出力例

```
========================================
TDnet Environment File Generation
========================================

✅ AWS CLI detected: aws-cli/2.x.x
✅ AWS credentials configured
   Account: 123456789012
   User/Role: arn:aws:iam::123456789012:user/admin
   Region: ap-northeast-1

📋 AWS Account ID: 123456789012

📝 Generating config/.env.development...
✅ Environment file generated successfully

========================================
✅ Environment File Generation Complete
========================================

Generated file: config/.env.development

Next Steps:
  1. Review the generated file: config/.env.development
  2. Customize values if needed
  3. Run: cdk bootstrap
  4. Run: cdk deploy

Note: API Key is stored in AWS Secrets Manager (/tdnet/api-key)
To retrieve: aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region ap-northeast-1 --query SecretString --output text
```

### トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| AWS CLI not found | AWS CLIが未インストール | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | AWS認証情報が未設定 | `aws configure` 実行 |
| File already exists | ファイルが既に存在 | `-Force` オプション使用 |
| Permission denied | ファイル書き込み権限なし | ファイル権限確認、または別のパスを指定 |

---

## localstack-setup.ps1

LocalStack環境にDynamoDBテーブルとS3バケットを作成します（E2Eテスト用）。

### 使用方法

```powershell
# LocalStack起動
docker compose up -d

# LocalStack環境構築
.\scripts\localstack-setup.ps1
```

### 前提条件

- Docker Desktopが起動している
- LocalStackコンテナが起動している（`docker compose up -d`）

### 作成されるリソース

#### DynamoDBテーブル

1. **tdnet_disclosures**
   - PK: `disclosure_id` (String)
   - GSI: `GSI_CompanyCode_DiscloseDate`
     - PK: `company_code` (String)
     - SK: `disclosed_at` (String)
   - GSI: `GSI_DatePartition`
     - PK: `date_partition` (String)
     - SK: `disclosed_at` (String)

2. **tdnet_executions**
   - PK: `execution_id` (String)
   - GSI: `StartedAtIndex`
     - PK: `started_at` (String)

3. **tdnet-export-status**
   - PK: `export_id` (String)

#### S3バケット

1. **tdnet-data-collector-pdfs-local**
   - PDF保存用

2. **tdnet-data-collector-exports-local**
   - エクスポートファイル保存用

### 実行フロー

1. **LocalStack可用性確認**
   - `http://localhost:4566/_localstack/health` にアクセス
   - LocalStackが起動していない場合、エラー終了

2. **DynamoDBテーブル作成**
   - 既存テーブルがある場合、削除してから再作成
   - JSON定義ファイル（`scripts/dynamodb-tables/*.json`）を使用

3. **S3バケット作成**
   - 既存バケットがある場合、スキップ

4. **リソース確認**
   - 作成されたテーブルとバケットを確認

### 出力例

```
ℹ️  Checking LocalStack availability...
✅ LocalStack is running

ℹ️  Creating DynamoDB tables...
ℹ️  Creating table: tdnet_disclosures
ℹ️  Checking if table 'tdnet_disclosures' exists...
⚠️  Table 'tdnet_disclosures' already exists. Deleting...
ℹ️  Waiting for table deletion...
✅ Table 'tdnet_disclosures' deleted
ℹ️  Creating table 'tdnet_disclosures' with GSI...
✅ Table 'tdnet_disclosures' created successfully with GSI_CompanyCode_DiscloseDate and GSI_DatePartition

ℹ️  Creating table: tdnet_executions
✅ Table 'tdnet_executions' created successfully

ℹ️  Creating table: tdnet-export-status
✅ Table 'tdnet-export-status' created successfully

ℹ️  Waiting for tables to be active...
ℹ️  Verifying tables...
✅ Table 'tdnet_disclosures' verified
✅ Table 'tdnet_executions' verified
✅ Table 'tdnet-export-status' verified

ℹ️  Creating S3 buckets...
ℹ️  Creating bucket: tdnet-data-collector-pdfs-local
✅ Bucket 'tdnet-data-collector-pdfs-local' created successfully

ℹ️  Creating bucket: tdnet-data-collector-exports-local
✅ Bucket 'tdnet-data-collector-exports-local' created successfully

ℹ️  Verifying buckets...
✅ Bucket 'tdnet-data-collector-pdfs-local' verified
✅ Bucket 'tdnet-data-collector-exports-local' verified

========================================
LocalStack Setup Complete!
========================================

ℹ️  DynamoDB Tables:
  - tdnet_disclosures (with GSI_CompanyCode_DiscloseDate and GSI_DatePartition)
  - tdnet_executions (with StartedAtIndex GSI)
  - tdnet-export-status

ℹ️  S3 Buckets:
  - tdnet-data-collector-pdfs-local
  - tdnet-data-collector-exports-local

ℹ️  Next Steps:
  1. Copy config/.env.local.example to config/.env.local
  2. Run tests: npm run test:e2e
  3. Check LocalStack logs: docker-compose logs -f localstack
```

### トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| LocalStack is not running | LocalStackコンテナが起動していない | `docker compose up -d` 実行 |
| Docker not found | Docker Desktopが未インストール | Docker Desktopをインストール |
| Connection refused | LocalStackポート4566が使用できない | ポート競合確認、LocalStack再起動 |
| Table creation failed | JSON定義ファイルが不正 | `scripts/dynamodb-tables/*.json` 確認 |
| AWS CLI not found | AWS CLIが未インストール | https://aws.amazon.com/cli/ からインストール |

### LocalStack確認コマンド

```powershell
# LocalStackコンテナ状態確認
docker ps --filter "name=localstack"

# LocalStackログ確認
docker compose logs -f localstack

# DynamoDBテーブル一覧
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables

# S3バケット一覧
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls

# テーブル詳細確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb describe-table --table-name tdnet_disclosures
```

---

## セットアップフロー全体

```powershell
# 1. AWS認証情報設定
aws configure

# 2. APIキー作成
.\scripts\create-api-key-secret.ps1 -Region ap-northeast-1

# 3. 環境変数ファイル生成
.\scripts\generate-env-file.ps1 -Region ap-northeast-1

# 4. LocalStack環境構築（E2Eテスト用）
docker compose up -d
.\scripts\localstack-setup.ps1

# 5. E2Eテスト実行
npm run test:e2e

# 6. AWS環境デプロイ
.\scripts\deploy.ps1 -Environment dev
```

## 関連ドキュメント

- [Scripts Overview](./scripts-overview.md)
- [デプロイスクリプト](./deployment-scripts.md)
- [環境セットアップ](../04-deployment/environment-setup.md)

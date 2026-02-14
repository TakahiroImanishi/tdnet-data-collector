---
inclusion: fileMatch
fileMatchPattern: "scripts/{create-api-key-secret,generate-env-file,localstack-setup}.ps1"
---

# セットアップスクリプト

## 初回セットアップ実行順序

1. **create-api-key-secret.ps1** - AWS Secrets ManagerにAPIキー作成
2. **generate-env-file.ps1** - .env.developmentファイル生成
3. **localstack-setup.ps1** - LocalStack環境構築（E2Eテスト用）

## create-api-key-secret.ps1

**目的**: AWS Secrets Managerに`/tdnet/api-key`シークレットを作成

**パラメータ**:
- `-Region`: AWSリージョン（デフォルト: ap-northeast-1）
- `-SecretName`: シークレット名（デフォルト: /tdnet/api-key）
- `-ApiKey`: APIキー（省略時はランダム生成）
- `-Force`: 既存シークレット上書き

**使用例**:
```powershell
# 新規作成（APIキー自動生成）
.\scripts\create-api-key-secret.ps1

# 既存シークレット更新
.\scripts\create-api-key-secret.ps1 -Force

# カスタムAPIキー指定
.\scripts\create-api-key-secret.ps1 -ApiKey "your-api-key-here"
```

**前提条件**: AWS CLI設定済み（`aws configure`）

## generate-env-file.ps1

**目的**: `.env.development`ファイルを自動生成（AWS Account ID、リージョン、リソース名を含む）

**パラメータ**:
- `-Region`: AWSリージョン（デフォルト: ap-northeast-1）
- `-OutputFile`: 出力ファイル名（デフォルト: .env.development）
- `-Force`: 既存ファイル上書き（バックアップ作成）

**使用例**:
```powershell
# 新規作成
.\scripts\generate-env-file.ps1

# 既存ファイル上書き（バックアップ作成）
.\scripts\generate-env-file.ps1 -Force

# カスタム出力ファイル
.\scripts\generate-env-file.ps1 -OutputFile ".env.production"
```

**前提条件**: AWS CLI設定済み（`aws configure`）

**生成内容**: AWS_ACCOUNT_ID, AWS_REGION, DynamoDB/S3/Lambda設定、スクレイピング設定、エラーハンドリング設定

## localstack-setup.ps1

**目的**: LocalStack環境にDynamoDBテーブルとS3バケットを作成（E2Eテスト用）

**パラメータ**: なし（エンドポイント: http://localhost:4566、リージョン: ap-northeast-1）

**使用例**:
```powershell
# LocalStack起動後に実行
docker compose up -d
.\scripts\localstack-setup.ps1
```

**作成リソース**:
- **DynamoDBテーブル**: tdnet_disclosures（GSI付き）、tdnet_executions、tdnet-export-status
- **S3バケット**: tdnet-data-collector-pdfs-local、tdnet-data-collector-exports-local

**前提条件**: Docker Desktop起動、LocalStackコンテナ起動（`docker compose up -d`）

**検証**: スクリプト実行後、テーブル・バケット存在確認を自動実行

## トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| AWS CLI not found | AWS CLI未インストール | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | AWS認証情報未設定 | `aws configure` 実行 |
| LocalStack not running | Dockerコンテナ未起動 | `docker compose up -d` 実行 |
| Secret already exists | シークレット重複 | `-Force` オプション使用 |
| File already exists | .envファイル重複 | `-Force` オプション使用（バックアップ作成） |

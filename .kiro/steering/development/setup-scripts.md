---
inclusion: fileMatch
fileMatchPattern: "scripts/{create-api-key-secret,generate-env-file,localstack-setup}.ps1"
---

# セットアップスクリプト

## 実行順序

1. `create-api-key-secret.ps1` - Secrets ManagerにAPIキー作成
2. `generate-env-file.ps1` - .env.developmentファイル生成
3. `localstack-setup.ps1` - LocalStack環境構築（E2Eテスト用）

## create-api-key-secret.ps1

```powershell
.\scripts\create-api-key-secret.ps1 [-Region ap-northeast-1] [-SecretName /tdnet/api-key] [-ApiKey "key"] [-Force]
```

前提: `aws configure`実行済み

## generate-env-file.ps1

```powershell
.\scripts\generate-env-file.ps1 [-Region ap-northeast-1] [-OutputFile .env.development] [-Force]
```

生成内容: AWS_ACCOUNT_ID, AWS_REGION, DynamoDB/S3/Lambda設定

前提: `aws configure`実行済み

## localstack-setup.ps1

```powershell
docker compose up -d
.\scripts\localstack-setup.ps1
```

作成リソース: DynamoDBテーブル（tdnet_disclosures, tdnet_executions, tdnet-export-status）、S3バケット（pdfs-local, exports-local）

前提: Docker Desktop起動、LocalStackコンテナ起動

## トラブルシューティング

| エラー | 解決策 |
|--------|--------|
| AWS CLI not found | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | `aws configure` 実行 |
| LocalStack not running | `docker compose up -d` 実行 |
| Secret/File already exists | `-Force` オプション使用 |

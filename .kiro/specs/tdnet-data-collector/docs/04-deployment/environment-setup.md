# 環境設定ガイド

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0

TDnet Data Collectorの開発環境と本番環境の設定方法を説明します。

---

## 目次

1. [環境一覧](#環境一覧)
2. [環境変数設定](#環境変数設定)
3. [AWS Secrets Manager設定](#aws-secrets-manager設定)
4. [AWS SSM Parameter Store設定](#aws-ssm-parameter-store設定)
5. [環境構築手順](#環境構築手順)
6. [トラブルシューティング](#トラブルシューティング)

---

## 環境一覧

| 環境 | 用途 | デプロイ方法 | エンドポイント |
|------|------|------------|--------------|
| **local** | ローカル開発（LocalStack） | 手動 | http://localhost:4566 |
| **dev** | 開発環境（AWS） | GitHub Actions（developブランチ） | https://api-dev.example.com |
| **prod** | 本番環境（AWS） | GitHub Actions（mainブランチ） | https://api.example.com |

---

## 環境変数設定

### 環境変数ファイルの作成

#### .env.development（開発環境）

```bash
# ========================================
# Environment
# ========================================
ENVIRONMENT=dev
NODE_ENV=development
LOG_LEVEL=DEBUG

# ========================================
# AWS Configuration
# ========================================
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012  # 実際のアカウントIDに置き換え

# ========================================
# DynamoDB Configuration
# ========================================
DYNAMODB_TABLE_NAME=tdnet_disclosures_dev
DYNAMODB_EXECUTIONS_TABLE=tdnet_executions_dev
DYNAMODB_EXPORT_STATUS_TABLE=tdnet_export_status_dev

# ========================================
# S3 Configuration
# ========================================
S3_BUCKET_NAME=tdnet-data-collector-pdfs-dev-123456789012
S3_EXPORTS_BUCKET=tdnet-data-collector-exports-dev-123456789012
S3_DASHBOARD_BUCKET=tdnet-dashboard-dev-123456789012

# ========================================
# LocalStack Configuration (Optional)
# ========================================
USE_LOCALSTACK=false
LOCALSTACK_ENDPOINT=http://localhost:4566

# ========================================
# Monitoring & Alerts
# ========================================
ENABLE_DETAILED_LOGGING=true
ENABLE_METRICS=true
ENABLE_XRAY_TRACING=false
```

#### .env.production（本番環境）

```bash
# ========================================
# Environment
# ========================================
ENVIRONMENT=prod
NODE_ENV=production
LOG_LEVEL=INFO

# ========================================
# AWS Configuration
# ========================================
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012  # 実際のアカウントIDに置き換え

# ========================================
# DynamoDB Configuration
# ========================================
DYNAMODB_TABLE_NAME=tdnet_disclosures_prod
DYNAMODB_EXECUTIONS_TABLE=tdnet_executions_prod
DYNAMODB_EXPORT_STATUS_TABLE=tdnet_export_status_prod

# ========================================
# S3 Configuration
# ========================================
S3_BUCKET_NAME=tdnet-data-collector-pdfs-prod-123456789012
S3_EXPORTS_BUCKET=tdnet-data-collector-exports-prod-123456789012
S3_DASHBOARD_BUCKET=tdnet-dashboard-prod-123456789012

# ========================================
# Secrets Manager Configuration
# ========================================
API_KEY_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:/tdnet/api-key

# ========================================
# Monitoring & Alerts
# ========================================
ALERT_SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts-prod
ERROR_RATE_THRESHOLD=10
DURATION_THRESHOLD=840
COLLECTION_SUCCESS_RATE_THRESHOLD=95

# ========================================
# Feature Flags
# ========================================
ENABLE_DETAILED_LOGGING=false
ENABLE_METRICS=true
ENABLE_XRAY_TRACING=true
```

### 環境変数の検証

```powershell
# 環境変数ファイルの存在確認
if (Test-Path ".env.production") {
    Write-Host "✅ .env.production file exists" -ForegroundColor Green
} else {
    Write-Host "❌ .env.production file not found" -ForegroundColor Red
    exit 1
}

# 必須項目の確認
$requiredVars = @(
    "AWS_ACCOUNT_ID",
    "AWS_REGION",
    "DYNAMODB_TABLE_NAME",
    "S3_BUCKET_NAME"
)

$envContent = Get-Content ".env.production"
foreach ($var in $requiredVars) {
    if ($envContent -match "^$var=.+") {
        Write-Host "✅ $var is set" -ForegroundColor Green
    } else {
        Write-Host "❌ $var is not set" -ForegroundColor Red
    }
}
```

---

## AWS Secrets Manager設定

### 概要

機密情報（APIキー、パスワード）をAWS Secrets Managerに保存します。

**Secrets Managerの利点**:
- 自動ローテーション機能
- 暗号化（AWS KMS）
- アクセス監査（CloudTrail）
- バージョン管理

### 保存する機密情報

| シークレット名 | 説明 | ローテーション |
|--------------|------|--------------|
| `/tdnet/api-key` | TDnet APIキー | 90日ごと |

### セットアップ手順

#### 方法1: AWS CLIを使用

```powershell
# APIキーを生成（ランダムな32文字）
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$apiKey = -join ((1..32) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
Write-Host "Generated API Key: $apiKey"

# Secrets Managerにシークレットを作成
aws secretsmanager create-secret `
  --name /tdnet/api-key `
  --description "TDnet Data Collector API Key" `
  --secret-string $apiKey `
  --region ap-northeast-1

# シークレットの確認
aws secretsmanager describe-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

#### 方法2: CDKで自動作成（推奨）

CDKスタックには既にSecrets Manager Constructが含まれており、デプロイ時に自動的にシークレットが作成されます。

```typescript
// cdk/lib/constructs/secrets-manager.ts
const secretsManagerConstruct = new SecretsManagerConstruct(this, 'SecretsManager', {
  environment: 'prod',
  enableRotation: true,  // 自動ローテーション有効化
  rotationDays: 90,      // 90日ごとにローテーション
});
```

### Lambda関数での使用方法

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getApiKey(): Promise<string> {
  const secretArn = process.env.API_KEY_SECRET_ARN;
  
  if (!secretArn) {
    throw new Error('API_KEY_SECRET_ARN environment variable is not set');
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  return response.SecretString;
}
```

### IAM権限

Lambda関数に必要な権限（CDKで自動付与）:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:/tdnet/api-key*"
    }
  ]
}
```

### コスト

- **シークレット保存**: $0.40/月/シークレット
- **API呼び出し**: $0.05/10,000リクエスト
- **月間推定コスト**: 約$0.50

---

## AWS SSM Parameter Store設定

### 概要

アプリケーション設定値をAWS Systems Manager Parameter Storeに保存します。

**Parameter Storeの利点**:
- 無料（Standard Parameters）
- 階層構造のサポート
- バージョン管理
- CloudFormation統合

### Secrets Managerとの使い分け

| 用途 | 推奨サービス |
|------|------------|
| 機密情報（APIキー、パスワード） | Secrets Manager |
| アプリケーション設定 | Parameter Store |
| 自動ローテーション必要 | Secrets Manager |
| 自動ローテーション不要 | Parameter Store |

### 保存する設定値

#### アプリケーション設定

| パラメータ名 | 説明 | 例 |
|------------|------|-----|
| `/tdnet/config/base-url` | TDnetベースURL | `https://www.release.tdnet.info` |
| `/tdnet/config/request-delay-ms` | リクエスト間隔（ミリ秒） | `2000` |
| `/tdnet/config/max-retries` | 最大再試行回数 | `3` |
| `/tdnet/config/rate-limit-rpm` | レート制限（リクエスト/分） | `30` |

#### 環境固有の設定

| パラメータ名 | 説明 | 例 |
|------------|------|-----|
| `/tdnet/prod/log-level` | ログレベル | `INFO` |
| `/tdnet/prod/enable-metrics` | メトリクス有効化 | `true` |
| `/tdnet/prod/enable-xray` | X-Rayトレーシング有効化 | `true` |

### セットアップ手順

#### 一括作成スクリプト

```powershell
# アプリケーション設定
$appConfig = @{
    "/tdnet/config/base-url" = "https://www.release.tdnet.info"
    "/tdnet/config/request-delay-ms" = "2000"
    "/tdnet/config/max-retries" = "3"
    "/tdnet/config/rate-limit-rpm" = "30"
}

# 環境固有の設定（本番環境）
$prodConfig = @{
    "/tdnet/prod/log-level" = "INFO"
    "/tdnet/prod/enable-metrics" = "true"
    "/tdnet/prod/enable-xray" = "true"
    "/tdnet/prod/enable-detailed-logging" = "false"
}

# アプリケーション設定を作成
foreach ($key in $appConfig.Keys) {
    Write-Host "Creating parameter: $key"
    aws ssm put-parameter `
        --name $key `
        --value $appConfig[$key] `
        --type String `
        --overwrite `
        --region ap-northeast-1
}

# 環境固有の設定を作成
foreach ($key in $prodConfig.Keys) {
    Write-Host "Creating parameter: $key"
    aws ssm put-parameter `
        --name $key `
        --value $prodConfig[$key] `
        --type String `
        --overwrite `
        --region ap-northeast-1
}

Write-Host "All parameters created successfully!"
```

### Lambda関数での使用方法

```typescript
import { SSMClient, GetParameterCommand, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: 'ap-northeast-1' });

// 単一パラメータの取得
async function getParameter(name: string): Promise<string> {
  const command = new GetParameterCommand({ Name: name });
  const response = await client.send(command);

  if (!response.Parameter?.Value) {
    throw new Error(`Parameter ${name} not found`);
  }

  return response.Parameter.Value;
}

// パスによる一括取得
async function getParametersByPath(path: string): Promise<Record<string, string>> {
  const command = new GetParametersByPathCommand({ Path: path });
  const response = await client.send(command);

  const parameters: Record<string, string> = {};
  
  if (response.Parameters) {
    for (const param of response.Parameters) {
      if (param.Name && param.Value) {
        parameters[param.Name] = param.Value;
      }
    }
  }

  return parameters;
}

// 使用例
const baseUrl = await getParameter('/tdnet/config/base-url');
const prodConfig = await getParametersByPath('/tdnet/prod/');
```

### コスト

- **Standard Parameters**: 無料（10,000パラメータまで）
- **API呼び出し**: 無料
- **月間推定コスト**: $0

---

## 環境構築手順

### ローカル環境（LocalStack）

#### 1. LocalStack起動

```powershell
# Docker Desktopが起動していることを確認
docker ps

# LocalStackを起動
docker compose up -d

# LocalStackの起動確認
docker ps --filter "name=localstack"
```

#### 2. リソース作成

```powershell
# DynamoDBテーブルとS3バケットを作成
.\scripts\localstack-setup.ps1
```

#### 3. 環境変数設定

`.env.local` ファイルを作成（`.env.example` を参照）

```bash
USE_LOCALSTACK=true
LOCALSTACK_ENDPOINT=http://localhost:4566
```

### 開発環境（AWS）

#### 1. CDK Bootstrap

```powershell
# AWSアカウントIDを取得
$accountId = aws sts get-caller-identity --query Account --output text
Write-Host "AWS Account ID: $accountId"

# CDK Bootstrap実行
npx cdk bootstrap aws://$accountId/ap-northeast-1
```

#### 2. 環境変数ファイル作成

`.env.development` を作成し、AWSアカウントIDを設定

#### 3. デプロイ

```powershell
npx cdk deploy --context environment=dev
```

### 本番環境（AWS）

#### 1. Secrets Manager設定

```powershell
# APIキーシークレットを作成
.\scripts\create-api-key-secret.ps1 -Environment prod
```

#### 2. 環境変数ファイル作成

`.env.production` を作成し、本番環境用の設定を記述

#### 3. デプロイ

GitHub Actionsによる自動デプロイ。詳細は `ci-cd-guide.md` を参照。

---

## トラブルシューティング

### LocalStack接続エラー

**症状**: `ECONNREFUSED localhost:4566`

**解決策**:
```powershell
# Docker Desktopが起動しているか確認
docker ps

# LocalStackコンテナが実行中か確認
docker ps --filter "name=localstack"

# LocalStackを再起動
docker compose down
docker compose up -d
```

### CDK認証エラー

**症状**: `Unable to resolve AWS account to use`

**解決策**:
```powershell
# AWS認証情報を確認
aws sts get-caller-identity

# AWS_PROFILE環境変数を確認
$env:AWS_PROFILE

# 認証情報を再設定
aws configure
```

### Lambda環境変数エラー

**症状**: Lambda関数で環境変数が取得できない

**解決策**:
```powershell
# Lambda関数の環境変数を確認
aws lambda get-function-configuration `
    --function-name tdnet-collector-dev `
    --query "Environment.Variables"

# CDKスタックで環境変数が正しく設定されているか確認
# cdk/lib/tdnet-data-collector-stack.ts を確認
```

### Secrets Manager接続エラー

**症状**: `AccessDeniedException: User is not authorized`

**解決策**:
```powershell
# Lambda関数のIAMロールを確認
aws lambda get-function `
    --function-name tdnet-collector-dev `
    --query "Configuration.Role"

# IAMロールのポリシーを確認
aws iam list-attached-role-policies --role-name <role-name>

# Secrets Managerへのアクセス権限を確認
aws iam get-role-policy `
    --role-name <role-name> `
    --policy-name SecretsManagerAccess
```

---

## 関連ドキュメント

- **環境変数管理**: `../../steering/infrastructure/environment-variables.md` - 環境変数一覧と管理方法
- **CDK Bootstrap**: `cdk-bootstrap-guide.md` - CDK Bootstrap詳細手順
- **デプロイ**: `deployment-guide.md` - デプロイ手順
- **CI/CD**: `ci-cd-guide.md` - GitHub Actions設定
- **トラブルシューティング**: `../05-operations/troubleshooting.md` - 問題解決ガイド

---

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0  
**作成者**: TDnet Data Collector Team

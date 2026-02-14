# 本番環境セットアップガイド

## 概要

このドキュメントでは、TDnet Data Collectorの本番環境をセットアップする手順を説明します。

## 前提条件

- AWS CLIがインストールされていること
- AWS認証情報が設定されていること（`aws configure`）
- 本番環境用のAWSアカウントへのアクセス権限があること

## セットアップ手順

### ステップ1: Secrets Managerにシークレットを作成

#### 1.1 APIキーの生成

```powershell
# ランダムな32文字のAPIキーを生成
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$apiKey = -join ((1..32) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
Write-Host "Generated API Key: $apiKey"
```

#### 1.2 Secrets Managerにシークレットを作成

```powershell
# シークレットを作成
aws secretsmanager create-secret `
  --name /tdnet/api-key `
  --description "TDnet Data Collector API Key" `
  --secret-string $apiKey `
  --region ap-northeast-1
```

#### 1.3 シークレットの確認

```powershell
# シークレットが作成されたことを確認
aws secretsmanager describe-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

### ステップ2: 本番環境変数ファイルの作成

#### 2.1 AWSアカウントIDの取得

```powershell
# AWSアカウントIDを取得
$accountId = (aws sts get-caller-identity --query Account --output text)
Write-Host "AWS Account ID: $accountId"
```

#### 2.2 .env.productionファイルの作成

`.env.production.template`をコピーして`.env.production`を作成し、以下のプレースホルダーを実際の値に置き換えます：

- `{account-id}` → 実際のAWSアカウントID
- `{api-id}` → API Gateway ID（CDKデプロイ後に取得）
- `{web-acl-id}` → WAF Web ACL ID（CDKデプロイ後に取得）

```powershell
# .env.production.templateをコピー
Copy-Item .env.production.template .env.production

# エディタで開いて編集
notepad .env.production
```

**編集する項目**:

```env
# AWS設定
AWS_ACCOUNT_ID={account-id}  # 実際のアカウントIDに置き換え

# S3設定
S3_BUCKET_NAME=tdnet-data-collector-pdfs-prod-{account-id}
S3_EXPORTS_BUCKET=tdnet-data-collector-exports-prod-{account-id}
S3_DASHBOARD_BUCKET=tdnet-dashboard-prod-{account-id}

# Secrets Manager設定
API_KEY_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:/tdnet/api-key

# 監視・アラート設定
ALERT_SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-1:{account-id}:tdnet-alerts-prod

# CloudTrail設定
CLOUDTRAIL_LOGS_BUCKET=tdnet-cloudtrail-logs-{account-id}
```

### ステップ3: 環境変数の検証

#### 3.1 必須環境変数の確認

以下の環境変数が正しく設定されているか確認します：

**AWS設定**:
- `AWS_REGION`: ap-northeast-1
- `AWS_ACCOUNT_ID`: 12桁の数字

**DynamoDB設定**:
- `DYNAMODB_TABLE_NAME`: tdnet_disclosures_prod
- `DYNAMODB_EXECUTIONS_TABLE`: tdnet_executions_prod
- `DYNAMODB_EXPORT_STATUS_TABLE`: tdnet_export_status_prod

**S3設定**:
- `S3_BUCKET_NAME`: tdnet-data-collector-pdfs-prod-{account-id}
- `S3_EXPORTS_BUCKET`: tdnet-data-collector-exports-prod-{account-id}
- `S3_DASHBOARD_BUCKET`: tdnet-dashboard-prod-{account-id}

**Secrets Manager設定**:
- `API_KEY_SECRET_ARN`: arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:/tdnet/api-key

#### 3.2 Secrets Managerシークレットの確認

```powershell
# シークレットが存在することを確認
aws secretsmanager get-secret-value `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1 `
  --query SecretString `
  --output text
```

### ステップ4: .gitignoreの確認

`.env.production`が`.gitignore`に含まれていることを確認します。

```powershell
# .gitignoreに.env.productionが含まれているか確認
Select-String -Path .gitignore -Pattern ".env.production"
```

既に含まれている場合は何もする必要はありません。

### ステップ5: CDK Bootstrap

本番環境用のCDK Bootstrapを実行します。

```powershell
# CDK Bootstrap（本番環境）
cdk bootstrap --profile prod
```

### ステップ6: CDKデプロイ

本番環境にデプロイします。

```powershell
# CDKデプロイ（本番環境）
cdk deploy --context environment=prod --profile prod
```

### ステップ7: デプロイ後の確認

#### 7.1 API Gateway IDの取得

```powershell
# API Gateway IDを取得
$apiId = (aws cloudformation describe-stacks `
  --stack-name TdnetDataCollectorStack-prod `
  --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayId'].OutputValue" `
  --output text)

Write-Host "API Gateway ID: $apiId"
```

#### 7.2 WAF Web ACL IDの取得

```powershell
# WAF Web ACL IDを取得
$webAclId = (aws cloudformation describe-stacks `
  --stack-name TdnetDataCollectorStack-prod `
  --query "Stacks[0].Outputs[?OutputKey=='WebAclId'].OutputValue" `
  --output text)

Write-Host "WAF Web ACL ID: $webAclId"
```

#### 7.3 .env.productionの更新

取得したIDを`.env.production`に追加します。

```env
# API Gateway設定
API_GATEWAY_ENDPOINT=https://{api-id}.execute-api.ap-northeast-1.amazonaws.com/prod

# WAF設定
WAF_WEB_ACL_ARN=arn:aws:wafv2:ap-northeast-1:{account-id}:regional/webacl/tdnet-web-acl-prod/{web-acl-id}
```

## 検証

### 1. Secrets Managerの確認

```powershell
# シークレットの詳細を確認
aws secretsmanager describe-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1
```

### 2. Lambda関数の確認

```powershell
# Lambda関数一覧を取得
aws lambda list-functions `
  --query "Functions[?starts_with(FunctionName, 'tdnet')].FunctionName" `
  --output table
```

### 3. DynamoDBテーブルの確認

```powershell
# DynamoDBテーブル一覧を取得
aws dynamodb list-tables `
  --query "TableNames[?starts_with(@, 'tdnet')]" `
  --output table
```

### 4. S3バケットの確認

```powershell
# S3バケット一覧を取得
aws s3 ls | Select-String "tdnet"
```

### 5. CloudWatch Alarmsの確認

```powershell
# CloudWatch Alarms一覧を取得
aws cloudwatch describe-alarms `
  --query "MetricAlarms[?starts_with(AlarmName, 'tdnet')].AlarmName" `
  --output table
```

## トラブルシューティング

### シークレットが既に存在する

```powershell
# 既存のシークレットを削除（注意: 本番環境では慎重に実行）
aws secretsmanager delete-secret `
  --secret-id /tdnet/api-key `
  --region ap-northeast-1 `
  --force-delete-without-recovery

# 新しいシークレットを作成
aws secretsmanager create-secret `
  --name /tdnet/api-key `
  --description "TDnet Data Collector API Key" `
  --secret-string $apiKey `
  --region ap-northeast-1
```

### 環境変数が読み込まれない

```powershell
# 環境変数ファイルを手動で読み込み
Get-Content .env.production | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}
```

### CDKデプロイが失敗する

```powershell
# CDK Synthで構文エラーを確認
cdk synth --context environment=prod

# エラーログを確認
cdk deploy --context environment=prod --profile prod --verbose
```

## セキュリティ注意事項

1. **機密情報の管理**
   - `.env.production`ファイルは絶対にGitにコミットしない
   - APIキーはSecrets Managerに保存し、環境変数には含めない
   - 環境変数ファイルのアクセス権限を制限する

2. **アクセス制御**
   - 本番環境へのアクセスは最小限の人数に制限
   - IAMロールとポリシーで最小権限の原則を適用
   - MFAを有効化

3. **監査ログ**
   - CloudTrailで全てのAPI呼び出しを記録
   - 定期的にログを確認

## 次のステップ

1. スモークテストの実行（`docs/smoke-test-guide.md`参照）
2. 監視とアラートの設定確認（`docs/monitoring-setup.md`参照）
3. バックアップ戦略の確認（`docs/backup-strategy.md`参照）

## 関連ドキュメント

- `docs/secrets-manager-setup.md` - Secrets Managerセットアップガイド
- `docs/production-deployment-guide.md` - 本番デプロイガイド
- `.env.production.template` - 本番環境設定テンプレート
- `scripts/create-api-key-secret.ps1` - APIキーシークレット作成スクリプト


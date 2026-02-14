# CDK Bootstrap ガイド

AWS CDK Bootstrapの実行手順とトラブルシューティング。

**作成日**: 2026-02-15  
**対象**: Phase 2 環境準備

---

## CDK Bootstrap とは

CDKアプリケーションのデプロイに必要なAWSリソース（S3バケット、IAMロールなど）を準備するプロセス。

**作成されるリソース:**
- S3バケット: CDKアセット保存先
- IAMロール: デプロイ実行ロール
- ECRリポジトリ: Dockerイメージ用（必要時）
- SSMパラメータ: Bootstrapバージョン情報

---

## Bootstrap 実行前の確認

### 1. AWS認証情報の確認

```powershell
# 現在の認証情報を確認
aws sts get-caller-identity

# アカウントIDを取得
$AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "AWS Account ID: $AWS_ACCOUNT_ID"
```

### 2. リージョンの確認

```powershell
aws configure get region
```

---

## Bootstrap 実行方法

### 基本的な実行

```powershell
cd cdk

# デフォルトリージョンでBootstrap
cdk bootstrap

# または、明示的にアカウントとリージョンを指定
cdk bootstrap aws://123456789012/ap-northeast-1
```

### テンプレート確認（実行前）

```powershell
# 作成されるCloudFormationテンプレートを確認
cdk bootstrap --show-template
```

---

## Bootstrap 実行結果の確認

### CloudFormationスタックの確認

```powershell
# Bootstrapスタックの確認
aws cloudformation describe-stacks --stack-name CDKToolkit

# スタックの出力を確認
aws cloudformation describe-stacks `
  --stack-name CDKToolkit `
  --query 'Stacks[0].Outputs' `
  --output table
```

**期待される出力:**
- BucketName: `cdk-hnb659fds-assets-{account-id}-{region}`
- BootstrapVersion: `21`

### S3バケットの確認

```powershell
# Bootstrapで作成されたS3バケットを確認
aws s3 ls | Select-String "cdk-"
```

### IAMロールの確認

```powershell
# Bootstrapで作成されたIAMロールを確認
aws iam list-roles --query 'Roles[?contains(RoleName, `cdk`)].RoleName' --output table
```

**期待されるロール:**
- `cdk-*-cfn-exec-role-*` - CloudFormation実行ロール
- `cdk-*-deploy-role-*` - CDKデプロイロール
- `cdk-*-file-publishing-role-*` - ファイル公開ロール
- `cdk-*-lookup-role-*` - リソース検索ロール

---

## エラーと対処法

### 認証エラー

**症状:**
```
Unable to resolve AWS account to use
```

**対処法:**
```powershell
# AWS認証情報を確認
aws sts get-caller-identity

# 認証情報が設定されていない場合
aws configure
```

### 権限不足

**症状:**
```
User is not authorized to perform: cloudformation:CreateStack
```

**対処法:**
必要な権限（CloudFormation、S3、IAM、ECR、SSM）をIAMユーザーに付与。本番環境では最小権限の原則に従う。

### Bootstrap スタックが既に存在

**症状:**
```
CDKToolkit already exists
```

**対処法:**
既にBootstrapが完了している場合は再実行不要。更新が必要な場合は `--force` オプションを使用。

```powershell
# Bootstrapバージョンを確認
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version

# 必要に応じて更新
cdk bootstrap --force
```

---

## Bootstrap 後の次のステップ

### 1. 環境変数の更新

`.env.development` にAWSアカウントIDを記録：

```bash
S3_BUCKET_PDFS=tdnet-data-collector-pdfs-123456789012
S3_BUCKET_EXPORTS=tdnet-data-collector-exports-123456789012
```

### 2. CDKスタックのデプロイ準備

```powershell
cd cdk

# CDKスタックの一覧を確認
cdk list

# CDKスタックの差分を確認
cdk diff

# CDKスタックをデプロイ（Phase 2で実施）
# cdk deploy
```

### 3. Bootstrap情報の記録

以下の情報を記録：
- AWSアカウントID
- リージョン
- BootstrapスタックARN
- S3バケット名
- Bootstrapバージョン

---

## ベストプラクティス

### 環境ごとにBootstrap

開発環境と本番環境で異なるAWSアカウントを使用する場合、それぞれでBootstrapを実行。

```powershell
# 開発環境
cdk bootstrap aws://111111111111/ap-northeast-1

# 本番環境
cdk bootstrap aws://222222222222/ap-northeast-1
```

### Bootstrap バージョンの管理

CDKのバージョンアップ時は、Bootstrapも更新。

```powershell
# CDKバージョンを確認
cdk --version

# Bootstrapを更新
cdk bootstrap --force
```

### コスト最適化

Bootstrapで作成されるS3バケットにライフサイクルポリシーを設定。

```powershell
# 90日後に削除
aws s3api put-bucket-lifecycle-configuration `
  --bucket cdk-hnb659fds-assets-{account-id}-{region} `
  --lifecycle-configuration file://lifecycle-policy.json
```

### セキュリティ強化

S3バケットの暗号化とバージョニングを有効化。

```powershell
# 暗号化を有効化
aws s3api put-bucket-encryption `
  --bucket cdk-hnb659fds-assets-{account-id}-{region} `
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# バージョニングを有効化
aws s3api put-bucket-versioning `
  --bucket cdk-hnb659fds-assets-{account-id}-{region} `
  --versioning-configuration Status=Enabled
```

---

## トラブルシューティング

### Bootstrap が完了しない

**症状**: Bootstrap が長時間（5分以上）完了しない

**対処法:**
1. CloudFormationコンソールでスタックの状態を確認
2. スタックイベントでエラーメッセージを確認
3. 必要に応じてスタックをロールバックして再実行

```powershell
# CloudFormationスタックの状態を確認
aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus'

# スタックイベントを確認
aws cloudformation describe-stack-events --stack-name CDKToolkit --max-items 10
```

### Bootstrap の削除（クリーンアップ）

**注意**: Bootstrapスタックを削除すると、CDKデプロイができなくなります。

```powershell
# Bootstrapスタックを削除
aws cloudformation delete-stack --stack-name CDKToolkit

# S3バケットを空にしてから削除
aws s3 rm s3://cdk-hnb659fds-assets-{account-id}-{region} --recursive
aws s3 rb s3://cdk-hnb659fds-assets-{account-id}-{region}
```

---

## 関連ドキュメント

- **環境変数管理**: `../../steering/infrastructure/environment-variables.md`
- **デプロイチェックリスト**: `../../steering/infrastructure/deployment-checklist.md`
- **AWS CDK公式ドキュメント**: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html

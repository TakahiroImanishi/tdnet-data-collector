# CDK Bootstrap ガイド

**作成日**: 2026-02-08  
**対象**: Phase 2 環境準備  
**関連タスク**: 9.3

---

## CDK Bootstrap とは

AWS CDK Bootstrapは、CDKアプリケーションをデプロイする前に必要なAWSリソース（S3バケット、IAMロールなど）を準備するプロセスです。

### Bootstrap で作成されるリソース

1. **S3バケット**: CDKアセット（Lambda関数コード、CloudFormationテンプレート）の保存先
2. **IAMロール**: CDKデプロイ時に使用する実行ロール
3. **ECRリポジトリ**: Dockerイメージを使用する場合のコンテナレジストリ
4. **SSMパラメータ**: Bootstrap バージョン情報

---

## Bootstrap 実行前の確認事項

### 1. AWS認証情報の確認

```powershell
# 現在の認証情報を確認
aws sts get-caller-identity

# 出力例:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

### 2. AWSアカウントIDの取得

```powershell
# アカウントIDを取得
$AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
Write-Host "AWS Account ID: $AWS_ACCOUNT_ID"

# .env.development に記録
# S3_BUCKET_PDFS=tdnet-data-collector-pdfs-$AWS_ACCOUNT_ID
# S3_BUCKET_EXPORTS=tdnet-data-collector-exports-$AWS_ACCOUNT_ID
```

### 3. リージョンの確認

```powershell
# 現在のリージョンを確認
aws configure get region

# または環境変数から確認
$env:AWS_REGION
```

---

## Bootstrap 実行方法

### オプション1: ドライラン（推奨）

実際にリソースを作成せず、何が作成されるかを確認します。

```powershell
# CDKプロジェクトディレクトリに移動
cd cdk

# Bootstrap のドライラン（--dry-run オプション）
# 注意: CDK v2.1033.0 では --dry-run オプションがサポートされていない可能性があります
# その場合は、以下のコマンドで実行計画を確認してください

# 実行計画の確認（CloudFormation変更セットを表示）
cdk bootstrap --show-template

# または、実際にBootstrapを実行する前に確認
cdk bootstrap aws://123456789012/ap-northeast-1 --verbose
```

**注意**: `--dry-run` オプションがサポートされていない場合は、`--show-template` で作成されるCloudFormationテンプレートを確認してください。

### オプション2: 実際のBootstrap実行

```powershell
# CDKプロジェクトディレクトリに移動
cd cdk

# Bootstrap 実行（デフォルトリージョン）
cdk bootstrap

# または、明示的にアカウントとリージョンを指定
cdk bootstrap aws://123456789012/ap-northeast-1

# 複数リージョンに対してBootstrap（必要な場合）
cdk bootstrap aws://123456789012/ap-northeast-1 aws://123456789012/us-east-1
```

### オプション3: カスタムBootstrapスタック名

```powershell
# カスタムスタック名でBootstrap
cdk bootstrap --toolkit-stack-name TDnetCDKToolkit aws://123456789012/ap-northeast-1
```

---

## Bootstrap 実行結果の確認

### 1. CloudFormationスタックの確認

```powershell
# Bootstrapスタックの確認
aws cloudformation describe-stacks --stack-name CDKToolkit --region ap-northeast-1

# スタックの出力を確認
aws cloudformation describe-stacks `
  --stack-name CDKToolkit `
  --query 'Stacks[0].Outputs' `
  --output table
```

**期待される出力:**

| OutputKey | OutputValue | Description |
|-----------|-------------|-------------|
| BucketName | cdk-hnb659fds-assets-123456789012-ap-northeast-1 | S3バケット名 |
| BucketDomainName | cdk-hnb659fds-assets-123456789012-ap-northeast-1.s3.amazonaws.com | S3バケットドメイン |
| BootstrapVersion | 21 | Bootstrapバージョン |

### 2. S3バケットの確認

```powershell
# Bootstrapで作成されたS3バケットを確認
aws s3 ls | Select-String "cdk-"

# バケットの詳細を確認
aws s3api get-bucket-versioning --bucket cdk-hnb659fds-assets-123456789012-ap-northeast-1
```

### 3. IAMロールの確認

```powershell
# Bootstrapで作成されたIAMロールを確認
aws iam list-roles --query 'Roles[?contains(RoleName, `cdk`)].RoleName' --output table
```

**期待されるロール:**
- `cdk-hnb659fds-cfn-exec-role-123456789012-ap-northeast-1` - CloudFormation実行ロール
- `cdk-hnb659fds-deploy-role-123456789012-ap-northeast-1` - CDKデプロイロール
- `cdk-hnb659fds-file-publishing-role-123456789012-ap-northeast-1` - ファイル公開ロール
- `cdk-hnb659fds-image-publishing-role-123456789012-ap-northeast-1` - イメージ公開ロール
- `cdk-hnb659fds-lookup-role-123456789012-ap-northeast-1` - リソース検索ロール

---

## Bootstrap 実行時のエラーと対処法

### エラー1: 認証エラー

**症状:**
```
Unable to resolve AWS account to use. It must be either configured when you define your CDK Stack, or through the environment
```

**対処法:**
```powershell
# AWS認証情報を確認
aws sts get-caller-identity

# 認証情報が設定されていない場合
aws configure

# または、環境変数で設定
$env:AWS_ACCESS_KEY_ID = "your-access-key"
$env:AWS_SECRET_ACCESS_KEY = "your-secret-key"
$env:AWS_REGION = "ap-northeast-1"
```

### エラー2: 権限不足

**症状:**
```
User: arn:aws:iam::123456789012:user/your-username is not authorized to perform: cloudformation:CreateStack
```

**対処法:**

必要な権限を確認し、IAMユーザーまたはロールに以下のポリシーをアタッチ：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "iam:*",
        "ecr:*",
        "ssm:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**注意**: 本番環境では、最小権限の原則に従い、必要な権限のみを付与してください。

### エラー3: リージョン未指定

**症状:**
```
Need to perform AWS calls for account 123456789012, but no credentials have been configured
```

**対処法:**
```powershell
# リージョンを明示的に指定
cdk bootstrap aws://123456789012/ap-northeast-1

# または、環境変数で設定
$env:AWS_REGION = "ap-northeast-1"
cdk bootstrap
```

### エラー4: Bootstrap スタックが既に存在

**症状:**
```
CDKToolkit already exists
```

**対処法:**

既にBootstrapが完了している場合は、再実行の必要はありません。

```powershell
# 既存のBootstrapスタックを確認
aws cloudformation describe-stacks --stack-name CDKToolkit

# Bootstrapバージョンを確認
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --query Parameter.Value --output text

# 必要に応じて、Bootstrapを更新
cdk bootstrap --force
```

---

## Bootstrap 後の次のステップ

### 1. 環境変数の更新

`.env.development` ファイルに、取得したAWSアカウントIDを記録：

```bash
# {account-id} を実際の値に置き換え
S3_BUCKET_PDFS=tdnet-data-collector-pdfs-123456789012
S3_BUCKET_EXPORTS=tdnet-data-collector-exports-123456789012
```

### 2. CDKスタックのデプロイ準備

```powershell
# CDKプロジェクトディレクトリに移動
cd cdk

# CDKスタックの一覧を確認
cdk list

# CDKスタックの差分を確認（ドライラン）
cdk diff

# CDKスタックをデプロイ（Phase 2で実施）
# cdk deploy
```

### 3. Bootstrap情報の記録

以下の情報を記録しておくことを推奨：

- **AWSアカウントID**: `123456789012`
- **リージョン**: `ap-northeast-1`
- **BootstrapスタックARN**: `arn:aws:cloudformation:ap-northeast-1:123456789012:stack/CDKToolkit/...`
- **S3バケット名**: `cdk-hnb659fds-assets-123456789012-ap-northeast-1`
- **Bootstrapバージョン**: `21`

---

## Bootstrap のベストプラクティス

### 1. 環境ごとにBootstrap

開発環境と本番環境で異なるAWSアカウントを使用する場合、それぞれでBootstrapを実行：

```powershell
# 開発環境
cdk bootstrap aws://111111111111/ap-northeast-1

# 本番環境
cdk bootstrap aws://222222222222/ap-northeast-1
```

### 2. Bootstrap バージョンの管理

CDKのバージョンアップ時は、Bootstrapも更新：

```powershell
# CDKバージョンを確認
cdk --version

# Bootstrapを更新
cdk bootstrap --force
```

### 3. コスト最適化

Bootstrapで作成されるS3バケットには、ライフサイクルポリシーを設定してコストを削減：

```powershell
# S3バケットのライフサイクルポリシーを設定（例: 90日後に削除）
aws s3api put-bucket-lifecycle-configuration `
  --bucket cdk-hnb659fds-assets-123456789012-ap-northeast-1 `
  --lifecycle-configuration file://lifecycle-policy.json
```

**lifecycle-policy.json:**
```json
{
  "Rules": [
    {
      "Id": "DeleteOldAssets",
      "Status": "Enabled",
      "Prefix": "",
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
```

### 4. セキュリティ強化

Bootstrapで作成されるS3バケットに、暗号化とバージョニングを有効化：

```powershell
# S3バケットの暗号化を有効化
aws s3api put-bucket-encryption `
  --bucket cdk-hnb659fds-assets-123456789012-ap-northeast-1 `
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# S3バケットのバージョニングを有効化
aws s3api put-bucket-versioning `
  --bucket cdk-hnb659fds-assets-123456789012-ap-northeast-1 `
  --versioning-configuration Status=Enabled
```

---

## トラブルシューティング

### Bootstrap が完了しない

**症状**: Bootstrap が長時間（5分以上）完了しない

**対処法:**
1. CloudFormationコンソールでスタックの状態を確認
2. スタックイベントでエラーメッセージを確認
3. 必要に応じて、スタックをロールバックして再実行

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
aws s3 rm s3://cdk-hnb659fds-assets-123456789012-ap-northeast-1 --recursive
aws s3 rb s3://cdk-hnb659fds-assets-123456789012-ap-northeast-1
```

---

## 関連ドキュメント

- **環境変数管理**: `.kiro/steering/infrastructure/environment-variables.md`
- **デプロイチェックリスト**: `.kiro/steering/infrastructure/deployment-checklist.md`
- **AWS CDK公式ドキュメント**: https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html
- **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-094342-task9.3-environment-preparation.md`

---

## 実行結果（2026-02-08）

### 実行環境
- **CDKバージョン**: 2.1033.0 (build 1ec3310)
- **AWSリージョン**: ap-northeast-1
- **実行日時**: 2026-02-08 09:43:42

### 実行内容
1. ✅ CDKバージョン確認完了
2. ⏸️ Bootstrap実行は保留（Phase 2開始時に実施）
3. ✅ Bootstrap手順をドキュメント化

### 次回実施事項
- Phase 2開始時に `cdk bootstrap` を実行
- 実行結果をこのドキュメントに追記
- AWSアカウントIDを `.env.development` に記録

# APIキー登録スクリプト 使用方法

## 概要

`register-api-key.ps1`は、TDnet Data CollectorのAPIキーをAWS Secrets Managerに安全に登録するためのPowerShellスクリプトです。

## 機能

- APIキーをSecrets Managerに登録
- 既存のシークレットがある場合は更新
- 環境別（dev/prod）の管理
- タイムスタンプ付きでメタデータを保存

## 前提条件

### 1. AWS CLI

AWS CLIがインストールされ、設定されている必要があります。

```powershell
# AWS CLIバージョン確認
aws --version

# 出力例: aws-cli/2.x.x Python/3.x.x Windows/10 exe/AMD64
```

AWS CLIのインストール方法:
- [AWS CLI公式ドキュメント](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

### 2. AWS認証情報

AWS CLIが適切な認証情報で設定されている必要があります。

```powershell
# 認証情報の確認
aws sts get-caller-identity

# 出力例:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-user"
# }
```

認証情報の設定方法:
```powershell
aws configure
```

### 3. IAM権限

以下のIAM権限が必要です:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:DescribeSecret",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:*:secret:/tdnet/api-key-*"
    }
  ]
}
```

権限の確認方法:
```powershell
# IAMポリシーの確認
aws iam list-attached-user-policies --user-name your-user-name

# インラインポリシーの確認
aws iam list-user-policies --user-name your-user-name
```

### 4. PowerShell

- **Windows**: PowerShell 5.1以上
- **macOS/Linux**: PowerShell Core 7.0以上

```powershell
# PowerShellバージョン確認
$PSVersionTable.PSVersion
```

## 使用方法

### 基本的な使用方法

#### 1. 本番環境（prod）にAPIキーを登録

```powershell
# 対話形式（APIキーを入力プロンプトで入力）
.\scripts\register-api-key.ps1

# パラメータ指定
.\scripts\register-api-key.ps1 -Environment prod -ApiKeyValue "your-api-key-here"
```

#### 2. 開発環境（dev）にAPIキーを登録

```powershell
# 対話形式
.\scripts\register-api-key.ps1 -Environment dev

# パラメータ指定
.\scripts\register-api-key.ps1 -Environment dev -ApiKeyValue "your-dev-api-key"
```

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Environment` | いいえ | `prod` | 環境（`dev`または`prod`） |
| `-ApiKeyValue` | いいえ | （対話入力） | APIキーの値 |

### 実行例

#### 例1: 対話形式で本番環境に登録

```powershell
PS> .\scripts\register-api-key.ps1
========================================
TDnet APIキー登録スクリプト
========================================

環境: prod

APIキーを入力してください: **********************

Secrets Managerに登録中...
✅ シークレットを作成しました

✅ APIキーの登録が完了しました
```

#### 例2: パラメータ指定で開発環境に登録

```powershell
PS> .\scripts\register-api-key.ps1 -Environment dev -ApiKeyValue "dev-api-key-12345"
========================================
TDnet APIキー登録スクリプト
========================================

環境: dev

Secrets Managerに登録中...
✅ シークレットを作成しました

✅ APIキーの登録が完了しました
```

#### 例3: 既存のシークレットを更新

```powershell
PS> .\scripts\register-api-key.ps1 -Environment prod -ApiKeyValue "new-api-key-67890"
========================================
TDnet APIキー登録スクリプト
========================================

環境: prod

Secrets Managerに登録中...
✅ シークレットを更新しました

✅ APIキーの登録が完了しました
```

## 登録されるデータ構造

Secrets Managerに以下のJSON形式で保存されます:

```json
{
  "api_key": "your-api-key-here",
  "created_at": "2026-02-22T10:20:35Z",
  "environment": "prod"
}
```

## トラブルシューティング

### 問題1: AWS CLIが見つからない

**エラーメッセージ:**
```
aws : 用語 'aws' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として認識されません。
```

**解決策:**
1. AWS CLIがインストールされているか確認
2. 環境変数PATHにAWS CLIのパスが含まれているか確認
3. PowerShellを再起動

```powershell
# AWS CLIのパス確認
Get-Command aws

# 環境変数PATH確認
$env:PATH -split ';' | Select-String aws
```

### 問題2: 認証エラー

**エラーメッセージ:**
```
An error occurred (UnrecognizedClientException) when calling the DescribeSecret operation: 
The security token included in the request is invalid.
```

**解決策:**
1. AWS認証情報を確認
```powershell
aws sts get-caller-identity
```

2. 認証情報を再設定
```powershell
aws configure
```

3. 環境変数を確認
```powershell
$env:AWS_ACCESS_KEY_ID
$env:AWS_SECRET_ACCESS_KEY
$env:AWS_SESSION_TOKEN  # 一時認証情報を使用している場合
```

### 問題3: 権限不足

**エラーメッセージ:**
```
An error occurred (AccessDeniedException) when calling the CreateSecret operation: 
User: arn:aws:iam::123456789012:user/your-user is not authorized to perform: 
secretsmanager:CreateSecret on resource: /tdnet/api-key-prod
```

**解決策:**
1. IAM権限を確認
```powershell
# ユーザーのポリシーを確認
aws iam list-attached-user-policies --user-name your-user-name

# ポリシーの詳細を確認
aws iam get-policy-version --policy-arn arn:aws:iam::aws:policy/YourPolicyName --version-id v1
```

2. 必要な権限を追加（管理者に依頼）
   - `secretsmanager:CreateSecret`
   - `secretsmanager:DescribeSecret`
   - `secretsmanager:PutSecretValue`

### 問題4: リージョンエラー

**エラーメッセージ:**
```
An error occurred (ResourceNotFoundException) when calling the DescribeSecret operation: 
Secrets Manager can't find the specified secret.
```

**解決策:**
1. リージョンを確認
```powershell
aws configure get region
```

2. スクリプト内のリージョン設定を確認（デフォルト: `ap-northeast-1`）

3. 必要に応じてスクリプトの`$Region`変数を変更

### 問題5: APIキーが空

**エラーメッセージ:**
```
❌ APIキーが入力されていません
```

**解決策:**
1. 対話形式の場合、APIキーを入力
2. パラメータ指定の場合、`-ApiKeyValue`に値を設定
```powershell
.\scripts\register-api-key.ps1 -ApiKeyValue "your-api-key"
```

### 問題6: 文字化け

**症状:**
日本語メッセージが正しく表示されない

**解決策:**
1. PowerShellのエンコーディングを確認
```powershell
[Console]::OutputEncoding
$OutputEncoding
```

2. UTF-8に設定
```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
```

3. スクリプトがUTF-8 BOMなしで保存されているか確認

## セキュリティのベストプラクティス

### 1. APIキーの取り扱い

- **コマンド履歴に残さない**: `-ApiKeyValue`パラメータを使用する場合、コマンド履歴にAPIキーが残ります。対話形式の使用を推奨します。
- **環境変数を使用しない**: 環境変数にAPIキーを保存しないでください。
- **ログに記録しない**: APIキーをログファイルに記録しないでください。

### 2. コマンド履歴のクリア

```powershell
# PowerShell履歴をクリア
Clear-History

# 履歴ファイルを削除（PowerShell Core）
Remove-Item (Get-PSReadlineOption).HistorySavePath
```

### 3. Secrets Managerのアクセス制御

- 最小権限の原則に従う
- 本番環境と開発環境で異なるIAMロールを使用
- CloudTrailでアクセスログを監視

## 確認方法

### 登録されたシークレットの確認

```powershell
# シークレットの存在確認
aws secretsmanager describe-secret --secret-id /tdnet/api-key-prod --region ap-northeast-1

# シークレットの値を取得（注意: APIキーが表示されます）
aws secretsmanager get-secret-value --secret-id /tdnet/api-key-prod --region ap-northeast-1
```

### Lambda関数での使用確認

```powershell
# Lambda関数の環境変数を確認
aws lambda get-function-configuration --function-name tdnet-collector-prod --region ap-northeast-1
```

## 関連ドキュメント

- [AWS Secrets Manager公式ドキュメント](https://docs.aws.amazon.com/secretsmanager/)
- [AWS CLI公式ドキュメント](https://docs.aws.amazon.com/cli/)
- [TDnet Data Collector - セキュリティベストプラクティス](../.kiro/steering/security/security-best-practices.md)
- [TDnet Data Collector - 環境変数管理](../.kiro/steering/infrastructure/environment-variables.md)

## サポート

問題が解決しない場合は、以下を確認してください:

1. AWS CLIのバージョン
2. PowerShellのバージョン
3. IAM権限の詳細
4. エラーメッセージの全文
5. 実行したコマンド（APIキーは除く）

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-22 | 1.0.0 | 初版作成 |

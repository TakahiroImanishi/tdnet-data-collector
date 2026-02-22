# TDnet Data Collector - 運用手順書

**最終更新**: 2026-02-23
**対象**: システム運用者

## 目次

1. [環境情報の取得](#環境情報の取得)
2. [AWS SSO認証](#aws-sso認証)
3. [運用スクリプトの使用方法](#運用スクリプトの使用方法)
4. [環境切り替え](#環境切り替え)
5. [日常運用](#日常運用)

## 環境情報の取得

### 概要

TDnet Data Collectorの運用スクリプトは、CDK Stack Outputsから環境情報を自動取得します。手動で環境情報を検索する必要はありません。

### 自動取得される環境情報

| 情報 | 説明 | 例 |
|------|------|-----|
| `ApiEndpoint` | API Gateway URL | `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod` |
| `ApiKeySecretName` | Secrets Manager シークレット名 | `/tdnet/api-key-prod` |
| `Region` | AWSリージョン | `ap-northeast-1` |
| `Environment` | 環境名 | `prod` または `dev` |
| `StateMachineArn` | Step Functions ARN（Step Functions有効時のみ） | `arn:aws:states:...` |

### 環境情報の取得方法

運用スクリプトは内部で`Get-StackOutputs`関数を使用して、CDK Stackから環境情報を自動取得します。

```powershell
# スクリプト実行時に自動取得される
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21"

# 出力例:
# 環境情報を取得中...
# ✅ 環境情報を取得しました（環境: prod）
```

### キャッシュ機能

同一PowerShellセッション内では、環境情報がキャッシュされ、2回目以降の取得が高速化されます。

```powershell
# 1回目: CDK Stackから取得（数秒）
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21"

# 2回目以降: キャッシュから取得（即座）
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123
```

キャッシュをクリアするには、PowerShellセッションを再起動してください。

## AWS SSO認証

### 前提条件

AWS SSOプロファイル`manishi-awssso`が`~/.aws/config`に設定されていること。

### 認証手順

1. **AWS SSOログイン**

```powershell
aws sso login --profile manishi-awssso
```

ブラウザが開き、AWS SSOログイン画面が表示されます。

2. **認証状態の確認**

```powershell
aws sts get-caller-identity --profile manishi-awssso
```

成功すると、アカウントID、ユーザーID、ARNが表示されます。

3. **認証の有効期限**

AWS SSO認証は通常8時間有効です。期限切れの場合は再度ログインしてください。

### トラブルシューティング

**エラー: ExpiredToken**

```powershell
# 解決方法: 再ログイン
aws sso login --profile manishi-awssso
```

**エラー: InvalidClientTokenId**

```powershell
# 解決方法: AWS CLI設定を確認
aws configure list --profile manishi-awssso
```

## 運用スクリプトの使用方法

### 共通パラメータ

すべての運用スクリプトで以下のパラメータが使用可能です:

| パラメータ | 説明 | デフォルト | 必須 |
|-----------|------|-----------|------|
| `-Environment` | 環境名（dev または prod） | `prod` | いいえ |
| `-Profile` | AWS CLIプロファイル名 | なし | いいえ |

### 1. 手動データ収集

**用途**: 指定期間のデータを手動で収集

```powershell
# 基本的な使用方法（昨日〜今日のデータを10件収集）
.\scripts\manual-data-collection.ps1

# 期間を指定
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21" -EndDate "2026-02-22"

# 最大件数を指定
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21" -MaxItems 100

# 開発環境で実行
.\scripts\manual-data-collection.ps1 -Environment dev -StartDate "2026-02-21"

# AWS SSOプロファイルを指定
.\scripts\manual-data-collection.ps1 -Profile manishi-awssso -StartDate "2026-02-21"
```

**処理フロー**:
1. 環境情報を取得
2. APIキーを取得（環境変数 → Secrets Manager）
3. データ収集リクエストを送信
4. 実行状態をポーリング（最大30分）
5. 収集結果を確認

### 2. Step Functions実行状態確認

**用途**: Step Functions実行の状態を確認

```powershell
# 実行IDで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123

# 実行ARNで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionArn "arn:aws:states:..."

# JSON形式で出力（スクリプト連携用）
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123 -Json

# 開発環境で確認
.\scripts\check-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123

# ヘルプを表示
.\scripts\check-step-functions-execution.ps1 -Help
```

**出力項目**:
- 実行ID
- 状態（pending, running, completed, failed）
- 進捗率
- 収集件数、失敗件数
- 開始時刻、更新時刻、完了時刻
- エラーメッセージ（失敗時のみ）

### 3. Step Functions実行キャンセル

**用途**: Step Functions実行をキャンセル

```powershell
# 実行IDでキャンセル（確認プロンプト付き）
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123

# 実行ARNでキャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionArn "arn:aws:states:..."

# 確認プロンプトをスキップ（自動化用）
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Force

# キャンセル理由を指定
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Reason "誤実行のため"

# 開発環境でキャンセル
.\scripts\cancel-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123

# ヘルプを表示
.\scripts\cancel-step-functions-execution.ps1 -Help
```

**安全機能**:
- デフォルトで確認プロンプトを表示
- キャンセル理由の記録
- エラー時の詳細なガイダンス

### 4. データ範囲取得

**用途**: 本番APIから指定日のデータを取得・検証

```powershell
# 基本的な使用方法
.\scripts\fetch-data-range.ps1 -Date "2026-02-21"

# オフセットとリミットを指定
.\scripts\fetch-data-range.ps1 -Date "2026-02-21" -Offset 100 -Limit 50

# 開発環境で実行
.\scripts\fetch-data-range.ps1 -Environment dev -Date "2026-02-21"
```

**出力**:
- コンソールにデータ一覧を表示
- `data-{Date}-offset{Offset}-limit{Limit}.json`ファイルに保存

## 環境切り替え

### 本番環境（prod）

デフォルトで本番環境が使用されます。

```powershell
# 明示的に指定
.\scripts\manual-data-collection.ps1 -Environment prod -StartDate "2026-02-21"

# 省略可能（デフォルト）
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21"
```

### 開発環境（dev）

開発環境を使用する場合は、`-Environment dev`を指定します。

```powershell
.\scripts\manual-data-collection.ps1 -Environment dev -StartDate "2026-02-21"
.\scripts\check-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123
.\scripts\cancel-step-functions-execution.ps1 -Environment dev -ExecutionId exec_123
.\scripts\fetch-data-range.ps1 -Environment dev -Date "2026-02-21"
```

### 環境の確認

スクリプト実行時に環境名が表示されます。

```powershell
.\scripts\manual-data-collection.ps1 -Environment dev -StartDate "2026-02-21"

# 出力:
# 環境情報を取得中...
# ✅ 環境情報を取得しました（環境: dev）
```

## 日常運用

### データ収集の実行

1. **AWS SSOログイン**

```powershell
aws sso login --profile manishi-awssso
```

2. **データ収集実行**

```powershell
# 昨日のデータを収集
.\scripts\manual-data-collection.ps1 -StartDate (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

# 特定期間のデータを収集
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-21" -EndDate "2026-02-22" -MaxItems 1000
```

3. **実行状態の確認**

```powershell
# スクリプトが自動的にポーリングしますが、手動で確認することも可能
.\scripts\check-step-functions-execution.ps1 -ExecutionId <実行ID>
```

### 実行のキャンセル

誤って実行した場合や、長時間実行が続く場合はキャンセルできます。

```powershell
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID> -Reason "誤実行のため"
```

### データの確認

```powershell
# 収集したデータを確認
.\scripts\fetch-data-range.ps1 -Date "2026-02-21" -Limit 10
```

### CloudWatch Logsの確認

詳細なログはCloudWatch Logsで確認できます。

```powershell
# AWS Management Consoleで確認
# CloudWatch > ロググループ > /aws/lambda/tdnet-*
```

## ベストプラクティス

### 1. 環境変数の活用

APIキーを環境変数に設定すると、Secrets Managerへのアクセスが不要になります。

```powershell
# 一時的に設定（現在のセッションのみ）
$env:TDNET_API_KEY = "your-api-key"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
```

### 2. AWS SSOプロファイルの指定

複数のAWSアカウントを使用する場合は、プロファイルを明示的に指定します。

```powershell
.\scripts\manual-data-collection.ps1 -Profile manishi-awssso -StartDate "2026-02-21"
```

### 3. エラー発生時の対応

エラーメッセージには解決方法が含まれています。メッセージをよく読んで対応してください。

```powershell
# エラー例:
# ❌ エラー: スタックが見つかりません
# スタック名: tdnet-api-prod
#
# 解決方法:
# 1. スタックがデプロイされているか確認してください:
#    aws cloudformation list-stacks --region ap-northeast-1 ...
```

### 4. ログの確認

問題が発生した場合は、CloudWatch Logsで詳細なログを確認してください。

## 関連ドキュメント

- [トラブルシューティングガイド](./troubleshooting.md)
- [システムアーキテクチャ](../02-architecture/system-architecture.md)
- [Step Functions設計](../../designs/step-functions-architecture.md)
- [データ操作スクリプト](../../../.kiro/steering/development/data-scripts.md)

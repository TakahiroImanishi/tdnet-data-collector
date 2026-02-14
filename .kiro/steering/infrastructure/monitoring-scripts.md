---
inclusion: fileMatch
fileMatchPattern: "scripts/{deploy-dashboard,check-iam-permissions}.ps1"
---

# 監視・ダッシュボードスクリプト

## deploy-dashboard.ps1

**目的**: React製ダッシュボードをS3にデプロイし、CloudFront経由で配信

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Environment` | × | `dev` | デプロイ環境（dev/prod） |
| `-SkipBuild` | × | `false` | ビルドをスキップ |

### 使用例

```powershell
# 開発環境にデプロイ（ビルド実行）
.\scripts\deploy-dashboard.ps1

# 本番環境にデプロイ
.\scripts\deploy-dashboard.ps1 -Environment prod

# ビルドスキップ（既にビルド済みの場合）
.\scripts\deploy-dashboard.ps1 -SkipBuild
```

### 実行フロー

1. AWS認証情報確認（`aws sts get-caller-identity`）
2. ダッシュボードビルド（`npm run build`、`-SkipBuild`で省略可）
3. S3バケット存在確認（`tdnet-dashboard-{env}-{accountId}`）
4. S3へファイルアップロード（`aws s3 sync`、キャッシュ制御付き）
5. CloudFront Invalidation実行（`/*`パス）
6. ダッシュボードURL表示

### トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| AWS認証エラー | 認証情報未設定 | `aws configure`実行 |
| S3バケット未存在 | CDKスタック未デプロイ | `.\scripts\deploy-split-stacks.ps1`実行 |
| ビルド失敗 | 依存関係エラー | `dashboard/`で`npm install`実行 |
| CloudFront未存在 | CDKスタック未デプロイ | 警告のみ、S3デプロイは完了 |

## check-iam-permissions.ps1

**目的**: Lambda IAMロールの`cloudwatch:PutMetricData`権限確認

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Environment` | × | `prod` | 確認対象環境 |
| `-Region` | × | `ap-northeast-1` | AWSリージョン |

### 使用例

```powershell
# 本番環境のCollector Lambda確認
.\scripts\check-iam-permissions.ps1

# 開発環境確認
.\scripts\check-iam-permissions.ps1 -Environment dev

# 別リージョン確認
.\scripts\check-iam-permissions.ps1 -Region us-east-1
```

### 確認内容

1. Lambda関数存在確認（`tdnet-collector-{env}`）
2. IAMロール取得
3. インラインポリシー確認（`cloudwatch:PutMetricData`検索）
4. アタッチポリシー確認（`cloudwatch:PutMetricData`検索）
5. 結果サマリー表示

### トラブルシューティング

| エラー | 原因 | 解決策 |
|--------|------|--------|
| Lambda未存在 | 環境未デプロイ | `.\scripts\deploy-split-stacks.ps1 -Environment {env}`実行 |
| 権限不足 | IAMポリシー未設定 | CDK再デプロイ（`MonitoredLambda` Construct使用） |
| AWS CLI エラー | 認証情報エラー | `aws configure`確認 |

### 出力例

```
[OK] cloudwatch:PutMetricData permission is configured
Conclusion: Task 31.2.6.4 is already completed.
```

または

```
[ERROR] cloudwatch:PutMetricData permission is NOT configured
Action: Redeploy to production environment is required.
  Command: .\scripts\deploy-split-stacks.ps1 -Environment prod
```

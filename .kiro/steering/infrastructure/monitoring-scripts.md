---
inclusion: fileMatch
fileMatchPattern: "scripts/{deploy-dashboard,check-iam-permissions}.ps1"
---

# 監視・ダッシュボードスクリプト

## deploy-dashboard.ps1

React製ダッシュボードをS3/CloudFront経由で配信

```powershell
.\scripts\deploy-dashboard.ps1 [-Environment dev|prod] [-SkipBuild]
```

実行フロー: AWS認証確認 → ビルド → S3アップロード → CloudFront Invalidation → URL表示

## check-iam-permissions.ps1

Lambda IAMロールの`cloudwatch:PutMetricData`権限確認

```powershell
.\scripts\check-iam-permissions.ps1 [-Environment prod] [-Region ap-northeast-1]
```

確認内容: Lambda関数存在 → IAMロール取得 → インライン/アタッチポリシー確認 → 結果表示

## トラブルシューティング

| エラー | 解決策 |
|--------|--------|
| AWS認証エラー | `aws configure` |
| S3バケット未存在 | `.\scripts\deploy-split-stacks.ps1` |
| ビルド失敗 | `dashboard/`で`npm install` |
| Lambda未存在 | `.\scripts\deploy-split-stacks.ps1 -Environment {env}` |
| 権限不足 | CDK再デプロイ（`MonitoredLambda` Construct使用） |

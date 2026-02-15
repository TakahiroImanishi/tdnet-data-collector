# スモークテスト手順書

**最終更新**: 2026-02-14  
**対象環境**: 開発環境・本番環境

## 概要

スモークテストは、デプロイ後にシステムの基本機能が正常に動作することを確認するための最小限のテストです。本番環境デプロイ後、必ずこのテストを実行してください。

## 前提条件

- AWS CLIがインストールされている
- 適切なAWSプロファイルが設定されている（`--profile dev` または `--profile prod`）
- APIキーが発行されている（Secrets Managerに保存済み）

## テスト項目

### 1. インフラ確認（5分）

#### 1.1 CloudFormationスタック確認

**4スタック構成の場合（推奨）**:

```powershell
# 全スタックの状態を確認
$stacks = @("TdnetFoundation-dev", "TdnetCompute-dev", "TdnetApi-dev", "TdnetMonitoring-dev")
foreach ($stack in $stacks) {
    $status = aws cloudformation describe-stacks --stack-name $stack --profile dev --query "Stacks[0].StackStatus" --output text
    Write-Host "$stack : $status"
}

# 期待結果: すべてのスタックが "CREATE_COMPLETE" または "UPDATE_COMPLETE"
```

**単一スタック構成の場合**:

```powershell
# スタックが正常にデプロイされていることを確認
aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-dev --profile dev

# 期待結果: StackStatus が "CREATE_COMPLETE" または "UPDATE_COMPLETE"
```

#### 1.2 Lambda関数確認

```powershell
# Lambda関数がデプロイされていることを確認
aws lambda list-functions --profile dev | Select-String "tdnet"

# 期待結果: 7個のLambda関数が表示される
# - tdnet-collector-dev
# - tdnet-query-dev
# - tdnet-export-dev
# - tdnet-collect-dev
# - tdnet-collect-status-dev
# - tdnet-export-status-dev
# - tdnet-pdf-download-dev
```

#### 1.3 DynamoDBテーブル確認

```powershell
# DynamoDBテーブルが作成されていることを確認
aws dynamodb list-tables --profile dev | Select-String "tdnet"

# 期待結果: 3個のテーブルが表示される
# - tdnet_disclosures-dev
# - tdnet_executions-dev
# - tdnet_export_status-dev
```

#### 1.4 S3バケット確認

```powershell
# S3バケットが作成されていることを確認
aws s3 ls --profile dev | Select-String "tdnet"

# 期待結果: 4個のバケットが表示される
# - tdnet-data-collector-pdfs-dev-{account-id}
# - tdnet-data-collector-exports-dev-{account-id}
# - tdnet-dashboard-dev-{account-id}
# - tdnet-cloudtrail-logs-{account-id}
```

### 2. API動作確認（10分）

#### 2.1 APIエンドポイント取得

**4スタック構成の場合（推奨）**:

```powershell
# API Gateway URLを取得（TdnetApiスタックから）
$API_URL = aws cloudformation describe-stacks --stack-name TdnetApi-dev --profile dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
Write-Host "API URL: $API_URL"
```

**単一スタック構成の場合**:

```powershell
# API Gateway URLを取得
$API_URL = aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-dev --profile dev --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
Write-Host "API URL: $API_URL"
```

#### 2.2 APIキー取得

```powershell
# Secrets ManagerからAPIキーを取得
$API_KEY = aws secretsmanager get-secret-value --secret-id /tdnet/api-key --profile dev --query SecretString --output text
```

#### 2.3 ヘルスチェック

```powershell
# ヘルスチェックエンドポイントを呼び出し
curl -X GET "$API_URL/health" -H "x-api-key: $API_KEY"

# 期待結果:
# {
#   "status": "healthy",
#   "timestamp": "2026-02-14T09:00:00.000Z"
# }
```

#### 2.4 統計情報取得

```powershell
# 統計情報エンドポイントを呼び出し
curl -X GET "$API_URL/stats" -H "x-api-key: $API_KEY"

# 期待結果:
# {
#   "total_disclosures": 0,
#   "total_companies": 0,
#   "latest_disclosure_date": null
# }
```

#### 2.5 開示情報検索（空結果）

```powershell
# 開示情報検索エンドポイントを呼び出し
curl -X GET "$API_URL/disclosures?limit=10" -H "x-api-key: $API_KEY"

# 期待結果:
# {
#   "status": "success",
#   "data": {
#     "disclosures": [],
#     "pagination": {
#       "total": 0,
#       "limit": 10,
#       "offset": 0
#     }
#   }
# }
```

### 3. データ収集テスト（15分）

#### 3.1 オンデマンド収集実行

```powershell
# 過去1日分のデータを収集
$START_DATE = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$END_DATE = (Get-Date).ToString("yyyy-MM-dd")

$BODY = @{
  start_date = $START_DATE
  end_date = $END_DATE
} | ConvertTo-Json

curl -X POST "$API_URL/collect" `
  -H "x-api-key: $API_KEY" `
  -H "Content-Type: application/json" `
  -d $BODY

# 期待結果:
# {
#   "status": "success",
#   "data": {
#     "execution_id": "exec_20260214_090000_abc123",
#     "status": "running",
#     "message": "Data collection started"
#   }
# }
```

#### 3.2 実行状態確認

```powershell
# execution_idを変数に保存
$EXECUTION_ID = "exec_20260214_090000_abc123"

# 実行状態を確認（30秒ごとに確認）
curl -X GET "$API_URL/collect/$EXECUTION_ID" -H "x-api-key: $API_KEY"

# 期待結果（進行中）:
# {
#   "status": "success",
#   "data": {
#     "execution_id": "exec_20260214_090000_abc123",
#     "status": "running",
#     "progress": 50,
#     "collected_count": 25,
#     "failed_count": 0
#   }
# }

# 期待結果（完了）:
# {
#   "status": "success",
#   "data": {
#     "execution_id": "exec_20260214_090000_abc123",
#     "status": "completed",
#     "progress": 100,
#     "collected_count": 50,
#     "failed_count": 0
#   }
# }
```

#### 3.3 収集データ確認

```powershell
# 収集したデータを検索
curl -X GET "$API_URL/disclosures?limit=10" -H "x-api-key: $API_KEY"

# 期待結果: 収集したデータが表示される
```

### 4. エクスポート機能テスト（10分）

#### 4.1 エクスポートリクエスト

```powershell
$EXPORT_BODY = @{
  start_date = $START_DATE
  end_date = $END_DATE
  format = "json"
} | ConvertTo-Json

curl -X POST "$API_URL/exports" `
  -H "x-api-key: $API_KEY" `
  -H "Content-Type: application/json" `
  -d $EXPORT_BODY

# 期待結果:
# {
#   "status": "success",
#   "data": {
#     "export_id": "export_20260214_090000_xyz789",
#     "status": "pending",
#     "message": "Export job created"
#   }
# }
```

#### 4.2 エクスポート状態確認

```powershell
# export_idを変数に保存
$EXPORT_ID = "export_20260214_090000_xyz789"

# エクスポート状態を確認（30秒ごとに確認）
curl -X GET "$API_URL/exports/$EXPORT_ID" -H "x-api-key: $API_KEY"

# 期待結果（完了）:
# {
#   "status": "success",
#   "data": {
#     "export_id": "export_20260214_090000_xyz789",
#     "status": "completed",
#     "progress": 100,
#     "download_url": "https://..."
#   }
# }
```

#### 4.3 エクスポートファイルダウンロード

```powershell
# 署名付きURLからファイルをダウンロード
$DOWNLOAD_URL = "https://..."
curl -o export.json $DOWNLOAD_URL

# ファイルサイズを確認
Get-Item export.json | Select-Object Name, Length
```

### 5. 監視・アラート確認（5分）

#### 5.1 CloudWatch Logs確認

```powershell
# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow --profile dev

# 期待結果: エラーログがないこと
```

#### 5.2 CloudWatch Metrics確認

```powershell
# カスタムメトリクスを確認
aws cloudwatch get-metric-statistics `
  --namespace TDnet/Collector `
  --metric-name DisclosuresCollected `
  --start-time (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") `
  --end-time (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") `
  --period 3600 `
  --statistics Sum `
  --profile dev

# 期待結果: メトリクスが記録されていること
```

#### 5.3 CloudWatch Alarms確認

```powershell
# アラーム状態を確認
aws cloudwatch describe-alarms --profile dev | Select-String "tdnet"

# 期待結果: すべてのアラームが "OK" 状態
```

### 6. Webダッシュボード確認（5分）

#### 6.1 CloudFront URL取得

**4スタック構成の場合（推奨）**:

```powershell
# CloudFront Distribution URLを取得（TdnetFoundationスタックから）
$DASHBOARD_URL = aws cloudformation describe-stacks --stack-name TdnetFoundation-dev --profile dev --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text
Write-Host "Dashboard URL: $DASHBOARD_URL"
```

**単一スタック構成の場合**:

```powershell
# CloudFront Distribution URLを取得
$DASHBOARD_URL = aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-dev --profile dev --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text
Write-Host "Dashboard URL: $DASHBOARD_URL"
```

#### 6.2 ダッシュボードアクセス

```powershell
# ブラウザでダッシュボードを開く
Start-Process $DASHBOARD_URL
```

**確認項目**:
- [ ] ダッシュボードが表示される
- [ ] 開示情報一覧が表示される
- [ ] 検索・フィルタリングが機能する
- [ ] PDFダウンロードボタンが表示される
- [ ] エクスポートボタンが表示される

## テスト結果記録

### テスト実行日時
- 実行日: YYYY-MM-DD
- 実行者: [名前]
- 環境: [dev/prod]

### テスト結果サマリー

| テスト項目 | 結果 | 備考 |
|-----------|------|------|
| 1. インフラ確認 | ✅/❌ | |
| 2. API動作確認 | ✅/❌ | |
| 3. データ収集テスト | ✅/❌ | |
| 4. エクスポート機能テスト | ✅/❌ | |
| 5. 監視・アラート確認 | ✅/❌ | |
| 6. Webダッシュボード確認 | ✅/❌ | |

### 問題点・改善事項

（問題があった場合は記録）

## トラブルシューティング

### APIキーエラー（401 Unauthorized）

**原因**: APIキーが正しく設定されていない

**解決策**:
```powershell
# Secrets Managerにシークレットが存在するか確認
aws secretsmanager describe-secret --secret-id /tdnet/api-key --profile dev

# シークレットが存在しない場合は作成
aws secretsmanager create-secret --name /tdnet/api-key --secret-string "your-api-key" --profile dev
```

### Lambda関数タイムアウト

**原因**: Lambda関数の実行時間が長すぎる

**解決策**:
- CloudWatch Logsでエラーログを確認
- タイムアウト設定を確認（15分以内）
- 並列度を調整（デフォルト5並列）

### DynamoDBスロットリング

**原因**: DynamoDBの書き込み容量不足

**解決策**:
- オンデマンドモードに変更（既に設定済み）
- 再試行ロジックが機能していることを確認

## 関連ドキュメント

- [本番環境デプロイチェックリスト](../04-deployment/production-deployment-checklist.md)
- [負荷テストガイド](./load-testing-guide.md)
- [トラブルシューティングガイド](../05-operations/troubleshooting.md)


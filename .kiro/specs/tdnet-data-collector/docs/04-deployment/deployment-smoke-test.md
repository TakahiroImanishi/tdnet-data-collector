# デプロイとスモークテストガイド

**作成日**: 2026-02-08  
**目的**: 開発環境デプロイ後のスモークテスト実施方法

---

## 前提条件

- AWS CLI、Node.js 20.x、CDKがインストール済み
- AWS認証情報が設定済み（`aws configure`）
- プロジェクト依存関係がインストール済み（`npm install`）

---

## デプロイ手順

**詳細なデプロイ手順は以下を参照:**
- [デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)
- [環境構築ガイド](./environment-setup.md)

**基本的なデプロイコマンド:**

```powershell
# CDK Synthでテンプレート生成
cdk synth --context environment=dev

# 差分確認
cdk diff --context environment=dev

# デプロイ実行
cdk deploy --context environment=dev
```

---

## スモークテストチェックリスト

### Lambda関数

- [ ] Collector関数が正常に実行される
- [ ] エラーログがない
- [ ] 実行時間が目標値以内（< 5分）
- [ ] メモリ使用率が適切（< 80%）

**テスト方法:**
```powershell
# Lambda関数を手動実行
$testEvent = @{
    mode = "on-demand"
    start_date = "2024-01-15"
    end_date = "2024-01-15"
} | ConvertTo-Json

aws lambda invoke `
    --function-name tdnet-collector-dev `
    --payload $testEvent `
    --cli-binary-format raw-in-base64-out `
    response.json

# レスポンス確認
Get-Content response.json | ConvertFrom-Json
```

**期待される結果:**
```json
{
  "execution_id": "exec_...",
  "status": "success",
  "collected_count": X,
  "failed_count": 0
}
```

### DynamoDB

- [ ] Disclosuresテーブルにデータが保存される
- [ ] date_partitionが正しく生成される
- [ ] GSI（DatePartitionIndex）が機能する
- [ ] ExecutionStatusテーブルが更新される

**テスト方法:**
```powershell
# アイテム数確認
aws dynamodb scan --table-name tdnet-disclosures-dev --select COUNT

# 最新データ取得
aws dynamodb scan `
    --table-name tdnet-disclosures-dev `
    --limit 5 `
    --query "Items[*].[disclosure_id.S, company_name.S, title.S]" `
    --output table
```

### S3

- [ ] PDFファイルが正しく保存される
- [ ] ファイルパスが正しい（YYYY/MM/DD/disclosure_id.pdf）
- [ ] ファイルサイズが0より大きい

**テスト方法:**
```powershell
# オブジェクト一覧取得
aws s3 ls s3://tdnet-pdfs-dev-<unique-suffix>/ --recursive

# 特定ファイルダウンロード
aws s3 cp s3://tdnet-pdfs-dev-<unique-suffix>/2024/01/15/TD20240115001.pdf ./test.pdf

# ファイルサイズ確認
Get-Item ./test.pdf | Select-Object Name, Length
```

### CloudWatch

- [ ] ログが正しく出力される
- [ ] メトリクスが正しく記録される
- [ ] アラームが設定されている

**テスト方法:**
```powershell
# ロググループ確認
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/tdnet')].logGroupName"

# 最新ログ取得
$logGroup = "/aws/lambda/tdnet-collector-dev"
$latestStream = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --query "logStreams[0].logStreamName" `
    --output text

aws logs get-log-events `
    --log-group-name $logGroup `
    --log-stream-name $latestStream `
    --limit 50
```

### IAM

- [ ] Lambda実行ロールが最小権限になっている
- [ ] DynamoDB、S3へのアクセス権限が適切
- [ ] CloudWatch Logsへの書き込み権限がある

---

## トラブルシューティング

### デプロイ失敗

**症状**: `cdk deploy` でエラー

**解決策:**
```powershell
# エラー詳細確認
cdk deploy --context environment=dev --verbose

# CloudFormationイベント確認
aws cloudformation describe-stack-events --stack-name TdnetDataCollectorStack-dev --max-items 20
```

### Lambda実行エラー

**症状**: Lambda関数の実行でエラー

**解決策:**
```powershell
# Lambda設定確認
aws lambda get-function --function-name tdnet-collector-dev

# 環境変数確認
aws lambda get-function-configuration --function-name tdnet-collector-dev --query "Environment.Variables"

# ログ確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow
```

### DynamoDBデータ未保存

**症状**: DynamoDBテーブルが空

**解決策:**
```powershell
# テーブル状態確認
aws dynamodb describe-table --table-name tdnet-disclosures-dev

# Lambda実行ログ確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow
```

---

## 次のステップ

1. **本番環境デプロイ**: 開発環境で問題がなければ本番環境にデプロイ
2. **CI/CD構築**: GitHub Actionsで自動デプロイを設定
3. **監視強化**: CloudWatch Dashboardとアラームを充実

---

## 関連ドキュメント

- [デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)
- [環境構築ガイド](./environment-setup.md)
- [CI/CD設定ガイド](./ci-cd-setup.md)
- [監視とアラート](../../.kiro/steering/infrastructure/monitoring-alerts.md)


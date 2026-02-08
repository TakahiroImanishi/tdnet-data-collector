# 開発環境デプロイとスモークテストガイド

**作成日**: 2026-02-08  
**目的**: 開発環境へのデプロイ手順とスモークテストの実施方法を文書化

## 前提条件

- AWS CLIがインストールされている
- AWS認証情報が設定されている（`aws configure`）
- Node.js 20.x、npm/yarnがインストールされている
- CDKがインストールされている（`npm install -g aws-cdk`）
- プロジェクトの依存関係がインストールされている（`npm install`）

## デプロイ前チェックリスト

### 1. コードの品質確認

```powershell
# すべてのテストを実行
npm test

# TypeScriptのコンパイルエラーを確認
npm run build

# Lintエラーを確認
npm run lint
```

**期待される結果**:
- すべてのテストが成功（29テスト以上）
- コンパイルエラーなし
- Lintエラーなし

### 2. 環境変数の確認

`.env.dev` ファイルを作成（開発環境用）:

```env
# AWS設定
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=<your-aws-account-id>

# 環境
ENVIRONMENT=dev

# DynamoDB
DYNAMODB_TABLE_NAME=tdnet-disclosures-dev
EXECUTION_STATUS_TABLE_NAME=tdnet-execution-status-dev

# S3
S3_BUCKET_NAME=tdnet-pdfs-dev-<unique-suffix>

# Lambda
LAMBDA_MEMORY_SIZE=512
LAMBDA_TIMEOUT=900

# ログ
LOG_LEVEL=debug

# アラート
ALERT_EMAIL=<your-email@example.com>
```

### 3. CDK Bootstrapの確認

初回デプロイ時のみ実行:

```powershell
# CDK Bootstrapを実行（初回のみ）
cdk bootstrap aws://<account-id>/ap-northeast-1

# Bootstrap状態を確認
aws cloudformation describe-stacks --stack-name CDKToolkit
```

## デプロイ手順

### 1. CDK Synthの実行

CloudFormationテンプレートを生成:

```powershell
# CDK Synthを実行
cdk synth --context environment=dev

# 生成されたテンプレートを確認
Get-Content cdk.out/TdnetDataCollectorStack-dev.template.json
```

**確認ポイント**:
- Lambda関数が正しく定義されているか
- DynamoDBテーブルが正しく定義されているか
- S3バケットが正しく定義されているか
- IAMロールが最小権限になっているか

### 2. CDK Diffの実行

既存のスタックとの差分を確認:

```powershell
# 差分を確認
cdk diff --context environment=dev
```

**確認ポイント**:
- 意図しないリソースの削除がないか
- セキュリティグループの変更がないか
- IAMポリシーの変更が適切か

### 3. CDK Deployの実行

開発環境にデプロイ:

```powershell
# デプロイを実行
cdk deploy --context environment=dev --require-approval never

# または、承認プロンプトを表示
cdk deploy --context environment=dev
```

**デプロイ時間**: 約5-10分

**期待される出力**:
```
✅  TdnetDataCollectorStack-dev

Outputs:
TdnetDataCollectorStack-dev.CollectorFunctionArn = arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collector-dev
TdnetDataCollectorStack-dev.DisclosuresTableName = tdnet-disclosures-dev
TdnetDataCollectorStack-dev.PdfBucketName = tdnet-pdfs-dev-abc123

Stack ARN:
arn:aws:cloudformation:ap-northeast-1:123456789012:stack/TdnetDataCollectorStack-dev/...
```

### 4. デプロイ後の確認

```powershell
# CloudFormationスタックの状態を確認
aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-dev

# Lambda関数の一覧を確認
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'tdnet')].FunctionName"

# DynamoDBテーブルの一覧を確認
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'tdnet')]"

# S3バケットの一覧を確認
aws s3 ls | Select-String "tdnet"
```

## スモークテストの実施

### 1. Lambda関数の手動実行

#### Collector関数のテスト

```powershell
# テストイベントを作成
$testEvent = @{
    mode = "on-demand"
    start_date = "2024-01-15"
    end_date = "2024-01-15"
} | ConvertTo-Json

# Lambda関数を実行
aws lambda invoke `
    --function-name tdnet-collector-dev `
    --payload $testEvent `
    --cli-binary-format raw-in-base64-out `
    response.json

# レスポンスを確認
Get-Content response.json | ConvertFrom-Json
```

**期待される結果**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "status": "success",
  "message": "Collected X disclosures, 0 failed",
  "collected_count": X,
  "failed_count": 0
}
```

### 2. DynamoDBデータの確認

```powershell
# Disclosuresテーブルのアイテム数を確認
aws dynamodb scan `
    --table-name tdnet-disclosures-dev `
    --select COUNT

# 最新の開示情報を取得
aws dynamodb scan `
    --table-name tdnet-disclosures-dev `
    --limit 5 `
    --query "Items[*].[disclosure_id.S, company_name.S, title.S]" `
    --output table
```

**期待される結果**:
- アイテム数が0以上
- disclosure_id、company_name、titleが正しく格納されている

### 3. S3データの確認

```powershell
# S3バケット内のオブジェクト一覧を取得
aws s3 ls s3://tdnet-pdfs-dev-<unique-suffix>/ --recursive

# 特定のPDFファイルをダウンロード
aws s3 cp s3://tdnet-pdfs-dev-<unique-suffix>/2024/01/15/TD20240115001.pdf ./test.pdf

# ファイルサイズを確認
Get-Item ./test.pdf | Select-Object Name, Length
```

**期待される結果**:
- PDFファイルが正しく保存されている
- ファイルサイズが0より大きい

### 4. CloudWatch Logsの確認

```powershell
# ロググループ一覧を取得
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/tdnet')].logGroupName"

# 最新のログストリームを取得
$logGroup = "/aws/lambda/tdnet-collector-dev"
$latestStream = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --query "logStreams[0].logStreamName" `
    --output text

# ログイベントを取得
aws logs get-log-events `
    --log-group-name $logGroup `
    --log-stream-name $latestStream `
    --limit 50
```

**期待される結果**:
- エラーログがない
- 構造化ログが正しく出力されている
- 実行時間が適切（< 5分）

### 5. CloudWatch Metricsの確認

```powershell
# Lambda実行時間メトリクスを取得
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Duration `
    --dimensions Name=FunctionName,Value=tdnet-collector-dev `
    --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Average,Maximum

# Lambda エラー数メトリクスを取得
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Errors `
    --dimensions Name=FunctionName,Value=tdnet-collector-dev `
    --start-time (Get-Date).AddHours(-1).ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Sum
```

**期待される結果**:
- Duration: 平均 < 300秒、最大 < 900秒
- Errors: 0

## スモークテストチェックリスト

### Lambda関数

- [ ] Collector関数が正常に実行される
- [ ] エラーログがない
- [ ] 実行時間が適切（< 5分）
- [ ] メモリ使用率が適切（< 80%）

### DynamoDB

- [ ] Disclosuresテーブルにデータが保存される
- [ ] date_partitionが正しく生成される
- [ ] GSI（DatePartitionIndex）が機能する
- [ ] ExecutionStatusテーブルが更新される

### S3

- [ ] PDFファイルが正しく保存される
- [ ] ファイルパスが正しい（YYYY/MM/DD/disclosure_id.pdf）
- [ ] ファイルサイズが0より大きい

### CloudWatch

- [ ] ログが正しく出力される
- [ ] メトリクスが正しく記録される
- [ ] アラームが設定されている（エラー率、実行時間）

### IAM

- [ ] Lambda実行ロールが最小権限になっている
- [ ] DynamoDB、S3へのアクセス権限が適切
- [ ] CloudWatch Logsへの書き込み権限がある

## トラブルシューティング

### 1. デプロイが失敗する

**症状**: `cdk deploy` でエラーが発生

**解決策**:
```powershell
# エラーメッセージを確認
cdk deploy --context environment=dev --verbose

# CloudFormationスタックのイベントを確認
aws cloudformation describe-stack-events --stack-name TdnetDataCollectorStack-dev --max-items 20

# スタックをロールバック
aws cloudformation delete-stack --stack-name TdnetDataCollectorStack-dev
```

### 2. Lambda関数が実行されない

**症状**: Lambda関数の実行でエラーが発生

**解決策**:
```powershell
# Lambda関数の設定を確認
aws lambda get-function --function-name tdnet-collector-dev

# 環境変数を確認
aws lambda get-function-configuration --function-name tdnet-collector-dev --query "Environment.Variables"

# IAMロールを確認
aws lambda get-function --function-name tdnet-collector-dev --query "Configuration.Role"
```

### 3. DynamoDBにデータが保存されない

**症状**: DynamoDBテーブルが空

**解決策**:
```powershell
# テーブルの状態を確認
aws dynamodb describe-table --table-name tdnet-disclosures-dev

# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow

# IAMポリシーを確認
aws iam get-role-policy --role-name tdnet-collector-dev-role --policy-name DynamoDBAccess
```

### 4. S3にファイルが保存されない

**症状**: S3バケットが空

**解決策**:
```powershell
# バケットの存在を確認
aws s3 ls s3://tdnet-pdfs-dev-<unique-suffix>/

# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow

# IAMポリシーを確認
aws iam get-role-policy --role-name tdnet-collector-dev-role --policy-name S3Access
```

## デプロイ後の監視

### CloudWatch Dashboardの作成

```powershell
# ダッシュボードを作成（JSON定義）
aws cloudwatch put-dashboard --dashboard-name tdnet-dev --dashboard-body file://dashboard-dev.json
```

`dashboard-dev.json`:

```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Invocations"}],
          [".", "Errors", {"stat": "Sum", "label": "Errors"}],
          [".", "Duration", {"stat": "Average", "label": "Avg Duration"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-northeast-1",
        "title": "Lambda Metrics",
        "yAxis": {
          "left": {
            "min": 0
          }
        }
      }
    }
  ]
}
```

### アラームの設定

```powershell
# エラー率アラームを作成
aws cloudwatch put-metric-alarm `
    --alarm-name tdnet-collector-dev-errors `
    --alarm-description "Collector function error rate" `
    --metric-name Errors `
    --namespace AWS/Lambda `
    --statistic Sum `
    --period 300 `
    --evaluation-periods 1 `
    --threshold 1 `
    --comparison-operator GreaterThanThreshold `
    --dimensions Name=FunctionName,Value=tdnet-collector-dev
```

## ロールバック手順

デプロイに問題がある場合、以下の手順でロールバック:

```powershell
# 前のバージョンのスタックにロールバック
aws cloudformation rollback-stack --stack-name TdnetDataCollectorStack-dev

# または、スタックを削除して再デプロイ
aws cloudformation delete-stack --stack-name TdnetDataCollectorStack-dev

# スタック削除の完了を待機
aws cloudformation wait stack-delete-complete --stack-name TdnetDataCollectorStack-dev

# 再デプロイ
cdk deploy --context environment=dev
```

## 次のステップ

1. **本番環境デプロイ**: 開発環境で問題がなければ、本番環境にデプロイ
2. **CI/CD構築**: GitHub Actionsで自動デプロイを設定
3. **監視強化**: CloudWatch Dashboardとアラームを充実
4. **パフォーマンステスト**: 負荷テストを実施

## 参考リンク

- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda公式ドキュメント](https://docs.aws.amazon.com/lambda/)
- [CloudWatch公式ドキュメント](https://docs.aws.amazon.com/cloudwatch/)
- [デプロイチェックリスト](.kiro/steering/infrastructure/deployment-checklist.md)

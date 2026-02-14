# 本番環境デプロイチェックリスト

**作成日**: 2026-02-14  
**タスク**: 31.1 本番環境へのデプロイ

---

## デプロイ前確認

### 1. コード品質確認

- [x] TypeScriptビルドが成功（`npm run build`）
  - **必須**: `dist/` フォルダにビルドファイルが生成されていること
  - **確認コマンド**: `Test-Path dist/src/lambda/*/index.js`
- [x] すべてのテストが成功（Phase 1-4完了）
- [x] テストカバレッジが目標値達成（85.72%）
- [x] Lintエラーなし

### 2. ドキュメント確認

- [x] README.md最新
- [x] API仕様書最新（openapi.yaml）
- [x] 運用マニュアル作成済み
- [x] デプロイ手順書作成済み

### 3. セキュリティ確認

- [x] IAMロール最小権限化
- [x] Secrets Manager設定
- [x] WAF設定
- [x] CloudTrail有効化
- [x] S3バケット暗号化
- [x] DynamoDB暗号化

### 4. 監視・アラート確認

- [x] CloudWatch Logs設定
- [x] カスタムメトリクス設定
- [x] CloudWatch Alarms設定
- [x] SNS通知設定
- [x] CloudWatch Dashboard作成

---

## 本番環境デプロイ手順

### デプロイ方式の選択

本プロジェクトでは2つのデプロイ方式を提供しています：

1. **単一スタックデプロイ** - 従来の方式（全リソースを1つのスタックで管理）
2. **分割スタックデプロイ** - 推奨方式（4つのスタックに分割、デプロイ時間70-90%短縮）

**推奨**: 新規デプロイは分割スタック方式を使用してください。詳細は [スタック分割設計](./stack-split-design.md) を参照。

### 前提条件

1. **AWS本番アカウントへのアクセス**
   - AWS CLIで本番アカウントにログイン
   - 適切なIAM権限を保有

2. **環境変数の準備**
   - `.env.production`ファイルを作成
   - 本番環境のAWSアカウントIDを設定
   - 本番環境のリージョンを設定

3. **Secrets Managerの準備**
   - TDnet APIキーを登録
   - シークレットARNを取得

### ステップ1: CDK Bootstrap（初回のみ）

```powershell
# 本番環境のAWSアカウントIDを取得
$accountId = aws sts get-caller-identity --query Account --output text

# CDK Bootstrapを実行
cd cdk
npx cdk bootstrap aws://$accountId/ap-northeast-1
```

**確認**: CDKToolkitスタックが作成されたことを確認

```powershell
aws cloudformation describe-stacks --stack-name CDKToolkit
```

### ステップ2: Secrets Manager設定

```powershell
# TDnet APIキーを登録
aws secretsmanager create-secret `
    --name /tdnet/api-key `
    --description "TDnet API Key for production environment" `
    --secret-string '{"api_key":"YOUR_ACTUAL_API_KEY_HERE"}' `
    --region ap-northeast-1

# シークレットARNを取得
$secretArn = aws secretsmanager describe-secret `
    --secret-id /tdnet/api-key `
    --region ap-northeast-1 `
    --query ARN `
    --output text

Write-Host "Secret ARN: $secretArn"
```

### ステップ3: 環境変数設定

`.env.production`ファイルを編集：

```env
ENVIRONMENT=prod
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012  # 実際のアカウントIDに置き換え
API_KEY_SECRET_ARN=arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:/tdnet/api-key  # 実際のARNに置き換え
```

### ステップ4: TypeScriptビルド（必須）

```powershell
# Lambda関数をビルド
npm run build
```

**確認**: `dist/` フォルダにビルドファイルが生成されること

```powershell
# ビルド結果確認
Test-Path dist/src/lambda/dlq-processor/index.js
Test-Path dist/src/lambda/collector/index.js
Test-Path dist/src/lambda/query/index.js
```

**重要**: このステップを省略すると、Lambda関数のデプロイに失敗します。

### ステップ5: CDK Synth（検証）

```powershell
cd cdk
npx cdk synth --context environment=prod
```

**確認**: エラーなくCloudFormationテンプレートが生成されること

### ステップ6: CDK Diff（差分確認）

```powershell
cd cdk
npx cdk diff --context environment=prod
```

**確認**: 意図しないリソースの削除がないこと

### ステップ7: CDK Deploy（デプロイ実行）

#### 方法A: 分割スタックデプロイ（推奨）

```powershell
# 全スタックを依存関係順にデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
```

**実行時間**: 約12-18分（初回）、約3-5分（更新時）

**デプロイ順序**:
1. Foundation Stack (基盤層) - 5-7分
2. Compute Stack (Lambda関数) - 3-5分
3. API Stack (API Gateway) - 2-3分
4. Monitoring Stack (監視) - 2-3分

**個別スタックのデプロイ**:
```powershell
# Lambda関数のみ更新
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute

# API設定のみ更新
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack api
```

#### 方法B: 単一スタックデプロイ（従来方式）

```powershell
cd cdk
npx cdk deploy --context environment=prod --require-approval always
```

**実行時間**: 約15-20分

**確認ポイント**:
- CloudFormationスタックが`CREATE_COMPLETE`または`UPDATE_COMPLETE`
- すべてのLambda関数が作成された
- すべてのDynamoDBテーブルが作成された
- すべてのS3バケットが作成された

### ステップ8: Webダッシュボードのデプロイ（必須）

#### 8.1 ダッシュボードのビルド

```powershell
# dashboardディレクトリに移動
cd dashboard

# 依存関係のインストール（初回のみ）
npm install

# 本番環境用にビルド
npm run build
```

**確認**: `dashboard/build/` フォルダにビルドファイルが生成されること

```powershell
# ビルド結果確認
Test-Path dashboard/build/index.html
Test-Path dashboard/build/static
```

#### 8.2 S3へのアップロード

```powershell
# プロジェクトルートに戻る
cd ..

# デプロイスクリプトを実行（本番環境）
.\scripts\deploy-dashboard.ps1 -Environment prod
```

**実行内容**:
1. ダッシュボードのビルド（`npm run build`）
2. S3バケット（`tdnet-dashboard-prod-{account-id}`）へのアップロード
3. CloudFront Invalidation実行

**実行時間**: 約2-3分

#### 8.3 CloudFront URLの確認

```powershell
# CloudFront Distribution IDを取得
$accountId = aws sts get-caller-identity --query Account --output text
$bucketName = "tdnet-dashboard-prod-$accountId"
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$bucketName.s3.amazonaws.com']].Id | [0]" --output text

# CloudFront URLを取得
$distributionDomain = aws cloudfront get-distribution --id $distributionId --query "Distribution.DomainName" --output text
Write-Host "ダッシュボードURL: https://$distributionDomain"
```

#### 8.4 ダッシュボードの動作確認

ブラウザで CloudFront URL にアクセスし、以下を確認：

- [ ] ダッシュボードが正常に表示される
- [ ] API接続が正常に動作する（API Key認証）
- [ ] データ収集機能が動作する
- [ ] 開示情報検索機能が動作する
- [ ] PDFダウンロード機能が動作する
- [ ] データエクスポート機能が動作する

**トラブルシューティング**:
- "Access Denied"エラー → S3バケットポリシーとCloudFront OAIを確認
- API接続エラー → API GatewayのCORS設定とAPIキーを確認
- 404エラー → CloudFront Invalidationが完了しているか確認

### ステップ9: デプロイ後確認

#### 9.1 リソース確認

```powershell
# Lambda関数確認
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'tdnet')].FunctionName"

# DynamoDBテーブル確認
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'tdnet')]"

# S3バケット確認
aws s3 ls | Select-String "tdnet"

# CloudFront Distribution確認
aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'tdnet-dashboard')].{Id:Id,DomainName:DomainName,Status:Status}"
```

#### 9.2 CloudWatch Logs確認

```powershell
# ロググループ確認
aws logs describe-log-groups --query "logGroups[?starts_with(logGroupName, '/aws/lambda/tdnet')].logGroupName"
```

#### 9.3 CloudWatch Alarms確認

```powershell
# アラーム状態確認
aws cloudwatch describe-alarms --query "MetricAlarms[?starts_with(AlarmName, 'tdnet')].{Name:AlarmName,State:StateValue}"
```

---

## スモークテスト

### テスト1: Collector Lambda手動実行

```powershell
# テストイベント作成
$testEvent = @{
    mode = "on-demand"
    start_date = (Get-Date).ToString("yyyy-MM-dd")
    end_date = (Get-Date).ToString("yyyy-MM-dd")
} | ConvertTo-Json

# Lambda実行
aws lambda invoke `
    --function-name tdnet-collector-prod `
    --payload $testEvent `
    --cli-binary-format raw-in-base64-out `
    response.json

# レスポンス確認
Get-Content response.json | ConvertFrom-Json
```

**期待結果**: `status: "success"`、`collected_count > 0`

### テスト2: DynamoDBデータ確認

```powershell
# アイテム数確認
aws dynamodb scan `
    --table-name tdnet_disclosures-prod `
    --select COUNT

# 最新データ確認
aws dynamodb scan `
    --table-name tdnet_disclosures-prod `
    --limit 5 `
    --query "Items[*].[disclosure_id.S, company_name.S, title.S]" `
    --output table
```

### テスト3: S3データ確認

```powershell
# PDFファイル確認
aws s3 ls s3://tdnet-data-collector-pdfs-prod-$accountId/ --recursive
```

### テスト4: API Gateway確認

```powershell
# API URL取得
$apiUrl = aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text

# ヘルスチェック
curl -X GET "$apiUrl/health"
```

**期待結果**: `{"status":"healthy"}`

---

## ロールバック手順

デプロイに問題がある場合：

### 分割スタックのロールバック

#### 方法1: 特定スタックのロールバック

```powershell
# 問題のあるスタックのみロールバック
aws cloudformation rollback-stack --stack-name TdnetCompute-prod
```

#### 方法2: 全スタックの削除と再作成

```powershell
# 全スタックを依存関係の逆順で削除
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action destroy -Stack all

# 再デプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack all
```

### 単一スタックのロールバック

#### 方法1: CloudFormationロールバック

```powershell
aws cloudformation rollback-stack --stack-name TdnetDataCollectorStack-prod
```

#### 方法2: スタック削除と再作成

```powershell
# スタック削除
aws cloudformation delete-stack --stack-name TdnetDataCollectorStack-prod

# 削除完了待機
aws cloudformation wait stack-delete-complete --stack-name TdnetDataCollectorStack-prod

# 再デプロイ
cd cdk
npx cdk deploy --context environment=prod
```

---

## トラブルシューティング

### 問題1: CDK Bootstrapが失敗

**原因**: IAM権限不足

**解決策**: 
- CloudFormation、Lambda、DynamoDB、S3、IAMの権限を確認
- AdministratorAccessまたは同等の権限が必要

### 問題2: Secrets Managerアクセスエラー

**原因**: シークレットが存在しない、またはARNが間違っている

**解決策**:
```powershell
# シークレット確認
aws secretsmanager describe-secret --secret-id /tdnet/api-key

# シークレット再作成
aws secretsmanager delete-secret --secret-id /tdnet/api-key --force-delete-without-recovery
aws secretsmanager create-secret --name /tdnet/api-key --secret-string '{"api_key":"YOUR_KEY"}'
```

### 問題3: Lambda実行エラー

**原因**: 環境変数未設定、IAM権限不足

**解決策**:
```powershell
# Lambda設定確認
aws lambda get-function-configuration --function-name tdnet-collector-prod

# CloudWatch Logsでエラー確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow
```

---

## デプロイ完了後のアクション

1. **監視開始**
   - CloudWatch Dashboardを確認
   - アラート設定を確認

2. **初回データ収集**
   - 手動でデータ収集を実行
   - 結果を確認

3. **日次バッチ設定**
   - EventBridgeスケジュールを確認（Phase 5で実施）

4. **運用チームへの引き継ぎ**
   - 運用マニュアルを共有
   - アラート対応手順を共有

---

## 関連ドキュメント

- [本番環境デプロイ手順書](./production-deployment-guide.md)
- [スタック分割設計](./stack-split-design.md) - 推奨デプロイ方式
- [スモークテストガイド](./smoke-test-guide.md)
- [運用マニュアル](./operations-manual.md)
- [トラブルシューティングガイド](./troubleshooting-guide.md)
- [ロールバック手順](./rollback-procedures.md)

---

**最終更新**: 2026-02-14  
**作成者**: Kiro AI Assistant

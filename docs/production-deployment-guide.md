# 本番環境デプロイ手順書

**作成日**: 2026-02-14  
**対象環境**: 本番環境（Production）  
**目的**: TDnet Data Collectorを本番環境に安全にデプロイする手順を文書化

---

## 目次

1. [前提条件](#前提条件)
2. [デプロイ前準備](#デプロイ前準備)
3. [CDK Bootstrap実行手順](#cdk-bootstrap実行手順)
4. [環境変数設定](#環境変数設定)
5. [デプロイ実行](#デプロイ実行)
7. [デプロイ後の動作確認](#デプロイ後の動作確認)
8. [ロールバック手順](#ロールバック手順)
9. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必須ツール

- ✅ AWS CLI（v2.x以上）
- ✅ Node.js 20.x
- ✅ npm または yarn
- ✅ AWS CDK CLI（`npm install -g aws-cdk`）
- ✅ PowerShell 7.x以上（Windows）または bash（Linux/Mac）

### AWS権限

本番環境デプロイには以下の権限が必要です：

- CloudFormation（スタック作成・更新・削除）
- Lambda（関数作成・更新）
- DynamoDB（テーブル作成・更新）
- S3（バケット作成・管理）
- IAM（ロール・ポリシー作成）
- CloudWatch（ログ・メトリクス・アラーム）
- API Gateway（API作成・デプロイ）

### 確認コマンド

```powershell
# AWS CLIバージョン確認
aws --version

# Node.jsバージョン確認
node --version

# CDKバージョン確認
cdk --version

# AWS認証情報確認
aws sts get-caller-identity
```

**期待される出力例**:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

---

## デプロイ前準備

### 1. コード品質確認

```powershell
# プロジェクトルートに移動
cd C:\path\to\investment_analysis_opopo

# 依存関係のインストール
npm install

# すべてのテストを実行
npm test
```

**期待される結果**:
- ✅ すべてのテストが成功（29テスト以上）
- ✅ コンパイルエラーなし
- ✅ Lintエラーなし

### 2. TypeScriptビルド確認

```powershell
# TypeScriptコンパイル
npm run build
```

### 3. Lintチェック

```powershell
# Lintエラー確認
npm run lint
```

### 4. デプロイチェックリスト

- [ ] すべてのテストが成功
- [ ] TypeScriptコンパイルエラーなし
- [ ] Lintエラーなし
- [ ] 開発環境で動作確認済み
- [ ] コードレビュー完了
- [ ] ドキュメント更新済み
- [ ] バックアップ計画確認済み

---

## CDK Bootstrap実行手順

### Bootstrap概要

CDK Bootstrapは、CDKアプリケーションをデプロイするために必要なAWSリソースを初期化します。

**作成されるリソース**:
- S3バケット（CDKアセット保存用）
- ECRリポジトリ（Dockerイメージ保存用）
- IAMロール（CDKデプロイ用）
- CloudFormationスタック（`CDKToolkit`）

### Bootstrap実行（初回のみ）

```powershell
# 本番環境用のBootstrap実行
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-northeast-1 --profile prod

# または、環境変数から自動取得
$accountId = aws sts get-caller-identity --query Account --output text
cdk bootstrap aws://$accountId/ap-northeast-1 --profile prod
```

**実行時間**: 約2-3分

**期待される出力**:
```
 ✅  Environment aws://123456789012/ap-northeast-1 bootstrapped.
```

### Bootstrap状態の確認

```powershell
# CDKToolkitスタックの確認
aws cloudformation describe-stacks --stack-name CDKToolkit --profile prod

# S3バケットの確認
aws s3 ls | Select-String "cdk"
```

**注意事項**:
- ⚠️ Bootstrapは各AWSアカウント・リージョンごとに1回のみ実行
- ⚠️ 既にBootstrap済みの場合は再実行不要
- ⚠️ CDKバージョンアップ時は再実行を推奨

---

## 環境変数設定

### 1. .env.productionファイルの作成

プロジェクトルートに`.env.production`ファイルを作成します。

```powershell
# テンプレートをコピー
Copy-Item .env.production.template .env.production

# エディタで開く
code .env.production
```

### 2. 必須項目の設定

`.env.production`ファイルを編集し、以下の項目を設定します：

```env
# ========================================
# Environment
# ========================================
ENVIRONMENT=prod

# ========================================
# AWS Configuration
# ========================================
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012  # ← 実際のAWSアカウントIDに置き換え

# ========================================
# DynamoDB Configuration
# ========================================
DYNAMODB_TABLE_NAME=tdnet_disclosures_prod
DYNAMODB_EXECUTIONS_TABLE=tdnet_executions_prod
DYNAMODB_EXPORT_STATUS_TABLE=tdnet_export_status_prod

# ========================================
# S3 Configuration
# ========================================
S3_BUCKET_NAME=tdnet-data-collector-pdfs-prod-123456789012  # ← アカウントIDを追加
S3_EXPORTS_BUCKET=tdnet-data-collector-exports-prod-123456789012
S3_DASHBOARD_BUCKET=tdnet-dashboard-prod-123456789012

# ========================================
# Monitoring & Alerts
# ========================================
ALERT_SNS_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts-prod  # ← 実際のARNに置き換え
ERROR_RATE_THRESHOLD=10
DURATION_THRESHOLD=840
COLLECTION_SUCCESS_RATE_THRESHOLD=95

# ========================================
# Feature Flags
# ========================================
ENABLE_DETAILED_LOGGING=false
ENABLE_METRICS=true
ENABLE_XRAY_TRACING=true
```

### 3. 環境変数の検証

```powershell
# 環境変数ファイルの存在確認
if (Test-Path ".env.production") {
    Write-Host "✅ .env.production file exists" -ForegroundColor Green
} else {
    Write-Host "❌ .env.production file not found" -ForegroundColor Red
    exit 1
}

# 必須項目の確認
$requiredVars = @(
    "AWS_ACCOUNT_ID",
    "AWS_REGION"
)

$envContent = Get-Content ".env.production"
foreach ($var in $requiredVars) {
    if ($envContent -match "^$var=.+") {
        Write-Host "✅ $var is set" -ForegroundColor Green
    } else {
        Write-Host "❌ $var is not set" -ForegroundColor Red
    }
}
```

**詳細手順**: [環境変数設定ガイド](./ssm-parameter-store-setup.md)を参照

---

## デプロイ実行

### 方法1: 自動化スクリプトの使用（推奨）

```powershell
# 本番環境デプロイスクリプトを実行
.\scripts\deploy-prod.ps1
```

**スクリプトの実行内容**:
1. `.env.production`ファイルの読み込み
2. 環境変数の設定
3. 本番環境デプロイの確認プロンプト（1回目）
4. CDK Synthによるスタック検証
5. 最終確認プロンプト（2回目：`DEPLOY`と入力）
6. CDK Deployの実行
7. デプロイ結果の表示
8. デプロイ後チェックリストの表示

**実行時間**: 約10-15分

### 方法2: 手動デプロイ

#### ステップ1: CDK Synthの実行

CloudFormationテンプレートを生成し、構文エラーをチェックします。

```powershell
# CDKディレクトリに移動
cd cdk

# CDK Synthを実行
npx cdk synth --context environment=prod
```

**確認ポイント**:
- ✅ Lambda関数が正しく定義されている
- ✅ DynamoDBテーブルが正しく定義されている
- ✅ S3バケットが正しく定義されている
- ✅ IAMロールが最小権限になっている
- ✅ 環境変数が正しく設定されている

#### ステップ2: CDK Diffの実行

既存のスタックとの差分を確認します（初回デプロイ時はスキップ可）。

```powershell
# 差分を確認
npx cdk diff --context environment=prod
```

**確認ポイント**:
- ⚠️ 意図しないリソースの削除がないか
- ⚠️ セキュリティグループの変更が適切か
- ⚠️ IAMポリシーの変更が適切か
- ⚠️ データベーステーブルの削除がないか

#### ステップ3: CDK Deployの実行

本番環境にデプロイします。

```powershell
cd cdk

# デプロイを実行（承認プロンプトあり）
npx cdk deploy --context environment=prod --require-approval always

# または、承認プロンプトなし（非推奨）
npx cdk deploy --context environment=prod --require-approval never
```

**デプロイ中の出力例**:
```
TdnetDataCollectorStack-prod: deploying...
[0%] start: Publishing 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region
[50%] success: Published 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region
[50%] start: Publishing 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region
[100%] success: Published 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef:current_account-current_region
TdnetDataCollectorStack-prod: creating CloudFormation changeset...

 ✅  TdnetDataCollectorStack-prod

✨  Deployment time: 456.78s

Outputs:
TdnetDataCollectorStack-prod.CollectorFunctionArn = arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-collector-prod
TdnetDataCollectorStack-prod.DisclosuresTableName = tdnet_disclosures_prod
TdnetDataCollectorStack-prod.PdfBucketName = tdnet-data-collector-pdfs-prod-123456789012
TdnetDataCollectorStack-prod.ApiEndpoint = https://abc123xyz.execute-api.ap-northeast-1.amazonaws.com/prod

Stack ARN:
arn:aws:cloudformation:ap-northeast-1:123456789012:stack/TdnetDataCollectorStack-prod/12345678-1234-1234-1234-123456789012
```

#### ステップ4: デプロイ結果の確認

```powershell
# CloudFormationスタックの状態を確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --query "Stacks[0].StackStatus"

# 期待される出力: "CREATE_COMPLETE" または "UPDATE_COMPLETE"
```

---

## Webダッシュボードのデプロイ

### 概要

Webダッシュボードは、TDnet Data Collectorの管理画面です。React製のSPAで、S3 + CloudFrontでホスティングされます。

### 前提条件

- CDKスタックのデプロイが完了していること
- S3バケット（`tdnet-dashboard-prod-{account-id}`）が作成されていること
- CloudFront Distributionが作成されていること
- Node.js 20.x以上がインストールされていること

### デプロイ手順

#### ステップ1: ダッシュボードのビルド

```powershell
# dashboardディレクトリに移動
cd dashboard

# 依存関係のインストール（初回のみ）
npm install

# 本番環境用にビルド
npm run build
```

**確認ポイント**:
- ✅ `dashboard/build/` フォルダが作成される
- ✅ `dashboard/build/index.html` が存在する
- ✅ `dashboard/build/static/` フォルダが存在する
- ✅ ビルドエラーがない

**ビルド時間**: 約1-2分

#### ステップ2: S3へのアップロード

```powershell
# プロジェクトルートに戻る
cd ..

# デプロイスクリプトを実行（本番環境）
.\scripts\deploy-dashboard.ps1 -Environment prod
```

**スクリプトの実行内容**:
1. AWS Account IDを取得
2. ダッシュボードをビルド（`npm run build`）
3. S3バケット（`tdnet-dashboard-prod-{account-id}`）の存在確認
4. ビルドファイルをS3にアップロード
   - 静的ファイル: `Cache-Control: public, max-age=31536000`（1年）
   - `index.html`: `Cache-Control: public, max-age=60`（1分）
5. CloudFront Distribution IDを取得
6. CloudFront Invalidation実行（`/*`）
7. CloudFront URLを表示

**実行時間**: 約2-3分

**期待される出力**:
```
AWS Account IDを取得中...
Account ID: 123456789012

ダッシュボードをビルド中...
ビルド完了

S3バケットの存在確認中...
S3バケット確認完了

S3へファイルをアップロード中...
index.htmlをアップロード中...
S3アップロード完了

CloudFront Distribution IDを取得中...
Distribution ID: E1234567890ABC

CloudFront Invalidationを実行中...
Invalidation ID: I1234567890ABC

デプロイ完了!
CloudFront URLでダッシュボードにアクセスできます

ダッシュボードURL: https://d1vjw7l2clz6ji.cloudfront.net
```

#### ステップ3: CloudFront Invalidationの完了待機

CloudFront Invalidationは通常5-10分かかります。完了を待機する場合：

```powershell
# Invalidation状態を確認
$distributionId = "E1234567890ABC"  # 実際のDistribution IDに置き換え
$invalidationId = "I1234567890ABC"  # 実際のInvalidation IDに置き換え

aws cloudfront get-invalidation `
    --distribution-id $distributionId `
    --id $invalidationId `
    --query "Invalidation.Status"

# 期待される出力: "InProgress" → "Completed"
```

#### ステップ4: ダッシュボードの動作確認

ブラウザでCloudFront URLにアクセスし、以下を確認：

**基本動作確認**:
- [ ] ダッシュボードが正常に表示される
- [ ] ログイン画面が表示される（APIキー入力）
- [ ] APIキーを入力してログインできる

**機能確認**:
- [ ] データ収集機能が動作する（POST /collect）
- [ ] 開示情報検索機能が動作する（GET /disclosures）
- [ ] PDFダウンロード機能が動作する（GET /disclosures/{id}/pdf）
- [ ] データエクスポート機能が動作する（POST /exports）
- [ ] 実行状態確認機能が動作する（GET /collect/{execution_id}）

**パフォーマンス確認**:
- [ ] ページ読み込み時間 < 3秒
- [ ] API応答時間 < 2秒
- [ ] PDFダウンロード時間 < 5秒

### トラブルシューティング

#### 問題1: "Access Denied"エラー

**症状**: CloudFront URLにアクセスすると"Access Denied"エラーが表示される

**原因**:
- S3バケットポリシーが正しく設定されていない
- CloudFront OAI（Origin Access Identity）が正しく設定されていない
- ダッシュボードがS3にアップロードされていない

**解決策**:

```powershell
# S3バケットの存在確認
$accountId = aws sts get-caller-identity --query Account --output text
aws s3 ls s3://tdnet-dashboard-prod-$accountId/

# S3バケットポリシーの確認
aws s3api get-bucket-policy --bucket tdnet-dashboard-prod-$accountId

# CloudFront OAIの確認
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'tdnet-dashboard')].Id | [0]" --output text
aws cloudfront get-distribution --id $distributionId --query "Distribution.DistributionConfig.Origins.Items[0].S3OriginConfig.OriginAccessIdentity"

# ダッシュボードを再デプロイ
.\scripts\deploy-dashboard.ps1 -Environment prod
```

#### 問題2: API接続エラー

**症状**: ダッシュボードは表示されるが、API呼び出しでエラーが発生

**原因**:
- API GatewayのCORS設定が正しくない
- APIキーが正しくない
- API Gatewayエンドポイントが正しくない

**解決策**:

```powershell
# API Gatewayエンドポイントを確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
    --output text

# APIキーを確認
aws secretsmanager get-secret-value `
    --secret-id /tdnet/api-key `
    --query SecretString `
    --output text

# CORS設定を確認（API Gatewayコンソールで確認）
# https://console.aws.amazon.com/apigateway/home?region=ap-northeast-1
```

#### 問題3: 404エラー

**症状**: 特定のページで404エラーが発生

**原因**:
- CloudFront Invalidationが完了していない
- SPAのルーティング設定が正しくない

**解決策**:

```powershell
# CloudFront Invalidationを再実行
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, 'tdnet-dashboard')].Id | [0]" --output text
aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*"

# Invalidation完了を待機（5-10分）
aws cloudfront wait invalidation-completed --distribution-id $distributionId --id <invalidation-id>
```

#### 問題4: ビルドエラー

**症状**: `npm run build`でエラーが発生

**原因**:
- Node.jsバージョンが古い
- 依存関係が正しくインストールされていない
- TypeScriptコンパイルエラー

**解決策**:

```powershell
# Node.jsバージョン確認
node --version  # 20.x以上が必要

# 依存関係を再インストール
cd dashboard
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# ビルド再実行
npm run build
```

### デプロイ後の確認

#### CloudFront URLの取得

```powershell
# CloudFront Distribution IDを取得
$accountId = aws sts get-caller-identity --query Account --output text
$bucketName = "tdnet-dashboard-prod-$accountId"
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$bucketName.s3.amazonaws.com']].Id | [0]" --output text

# CloudFront URLを取得
$distributionDomain = aws cloudfront get-distribution --id $distributionId --query "Distribution.DomainName" --output text
Write-Host "ダッシュボードURL: https://$distributionDomain"
```

#### アクセスログの確認

```powershell
# CloudFrontアクセスログを確認（ログが有効化されている場合）
aws s3 ls s3://tdnet-cloudfront-logs-prod-$accountId/ --recursive
```

---

## デプロイ後の動作確認

### 1. リソース確認

#### Lambda関数の確認

```powershell
# Lambda関数の一覧を取得
aws lambda list-functions `
    --profile prod `
    --query "Functions[?starts_with(FunctionName, 'tdnet')].FunctionName"

# 期待される出力:
# [
#     "tdnet-collector-prod",
#     "tdnet-query-prod",
#     "tdnet-export-prod",
#     ...
# ]
```

#### DynamoDBテーブルの確認

```powershell
# DynamoDBテーブルの一覧を取得
aws dynamodb list-tables `
    --profile prod `
    --query "TableNames[?starts_with(@, 'tdnet')]"

# 期待される出力:
# [
#     "tdnet_disclosures_prod",
#     "tdnet_executions_prod",
#     "tdnet_export_status_prod"
# ]
```

#### S3バケットの確認

```powershell
# S3バケットの一覧を取得
aws s3 ls --profile prod | Select-String "tdnet"

# 期待される出力:
# 2026-02-14 08:43:14 tdnet-data-collector-pdfs-prod-123456789012
# 2026-02-14 08:43:14 tdnet-data-collector-exports-prod-123456789012
```

### 2. スモークテスト

#### テスト1: Collector Lambda関数の手動実行

```powershell
# テストイベントを作成
$testEvent = @{
    mode = "on-demand"
    start_date = (Get-Date).ToString("yyyy-MM-dd")
    end_date = (Get-Date).ToString("yyyy-MM-dd")
} | ConvertTo-Json

# Lambda関数を実行
aws lambda invoke `
    --function-name tdnet-collector-prod `
    --payload $testEvent `
    --cli-binary-format raw-in-base64-out `
    --profile prod `
    response.json

# レスポンスを確認
Get-Content response.json | ConvertFrom-Json | Format-List
```

**期待される結果**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "status": "success",
  "message": "Collected X disclosures, 0 failed",
  "collected_count": 5,
  "failed_count": 0
}
```

#### テスト2: DynamoDBデータの確認

```powershell
# Disclosuresテーブルのアイテム数を確認
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --select COUNT `
    --profile prod

# 最新の開示情報を取得（5件）
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --limit 5 `
    --profile prod `
    --query "Items[*].[disclosure_id.S, company_name.S, title.S]" `
    --output table
```

**期待される結果**:
- アイテム数が0以上
- disclosure_id、company_name、titleが正しく格納されている

#### テスト3: S3データの確認

```powershell
# S3バケット内のオブジェクト一覧を取得
aws s3 ls s3://tdnet-data-collector-pdfs-prod-123456789012/ --recursive --profile prod

# 特定のPDFファイルをダウンロード（テスト用）
aws s3 cp s3://tdnet-data-collector-pdfs-prod-123456789012/2026/02/14/TD20260214001.pdf ./test.pdf --profile prod

# ファイルサイズを確認
Get-Item ./test.pdf | Select-Object Name, Length
```

**期待される結果**:
- PDFファイルが正しく保存されている
- ファイルサイズが0より大きい
- ファイルパスが正しい（YYYY/MM/DD/disclosure_id.pdf）

#### テスト4: CloudWatch Logsの確認

```powershell
# ロググループ一覧を取得
aws logs describe-log-groups `
    --profile prod `
    --query "logGroups[?starts_with(logGroupName, '/aws/lambda/tdnet')].logGroupName"

# 最新のログストリームを取得
$logGroup = "/aws/lambda/tdnet-collector-prod"
$latestStream = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --profile prod `
    --query "logStreams[0].logStreamName" `
    --output text

# ログイベントを取得（最新50件）
aws logs get-log-events `
    --log-group-name $logGroup `
    --log-stream-name $latestStream `
    --limit 50 `
    --profile prod
```

**確認ポイント**:
- ✅ エラーログがない
- ✅ 構造化ログが正しく出力されている
- ✅ 実行時間が適切（< 5分）
- ✅ メモリ使用率が適切（< 80%）

#### テスト5: CloudWatch Metricsの確認

```powershell
# Lambda実行時間メトリクスを取得
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Duration `
    --dimensions Name=FunctionName,Value=tdnet-collector-prod `
    --start-time (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Average,Maximum `
    --profile prod

# Lambda エラー数メトリクスを取得
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Errors `
    --dimensions Name=FunctionName,Value=tdnet-collector-prod `
    --start-time (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Sum `
    --profile prod
```

**期待される結果**:
- Duration: 平均 < 300秒、最大 < 900秒
- Errors: 0

### 3. スモークテストチェックリスト

- [ ] Lambda関数が正常に実行される
- [ ] DynamoDBにデータが保存される
- [ ] S3にPDFファイルが保存される
- [ ] CloudWatch Logsにログが出力される
- [ ] CloudWatch Metricsが記録される
- [ ] エラーログがない
- [ ] 実行時間が適切
- [ ] メモリ使用率が適切

### 4. API Gatewayエンドポイントのテスト

```powershell
# API Gatewayエンドポイントを取得
$apiEndpoint = aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
    --output text

Write-Host "API Endpoint: $apiEndpoint"

# ヘルスチェックエンドポイントをテスト
Invoke-RestMethod -Uri "$apiEndpoint/health" -Method Get

# 開示情報取得エンドポイントをテスト
Invoke-RestMethod -Uri "$apiEndpoint/disclosures?date=2026-02-14" -Method Get
```

**期待される結果**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-14T08:43:14Z"
}
```

---

## ロールバック手順

デプロイに問題がある場合、以下の手順でロールバックします。

### 方法1: CloudFormationスタックのロールバック

```powershell
# スタックをロールバック（前のバージョンに戻す）
aws cloudformation rollback-stack `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

# ロールバックの進行状況を確認
aws cloudformation describe-stack-events `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --max-items 20
```

### 方法2: 特定のGitタグにロールバック

```powershell
# 利用可能なタグを確認
git tag -l

# 特定のバージョンにチェックアウト
git checkout v1.2.3

# 再デプロイ
.\scripts\deploy-prod.ps1
```

### 方法3: スタックの削除と再作成

**⚠️ 警告**: この方法はすべてのデータを削除します。本番環境では慎重に実行してください。

```powershell
# スタックを削除
aws cloudformation delete-stack `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

# スタック削除の完了を待機
aws cloudformation wait stack-delete-complete `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

# 再デプロイ
.\scripts\deploy-prod.ps1
```

### ロールバック後の確認

```powershell
# スタックの状態を確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --query "Stacks[0].StackStatus"

# Lambda関数のバージョンを確認
aws lambda get-function `
    --function-name tdnet-collector-prod `
    --profile prod `
    --query "Configuration.Version"

# スモークテストを再実行
# （上記「デプロイ後の動作確認」セクションを参照）
```

---

## トラブルシューティング

### 問題1: CDK Bootstrapが失敗する

**症状**: `cdk bootstrap`コマンドでエラーが発生

**原因**:
- AWS認証情報が正しくない
- IAM権限が不足している
- リージョンが正しくない

**解決策**:

```powershell
# AWS認証情報を確認
aws sts get-caller-identity --profile prod

# IAM権限を確認
aws iam get-user --profile prod

# リージョンを確認
aws configure get region --profile prod

# 正しいリージョンを設定
aws configure set region ap-northeast-1 --profile prod
```

### 問題2: Lambda関数が実行されない

**症状**: Lambda関数の実行でエラーが発生

**原因**:
- 環境変数が正しく設定されていない
- IAMロールに権限がない
- タイムアウトが短すぎる
- メモリが不足している

**解決策**:

```powershell
# Lambda関数の設定を確認
aws lambda get-function-configuration `
    --function-name tdnet-collector-prod `
    --profile prod

# 環境変数を確認
aws lambda get-function-configuration `
    --function-name tdnet-collector-prod `
    --profile prod `
    --query "Environment.Variables"

# IAMロールを確認
aws lambda get-function `
    --function-name tdnet-collector-prod `
    --profile prod `
    --query "Configuration.Role"

# CloudWatch Logsでエラーを確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod
```

### 問題3: DynamoDBにデータが保存されない

**症状**: DynamoDBテーブルが空

**原因**:
- テーブル名が正しくない
- IAMロールに書き込み権限がない
- バリデーションエラーが発生している

**解決策**:

```powershell
# テーブルの存在を確認
aws dynamodb describe-table `
    --table-name tdnet_disclosures_prod `
    --profile prod

# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod

# IAMポリシーを確認
aws iam get-role-policy `
    --role-name tdnet-collector-prod-role `
    --policy-name DynamoDBAccess `
    --profile prod

# テーブルのアイテム数を確認
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --select COUNT `
    --profile prod
```

### 問題4: S3にファイルが保存されない

**症状**: S3バケットが空

**原因**:
- バケット名が正しくない
- IAMロールに書き込み権限がない
- PDFダウンロードが失敗している

**解決策**:

```powershell
# バケットの存在を確認
aws s3 ls s3://tdnet-data-collector-pdfs-prod-123456789012/ --profile prod

# Lambda関数のログを確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod

# IAMポリシーを確認
aws iam get-role-policy `
    --role-name tdnet-collector-prod-role `
    --policy-name S3Access `
    --profile prod

# バケットポリシーを確認
aws s3api get-bucket-policy `
    --bucket tdnet-data-collector-pdfs-prod-123456789012 `
    --profile prod
```

### 問題5: デプロイが途中で失敗する

**症状**: `cdk deploy`が途中で失敗する

**原因**:
- リソース制限に達している
- IAM権限が不足している
- CloudFormationスタックがロールバック状態

**解決策**:

```powershell
# CloudFormationスタックのイベントを確認
aws cloudformation describe-stack-events `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --max-items 20

# スタックの状態を確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --query "Stacks[0].StackStatus"

# ロールバック状態の場合、スタックを削除
aws cloudformation delete-stack `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

# 再デプロイ
.\scripts\deploy-prod.ps1
```

### 問題6: コストが予想より高い

**症状**: AWS Budgetsアラートが頻繁に発生

**原因**:
- Lambda実行回数が多すぎる
- DynamoDBのWCU/RCUが高い
- S3ストレージが増加している
- CloudWatch Logsが増加している

**解決策**:

```powershell
# Cost Explorerでコストを確認
# https://console.aws.amazon.com/cost-management/home#/cost-explorer

# Lambda実行回数を確認
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Invocations `
    --dimensions Name=FunctionName,Value=tdnet-collector-prod `
    --start-time (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 86400 `
    --statistics Sum `
    --profile prod

# DynamoDBのメトリクスを確認
aws cloudwatch get-metric-statistics `
    --namespace AWS/DynamoDB `
    --metric-name ConsumedReadCapacityUnits `
    --dimensions Name=TableName,Value=tdnet_disclosures_prod `
    --start-time (Get-Date).AddDays(-7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 86400 `
    --statistics Sum `
    --profile prod
```

**詳細**: [コスト監視ガイド](./cost-monitoring.md)を参照

---

## デプロイ後の監視設定

### 1. CloudWatch Dashboardの確認

```powershell
# ダッシュボードの一覧を取得
aws cloudwatch list-dashboards --profile prod

# ダッシュボードを開く
# https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:
```

### 2. CloudWatch Alarmsの確認

```powershell
# アラームの一覧を取得
aws cloudwatch describe-alarms `
    --profile prod `
    --query "MetricAlarms[?starts_with(AlarmName, 'tdnet')].AlarmName"

# アラームの状態を確認
aws cloudwatch describe-alarms `
    --profile prod `
    --alarm-names tdnet-collector-prod-errors
```

### 3. SNS通知の確認

```powershell
# SNSトピックの確認
aws sns list-topics --profile prod | Select-String "tdnet"

# サブスクリプションの確認
aws sns list-subscriptions-by-topic `
    --topic-arn arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts-prod `
    --profile prod
```

**詳細**: [監視・アラート設定ガイド](./external-dependency-monitoring.md)を参照

---

## 定期的なメンテナンス

### 月次チェックリスト

- [ ] Cost Explorerでコストを確認
- [ ] CloudWatch Logsのサイズを確認
- [ ] S3ストレージのサイズを確認
- [ ] DynamoDBのアイテム数を確認
- [ ] Lambda実行回数を確認
- [ ] エラーログを確認
- [ ] アラーム履歴を確認
- [ ] セキュリティパッチの適用

### 四半期チェックリスト

- [ ] CDKバージョンのアップデート
- [ ] Node.jsランタイムのアップデート
- [ ] 依存関係のアップデート
- [ ] セキュリティ監査
- [ ] パフォーマンステスト
- [ ] バックアップの確認
- [ ] ドキュメントの更新

---

## 関連ドキュメント

- [CDK Bootstrapガイド](./cdk-bootstrap-guide.md)
- [環境変数設定ガイド](./ssm-parameter-store-setup.md)
- [スモークテストガイド](./.kiro/specs/tdnet-data-collector/docs/deployment-smoke-test.md)
- [コスト監視ガイド](./cost-monitoring.md)
- [AWS Budgets設定手順書](./aws-budgets-setup.md)
- [外部依存監視ガイド](./external-dependency-monitoring.md)
- [GitHub Secrets設定手順書](./github-secrets-setup.md)
- [デプロイチェックリスト](./.kiro/steering/infrastructure/deployment-checklist.md)

---

## 付録: デプロイチェックシート

### デプロイ前チェック

- [ ] すべてのテストが成功
- [ ] TypeScriptコンパイルエラーなし
- [ ] Lintエラーなし
- [ ] 開発環境で動作確認済み
- [ ] コードレビュー完了
- [ ] ドキュメント更新済み
- [ ] CDK Bootstrap完了
- [ ] Secrets Manager設定完了
- [ ] .env.productionファイル作成完了
- [ ] AWS認証情報確認済み

### デプロイ実行チェック

- [ ] CDK Synth成功
- [ ] CDK Diff確認済み
- [ ] CDK Deploy成功
- [ ] CloudFormationスタック作成完了

### デプロイ後チェック

- [ ] Lambda関数が存在する
- [ ] DynamoDBテーブルが存在する
- [ ] S3バケットが存在する
- [ ] Lambda関数が正常に実行される
- [ ] DynamoDBにデータが保存される
- [ ] S3にPDFファイルが保存される
- [ ] CloudWatch Logsにログが出力される
- [ ] CloudWatch Metricsが記録される
- [ ] API Gatewayエンドポイントが応答する
- [ ] CloudWatch Alarmsが設定されている
- [ ] SNS通知が設定されている

---

**最終更新日**: 2026-02-14  
**バージョン**: 1.0.0  
**作成者**: TDnet Data Collector Team

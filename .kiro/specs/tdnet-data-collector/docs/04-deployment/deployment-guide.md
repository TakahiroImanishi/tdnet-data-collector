# TDnet Data Collector - デプロイガイド

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0

このドキュメントは、TDnet Data Collectorの環境別デプロイ手順を説明します。

---

## 目次

1. [前提条件](#前提条件)
2. [デプロイ方式の比較](#デプロイ方式の比較)
3. [開発環境へのデプロイ](#開発環境へのデプロイ)
4. [本番環境へのデプロイ](#本番環境へのデプロイ)
5. [Webダッシュボードのデプロイ](#webダッシュボードのデプロイ)
6. [デプロイ後の動作確認](#デプロイ後の動作確認)
7. [ロールバック手順](#ロールバック手順)
8. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必須ツール

- **Node.js**: v20.x 以上
- **npm**: v10.x 以上
- **AWS CLI**: v2.x 以上
- **AWS CDK**: v2.x 以上
- **PowerShell**: v7.x 以上（Windows/macOS/Linux）

### AWS認証情報

```powershell
# AWS認証情報の確認
aws sts get-caller-identity
```

### 必要な権限

- CloudFormation（スタック作成・更新・削除）
- Lambda（関数作成・更新）
- DynamoDB（テーブル作成・更新）
- S3（バケット作成・更新）
- IAM（ロール作成・ポリシーアタッチ）
- CloudWatch（ログ・メトリクス・アラーム）
- API Gateway（API作成・更新）

---

## デプロイ方式の比較

### 単一スタック vs 分割スタック

| 項目 | 単一スタック | 分割スタック（推奨） |
|------|------------|-------------------|
| **スタック数** | 1つ | 4つ（Foundation, Compute, API, Monitoring） |
| **初回デプロイ時間** | 15-20分 | 12-18分 |
| **更新デプロイ時間** | 15-20分 | 2-5分（変更箇所のみ） |
| **ロールバック時間** | 15-20分 | 2-5分（変更箇所のみ） |
| **並列開発** | 困難 | 容易 |

### 推奨事項

- **新規プロジェクト**: 分割スタックデプロイ
- **既存プロジェクト**: 段階的に分割スタックへ移行
- **小規模プロジェクト**: 単一スタックでも可

---

## 開発環境へのデプロイ

### 1. 依存関係のインストール

```powershell
# プロジェクトルートで実行
npm install

# CDKディレクトリで実行
cd cdk
npm install
cd ..
```

### 2. 環境設定ファイルの確認

`.env.development` が存在し、適切な設定が含まれていることを確認。

### 3. デプロイスクリプトの実行

```powershell
# プロジェクトルートで実行
.\scripts\deploy-dev.ps1
```

**デプロイ時間**: 初回 5-10分、更新 2-5分

---

## 本番環境へのデプロイ

### デプロイ前チェックリスト

- [ ] すべてのテストが成功している
- [ ] 開発環境で動作確認済み
- [ ] CloudWatchアラームが設定されている
- [ ] バックアップ戦略が確立されている
- [ ] ロールバック手順が準備されている
- [ ] デプロイ承認者の承認を取得

### 方法1: 自動化スクリプトの使用（推奨）

```powershell
# 本番環境デプロイスクリプトを実行
.\scripts\deploy-prod.ps1
```

**スクリプトの実行内容**:
1. `.env.production`ファイルの読み込み
2. 本番環境デプロイの確認プロンプト（1回目）
3. CDK Synthによるスタック検証
4. 最終確認プロンプト（2回目：`DEPLOY`と入力）
5. CDK Deployの実行
6. デプロイ結果の表示
7. デプロイ後チェックリストの表示

### 方法2: 手動デプロイ

#### ステップ1: CDK Synthの実行

```powershell
cd cdk
npx cdk synth --context environment=prod
```

#### ステップ2: CDK Diffの実行

```powershell
npx cdk diff --context environment=prod
```

#### ステップ3: CDK Deployの実行

```powershell
npx cdk deploy --context environment=prod --require-approval always
```

---

## Webダッシュボードのデプロイ

### 前提条件

- CDKスタックのデプロイが完了していること
- S3バケット（`tdnet-dashboard-prod-{account-id}`）が作成されていること
- CloudFront Distributionが作成されていること

### デプロイ手順

#### ステップ1: ダッシュボードのビルド

```powershell
cd dashboard
npm install
npm run build
```

#### ステップ2: S3へのアップロード

```powershell
cd ..
.\scripts\deploy-dashboard.ps1 -Environment prod
```

**スクリプトの実行内容**:
1. AWS Account IDを取得
2. ダッシュボードをビルド
3. S3バケットの存在確認
4. ビルドファイルをS3にアップロード
5. CloudFront Invalidation実行
6. CloudFront URLを表示

#### ステップ3: 動作確認

ブラウザでCloudFront URLにアクセスし、以下を確認：

- [ ] ダッシュボードが正常に表示される
- [ ] ログイン画面が表示される
- [ ] APIキーを入力してログインできる
- [ ] データ収集機能が動作する
- [ ] 開示情報検索機能が動作する

---

## デプロイ後の動作確認

### 1. リソース確認

#### Lambda関数の確認

```powershell
aws lambda list-functions `
    --profile prod `
    --query "Functions[?starts_with(FunctionName, 'tdnet')].FunctionName"
```

#### DynamoDBテーブルの確認

```powershell
aws dynamodb list-tables `
    --profile prod `
    --query "TableNames[?starts_with(@, 'tdnet')]"
```

#### S3バケットの確認

```powershell
aws s3 ls --profile prod | Select-String "tdnet"
```

### 2. スモークテスト

#### テスト1: Collector Lambda関数の手動実行

```powershell
$testEvent = @{
    mode = "on-demand"
    start_date = (Get-Date).ToString("yyyy-MM-dd")
    end_date = (Get-Date).ToString("yyyy-MM-dd")
} | ConvertTo-Json

aws lambda invoke `
    --function-name tdnet-collector-prod `
    --payload $testEvent `
    --cli-binary-format raw-in-base64-out `
    --profile prod `
    response.json

Get-Content response.json | ConvertFrom-Json | Format-List
```

**期待される結果**:
```json
{
  "execution_id": "exec_1234567890_abc123_12345678",
  "status": "success",
  "collected_count": 5,
  "failed_count": 0
}
```

#### テスト2: DynamoDBデータの確認

```powershell
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --select COUNT `
    --profile prod
```

#### テスト3: S3データの確認

```powershell
aws s3 ls s3://tdnet-data-collector-pdfs-prod-123456789012/ --recursive --profile prod
```

#### テスト4: CloudWatch Logsの確認

```powershell
$logGroup = "/aws/lambda/tdnet-collector-prod"
$latestStream = aws logs describe-log-streams `
    --log-group-name $logGroup `
    --order-by LastEventTime `
    --descending `
    --max-items 1 `
    --profile prod `
    --query "logStreams[0].logStreamName" `
    --output text

aws logs get-log-events `
    --log-group-name $logGroup `
    --log-stream-name $latestStream `
    --limit 50 `
    --profile prod
```

### 3. スモークテストチェックリスト

- [ ] Lambda関数が正常に実行される
- [ ] DynamoDBにデータが保存される
- [ ] S3にPDFファイルが保存される
- [ ] CloudWatch Logsにログが出力される
- [ ] CloudWatch Metricsが記録される
- [ ] エラーログがない
- [ ] 実行時間が適切
- [ ] メモリ使用率が適切

---

## ロールバック手順

### 方法1: CloudFormationスタックのロールバック

```powershell
aws cloudformation rollback-stack `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

aws cloudformation describe-stack-events `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --max-items 20
```

### 方法2: 特定のGitタグにロールバック

```powershell
git tag -l
git checkout v1.2.3
.\scripts\deploy-prod.ps1
```

### 方法3: スタックの削除と再作成

**⚠️ 警告**: この方法はすべてのデータを削除します。

```powershell
aws cloudformation delete-stack `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

aws cloudformation wait stack-delete-complete `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod

.\scripts\deploy-prod.ps1
```

---

## トラブルシューティング

### 問題1: CDK Bootstrapが失敗する

**原因**: AWS認証情報が正しくない、IAM権限が不足している

**解決策**:
```powershell
aws sts get-caller-identity --profile prod
aws iam get-user --profile prod
aws configure get region --profile prod
aws configure set region ap-northeast-1 --profile prod
```

### 問題2: Lambda関数が実行されない

**原因**: 環境変数が正しく設定されていない、IAMロールに権限がない

**解決策**:
```powershell
aws lambda get-function-configuration `
    --function-name tdnet-collector-prod `
    --profile prod

aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod
```

### 問題3: DynamoDBにデータが保存されない

**原因**: テーブル名が正しくない、IAMロールに書き込み権限がない

**解決策**:
```powershell
aws dynamodb describe-table `
    --table-name tdnet_disclosures_prod `
    --profile prod

aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod
```

### 問題4: S3にファイルが保存されない

**原因**: バケット名が正しくない、IAMロールに書き込み権限がない

**解決策**:
```powershell
aws s3 ls s3://tdnet-data-collector-pdfs-prod-123456789012/ --profile prod
aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile prod
```

### 問題5: デプロイが途中で失敗する

**原因**: リソース制限に達している、IAM権限が不足している

**解決策**:
```powershell
aws cloudformation describe-stack-events `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --max-items 20

aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --profile prod `
    --query "Stacks[0].StackStatus"
```

### 問題6: ダッシュボードで"Access Denied"エラー

**原因**: S3バケットポリシーが正しく設定されていない

**解決策**:
```powershell
$accountId = aws sts get-caller-identity --query Account --output text
aws s3 ls s3://tdnet-dashboard-prod-$accountId/
aws s3api get-bucket-policy --bucket tdnet-dashboard-prod-$accountId
.\scripts\deploy-dashboard.ps1 -Environment prod
```

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

- **CDK Bootstrap**: `cdk-bootstrap-guide.md` - CDK Bootstrap詳細手順
- **環境設定**: `environment-setup.md` - 環境変数とAWS設定
- **CI/CD**: `ci-cd-guide.md` - GitHub Actions設定
- **デプロイチェックリスト**: `production-deployment-checklist.md` - デプロイ前後の確認事項
- **ロールバック**: `rollback-procedures.md` - 詳細なロールバック手順
- **トラブルシューティング**: `../05-operations/troubleshooting.md` - 一般的な問題の解決方法

---

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0  
**作成者**: TDnet Data Collector Team

# TDnet Data Collector - Deployment Guide

このドキュメントは、TDnet Data Collectorの環境別デプロイ手順を説明します。

## 目次

1. [前提条件](#前提条件)
2. [環境設定](#環境設定)
3. [開発環境へのデプロイ](#開発環境へのデプロイ)
4. [本番環境へのデプロイ](#本番環境へのデプロイ)
5. [デプロイ後の確認](#デプロイ後の確認)
6. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

デプロイを実行する前に、以下の要件を満たしていることを確認してください：

### 必須ツール

- **Node.js**: v20.x 以上
- **npm**: v10.x 以上
- **AWS CLI**: v2.x 以上
- **AWS CDK**: v2.x 以上
- **PowerShell**: v7.x 以上（Windows/macOS/Linux）

### AWS認証情報

AWS CLIが適切に設定されていることを確認してください：

```powershell
# AWS認証情報の確認
aws sts get-caller-identity
```

### 必要な権限

デプロイを実行するIAMユーザー/ロールには、以下の権限が必要です：

- CloudFormation（スタック作成・更新・削除）
- Lambda（関数作成・更新）
- DynamoDB（テーブル作成・更新）
- S3（バケット作成・更新）
- IAM（ロール作成・ポリシーアタッチ）
- CloudWatch（ログ・メトリクス・アラーム）
- API Gateway（API作成・更新）

---

## 環境設定

### 環境設定ファイル

プロジェクトルートに以下の環境設定ファイルが必要です：

#### `.env.development`（開発環境）

開発環境用の設定ファイル。LocalStackを使用したローカル開発に対応。

```bash
ENVIRONMENT=dev
LOG_LEVEL=DEBUG
AWS_REGION=ap-northeast-1
DYNAMODB_TABLE_NAME=tdnet-disclosures-dev
S3_BUCKET_NAME=tdnet-files-dev
USE_LOCALSTACK=true
LOCALSTACK_ENDPOINT=http://localhost:4566
```

#### `.env.production`（本番環境）

本番環境用の設定ファイル。**機密情報は含めず、AWS Secrets Managerを使用することを推奨。**

```bash
ENVIRONMENT=prod
LOG_LEVEL=INFO
AWS_REGION=ap-northeast-1
DYNAMODB_TABLE_NAME=tdnet-disclosures-prod
S3_BUCKET_NAME=tdnet-files-prod
USE_LOCALSTACK=false
```

⚠️ **重要**: `.env.production` は `.gitignore` に追加されており、Gitにコミットされません。

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

`.env.development` が存在し、適切な設定が含まれていることを確認してください。

### 3. デプロイスクリプトの実行

```powershell
# プロジェクトルートで実行
.\scripts\deploy-dev.ps1
```

### デプロイスクリプトの動作

1. `.env.development` から環境変数を読み込み
2. CDKスタックの検証（`cdk synth`）
3. 開発環境へのデプロイ（`cdk deploy --context environment=dev`）
4. デプロイ結果の表示

### デプロイ時間

初回デプロイ: 約5-10分  
更新デプロイ: 約2-5分

---

## 本番環境へのデプロイ

### 1. 本番環境設定ファイルの準備

`.env.production` を作成し、本番環境用の設定を記述してください。

⚠️ **セキュリティ注意事項**:
- 機密情報（APIキー、パスワードなど）は `.env.production` に直接記述しない
- AWS Secrets Manager または Systems Manager Parameter Store を使用
- `.env.production` は `.gitignore` に追加されている

### 2. デプロイ前チェックリスト

本番環境へのデプロイ前に、以下を確認してください：

- [ ] すべてのテストが成功している
- [ ] 開発環境で動作確認済み
- [ ] CloudWatchアラームが設定されている
- [ ] バックアップ戦略が確立されている
- [ ] ロールバック手順が準備されている
- [ ] デプロイ承認者の承認を取得

### 3. デプロイスクリプトの実行

```powershell
# プロジェクトルートで実行
.\scripts\deploy-prod.ps1
```

### デプロイスクリプトの動作

1. `.env.production` から環境変数を読み込み
2. **警告表示**: 本番環境へのデプロイであることを確認
3. **確認プロンプト1**: デプロイを続行するか確認（yes/no）
4. CDKスタックの検証（`cdk synth`）
5. **確認プロンプト2**: 最終確認（DEPLOY と入力）
6. 本番環境へのデプロイ（`cdk deploy --context environment=prod`）
7. デプロイ結果の表示
8. デプロイ後チェックリストの表示

### 本番デプロイの安全機能

- **二重確認**: 2回の確認プロンプトで誤デプロイを防止
- **環境表示**: デプロイ先の環境とリージョンを明示
- **検証**: デプロイ前にCDKスタックを検証
- **チェックリスト**: デプロイ後の確認項目を表示

---

## デプロイ後の確認

### 1. CloudFormationスタックの確認

```powershell
# スタックの状態を確認
aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-dev
aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack-prod
```

### 2. Lambda関数の確認

```powershell
# Lambda関数のリストを取得
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `tdnet-`)].FunctionName'
```

### 3. DynamoDBテーブルの確認

```powershell
# テーブルの状態を確認
aws dynamodb describe-table --table-name tdnet-disclosures-dev
aws dynamodb describe-table --table-name tdnet-disclosures-prod
```

### 4. S3バケットの確認

```powershell
# バケットの存在を確認
aws s3 ls | grep tdnet-files
```

### 5. CloudWatchログの確認

```powershell
# ログストリームを確認
aws logs describe-log-streams --log-group-name /aws/lambda/tdnet-collector-dev
aws logs describe-log-streams --log-group-name /aws/lambda/tdnet-collector-prod
```

### 6. API Gatewayの確認

```powershell
# API Gatewayのエンドポイントを取得
aws cloudformation describe-stacks \
  --stack-name TdnetDataCollectorStack-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

### 7. 動作確認

#### ヘルスチェック

```powershell
# APIのヘルスチェック
$apiEndpoint = "https://your-api-endpoint.execute-api.ap-northeast-1.amazonaws.com/prod"
Invoke-RestMethod -Uri "$apiEndpoint/health" -Method GET
```

#### テストデータの投入

```powershell
# テスト用の開示情報を取得
Invoke-RestMethod -Uri "$apiEndpoint/disclosures?date=2024-01-15" -Method GET
```

---

## トラブルシューティング

### デプロイが失敗する

#### 問題: CDK synthが失敗する

**原因**: TypeScriptのコンパイルエラー、または設定ファイルの問題

**解決策**:
```powershell
# TypeScriptのコンパイルエラーを確認
cd cdk
npm run build

# エラーメッセージを確認して修正
```

#### 問題: CloudFormationスタックの作成が失敗する

**原因**: IAM権限不足、リソース制限、または既存リソースとの競合

**解決策**:
```powershell
# CloudFormationのイベントを確認
aws cloudformation describe-stack-events --stack-name TdnetDataCollectorStack-dev

# エラーメッセージを確認して対処
```

### 環境変数が読み込まれない

**原因**: `.env.development` または `.env.production` が存在しない、または形式が不正

**解決策**:
```powershell
# ファイルの存在を確認
Test-Path .env.development
Test-Path .env.production

# ファイルの内容を確認
Get-Content .env.development
```

### Lambda関数がタイムアウトする

**原因**: Lambda関数のタイムアウト設定が短すぎる、またはコードの問題

**解決策**:
```powershell
# CloudWatchログを確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow

# タイムアウト設定を確認
aws lambda get-function-configuration --function-name tdnet-collector-dev
```

### DynamoDBへの書き込みが失敗する

**原因**: IAM権限不足、またはテーブルが存在しない

**解決策**:
```powershell
# テーブルの存在を確認
aws dynamodb describe-table --table-name tdnet-disclosures-dev

# Lambda関数のIAMロールを確認
aws lambda get-function --function-name tdnet-collector-dev --query 'Configuration.Role'
```

---

## ロールバック手順

デプロイ後に問題が発生した場合、以下の手順でロールバックできます：

### 1. CloudFormationスタックのロールバック

```powershell
# 前のバージョンにロールバック
aws cloudformation rollback-stack --stack-name TdnetDataCollectorStack-prod
```

### 2. 手動ロールバック

```powershell
# 前のバージョンのコードをチェックアウト
git log --oneline
git checkout <previous-commit-hash>

# 再デプロイ
.\scripts\deploy-prod.ps1
```

---

## CI/CDパイプライン（今後の実装予定）

将来的には、GitHub Actionsを使用したCI/CDパイプラインを構築する予定です：

1. **プルリクエスト**: 自動テスト実行
2. **mainブランチへのマージ**: 開発環境への自動デプロイ
3. **タグ作成**: 本番環境への手動承認デプロイ

---

## 関連ドキュメント

- **環境変数管理**: `../.kiro/steering/infrastructure/environment-variables.md`
- **デプロイチェックリスト**: `../.kiro/steering/infrastructure/deployment-checklist.md`
- **セキュリティベストプラクティス**: `../.kiro/steering/security/security-best-practices.md`
- **監視とアラート**: `../.kiro/steering/infrastructure/monitoring-alerts.md`

---

## サポート

デプロイに関する問題や質問がある場合は、以下を参照してください：

- **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/`
- **改善記録**: `.kiro/specs/tdnet-data-collector/improvements/`
- **プロジェクトドキュメント**: `docs/`

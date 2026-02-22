# 作業記録: 本番環境デプロイ（ログ強化版Lambda Collector）

**作業日時**: 2026年2月22日 15:57:04
**担当**: Kiro AI Assistant
**関連タスク**: tasks-lambda-998-limit-issue.md タスク2

## 作業概要

Lambda Collectorのログ出力強化版を本番環境にデプロイしました。

## 実施内容

### 1. デプロイスクリプト修正

**問題**: AWS認証情報エラー（`CDK_DEFAULT_ACCOUNT`未設定）

**修正内容**:
- `scripts/deploy-prod.ps1`を修正
  - `.env.production`読み込み後、`CDK_DEFAULT_ACCOUNT`と`CDK_DEFAULT_REGION`を明示的に設定
  - ビルドステップを追加（`npm run build`）

```powershell
# CDK環境変数を設定
[Environment]::SetEnvironmentVariable("CDK_DEFAULT_ACCOUNT", $env:AWS_ACCOUNT_ID, "Process")
[Environment]::SetEnvironmentVariable("CDK_DEFAULT_REGION", $env:AWS_REGION, "Process")
```

### 2. デプロイ実行

**コマンド**: `.\scripts\deploy-prod.ps1`

**デプロイ結果**:
- **TdnetFoundation-prod**: 変更なし（no changes）
- **TdnetCompute-prod**: Lambda関数を更新
  - CollectorFunction: 1.7MB（ログ強化により増加）
  - QueryFunction: 155.7KB
  - ExportFunction: 159.4KB
  - その他のLambda関数も更新
- **TdnetApi-prod**: API Gateway Deploymentを更新
- **TdnetMonitoring-prod**: CloudWatch設定を更新

**デプロイ時間**:
- Foundation: 0.64s
- Compute: 74.14s
- API: 38.22s
- Monitoring: 49.42s
- 合計: 約2分

### 3. デプロイされたリソース

**Lambda関数**:
- `tdnet-collector-prod`: arn:aws:lambda:ap-northeast-1:803879841964:function:tdnet-collector-prod
- `tdnet-query-prod`: arn:aws:lambda:ap-northeast-1:803879841964:function:tdnet-query-prod
- `tdnet-export-prod`: arn:aws:lambda:ap-northeast-1:803879841964:function:tdnet-export-prod
- その他8個のLambda関数

**API Gateway**:
- エンドポイント: https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod/
- API Key ID: mejj9kz01k

**CloudWatch**:
- ダッシュボード: tdnet-collector-prod
- アラーム数: 45個
- CloudTrail LogGroup: /aws/cloudtrail/tdnet-audit-trail-prod

## 成果物

- [x] `scripts/deploy-prod.ps1`修正（CDK環境変数設定、ビルドステップ追加）
- [x] 本番環境へのデプロイ成功
- [x] すべてのスタック正常デプロイ
- [x] Gitコミット: `[fix] deploy-prod.ps1にCDK環境変数設定とビルドステップを追加`

## 次のステップ

### 1. CloudWatch Logsでログ確認

```powershell
# Lambda Collectorのログを確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow --profile imanishi-awssso

# 特定の実行IDでフィルタ
aws logs filter-log-events `
  --log-group-name /aws/lambda/tdnet-collector-prod `
  --filter-pattern "execution_id" `
  --profile imanishi-awssso
```

### 2. 998件制限問題の調査

強化されたログで以下を確認:
- バッチ処理の進捗（バッチ番号、進捗率）
- 個別処理の詳細（disclosure_id、sequence、company情報）
- 重複検出の詳細（company情報、s3_key）
- S3アップロードの詳細（ファイルサイズ、処理時間）
- エラー発生時のstack_trace

### 3. データ収集テスト

```powershell
# 本番環境でデータ収集を実行
.\scripts\fetch-data-range.ps1 -StartDate "2025-01-15" -EndDate "2025-01-15" -Environment prod
```

## 申し送り事項

- デプロイは成功しましたが、実際のデータ収集でログを確認する必要があります
- CloudWatch Logsで998件で停止する原因を特定してください
- 問題が特定できたら、tasks-lambda-998-limit-issue.mdのタスク3（修正実装）に進んでください

## 関連ファイル

- `scripts/deploy-prod.ps1`
- `cdk/bin/tdnet-data-collector-split.ts`
- `config/.env.production`
- `src/lambda/collector/handler.ts`
- `src/lambda/collector/save-metadata.ts`
- `src/lambda/collector/download-pdf.ts`

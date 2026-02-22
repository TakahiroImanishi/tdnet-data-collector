# 作業記録: ログレベルDEBUGデプロイ

**作業日時**: 2026-02-14 19:09:12  
**タスク**: LOG_LEVEL=DEBUGのデプロイ確認と実行  
**担当**: Kiro AI Assistant

## 作業概要

`tdnet-collect-prod` Lambda関数のLOG_LEVELが`INFO`のままであることを確認。CDKコードでは既に`DEBUG`に設定されているため、デプロイを実行する。

## 現状確認

### Lambda関数のLOG_LEVEL確認結果

```powershell
# tdnet-collector-prod
aws lambda get-function-configuration --function-name tdnet-collector-prod --region ap-northeast-1 --query 'Environment.Variables.LOG_LEVEL' --output text
# 結果: DEBUG ✅

# tdnet-collect-prod
aws lambda get-function-configuration --function-name tdnet-collect-prod --region ap-northeast-1 --query 'Environment.Variables.LOG_LEVEL' --output text
# 結果: INFO ❌（DEBUGに変更が必要）
```

### CDK設定確認

`cdk/lib/config/environment-config.ts`の177行目:
```typescript
collect: {
  timeout: 30, // 30 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG', // デバッグログを有効化（調査用）
},
```

**結論**: CDKコードは正しく設定されているが、デプロイされていない。

## 実施項目

### 1. デプロイ実行

ComputeStackのみをデプロイ（LOG_LEVEL環境変数の変更のみ）。



## デプロイ結果

### デプロイコマンド

```powershell
cdk deploy TdnetCompute-prod --context environment=prod --require-approval never --region ap-northeast-1
```

### デプロイ成功

```
✅  TdnetCompute-prod

✨  Deployment time: 44.76s
```

更新されたLambda関数:
- CollectFunction (tdnet-collect-prod)
- CollectStatusFunction (tdnet-collect-status-prod)
- StatsFunction (tdnet-stats-prod)
- HealthFunction (tdnet-health-prod)
- QueryFunction (tdnet-query-prod)
- ExportStatusFunction (tdnet-export-status-prod)
- ExportFunction (tdnet-export-prod)
- PdfDownloadFunction (tdnet-pdf-download-prod)

### デプロイ後確認

```powershell
aws lambda get-function-configuration --function-name tdnet-collect-prod --region ap-northeast-1 --query 'Environment.Variables.LOG_LEVEL' --output text
# 結果: DEBUG ✅
```

## 成果物

- `tdnet-collect-prod` Lambda関数のLOG_LEVELを`INFO`から`DEBUG`に変更
- 本番環境にデプロイ完了
- データ収集時の詳細ログが出力されるようになった

## 申し送り

- LOG_LEVEL=DEBUGにより、データ収集失敗の原因を特定できるようになった
- 次回のデータ収集テスト時に、CloudWatch Logsで詳細なエラーログを確認すること
- 問題解決後は、LOG_LEVELをINFOに戻すことを検討（コスト削減のため）


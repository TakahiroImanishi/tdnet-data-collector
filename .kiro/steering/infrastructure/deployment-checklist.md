---
inclusion: fileMatch
fileMatchPattern: '**/cdk/**/*.ts|**/.github/workflows/**/*'
---

# Deployment Checklist

## 🚨 重要: デプロイ手順書の厳守

デプロイ前に必ず手順書（`docs/production-deployment-*.md`）を全ステップ確認。特にTypeScriptビルドは必須（省略するとLambdaデプロイ失敗）。

## デプロイ前チェックリスト

### コード品質
- [ ] すべてのテスト通過、カバレッジ80%以上
- [ ] ESLint・TypeScriptエラーゼロ

### セキュリティ
- [ ] `npm audit`でCritical/High脆弱性なし
- [ ] APIキー・機密情報がコードに含まれていない
- [ ] IAMロールが最小権限の原則に従っている

### CDK変更確認
- [ ] `cdk diff`で変更内容確認
- [ ] 破壊的変更（リソース削除）がないか確認
- [ ] 新しいリソースのコスト見積もり

### 環境変数
- [ ] すべての必須環境変数が設定されている
- [ ] 環境変数の値が正しい（dev/prod）

### ドキュメント
- [ ] README.md、CHANGELOG.mdが最新

## デプロイ手順

1. **開発環境**: `npm install && npm run test && cdk deploy --profile dev`
2. **スモークテスト**: Lambda起動確認、CloudWatch Logs確認
3. **本番環境**: `cdk deploy --profile prod --require-approval always`

## デプロイ後チェックリスト

### 即時確認（5分以内）
- [ ] Lambda関数が正常に起動
- [ ] CloudWatch Logsにエラーがない
- [ ] DynamoDB・S3への書き込み成功

### 短期確認（30分以内）
- [ ] EventBridgeスケジュール正常動作
- [ ] バッチ処理正常完了
- [ ] アラート未発火

### 長期確認（24時間以内）
- [ ] 日次バッチ正常実行
- [ ] データ収集件数が想定範囲内
- [ ] エラー率 < 5%

## ロールバック

詳細: `docs/rollback-procedures.md`

## 環境別設定

| 設定項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| lambdaMemory | 256MB | 512MB |
| enableBackup | false | true |
| enableAlarms | false | true |

## 関連

`../security/security-best-practices.md`, `environment-variables.md`, `monitoring-alerts.md`

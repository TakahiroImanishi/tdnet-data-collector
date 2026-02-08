---
inclusion: fileMatch
fileMatchPattern: '**/cdk/**/*.ts|**/.github/workflows/**/*'
---

# Deployment Checklist

TDnet Data Collectorプロジェクトのデプロイメントチェックリスト。

## デプロイ前チェックリスト

### コード品質
- [ ] すべてのテスト通過（ユニット・統合・プロパティ）
- [ ] コードカバレッジ80%以上
- [ ] ESLint・TypeScriptエラーゼロ

### セキュリティ
- [ ] `npm audit`でCritical/High脆弱性なし
- [ ] APIキー・機密情報がコードに含まれていない
- [ ] IAMロールが最小権限の原則に従っている

### CDK変更確認
- [ ] `cdk diff`で変更内容確認
- [ ] 破壊的変更（リソース削除）がないか確認
- [ ] 新しいリソースのコスト見積もり
- [ ] IAM権限・環境変数の変更確認

### 環境変数
- [ ] すべての必須環境変数が設定されている
- [ ] 環境変数の値が正しい（dev/prod）
- [ ] Secrets Manager・SSM Parameter Storeの値が最新

### ドキュメント
- [ ] README.mdが最新
- [ ] CHANGELOG.mdに変更内容を記載

## デプロイ手順

### 1. 開発環境でのテスト
```bash
npm install
npm run test
npm run build
cdk synth
cdk deploy --profile dev
```

### 2. スモークテスト
```bash
# Lambda関数の起動確認
aws lambda invoke --function-name tdnet-collector-dev --payload '{"mode":"batch"}' response.json

# CloudWatch Logsの確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow
```

### 3. 本番環境へのデプロイ
```bash
cdk deploy --profile prod --require-approval always
```

## デプロイ後チェックリスト

### 即時確認（5分以内）
- [ ] Lambda関数が正常に起動
- [ ] CloudWatch Logsにエラーがない
- [ ] DynamoDB・S3への書き込み成功

### 短期確認（30分以内）
- [ ] EventBridgeスケジュール正常動作
- [ ] バッチ処理正常完了
- [ ] アラート未発火
- [ ] コスト想定範囲内

### 長期確認（24時間以内）
- [ ] 日次バッチ正常実行
- [ ] データ収集件数が想定範囲内
- [ ] エラー率 < 5%

## ロールバック手順

### 緊急ロールバック
```bash
# 前バージョンにチェックアウト
git checkout v1.2.3

# 前バージョンをデプロイ
cdk deploy --profile prod --require-approval never
```

### データ整合性の確認
```bash
# DynamoDBのレコード数確認
aws dynamodb describe-table --table-name tdnet-disclosures-prod

# S3のオブジェクト数確認
aws s3 ls s3://tdnet-pdfs-prod/ --recursive | wc -l
```

## 本番環境デプロイのベストプラクティス

### デプロイタイミング
- **推奨**: 平日の午前中（10:00-12:00）または午後（14:00-16:00）
- **避ける**: 金曜夕方、月曜朝、市場取引時間中のピーク時、決算発表シーズン

### 環境別設定

| 設定項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| logLevel | DEBUG | INFO |
| lambdaTimeout | 5分 | 15分 |
| lambdaMemory | 256MB | 512MB |
| dynamodbBillingMode | PAY_PER_REQUEST | PAY_PER_REQUEST |
| s3LifecycleRules | 30日で削除 | 90日でIA、365日でGlacier |
| enableBackup | false | true |
| enableAlarms | false | true |

## 関連ドキュメント

- **セキュリティ**: `../security/security-best-practices.md` - セキュリティチェック項目
- **環境変数**: `environment-variables.md` - 環境変数の設定確認
- **監視とアラート**: `monitoring-alerts.md` - デプロイ後の監視手順

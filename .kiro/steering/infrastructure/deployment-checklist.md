---
inclusion: fileMatch
fileMatchPattern: '**/cdk/**/*.ts|**/.github/workflows/**/*'
---

# Deployment Checklist

## 🚨 重要: デプロイ手順書の厳守

**再発防止ルール（2026-02-14追加）**:

デプロイを実行する前に、**必ず**以下を実行してください：

1. **デプロイ手順書を最初から最後まで読む**
   - `docs/production-deployment-checklist.md`または`docs/production-deployment-guide.md`
   - 作業記録や過去の経験だけで判断しない
   - 「準備完了」と書かれていても、手順書の全ステップを確認する

2. **各ステップを順番に実行**
   - ステップを飛ばさない
   - 特に**ステップ4: TypeScriptビルド**は必須（省略すると Lambda デプロイ失敗）
   - 各ステップの確認項目をチェック

3. **不明点があれば必ずユーザーに確認**
   - 手順書に記載されていない状況
   - 前提条件が満たされているか不明な場合
   - エラーが発生した場合

**なぜこのルールが必要か**:
- 過去に手順書を確認せずにデプロイを実行し、TypeScriptビルドを省略
- その結果、Lambda関数のデプロイに失敗し、CloudFormationスタックがROLLBACK_COMPLETE状態に
- 作業記録の「準備完了」という記述だけで判断し、手順書の詳細を確認しなかったことが原因

**このルールを守らないと**:
- デプロイ失敗
- リソースの不整合
- ロールバック作業が必要
- 本番環境への影響

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

## ロールバック手順

### 緊急ロールバック
1. **CDKスタック**: `git checkout v1.2.3 && npm ci && npm run build && cdk deploy --context environment=prod`
2. **DynamoDB PITR**: 最大35日前まで復元可能（`aws dynamodb restore-table-to-point-in-time`）
3. **S3バージョニング**: 削除されたオブジェクトを復元可能

### 詳細手順
- **完全なロールバック手順**: `docs/rollback-procedures.md`を参照
- **データ整合性確認**: DynamoDB・S3のレコード数確認
- **CloudTrailログ**: 7年間保存（監査用）

## 環境別設定

| 設定項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| logLevel | DEBUG | INFO |
| lambdaTimeout | 5分 | 15分 |
| lambdaMemory | 256MB | 512MB |
| s3LifecycleRules | 30日で削除 | 90日でIA、365日でGlacier |
| enableBackup | false | true |
| enableAlarms | false | true |

## デプロイタイミング

- **推奨**: 平日10:00-12:00、14:00-16:00
- **避ける**: 金曜夕方、月曜朝、市場取引時間中のピーク時、決算発表シーズン

## 関連ドキュメント

- **セキュリティ**: `../security/security-best-practices.md`
- **環境変数**: `environment-variables.md`
- **監視とアラート**: `monitoring-alerts.md`

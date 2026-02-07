---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/.github/workflows/**/*'
---

# Deployment Checklist

このファイルは、TDnet Data Collectorプロジェクトのデプロイメントにおけるチェックリストとベストプラクティスをまとめたものです。

## デプロイ前チェックリスト

### コード品質

- [ ] すべてのユニットテストが通過している
- [ ] すべての統合テストが通過している
- [ ] プロパティベーステストが通過している（fast-check）
- [ ] コードカバレッジが80%以上
- [ ] ESLintエラーがゼロ
- [ ] TypeScriptコンパイルエラーがゼロ

**確認コマンド:**
```bash
npm run test
npm run test:coverage
npm run lint
npm run build
```

### セキュリティ

- [ ] `npm audit`で脆弱性がない（Critical/High）
- [ ] 依存関係が最新または既知の安全なバージョン
- [ ] APIキーや機密情報がコードに含まれていない
- [ ] 環境変数が適切に設定されている
- [ ] IAMロールが最小権限の原則に従っている

**確認コマンド:**
```bash
npm audit
npm audit fix
git grep -i "api.key\|password\|secret"
```

### CDK変更確認

- [ ] `cdk diff`で変更内容を確認
- [ ] 破壊的変更（リソース削除）がないか確認
- [ ] 新しいリソースのコストを見積もり
- [ ] IAM権限の変更を確認
- [ ] 環境変数の変更を確認

**確認コマンド:**
```bash
cdk diff
cdk synth > template.yaml
```

### 環境変数

- [ ] すべての必須環境変数が設定されている
- [ ] 環境変数の値が正しい（dev/prod）
- [ ] Secrets Managerの値が最新
- [ ] SSM Parameter Storeの値が最新

**確認方法:**
```bash
# Lambda環境変数の確認
aws lambda get-function-configuration --function-name tdnet-collector

# SSM Parameter Storeの確認
aws ssm get-parameter --name /tdnet/api-key --with-decryption
```

### ドキュメント

- [ ] README.mdが最新
- [ ] CHANGELOG.mdに変更内容を記載
- [ ] API仕様書が最新（該当する場合）
- [ ] アーキテクチャ図が最新

## デプロイ手順

### 1. 開発環境でのテスト

```bash
# 依存関係のインストール
npm install

# テスト実行
npm run test

# ビルド
npm run build

# CDK合成
cdk synth

# 開発環境へデプロイ
cdk deploy --profile dev --require-approval never
```

### 2. スモークテスト

デプロイ後、基本的な動作確認を実施：

```bash
# Lambda関数の起動確認
aws lambda invoke \
  --function-name tdnet-collector-dev \
  --payload '{"mode":"batch"}' \
  response.json

# API Gatewayの動作確認
curl -X GET "https://api-dev.example.com/disclosures?limit=10" \
  -H "X-API-Key: your-api-key"

# DynamoDBのデータ確認
aws dynamodb scan \
  --table-name tdnet-disclosures-dev \
  --limit 5
```

### 3. CloudWatch Logsの確認

```bash
# 最新のログストリームを確認
aws logs tail /aws/lambda/tdnet-collector-dev --follow

# エラーログの検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-dev \
  --filter-pattern "ERROR"
```

### 4. 本番環境へのデプロイ

```bash
# 本番環境へデプロイ（承認必須）
cdk deploy --profile prod --require-approval always

# デプロイ後のスモークテスト
npm run test:smoke:prod
```

## デプロイ後チェックリスト

### 即時確認（デプロイ後5分以内）

- [ ] Lambda関数が正常に起動する
- [ ] API Gatewayが応答する
- [ ] CloudWatch Logsにエラーがない
- [ ] DynamoDBへの書き込みが成功している
- [ ] S3へのファイルアップロードが成功している

### 短期確認（デプロイ後30分以内）

- [ ] EventBridgeスケジュールが正常に動作
- [ ] バッチ処理が正常に完了
- [ ] メトリクスが正常に記録されている
- [ ] アラートが発火していない
- [ ] コストが想定範囲内

### 長期確認（デプロイ後24時間以内）

- [ ] 日次バッチが正常に実行された
- [ ] データ収集件数が想定範囲内
- [ ] エラー率が許容範囲内（< 5%）
- [ ] パフォーマンスが劣化していない
- [ ] コストが想定範囲内

## ロールバック手順

### 緊急ロールバック

重大な問題が発生した場合、即座にロールバック：

```bash
# 前バージョンのタグを確認
git tag -l

# 前バージョンにチェックアウト
git checkout v1.2.3

# 前バージョンをデプロイ
cdk deploy --profile prod --require-approval never

# ロールバック完了を確認
aws lambda get-function --function-name tdnet-collector-prod
```

### データ整合性の確認

ロールバック後、データの整合性を確認：

```bash
# DynamoDBのレコード数確認
aws dynamodb describe-table --table-name tdnet-disclosures-prod

# S3のオブジェクト数確認
aws s3 ls s3://tdnet-pdfs-prod/ --recursive | wc -l

# 最新のデータが正常か確認
aws dynamodb query \
  --table-name tdnet-disclosures-prod \
  --index-name GSI_DiscloseDate \
  --key-condition-expression "disclosure_type = :type" \
  --expression-attribute-values '{":type":{"S":"決算短信"}}' \
  --scan-index-forward false \
  --limit 10
```

## 本番環境デプロイのベストプラクティス

### 1. デプロイタイミング

- **推奨時間帯**: 平日の午前中（10:00-12:00）または午後（14:00-16:00）
- **避けるべき時間帯**:
  - 金曜日の夕方（週末に問題が発生した場合の対応が困難）
  - 月曜日の朝（週初めの負荷が高い）
  - 市場取引時間中（9:00-15:00）のピーク時
  - 決算発表シーズンのピーク時

### 2. 段階的デプロイ

```typescript
// Lambda関数のエイリアスとバージョンを使用
const version = collectorFn.currentVersion;
const alias = new lambda.Alias(this, 'CollectorAlias', {
    aliasName: 'live',
    version,
});

// CodeDeployで段階的デプロイ
new codedeploy.LambdaDeploymentGroup(this, 'DeploymentGroup', {
    alias,
    deploymentConfig: codedeploy.LambdaDeploymentConfig.CANARY_10PERCENT_5MINUTES,
    alarms: [errorAlarm],
});
```

### 3. ブルーグリーンデプロイ

```bash
# 新バージョンを別スタックとしてデプロイ
cdk deploy TdnetCollectorStackV2 --profile prod

# トラフィックを徐々に新バージョンに移行
# API Gatewayのステージ変数を使用

# 問題なければ旧バージョンを削除
cdk destroy TdnetCollectorStackV1 --profile prod
```

### 4. デプロイ監視

デプロイ後30分間は以下を監視：

```bash
# CloudWatch Logsをリアルタイム監視
aws logs tail /aws/lambda/tdnet-collector-prod --follow

# メトリクスダッシュボードを監視
# - Lambda実行時間
# - Lambda エラー率
# - DynamoDB スロットリング
# - API Gateway 4xx/5xx エラー

# アラームの状態を確認
aws cloudwatch describe-alarms --state-value ALARM
```

## 環境別設定

### 開発環境（dev）

```typescript
const devConfig = {
    environment: 'dev',
    logLevel: 'DEBUG',
    lambdaTimeout: cdk.Duration.minutes(5),
    lambdaMemory: 256,
    dynamodbBillingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    s3LifecycleRules: [
        {
            expiration: cdk.Duration.days(30),
        },
    ],
};
```

### 本番環境（prod）

```typescript
const prodConfig = {
    environment: 'prod',
    logLevel: 'INFO',
    lambdaTimeout: cdk.Duration.minutes(15),
    lambdaMemory: 512,
    dynamodbBillingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    s3LifecycleRules: [
        {
            transitions: [
                {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(90),
                },
                {
                    storageClass: s3.StorageClass.GLACIER,
                    transitionAfter: cdk.Duration.days(365),
                },
            ],
        },
    ],
    enableBackup: true,
    enableAlarms: true,
};
```

## トラブルシューティング

### デプロイ失敗時

**症状**: `cdk deploy`が失敗する

**対処法**:
1. エラーメッセージを確認
2. CloudFormationスタックのイベントを確認
3. ロールバックまたは手動修正

```bash
# CloudFormationスタックのイベント確認
aws cloudformation describe-stack-events \
  --stack-name TdnetCollectorStack \
  --max-items 20

# スタックの削除（必要に応じて）
cdk destroy --force
```

### Lambda関数が起動しない

**症状**: Lambda関数の起動に失敗する

**対処法**:
1. CloudWatch Logsでエラーを確認
2. 環境変数が正しく設定されているか確認
3. IAM権限を確認

```bash
# Lambda設定の確認
aws lambda get-function-configuration \
  --function-name tdnet-collector-prod

# 手動でLambdaを起動してテスト
aws lambda invoke \
  --function-name tdnet-collector-prod \
  --payload '{"mode":"batch"}' \
  --log-type Tail \
  response.json
```

### DynamoDB書き込みエラー

**症状**: DynamoDBへの書き込みが失敗する

**対処法**:
1. IAM権限を確認
2. テーブル名が正しいか確認
3. スロットリングが発生していないか確認

```bash
# DynamoDBメトリクスの確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=tdnet-disclosures-prod \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## デプロイ記録

デプロイごとに以下の情報を記録：

```markdown
# デプロイ記録: v1.2.3

**日時**: 2024-01-15 14:30 JST
**環境**: production
**デプロイ担当者**: [名前]
**変更内容**:
- Lambda関数のタイムアウトを10分から15分に変更
- DynamoDBのGSIを追加
- エラーハンドリングを改善

**デプロイ結果**:
- ✅ デプロイ成功
- ✅ スモークテスト通過
- ✅ 30分監視完了

**問題点**:
- なし

**ロールバック**:
- 不要
```

## まとめ

- デプロイ前に必ずチェックリストを確認
- 開発環境で十分にテストしてから本番環境へ
- デプロイ後は必ず監視を実施
- 問題が発生したら即座にロールバック
- デプロイ記録を残して振り返りを実施

## 関連ドキュメント

- **セキュリティ**: `../security/security-best-practices.md` - セキュリティチェック項目
- **環境変数**: `environment-variables.md` - 環境変数の設定確認
- **監視とアラート**: `monitoring-alerts.md` - デプロイ後の監視手順
- **パフォーマンス最適化**: `performance-optimization.md` - デプロイ後のパフォーマンス確認

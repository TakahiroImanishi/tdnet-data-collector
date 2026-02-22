# コスト監視ガイド

**最終更新日**: 2026-02-15  
**対象環境**: 本番環境（prod）

## 概要

TDnet Data Collectorのコストを継続的に監視し、AWS無料枠内での運用を維持するためのガイドです。

---

## コスト監視の目標

- AWS無料枠内での運用維持
- 予期しないコスト増加の早期検知
- サービス別コストの可視化
- 月次コストレポートの自動化

---

## 月間コスト見積もり

### 前提条件

| 項目 | 想定値 | 備考 |
|------|--------|------|
| 日次開示情報件数 | 100件/日 | 平日のみ（月20日） |
| 月間開示情報件数 | 2,000件/月 | 100件/日 × 20日 |
| PDF平均サイズ | 500KB | 開示資料のPDFファイル |
| API呼び出し回数 | 10,000回/月 | 検索・エクスポートAPI |
| エクスポート回数 | 100回/月 | CSV/JSONエクスポート |

### AWS無料枠（12ヶ月間）

| サービス | 無料枠 | 備考 |
|---------|--------|------|
| Lambda | 100万リクエスト/月、400,000 GB-秒/月 | 常時無料 |
| DynamoDB | 25GB ストレージ、25 RCU、25 WCU | 常時無料 |
| S3 | 5GB ストレージ、20,000 GETリクエスト、2,000 PUTリクエスト | 12ヶ月間 |
| CloudWatch | 10カスタムメトリクス、10アラーム | 常時無料 |
| API Gateway | 100万APIコール/月 | 12ヶ月間 |
| Secrets Manager | 30日間無料トライアル | その後$0.40/シークレット/月 |

### サービス別コスト見積もり

| サービス | 月間コスト | 無料枠適用後 |
|---------|-----------|------------|
| Lambda | $0.193 | $0.00 |
| DynamoDB | $0.044 | $0.00 |
| S3 | $0.195 | $0.00 |
| API Gateway | $0.041 | $0.00 |
| Secrets Manager | $0.4025 | $0.4025 |
| CloudWatch | $3.00 | $2.70 |
| WAF | $8.007 | $8.007 |
| CloudFront | $0.009 | $0.009 |
| SNS | $0.000005 | $0.00 |
| SQS | $0.000008 | $0.00 |
| CloudTrail | $0.00 | $0.00 |
| **合計** | **$11.89** | **$11.12** |

### コスト最適化の提案

**WAFの最適化（$8.00削減可能）**
- 開発環境ではWAFを無効化
- 本番環境のみWAFを有効化
- レート制限をAPI Gatewayのスロットリング機能で代替（無料）

**CloudWatchメトリクスの最適化（$2.70削減可能）**
- 重要なメトリクスのみに絞る（10個以内）
- Lambda Insightsを使用（無料枠内）
- CloudWatch Logs Insightsでメトリクスを代替

**Secrets Managerの最適化（$0.40削減可能）**
- Systems Manager Parameter Store（無料）に移行
- 暗号化パラメータとして保存

**最適化後の月間コスト:**
- 開発環境: $0.02（CloudFront + その他）
- 本番環境: $8.02（WAF + CloudFront + その他）

---

## AWS Budgets設定

### SNS通知トピックの作成

```bash
# SNSトピックの作成
aws sns create-topic --name tdnet-budget-alerts

# メールアドレスをサブスクライブ
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-northeast-1:YOUR_ACCOUNT_ID:tdnet-budget-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### 月次予算の設定

**予算設定:**
- 予算名: `tdnet-data-collector-monthly`
- 期間: 月次
- 予算額: `$5.00`（AWS無料枠を考慮した目標額）

**アラート閾値:**
- 50%到達時: 警告
- 80%到達時: 注意
- 100%到達時: 緊急

```bash
# 予算設定ファイルの作成
cat > budget-monthly.json << 'EOF'
{
  "BudgetName": "tdnet-data-collector-monthly",
  "BudgetType": "COST",
  "TimeUnit": "MONTHLY",
  "BudgetLimit": {
    "Amount": "5.0",
    "Unit": "USD"
  },
  "CostFilters": {},
  "CostTypes": {
    "IncludeTax": true,
    "IncludeSubscription": true,
    "UseBlended": false
  }
}
EOF

# 予算の作成
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget-monthly.json
```

### 推奨予算設定

| 環境 | 月次予算 | 備考 |
|------|---------|------|
| 開発環境 | $5.00 | 無料枠内での運用 |
| 本番環境 | $10.00 | バッファ含む |

---

## Cost Explorerの使用方法

### サービス別コストの確認

1. **フィルター設定**
   - 期間: 過去30日間
   - グループ化: サービス
   - グラフタイプ: 積み上げ棒グラフ

2. **主要サービスの確認**
   - AWS Lambda
   - Amazon DynamoDB
   - Amazon S3
   - Amazon CloudWatch
   - Amazon API Gateway

### 日次コストトレンドの確認

1. **フィルター設定**
   - 期間: 過去30日間
   - 粒度: 日次
   - グラフタイプ: 折れ線グラフ

2. **異常値の検出**
   - 通常の2倍以上のコストが発生している日を特定
   - CloudWatch Logsで該当日のエラーログを確認

### タグベースのコスト分析

**推奨タグ:**
- `Project`: `tdnet-data-collector`
- `Environment`: `dev` / `prod`
- `Component`: `lambda` / `dynamodb` / `s3` / `api`

**Cost Explorerでのフィルタリング:**
```
フィルター: タグ
タグキー: Project
タグ値: tdnet-data-collector
```

---

## CloudWatchダッシュボードでのコスト監視

### コスト監視ダッシュボードの作成

```typescript
// cdk/lib/constructs/monitoring-construct.ts に追加

import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// コストメトリクスウィジェット
const costWidget = new cloudwatch.GraphWidget({
  title: 'Estimated Monthly Cost',
  left: [
    new cloudwatch.Metric({
      namespace: 'AWS/Billing',
      metricName: 'EstimatedCharges',
      statistic: 'Maximum',
      period: Duration.hours(6),
      dimensionsMap: {
        Currency: 'USD',
      },
    }),
  ],
  width: 12,
  height: 6,
});

dashboard.addWidgets(costWidget);
```

### コストアラートの設定

```typescript
// 月次コストが$5を超えた場合のアラート
const costAlarm = new cloudwatch.Alarm(this, 'MonthlyCostAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    statistic: 'Maximum',
    period: Duration.hours(6),
    dimensionsMap: {
      Currency: 'USD',
    },
  }),
  threshold: 5.0,
  evaluationPeriods: 1,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
  alarmDescription: 'Alert when monthly cost exceeds $5',
  actionsEnabled: true,
});

costAlarm.addAlarmAction(new SnsAction(alarmTopic));
```

---

## 月次コストレポートの作成

### AWS Cost and Usage Reportsの設定

```bash
# S3バケットの作成
aws s3 mb s3://tdnet-cost-reports-YOUR_ACCOUNT_ID --region ap-northeast-1

# Cost and Usage Reportの作成
aws cur put-report-definition \
  --report-definition file://report-definition.json
```

### 月次レポートの自動生成

```typescript
// src/lambda/cost-report-generator/index.ts

import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export const handler = async () => {
  const costExplorer = new CostExplorerClient({ region: 'us-east-1' });
  const s3 = new S3Client({ region: 'ap-northeast-1' });

  // 前月のコストデータを取得
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  startDate.setDate(1);
  
  const endDate = new Date();
  endDate.setDate(0);

  const response = await costExplorer.send(new GetCostAndUsageCommand({
    TimePeriod: {
      Start: startDate.toISOString().split('T')[0],
      End: endDate.toISOString().split('T')[0],
    },
    Granularity: 'MONTHLY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'SERVICE' },
    ],
  }));

  // レポートをCSV形式で生成
  const csv = generateCsvReport(response);

  // S3に保存
  await s3.send(new PutObjectCommand({
    Bucket: process.env.COST_REPORT_BUCKET!,
    Key: `monthly-reports/${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}.csv`,
    Body: csv,
    ContentType: 'text/csv',
  }));

  return { statusCode: 200, body: 'Cost report generated successfully' };
};
```

### EventBridgeスケジュール設定

```typescript
// cdk/lib/constructs/cost-reporting-construct.ts

import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

// 毎月1日の午前9時（JST）にレポート生成
const rule = new events.Rule(this, 'MonthlyCostReportRule', {
  schedule: events.Schedule.cron({
    minute: '0',
    hour: '0', // UTC 0:00 = JST 9:00
    day: '1',
    month: '*',
    year: '*',
  }),
});

rule.addTarget(new targets.LambdaFunction(costReportFunction));
```

---

## コスト最適化のベストプラクティス

### 1. Lambda関数の最適化

**メモリサイズの最適化:**
- CloudWatch Logsで実際のメモリ使用量を確認
- Lambda Power Tuningツールを使用して最適なメモリサイズを特定
- コストと実行時間のバランスを考慮

**不要なログの削減:**
```typescript
// 本番環境ではDEBUGログを無効化
const logLevel = process.env.STAGE === 'prod' ? 'INFO' : 'DEBUG';
```

### 2. DynamoDBの最適化

**オンデマンドモードの活用:**
```typescript
// トラフィックが予測不可能な場合はオンデマンドモード
const table = new dynamodb.Table(this, 'DisclosuresTable', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

**TTLの設定:**
```typescript
// 古いデータを自動削除してストレージコストを削減
table.addProperty('timeToLiveAttribute', 'ttl');
```

### 3. S3の最適化

**ライフサイクルポリシーの設定:**
```typescript
// 古いPDFファイルをGlacierに移行
bucket.addLifecycleRule({
  id: 'archive-old-pdfs',
  enabled: true,
  transitions: [
    {
      storageClass: s3.StorageClass.GLACIER,
      transitionAfter: Duration.days(90),
    },
  ],
  expiration: Duration.days(365),
});
```

### 4. CloudWatch Logsの最適化

**ログ保持期間の設定:**
```typescript
// ログを30日間のみ保持
const logGroup = new logs.LogGroup(this, 'CollectorLogs', {
  retention: logs.RetentionDays.ONE_MONTH,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

### 5. API Gatewayの最適化

**キャッシュの有効化:**
```typescript
// レスポンスをキャッシュしてLambda実行回数を削減
const api = new apigateway.RestApi(this, 'TdnetApi', {
  deployOptions: {
    cachingEnabled: true,
    cacheTtl: Duration.minutes(5),
    cacheDataEncrypted: true,
  },
});
```

---

## コスト異常の検知と対応

### AWS Cost Anomaly Detectionの設定

```bash
# コスト異常検知の有効化
aws ce create-anomaly-monitor \
  --anomaly-monitor file://anomaly-monitor.json

# アラートの設定
aws ce create-anomaly-subscription \
  --anomaly-subscription file://anomaly-subscription.json
```

### 異常検知時の対応フロー

1. **アラート受信** - SNS経由でメール通知
2. **原因の特定** - Cost Explorerで異常なコスト増加を確認
3. **対応策の実施** - 無限ループの停止、レート制限の強化
4. **再発防止** - コードの修正、アラート閾値の調整

---

## 定期的なコストレビュー

### 月次レビューチェックリスト

- [ ] Cost Explorerで月次コストを確認
- [ ] 予算との差異を確認
- [ ] サービス別コストの変動を分析
- [ ] 異常なコスト増加がないか確認
- [ ] コスト最適化の機会を特定
- [ ] 次月の予算を調整

### 四半期レビューチェックリスト

- [ ] 過去3ヶ月のコストトレンドを分析
- [ ] 年間予算の進捗を確認
- [ ] 主要なコスト削減施策の効果を測定
- [ ] 新しいコスト最適化の機会を探索
- [ ] アーキテクチャの見直し

---

## 関連ドキュメント

- **パフォーマンス最適化**: `../../.kiro/steering/infrastructure/performance-optimization.md`
- **監視とアラート**: `../../.kiro/steering/infrastructure/monitoring-alerts.md`
- **トラブルシューティング**: `./troubleshooting.md`

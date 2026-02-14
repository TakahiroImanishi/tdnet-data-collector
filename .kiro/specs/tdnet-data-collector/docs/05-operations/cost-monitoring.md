# コスト監視ガイド

## 概要

TDnet Data Collectorプロジェクトのコストを継続的に監視し、最適化するためのガイドです。

## コスト監視の目標

- AWS無料枠内での運用維持
- 予期しないコスト増加の早期検知
- サービス別コストの可視化
- 月次コストレポートの自動化

## Cost Explorerの使用方法

### 1. Cost Explorerへのアクセス

```
https://console.aws.amazon.com/cost-management/home#/cost-explorer
```

### 2. 基本的なコスト分析

#### サービス別コストの確認

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

#### 日次コストトレンドの確認

1. **フィルター設定**
   - 期間: 過去30日間
   - 粒度: 日次
   - グラフタイプ: 折れ線グラフ

2. **異常値の検出**
   - 通常の2倍以上のコストが発生している日を特定
   - CloudWatch Logsで該当日のエラーログを確認

### 3. タグベースのコスト分析

プロジェクトにタグを付けてコストを追跡します。

**推奨タグ**:
- `Project`: `tdnet-data-collector`
- `Environment`: `dev` / `prod`
- `Component`: `lambda` / `dynamodb` / `s3` / `api`

**Cost Explorerでのフィルタリング**:
```
フィルター: タグ
タグキー: Project
タグ値: tdnet-data-collector
```

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

## 月次コストレポートの作成

### 1. AWS Cost and Usage Reportsの設定

#### Management Consoleでの設定

1. **Cost and Usage Reportsコンソールにアクセス**
   ```
   https://console.aws.amazon.com/billing/home#/reports
   ```

2. **レポートの作成**
   - レポート名: `tdnet-cost-report`
   - 時間単位: 日次
   - レポート内容: すべてのコスト配分タグを含める
   - S3バケット: `tdnet-cost-reports-YOUR_ACCOUNT_ID`
   - レポート形式: CSV

3. **配信設定**
   - 圧縮: GZIP
   - バージョニング: 既存のレポートを上書き

#### AWS CLIでの設定

```bash
# S3バケットの作成
aws s3 mb s3://tdnet-cost-reports-YOUR_ACCOUNT_ID --region ap-northeast-1

# バケットポリシーの設定
cat > bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "billingreports.amazonaws.com"
      },
      "Action": [
        "s3:GetBucketAcl",
        "s3:GetBucketPolicy"
      ],
      "Resource": "arn:aws:s3:::tdnet-cost-reports-YOUR_ACCOUNT_ID"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "billingreports.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::tdnet-cost-reports-YOUR_ACCOUNT_ID/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket tdnet-cost-reports-YOUR_ACCOUNT_ID \
  --policy file://bucket-policy.json

# Cost and Usage Reportの作成
aws cur put-report-definition \
  --report-definition file://report-definition.json
```

### 2. 月次レポートの自動生成

#### Lambda関数での実装

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

function generateCsvReport(data: any): string {
  const lines = ['Service,Cost (USD)'];
  
  for (const result of data.ResultsByTime || []) {
    for (const group of result.Groups || []) {
      const service = group.Keys?.[0] || 'Unknown';
      const cost = group.Metrics?.UnblendedCost?.Amount || '0';
      lines.push(`${service},${parseFloat(cost).toFixed(2)}`);
    }
  }
  
  return lines.join('\n');
}
```

#### EventBridgeスケジュール設定

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

### 3. レポートの確認と分析

#### レポートの内容

月次レポートには以下の情報が含まれます:

- サービス別コスト
- 日次コストトレンド
- 前月比較
- 予算との差異
- コスト最適化の推奨事項

#### レポートの確認方法

```bash
# S3から最新のレポートをダウンロード
aws s3 cp s3://tdnet-cost-reports-YOUR_ACCOUNT_ID/monthly-reports/2026-02.csv ./

# レポートの内容を確認
cat 2026-02.csv
```

## コスト最適化のベストプラクティス

### 1. Lambda関数の最適化

#### メモリサイズの最適化

```typescript
// 適切なメモリサイズを設定
const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
  memorySize: 256, // 128MB → 256MBに増やすことで実行時間が短縮される場合がある
  timeout: Duration.seconds(30),
});
```

**最適化手順**:
1. CloudWatch Logsで実際のメモリ使用量を確認
2. Lambda Power Tuningツールを使用して最適なメモリサイズを特定
3. コストと実行時間のバランスを考慮

#### 不要なログの削減

```typescript
// 本番環境ではDEBUGログを無効化
const logLevel = process.env.STAGE === 'prod' ? 'INFO' : 'DEBUG';
```

### 2. DynamoDBの最適化

#### オンデマンドモードの活用

```typescript
// トラフィックが予測不可能な場合はオンデマンドモード
const table = new dynamodb.Table(this, 'DisclosuresTable', {
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

#### TTLの設定

```typescript
// 古いデータを自動削除してストレージコストを削減
table.addGlobalSecondaryIndex({
  indexName: 'date-partition-index',
  partitionKey: { name: 'date_partition', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'disclosed_at', type: dynamodb.AttributeType.STRING },
});

// TTL属性の設定（90日後に自動削除）
table.addProperty('timeToLiveAttribute', 'ttl');
```

### 3. S3の最適化

#### ライフサイクルポリシーの設定

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

#### Intelligent-Tieringの活用

```typescript
// アクセスパターンに応じて自動的にストレージクラスを変更
bucket.addLifecycleRule({
  id: 'intelligent-tiering',
  enabled: true,
  transitions: [
    {
      storageClass: s3.StorageClass.INTELLIGENT_TIERING,
      transitionAfter: Duration.days(0),
    },
  ],
});
```

### 4. CloudWatch Logsの最適化

#### ログ保持期間の設定

```typescript
// ログを30日間のみ保持
const logGroup = new logs.LogGroup(this, 'CollectorLogs', {
  retention: logs.RetentionDays.ONE_MONTH,
  removalPolicy: RemovalPolicy.DESTROY,
});
```

#### ログフィルタリング

```typescript
// 不要なログをフィルタリング
logger.info('Processing disclosure', { disclosure_id }); // 必要
// logger.debug('Detailed processing info', { ... }); // 本番環境では不要
```

### 5. API Gatewayの最適化

#### キャッシュの有効化

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

## コスト異常の検知と対応

### 1. AWS Cost Anomaly Detectionの設定

```bash
# コスト異常検知の有効化
aws ce create-anomaly-monitor \
  --anomaly-monitor file://anomaly-monitor.json

# アラートの設定
aws ce create-anomaly-subscription \
  --anomaly-subscription file://anomaly-subscription.json
```

### 2. 異常検知時の対応フロー

1. **アラート受信**
   - SNS経由でメール通知

2. **原因の特定**
   - Cost Explorerで異常なコスト増加を確認
   - CloudWatch Logsでエラーログを確認
   - Lambda実行回数、DynamoDBリクエスト数を確認

3. **対応策の実施**
   - 無限ループの停止
   - レート制限の強化
   - 不要なリソースの削除

4. **再発防止**
   - コードの修正
   - アラート閾値の調整
   - 監視の強化

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

## 関連ドキュメント

- [AWS Budgets設定手順書](./aws-budgets-setup.md)
- [外部依存監視ガイド](./external-dependency-monitoring.md)
- [パフォーマンス最適化ガイド](../.kiro/steering/infrastructure/performance-optimization.md)

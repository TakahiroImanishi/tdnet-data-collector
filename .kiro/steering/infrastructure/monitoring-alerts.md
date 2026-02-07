---
inclusion: fileMatch
fileMatchPattern: '**/monitoring/**/*|**/.github/workflows/**/*'
---

# 監視とアラート

このファイルは、TDnet Data Collectorプロジェクトの監視戦略とアラート設定をまとめたものです。

## 監視の目的

1. **可用性の確保**: システムが正常に動作していることを確認
2. **パフォーマンスの維持**: レスポンス時間やスループットを監視
3. **エラーの早期検出**: 問題が深刻化する前に検知
4. **コストの管理**: AWS利用料金を監視

## CloudWatch メトリクス

### Lambda関数

#### 基本メトリクス

| メトリクス | 説明 | 正常範囲 | 警告閾値 | 重大閾値 |
|-----------|------|---------|---------|---------|
| Invocations | 実行回数 | - | - | - |
| Errors | エラー数 | 0 | > 5/5分 | > 10/5分 |
| Duration | 実行時間 | < 5分 | > 10分 | > 13分 |
| Throttles | スロットリング | 0 | > 0 | > 5 |
| ConcurrentExecutions | 同時実行数 | < 5 | > 8 | > 10 |

#### カスタムメトリクス

```typescript
// カスタムメトリクスの送信
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

async function publishMetric(
    metricName: string,
    value: number,
    unit: string = 'Count'
): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnet/Collector',
        MetricData: [
            {
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: [
                    {
                        Name: 'Environment',
                        Value: process.env.ENVIRONMENT || 'dev',
                    },
                ],
            },
        ],
    }));
}

// 使用例
await publishMetric('DisclosuresCollected', collectedCount, 'Count');
await publishMetric('DisclosuresFailed', failedCount, 'Count');
await publishMetric('ScrapingDuration', duration, 'Milliseconds');
```

#### ビジネスメトリクス

| メトリクス | 説明 | 正常範囲 | 警告閾値 |
|-----------|------|---------|---------|
| DisclosuresCollected | 収集成功数 | > 0 | = 0（24時間） |
| DisclosuresFailed | 収集失敗数 | 0 | > 10/日 |
| PDFDownloadSize | PDFサイズ合計 | - | > 1GB/日 |
| ScrapingDuration | スクレイピング時間 | < 30秒 | > 60秒 |

### DynamoDB

#### 基本メトリクス

| メトリクス | 説明 | 正常範囲 | 警告閾値 | 重大閾値 |
|-----------|------|---------|---------|---------|
| UserErrors | ユーザーエラー | 0 | > 5/5分 | > 20/5分 |
| SystemErrors | システムエラー | 0 | > 0 | > 5/5分 |
| ConsumedReadCapacityUnits | 読み込み消費 | - | - | - |
| ConsumedWriteCapacityUnits | 書き込み消費 | - | - | - |
| ThrottledRequests | スロットリング | 0 | > 0 | > 10/5分 |

### S3

#### 基本メトリクス

| メトリクス | 説明 | 正常範囲 | 警告閾値 |
|-----------|------|---------|---------|
| NumberOfObjects | オブジェクト数 | - | - |
| BucketSizeBytes | バケットサイズ | - | > 10GB |
| AllRequests | リクエスト数 | - | - |
| 4xxErrors | クライアントエラー | 0 | > 10/時間 |
| 5xxErrors | サーバーエラー | 0 | > 0 |

### API Gateway

#### 基本メトリクス

| メトリクス | 説明 | 正常範囲 | 警告閾値 | 重大閾値 |
|-----------|------|---------|---------|---------|
| Count | リクエスト数 | - | - | - |
| 4XXError | クライアントエラー | < 5% | > 10% | > 20% |
| 5XXError | サーバーエラー | 0% | > 1% | > 5% |
| Latency | レイテンシ | < 1秒 | > 3秒 | > 5秒 |
| IntegrationLatency | 統合レイテンシ | < 500ms | > 2秒 | > 4秒 |

## CloudWatch アラーム

### Lambda関数のアラーム

#### エラー率アラーム

```typescript
// CDKでのアラーム設定
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

const errorAlarm = new cloudwatch.Alarm(this, 'CollectorErrorAlarm', {
    metric: collectorFn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Lambda関数のエラーが5件を超えました',
    alarmName: 'tdnet-collector-errors',
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
});

// SNS通知の設定
errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

#### 実行時間アラーム

```typescript
const durationAlarm = new cloudwatch.Alarm(this, 'CollectorDurationAlarm', {
    metric: collectorFn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 600000, // 10分（ミリ秒）
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Lambda実行時間が10分を超えました',
    alarmName: 'tdnet-collector-duration',
});

durationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

#### スロットリングアラーム

```typescript
const throttleAlarm = new cloudwatch.Alarm(this, 'CollectorThrottleAlarm', {
    metric: collectorFn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    alarmDescription: 'Lambdaスロットリングが発生しました',
    alarmName: 'tdnet-collector-throttles',
});

throttleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### DynamoDBのアラーム

#### ユーザーエラーアラーム

```typescript
const dynamoErrorAlarm = new cloudwatch.Alarm(this, 'DynamoUserErrorAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'UserErrors',
        dimensionsMap: {
            TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'DynamoDBユーザーエラーが5件を超えました',
    alarmName: 'tdnet-dynamodb-user-errors',
});

dynamoErrorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

#### スロットリングアラーム

```typescript
const dynamoThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoThrottleAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ThrottledRequests',
        dimensionsMap: {
            TableName: table.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    alarmDescription: 'DynamoDBスロットリングが発生しました',
    alarmName: 'tdnet-dynamodb-throttles',
});

dynamoThrottleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### API Gatewayのアラーム

#### 5xxエラーアラーム

```typescript
const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxErrorAlarm', {
    metric: api.metricServerError({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'API Gateway 5xxエラーが5件を超えました',
    alarmName: 'tdnet-api-5xx-errors',
});

api5xxAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

#### レイテンシアラーム

```typescript
const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
    metric: api.metricLatency({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 3000, // 3秒（ミリ秒）
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'API Gatewayレイテンシが3秒を超えました',
    alarmName: 'tdnet-api-latency',
});

apiLatencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### カスタムメトリクスのアラーム

#### 収集失敗アラーム

```typescript
const collectionFailureAlarm = new cloudwatch.Alarm(this, 'CollectionFailureAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/Collector',
        metricName: 'DisclosuresFailed',
        statistic: 'Sum',
        period: cdk.Duration.hours(24),
    }),
    threshold: 10,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: '24時間で10件以上の収集失敗が発生しました',
    alarmName: 'tdnet-collection-failures',
});

collectionFailureAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

#### データ収集停止アラーム

```typescript
const noDataAlarm = new cloudwatch.Alarm(this, 'NoDataAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/Collector',
        metricName: 'DisclosuresCollected',
        statistic: 'Sum',
        period: cdk.Duration.hours(24),
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    alarmDescription: '24時間データ収集がありません',
    alarmName: 'tdnet-no-data-collected',
    treatMissingData: cloudwatch.TreatMissingData.BREACHING,
});

noDataAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

## CloudWatch ダッシュボード

### ダッシュボード構成

```typescript
const dashboard = new cloudwatch.Dashboard(this, 'TdnetDashboard', {
    dashboardName: 'tdnet-collector-dashboard',
});

// Lambda メトリクス
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [collectorFn.metricInvocations()],
        width: 12,
    }),
    new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [collectorFn.metricErrors()],
        width: 12,
    })
);

dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [collectorFn.metricDuration()],
        width: 12,
    }),
    new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        left: [collectorFn.metricThrottles()],
        width: 12,
    })
);

// ビジネスメトリクス
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'Disclosures Collected',
        left: [
            new cloudwatch.Metric({
                namespace: 'TDnet/Collector',
                metricName: 'DisclosuresCollected',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
            }),
        ],
        width: 12,
    }),
    new cloudwatch.GraphWidget({
        title: 'Disclosures Failed',
        left: [
            new cloudwatch.Metric({
                namespace: 'TDnet/Collector',
                metricName: 'DisclosuresFailed',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
            }),
        ],
        width: 12,
    })
);

// DynamoDB メトリクス
dashboard.addWidgets(
    new cloudwatch.GraphWidget({
        title: 'DynamoDB Read/Write Capacity',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedReadCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
            }),
        ],
        right: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'ConsumedWriteCapacityUnits',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
            }),
        ],
        width: 12,
    }),
    new cloudwatch.GraphWidget({
        title: 'DynamoDB Errors',
        left: [
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'UserErrors',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
            }),
            new cloudwatch.Metric({
                namespace: 'AWS/DynamoDB',
                metricName: 'SystemErrors',
                dimensionsMap: { TableName: table.tableName },
                statistic: 'Sum',
            }),
        ],
        width: 12,
    })
);
```

## CloudWatch Logs Insights

### よく使うクエリ

#### エラーログの検索

```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### 実行時間の分析

```
fields @timestamp, @duration
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
```

#### 企業コード別の収集状況

```
fields @timestamp, company_code, disclosure_id
| filter @message like /Successfully collected/
| stats count() by company_code
| sort count() desc
```

#### エラー種別の集計

```
fields @timestamp, error_type
| filter @message like /ERROR/
| stats count() by error_type
| sort count() desc
```

### ログ保持期間

```typescript
// CDKでのログ保持期間設定
import * as logs from 'aws-cdk-lib/aws-logs';

const logGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
    logGroupName: `/aws/lambda/${collectorFn.functionName}`,
    retention: logs.RetentionDays.ONE_MONTH, // 本番: 3ヶ月推奨
    removalPolicy: cdk.RemovalPolicy.DESTROY, // 本番: RETAIN推奨
});
```

## SNS通知

### アラート通知の設定

```typescript
const alertTopic = new sns.Topic(this, 'AlertTopic', {
    topicName: 'tdnet-alerts',
    displayName: 'TDnet Data Collector Alerts',
});

// メール通知の追加
alertTopic.addSubscription(
    new subscriptions.EmailSubscription('alerts@example.com')
);

// Slack通知の追加（Lambda経由）
const slackNotifierFn = new lambda.Function(this, 'SlackNotifier', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/slack-notifier'),
    environment: {
        SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL!,
    },
});

alertTopic.addSubscription(
    new subscriptions.LambdaSubscription(slackNotifierFn)
);
```

### Slack通知の実装

```typescript
// lambda/slack-notifier/index.ts
import axios from 'axios';

interface SNSEvent {
    Records: Array<{
        Sns: {
            Subject: string;
            Message: string;
        };
    }>;
}

export const handler = async (event: SNSEvent): Promise<void> => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL!;
    
    for (const record of event.Records) {
        const { Subject, Message } = record.Sns;
        
        await axios.post(webhookUrl, {
            text: `🚨 *${Subject}*\n\`\`\`${Message}\`\`\``,
            username: 'TDnet Alerts',
            icon_emoji: ':warning:',
        });
    }
};
```

## X-Ray トレーシング

### X-Rayの有効化

```typescript
// CDKでのX-Ray有効化
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    tracing: lambda.Tracing.ACTIVE,
});
```

### カスタムセグメントの追加

```typescript
import AWSXRay from 'aws-xray-sdk-core';

async function scrapeWithTracing(url: string): Promise<any> {
    const segment = AWSXRay.getSegment();
    const subsegment = segment?.addNewSubsegment('TDnet Scraping');
    
    try {
        subsegment?.addAnnotation('url', url);
        
        const result = await scrapeDisclosureList(url);
        
        subsegment?.addMetadata('result_count', result.length);
        subsegment?.close();
        
        return result;
    } catch (error) {
        subsegment?.addError(error as Error);
        subsegment?.close();
        throw error;
    }
}
```

## コスト監視

### AWS Budgets

```typescript
import * as budgets from 'aws-cdk-lib/aws-budgets';

new budgets.CfnBudget(this, 'MonthlyBudget', {
    budget: {
        budgetName: 'tdnet-monthly-budget',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: {
            amount: 15,
            unit: 'USD',
        },
    },
    notificationsWithSubscribers: [
        {
            notification: {
                notificationType: 'ACTUAL',
                comparisonOperator: 'GREATER_THAN',
                threshold: 80,
                thresholdType: 'PERCENTAGE',
            },
            subscribers: [
                {
                    subscriptionType: 'EMAIL',
                    address: 'billing@example.com',
                },
            ],
        },
        {
            notification: {
                notificationType: 'FORECASTED',
                comparisonOperator: 'GREATER_THAN',
                threshold: 100,
                thresholdType: 'PERCENTAGE',
            },
            subscribers: [
                {
                    subscriptionType: 'EMAIL',
                    address: 'billing@example.com',
                },
            ],
        },
    ],
});
```

## 運用手順

### アラート対応フロー

1. **アラート受信**
   - SNS/Slackで通知を受信
   - アラームの種類と重大度を確認

2. **初期調査**
   - CloudWatch Logsでエラーログを確認
   - X-Rayトレースで実行フローを確認
   - メトリクスで傾向を確認

3. **対応実施**
   - 一時的な問題: 自動復旧を待つ
   - 設定問題: 設定を修正してデプロイ
   - バグ: 修正してデプロイ
   - 外部要因: TDnetの状態を確認

4. **事後対応**
   - インシデントレポート作成
   - 再発防止策の検討
   - アラート閾値の見直し

### 定期レビュー

**週次レビュー:**
- エラー率の確認
- パフォーマンスの確認
- コストの確認

**月次レビュー:**
- アラート発火状況の確認
- 閾値の見直し
- ダッシュボードの改善

## 関連ドキュメント

### 参照元（このファイルを参照しているファイル）

- **エラーハンドリング基本原則**: `../core/error-handling-patterns.md` - エラーアラート設定
- **デプロイチェックリスト**: `deployment-checklist.md` - デプロイ後の監視手順
- **セキュリティベストプラクティス**: `../security/security-best-practices.md` - セキュリティ監視

### 参照先（このファイルが参照しているファイル）

このファイルは他のsteeringファイルを参照していません。

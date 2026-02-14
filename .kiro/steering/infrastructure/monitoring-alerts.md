---
inclusion: fileMatch
fileMatchPattern: '**/monitoring/**/*|**/.github/workflows/**/*'
---

# 監視とアラート

## CloudWatch メトリクス閾値

### Lambda

| メトリクス | 警告 | 重大 |
|-----------|------|------|
| Errors | > 5/5分 | > 10/5分 |
| Duration | > 10分 | > 13分 |
| Throttles | > 0 | > 5 |
| ConcurrentExecutions | > 8 | > 10 |

### DynamoDB

| メトリクス | 警告 | 重大 |
|-----------|------|------|
| UserErrors | > 5/5分 | > 20/5分 |
| SystemErrors | > 0 | > 5/5分 |
| ThrottledRequests | > 0 | > 10/5分 |

### API Gateway

| メトリクス | 警告 | 重大 |
|-----------|------|------|
| 4XXError | > 10% | > 20% |
| 5XXError | > 1% | > 5% |
| Latency | > 3秒 | > 5秒 |

### ビジネスメトリクス

| メトリクス | 警告閾値 |
|-----------|---------|
| DisclosuresCollected | = 0（24時間） |
| DisclosuresFailed | > 10/日 |
| PDFDownloadSize | > 1GB/日 |
| ScrapingDuration | > 60秒 |

## カスタムメトリクス送信

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

async function publishMetric(name: string, value: number, unit = 'Count'): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnet/Collector',
        MetricData: [{
            MetricName: name,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: [{ Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }],
        }],
    }));
}
```

## CDKアラーム設定

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';

// エラー率アラーム
new cloudwatch.Alarm(this, 'ErrorAlarm', {
    metric: fn.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
    threshold: 5,
    evaluationPeriods: 1,
    alarmDescription: 'Lambda errors > 5',
}).addAlarmAction(new actions.SnsAction(alertTopic));

// DLQアラーム
new cloudwatch.Alarm(this, 'DLQAlarm', {
    metric: dlq.metricApproximateNumberOfMessagesVisible(),
    threshold: 1,
    evaluationPeriods: 1,
    alarmDescription: 'DLQ has messages',
}).addAlarmAction(new actions.SnsAction(alertTopic));
```

## CloudWatch Logs Insights

```
# エラーログ検索
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100

# 実行時間分析
fields @timestamp, @duration
| stats avg(@duration), max(@duration) by bin(5m)

# エラー種別集計
fields @timestamp, error_type
| filter @message like /ERROR/
| stats count() by error_type
| sort count() desc
```

## 運用手順

### アラート対応
1. SNS/Slackで通知受信
2. CloudWatch Logsでエラー確認
3. X-Rayトレースで実行フロー確認
4. 対応実施（修正・デプロイ）
5. インシデントレポート作成

### 定期レビュー
- **週次**: エラー率、パフォーマンス、コスト確認
- **月次**: アラート発火状況、閾値見直し

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーアラート設定
- `deployment-checklist.md` - デプロイ後の監視手順
- `../security/security-best-practices.md` - セキュリティ監視
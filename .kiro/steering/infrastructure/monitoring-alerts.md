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
async function publishMetric(name: string, value: number): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnet/Collector',
        MetricData: [{ MetricName: name, Value: value, Timestamp: new Date() }],
    }));
}
```

## 運用手順

1. SNS/Slackで通知受信
2. CloudWatch Logsでエラー確認
3. X-Rayトレースで実行フロー確認
4. 対応実施（修正・デプロイ）

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーアラート設定
- `deployment-checklist.md` - デプロイ後の監視手順
- `../security/security-best-practices.md` - セキュリティ監視
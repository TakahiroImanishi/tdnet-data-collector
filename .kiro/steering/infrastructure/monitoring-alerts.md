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

| メトリクス | 警告 | 重大 | 備考 |
|-----------|------|------|------|
| 4XXError | > 10件/5分 | > 20件/5分 | クライアント側エラー（認証失敗、不正リクエスト等）。急増時はAPIキーやクライアント実装の問題を示唆 |
| 5XXError | > 0件/5分 | > 5件/5分 | サーバー側エラー。即座に対応が必要 |
| Latency | > 3秒 | > 5秒 | 平均レイテンシ。Lambda関数の最適化が必要 |

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
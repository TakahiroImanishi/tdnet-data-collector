---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts'
---

# Error Handling Enforcement

エラーハンドリングの強制化方針。

## Lambda DLQ必須化

| トリガー | DLQ必須 |
|---------|---------|
| EventBridge/SQS/SNS/S3/DynamoDB Streams | ✅ 必須 |
| API Gateway/Lambda直接呼び出し（同期） | ❌ 不要 |

```typescript
const dlq = new sqs.Queue(this, 'CollectorDLQ', { retentionPeriod: cdk.Duration.days(14) });
const collectorFn = new lambda.Function(this, 'CollectorFunction', { deadLetterQueue: dlq, retryAttempts: 2 });
```

## CloudWatch Alarms必須設定

| アラーム | 閾値 | 評価期間 |
|---------|------|---------|
| Errors | > 5件 | 5分 |
| Duration | > タイムアウトの80% | 5分 |
| Throttles | ≥ 1件 | 5分 |
| DLQ Messages | ≥ 1件 | 1分 |

## MonitoredLambda Construct

`cdk/lib/constructs/monitored-lambda.ts` - DLQ、Alarms、X-Ray自動設定

```typescript
const collectorLambda = new MonitoredLambda(this, 'Collector', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/collector'),
    alertTopic,
    enableDlq: true,
});
```

## エラーハンドリングテスト

必須項目: 再試行、構造化ログ、部分的失敗、非再試行エラー、メトリクス

```typescript
test('should retry on network errors', async () => {
    const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ data: 'success' });
    await handler(mockEvent, mockContext);
    expect(mockFetch).toHaveBeenCalledTimes(2);
});
```

## 実装チェックリスト

### Lambda関数作成時

- [ ] DLQ設定（非同期の場合）
- [ ] DLQプロセッサー実装
- [ ] CloudWatch Alarms設定
- [ ] 構造化ログ実装
- [ ] エラーハンドリングテスト実装

### CDKスタック作成時

- [ ] `MonitoredLambda` Construct使用
- [ ] アラート通知用SNSトピック設定

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - 詳細な実装パターン

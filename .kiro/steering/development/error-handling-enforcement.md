---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts'
---

# Error Handling Enforcement

エラーハンドリングの強制化方針。

## 役割分担

| ファイル | 役割 |
|---------|------|
| `core/error-handling-patterns.md` | エラー分類、再試行戦略 |
| `error-handling-implementation.md` | 実装パターン、AWS SDK設定 |
| このファイル | DLQ必須化、Alarms設定、テスト |

## Lambda DLQ必須化

### 対象Lambda関数

| トリガー | DLQ必須 |
|---------|---------|
| EventBridge/SQS/SNS/S3/DynamoDB Streams | ✅ 必須 |
| API Gateway/Lambda直接呼び出し（同期） | ❌ 不要 |

### DLQ標準仕様

```typescript
const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    retentionPeriod: cdk.Duration.days(14),
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    deadLetterQueue: dlq,
    retryAttempts: 2,
});
```

### DLQプロセッサー

```typescript
export const handler = async (event: SQSEvent) => {
    for (const record of event.Records) {
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: 'Lambda execution failed',
            Message: JSON.stringify({ messageId: record.messageId, failedMessage: JSON.parse(record.body) }),
        }));
    }
};
```

## CloudWatch Alarms必須設定

| アラーム | 閾値 | 評価期間 |
|---------|------|---------|
| Errors | > 5件 | 5分 |
| Duration | > タイムアウトの80% | 5分 |
| Throttles | ≥ 1件 | 5分 |
| DLQ Messages | ≥ 1件 | 1分 |

## MonitoredLambda Construct

**ファイル:** `cdk/lib/constructs/monitored-lambda.ts`

### 機能

- DLQ自動設定
- DLQプロセッサー自動作成
- CloudWatch Alarms自動設定
- X-Rayトレーシング有効化

### 使用例

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

### 必須テスト項目

- [ ] 再試行テスト
- [ ] 構造化ログテスト
- [ ] 部分的失敗テスト
- [ ] 非再試行エラーテスト
- [ ] メトリクステスト

### テスト実装例

```typescript
test('should handle network errors with retry', async () => {
    const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ data: 'success' });
    
    const result = await handler(mockEvent, mockContext);
    expect(mockFetch).toHaveBeenCalledTimes(2);
});

test('should log errors with structured format', async () => {
    await expect(handler(invalidEvent, mockContext)).rejects.toThrow();
    expect(mockLogger).toHaveBeenCalledWith(
        expect.objectContaining({ error_type: expect.any(String) })
    );
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

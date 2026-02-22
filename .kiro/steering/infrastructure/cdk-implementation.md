---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*.ts'
---

# CDK実装ガイド

CDKコード実装時の必須チェックリスト。

## 実装チェックリスト

### Stack実装時（`**/cdk/lib/**/*-stack.ts`）
- [ ] セキュリティベストプラクティス適用（`../security/security-best-practices.md`参照）
- [ ] 命名規則遵守（`../development/tdnet-file-naming.md`参照）
- [ ] デプロイチェックリスト確認（`deployment-checklist.md`参照）

### Construct実装時（`**/cdk/lib/constructs/**/*.ts`）
- [ ] Lambda Construct: エラーハンドリング強制（下記参照）
- [ ] Lambda Construct: パフォーマンス最適化（`performance-optimization.md`参照）
- [ ] 命名規則遵守（`../development/tdnet-file-naming.md`参照）

### 共通
- [ ] MCPサーバー活用（`../development/mcp-server-guidelines.md`参照）
- [ ] CDK Nag適用（`AwsSolutionsChecks.check(app)`）

## 基本原則

### 1. セキュリティ
- IAM: 最小権限、ワイルドカード禁止
- 暗号化: TLS 1.2以上、SSE-S3/AWS管理キー
- 監査: CloudTrail有効化

### 2. コスト最適化
- Lambda: メモリ128-512MB、タイムアウト最小化
- DynamoDB: オンデマンド課金、GSI最小限
- S3: ライフサイクルポリシー設定

### 3. エラーハンドリング
- Lambda: DLQ設定（非同期のみ）
- CloudWatch Alarms: エラー率、DLQメッセージ数
- 構造化ログ: error_type, error_message, context

### 4. 命名規則
- Stack: `{ProjectName}{Purpose}Stack`（例: `TdnetDataCollectorFoundationStack`）
- Construct: `{Service}{Purpose}Construct`（例: `LambdaCollectorConstruct`）
- リソース: ケバブケース（例: `tdnet-data-collector-table`）

---

## Lambda Constructエラーハンドリング強制化

### Lambda DLQ必須化

| トリガー | DLQ必須 |
|---------|---------|
| EventBridge/SQS/SNS/S3/DynamoDB Streams | ✅ 必須 |
| API Gateway/Lambda直接呼び出し（同期） | ❌ 不要 |

```typescript
const dlq = new sqs.Queue(this, 'CollectorDLQ', { 
    retentionPeriod: cdk.Duration.days(14) 
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', { 
    deadLetterQueue: dlq, 
    retryAttempts: 2 
});
```

### CloudWatch Alarms必須設定

| アラーム | 閾値 | 評価期間 |
|---------|------|---------|
| Errors | > 5件 | 5分 |
| Duration | > タイムアウトの80% | 5分 |
| Throttles | ≥ 1件 | 5分 |
| DLQ Messages | ≥ 1件 | 1分 |

### MonitoredLambda Construct

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

### エラーハンドリングテスト

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

### Lambda Construct実装チェックリスト

- [ ] DLQ設定（非同期の場合）
- [ ] DLQプロセッサー実装
- [ ] CloudWatch Alarms設定
- [ ] 構造化ログ実装
- [ ] エラーハンドリングテスト実装
- [ ] `MonitoredLambda` Construct使用
- [ ] アラート通知用SNSトピック設定

---

## 関連ドキュメント

- `../security/security-best-practices.md` - セキュリティ詳細
- `performance-optimization.md` - Lambda Constructパフォーマンス
- `../development/tdnet-file-naming.md` - 命名規則詳細
- `deployment-checklist.md` - デプロイ手順
- `../development/mcp-server-guidelines.md` - MCPサーバー活用
- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `../development/error-handling-implementation.md` - エラーハンドリング詳細実装

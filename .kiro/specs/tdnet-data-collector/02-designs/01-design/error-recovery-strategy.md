# エラーリカバリー戦略

**バージョン:** 1.0  
**最終更新:** 2026-02-15  
**ステータス:** Draft

---

## 概要

### エラーリカバリーの重要性

TDnet Data Collectorは、外部API（TDnet）からデータを収集するシステムであり、一時的な障害が発生する可能性があります：

- **ネットワーク障害**: 一時的な接続エラー、タイムアウト
- **外部サービス障害**: TDnetのメンテナンス、過負荷
- **レート制限**: APIリクエスト制限の超過
- **AWS一時的障害**: DynamoDB/S3のスロットリング

適切なエラーリカバリー戦略により、システムの信頼性と可用性を向上させます。

### 自動リカバリーと手動介入の使い分け

| 種類 | 対象エラー | 対応方法 | 例 |
|------|-----------|---------|-----|
| **自動リカバリー** | 一時的な障害 | 指数バックオフによる再試行 | ネットワークエラー、5xxエラー、レート制限 |
| **手動介入** | 恒久的な障害 | DLQに保存し、アラート通知 | 認証エラー、設定エラー、データ整合性エラー |

**基本方針:**
- 再試行可能なエラーは自動リカバリー（最大3回）
- 再試行不可能なエラーはDLQに送信し、手動介入を促す
- 部分的失敗は成功分をコミットし、失敗分をログ記録

---

## Dead Letter Queue (DLQ) 設計

### DLQの目的

Dead Letter Queue (DLQ) は、処理に失敗したメッセージを一時的に保存し、後で再処理または分析するための仕組みです。

**主な用途:**
- 再試行回数を超えたメッセージの保存
- エラー原因の分析とデバッグ
- 手動介入による再処理
- システム障害時のメッセージ保護

### 設計の要点

**DLQ設定:**
```typescript
const dlq = new sqs.Queue(this, 'DLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
    encryption: sqs.QueueEncryption.KMS_MANAGED,
});

// DLQメッセージ数の監視アラーム
const alarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
    metric: dlq.metricApproximateNumberOfMessagesVisible(),
    threshold: 1,
    evaluationPeriods: 1,
});
alarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
```

**メッセージ属性:**
- `disclosure_id`: 開示情報ID
- `error_type`: エラー種別（NetworkError, ValidationError等）
- `error_message`: エラーメッセージ
- `retry_count`: 再試行回数
- `timestamp`: エラー発生時刻
- `original_payload`: 元のペイロード

**詳細実装**: `../../steering/development/error-handling-implementation.md`

---

## 自動リカバリーの範囲

### 再試行可能なエラー

以下のエラーは自動的に再試行されます（最大3回、指数バックオフ）：

| エラー種別 | 例 | 再試行戦略 |
|-----------|-----|----------|
| ネットワークエラー | ECONNRESET, ETIMEDOUT | 初期遅延2秒、倍率2、ジッター有効 |
| HTTPエラー（5xx） | 500, 502, 503, 504 | 初期遅延2秒、倍率2、ジッター有効 |
| レート制限 | 429 Too Many Requests | 初期遅延5秒、倍率2、ジッター有効 |
| AWSスロットリング | ThrottlingException | 初期遅延1秒、倍率2、ジッター有効 |

### 実装例

```typescript
import { retryWithBackoff } from '../utils/retry';

await retryWithBackoff(
    async () => await scrapeTdnetList(date),
    {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
        jitter: true,
    }
);
```

**詳細**: `../../steering/core/error-handling-patterns.md`

---

## 手動介入が必要なケース

### 再試行不可能なエラー

以下のエラーは再試行せず、DLQに送信してアラート通知します：

| エラー種別 | 例 | 対応方法 |
|-----------|-----|---------|
| 認証エラー | 401 Unauthorized, 403 Forbidden | APIキー確認、設定修正 |
| データ不正 | 404 Not Found, 400 Bad Request | データ検証、ロジック修正 |
| 設定エラー | 環境変数未設定、バケット不存在 | 設定確認、デプロイ修正 |
| データ整合性エラー | 重複ID、必須フィールド欠損 | データ調査、手動修正 |

### 手動介入フロー

1. **DLQメッセージ受信** → CloudWatch Alarmトリガー → SNS通知
2. **エラー分析** → CloudWatch Logsでスタックトレース確認
3. **原因特定** → 設定エラー、データ不正、バグ等
4. **修正実施** → 設定修正、コード修正、データ修正
5. **再処理** → DLQメッセージを手動で再送信

---

## リカバリー手順書

### 1. DLQメッセージの確認

**AWS Console:**
```
SQS → Queues → tdnet-collector-dlq → Send and receive messages
```

**AWS CLI:**
```bash
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/{account-id}/tdnet-collector-dlq \
  --max-number-of-messages 10 \
  --visibility-timeout 300
```

### 2. エラー原因の分析

**CloudWatch Logs:**
```
CloudWatch → Log groups → /aws/lambda/tdnet-collector → Filter by disclosure_id
```

**検索クエリ:**
```
fields @timestamp, @message
| filter disclosure_id = "20240115_7203_001"
| sort @timestamp desc
```

### 3. 再処理の実行

**手動再実行（AWS Console）:**
```
Lambda → Functions → tdnet-collector → Test → Event JSON入力 → Test
```

**Event JSON例:**
```json
{
  "mode": "on-demand",
  "start_date": "2024-01-15",
  "end_date": "2024-01-15",
  "disclosure_ids": ["20240115_7203_001"]
}
```

**バッチ再処理（AWS CLI）:**
```bash
aws lambda invoke \
  --function-name tdnet-collector \
  --payload '{"mode":"on-demand","start_date":"2024-01-15","end_date":"2024-01-15"}' \
  response.json
```

### 4. 整合性確認

**DynamoDB確認:**
```bash
aws dynamodb get-item \
  --table-name tdnet_disclosures \
  --key '{"disclosure_id":{"S":"20240115_7203_001"}}'
```

**S3確認:**
```bash
aws s3 ls s3://tdnet-pdfs-{account-id}/pdfs/2024/01/15/ | grep 7203
```

---

## リカバリーLambda関数

### 目的

DLQメッセージを自動的に再処理するLambda関数を実装します。

### 実装の要点

**基本フロー:**
```typescript
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const failedItems: SQSBatchItemFailure[] = [];
    
    for (const record of event.Records) {
        try {
            const message = JSON.parse(record.body);
            
            // エラー種別に応じた処理
            if (message.error_type === 'NetworkError') {
                // ネットワークエラー → 再試行
                await retryDisclosureCollection(message.disclosure_id);
            } else if (message.error_type === 'ValidationError') {
                // バリデーションエラー → ログ記録のみ
                logger.error('Validation error, manual intervention required', message);
            }
            
        } catch (error) {
            // 再処理失敗 → DLQに戻す
            failedItems.push({ itemIdentifier: record.messageId });
        }
    }
    
    return { batchItemFailures: failedItems };
};
```

**詳細実装**: `../../steering/development/error-handling-implementation.md`

---

## 監視とアラート

### CloudWatchメトリクス

| メトリクス | 説明 | アラート閾値 |
|-----------|------|------------|
| DLQMessagesVisible | DLQ内のメッセージ数 | > 1件でCritical |
| DLQMessagesAge | 最古メッセージの経過時間 | > 24時間でWarning |
| RecoverySuccessRate | リカバリー成功率 | < 80%でWarning |
| RecoveryDuration | リカバリー処理時間 | > 5分でWarning |

### CloudWatch Alarms

```typescript
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
    metric: dlq.metricApproximateNumberOfMessagesVisible(),
    threshold: 1,
    evaluationPeriods: 1,
    alarmDescription: 'DLQにメッセージが蓄積されています',
});
dlqAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));
```

**詳細**: `../../steering/infrastructure/monitoring-alerts.md`

---

## テスト戦略

### ユニットテスト

| テストケース | 検証内容 |
|------------|---------|
| 再試行可能エラー | 指数バックオフで再試行、最大3回 |
| 再試行不可能エラー | DLQに送信、アラート通知 |
| 部分的失敗 | 成功分コミット、失敗分DLQ送信 |

### 統合テスト

| テストケース | 検証内容 |
|------------|---------|
| DLQメッセージ処理 | DLQからメッセージ取得、再処理実行 |
| リカバリーLambda | DLQトリガー、自動再処理 |
| アラート通知 | DLQメッセージ蓄積時のSNS通知 |

### E2Eテスト

| テストケース | 検証内容 |
|------------|---------|
| ネットワーク障害シミュレーション | 一時的障害からの自動リカバリー |
| 恒久的障害シミュレーション | DLQ送信、手動介入フロー |

**詳細**: `../../steering/development/testing-strategy.md`

---

## トラブルシューティングガイド

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| DLQメッセージが増加 | 外部API障害、設定エラー | CloudWatch Logsでエラー確認、設定修正 |
| リカバリー失敗 | データ不正、バグ | データ検証、コード修正 |
| 整合性エラー | Two-Phase Commit失敗 | 整合性チェックバッチ実行 |
| レート制限超過 | 並列実行数過多 | 並列度削減、遅延時間増加 |

### エスカレーションフロー

1. **Level 1（自動）**: 指数バックオフ再試行（最大3回）
2. **Level 2（自動）**: DLQ送信、アラート通知
3. **Level 3（手動）**: エラー分析、設定修正
4. **Level 4（手動）**: コード修正、デプロイ
5. **Level 5（手動）**: データ修正、手動再処理

---

## 関連ドキュメント

### 設計ドキュメント
- **[Design Document](./design.md)** - システム全体設計
- **[Requirements](./requirements.md)** - 要件定義（要件6.4: エラー時の部分的成功）
- **[Data Integrity Design](./data-integrity-design.md)** - データ整合性保証

### 実装ガイドライン（Steering）
- **[エラーハンドリングパターン](../../steering/core/error-handling-patterns.md)** - エラー分類、再試行戦略
- **[エラーハンドリング実装](../../steering/development/error-handling-implementation.md)** - DLQ実装、リカバリーLambda
- **[テスト戦略](../../steering/development/testing-strategy.md)** - エラーリカバリーテスト
- **[監視とアラート](../../steering/infrastructure/monitoring-alerts.md)** - DLQ監視設定

---

**最終更新:** 2026-02-15

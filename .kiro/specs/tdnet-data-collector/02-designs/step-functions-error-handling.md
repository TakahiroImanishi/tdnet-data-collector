# Step Functions エラーハンドリング設計

**作成日**: 2026-02-22
**バージョン**: 1.0
**ステータス**: 完了

## 概要

Step Functionsワークフローにおけるエラーハンドリング戦略を定義します。各ステップのエラー種別、リトライ戦略、キャッチ処理、DLQ連携を詳細に設計します。

## エラー分類

### 1. Retryable（再試行可能）

一時的なエラーで、再試行により成功する可能性が高いエラー。

| エラー種別 | 例 | 対応 |
|-----------|-----|------|
| ネットワークエラー | ECONNRESET, ETIMEDOUT | 指数バックオフで3回リトライ |
| Lambda サービスエラー | Lambda.ServiceException, Lambda.TooManyRequestsException | 指数バックオフで3回リトライ |
| DynamoDB スロットリング | ProvisionedThroughputExceededException | 指数バックオフで3回リトライ |
| レート制限 | 429 Too Many Requests | 1秒待機後5回リトライ |
| タスク失敗 | States.TaskFailed | 指数バックオフで3回リトライ |

### 2. Non-Retryable（再試行不可）

再試行しても成功しないエラー。即座に失敗させる。

| エラー種別 | 例 | 対応 |
|-----------|-----|------|
| 認証エラー | 401 Unauthorized, 403 Forbidden | 即座に失敗、DLQへ |
| バリデーションエラー | 400 Bad Request, ValidationError | 即座に失敗、DLQへ |
| リソース不存在 | 404 Not Found | 即座に失敗、DLQへ |
| 設定エラー | ConfigurationError | 即座に失敗、DLQへ |

### 3. Partial Failure（部分的失敗）

バッチ処理で一部のアイテムが失敗しても、成功したアイテムは保存する。

| エラー種別 | 例 | 対応 |
|-----------|-----|------|
| データ検証エラー | 一部アイテムのバリデーション失敗 | 成功分を保存、失敗分を記録 |
| 保存エラー | 一部アイテムのDynamoDB保存失敗 | 成功分を保存、失敗分をDLQへ |

## ステップ別エラーハンドリング

### 1. Initialize（初期化）

#### エラー種別と対応

| エラー | ErrorEquals | リトライ | バックオフ | 最大試行 | Catch処理 |
|-------|-------------|---------|----------|---------|----------|
| Lambda サービスエラー | Lambda.ServiceException, Lambda.AWSLambdaException, Lambda.SdkClientException, Lambda.TooManyRequestsException | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| ネットワークエラー | States.TaskFailed | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| バリデーションエラー | ValidationError | なし | - | - | HandleInitializationError |
| 認証エラー | AuthenticationError | なし | - | - | HandleInitializationError |
| その他すべて | States.ALL | なし | - | - | HandleInitializationError |

#### ASL設定

```json
{
  "Retry": [
    {
      "ErrorEquals": [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException"
      ],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    },
    {
      "ErrorEquals": ["States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["ValidationError", "AuthenticationError"],
      "ResultPath": "$.error",
      "Next": "HandleInitializationError"
    },
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "HandleInitializationError"
    }
  ]
}
```

### 2. FetchPageData（データ取得）

#### エラー種別と対応

| エラー | ErrorEquals | リトライ | バックオフ | 最大試行 | Catch処理 |
|-------|-------------|---------|----------|---------|----------|
| レート制限 | RateLimitError | あり | 固定 (1s) | 5回 | - |
| Lambda サービスエラー | Lambda.ServiceException, Lambda.AWSLambdaException, Lambda.SdkClientException, Lambda.TooManyRequestsException | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| ネットワークエラー | States.TaskFailed | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| 認証エラー | AuthenticationError | なし | - | - | FetchFailed |
| その他すべて | States.ALL | なし | - | - | FetchFailed |

#### ASL設定

```json
{
  "Retry": [
    {
      "ErrorEquals": ["RateLimitError"],
      "IntervalSeconds": 1,
      "MaxAttempts": 5,
      "BackoffRate": 1.0,
      "Comment": "レート制限エラーは1秒待機後リトライ"
    },
    {
      "ErrorEquals": [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException"
      ],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    },
    {
      "ErrorEquals": ["States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["AuthenticationError"],
      "ResultPath": "$.error",
      "Next": "FetchFailed"
    },
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "FetchFailed"
    }
  ]
}
```

#### レート制限の実装

TDnet APIのレート制限（1リクエスト/秒）に対応するため、以下の戦略を採用：

1. **Map状態のMaxConcurrency**: 5（並列実行制限）
2. **Lambda関数内でのレート制限**: `RateLimiter`クラスを使用
3. **リトライ戦略**: レート制限エラー時は1秒待機後リトライ（最大5回）

```typescript
// collector-fetch Lambda内の実装例
import { RateLimiter } from '../utils/rate-limiter';

const rateLimiter = new RateLimiter({ requestsPerSecond: 1 });

export const handler = async (event: FetchEvent) => {
  try {
    await rateLimiter.acquire();
    const data = await fetchFromTDnetAPI(event);
    return { statusCode: 200, body: data };
  } catch (error) {
    if (error.statusCode === 429) {
      throw new RateLimitError('TDnet API rate limit exceeded');
    }
    throw error;
  }
};
```

### 3. SavePageData（データ保存）

#### エラー種別と対応

| エラー | ErrorEquals | リトライ | バックオフ | 最大試行 | Catch処理 |
|-------|-------------|---------|----------|---------|----------|
| DynamoDB スロットリング | DynamoDB.ProvisionedThroughputExceededException, DynamoDB.ThrottlingException | あり | 指数 (1s, 2s, 4s) | 3回 | - |
| Lambda サービスエラー | Lambda.ServiceException, Lambda.AWSLambdaException, Lambda.SdkClientException, Lambda.TooManyRequestsException | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| ネットワークエラー | States.TaskFailed | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| その他すべて | States.ALL | なし | - | - | SaveFailed |

#### ASL設定

```json
{
  "Retry": [
    {
      "ErrorEquals": [
        "DynamoDB.ProvisionedThroughputExceededException",
        "DynamoDB.ThrottlingException"
      ],
      "IntervalSeconds": 1,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    },
    {
      "ErrorEquals": [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException"
      ],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    },
    {
      "ErrorEquals": ["States.TaskFailed"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "SaveFailed"
    }
  ]
}
```

#### 部分的失敗の処理

`SavePageData`では、バッチ処理で一部のアイテムが失敗しても、成功したアイテムは保存します。

```typescript
// collector-save Lambda内の実装例
export const handler = async (event: SaveEvent) => {
  const results = {
    saved_count: 0,
    failed_count: 0,
    failed_items: [] as FailedItem[]
  };

  for (const item of event.items) {
    try {
      await saveToDynamoDB(item);
      await uploadPDFToS3(item);
      results.saved_count++;
    } catch (error) {
      logger.error('Failed to save item', {
        error_type: error.name,
        error_message: error.message,
        context: { disclosure_id: item.disclosure_id }
      });
      results.failed_count++;
      results.failed_items.push({
        disclosure_id: item.disclosure_id,
        error: error.message
      });
    }
  }

  // 失敗したアイテムをDLQへ送信
  if (results.failed_items.length > 0) {
    await sendToDLQ(results.failed_items);
  }

  return results;
};
```

### 4. AggregateResults（集約）

#### エラー種別と対応

| エラー | ErrorEquals | リトライ | バックオフ | 最大試行 | Catch処理 |
|-------|-------------|---------|----------|---------|----------|
| Lambda サービスエラー | Lambda.ServiceException, Lambda.AWSLambdaException, Lambda.SdkClientException, Lambda.TooManyRequestsException | あり | 指数 (2s, 4s, 8s) | 3回 | - |
| その他すべて | States.ALL | なし | - | - | HandleAggregationError |

#### ASL設定

```json
{
  "Retry": [
    {
      "ErrorEquals": [
        "Lambda.ServiceException",
        "Lambda.AWSLambdaException",
        "Lambda.SdkClientException",
        "Lambda.TooManyRequestsException"
      ],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "HandleAggregationError"
    }
  ]
}
```

## Map状態のエラーハンドリング

### 並列実行制御

```json
{
  "Type": "Map",
  "MaxConcurrency": 5,
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.mapError",
      "Next": "AggregateResults"
    }
  ]
}
```

### 部分的失敗の許容

Map状態では、一部のアイテムが失敗しても全体の処理は継続します。

- **Iterator内のエラー**: `FetchFailed`または`SaveFailed`状態で記録し、`PageFailed`（Succeed）へ遷移
- **Map全体のエラー**: `Catch`でキャッチし、`AggregateResults`へ遷移

これにより、以下が実現されます：

1. 成功したページのデータは保存される
2. 失敗したページの情報は記録される
3. 集約処理で全体の成功率を計算
4. 部分的成功（`partial_success`）として完了

## タイムアウト設定

### ステップ別タイムアウト

| ステップ | タイムアウト | 理由 |
|---------|------------|------|
| Initialize | 30秒 | TDnet APIメタデータ取得は通常5-10秒 |
| FetchPageData | 60秒 | TDnet API呼び出し + レート制限待機 |
| SavePageData | 120秒 | DynamoDB保存 + S3アップロード（100件分） |
| AggregateResults | 30秒 | 統計計算とDynamoDB更新 |
| **全体** | **3600秒（1時間）** | 大量データ収集時の余裕を持たせる |

### タイムアウト時の動作

1. **ステップタイムアウト**: `States.Timeout`エラーが発生
2. **Retry設定**: タイムアウトエラーは再試行されない
3. **Catch処理**: エラーハンドラーで記録し、次のステップへ
4. **全体タイムアウト**: ワークフロー全体が失敗

```json
{
  "TimeoutSeconds": 3600,
  "Comment": "全体のタイムアウトは1時間"
}
```

## DLQ連携

### DLQ送信タイミング

| タイミング | 対象 | 送信内容 |
|-----------|------|---------|
| 初期化失敗 | HandleInitializationError | パラメータ、エラー情報 |
| データ取得失敗 | FetchFailed | ページ番号、エラー情報 |
| データ保存失敗 | SaveFailed（Lambda内） | 失敗したアイテム、エラー情報 |
| 集約失敗 | HandleAggregationError | 実行ID、エラー情報 |

### DLQ実装

```typescript
// DLQ送信ユーティリティ
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});
const DLQ_URL = process.env.DLQ_URL!;

export async function sendToDLQ(payload: any) {
  const command = new SendMessageCommand({
    QueueUrl: DLQ_URL,
    MessageBody: JSON.stringify({
      timestamp: new Date().toISOString(),
      payload,
      error_context: {
        function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
        request_id: process.env.AWS_REQUEST_ID
      }
    })
  });

  await sqsClient.send(command);
  
  logger.info('Sent to DLQ', {
    context: { dlq_url: DLQ_URL, payload_size: JSON.stringify(payload).length }
  });
}
```

## CloudWatch Alarms

### アラーム設定

| アラーム名 | メトリクス | 閾値 | 期間 | アクション |
|-----------|----------|------|------|----------|
| StepFunctionsExecutionFailed | ExecutionsFailed | >= 1 | 5分 | SNS通知 |
| StepFunctionsExecutionTimeout | ExecutionsTimedOut | >= 1 | 5分 | SNS通知 |
| StepFunctionsExecutionThrottled | ExecutionThrottled | >= 1 | 5分 | SNS通知 |
| CollectorFetchErrorRate | Lambda Errors / Invocations | >= 5% | 5分 | SNS通知 |
| CollectorSaveErrorRate | Lambda Errors / Invocations | >= 5% | 5分 | SNS通知 |
| DLQMessageCount | ApproximateNumberOfMessagesVisible | >= 10 | 5分 | SNS通知 |

### CDK実装例

```typescript
// monitoring-stack.ts
const executionFailedAlarm = new cloudwatch.Alarm(this, 'StepFunctionsExecutionFailed', {
  metric: stateMachine.metricFailed({
    statistic: 'Sum',
    period: Duration.minutes(5)
  }),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'Step Functions実行が失敗しました',
  actionsEnabled: true
});

executionFailedAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
```

## ログ構造

### 構造化ログ

すべてのLambda関数で統一された構造化ログを出力します。

```typescript
// エラーログの例
logger.error('Data fetch failed', {
  error_type: 'NetworkError',
  error_message: error.message,
  context: {
    execution_id: event.execution_id,
    page_number: event.page_number,
    retry_count: 2
  },
  stack_trace: error.stack
});

// 成功ログの例
logger.info('Data saved successfully', {
  context: {
    execution_id: event.execution_id,
    page_number: event.page_number,
    saved_count: 100,
    failed_count: 0
  }
});
```

### CloudWatch Logs Insights クエリ

```sql
-- エラー率の分析
fields @timestamp, error_type, error_message, context.execution_id
| filter @type = "ERROR"
| stats count() by error_type
| sort count desc

-- 実行時間の分析
fields @timestamp, context.execution_id, @duration
| filter @message like /Data saved successfully/
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)

-- 失敗したページの特定
fields @timestamp, context.page_number, error_message
| filter @type = "ERROR" and @message like /Data fetch failed/
| sort @timestamp desc
| limit 20
```

## エラーハンドリングのベストプラクティス

### 1. エラーの明確な分類

- **Retryable**: 一時的なエラー、再試行で成功する可能性が高い
- **Non-Retryable**: 恒久的なエラー、再試行しても成功しない
- **Partial Failure**: バッチ処理で一部失敗、成功分は保存

### 2. 適切なリトライ戦略

- **指数バックオフ**: ネットワークエラー、サービスエラー
- **固定間隔**: レート制限エラー
- **最大試行回数**: 3-5回（エラー種別による）

### 3. 部分的失敗の許容

- Map状態で一部のアイテムが失敗しても全体は継続
- 成功したアイテムは保存、失敗したアイテムは記録
- 集約処理で全体の成功率を計算

### 4. 構造化ログ

- error_type, error_message, context, stack_trace
- CloudWatch Logs Insightsで分析可能
- トレーサビリティの確保

### 5. DLQ連携

- 再試行不可能なエラーはDLQへ送信
- DLQメッセージは別途処理（手動または自動）
- DLQメッセージ数の監視

### 6. タイムアウト設定

- 各ステップに適切なタイムアウトを設定
- 全体のタイムアウトは余裕を持たせる
- タイムアウト時の動作を明確に定義

### 7. 監視とアラート

- CloudWatch Alarmsで異常を検知
- SNS通知で迅速な対応
- CloudWatch Logs Insightsで詳細分析

## 関連ドキュメント

- `error-handling-patterns.md`
- `step-functions-architecture.md`
- `step-functions-state-machine.json`
- `../development/error-handling-implementation.md`
- `../development/error-handling-enforcement.md`

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-02-22 | 1.0 | 初版作成 |

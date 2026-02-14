# エラーリカバリー戦略

**バージョン:** 1.0  
**最終更新:** 2026-02-07  
**ステータス:** Draft

---

## 目次

1. [概要](#概要)
2. [Dead Letter Queue (DLQ) 設計](#dead-letter-queue-dlq-設計)
3. [自動リカバリーの範囲](#自動リカバリーの範囲)
4. [手動介入が必要なケース](#手動介入が必要なケース)
5. [リカバリー手順書](#リカバリー手順書)
6. [リカバリーLambda関数の実装](#リカバリーlambda関数の実装)
7. [監視とアラート](#監視とアラート)
8. [テスト戦略](#テスト戦略)
9. [関連ドキュメント](#関連ドキュメント)

---

## 概要

### エラーリカバリーの重要性

TDnet Data Collectorは、外部API（TDnet）からデータを収集するシステムであり、以下のような一時的な障害が発生する可能性があります：

- **ネットワーク障害**: 一時的な接続エラー、タイムアウト
- **外部サービス障害**: TDnetのメンテナンス、過負荷
- **レート制限**: APIリクエスト制限の超過
- **AWS一時的障害**: DynamoDB/S3のスロットリング

これらの障害に対して、適切なエラーリカバリー戦略を実装することで、システムの信頼性と可用性を向上させます。

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

### CDK実装コード

```typescript
// cdk/lib/constructs/dlq-construct.ts
import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface DlqConstructProps {
  /**
   * DLQの名前
   */
  queueName: string;

  /**
   * メッセージ保持期間（日数）
   * @default 14
   */
  retentionDays?: number;

  /**
   * アラート通知先SNSトピック
   */
  alarmTopic: sns.ITopic;

  /**
   * DLQ監視Lambda関数（オプション）
   */
  monitoringFunction?: lambda.IFunction;
}

export class DlqConstruct extends Construct {
  public readonly queue: sqs.Queue;
  public readonly alarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: DlqConstructProps) {
    super(scope, id);

    // Dead Letter Queue作成
    this.queue = new sqs.Queue(this, 'DLQ', {
      queueName: props.queueName,
      // メッセージ保持期間: 14日間
      retentionPeriod: cdk.Duration.days(props.retentionDays ?? 14),
      // 暗号化有効化
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      // メッセージ受信待機時間（ロングポーリング）
      receiveMessageWaitTime: cdk.Duration.seconds(20),
    });

    // DLQメッセージ数の監視アラーム
    this.alarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
      alarmName: `${props.queueName}-messages`,
      alarmDescription: `DLQにメッセージが蓄積されています: ${props.queueName}`,
      metric: this.queue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // SNS通知設定
    this.alarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));

    // DLQ監視Lambda関数の設定（オプション）
    if (props.monitoringFunction) {
      props.monitoringFunction.addEventSource(
        new lambdaEventSources.SqsEventSource(this.queue, {
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.minutes(1),
          reportBatchItemFailures: true,
        })
      );
    }
  }
}
```

### メッセージ属性

DLQに送信されるメッセージには、以下の属性を含めます：

```typescript
interface DlqMessageAttributes {
  // エラー情報
  errorType: string;           // エラーの種類（例: NetworkError, ValidationError）
  errorMessage: string;        // エラーメッセージ
  errorStack?: string;         // スタックトレース

  // リトライ情報
  retryCount: number;          // リトライ回数
  maxRetries: number;          // 最大リトライ回数
  lastRetryAt: string;         // 最後のリトライ日時（ISO 8601）

  // コンテキスト情報
  executionId: string;         // Lambda実行ID
  functionName: string;        // Lambda関数名
  timestamp: string;           // エラー発生日時（ISO 8601）

  // 元のメッセージ
  originalMessage: string;     // 元のメッセージ（JSON文字列）
  messageId: string;           // 元のメッセージID
}
```

### DLQ使用例

```typescript
// lambda/collector/handler.ts
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({});

async function sendToDlq(
  message: any,
  error: Error,
  context: {
    executionId: string;
    functionName: string;
    retryCount: number;
    maxRetries: number;
  }
): Promise<void> {
  const dlqUrl = process.env.DLQ_URL;
  if (!dlqUrl) {
    throw new Error('DLQ_URL environment variable is not set');
  }

  const attributes: DlqMessageAttributes = {
    errorType: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    retryCount: context.retryCount,
    maxRetries: context.maxRetries,
    lastRetryAt: new Date().toISOString(),
    executionId: context.executionId,
    functionName: context.functionName,
    timestamp: new Date().toISOString(),
    originalMessage: JSON.stringify(message),
    messageId: message.messageId || crypto.randomUUID(),
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: dlqUrl,
      MessageBody: JSON.stringify(attributes),
      MessageAttributes: {
        errorType: {
          DataType: 'String',
          StringValue: attributes.errorType,
        },
        retryCount: {
          DataType: 'Number',
          StringValue: String(attributes.retryCount),
        },
      },
    })
  );

  logger.error('Message sent to DLQ', attributes);
}
```

---

## 自動リカバリーの範囲

### 再試行可能なエラー（Retryable Errors）

以下のエラーは一時的な障害である可能性が高いため、自動的に再試行します：

| エラー種別 | 具体例 | 再試行戦略 |
|-----------|--------|-----------|
| **ネットワークエラー** | ECONNRESET, ETIMEDOUT, ENOTFOUND | 指数バックオフ |
| **HTTPタイムアウト** | リクエストタイムアウト、レスポンスタイムアウト | 指数バックオフ |
| **5xxエラー** | 500 Internal Server Error, 503 Service Unavailable | 指数バックオフ |
| **AWS一時的エラー** | ThrottlingException, ServiceUnavailable | 指数バックオフ + ジッター |
| **レート制限** | 429 Too Many Requests | 固定遅延 + 指数バックオフ |

### 指数バックオフ戦略

```typescript
// lambda/utils/retry.ts
export interface RetryOptions {
  maxRetries: number;           // 最大リトライ回数（デフォルト: 3）
  initialDelay: number;         // 初期遅延時間（ミリ秒、デフォルト: 2000）
  backoffMultiplier: number;    // バックオフ乗数（デフォルト: 2）
  jitter: boolean;              // ジッター有効化（デフォルト: true）
  maxDelay?: number;            // 最大遅延時間（ミリ秒、デフォルト: 30000）
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 2000,
    backoffMultiplier = 2,
    jitter = true,
    maxDelay = 30000,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // 最後の試行の場合は再試行しない
      if (attempt === maxRetries) {
        break;
      }

      // 再試行不可能なエラーの場合は即座に失敗
      if (!isRetryableError(error)) {
        throw error;
      }

      // 遅延時間を計算
      let delay = initialDelay * Math.pow(backoffMultiplier, attempt);
      delay = Math.min(delay, maxDelay);

      // ジッターを追加（±25%のランダム性）
      if (jitter) {
        const jitterAmount = delay * 0.25;
        delay = delay + (Math.random() * 2 - 1) * jitterAmount;
      }

      logger.warn('Retrying operation', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message,
      });

      await sleep(delay);
    }
  }

  throw lastError!;
}

function isRetryableError(error: any): boolean {
  // ネットワークエラー
  if (error.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)) {
    return true;
  }

  // HTTPステータスコード
  if (error.statusCode) {
    // 5xxエラーまたは429（レート制限）
    return error.statusCode >= 500 || error.statusCode === 429;
  }

  // AWSエラー
  if (error.name && ['ThrottlingException', 'ServiceUnavailable'].includes(error.name)) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 自動リカバリーフロー図

```
┌─────────────────┐
│  処理開始       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  操作実行       │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ 成功？ │
    └───┬────┘
        │
   ┌────┴────┐
   │         │
  Yes       No
   │         │
   │         ▼
   │    ┌──────────────┐
   │    │ 再試行可能？ │
   │    └───┬──────────┘
   │        │
   │   ┌────┴────┐
   │   │         │
   │  Yes       No
   │   │         │
   │   │         ▼
   │   │    ┌─────────┐
   │   │    │ DLQへ送信│
   │   │    └─────────┘
   │   │         │
   │   │         ▼
   │   │    ┌─────────┐
   │   │    │ 失敗終了 │
   │   │    └─────────┘
   │   │
   │   ▼
   │ ┌──────────────┐
   │ │ リトライ回数 │
   │ │ < 最大回数？ │
   │ └───┬──────────┘
   │     │
   │ ┌───┴───┐
   │ │       │
   │Yes     No
   │ │       │
   │ │       ▼
   │ │  ┌─────────┐
   │ │  │ DLQへ送信│
   │ │  └─────────┘
   │ │       │
   │ │       ▼
   │ │  ┌─────────┐
   │ │  │ 失敗終了 │
   │ │  └─────────┘
   │ │
   │ ▼
   │ ┌──────────────┐
   │ │ 指数バックオフ│
   │ │ 待機         │
   │ └───┬──────────┘
   │     │
   │     ▼
   │ ┌──────────────┐
   │ │ 再試行       │
   │ └───┬──────────┘
   │     │
   │     └──────┐
   │            │
   ▼            ▼
┌─────────────────┐
│  成功終了       │
└─────────────────┘
```

---

## 手動介入が必要なケース

### 判断基準の定義

以下のエラーは再試行しても解決しないため、手動介入が必要です：

| エラー種別 | 具体例 | 対応方法 |
|-----------|--------|---------|
| **認証エラー** | 401 Unauthorized, 403 Forbidden | 認証情報の確認・更新 |
| **リソース不存在** | 404 Not Found | URLやリソースIDの確認 |
| **バリデーションエラー** | 400 Bad Request | 入力データの修正 |
| **設定エラー** | 環境変数未設定、不正な設定値 | 設定の確認・修正 |
| **データ整合性エラー** | 重複キー、外部キー制約違反 | データの確認・修正 |

### 拡張されたエラー分類

`analyzeError()`関数で追加された新しいエラータイプ：

| エラータイプ | 説明 | 再試行 | 対応方法 |
|-------------|------|--------|---------|
| **HTMLParseError** | TDnetのHTML構造が変更され、スクレイピングが失敗 | ❌ | スクレイピングロジックを修正 |
| **CorruptedPDFError** | PDFファイルがダウンロードされたが、内容が破損 | ❌ | TDnetに問い合わせ、または再ダウンロード |
| **SchemaValidationError** | データがスキーマ検証に失敗 | ❌ | データ形式を確認・修正 |
| **NetworkError** | 一時的なネットワークエラー | ✅ | 自動再試行（指数バックオフ） |
| **ThrottlingException** | AWS APIのスロットリング | ✅ | 自動再試行（指数バックオフ + ジッター） |

**エラーメッセージパターンによる判定:**

`analyzeError()`関数は、エラータイプだけでなく、エラーメッセージの内容も確認します：

| パターン | 説明 | 再試行 | 対応方法 |
|---------|------|--------|---------|
| `HTML structure changed` | TDnetのHTML構造変更を検出 | ❌ | スクレイピングロジックを修正 |
| `PDF header not found` | PDFファイルのヘッダーが見つからない | ❌ | PDFパーサーを修正、またはTDnetに問い合わせ |
| `Invalid schema` | データスキーマが不正 | ❌ | スキーマ定義を確認・修正 |
| `Duplicate key` | DynamoDBの重複キーエラー | ❌ | データの重複を確認（通常は無視） |

**実装例:**

```typescript
// エラータイプによる判定
const nonRetryableErrors = [
  'ValidationError',
  'AuthenticationError',
  'AuthorizationError',
  'NotFoundError',
  'ConfigurationError',
  'HTMLParseError',        // ✅ 追加
  'CorruptedPDFError',     // ✅ 追加
  'SchemaValidationError', // ✅ 追加
];

// エラーメッセージパターンによる判定
const nonRetryablePatterns = [
  'HTML structure changed',
  'PDF header not found',
  'Invalid schema',
  'Duplicate key',
];

for (const pattern of nonRetryablePatterns) {
  if (errorMessage.includes(pattern)) {
    logger.info('Non-retryable error pattern detected', { 
      errorType, 
      pattern 
    });
    return false;
  }
}
```

### 手動介入フロー図

```
┌─────────────────┐
│ DLQメッセージ   │
│ 受信            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ エラー種別の    │
│ 分析            │
└────────┬────────┘
         │
         ▼
    ┌────────┐
    │ エラー │
    │ 種別？ │
    └───┬────┘
        │
   ┌────┴────┬────────┬────────┐
   │         │        │        │
認証エラー  設定エラー データエラー その他
   │         │        │        │
   ▼         ▼        ▼        ▼
┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐
│認証情報│  │設定値│  │データ│  │調査・│
│更新  │  │修正 │  │修正 │  │修正 │
└──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘
   │         │        │        │
   └────┬────┴────┬───┴────────┘
        │         │
        ▼         ▼
   ┌─────────────────┐
   │ 修正完了        │
   └────────┬────────┘
            │
            ▼
   ┌─────────────────┐
   │ メッセージ再処理│
   └────────┬────────┘
            │
            ▼
       ┌────────┐
       │ 成功？ │
       └───┬────┘
           │
      ┌────┴────┐
      │         │
     Yes       No
      │         │
      ▼         ▼
 ┌─────┐  ┌─────────┐
 │完了 │  │エスカレー│
 └─────┘  │ション   │
          └─────────┘
```

### エスカレーション手順

**レベル1: 自動アラート（即時）**
- DLQメッセージ数が閾値を超えた場合
- SNS経由でメール/Slack通知
- 対象: 開発チーム

**レベル2: 手動調査（1時間以内）**
- DLQメッセージの内容確認
- エラー原因の特定
- 対象: 開発チーム

**レベル3: 緊急対応（4時間以内）**
- システム全体に影響がある場合
- データ損失のリスクがある場合
- 対象: 開発チーム + インフラチーム

**レベル4: 外部エスカレーション（24時間以内）**
- 外部サービス（TDnet）の問題
- AWS側の問題
- 対象: サービスプロバイダー

---

## リカバリー手順書

### DLQからのメッセージ再処理手順

#### 前提条件

- AWS CLIがインストールされている
- 適切なIAM権限がある（SQS読み取り、Lambda実行）
- DLQ URLとリカバリーLambda関数名を把握している

#### 手順1: DLQメッセージの確認

**AWS Console:**

1. AWS Consoleにログイン
2. SQSサービスに移動
3. DLQキュー（例: `tdnet-collector-dlq`）を選択
4. 「メッセージの送受信」をクリック
5. 「メッセージのポーリング」をクリック
6. メッセージ内容を確認

**AWS CLI:**

```bash
# DLQメッセージ数を確認
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --attribute-names ApproximateNumberOfMessages

# メッセージを受信（削除しない）
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --max-number-of-messages 10 \
  --visibility-timeout 300 \
  --attribute-names All \
  --message-attribute-names All
```

#### 手順2: エラー原因の分析

```bash
# メッセージ内容をJSONファイルに保存
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --max-number-of-messages 1 \
  > dlq-message.json

# エラー情報を抽出
cat dlq-message.json | jq '.Messages[0].Body | fromjson | {errorType, errorMessage, retryCount}'
```

**確認項目:**
- `errorType`: エラーの種類
- `errorMessage`: エラーメッセージ
- `retryCount`: リトライ回数
- `originalMessage`: 元のメッセージ

#### 手順3: 問題の修正

エラー種別に応じて修正を実施：

**認証エラーの場合:**
```bash
# Secrets Managerの認証情報を更新
aws secretsmanager update-secret \
  --secret-id tdnet-api-credentials \
  --secret-string '{"apiKey":"new-api-key"}'
```

**設定エラーの場合:**
```bash
# Lambda環境変数を更新
aws lambda update-function-configuration \
  --function-name tdnet-collector \
  --environment Variables={TDNET_API_URL=https://api.tdnet.example.com}
```

**データエラーの場合:**
- DynamoDBのデータを手動修正
- S3のファイルを削除または修正

#### 手順4: メッセージの再処理

**方法1: リカバリーLambda関数を使用（推奨）**

```bash
# リカバリーLambda関数を手動実行
aws lambda invoke \
  --function-name tdnet-dlq-recovery \
  --payload '{"queueUrl":"https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq","maxMessages":10}' \
  response.json

# 実行結果を確認
cat response.json
```

**方法2: メッセージを元のキューに戻す**

```bash
# DLQからメッセージを受信
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --max-number-of-messages 1 \
  > message.json

# 元のキューに送信
aws sqs send-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector \
  --message-body "$(cat message.json | jq -r '.Messages[0].Body | fromjson | .originalMessage')"

# DLQからメッセージを削除
aws sqs delete-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --receipt-handle "$(cat message.json | jq -r '.Messages[0].ReceiptHandle')"
```

#### 手順5: 再処理結果の確認

```bash
# CloudWatch Logsで実行結果を確認
aws logs tail /aws/lambda/tdnet-collector --follow

# DynamoDBでデータが正しく保存されたか確認
aws dynamodb get-item \
  --table-name tdnet-disclosures \
  --key '{"disclosure_id":{"S":"TD20240115001"}}'
```

### トラブルシューティングガイド

#### 問題1: DLQメッセージが増え続ける

**症状:**
- DLQメッセージ数が継続的に増加
- アラートが頻繁に発火

**原因:**
- 外部サービス（TDnet）の長期障害
- 設定エラーが修正されていない
- Lambda関数のバグ

**対応:**
1. CloudWatch Logsでエラーパターンを分析
2. 共通のエラー原因を特定
3. 根本原因を修正
4. DLQメッセージを一括再処理

```bash
# エラーパターンを分析
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# 一括再処理（リカバリーLambda使用）
aws lambda invoke \
  --function-name tdnet-dlq-recovery \
  --payload '{"queueUrl":"https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq","maxMessages":100}' \
  response.json
```

#### 問題2: 再処理しても失敗する

**症状:**
- DLQから再処理してもエラーが発生
- 同じメッセージが繰り返しDLQに送信される

**原因:**
- データの不整合
- Lambda関数のバグ
- 外部サービスの恒久的な問題

**対応:**
1. メッセージ内容を詳細に分析
2. Lambda関数をローカルでデバッグ
3. 必要に応じてメッセージを手動修正
4. Lambda関数のバグを修正してデプロイ

```bash
# メッセージ内容を詳細に確認
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --max-number-of-messages 1 \
  | jq '.Messages[0].Body | fromjson'

# Lambda関数をローカルで実行（SAM CLI使用）
sam local invoke tdnet-collector \
  --event dlq-message.json
```

#### 問題3: DLQメッセージが消失する

**症状:**
- DLQメッセージが予期せず削除される
- 保持期間前にメッセージが消える

**原因:**
- 誤った手動削除
- リカバリーLambda関数のバグ
- SQS設定の誤り

**対応:**
1. CloudTrailでSQS操作ログを確認
2. リカバリーLambda関数のログを確認
3. SQS設定（保持期間）を確認
4. 必要に応じてバックアップから復元

```bash
# CloudTrailでSQS削除操作を確認
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteMessage \
  --start-time $(date -d '1 day ago' +%s) \
  --max-results 50

# SQS設定を確認
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/123456789012/tdnet-collector-dlq \
  --attribute-names All
```

---

## リカバリーLambda関数の実装

### 概要

DLQに蓄積されたメッセージを自動的に再処理するLambda関数を実装します。

**主な機能:**
- DLQからメッセージを取得
- エラー種別を分析
- 再処理可能なメッセージを元のキューに送信
- 再処理不可能なメッセージをログに記録

### 完全な実装コード

```typescript
// lambda/dlq-recovery/handler.ts
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'dlq-recovery' });
const sqsClient = new SQSClient({});

interface DlqRecoveryEvent {
  queueUrl: string;
  maxMessages?: number;
  dryRun?: boolean;
}

interface DlqRecoveryResult {
  processed: number;
  reprocessed: number;
  failed: number;
  skipped: number;
  errors: Array<{
    messageId: string;
    error: string;
  }>;
}

export async function handler(event: DlqRecoveryEvent): Promise<DlqRecoveryResult> {
  const { queueUrl, maxMessages = 10, dryRun = false } = event;

  logger.info('Starting DLQ recovery', { queueUrl, maxMessages, dryRun });

  const result: DlqRecoveryResult = {
    processed: 0,
    reprocessed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // DLQからメッセージを取得
    const messages = await receiveMessages(queueUrl, maxMessages);

    if (messages.length === 0) {
      logger.info('No messages in DLQ');
      return result;
    }

    logger.info(`Received ${messages.length} messages from DLQ`);

    // 各メッセージを処理
    for (const message of messages) {
      result.processed++;

      try {
        const messageBody = JSON.parse(message.Body || '{}');
        const errorType = messageBody.errorType;

        logger.info('Processing DLQ message', {
          messageId: message.MessageId,
          errorType,
        });

        // エラー種別を分析
        const shouldReprocess = await analyzeError(messageBody);

        if (shouldReprocess) {
          if (!dryRun) {
            // 元のキューに再送信
            await reprocessMessage(messageBody);
            // DLQから削除
            await deleteMessage(queueUrl, message.ReceiptHandle!);
          }
          result.reprocessed++;
          logger.info('Message reprocessed', { messageId: message.MessageId });
        } else {
          result.skipped++;
          logger.warn('Message skipped (not reprocessable)', {
            messageId: message.MessageId,
            errorType,
          });
        }
      } catch (error) {
        result.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          messageId: message.MessageId || 'unknown',
          error: errorMessage,
        });
        logger.error('Failed to process message', {
          messageId: message.MessageId,
          error: errorMessage,
        });
      }
    }

    logger.info('DLQ recovery completed', result);
    return result;
  } catch (error) {
    logger.error('DLQ recovery failed', { error });
    throw error;
  }
}

async function receiveMessages(queueUrl: string, maxMessages: number) {
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: Math.min(maxMessages, 10),
    WaitTimeSeconds: 20,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All'],
  });

  const response = await sqsClient.send(command);
  return response.Messages || [];
}

async function analyzeError(messageBody: any): Promise<boolean> {
  const errorType = messageBody.errorType;
  const errorMessage = messageBody.errorMessage || '';
  const retryCount = messageBody.retryCount || 0;

  // 再試行不可能なエラー（拡張版）
  const nonRetryableErrors = [
    'ValidationError',
    'AuthenticationError',
    'AuthorizationError',
    'NotFoundError',
    'ConfigurationError',
    'HTMLParseError',        // TDnetのHTML構造変更
    'CorruptedPDFError',     // PDFファイルの破損
    'SchemaValidationError', // データスキーマ検証エラー
  ];

  if (nonRetryableErrors.includes(errorType)) {
    logger.info('Non-retryable error detected', { errorType });
    return false;
  }

  // エラーメッセージの内容も確認
  const nonRetryablePatterns = [
    'HTML structure changed',
    'PDF header not found',
    'Invalid schema',
    'Duplicate key',
  ];

  for (const pattern of nonRetryablePatterns) {
    if (errorMessage.includes(pattern)) {
      logger.info('Non-retryable error pattern detected', { 
        errorType, 
        pattern 
      });
      return false;
    }
  }

  // リトライ回数が多すぎる場合はスキップ
  if (retryCount >= 5) {
    logger.info('Too many retries', { retryCount });
    return false;
  }

  // その他のエラーは再処理可能
  return true;
}

async function reprocessMessage(messageBody: any): Promise<void> {
  const originalQueueUrl = process.env.ORIGINAL_QUEUE_URL;
  if (!originalQueueUrl) {
    throw new Error('ORIGINAL_QUEUE_URL environment variable is not set');
  }

  const originalMessage = messageBody.originalMessage;

  const command = new SendMessageCommand({
    QueueUrl: originalQueueUrl,
    MessageBody: originalMessage,
    MessageAttributes: {
      reprocessed: {
        DataType: 'String',
        StringValue: 'true',
      },
      originalErrorType: {
        DataType: 'String',
        StringValue: messageBody.errorType,
      },
    },
  });

  await sqsClient.send(command);
  logger.info('Message sent to original queue', { originalQueueUrl });
}

async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  });

  await sqsClient.send(command);
  logger.info('Message deleted from DLQ');
}
```

### Lambda関数のCDK定義

```typescript
// cdk/lib/constructs/dlq-recovery-function.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DlqRecoveryFunctionProps {
  dlqQueue: sqs.IQueue;
  originalQueue: sqs.IQueue;
}

export class DlqRecoveryFunction extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DlqRecoveryFunctionProps) {
    super(scope, id);

    this.function = new nodejs.NodejsFunction(this, 'Function', {
      entry: 'lambda/dlq-recovery/handler.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        DLQ_URL: props.dlqQueue.queueUrl,
        ORIGINAL_QUEUE_URL: props.originalQueue.queueUrl,
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // DLQへの読み取り・削除権限
    props.dlqQueue.grantConsumeMessages(this.function);

    // 元のキューへの送信権限
    props.originalQueue.grantSendMessages(this.function);

    // CloudWatch Logsへの書き込み権限（自動付与）
  }
}
```

---

## 監視とアラート

### CloudWatchアラーム設定

#### 1. DLQメッセージ数アラーム（Critical）

```typescript
// cdk/lib/constructs/dlq-alarms.ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface DlqAlarmsProps {
  dlqQueue: sqs.IQueue;
  alarmTopic: sns.ITopic;
}

export class DlqAlarms extends Construct {
  constructor(scope: Construct, id: string, props: DlqAlarmsProps) {
    super(scope, id);

    // Critical: DLQにメッセージが1件以上ある
    const messagesAlarm = new cloudwatch.Alarm(this, 'MessagesAlarm', {
      alarmName: 'tdnet-dlq-messages-critical',
      alarmDescription: 'DLQにメッセージが蓄積されています',
      metric: props.dlqQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    messagesAlarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));

    // High: DLQメッセージ数が10件以上
    const highVolumeAlarm = new cloudwatch.Alarm(this, 'HighVolumeAlarm', {
      alarmName: 'tdnet-dlq-high-volume',
      alarmDescription: 'DLQメッセージ数が異常に多い',
      metric: props.dlqQueue.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    highVolumeAlarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));

    // Medium: DLQメッセージの滞留時間が長い
    const ageAlarm = new cloudwatch.Alarm(this, 'AgeAlarm', {
      alarmName: 'tdnet-dlq-message-age',
      alarmDescription: 'DLQメッセージが長時間滞留しています',
      metric: props.dlqQueue.metricApproximateAgeOfOldestMessage({
        period: cdk.Duration.minutes(15),
        statistic: 'Maximum',
      }),
      threshold: 3600, // 1時間
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    ageAlarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));
  }
}
```


#### 2. リカバリーLambda関数エラーアラーム

```typescript
// リカバリーLambda関数のエラー率監視
const recoveryErrorAlarm = new cloudwatch.Alarm(this, 'RecoveryErrorAlarm', {
  alarmName: 'tdnet-dlq-recovery-errors',
  alarmDescription: 'DLQリカバリーLambda関数でエラーが発生しています',
  metric: new cloudwatch.MathExpression({
    expression: 'errors / invocations * 100',
    usingMetrics: {
      errors: recoveryFunction.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      invocations: recoveryFunction.metricInvocations({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
    },
  }),
  threshold: 10, // エラー率10%以上
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});

recoveryErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alarmTopic));
```

### SNS通知設定

```typescript
// cdk/lib/constructs/alarm-notifications.ts
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface AlarmNotificationsProps {
  emailAddresses: string[];
  slackWebhookUrl?: string;
}

export class AlarmNotifications extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlarmNotificationsProps) {
    super(scope, id);

    // SNSトピック作成
    this.topic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'tdnet-alarms',
      displayName: 'TDnet Data Collector Alarms',
    });

    // メール通知設定
    props.emailAddresses.forEach((email, index) => {
      this.topic.addSubscription(
        new subscriptions.EmailSubscription(email, {
          json: false,
        })
      );
    });

    // Slack通知設定（オプション）
    if (props.slackWebhookUrl) {
      this.topic.addSubscription(
        new subscriptions.UrlSubscription(props.slackWebhookUrl, {
          protocol: sns.SubscriptionProtocol.HTTPS,
        })
      );
    }
  }
}
```

### アラート優先度

| 優先度 | 条件 | 対応時間 | 通知先 |
|--------|------|---------|--------|
| 🔴 **Critical** | DLQメッセージ数 ≥ 1 | 即時 | メール + Slack |
| 🟠 **High** | DLQメッセージ数 ≥ 10 | 1時間以内 | メール + Slack |
| 🟡 **Medium** | メッセージ滞留時間 > 1時間 | 4時間以内 | メール |
| 🟢 **Low** | リカバリーエラー率 > 10% | 24時間以内 | メール |

### CloudWatchダッシュボード

```typescript
// cdk/lib/constructs/dlq-dashboard.ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface DlqDashboardProps {
  dlqQueue: sqs.IQueue;
  recoveryFunction: lambda.IFunction;
}

export class DlqDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: DlqDashboardProps) {
    super(scope, id);

    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: 'TDnet-DLQ-Monitoring',
    });

    // DLQメッセージ数
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DLQ Messages',
        left: [
          props.dlqQueue.metricApproximateNumberOfMessagesVisible({
            label: 'Visible Messages',
            statistic: 'Average',
          }),
          props.dlqQueue.metricApproximateNumberOfMessagesNotVisible({
            label: 'In-Flight Messages',
            statistic: 'Average',
          }),
        ],
        width: 12,
      })
    );

    // メッセージ滞留時間
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Message Age',
        left: [
          props.dlqQueue.metricApproximateAgeOfOldestMessage({
            label: 'Oldest Message Age (seconds)',
            statistic: 'Maximum',
          }),
        ],
        width: 12,
      })
    );

    // リカバリーLambda関数メトリクス
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Recovery Function Invocations',
        left: [
          props.recoveryFunction.metricInvocations({
            label: 'Invocations',
            statistic: 'Sum',
          }),
          props.recoveryFunction.metricErrors({
            label: 'Errors',
            statistic: 'Sum',
          }),
        ],
        width: 12,
      })
    );

    // リカバリーLambda関数実行時間
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Recovery Function Duration',
        left: [
          props.recoveryFunction.metricDuration({
            label: 'Duration',
            statistic: 'Average',
          }),
        ],
        width: 12,
      })
    );
  }
}
```

---

## テスト戦略

### 1. DLQへのメッセージ送信テスト

```typescript
// lambda/collector/handler.test.ts
import { handler } from './handler';
import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';

const sqsMock = mockClient(SQSClient);

describe('DLQ Message Sending', () => {
  beforeEach(() => {
    sqsMock.reset();
  });

  it('should send message to DLQ after max retries', async () => {
    // 再試行可能なエラーをシミュレート
    const event = {
      Records: [
        {
          body: JSON.stringify({ disclosure_id: 'TD20240115001' }),
          messageId: 'test-message-id',
        },
      ],
    };

    // 外部APIが常に失敗するようにモック
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    // DLQへの送信をモック
    sqsMock.on(SendMessageCommand).resolves({});

    await handler(event, {} as any);

    // DLQへの送信が呼ばれたことを確認
    expect(sqsMock.calls()).toHaveLength(1);
    const call = sqsMock.call(0);
    expect(call.args[0].input.QueueUrl).toContain('dlq');
  });

  it('should not send to DLQ for non-retryable errors', async () => {
    const event = {
      Records: [
        {
          body: JSON.stringify({ disclosure_id: 'invalid' }),
          messageId: 'test-message-id',
        },
      ],
    };

    // バリデーションエラーをシミュレート
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Validation error'));

    await expect(handler(event, {} as any)).rejects.toThrow();

    // DLQへの送信が呼ばれていないことを確認
    expect(sqsMock.calls()).toHaveLength(0);
  });
});
```

### 2. リカバリーLambda関数のテスト

```typescript
// lambda/dlq-recovery/handler.test.ts
import { handler } from './handler';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';

const sqsMock = mockClient(SQSClient);

describe('DLQ Recovery Function', () => {
  beforeEach(() => {
    sqsMock.reset();
    process.env.DLQ_URL = 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-dlq';
    process.env.ORIGINAL_QUEUE_URL = 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue';
  });

  it('should reprocess retryable messages', async () => {
    const dlqMessage = {
      MessageId: 'test-message-id',
      ReceiptHandle: 'test-receipt-handle',
      Body: JSON.stringify({
        errorType: 'NetworkError',
        errorMessage: 'Connection timeout',
        retryCount: 3,
        maxRetries: 3,
        originalMessage: JSON.stringify({ disclosure_id: 'TD20240115001' }),
      }),
    };

    sqsMock.on(ReceiveMessageCommand).resolves({
      Messages: [dlqMessage],
    });
    sqsMock.on(SendMessageCommand).resolves({});
    sqsMock.on(DeleteMessageCommand).resolves({});

    const result = await handler({
      queueUrl: process.env.DLQ_URL!,
      maxMessages: 10,
    });

    expect(result.processed).toBe(1);
    expect(result.reprocessed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('should skip non-retryable messages', async () => {
    const dlqMessage = {
      MessageId: 'test-message-id',
      ReceiptHandle: 'test-receipt-handle',
      Body: JSON.stringify({
        errorType: 'ValidationError',
        errorMessage: 'Invalid data',
        retryCount: 1,
        maxRetries: 3,
        originalMessage: JSON.stringify({ disclosure_id: 'invalid' }),
      }),
    };

    sqsMock.on(ReceiveMessageCommand).resolves({
      Messages: [dlqMessage],
    });

    const result = await handler({
      queueUrl: process.env.DLQ_URL!,
      maxMessages: 10,
    });

    expect(result.processed).toBe(1);
    expect(result.reprocessed).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('should handle dry run mode', async () => {
    const dlqMessage = {
      MessageId: 'test-message-id',
      ReceiptHandle: 'test-receipt-handle',
      Body: JSON.stringify({
        errorType: 'NetworkError',
        errorMessage: 'Connection timeout',
        retryCount: 2,
        maxRetries: 3,
        originalMessage: JSON.stringify({ disclosure_id: 'TD20240115001' }),
      }),
    };

    sqsMock.on(ReceiveMessageCommand).resolves({
      Messages: [dlqMessage],
    });

    const result = await handler({
      queueUrl: process.env.DLQ_URL!,
      maxMessages: 10,
      dryRun: true,
    });

    expect(result.processed).toBe(1);
    expect(result.reprocessed).toBe(1);

    // Dry runモードではメッセージ送信・削除が呼ばれない
    const sendCalls = sqsMock.commandCalls(SendMessageCommand);
    const deleteCalls = sqsMock.commandCalls(DeleteMessageCommand);
    expect(sendCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);
  });
});
```

### 3. エンドツーエンドテスト

```typescript
// tests/e2e/error-recovery.test.ts
import { SQSClient, SendMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

describe('Error Recovery E2E Test', () => {
  const sqsClient = new SQSClient({});
  const lambdaClient = new LambdaClient({});

  const DLQ_URL = process.env.DLQ_URL!;
  const RECOVERY_FUNCTION_NAME = process.env.RECOVERY_FUNCTION_NAME!;

  it('should recover from temporary network error', async () => {
    // 1. DLQにテストメッセージを送信
    const testMessage = {
      errorType: 'NetworkError',
      errorMessage: 'ETIMEDOUT',
      retryCount: 3,
      maxRetries: 3,
      originalMessage: JSON.stringify({
        disclosure_id: 'TD20240115001',
        company_code: '1234',
      }),
      timestamp: new Date().toISOString(),
    };

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: DLQ_URL,
        MessageBody: JSON.stringify(testMessage),
      })
    );

    // 2. リカバリーLambda関数を実行
    const invokeResult = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: RECOVERY_FUNCTION_NAME,
        Payload: JSON.stringify({
          queueUrl: DLQ_URL,
          maxMessages: 10,
        }),
      })
    );

    const result = JSON.parse(new TextDecoder().decode(invokeResult.Payload));

    // 3. 結果を検証
    expect(result.processed).toBeGreaterThan(0);
    expect(result.reprocessed).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);

    // 4. DLQが空になったことを確認
    const receiveResult = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: DLQ_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 5,
      })
    );

    expect(receiveResult.Messages || []).toHaveLength(0);
  }, 30000); // 30秒タイムアウト
});
```

---

## 関連ドキュメント

### エラーハンドリング

- **エラーハンドリングパターン**: `../../.kiro/steering/core/error-handling-patterns.md` - エラー分類と基本原則
- **エラーハンドリング実装**: `../../.kiro/steering/development/error-handling-implementation.md` - 詳細な実装パターン
- **APIエラーコード**: `../../.kiro/steering/api/error-codes.md` - エラーコード標準

### インフラストラクチャ

- **監視とアラート**: `../../.kiro/steering/infrastructure/monitoring-alerts.md` - CloudWatch設定
- **デプロイメントチェックリスト**: `../../.kiro/steering/infrastructure/deployment-checklist.md` - デプロイ手順

### 運用

- **トラブルシューティングガイド**: `./troubleshooting-guide.md` - 一般的な問題と解決策
- **運用手順書**: `./operational-procedures.md` - 日常的な運用手順

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|-----------|---------|--------|
| 2026-02-07 | 1.0 | 初版作成 | AI Assistant |

---

## まとめ

このエラーリカバリー戦略により、TDnet Data Collectorは以下を実現します：

✅ **自動リカバリー**: 一時的な障害からの自動復旧（最大3回の再試行）  
✅ **手動介入の効率化**: DLQによる失敗メッセージの管理と再処理  
✅ **迅速な問題検知**: CloudWatchアラームとSNS通知による即時通知  
✅ **運用の可視化**: ダッシュボードによるリアルタイム監視  
✅ **テスト可能性**: 包括的なテスト戦略による品質保証

**次のステップ:**
1. CDKスタックへの統合
2. リカバリーLambda関数のデプロイ
3. アラート通知先の設定
4. 運用手順書の作成
5. チームへのトレーニング実施

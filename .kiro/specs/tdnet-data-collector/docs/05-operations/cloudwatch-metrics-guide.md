# CloudWatch Metrics Guide

このドキュメントは、TDnet Data CollectorプロジェクトにおけるCloudWatchメトリクス機能の使用方法をまとめたものです。

## 目次

1. [概要](#概要)
2. [カスタムメトリクス（3個のみ）](#カスタムメトリクス3個のみ)
3. [AWS標準メトリクスの活用](#aws標準メトリクスの活用)
4. [Lambda専用ヘルパー関数](#lambda専用ヘルパー関数)
5. [使用例](#使用例)
6. [ベストプラクティス](#ベストプラクティス)

---

## 概要

TDnet Data Collectorでは、**コスト最適化のため、カスタムメトリクスを3個のみに制限**しています。

### メトリクス戦略

- **カスタムメトリクス（3個）**: ビジネスロジック固有の指標
- **AWS標準メトリクス**: Lambda、DynamoDB、S3の標準メトリクスを最大限活用

### カスタムメトリクス（3個のみ）

| メトリクス名 | 説明 | 用途 |
|------------|------|------|
| `DisclosuresCollected` | 開示情報収集成功件数 | 日次収集件数の監視 |
| `DisclosuresFailed` | 開示情報収集失敗件数 | 収集エラーの監視 |
| `CollectionSuccessRate` | 開示情報収集成功率（%） | 収集品質の監視 |

**重要:** これら3個以外のカスタムメトリクスは送信しないでください。コスト増加の原因となります。

---

## AWS標準メトリクスの活用

カスタムメトリクスの代わりに、AWS標準メトリクスを活用してコストを削減します。

### Lambda標準メトリクス（無料）

| メトリクス名 | 説明 | 用途 |
|------------|------|------|
| `Invocations` | Lambda呼び出し回数 | 実行頻度の監視 |
| `Errors` | Lambda実行エラー数 | エラー率の監視 |
| `Duration` | Lambda実行時間 | パフォーマンス監視 |
| `Throttles` | スロットリング回数 | 同時実行制限の監視 |
| `ConcurrentExecutions` | 同時実行数 | リソース使用状況の監視 |
| `DeadLetterErrors` | DLQ送信エラー | DLQ設定の監視 |

**アクセス方法:**
- CloudWatchコンソール → メトリクス → Lambda → 関数別メトリクス

### DynamoDB標準メトリクス（無料）

| メトリクス名 | 説明 | 用途 |
|------------|------|------|
| `ConsumedReadCapacityUnits` | 読み取りキャパシティ消費量 | コスト監視 |
| `ConsumedWriteCapacityUnits` | 書き込みキャパシティ消費量 | コスト監視 |
| `UserErrors` | ユーザーエラー数 | バリデーションエラー監視 |
| `SystemErrors` | システムエラー数 | DynamoDBエラー監視 |
| `ThrottledRequests` | スロットリングされたリクエスト数 | キャパシティ不足の監視 |

**アクセス方法:**
- CloudWatchコンソール → メトリクス → DynamoDB → テーブル別メトリクス

### S3標準メトリクス（無料）

| メトリクス名 | 説明 | 用途 |
|------------|------|------|
| `NumberOfObjects` | オブジェクト数 | ストレージ使用状況の監視 |
| `BucketSizeBytes` | バケットサイズ（バイト） | ストレージコスト監視 |
| `AllRequests` | すべてのリクエスト数 | アクセス頻度の監視 |
| `4xxErrors` | 4xxエラー数 | クライアントエラー監視 |
| `5xxErrors` | 5xxエラー数 | サーバーエラー監視 |

**アクセス方法:**
- CloudWatchコンソール → メトリクス → S3 → ストレージメトリクス

---

## Lambda専用ヘルパー関数

### カスタムメトリクス送信関数（3個のみ）

#### 1. `sendDisclosuresCollectedMetric()` - 開示情報収集成功

```typescript
import { sendDisclosuresCollectedMetric } from '../../utils/metrics';

// 収集完了時に送信
await sendDisclosuresCollectedMetric(150, context.functionName);
```

#### 2. `sendDisclosuresFailedMetric()` - 開示情報収集失敗

```typescript
import { sendDisclosuresFailedMetric } from '../../utils/metrics';

// 収集完了時に送信
await sendDisclosuresFailedMetric(5, context.functionName);
```

#### 3. `sendCollectionSuccessRateMetric()` - 開示情報収集成功率

```typescript
import { sendCollectionSuccessRateMetric } from '../../utils/metrics';

// 収集完了時に送信
const successRate = (collected / (collected + failed)) * 100;
await sendCollectionSuccessRateMetric(successRate, context.functionName);
```

### 非推奨関数（AWS標準メトリクスで代替）

以下の関数は**使用しないでください**。AWS標準メトリクスで代替できます。

| 非推奨関数 | 代替AWS標準メトリクス |
|-----------|---------------------|
| `sendErrorMetric()` | Lambda標準メトリクス: `Errors` |
| `sendSuccessMetric()` | Lambda標準メトリクス: `Invocations` - `Errors` |
| `sendExecutionTimeMetric()` | Lambda標準メトリクス: `Duration` |
| `sendBatchResultMetrics()` | Lambda標準メトリクス: `Invocations`, `Errors` |



---

## 使用例

### 完全なLambda関数の例（カスタムメトリクス3個のみ）

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../utils/logger';
import {
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../../utils/metrics';

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Lambda invoked', {
      requestId: context.requestId,
      functionName: context.functionName,
    });
    
    // メイン処理
    const result = await collectDisclosures();
    
    // カスタムメトリクス送信（3個のみ）
    await sendDisclosuresCollectedMetric(result.collected, context.functionName);
    await sendDisclosuresFailedMetric(result.failed, context.functionName);
    
    const successRate = (result.collected / (result.collected + result.failed)) * 100;
    await sendCollectionSuccessRateMetric(successRate, context.functionName);
    
    // Lambda標準メトリクス（Invocations, Duration）は自動的に記録される
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        data: result,
      }),
    };
  } catch (error) {
    logger.error('Lambda execution failed', {
      requestId: context.requestId,
      error: error.message,
      stack: error.stack,
    });
    
    // Lambda標準メトリクス（Errors）は自動的に記録される
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        message: 'Internal server error',
      }),
    };
  }
}

async function collectDisclosures(): Promise<{ collected: number; failed: number }> {
  // ビジネスロジックの実装
  return { collected: 150, failed: 5 };
}
```

### AWS標準メトリクスの活用例

```typescript
// Lambda標準メトリクスは自動的に記録されるため、カスタムメトリクスは不要

// ✅ 良い例: AWS標準メトリクスを活用
export async function handler(event: any, context: Context) {
  try {
    await operation();
    // Lambda標準メトリクス「Invocations」が自動的に記録される
    // Lambda標準メトリクス「Duration」が自動的に記録される
    return { statusCode: 200 };
  } catch (error) {
    // Lambda標準メトリクス「Errors」が自動的に記録される
    throw error;
  }
}

// ❌ 悪い例: 不要なカスタムメトリクス送信（コスト増加）
export async function handler(event: any, context: Context) {
  const startTime = Date.now();
  try {
    await operation();
    await sendSuccessMetric(context.functionName); // 不要！Lambda標準メトリクスで代替可能
    await sendExecutionTimeMetric(Date.now() - startTime, context.functionName); // 不要！Lambda標準メトリクスで代替可能
    return { statusCode: 200 };
  } catch (error) {
    await sendErrorMetric(error as Error, context.functionName); // 不要！Lambda標準メトリクスで代替可能
    throw error;
  }
}
```

---

## ベストプラクティス

### 1. カスタムメトリクスは3個のみに制限

**コスト最適化のため、カスタムメトリクスは以下の3個のみに制限してください:**

- `DisclosuresCollected` - 開示情報収集成功件数
- `DisclosuresFailed` - 開示情報収集失敗件数
- `CollectionSuccessRate` - 開示情報収集成功率

```typescript
// ✅ 良い例: カスタムメトリクス3個のみ
await sendDisclosuresCollectedMetric(150, context.functionName);
await sendDisclosuresFailedMetric(5, context.functionName);
await sendCollectionSuccessRateMetric(96.77, context.functionName);

// ❌ 悪い例: 不要なカスタムメトリクス（コスト増加）
await sendErrorMetric(error, context.functionName); // Lambda標準メトリクスで代替
await sendSuccessMetric(context.functionName); // Lambda標準メトリクスで代替
await sendExecutionTimeMetric(1234, context.functionName); // Lambda標準メトリクスで代替
```

### 2. AWS標準メトリクスを最大限活用

Lambda、DynamoDB、S3の標準メトリクスは**無料**です。カスタムメトリクスの代わりに活用してください。

```typescript
// ✅ 良い例: Lambda標準メトリクスを活用
export async function handler(event: any, context: Context) {
  try {
    await operation();
    // Lambda標準メトリクス（Invocations, Duration）が自動記録される
    return { statusCode: 200 };
  } catch (error) {
    // Lambda標準メトリクス（Errors）が自動記録される
    throw error;
  }
}
```

### 3. メトリクス送信失敗でメイン処理を中断しない

メトリクス送信は、メイン処理の成功/失敗に影響を与えません。メトリクス送信が失敗しても、エラーはログに記録されるだけで、スローされません。

```typescript
// ✅ 良い例: メトリクス送信失敗でもメイン処理は継続
try {
  await operation();
  await sendDisclosuresCollectedMetric(150, context.functionName); // 失敗してもエラーをスローしない
  return { statusCode: 200 };
} catch (error) {
  throw error;
}
```

### 4. CloudWatchアラームの設定

カスタムメトリクスとAWS標準メトリクスを組み合わせてアラームを設定します。

```typescript
// CDKでのアラーム設定例
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

// カスタムメトリクス: 収集失敗率が10%を超えたらアラート
const failedMetric = new cloudwatch.Metric({
  namespace: 'TDnetDataCollector',
  metricName: 'DisclosuresFailed',
  statistic: 'Sum',
  period: cdk.Duration.minutes(5),
});

const failedAlarm = failedMetric.createAlarm(this, 'FailedAlarm', {
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when more than 10 disclosures fail in 5 minutes',
});

// Lambda標準メトリクス: エラー率が5%を超えたらアラート
const errorMetric = collectorFunction.metricErrors({
  statistic: 'Sum',
  period: cdk.Duration.minutes(5),
});

const errorAlarm = errorMetric.createAlarm(this, 'ErrorAlarm', {
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when more than 5 Lambda errors occur in 5 minutes',
});
```

### 5. コスト監視

カスタムメトリクスのコストを定期的に監視してください。

**CloudWatchメトリクスの料金:**
- カスタムメトリクス: $0.30/メトリクス/月（最初の10,000メトリクスまで）
- AWS標準メトリクス: **無料**

**現在のコスト（カスタムメトリクス3個のみ）:**
- 3メトリクス × $0.30 = **$0.90/月**

**以前のコスト（カスタムメトリクス7個）:**
- 7メトリクス × $0.30 = **$2.10/月**

**削減額:** $1.20/月（約57%削減）

---

## CloudWatchでのメトリクス確認

### カスタムメトリクスの表示

1. AWS Management Consoleにログイン
2. CloudWatchサービスを開く
3. 左メニューから「メトリクス」→「すべてのメトリクス」を選択
4. 「TDnetDataCollector」名前空間を選択
5. 以下の3個のメトリクスが表示されます：
   - `DisclosuresCollected`
   - `DisclosuresFailed`
   - `CollectionSuccessRate`

### AWS標準メトリクスの表示

#### Lambda標準メトリクス

1. CloudWatchコンソール → メトリクス → Lambda
2. 「関数別メトリクス」を選択
3. 以下のメトリクスが表示されます（無料）：
   - `Invocations` - 呼び出し回数
   - `Errors` - エラー数
   - `Duration` - 実行時間
   - `Throttles` - スロットリング回数
   - `ConcurrentExecutions` - 同時実行数

#### DynamoDB標準メトリクス

1. CloudWatchコンソール → メトリクス → DynamoDB
2. 「テーブル別メトリクス」を選択
3. 以下のメトリクスが表示されます（無料）：
   - `ConsumedReadCapacityUnits` - 読み取りキャパシティ消費量
   - `ConsumedWriteCapacityUnits` - 書き込みキャパシティ消費量
   - `UserErrors` - ユーザーエラー数
   - `SystemErrors` - システムエラー数

#### S3標準メトリクス

1. CloudWatchコンソール → メトリクス → S3
2. 「ストレージメトリクス」を選択
3. 以下のメトリクスが表示されます（無料）：
   - `NumberOfObjects` - オブジェクト数
   - `BucketSizeBytes` - バケットサイズ
   - `AllRequests` - すべてのリクエスト数

---

## コスト最適化の成果

### カスタムメトリクス削減による効果

| 項目 | 以前 | 現在 | 削減率 |
|------|------|------|--------|
| カスタムメトリクス数 | 7個 | 3個 | 57%削減 |
| 月額コスト | $2.10 | $0.90 | 57%削減 |
| 年額コスト | $25.20 | $10.80 | 57%削減 |

### AWS標準メトリクスの活用

| メトリクス種類 | 数 | コスト |
|--------------|-----|--------|
| Lambda標準メトリクス | 6個 | **無料** |
| DynamoDB標準メトリクス | 5個 | **無料** |
| S3標準メトリクス | 5個 | **無料** |
| **合計** | **16個** | **無料** |

**結論:** カスタムメトリクスを3個に削減し、AWS標準メトリクス16個を活用することで、**年間$14.40のコスト削減**を実現しました。

---

## 関連ドキュメント

- **Lambda実装ガイド**: `../.kiro/steering/development/lambda-implementation.md` - Lambda関数の実装ガイドライン
- **エラーハンドリング**: `../.kiro/steering/core/error-handling-patterns.md` - エラーハンドリングの基本原則
- **監視とアラート**: `../.kiro/steering/infrastructure/monitoring-alerts.md` - CloudWatch設定とアラート
- **パフォーマンス最適化**: `../.kiro/steering/infrastructure/performance-optimization.md` - コスト削減とパフォーマンス

---

**最終更新:** 2026-02-12  
**バージョン:** 2.0.0  
**変更内容:** カスタムメトリクスを3個に削減、AWS標準メトリクスの活用を追加

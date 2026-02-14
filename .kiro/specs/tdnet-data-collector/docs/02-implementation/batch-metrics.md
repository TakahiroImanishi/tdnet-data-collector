# Batch Metrics Guide

このガイドでは、TDnet Data CollectorプロジェクトにおけるCloudWatchメトリクスの送信方法、特にバッチ処理結果の記録方法を説明します。

## 概要

CloudWatchメトリクスを使用して、Lambda関数の実行状況、エラー発生率、処理件数などを監視します。これにより、システムの健全性を把握し、問題を早期に検出できます。

## sendBatchResultMetrics() 関数

### 基本的な使い方

バッチ処理の結果（成功件数、失敗件数、処理時間）を一括でCloudWatchに送信します。

```typescript
import { sendMetrics } from './utils/cloudwatch-metrics';

const startTime = Date.now();
const results = { success: 0, failed: 0 };

// バッチ処理
for (const item of items) {
  try {
    await processItem(item);
    results.success++;
  } catch (error) {
    results.failed++;
  }
}

const processingTime = Date.now() - startTime;

// メトリクスを一括送信
await sendMetrics([
  { name: 'DisclosuresCollected', value: results.success, unit: 'Count' },
  { name: 'DisclosuresFailed', value: results.failed, unit: 'Count' },
  { name: 'ProcessingTime', value: processingTime, unit: 'Milliseconds' },
]);
```

## メトリクス送信関数

### sendMetric() - 単一メトリクス送信

```typescript
async function sendMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent' = 'Count',
  dimensions?: MetricDimensions
): Promise<void>
```

**パラメータ:**
- `metricName`: メトリクス名（例: "LambdaError", "DisclosuresCollected"）
- `value`: メトリクス値
- `unit`: メトリクス単位（デフォルト: "Count"）
- `dimensions`: ディメンション（オプション）

**使用例:**

```typescript
// エラーカウント
await sendMetric('LambdaError', 1, 'Count', {
  ErrorType: 'NetworkError',
  FunctionName: 'Collector',
});

// 処理時間
await sendMetric('ProcessingTime', 1234, 'Milliseconds', {
  FunctionName: 'Collector',
});

// 成功カウント
await sendMetric('DisclosuresCollected', 10, 'Count', {
  Date: '2024-01-15',
});
```

### sendMetrics() - 複数メトリクス一括送信

```typescript
async function sendMetrics(
  metrics: Array<{
    name: string;
    value: number;
    unit?: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent';
    dimensions?: MetricDimensions;
  }>
): Promise<void>
```

**パラメータ:**
- `metrics`: メトリクスの配列

**使用例:**

```typescript
await sendMetrics([
  { name: 'DisclosuresCollected', value: 10, unit: 'Count' },
  { name: 'DisclosuresFailed', value: 2, unit: 'Count' },
  { name: 'ProcessingTime', value: 5000, unit: 'Milliseconds' },
]);
```

### sendErrorMetric() - エラーメトリクス送信

```typescript
async function sendErrorMetric(
  errorType: string,
  functionName: string,
  additionalDimensions?: MetricDimensions
): Promise<void>
```

**パラメータ:**
- `errorType`: エラータイプ（例: "NetworkError", "ValidationError"）
- `functionName`: Lambda関数名
- `additionalDimensions`: 追加ディメンション（オプション）

**使用例:**

```typescript
try {
  await operation();
} catch (error) {
  await sendErrorMetric(
    error.constructor.name,
    'Collector',
    { Date: '2024-01-15' }
  );
  throw error;
}
```

### sendSuccessMetric() - 成功メトリクス送信

```typescript
async function sendSuccessMetric(
  count: number,
  functionName: string,
  additionalDimensions?: MetricDimensions
): Promise<void>
```

**パラメータ:**
- `count`: 成功件数
- `functionName`: Lambda関数名
- `additionalDimensions`: 追加ディメンション（オプション）

**使用例:**

```typescript
await sendSuccessMetric(10, 'Collector', { Date: '2024-01-15' });
```

## バッチ処理結果の記録方法

### パターン1: 基本的なバッチ処理

```typescript
import { sendMetrics } from './utils/cloudwatch-metrics';
import { logger } from './utils/logger';

export async function handler(event: any, context: any) {
  const startTime = Date.now();
  const results = { success: 0, failed: 0 };
  const items = event.items;
  
  for (const item of items) {
    try {
      await processItem(item);
      results.success++;
    } catch (error) {
      results.failed++;
      logger.error('Failed to process item', {
        item_id: item.id,
        error_type: error.constructor.name,
        error_message: error.message,
      });
    }
  }
  
  const processingTime = Date.now() - startTime;
  
  // メトリクスを一括送信
  await sendMetrics([
    { name: 'ItemsProcessed', value: results.success, unit: 'Count' },
    { name: 'ItemsFailed', value: results.failed, unit: 'Count' },
    { name: 'ProcessingTime', value: processingTime, unit: 'Milliseconds' },
  ]);
  
  logger.info('Batch processing completed', {
    total: items.length,
    success: results.success,
    failed: results.failed,
    processing_time_ms: processingTime,
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
}
```

### パターン2: ディメンション付きメトリクス

```typescript
const date = new Date().toISOString().split('T')[0]; // "2024-01-15"

await sendMetrics([
  {
    name: 'DisclosuresCollected',
    value: results.success,
    unit: 'Count',
    dimensions: {
      Date: date,
      FunctionName: context.functionName,
    },
  },
  {
    name: 'DisclosuresFailed',
    value: results.failed,
    unit: 'Count',
    dimensions: {
      Date: date,
      FunctionName: context.functionName,
    },
  },
]);
```

### パターン3: エラータイプ別のメトリクス

```typescript
const errorCounts: Record<string, number> = {};

for (const item of items) {
  try {
    await processItem(item);
    results.success++;
  } catch (error) {
    results.failed++;
    const errorType = error.constructor.name;
    errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
  }
}

// エラータイプ別にメトリクスを送信
const errorMetrics = Object.entries(errorCounts).map(([errorType, count]) => ({
  name: 'LambdaError',
  value: count,
  unit: 'Count' as const,
  dimensions: {
    ErrorType: errorType,
    FunctionName: context.functionName,
  },
}));

await sendMetrics([
  { name: 'ItemsProcessed', value: results.success, unit: 'Count' },
  ...errorMetrics,
]);
```

### パターン4: 処理速度のメトリクス

```typescript
const startTime = Date.now();
const results = { success: 0, failed: 0 };

for (const item of items) {
  try {
    await processItem(item);
    results.success++;
  } catch (error) {
    results.failed++;
  }
}

const processingTime = Date.now() - startTime;
const itemsPerSecond = (results.success / processingTime) * 1000;

await sendMetrics([
  { name: 'ItemsProcessed', value: results.success, unit: 'Count' },
  { name: 'ProcessingTime', value: processingTime, unit: 'Milliseconds' },
  { name: 'ItemsPerSecond', value: itemsPerSecond, unit: 'Count' },
]);
```

## メトリクス名前空間とディメンション

### 名前空間

すべてのメトリクスは `TDnetDataCollector` 名前空間に送信されます。

### 標準ディメンション

| ディメンション | 説明 | 例 |
|--------------|------|-----|
| `FunctionName` | Lambda関数名 | "Collector", "Processor" |
| `ErrorType` | エラータイプ | "NetworkError", "ValidationError" |
| `Date` | 処理日付 | "2024-01-15" |
| `Environment` | 環境 | "production", "staging" |

### カスタムディメンション

業務ロジック固有のディメンションを追加できます：

```typescript
await sendMetric('DisclosuresCollected', 10, 'Count', {
  CompanyCode: '1234',
  DisclosureType: 'financial',
  Market: 'TSE',
});
```

## CloudWatchでの確認

### メトリクスの表示

1. AWS Management Consoleで CloudWatch を開く
2. 左メニューから「メトリクス」→「すべてのメトリクス」を選択
3. 「TDnetDataCollector」名前空間を選択
4. 表示したいメトリクスを選択

### アラームの設定

```typescript
// CDKでアラームを設定する例
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

const errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'TDnetDataCollector',
    metricName: 'LambdaError',
    statistic: 'Sum',
    period: Duration.minutes(5),
  }),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when error count exceeds 10 in 5 minutes',
});
```

## ベストプラクティス

### ✅ DO: バッチ処理の結果を一括送信

```typescript
// 良い例: 複数のメトリクスを一括送信
await sendMetrics([
  { name: 'ItemsProcessed', value: results.success, unit: 'Count' },
  { name: 'ItemsFailed', value: results.failed, unit: 'Count' },
  { name: 'ProcessingTime', value: processingTime, unit: 'Milliseconds' },
]);
```

### ✅ DO: 処理時間を記録

```typescript
const startTime = Date.now();
// 処理
const processingTime = Date.now() - startTime;
await sendMetric('ProcessingTime', processingTime, 'Milliseconds');
```

### ✅ DO: エラータイプ別にメトリクスを記録

```typescript
await sendErrorMetric(error.constructor.name, 'Collector');
```

### ✅ DO: ディメンションを活用

```typescript
await sendMetric('DisclosuresCollected', 10, 'Count', {
  Date: '2024-01-15',
  FunctionName: context.functionName,
});
```

### ❌ DON'T: メトリクス送信失敗でメイン処理を中断しない

```typescript
// 良い例: メトリクス送信関数は内部でエラーをキャッチ
await sendMetrics([...]); // 失敗してもエラーをスローしない

// 悪い例: メトリクス送信失敗でメイン処理を中断
try {
  await sendMetrics([...]);
} catch (error) {
  throw error; // ❌ メイン処理が中断される
}
```

### ❌ DON'T: 高頻度でメトリクスを送信しない

```typescript
// 悪い例: ループ内で個別に送信
for (const item of items) {
  await sendMetric('ItemProcessed', 1, 'Count'); // ❌ 高頻度送信
}

// 良い例: バッチ処理後に一括送信
let count = 0;
for (const item of items) {
  count++;
}
await sendMetric('ItemsProcessed', count, 'Count'); // ✅ 一括送信
```

## メトリクスの種類

### カウントメトリクス

```typescript
await sendMetric('DisclosuresCollected', 10, 'Count');
await sendMetric('ErrorCount', 2, 'Count');
```

### 時間メトリクス

```typescript
await sendMetric('ProcessingTime', 1234, 'Milliseconds');
await sendMetric('APIResponseTime', 567, 'Milliseconds');
```

### サイズメトリクス

```typescript
await sendMetric('FileSize', 1024000, 'Bytes');
await sendMetric('ResponseSize', 512000, 'Bytes');
```

### パーセンテージメトリクス

```typescript
const successRate = (results.success / items.length) * 100;
await sendMetric('SuccessRate', successRate, 'Percent');
```

## トラブルシューティング

### メトリクスが表示されない

**原因**: Lambda実行ロールにCloudWatchへの書き込み権限がない可能性があります。

**解決策**: Lambda実行ロールに `cloudwatch:PutMetricData` 権限を付与してください。

```json
{
  "Effect": "Allow",
  "Action": "cloudwatch:PutMetricData",
  "Resource": "*"
}
```

### メトリクス送信が遅い

**原因**: 個別にメトリクスを送信している可能性があります。

**解決策**: `sendMetrics()` を使用して一括送信してください。

```typescript
// 悪い例: 個別送信
await sendMetric('Metric1', 10, 'Count');
await sendMetric('Metric2', 20, 'Count');
await sendMetric('Metric3', 30, 'Count');

// 良い例: 一括送信
await sendMetrics([
  { name: 'Metric1', value: 10, unit: 'Count' },
  { name: 'Metric2', value: 20, unit: 'Count' },
  { name: 'Metric3', value: 30, unit: 'Count' },
]);
```

### メトリクス送信失敗のログが多い

**原因**: ネットワークエラーやCloudWatchのスロットリングが発生している可能性があります。

**解決策**: メトリクス送信は失敗してもメイン処理を中断しないため、ログを確認して原因を特定してください。

## 関連ドキュメント

- [Lambda Error Logging Guide](./lambda-error-logging.md)
- [Monitoring and Alerts](../../.kiro/steering/infrastructure/monitoring-alerts.md)
- [Performance Optimization](../../.kiro/steering/infrastructure/performance-optimization.md)
- [Error Handling Patterns](../../.kiro/steering/core/error-handling-patterns.md)

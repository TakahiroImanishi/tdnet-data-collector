# CloudWatch Metrics Guide

このドキュメントは、TDnet Data CollectorプロジェクトにおけるCloudWatchメトリクス機能の使用方法をまとめたものです。

## 目次

1. [概要](#概要)
2. [基本的なメトリクス送信](#基本的なメトリクス送信)
3. [Lambda専用ヘルパー関数](#lambda専用ヘルパー関数)
4. [使用例](#使用例)
5. [ベストプラクティス](#ベストプラクティス)

---

## 概要

TDnet Data Collectorでは、2つのCloudWatchメトリクスユーティリティを提供しています：

### 1. `cloudwatch-metrics.ts` - 基本的なメトリクス送信

**用途:** 汎用的なメトリクス送信機能

**主な関数:**
- `sendMetric()` - 単一メトリクスの送信
- `sendMetrics()` - 複数メトリクスの一括送信
- `sendErrorMetric()` - エラーメトリクスの送信
- `sendSuccessMetric()` - 成功メトリクスの送信

### 2. `metrics.ts` - Lambda専用ヘルパー

**用途:** Lambda関数での使用に最適化されたヘルパー関数

**主な関数:**
- `sendMetric()` - 柔軟なオプション設定が可能な基本関数
- `sendErrorMetric()` - Lambda実装チェックリストに準拠したエラーメトリクス
- `sendSuccessMetric()` - 成功メトリクスの送信
- `sendExecutionTimeMetric()` - 実行時間メトリクスの送信
- `sendBatchResultMetrics()` - バッチ処理結果の一括送信

**推奨:** Lambda関数では `metrics.ts` の使用を推奨します。

---

## 基本的なメトリクス送信

### `cloudwatch-metrics.ts` の使用

```typescript
import { sendMetric, sendErrorMetric, sendSuccessMetric } from '../../utils/cloudwatch-metrics';

// 単一メトリクスの送信
await sendMetric('DisclosuresCollected', 10, 'Count', {
  Date: '2024-01-15',
});

// エラーメトリクスの送信
await sendErrorMetric('NetworkError', 'CollectorFunction', {
  Date: '2024-01-15',
});

// 成功メトリクスの送信
await sendSuccessMetric(10, 'CollectorFunction', {
  Date: '2024-01-15',
});
```

### 複数メトリクスの一括送信

```typescript
import { sendMetrics } from '../../utils/cloudwatch-metrics';

await sendMetrics([
  { name: 'DisclosuresCollected', value: 10, unit: 'Count' },
  { name: 'DisclosuresFailed', value: 2, unit: 'Count' },
  { name: 'ProcessingTime', value: 5000, unit: 'Milliseconds' },
]);
```

---

## Lambda専用ヘルパー関数

### 1. `sendErrorMetric()` - Lambda実装チェックリスト準拠

**特徴:**
- Lambda実装チェックリストの「エラーメトリクス送信」に対応
- エラーオブジェクトから自動的にエラータイプを抽出
- 関数名をディメンションとして自動追加

**使用例:**

```typescript
import { sendErrorMetric } from '../../utils/metrics';
import { ValidationError } from '../../errors';

export async function handler(event: any, context: any) {
  try {
    await operation();
  } catch (error) {
    // エラーオブジェクトと関数名を渡すだけ
    await sendErrorMetric(error as Error, context.functionName);
    throw error;
  }
}
```

**送信されるメトリクス:**
- メトリクス名: `LambdaError`
- 値: `1`
- ディメンション:
  - `ErrorType`: エラークラス名（例: `ValidationError`, `RetryableError`）
  - `FunctionName`: Lambda関数名（オプション）

---

### 2. `sendSuccessMetric()` - 成功メトリクス

**特徴:**
- Lambda関数の成功を記録
- 関数名をディメンションとして追加可能

**使用例:**

```typescript
import { sendSuccessMetric } from '../../utils/metrics';

export async function handler(event: any, context: any) {
  try {
    await operation();
    
    // 成功メトリクスを送信
    await sendSuccessMetric(context.functionName);
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    await sendErrorMetric(error as Error, context.functionName);
    throw error;
  }
}
```

**送信されるメトリクス:**
- メトリクス名: `LambdaSuccess`
- 値: `1`
- ディメンション:
  - `FunctionName`: Lambda関数名（オプション）

---

### 3. `sendExecutionTimeMetric()` - 実行時間メトリクス

**特徴:**
- Lambda関数の実行時間を記録
- パフォーマンス監視に使用

**使用例:**

```typescript
import { sendExecutionTimeMetric } from '../../utils/metrics';

export async function handler(event: any, context: any) {
  const startTime = Date.now();
  
  try {
    await operation();
    
    // 実行時間を計算して送信
    const executionTime = Date.now() - startTime;
    await sendExecutionTimeMetric(executionTime, context.functionName);
    
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    throw error;
  }
}
```

**送信されるメトリクス:**
- メトリクス名: `ExecutionTime`
- 値: 実行時間（ミリ秒）
- 単位: `Milliseconds`
- ディメンション:
  - `FunctionName`: Lambda関数名（オプション）

---

### 4. `sendBatchResultMetrics()` - バッチ処理結果の一括送信

**特徴:**
- バッチ処理の成功件数と失敗件数を一括送信
- 部分的失敗を許容する処理に最適

**使用例:**

```typescript
import { sendBatchResultMetrics } from '../../utils/metrics';

export async function handler(event: any, context: any) {
  const items = event.items;
  let success = 0;
  let failed = 0;
  
  for (const item of items) {
    try {
      await processItem(item);
      success++;
    } catch (error) {
      failed++;
      logger.error('Item processing failed', { item, error });
    }
  }
  
  // バッチ結果メトリクスを一括送信
  await sendBatchResultMetrics(success, failed, context.functionName);
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success, failed }),
  };
}
```

**送信されるメトリクス:**
- メトリクス名: `BatchSuccess` と `BatchFailed`
- 値: 成功件数と失敗件数
- ディメンション:
  - `FunctionName`: Lambda関数名（オプション）

---

## 使用例

### 完全なLambda関数の例

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from '../../utils/logger';
import {
  sendErrorMetric,
  sendSuccessMetric,
  sendExecutionTimeMetric,
} from '../../utils/metrics';

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Lambda invoked', {
      requestId: context.requestId,
      functionName: context.functionName,
    });
    
    // メイン処理
    const result = await processEvent(event);
    
    // 成功メトリクス送信
    await sendSuccessMetric(context.functionName);
    
    // 実行時間メトリクス送信
    const executionTime = Date.now() - startTime;
    await sendExecutionTimeMetric(executionTime, context.functionName);
    
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
    
    // エラーメトリクス送信
    await sendErrorMetric(error as Error, context.functionName);
    
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

async function processEvent(event: APIGatewayProxyEvent): Promise<any> {
  // ビジネスロジックの実装
  return {};
}
```

### バッチ処理の例

```typescript
import { Context } from 'aws-lambda';
import { logger } from '../../utils/logger';
import { sendBatchResultMetrics } from '../../utils/metrics';

interface BatchEvent {
  items: Array<{ id: string; data: any }>;
}

export async function handler(event: BatchEvent, context: Context) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ id: string; error: string }>,
  };
  
  for (const item of event.items) {
    try {
      await processItem(item);
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        id: item.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      logger.error('Item processing failed', {
        item_id: item.id,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  // バッチ結果メトリクスを送信
  await sendBatchResultMetrics(results.success, results.failed, context.functionName);
  
  logger.info('Batch processing completed', {
    total: event.items.length,
    success: results.success,
    failed: results.failed,
  });
  
  return results;
}

async function processItem(item: { id: string; data: any }): Promise<void> {
  // アイテム処理ロジック
}
```

---

## ベストプラクティス

### 1. メトリクス送信失敗でメイン処理を中断しない

メトリクス送信は、メイン処理の成功/失敗に影響を与えません。メトリクス送信が失敗しても、エラーはログに記録されるだけで、スローされません。

```typescript
// ✅ 良い例: メトリクス送信失敗でもメイン処理は継続
try {
  await operation();
  await sendSuccessMetric(context.functionName); // 失敗してもエラーをスローしない
  return { statusCode: 200 };
} catch (error) {
  await sendErrorMetric(error as Error, context.functionName);
  throw error;
}
```

### 2. Lambda実装チェックリストに準拠

すべてのLambda関数は、以下のメトリクスを送信することを推奨します：

- [ ] **エラーメトリクス**: `sendErrorMetric()` でエラー発生時に送信
- [ ] **成功メトリクス**: `sendSuccessMetric()` で成功時に送信
- [ ] **実行時間メトリクス**: `sendExecutionTimeMetric()` でパフォーマンス監視

### 3. ディメンションの活用

ディメンションを使用して、メトリクスをフィルタリング・グループ化できます：

```typescript
// 日付ディメンションを追加
await sendErrorMetric(error, 'CollectorFunction');

// カスタムディメンションを追加（cloudwatch-metrics.ts使用時）
await sendMetric('CustomMetric', 1, 'Count', {
  Environment: 'production',
  Region: 'ap-northeast-1',
  Date: '2024-01-15',
});
```

### 4. バッチ処理では部分的失敗を記録

バッチ処理では、個別の失敗を記録しつつ、全体の成功/失敗件数を送信します：

```typescript
// ✅ 良い例: 部分的失敗を許容
for (const item of items) {
  try {
    await processItem(item);
    success++;
  } catch (error) {
    failed++;
    logger.error('Item processing failed', { item, error });
    // 個別の失敗でループを中断しない
  }
}

await sendBatchResultMetrics(success, failed, context.functionName);
```

### 5. メトリクス名前空間の統一

すべてのメトリクスは、`TDnetDataCollector` 名前空間に送信されます。カスタム名前空間が必要な場合は、`sendMetric()` のオプションで指定できます：

```typescript
// デフォルト名前空間（TDnetDataCollector）
await sendMetric('TestMetric', 1);

// カスタム名前空間
await sendMetric('TestMetric', 1, {
  namespace: 'CustomNamespace',
});
```

---

## CloudWatchでのメトリクス確認

### メトリクスの表示

1. AWS Management Consoleにログイン
2. CloudWatchサービスを開く
3. 左メニューから「メトリクス」→「すべてのメトリクス」を選択
4. 「TDnetDataCollector」名前空間を選択
5. メトリクス名やディメンションでフィルタリング

### アラームの設定

エラーメトリクスに基づいてアラームを設定できます：

```typescript
// CDKでのアラーム設定例
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

const errorMetric = new cloudwatch.Metric({
  namespace: 'TDnetDataCollector',
  metricName: 'LambdaError',
  dimensionsMap: {
    FunctionName: 'CollectorFunction',
  },
  statistic: 'Sum',
  period: cdk.Duration.minutes(5),
});

const alarm = errorMetric.createAlarm(this, 'ErrorAlarm', {
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Alert when more than 5 errors occur in 5 minutes',
});
```

---

## 関連ドキュメント

- **Lambda実装ガイド**: `../.kiro/steering/development/lambda-implementation.md` - Lambda関数の実装ガイドライン
- **エラーハンドリング**: `../.kiro/steering/core/error-handling-patterns.md` - エラーハンドリングの基本原則
- **監視とアラート**: `../.kiro/steering/infrastructure/monitoring-alerts.md` - CloudWatch設定とアラート

---

**最終更新:** 2026-02-08
**バージョン:** 1.0.0

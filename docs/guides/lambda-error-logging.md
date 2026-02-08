# Lambda Error Logging Guide

このガイドでは、TDnet Data CollectorプロジェクトにおけるLambda関数のエラーログ記録方法を説明します。

## 概要

Lambda関数では、統一されたエラーログフォーマットを使用して、CloudWatch Logsに構造化ログを記録します。これにより、エラーの追跡、分析、アラート設定が容易になります。

## logLambdaError() 関数

### 基本的な使い方

`logLambdaError()` は、Lambda実装チェックリストに準拠した標準エラーログフォーマットを提供します。

```typescript
import { logLambdaError } from './utils/logger';

export async function handler(event: any, context: any) {
  try {
    // メイン処理
    await operation();
    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    // Lambda実行コンテキストを含むエラーログを記録
    logLambdaError('Lambda execution failed', error as Error, context);
    throw error;
  }
}
```

### 関数シグネチャ

```typescript
function logLambdaError(
  message: string,
  error: Error,
  lambdaContext?: { requestId?: string; functionName?: string },
  additionalContext?: LogContext
): void
```

**パラメータ:**
- `message`: エラーメッセージ（例: "Lambda execution failed"）
- `error`: エラーオブジェクト
- `lambdaContext`: Lambda実行コンテキスト（オプション）
  - `requestId`: リクエストID（CloudWatch Logsでトレース可能）
  - `functionName`: Lambda関数名
- `additionalContext`: 追加のコンテキスト情報（オプション）

### 出力フォーマット

`logLambdaError()` は、以下の構造化ログを出力します：

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "error",
  "message": "Lambda execution failed",
  "error_type": "NetworkError",
  "error_message": "Connection timeout",
  "context": {
    "request_id": "abc123-def456-ghi789",
    "function_name": "TDnetCollector",
    "disclosure_id": "TD20240115001"
  },
  "stack_trace": "NetworkError: Connection timeout\n    at fetch (/var/task/index.js:123:45)\n    ..."
}
```

## Lambda実装チェックリスト準拠

`logLambdaError()` は、以下のLambda実装チェックリスト項目に準拠しています：

### ✅ 構造化ログ

- `error_type`: エラークラス名（例: NetworkError, ValidationError）
- `error_message`: エラーメッセージ
- `context`: Lambda実行コンテキストと追加情報
- `stack_trace`: スタックトレース（デバッグ用）

### ✅ Lambda実行コンテキスト

- `request_id`: CloudWatch Logsでリクエストをトレース
- `function_name`: どのLambda関数でエラーが発生したかを特定

### ✅ 追加コンテキスト

業務ロジック固有の情報を追加可能：

```typescript
logLambdaError('Failed to process disclosure', error, context, {
  disclosure_id: 'TD20240115001',
  company_code: '1234',
  retry_count: 2,
});
```

## 使用例

### 例1: 基本的なエラーログ

```typescript
export async function handler(event: any, context: any) {
  try {
    const result = await fetchDisclosures();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logLambdaError('Failed to fetch disclosures', error as Error, context);
    throw error;
  }
}
```

### 例2: 追加コンテキスト付きエラーログ

```typescript
export async function handler(event: any, context: any) {
  const disclosureId = event.disclosure_id;
  
  try {
    await processDisclosure(disclosureId);
    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    logLambdaError(
      'Failed to process disclosure',
      error as Error,
      context,
      {
        disclosure_id: disclosureId,
        event_source: event.source,
      }
    );
    throw error;
  }
}
```

### 例3: 再試行ロジックとの組み合わせ

```typescript
import { retryWithBackoff } from './utils/retry';
import { logLambdaError } from './utils/logger';

export async function handler(event: any, context: any) {
  try {
    const result = await retryWithBackoff(
      async () => await fetchData(),
      {
        maxRetries: 3,
        initialDelay: 2000,
        backoffMultiplier: 2,
      }
    );
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    logLambdaError(
      'Failed after retries',
      error as Error,
      context,
      {
        max_retries: 3,
        operation: 'fetchData',
      }
    );
    throw error;
  }
}
```

### 例4: バッチ処理での部分的失敗

```typescript
export async function handler(event: any, context: any) {
  const items = event.items;
  const results = { success: 0, failed: 0 };
  
  for (const item of items) {
    try {
      await processItem(item);
      results.success++;
    } catch (error) {
      results.failed++;
      logLambdaError(
        'Failed to process item',
        error as Error,
        context,
        {
          item_id: item.id,
          batch_size: items.length,
        }
      );
      // 個別の失敗は記録するが、処理は継続
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
}
```

## CloudWatch Logsでの確認

### ログの検索

CloudWatch Logs Insightsで、以下のクエリを使用してエラーログを検索できます：

```sql
fields @timestamp, message, error_type, error_message, context.disclosure_id
| filter level = "error"
| sort @timestamp desc
| limit 100
```

### エラータイプ別の集計

```sql
fields error_type
| filter level = "error"
| stats count() by error_type
| sort count() desc
```

### 特定のリクエストIDでトレース

```sql
fields @timestamp, message, error_type, error_message
| filter context.request_id = "abc123-def456-ghi789"
| sort @timestamp asc
```

## ベストプラクティス

### ✅ DO: Lambda関数のトップレベルでエラーをキャッチ

```typescript
export async function handler(event: any, context: any) {
  try {
    // メイン処理
  } catch (error) {
    logLambdaError('Lambda execution failed', error as Error, context);
    throw error; // エラーを再スローして、Lambda実行を失敗させる
  }
}
```

### ✅ DO: 業務ロジック固有の情報を追加

```typescript
logLambdaError('Failed to save disclosure', error, context, {
  disclosure_id: 'TD20240115001',
  company_code: '1234',
  operation: 'saveToDynamoDB',
});
```

### ✅ DO: エラーを再スローして、Lambda実行を失敗させる

```typescript
catch (error) {
  logLambdaError('Operation failed', error as Error, context);
  throw error; // 重要: エラーを再スロー
}
```

### ❌ DON'T: エラーを握りつぶさない

```typescript
// 悪い例: エラーを握りつぶす
catch (error) {
  logLambdaError('Operation failed', error as Error, context);
  return { statusCode: 200, body: 'Success' }; // ❌ エラーを隠蔽
}
```

### ❌ DON'T: センシティブ情報をログに含めない

```typescript
// 悪い例: パスワードやAPIキーをログに含める
logLambdaError('Authentication failed', error, context, {
  password: 'secret123', // ❌ センシティブ情報
  api_key: 'abc123',     // ❌ センシティブ情報
});
```

## 関連ドキュメント

- [Error Handling Patterns](../../.kiro/steering/core/error-handling-patterns.md)
- [Error Handling Implementation](../../.kiro/steering/development/error-handling-implementation.md)
- [CloudWatch Metrics Guide](./batch-metrics.md)
- [Lambda Implementation Checklist](../../.kiro/steering/development/lambda-implementation.md)

## トラブルシューティング

### ログが出力されない

**原因**: ログレベルが高すぎる可能性があります。

**解決策**: 環境変数 `LOG_LEVEL` を `debug` に設定してください。

```typescript
// Lambda環境変数
LOG_LEVEL=debug
```

### スタックトレースが表示されない

**原因**: エラーオブジェクトが正しく渡されていない可能性があります。

**解決策**: `error as Error` でキャストしてください。

```typescript
catch (error) {
  logLambdaError('Operation failed', error as Error, context);
}
```

### CloudWatch Logsでログが見つからない

**原因**: Lambda実行ロールにCloudWatch Logsへの書き込み権限がない可能性があります。

**解決策**: Lambda実行ロールに `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` 権限を付与してください。

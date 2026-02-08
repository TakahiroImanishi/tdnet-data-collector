---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts|**/routes/**/*.ts'
---

# API Error Codes

TDnet Data Collector APIのエラーコード標準と実装ガイドライン。

## エラーコード一覧

| コード | HTTPステータス | 使用場面 |
|--------|---------------|---------|
| VALIDATION_ERROR | 400 | 不正な入力値、日付形式エラー、範囲外の値 |
| UNAUTHORIZED | 401 | APIキー未提供、無効なAPIキー |
| FORBIDDEN | 403 | アクセス権限なし |
| NOT_FOUND | 404 | 開示情報ID不存在、エクスポートID不存在 |
| CONFLICT | 409 | 重複する開示情報ID、同時更新の競合 |
| RATE_LIMIT_EXCEEDED | 429 | API呼び出し回数超過、TDnetレート制限 |
| INTERNAL_ERROR | 500 | 予期しないエラー、システムエラー |
| SERVICE_UNAVAILABLE | 503 | DynamoDB/S3一時的障害、メンテナンス中 |
| GATEWAY_TIMEOUT | 504 | Lambda実行タイムアウト、外部API応答なし |

## エラーレスポンス形式

```typescript
interface ErrorResponse {
    status: 'error';
    error: {
        code: string;           // エラーコード（例: "VALIDATION_ERROR"）
        message: string;        // エラーメッセージ
        details?: any;          // 追加の詳細情報（オプション）
    };
    request_id: string;         // リクエストID（トレーシング用）
}
```

**例:**
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": {
      "field": "start_date",
      "value": "2024/01/15",
      "expected": "YYYY-MM-DD"
    }
  },
  "request_id": "req-abc123"
}
```

## カスタムエラークラス

### VALIDATION_ERROR (400)

```typescript
class ValidationError extends Error {
    constructor(
        message: string,
        public readonly field: string,
        public readonly value: any,
        public readonly expected?: string
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}

// 使用例
if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new ValidationError('Invalid date format', 'start_date', startDate, 'YYYY-MM-DD');
}
```

### UNAUTHORIZED (401)

```typescript
class UnauthorizedError extends Error {
    constructor(message: string, public readonly reason?: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

// 使用例
const apiKey = event.headers['X-API-Key'] || event.headers['x-api-key'];
if (!apiKey || apiKey !== process.env.API_KEY) {
    throw new UnauthorizedError('Invalid API key', 'invalid_api_key');
}
```

### NOT_FOUND (404)

```typescript
class NotFoundError extends Error {
    constructor(
        message: string,
        public readonly resourceType: string,
        public readonly resourceId: string
    ) {
        super(message);
        this.name = 'NotFoundError';
    }
}

// 使用例
const disclosure = await getDisclosureById(disclosureId);
if (!disclosure) {
    throw new NotFoundError('Disclosure not found', 'disclosure', disclosureId);
}
```

### CONFLICT (409)

```typescript
class ConflictError extends Error {
    constructor(
        message: string,
        public readonly conflictType: string,
        public readonly existingId?: string
    ) {
        super(message);
        this.name = 'ConflictError';
    }
}

// 使用例（DynamoDB条件付き書き込み）
try {
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: disclosure,
        ConditionExpression: 'attribute_not_exists(disclosure_id)',
    }));
} catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
        throw new ConflictError('Disclosure already exists', 'duplicate_disclosure_id', disclosure.disclosure_id);
    }
    throw error;
}
```

### RATE_LIMIT_EXCEEDED (429)

```typescript
class RateLimitError extends Error {
    constructor(
        message: string,
        public readonly limit: number,
        public readonly resetAt: Date
    ) {
        super(message);
        this.name = 'RateLimitError';
    }
}

// 使用例
if (requestCount > RATE_LIMIT) {
    throw new RateLimitError('Rate limit exceeded', RATE_LIMIT, new Date(Date.now() + 60000));
}
```

### INTERNAL_ERROR (500)

```typescript
class InternalError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'InternalError';
    }
}

// 使用例
try {
    // 処理
} catch (error) {
    logger.error('Unexpected error', { error });
    throw new InternalError('An unexpected error occurred', error as Error);
}
```

### SERVICE_UNAVAILABLE (503)

```typescript
class ServiceUnavailableError extends Error {
    constructor(
        message: string,
        public readonly service: string,
        public readonly retryAfter?: number
    ) {
        super(message);
        this.name = 'ServiceUnavailableError';
    }
}

// 使用例
try {
    await docClient.send(command);
} catch (error) {
    if (error.name === 'ServiceUnavailable') {
        throw new ServiceUnavailableError('DynamoDB is temporarily unavailable', 'dynamodb', 60);
    }
    throw error;
}
```

### GATEWAY_TIMEOUT (504)

```typescript
class GatewayTimeoutError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly timeout: number
    ) {
        super(message);
        this.name = 'GatewayTimeoutError';
    }
}

// 使用例
try {
    await withTimeout(downloadPDF(url), 30000, 'PDF download timed out');
} catch (error) {
    if (error.message.includes('timed out')) {
        throw new GatewayTimeoutError('PDF download timed out', 'pdf_download', 30000);
    }
    throw error;
}
```

## エラーコード変換

Lambda関数内でカスタムエラーをHTTPステータスコードに変換：

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';

const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'ForbiddenError': { statusCode: 403, code: 'FORBIDDEN' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    'ConflictError': { statusCode: 409, code: 'CONFLICT' },
    'RateLimitError': { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
    'InternalError': { statusCode: 500, code: 'INTERNAL_ERROR' },
    'ServiceUnavailableError': { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
    'GatewayTimeoutError': { statusCode: 504, code: 'GATEWAY_TIMEOUT' },
};

function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
    };
    
    return {
        statusCode: mapping.statusCode,
        body: JSON.stringify({
            status: 'error',
            error: {
                code: mapping.code,
                message: error.message,
                details: (error as any).details || {},
            },
            request_id: requestId,
        }),
    };
}
```

## Lambda関数での実装例

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger } from './utils/logger';
import { toErrorResponse } from './utils/error-handler';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        // ビジネスロジック
        const result = await processRequest(event);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'success',
                data: result,
            }),
        };
    } catch (error) {
        logger.error('Lambda execution failed', {
            event,
            requestId: context.requestId,
            error: error.message,
            stack: error.stack,
        });
        
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

## ベストプラクティス

1. **カスタムエラークラスを使用**: 各エラータイプに対応するカスタムエラークラスを定義
2. **エラー変換関数を共通化**: `toErrorResponse()` 関数をユーティリティとして共有
3. **ログ記録を統一**: すべてのエラーで同じログ形式を使用
4. **ドキュメント更新**: 新しいエラーコードを追加した場合は、このドキュメントとOpenAPI仕様を更新

## 関連ドキュメント

- **エラーハンドリング基本原則**: `../core/error-handling-patterns.md` - エラー分類と再試行戦略
- **API設計ガイドライン**: `api-design-guidelines.md` - APIエラーレスポンス形式

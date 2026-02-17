---
inclusion: fileMatch
fileMatchPattern: '**/api/**/errors/**/*.ts|**/api/**/error-codes.ts|**/errors/**/*.ts'
---

# API Error Codes

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
        code: string;
        message: string;
        details?: any;
    };
    request_id: string;
}
```

## カスタムエラークラス

```typescript
class ValidationError extends Error {
    constructor(message: string, public readonly field: string, public readonly value: any) {
        super(message);
        this.name = 'ValidationError';
    }
}

class NotFoundError extends Error {
    constructor(message: string, public readonly resourceType: string, public readonly resourceId: string) {
        super(message);
        this.name = 'NotFoundError';
    }
}
```

## エラーコード変換

| エラークラス名 | HTTPステータス | エラーコード |
|--------------|---------------|-------------|
| ValidationError | 400 | VALIDATION_ERROR |
| UnauthorizedError | 401 | UNAUTHORIZED |
| ForbiddenError | 403 | FORBIDDEN |
| NotFoundError | 404 | NOT_FOUND |
| ConflictError | 409 | CONFLICT |
| RateLimitError | 429 | RATE_LIMIT_EXCEEDED |
| InternalError | 500 | INTERNAL_ERROR |
| ServiceUnavailableError | 503 | SERVICE_UNAVAILABLE |
| GatewayTimeoutError | 504 | GATEWAY_TIMEOUT |

```typescript
const ERROR_CODE_MAP: Record<string, { statusCode: number; code: string }> = {
    'ValidationError': { statusCode: 400, code: 'VALIDATION_ERROR' },
    'UnauthorizedError': { statusCode: 401, code: 'UNAUTHORIZED' },
    'NotFoundError': { statusCode: 404, code: 'NOT_FOUND' },
    // ... 他のマッピング
};

function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || { statusCode: 500, code: 'INTERNAL_ERROR' };
    return {
        statusCode: mapping.statusCode,
        body: JSON.stringify({
            status: 'error',
            error: { code: mapping.code, message: error.message, details: (error as any).details || {} },
            request_id: requestId,
        }),
    };
}
```

## 関連ドキュメント

- **エラーハンドリング基本原則**: `../core/error-handling-patterns.md`
- **API設計ガイドライン**: `api-design-guidelines.md`

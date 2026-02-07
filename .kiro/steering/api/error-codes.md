---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts|**/routes/**/*.ts'
---

# API Error Codes

このファイルは、TDnet Data Collector APIで使用するエラーコードの標準化と実装ガイドラインをまとめたものです。

## エラーコード一覧

| コード | HTTPステータス | 説明 | 使用場面 |
|--------|---------------|------|---------|
| VALIDATION_ERROR | 400 | バリデーションエラー | 不正な入力値、日付形式エラー、範囲外の値 |
| UNAUTHORIZED | 401 | 認証エラー | APIキー未提供、無効なAPIキー |
| FORBIDDEN | 403 | 権限エラー | アクセス権限なし、リソースへのアクセス拒否 |
| NOT_FOUND | 404 | リソース不存在 | 開示情報ID不存在、エクスポートID不存在 |
| CONFLICT | 409 | リソース競合 | 重複する開示情報ID、同時更新の競合 |
| RATE_LIMIT_EXCEEDED | 429 | レート制限超過 | API呼び出し回数超過、TDnetレート制限 |
| INTERNAL_ERROR | 500 | 内部エラー | 予期しないエラー、システムエラー |
| SERVICE_UNAVAILABLE | 503 | サービス利用不可 | DynamoDB/S3一時的障害、メンテナンス中 |
| GATEWAY_TIMEOUT | 504 | ゲートウェイタイムアウト | Lambda実行タイムアウト、外部API応答なし |

## エラーコード使用ガイドライン

### VALIDATION_ERROR (400)

**使用場面:**
- 日付形式が不正（例: "2024/01/15" instead of "2024-01-15"）
- 企業コードが4桁でない
- start_dateがend_dateより後
- limitが範囲外（< 1 or > 100）

**実装例:**
```typescript
import { ValidationError } from './errors';

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
    throw new ValidationError(
        'Invalid date format',
        'start_date',
        startDate,
        'YYYY-MM-DD'
    );
}
```

**レスポンス例:**
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

### UNAUTHORIZED (401)

**使用場面:**
- X-API-Keyヘッダーが未提供
- APIキーが無効
- APIキーの有効期限切れ

**実装例:**
```typescript
import { UnauthorizedError } from './errors';

class UnauthorizedError extends Error {
    constructor(message: string, public readonly reason?: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

// 使用例
const apiKey = event.headers['X-API-Key'] || event.headers['x-api-key'];
if (!apiKey) {
    throw new UnauthorizedError('API key is required', 'missing_api_key');
}

if (apiKey !== process.env.API_KEY) {
    throw new UnauthorizedError('Invalid API key', 'invalid_api_key');
}
```

### NOT_FOUND (404)

**使用場面:**
- 開示情報IDが存在しない
- エクスポートIDが存在しない
- 実行IDが存在しない

**実装例:**
```typescript
import { NotFoundError } from './errors';

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
    throw new NotFoundError(
        'Disclosure not found',
        'disclosure',
        disclosureId
    );
}
```

### CONFLICT (409)

**使用場面:**
- 重複する開示情報IDの登録試行
- 同時更新による競合

**実装例:**
```typescript
import { ConflictError } from './errors';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

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

// 使用例
try {
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: disclosure,
        ConditionExpression: 'attribute_not_exists(disclosure_id)',
    }));
} catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
        throw new ConflictError(
            'Disclosure already exists',
            'duplicate_disclosure_id',
            disclosure.disclosure_id
        );
    }
    throw error;
}
```

### RATE_LIMIT_EXCEEDED (429)

**使用場面:**
- API Gateway使用量プラン超過
- TDnetへのリクエスト頻度超過

**実装例:**
```typescript
import { RateLimitError } from './errors';

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
    throw new RateLimitError(
        'Rate limit exceeded',
        RATE_LIMIT,
        new Date(Date.now() + 60000) // 1分後
    );
}
```

### INTERNAL_ERROR (500)

**使用場面:**
- 予期しないエラー
- システムエラー
- プログラミングエラー

**実装例:**
```typescript
import { InternalError } from './errors';
import { logger } from './logger';

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
    throw new InternalError(
        'An unexpected error occurred',
        error as Error
    );
}
```

### SERVICE_UNAVAILABLE (503)

**使用場面:**
- DynamoDB一時的障害
- S3一時的障害
- メンテナンス中

**実装例:**
```typescript
import { ServiceUnavailableError } from './errors';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

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
        throw new ServiceUnavailableError(
            'DynamoDB is temporarily unavailable',
            'dynamodb',
            60 // 60秒後に再試行
        );
    }
    throw error;
}
```

### GATEWAY_TIMEOUT (504)

**使用場面:**
- Lambda実行タイムアウト（15分超過）
- TDnetへのリクエストタイムアウト

**実装例:**
```typescript
import { GatewayTimeoutError } from './errors';
import { withTimeout } from './timeout';

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
    await withTimeout(
        downloadPDF(url),
        30000,
        'PDF download timed out'
    );
} catch (error) {
    if (error.message.includes('timed out')) {
        throw new GatewayTimeoutError(
            'PDF download timed out',
            'pdf_download',
            30000
        );
    }
    throw error;
}
```

## エラーコード変換マップ

Lambda関数内でカスタムエラーをHTTPステータスコードに変換する際の参照表：

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

## エラーレスポンス形式

すべてのAPIエラーレスポンスは以下の形式に従ってください：

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

## エラーコード使用の一貫性

**重要:** すべてのLambda関数で同じエラーコードとレスポンス形式を使用してください。

### ベストプラクティス

1. **カスタムエラークラスを使用**
   - 各エラータイプに対応するカスタムエラークラスを定義
   - エラークラス名とエラーコードを一致させる

2. **エラー変換関数を共通化**
   - `toErrorResponse()` 関数をユーティリティとして共有
   - すべてのLambda関数で同じ変換ロジックを使用

3. **ログ記録を統一**
   - すべてのエラーで同じログ形式を使用
   - エラーコード、メッセージ、コンテキストを含める

4. **ドキュメント更新**
   - 新しいエラーコードを追加した場合は、このドキュメントを更新
   - OpenAPI仕様（`openapi.yaml`）も更新

### Lambda関数での実装例

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

## 関連ドキュメント

- **エラーハンドリング基本**: `../core/error-handling-patterns.md` - エラー分類と基本原則
- **詳細実装**: `../development/error-handling-implementation.md` - 再試行戦略、ログ構造の詳細
- **API設計**: `api-design-guidelines.md` - APIレスポンス形式の詳細
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - エラーアラートの設定

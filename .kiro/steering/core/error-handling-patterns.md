# Error Handling Patterns

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングのパターンとベストプラクティスをまとめたものです。

## エラー分類

### Retryable Errors（再試行可能なエラー）

以下のエラーは一時的な問題である可能性が高いため、再試行すべきです：

- **ネットワークエラー**: ECONNRESET, ETIMEDOUT, ENOTFOUND
- **HTTPタイムアウト**: リクエストタイムアウト、レスポンスタイムアウト
- **5xxエラー**: 500 Internal Server Error, 503 Service Unavailable
- **AWS一時的エラー**: ThrottlingException, ServiceUnavailable
- **レート制限**: 429 Too Many Requests

### Non-Retryable Errors（再試行不可能なエラー）

以下のエラーは再試行しても解決しないため、即座に失敗として扱うべきです：

- **認証エラー**: 401 Unauthorized, 403 Forbidden
- **リソース不存在**: 404 Not Found
- **バリデーションエラー**: 400 Bad Request
- **設定エラー**: 環境変数未設定、不正な設定値
- **データ整合性エラー**: 重複キー、外部キー制約違反

### Partial Failure（部分的失敗）

一部の処理が成功し、一部が失敗した場合：

- 成功した処理はコミット
- 失敗した処理はログに記録
- 全体としては警告レベルで完了
- 失敗した項目のリストを返却

## 再試行戦略

### 指数バックオフ（Exponential Backoff）

**完全な実装:**

```typescript
interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    jitter?: boolean;
}

class RetryableError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'RetryableError';
    }
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 60000,
        backoffMultiplier = 2,
        jitter = true,
    } = options;
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // 再試行不可能なエラーは即座に失敗
            if (!(error instanceof RetryableError)) {
                throw error;
            }
            
            // 最後の試行で失敗した場合
            if (attempt === maxRetries) {
                logger.error('Max retries exceeded', {
                    attempts: attempt + 1,
                    error: lastError.message,
                });
                throw lastError;
            }
            
            // 待機時間を計算（指数バックオフ）
            let delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt),
                maxDelay
            );
            
            // ジッター追加（ランダム性）
            if (jitter) {
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            logger.warn('Retrying after error', {
                attempt: attempt + 1,
                maxRetries,
                delay,
                error: lastError.message,
            });
            
            await sleep(delay);
        }
    }
    
    throw lastError!;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 使用例
async function downloadPDFWithRetry(url: string): Promise<Buffer> {
    return retryWithBackoff(
        async () => {
            try {
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                });
                return Buffer.from(response.data);
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    // 再試行可能なエラー
                    if (
                        error.code === 'ECONNRESET' ||
                        error.code === 'ETIMEDOUT' ||
                        error.response?.status === 503 ||
                        error.response?.status === 429
                    ) {
                        throw new RetryableError(
                            `Retryable error: ${error.message}`,
                            error
                        );
                    }
                    
                    // 再試行不可能なエラー
                    if (error.response?.status === 404) {
                        throw new Error('PDF not found');
                    }
                }
                throw error;
            }
        },
        {
            maxRetries: 3,
            initialDelay: 2000,
            maxDelay: 30000,
            backoffMultiplier: 2,
            jitter: true,
        }
    );
}
```

### AWS SDK自動再試行の設定

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

// DynamoDBクライアントの再試行設定
const dynamoClient = new DynamoDBClient({
    region: 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive', // adaptive, standard, legacy
});

// S3クライアントの再試行設定
const s3Client = new S3Client({
    region: 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive',
});

// カスタム再試行戦略
import { ConfiguredRetryStrategy } from '@aws-sdk/util-retry';

const customRetryStrategy = new ConfiguredRetryStrategy(
    3, // maxAttempts
    (attempt: number) => {
        // カスタムバックオフ計算
        return Math.min(1000 * Math.pow(2, attempt), 20000);
    }
);

const dynamoClientWithCustomRetry = new DynamoDBClient({
    region: 'ap-northeast-1',
    retryStrategy: customRetryStrategy,
});
```

### エラー分類ヘルパー

```typescript
function isRetryableError(error: any): boolean {
    // ネットワークエラー
    if (error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT' || 
        error.code === 'ENOTFOUND') {
        return true;
    }
    
    // HTTPステータスコード
    if (error.response?.status) {
        const status = error.response.status;
        return status === 429 || status === 503 || status >= 500;
    }
    
    // AWS SDKエラー
    if (error.name === 'ThrottlingException' ||
        error.name === 'ProvisionedThroughputExceededException' ||
        error.name === 'ServiceUnavailable') {
        return true;
    }
    
    return false;
}

// 使用例
async function processWithSmartRetry<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
): Promise<T> {
    return retryWithBackoff(
        async () => {
            try {
                return await fn();
            } catch (error) {
                if (isRetryableError(error)) {
                    throw new RetryableError(
                        `Retryable error: ${error.message}`,
                        error
                    );
                }
                throw error;
            }
        },
        options
    );
}
```

### サーキットブレーカーパターン

連続して失敗が続く場合、一定期間リクエストを停止：

```typescript
class CircuitBreaker {
    private failureCount = 0;
    private lastFailureTime: number | null = null;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private threshold: number = 5,
        private timeout: number = 60000
    ) {}
    
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime! > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('Circuit breaker is OPEN');
            }
        }
        
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }
    
    private onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    
    private onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.threshold) {
            this.state = 'OPEN';
            logger.error('Circuit breaker opened', {
                failureCount: this.failureCount,
                threshold: this.threshold,
            });
        }
    }
}
```

## エラーログ構造

### 標準エラーログフォーマット

```typescript
interface ErrorLog {
    level: 'error' | 'warn';
    timestamp: string; // ISO8601
    error_type: string;
    error_message: string;
    error_code?: string;
    context: {
        disclosure_id?: string;
        company_code?: string;
        retry_count?: number;
        execution_id?: string;
        [key: string]: any;
    };
    stack_trace?: string;
}

// 使用例
logger.error('Failed to download PDF', {
    error_type: 'NetworkError',
    error_message: error.message,
    error_code: error.code,
    context: {
        disclosure_id: 'TD20240115001',
        company_code: '7203',
        retry_count: 2,
        execution_id: context.requestId,
        pdf_url: 'https://...',
    },
    stack_trace: error.stack,
});
```

### エラー集約とアラート

```typescript
class ErrorAggregator {
    private errorCounts = new Map<string, number>();
    
    recordError(errorType: string) {
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
        
        // 閾値を超えたらアラート
        if (count + 1 >= 10) {
            this.sendAlert(errorType, count + 1);
        }
    }
    
    private async sendAlert(errorType: string, count: number) {
        // SNS経由でアラート送信
        await sns.publish({
            TopicArn: process.env.ALERT_TOPIC_ARN,
            Subject: `High error rate detected: ${errorType}`,
            Message: JSON.stringify({
                error_type: errorType,
                count,
                timestamp: new Date().toISOString(),
            }),
        });
    }
}
```

## エラーハンドリングのベストプラクティス

### 1. エラーの適切な伝播

```typescript
// ❌ 悪い例: エラーを握りつぶす
try {
    await downloadPDF(url);
} catch (error) {
    console.log('Error occurred');
    // エラーが失われる
}

// ✅ 良い例: エラーを適切に伝播
try {
    await downloadPDF(url);
} catch (error) {
    logger.error('Failed to download PDF', { url, error });
    throw new DownloadError('PDF download failed', { cause: error });
}
```

### 2. カスタムエラークラスの使用

```typescript
class RetryableError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'RetryableError';
    }
}

class ValidationError extends Error {
    constructor(message: string, public readonly field: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

class DownloadError extends Error {
    constructor(message: string, public readonly url: string, options?: { cause?: Error }) {
        super(message);
        this.name = 'DownloadError';
        this.cause = options?.cause;
    }
}
```

### 3. エラーコンテキストの保持

```typescript
async function processDisclosure(disclosure: Disclosure) {
    const context = {
        disclosure_id: disclosure.disclosure_id,
        company_code: disclosure.company_code,
        execution_id: crypto.randomUUID(),
    };
    
    try {
        logger.info('Processing disclosure', context);
        
        const pdf = await downloadPDF(disclosure.pdf_url);
        await savePDF(pdf, disclosure.pdf_s3_key);
        await saveMetadata(disclosure);
        
        logger.info('Successfully processed disclosure', context);
    } catch (error) {
        logger.error('Failed to process disclosure', {
            ...context,
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
}
```

### 4. Graceful Degradation（段階的機能低下）

```typescript
async function collectDisclosures(date: string): Promise<CollectionResult> {
    const disclosures = await scrapeDisclosureList(date);
    const results = {
        collected: 0,
        failed: 0,
        errors: [] as string[],
    };
    
    for (const disclosure of disclosures) {
        try {
            await processDisclosure(disclosure);
            results.collected++;
        } catch (error) {
            // 個別の失敗は記録するが、処理は継続
            results.failed++;
            results.errors.push(`${disclosure.disclosure_id}: ${error.message}`);
            logger.error('Failed to process disclosure', {
                disclosure_id: disclosure.disclosure_id,
                error,
            });
        }
    }
    
    // 一部失敗しても、成功した分は返す
    return results;
}
```

### 5. タイムアウトの設定

```typescript
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
}

// 使用例
const pdf = await withTimeout(
    downloadPDF(url),
    30000,
    'PDF download timed out after 30 seconds'
);
```

## Lambda固有のエラーハンドリング

### Lambda関数のエラーレスポンス

```typescript
export const handler = async (event: any, context: Context): Promise<any> => {
    try {
        const result = await processEvent(event);
        
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
        
        // エラーの種類に応じて適切なステータスコードを返す
        if (error instanceof ValidationError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    status: 'error',
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: error.message,
                    },
                }),
            };
        }
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                status: 'error',
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                    request_id: context.requestId,
                },
            }),
        };
    }
};
```

### Dead Letter Queue（DLQ）の活用

```typescript
// CDKでDLQを設定
const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
});

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    // ...
    deadLetterQueue: dlq,
    deadLetterQueueEnabled: true,
});

// DLQからのメッセージを処理する別のLambda
const dlqProcessorFn = new lambda.Function(this, 'DLQProcessor', {
    // ...
});

dlq.grantConsumeMessages(dlqProcessorFn);
```

## まとめ

- エラーは適切に分類し、再試行可能かどうかを判断する
- 指数バックオフとジッターで再試行を実装
- エラーログは構造化し、十分なコンテキストを含める
- 部分的な失敗を許容し、Graceful Degradationを実装
- カスタムエラークラスでエラーの種類を明確にする
- タイムアウトを適切に設定し、無限待機を避ける


## エラーコード標準化

### エラーコード一覧

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

### エラーコード使用ガイドライン

#### VALIDATION_ERROR (400)

**使用場面:**
- 日付形式が不正（例: "2024/01/15" instead of "2024-01-15"）
- 企業コードが4桁でない
- start_dateがend_dateより後
- limitが範囲外（< 1 or > 100）

**実装例:**
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

#### UNAUTHORIZED (401)

**使用場面:**
- X-API-Keyヘッダーが未提供
- APIキーが無効
- APIキーの有効期限切れ

**実装例:**
```typescript
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

#### NOT_FOUND (404)

**使用場面:**
- 開示情報IDが存在しない
- エクスポートIDが存在しない
- 実行IDが存在しない

**実装例:**
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
    throw new NotFoundError(
        'Disclosure not found',
        'disclosure',
        disclosureId
    );
}
```

#### CONFLICT (409)

**使用場面:**
- 重複する開示情報IDの登録試行
- 同時更新による競合

**実装例:**
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

#### RATE_LIMIT_EXCEEDED (429)

**使用場面:**
- API Gateway使用量プラン超過
- TDnetへのリクエスト頻度超過

**実装例:**
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
    throw new RateLimitError(
        'Rate limit exceeded',
        RATE_LIMIT,
        new Date(Date.now() + 60000) // 1分後
    );
}
```

#### INTERNAL_ERROR (500)

**使用場面:**
- 予期しないエラー
- システムエラー
- プログラミングエラー

**実装例:**
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
    throw new InternalError(
        'An unexpected error occurred',
        error as Error
    );
}
```

#### SERVICE_UNAVAILABLE (503)

**使用場面:**
- DynamoDB一時的障害
- S3一時的障害
- メンテナンス中

**実装例:**
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
        throw new ServiceUnavailableError(
            'DynamoDB is temporarily unavailable',
            'dynamodb',
            60 // 60秒後に再試行
        );
    }
    throw error;
}
```

#### GATEWAY_TIMEOUT (504)

**使用場面:**
- Lambda実行タイムアウト（15分超過）
- TDnetへのリクエストタイムアウト

**実装例:**
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

### エラーコード変換マップ

Lambda関数内でカスタムエラーをHTTPステータスコードに変換する際の参照表：

```typescript
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

### エラーコード使用の一貫性

**重要:** すべてのLambda関数で同じエラーコードとレスポンス形式を使用してください。

1. **カスタムエラークラスを使用**: 各エラータイプに対応するカスタムエラークラスを定義
2. **エラー変換関数を共通化**: `toErrorResponse()` 関数をユーティリティとして共有
3. **ログ記録を統一**: すべてのエラーで同じログ形式を使用
4. **ドキュメント更新**: 新しいエラーコードを追加した場合は、このドキュメントとOpenAPI仕様を更新

## 関連ドキュメント

- **API設計**: `api-design-guidelines.md` - APIエラーレスポンスの詳細
- **実装ルール**: `tdnet-implementation-rules.md` - エラーハンドリングの基本原則
- **監視とアラート**: `monitoring-alerts.md` - エラーアラートの設定
- **テスト戦略**: `testing-strategy.md` - エラーケースのテスト

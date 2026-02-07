---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/!(*.test|*.spec).ts'
---

# Lambda実装ガイド

このファイルは、TDnet Data CollectorプロジェクトにおけるLambda関数の実装ガイドラインをまとめたものです。

**適用範囲:** `**/lambda/**/*.ts` - Lambda関数フォルダ内のすべてのTypeScriptファイル

**統合方針:** このsteeringファイルは、Lambda関数に関するすべての実装ガイドラインを統合しています。エラーハンドリング、パフォーマンス最適化、環境変数の使用など、Lambda関数開発に必要なすべての情報を提供します。

## 目次

1. [Lambda関数の基本構造](#lambda関数の基本構造)
2. [メモリとタイムアウトの設定](#メモリとタイムアウトの設定)
3. [環境変数の使用](#環境変数の使用)
4. [エラーハンドリング](#エラーハンドリング)
5. [パフォーマンス最適化](#パフォーマンス最適化)
6. [ベストプラクティス](#ベストプラクティス)

---

## Lambda関数の基本構造

### ファイル構成

```
src/lambda/{function-name}/
├── index.ts                 # エントリーポイント
├── handler.ts               # ハンドラー実装
├── types.ts                 # 型定義
└── {function-name}.test.ts  # テスト
```

### エントリーポイント（index.ts）

```typescript
export { handler } from './handler';
```

### ハンドラー実装（handler.ts）

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { toErrorResponse } from '../../utils/error-response';
import { logger } from '../../utils/logger';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        logger.info('Lambda invoked', {
            requestId: context.requestId,
            functionName: context.functionName,
        });
        
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
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

async function processEvent(event: APIGatewayProxyEvent): Promise<any> {
    // ビジネスロジックの実装
    return {};
}
```

---

## メモリとタイムアウトの設定

### 推奨設定

| 関数タイプ | メモリ | タイムアウト | 理由 |
|-----------|--------|------------|------|
| Collector（スクレイピング） | 512MB | 15分 | ネットワークI/O待機が多い |
| Parser（PDF解析） | 1024MB | 5分 | CPU集約的 |
| Query（API） | 256MB | 30秒 | 軽量なデータ取得 |
| Export（大量データ） | 1024MB | 15分 | メモリ集約的 |

### CDK実装例

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

// Collector関数
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    entry: 'src/lambda/collector/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    environment: {
        NODE_OPTIONS: '--enable-source-maps',
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
        LOG_LEVEL: 'info',
    },
    bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        externalModules: ['@aws-sdk/*'], // AWS SDKは含めない
    },
});

// Parser関数（CPU集約的）
const parserFn = new NodejsFunction(this, 'ParserFunction', {
    entry: 'src/lambda/parser/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.minutes(5),
    memorySize: 1024, // CPU性能向上のため
    reservedConcurrentExecutions: 5, // 同時実行数制限
});

// Query関数（軽量）
const queryFn = new NodejsFunction(this, 'QueryFunction', {
    entry: 'src/lambda/query/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.seconds(30),
    memorySize: 256,
});
```

---

## 環境変数の使用

### 必須環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| S3_BUCKET_NAME | PDFファイル保存先S3バケット名 | `tdnet-pdfs-prod` |
| DYNAMODB_TABLE_NAME | 開示情報メタデータテーブル名 | `tdnet-disclosures` |
| ALERT_TOPIC_ARN | エラーアラート送信先SNSトピックARN | `arn:aws:sns:...` |
| LOG_LEVEL | ログレベル | `info` / `debug` / `warn` / `error` |

### 環境変数の検証

```typescript
// config.ts
interface Config {
    s3BucketName: string;
    dynamoTableName: string;
    alertTopicArn: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function loadConfig(): Config {
    const required = [
        'S3_BUCKET_NAME',
        'DYNAMODB_TABLE_NAME',
        'ALERT_TOPIC_ARN',
    ];
    
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
    }
    
    return {
        s3BucketName: process.env.S3_BUCKET_NAME!,
        dynamoTableName: process.env.DYNAMODB_TABLE_NAME!,
        alertTopicArn: process.env.ALERT_TOPIC_ARN!,
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
    };
}

export const config = loadConfig();
```

### CDKでの環境変数設定

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    environment: {
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
        SCRAPING_RATE_LIMIT: '2',
        SCRAPING_MAX_RETRIES: '3',
        SCRAPING_TIMEOUT: '30000',
    },
});
```

---

## エラーハンドリング

### 基本パターン

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { toErrorResponse } from '../../utils/error-response';

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    try {
        const result = await processEvent(event);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
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

### エラーレスポンス変換

**ファイル配置:** `src/utils/error-response.ts`

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

export function toErrorResponse(error: Error, requestId: string): APIGatewayProxyResult {
    const mapping = ERROR_CODE_MAP[error.name] || {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
    };
    
    return {
        statusCode: mapping.statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
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

### Dead Letter Queue（DLQ）

Lambda関数の非同期呼び出しで失敗したメッセージをDLQに送信し、別のLambda関数で処理します。

**CDKでの基本設定:**

```typescript
import * as sqs from 'aws-cdk-lib/aws-sqs';

// DLQの作成
const dlq = new sqs.Queue(this, 'CollectorDLQ', {
    queueName: 'tdnet-collector-dlq',
    retentionPeriod: cdk.Duration.days(14),
});

// Lambda関数にDLQを設定
const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    // ...
    deadLetterQueue: dlq,
    deadLetterQueueEnabled: true,
    retryAttempts: 2, // Lambda非同期呼び出しの再試行回数
});
```

**詳細な実装については `error-handling-implementation.md` を参照してください:**
- 完全なDLQ設定（CDK）
- DLQプロセッサーLambdaの実装
- アラート送信の実装

---

## パフォーマンス最適化

### コールドスタート対策

#### 1. 依存関係の最小化

```typescript
// ❌ 悪い例: 不要な依存関係
import * as AWS from 'aws-sdk'; // 全体をインポート
import _ from 'lodash'; // 全体をインポート

// ✅ 良い例: 必要な部分のみ
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import pick from 'lodash/pick'; // 個別関数のみ
```

#### 2. 初期化の最適化

```typescript
// グローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    },
});

const s3Client = new S3Client({ region: 'ap-northeast-1' });

// 環境変数も事前に読み込み
const config = {
    tableName: process.env.DYNAMODB_TABLE_NAME!,
    bucketName: process.env.S3_BUCKET_NAME!,
};

export const handler = async (event: any): Promise<any> => {
    // ハンドラー内では初期化済みのクライアントを使用
    const result = await docClient.send(new GetCommand({
        TableName: config.tableName,
        Key: { disclosure_id: event.id },
    }));
    
    return result.Item;
};
```

#### 3. Provisioned Concurrency（本番環境のみ）

```typescript
// 本番環境のみ
if (props.environment === 'prod') {
    const version = collectorFn.currentVersion;
    const alias = new lambda.Alias(this, 'CollectorAlias', {
        aliasName: 'live',
        version,
        provisionedConcurrentExecutions: 2, // 常時2インスタンス
    });
}
```

### バンドルサイズの最適化

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2022',
        externalModules: [
            '@aws-sdk/*', // AWS SDK v3は含めない（Lambdaランタイムに含まれる）
        ],
        nodeModules: [
            'cheerio', // 必要なモジュールのみ
            'axios',
        ],
        banner: '#!/usr/bin/env node',
        charset: 'utf8',
        mainFields: ['module', 'main'],
        conditions: ['import', 'require', 'node'],
        loader: {
            '.node': 'file',
        },
        logLevel: 'warning',
        keepNames: true,
        tsconfig: 'tsconfig.json',
    },
});
```

### Lambda内メモリキャッシュ

```typescript
// グローバルスコープでキャッシュ（Lambda実行間で共有）
const cache = new Map<string, { data: any; expires: number }>();

function getCached<T>(key: string): T | null {
    const cached = cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
        cache.delete(key);
        return null;
    }
    
    return cached.data as T;
}

function setCache<T>(key: string, data: T, ttlSeconds: number = 300): void {
    cache.set(key, {
        data,
        expires: Date.now() + ttlSeconds * 1000,
    });
}

// 使用例
export const handler = async (event: any): Promise<any> => {
    const cacheKey = `disclosure:${event.id}`;
    
    // キャッシュチェック
    let disclosure = getCached<Disclosure>(cacheKey);
    
    if (!disclosure) {
        // キャッシュミス: DBから取得
        disclosure = await getDisclosureFromDB(event.id);
        setCache(cacheKey, disclosure, 300); // 5分キャッシュ
    }
    
    return disclosure;
};
```

---

## ベストプラクティス

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

### 2. エラーコンテキストの保持

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

### 3. タイムアウトの設定

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

### 4. 並行処理の制御

```typescript
import pLimit from 'p-limit';

async function processDisclosuresWithLimit(
    disclosures: Disclosure[],
    concurrency: number = 5
): Promise<void> {
    const limit = pLimit(concurrency);
    
    const promises = disclosures.map(disclosure =>
        limit(() => processDisclosure(disclosure))
    );
    
    await Promise.allSettled(promises);
}

// 使用例
await processDisclosuresWithLimit(disclosures, 5); // 最大5並行
```

### 5. X-Rayでのパフォーマンス分析

```typescript
import AWSXRay from 'aws-xray-sdk-core';

// AWS SDKをラップ
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

// カスタムセグメント
async function processWithTracing(disclosure: Disclosure): Promise<void> {
    const segment = AWSXRay.getSegment();
    
    // スクレイピング
    const scrapeSegment = segment?.addNewSubsegment('Scraping');
    scrapeSegment?.addAnnotation('company_code', disclosure.company_code);
    const html = await scrapeDisclosureList(disclosure.disclosed_at);
    scrapeSegment?.close();
    
    // PDF ダウンロード
    const downloadSegment = segment?.addNewSubsegment('PDF Download');
    const pdf = await downloadPDF(disclosure.pdf_url);
    downloadSegment?.addMetadata('file_size', pdf.length);
    downloadSegment?.close();
    
    // DynamoDB 保存
    const dbSegment = segment?.addNewSubsegment('DynamoDB Save');
    await saveDisclosure(disclosure);
    dbSegment?.close();
}
```

---

## まとめ

### Lambda実装チェックリスト

- [ ] ファイル構成は標準構造に従っているか（index.ts, handler.ts, types.ts）
- [ ] 必須環境変数は検証されているか
- [ ] エラーハンドリングは適切に実装されているか
- [ ] DLQは設定されているか
- [ ] メモリとタイムアウトは適切に設定されているか
- [ ] コールドスタート対策は実施されているか
- [ ] バンドルサイズは最適化されているか
- [ ] ログは構造化されているか
- [ ] X-Rayトレーシングは有効化されているか

### 目標パフォーマンス指標

| 指標 | 目標値 |
|------|--------|
| Lambda実行時間（Collector） | < 5分 |
| Lambda実行時間（Query） | < 1秒 |
| コールドスタート時間 | < 3秒 |
| メモリ使用率 | < 80% |

---

## 関連ドキュメント

- **エラーハンドリング**: `../core/error-handling-patterns.md` - エラー分類と基本原則
- **エラーハンドリング実装**: `error-handling-implementation.md` - 詳細な実装パターン
- **環境変数**: `../infrastructure/environment-variables.md` - 環境変数の詳細定義
- **パフォーマンス最適化**: `../infrastructure/performance-optimization.md` - DynamoDB、S3の最適化
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - CloudWatch設定
- **テスト戦略**: `testing-strategy.md` - Lambda関数のテスト方法
- **ファイル命名規則**: `tdnet-file-naming.md` - Lambda関数のファイル構成


---

## 関連ドキュメント

### 参照元（このファイルを参照しているファイル）

このファイルを参照しているファイルはありません。

### 参照先（このファイルが参照しているファイル）

このファイルは他のsteeringファイルを参照していません。

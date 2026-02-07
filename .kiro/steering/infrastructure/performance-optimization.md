---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts|**/dynamodb/**/*.ts|**/s3/**/*.ts'
---

# パフォーマンス最適化

このファイルは、TDnet Data Collectorプロジェクトのパフォーマンス最適化戦略とベストプラクティスをまとめたものです。

## Lambda関数の最適化

### メモリとタイムアウトの設定

**基本原則:**
- メモリを増やすとCPUも比例して増加
- コスト vs パフォーマンスのトレードオフを測定
- 実際の使用量の1.5倍を目安に設定

**推奨設定:**

| 関数タイプ | メモリ | タイムアウト | 理由 |
|-----------|--------|------------|------|
| Collector（スクレイピング） | 512MB | 15分 | ネットワークI/O待機が多い |
| Parser（PDF解析） | 1024MB | 5分 | CPU集約的 |
| Query（API） | 256MB | 30秒 | 軽量なデータ取得 |
| Export（大量データ） | 1024MB | 15分 | メモリ集約的 |

**CDK実装例:**

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

// Collector関数
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    entry: 'lambda/collector/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.minutes(15),
    memorySize: 512,
    environment: {
        NODE_OPTIONS: '--enable-source-maps',
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
    entry: 'lambda/parser/index.ts',
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_20_X,
    timeout: cdk.Duration.minutes(5),
    memorySize: 1024, // CPU性能向上のため
    reservedConcurrentExecutions: 5, // 同時実行数制限
});
```

### コールドスタート対策

**1. Lambda SnapStart（Java/Python）**
Node.jsでは未対応のため、以下の戦略を採用：

**2. Provisioned Concurrency**
```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';

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

**3. 依存関係の最小化**
```typescript
// ❌ 悪い例: 不要な依存関係
import * as AWS from 'aws-sdk'; // 全体をインポート
import _ from 'lodash'; // 全体をインポート

// ✅ 良い例: 必要な部分のみ
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import pick from 'lodash/pick'; // 個別関数のみ
```

**4. 初期化の最適化**
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

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

### バンドルサイズの最適化

**esbuildの設定:**
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
        footer: '',
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

## DynamoDB最適化

### キャパシティモードの選択

**オンデマンド vs プロビジョニング:**

| 特性 | オンデマンド | プロビジョニング |
|------|------------|----------------|
| コスト | 高い（従量課金） | 低い（予測可能な負荷） |
| スケーリング | 自動 | 手動/Auto Scaling |
| 適用ケース | 不規則な負荷 | 予測可能な負荷 |

**推奨:**
- 開発環境: オンデマンド
- 本番環境: オンデマンド（初期）→ プロビジョニング（負荷が安定したら）

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

const table = new dynamodb.Table(this, 'DisclosuresTable', {
    tableName: 'tdnet-disclosures',
    partitionKey: {
        name: 'disclosure_id',
        type: dynamodb.AttributeType.STRING,
    },
    billingMode: props.environment === 'prod' 
        ? dynamodb.BillingMode.PROVISIONED
        : dynamodb.BillingMode.PAY_PER_REQUEST,
    readCapacity: props.environment === 'prod' ? 5 : undefined,
    writeCapacity: props.environment === 'prod' ? 5 : undefined,
});

// Auto Scaling設定（本番環境のみ）
if (props.environment === 'prod') {
    table.autoScaleReadCapacity({
        minCapacity: 5,
        maxCapacity: 100,
    }).scaleOnUtilization({
        targetUtilizationPercent: 70,
    });
    
    table.autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 100,
    }).scaleOnUtilization({
        targetUtilizationPercent: 70,
    });
}
```

### クエリの最適化

**1. GSI（Global Secondary Index）の設計**

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// date_partitionでのクエリを最適化
table.addGlobalSecondaryIndex({
    indexName: 'GSI_DatePartition',
    partitionKey: {
        name: 'date_partition',
        type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
});

// 企業コードでのクエリを最適化
table.addGlobalSecondaryIndex({
    indexName: 'GSI_CompanyCode',
    partitionKey: {
        name: 'company_code',
        type: dynamodb.AttributeType.STRING,
    },
    sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
    },
    projectionType: dynamodb.ProjectionType.ALL,
});
```

**2. 効率的なクエリパターン**

```typescript
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// ❌ 悪い例: Scan（全テーブルスキャン）
const badResult = await docClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'company_code = :code',
    ExpressionAttributeValues: {
        ':code': '7203',
    },
}));

// ✅ 良い例: Query（GSI使用）
const goodResult = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI_CompanyCode',
    KeyConditionExpression: 'company_code = :code',
    ExpressionAttributeValues: {
        ':code': '7203',
    },
    Limit: 100,
}));
```

**3. date_partitionを使った効率的なクエリ**

```typescript
// 月次データの取得（date_partitionを活用）
async function getDisclosuresByMonth(
    yearMonth: string
): Promise<Disclosure[]> {
    const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: {
            ':partition': yearMonth, // '2024-01'
        },
        ScanIndexForward: false, // 降順（最新から）
    }));
    
    return result.Items as Disclosure[];
}

// 日付範囲の取得（複数パーティション）
async function getDisclosuresByDateRange(
    startDate: string,
    endDate: string
): Promise<Disclosure[]> {
    const startPartition = startDate.substring(0, 7); // '2024-01'
    const endPartition = endDate.substring(0, 7);     // '2024-03'
    
    const partitions = generateMonthRange(startPartition, endPartition);
    
    // 並行クエリ
    const results = await Promise.all(
        partitions.map(partition => getDisclosuresByMonth(partition))
    );
    
    // 結合してフィルタリング
    return results
        .flat()
        .filter(d => d.disclosed_at >= startDate && d.disclosed_at <= endDate)
        .sort((a, b) => b.disclosed_at.localeCompare(a.disclosed_at));
}

function generateMonthRange(start: string, end: string): string[] {
    const months: string[] = [];
    let current = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    
    while (current <= endDate) {
        months.push(
            `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
        );
        current.setMonth(current.getMonth() + 1);
    }
    
    return months;
}
```

**4. バッチ操作**

```typescript
import { DynamoDBDocumentClient, BatchGetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

// BatchGetItem（最大100件）
async function batchGetDisclosures(ids: string[]): Promise<Disclosure[]> {
    const chunks = chunkArray(ids, 100); // 100件ずつ分割
    
    const results = await Promise.all(
        chunks.map(async (chunk) => {
            const result = await docClient.send(new BatchGetCommand({
                RequestItems: {
                    [tableName]: {
                        Keys: chunk.map(id => ({ disclosure_id: id })),
                    },
                },
            }));
            
            return result.Responses?.[tableName] || [];
        })
    );
    
    return results.flat() as Disclosure[];
}

// BatchWriteItem（最大25件）
async function batchWriteDisclosures(disclosures: Disclosure[]): Promise<void> {
    const chunks = chunkArray(disclosures, 25); // 25件ずつ分割
    
    for (const chunk of chunks) {
        await docClient.send(new BatchWriteCommand({
            RequestItems: {
                [tableName]: chunk.map(disclosure => ({
                    PutRequest: {
                        Item: disclosure,
                    },
                })),
            },
        }));
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
```

### DynamoDB Streams の活用

```typescript
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

// Streamsを有効化
const table = new dynamodb.Table(this, 'DisclosuresTable', {
    // ...
    stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

// Stream処理Lambda
const streamProcessorFn = new lambda.Function(this, 'StreamProcessor', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/stream-processor'),
    timeout: cdk.Duration.minutes(1),
});

streamProcessorFn.addEventSource(
    new lambdaEventSources.DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 100,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
    })
);
```

## S3最適化

### マルチパートアップロード

**大きなPDFファイル（> 5MB）の場合:**

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from './utils/logger';

async function uploadLargePDF(
    buffer: Buffer,
    s3Key: string
): Promise<void> {
    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: bucketName,
            Key: s3Key,
            Body: buffer,
            ContentType: 'application/pdf',
            ServerSideEncryption: 'AES256',
        },
        queueSize: 4, // 並行アップロード数
        partSize: 5 * 1024 * 1024, // 5MB
    });
    
    upload.on('httpUploadProgress', (progress) => {
        logger.debug('Upload progress', {
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.loaded && progress.total 
                ? (progress.loaded / progress.total * 100).toFixed(2)
                : 0,
        });
    });
    
    await upload.done();
}
```

### S3 Transfer Acceleration

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { S3Client } from '@aws-sdk/client-s3';

// CDKでTransfer Accelerationを有効化
const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
    bucketName: 'tdnet-pdfs-prod',
    transferAcceleration: true, // グローバルアクセスの高速化
});

// クライアント側でTransfer Accelerationエンドポイントを使用
const s3Client = new S3Client({
    region: 'ap-northeast-1',
    useAccelerateEndpoint: true,
});
```

### S3 Select（大きなファイルの部分取得）

```typescript
import { S3Client, SelectObjectContentCommand } from '@aws-sdk/client-s3';

// CSV/JSONファイルから特定データのみ取得
async function selectFromS3(
    s3Key: string,
    query: string
): Promise<string> {
    const result = await s3Client.send(new SelectObjectContentCommand({
        Bucket: bucketName,
        Key: s3Key,
        ExpressionType: 'SQL',
        Expression: query,
        InputSerialization: {
            JSON: { Type: 'DOCUMENT' },
        },
        OutputSerialization: {
            JSON: { RecordDelimiter: '\n' },
        },
    }));
    
    let data = '';
    for await (const event of result.Payload!) {
        if (event.Records) {
            data += event.Records.Payload?.toString() || '';
        }
    }
    
    return data;
}
```

## 並行処理の最適化

### Promise.all vs Promise.allSettled

```typescript
// ❌ 悪い例: 1つでも失敗すると全体が失敗
const results = await Promise.all(
    disclosures.map(d => processDisclosure(d))
);

// ✅ 良い例: 個別の成功/失敗を処理
const results = await Promise.allSettled(
    disclosures.map(d => processDisclosure(d))
);

const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');

logger.info('Batch processing completed', {
    total: results.length,
    succeeded: succeeded.length,
    failed: failed.length,
});
```

### 並行度の制御

```typescript
import pLimit from 'p-limit';

// p-limitを使用した並行度制御
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

### バッチ処理の最適化

```typescript
import pLimit from 'p-limit';
import { Disclosure } from './types';
import { scrapeDisclosureList, processDisclosure } from './scraper';

async function batchCollect(
    startDate: string,
    endDate: string
): Promise<CollectionResult> {
    const dates = generateDateRange(startDate, endDate);
    
    // 日付ごとに並行処理（最大3並行）
    const limit = pLimit(3);
    
    const results = await Promise.allSettled(
        dates.map(date =>
            limit(async () => {
                const disclosures = await scrapeDisclosureList(date);
                
                // 各日付内でも並行処理（最大5並行）
                const innerLimit = pLimit(5);
                await Promise.allSettled(
                    disclosures.map(d =>
                        innerLimit(() => processDisclosure(d))
                    )
                );
                
                return disclosures.length;
            })
        )
    );
    
    const totalCollected = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);
    
    return {
        collected: totalCollected,
        failed: results.filter(r => r.status === 'rejected').length,
    };
}
```

## キャッシング戦略

### Lambda内メモリキャッシュ

```typescript
import { Disclosure } from './types';

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

### ElastiCache（オプション）

```typescript
import { createClient } from 'redis';
import { Disclosure } from './types';

// Redis クライアント
const redisClient = createClient({
    url: `redis://${process.env.REDIS_ENDPOINT}:6379`,
});

await redisClient.connect();

async function getCachedDisclosure(id: string): Promise<Disclosure | null> {
    const cached = await redisClient.get(`disclosure:${id}`);
    return cached ? JSON.parse(cached) : null;
}

async function setCachedDisclosure(
    id: string,
    disclosure: Disclosure,
    ttl: number = 300
): Promise<void> {
    await redisClient.setEx(
        `disclosure:${id}`,
        ttl,
        JSON.stringify(disclosure)
    );
}
```

## ネットワーク最適化

### HTTP/2とKeep-Alive

```typescript
import axios from 'axios';
import http from 'http';
import https from 'https';

// Keep-Alive有効化
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
});

const client = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 30000,
});
```

### 圧縮の有効化

```typescript
import axios from 'axios';

const client = axios.create({
    headers: {
        'Accept-Encoding': 'gzip, deflate, br',
    },
    decompress: true, // 自動解凍
});
```

## モニタリングとプロファイリング

### X-Rayでのパフォーマンス分析

```typescript
import AWSXRay from 'aws-xray-sdk-core';
import { Disclosure } from './types';
import { scrapeDisclosureList, downloadPDF, saveDisclosure } from './services';

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

### カスタムメトリクスの記録

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

async function recordPerformanceMetrics(
    operation: string,
    duration: number,
    success: boolean
): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnet/Performance',
        MetricData: [
            {
                MetricName: 'OperationDuration',
                Value: duration,
                Unit: 'Milliseconds',
                Timestamp: new Date(),
                Dimensions: [
                    { Name: 'Operation', Value: operation },
                    { Name: 'Status', Value: success ? 'Success' : 'Failure' },
                ],
            },
        ],
    }));
}

// 使用例
const startTime = Date.now();
try {
    await processDisclosure(disclosure);
    await recordPerformanceMetrics('ProcessDisclosure', Date.now() - startTime, true);
} catch (error) {
    await recordPerformanceMetrics('ProcessDisclosure', Date.now() - startTime, false);
    throw error;
}
```

## コスト最適化

### Lambda実行時間の削減

```typescript
import { Disclosure } from './types';
import { processDisclosure } from './services';

// ❌ 悪い例: 逐次処理
for (const disclosure of disclosures) {
    await processDisclosure(disclosure);
}

// ✅ 良い例: 並行処理
await Promise.allSettled(
    disclosures.map(d => processDisclosure(d))
);
```

### DynamoDBのコスト削減

```typescript
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

// Projection Expressionで必要な属性のみ取得
const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { disclosure_id: id },
    ProjectionExpression: 'disclosure_id, company_code, title, disclosed_at',
}));
```

### S3のライフサイクル管理

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
    lifecycleRules: [
        {
            // 90日後にIA（低頻度アクセス）に移行
            transitions: [
                {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(90),
                },
                {
                    storageClass: s3.StorageClass.GLACIER,
                    transitionAfter: cdk.Duration.days(365),
                },
            ],
        },
        {
            // 古いバージョンは30日後に削除
            noncurrentVersionExpiration: cdk.Duration.days(30),
        },
    ],
});
```

## ベンチマークとテスト

### パフォーマンステスト

```typescript
import { performance } from 'perf_hooks';
import { processDisclosuresWithLimit } from './services';
import { generateTestDisclosures, getDisclosure } from './test-helpers';

describe('Performance Tests', () => {
    it('should process 100 disclosures within 30 seconds', async () => {
        const disclosures = generateTestDisclosures(100);
        
        const startTime = performance.now();
        await processDisclosuresWithLimit(disclosures, 10);
        const duration = performance.now() - startTime;
        
        expect(duration).toBeLessThan(30000); // 30秒以内
    }, 60000);
    
    it('should handle 1000 concurrent requests', async () => {
        const requests = Array(1000).fill(null).map((_, i) => 
            getDisclosure(`test-${i}`)
        );
        
        const startTime = performance.now();
        const results = await Promise.allSettled(requests);
        const duration = performance.now() - startTime;
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        
        expect(succeeded).toBeGreaterThan(950); // 95%以上成功
        expect(duration).toBeLessThan(10000); // 10秒以内
    }, 30000);
});
```

## まとめ

### パフォーマンス最適化チェックリスト

- [ ] Lambda メモリサイズを実測値の1.5倍に設定
- [ ] コールドスタート対策（依存関係最小化、初期化最適化）
- [ ] DynamoDB GSIを適切に設計（date_partition活用）
- [ ] バッチ操作を使用（BatchGet/BatchWrite）
- [ ] 並行処理の制御（p-limit使用）
- [ ] S3マルチパートアップロード（大きなファイル）
- [ ] キャッシング戦略の実装
- [ ] X-Rayでパフォーマンス分析
- [ ] カスタムメトリクスで継続的監視

### 目標パフォーマンス指標

| 指標 | 目標値 |
|------|--------|
| Lambda実行時間（Collector） | < 5分 |
| Lambda実行時間（Query） | < 1秒 |
| DynamoDBクエリレイテンシ | < 100ms |
| S3アップロードレイテンシ | < 5秒 |
| API レスポンスタイム | < 500ms |
| バッチ処理スループット | > 100件/分 |

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - 基本的な実装パターン
- **監視とアラート**: `monitoring-alerts.md` - パフォーマンスメトリクスの監視
- **データバリデーション**: `../development/data-validation.md` - date_partitionの使用方法

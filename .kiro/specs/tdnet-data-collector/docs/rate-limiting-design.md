# TDnet Data Collector - レート制限実装設計書

**作成日:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 目次

1. [概要](#概要)
2. [Token Bucketアルゴリズムの実装](#token-bucketアルゴリズムの実装)
3. [Lambda Reserved Concurrency設定](#lambda-reserved-concurrency設定)
4. [DynamoDB分散ロックの実装](#dynamodb分散ロックの実装)
5. [テスト戦略](#テスト戦略)
6. [監視とアラート](#監視とアラート)
7. [関連ドキュメント](#関連ドキュメント)

---

## 概要

### レート制限の目的

TDnet Data Collectorは、日本取引所グループのTDnetウェブサイトから開示情報を自動収集します。適切なレート制限を実装することで、以下を実現します：

**主要な目的:**
- ✅ TDnetサーバーへの過度な負荷を防止
- ✅ サービス提供者への配慮とマナーの遵守
- ✅ アクセス制限やIP BAN のリスク回避
- ✅ 安定した長期的なデータ収集の実現

### TDnetサーバーへの配慮

**基本方針:**

- **リクエスト間隔**: 最低2秒（0.5リクエスト/秒）
- **同時実行数**: 1（並列リクエストなし）
- **User-Agent**: 適切な識別情報を含む
- **エラー時の対応**: 即座に再試行せず、指数バックオフを使用

### レート制限の3層アーキテクチャ

本設計では、3つの独立したレート制限メカニズムを組み合わせて、確実な制御を実現します：

| レイヤー | メカニズム | 目的 | 実装場所 |
|---------|-----------|------|---------|
| **Layer 1** | Token Bucket | リクエスト間隔の制御 | Lambda関数内 |
| **Layer 2** | Reserved Concurrency | 同時実行数の制限 | Lambda設定 |
| **Layer 3** | 分散ロック | 複数トリガーの排他制御 | DynamoDB |

**なぜ3層が必要か？**

1. **Token Bucket単体では不十分**: Lambda関数が複数同時実行されると、各インスタンスが独立してToken Bucketを持つため、全体のレート制限が効かない
2. **Reserved Concurrency単体では不十分**: EventBridgeとAPI Gatewayからの同時トリガーを防げない
3. **分散ロック単体では不十分**: リクエスト間隔の細かい制御ができない

**3層を組み合わせることで:**
- ✅ 確実に2秒間隔を維持
- ✅ 同時実行を完全に防止
- ✅ 複数トリガーソースからの競合を回避

---

## Token Bucketアルゴリズムの実装

### アルゴリズムの説明

Token Bucketは、レート制限の標準的なアルゴリズムです：

**動作原理:**

1. **バケツ（Bucket）**: トークンを保持する容器（容量: capacity）
2. **トークン（Token）**: リクエストを実行する権利
3. **補充（Refill）**: 一定レートでトークンが補充される（refillRate）
4. **消費（Consume）**: リクエスト時にトークンを1つ消費
5. **待機（Wait）**: トークンがない場合、補充されるまで待機

**視覚的な説明:**

```
時刻 0秒:  [●●●●●] (5トークン)
時刻 1秒:  [●●●●◐] (4.5トークン) - リクエスト1回実行、0.5トークン補充
時刻 2秒:  [●●●●●] (5トークン)   - 0.5トークン補充
時刻 3秒:  [●●●●◐] (4.5トークン) - リクエスト1回実行、0.5トークン補充
```

### 設定パラメータ

| パラメータ | 値 | 説明 |
|-----------|---|------|
| **capacity** | 5 | バケツの最大容量（トークン数） |
| **refillRate** | 0.5 | 補充レート（トークン/秒） |
| **初期トークン数** | 5 | 起動時のトークン数 |

**計算根拠:**
- リクエスト間隔2秒 = 0.5リクエスト/秒 = refillRate 0.5
- バースト許容: 最大5リクエストまで連続実行可能（その後は2秒間隔に制限される）

### 完全な実装コード

**ファイル:** `src/scraper/rate-limiter.ts`

```typescript
/**
 * Token Bucket アルゴリズムによるレート制限
 * 
 * @example
 * const rateLimiter = new TokenBucket(5, 0.5);
 * await rateLimiter.acquire(); // トークンを取得（必要に応じて待機）
 * await fetchTdnetData(); // リクエスト実行
 */
export class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number;
    
    /**
     * Token Bucketを初期化
     * 
     * @param capacity - バケツの最大容量（トークン数）
     * @param refillRate - 補充レート（トークン/秒）
     */
    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity; // 初期状態は満タン
        this.lastRefill = Date.now();
        
        logger.info('TokenBucket initialized', {
            capacity,
            refillRate,
            initialTokens: this.tokens,
        });
    }
    
    /**
     * トークンを取得（必要に応じて待機）
     * 
     * @param tokens - 取得するトークン数（デフォルト: 1）
     * @returns Promise<void> - トークン取得完了時に解決
     */
    async acquire(tokens: number = 1): Promise<void> {
        const startTime = Date.now();
        
        // トークンを補充
        this.refill();
        
        // トークンが不足している場合は待機
        while (this.tokens < tokens) {
            const waitTime = this.calculateWaitTime(tokens);
            
            logger.debug('Waiting for tokens', {
                currentTokens: this.tokens,
                requiredTokens: tokens,
                waitTimeMs: waitTime,
            });
            
            await this.sleep(waitTime);
            this.refill();
        }
        
        // トークンを消費
        this.tokens -= tokens;
        
        const elapsedTime = Date.now() - startTime;
        logger.debug('Token acquired', {
            tokensConsumed: tokens,
            remainingTokens: this.tokens,
            elapsedTimeMs: elapsedTime,
        });
    }
    
    /**
     * トークンを補充
     */
    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // 秒単位
        const tokensToAdd = elapsed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }
    
    /**
     * 待機時間を計算
     * 
     * @param tokens - 必要なトークン数
     * @returns 待機時間（ミリ秒）
     */
    private calculateWaitTime(tokens: number): number {
        const shortage = tokens - this.tokens;
        const waitTimeSeconds = shortage / this.refillRate;
        return Math.ceil(waitTimeSeconds * 1000);
    }
    
    /**
     * 指定時間待機
     * 
     * @param ms - 待機時間（ミリ秒）
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 現在のトークン数を取得（デバッグ用）
     */
    getAvailableTokens(): number {
        this.refill();
        return this.tokens;
    }
}
```

### 使用例

**基本的な使用方法:**

```typescript
import { TokenBucket } from './rate-limiter';
import axios from 'axios';

// グローバルインスタンス（Lambda関数全体で共有）
const rateLimiter = new TokenBucket(5, 0.5);

/**
 * レート制限付きでTDnetデータを取得
 */
async function fetchTdnetData(url: string): Promise<any> {
    // トークンを取得（必要に応じて待機）
    await rateLimiter.acquire();
    
    // リクエスト実行
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)',
        },
        timeout: 30000,
    });
    
    return response.data;
}

// 使用例
async function collectDisclosures(date: string): Promise<void> {
    const url = `https://www.release.tdnet.info/inbs/I_list_001_${date}.html`;
    
    try {
        const data = await fetchTdnetData(url);
        logger.info('Data fetched successfully', { date });
    } catch (error) {
        logger.error('Failed to fetch data', { date, error });
        throw error;
    }
}
```

**複数リクエストの例:**

```typescript
async function fetchMultiplePages(dates: string[]): Promise<void> {
    for (const date of dates) {
        // 各リクエストは自動的に2秒間隔で実行される
        await fetchTdnetData(`https://www.release.tdnet.info/inbs/I_list_001_${date}.html`);
        logger.info('Fetched page', { date });
    }
}
```

---

## Lambda Reserved Concurrency設定

### 設定の目的

Lambda Reserved Concurrencyを1に設定することで、以下を実現します：


**主要な目的:**
- ✅ Lambda関数の同時実行を1インスタンスに制限
- ✅ 複数のToken Bucketインスタンスが同時に動作することを防止
- ✅ EventBridgeとAPI Gatewayからの同時トリガーを制御
- ✅ 確実に2秒間隔を維持

**なぜ必要か？**

Token Bucketは各Lambda関数インスタンス内で独立して動作します。複数のLambda関数が同時実行されると、各インスタンスが独自のToken Bucketを持つため、全体のレート制限が効かなくなります。

**例（Reserved Concurrencyなしの場合）:**
```
時刻 0秒: Lambda Instance 1 起動 → リクエスト実行
時刻 0秒: Lambda Instance 2 起動 → リクエスト実行（同時！）
時刻 0秒: Lambda Instance 3 起動 → リクエスト実行（同時！）
→ 2秒間隔が守られない！
```

**例（Reserved Concurrency = 1の場合）:**
```
時刻 0秒: Lambda Instance 1 起動 → リクエスト実行
時刻 2秒: Lambda Instance 1 → 次のリクエスト実行
時刻 4秒: Lambda Instance 1 → 次のリクエスト実行
→ 確実に2秒間隔を維持！
```

### CDK実装コード

**ファイル:** `cdk/lib/tdnet-stack.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class TdnetStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        
        // Collector Lambda関数
        const collectorFn = new lambda.Function(this, 'CollectorFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/collector'),
            timeout: cdk.Duration.minutes(15),
            memorySize: 512,
            
            // 🔴 重要: Reserved Concurrencyを1に設定
            reservedConcurrentExecutions: 1,
            
            environment: {
                DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || 'tdnet-disclosures',
                S3_BUCKET: process.env.S3_BUCKET || 'tdnet-pdfs',
                LOCK_TABLE: process.env.LOCK_TABLE || 'tdnet-locks',
            },
        });
        
        // EventBridge Rule（毎日18:00に実行）
        const dailyRule = new events.Rule(this, 'DailyCollectionRule', {
            schedule: events.Schedule.cron({
                hour: '9',  // UTC 9:00 = JST 18:00
                minute: '0',
            }),
        });
        
        dailyRule.addTarget(new targets.LambdaFunction(collectorFn));
        
        // API Gateway（手動トリガー用）
        const api = new apigateway.RestApi(this, 'CollectorApi', {
            restApiName: 'TDnet Collector API',
            description: 'API for triggering TDnet data collection',
        });
        
        const collection = api.root.addResource('collect');
        collection.addMethod('POST', new apigateway.LambdaIntegration(collectorFn));
    }
}
```

### 設定の確認

**AWS CLIで確認:**

```bash
aws lambda get-function-concurrency --function-name tdnet-collector
```

**期待される出力:**
```json
{
    "ReservedConcurrentExecutions": 1
}
```

### 注意事項

**Reserved Concurrencyの制限:**
- アカウント全体の同時実行数から1を消費
- 他のLambda関数の同時実行数に影響する可能性
- 無料枠: 1,000同時実行（リージョンごと）

**推奨事項:**
- 本番環境では必ず設定
- 開発環境でも設定を推奨（テスト時の予期しない並列実行を防止）

---

## DynamoDB分散ロックの実装

### 分散ロックの必要性

Reserved Concurrencyだけでは、以下のシナリオに対応できません：


**対応が必要なシナリオ:**

1. **複数トリガーソースからの同時実行**
   - EventBridge（定期実行）とAPI Gateway（手動実行）が同時にトリガー
   - Reserved Concurrencyは1つのLambda関数内の制御のみ

2. **Lambda関数の再デプロイ時**
   - 新旧バージョンが一時的に共存
   - 両方が同時実行される可能性

3. **手動での複数実行**
   - 管理者が誤って複数回API呼び出し
   - 複数のリクエストがキューに入る

**分散ロックの役割:**

Lambda関数の実行開始時にロックを取得し、他のインスタンスが同時実行できないようにします。

### DynamoDBテーブル設計

**テーブル名:** `tdnet-locks`

| 属性名 | 型 | 説明 |
|--------|---|------|
| **lock_key** (PK) | String | ロックの識別子（例: `collector-lock`） |
| **acquired_at** | Number | ロック取得時刻（Unix timestamp） |
| **acquired_by** | String | ロック取得者（Lambda Request ID） |
| **ttl** | Number | TTL（Time To Live）Unix timestamp |

**TTL設定:**
- 300秒（5分）でロックを自動削除
- Lambda関数がクラッシュしてもロックが永続化しない

**CDK実装:**

```typescript
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// ロックテーブル
const lockTable = new dynamodb.Table(this, 'LockTable', {
    tableName: 'tdnet-locks',
    partitionKey: {
        name: 'lock_key',
        type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'ttl',
    removalPolicy: cdk.RemovalPolicy.RETAIN,
});

// Lambda関数にテーブルへのアクセス権限を付与
lockTable.grantReadWriteData(collectorFn);
```

### 完全な実装コード

**ファイル:** `src/utils/distributed-lock.ts`

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    PutCommand,
    DeleteCommand,
    GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from './logger';

export interface LockOptions {
    tableName: string;
    lockKey: string;
    ttlSeconds?: number;
    acquiredBy?: string;
}

/**
 * DynamoDB分散ロック
 * 
 * @example
 * const lock = new DistributedLock({
 *     tableName: 'tdnet-locks',
 *     lockKey: 'collector-lock',
 *     ttlSeconds: 300,
 * });
 * 
 * const acquired = await lock.acquire();
 * if (!acquired) {
 *     throw new Error('Lock acquisition failed');
 * }
 * 
 * try {
 *     // 処理実行
 * } finally {
 *     await lock.release();
 * }
 */
export class DistributedLock {
    private readonly client: DynamoDBDocumentClient;
    private readonly tableName: string;
    private readonly lockKey: string;
    private readonly ttlSeconds: number;
    private readonly acquiredBy: string;
    
    constructor(options: LockOptions) {
        const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
        this.client = DynamoDBDocumentClient.from(dynamodb);
        this.tableName = options.tableName;
        this.lockKey = options.lockKey;
        this.ttlSeconds = options.ttlSeconds || 300;
        this.acquiredBy = options.acquiredBy || process.env.AWS_REQUEST_ID || 'unknown';
    }
    
    /**
     * ロックを取得
     * 
     * @returns true: ロック取得成功, false: ロック取得失敗（他のプロセスが保持中）
     */
    async acquire(): Promise<boolean> {
        const now = Date.now();
        const ttl = Math.floor(now / 1000) + this.ttlSeconds;
        
        try {
            await this.client.send(new PutCommand({
                TableName: this.tableName,
                Item: {
                    lock_key: this.lockKey,
                    acquired_at: now,
                    acquired_by: this.acquiredBy,
                    ttl: ttl,
                },
                // 条件: lock_keyが存在しない場合のみ挿入
                ConditionExpression: 'attribute_not_exists(lock_key)',
            }));
            
            logger.info('Lock acquired', {
                lockKey: this.lockKey,
                acquiredBy: this.acquiredBy,
                ttl: ttl,
            });
            
            return true;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                // ロックが既に存在する（他のプロセスが保持中）
                logger.warn('Lock acquisition failed: already held by another process', {
                    lockKey: this.lockKey,
                });
                
                // 既存のロック情報を取得
                await this.logExistingLock();
                
                return false;
            }
            
            // その他のエラー
            logger.error('Lock acquisition error', {
                lockKey: this.lockKey,
                error: error.message,
            });
            throw error;
        }
    }
    
    /**
     * ロックを解放
     */
    async release(): Promise<void> {
        try {
            await this.client.send(new DeleteCommand({
                TableName: this.tableName,
                Key: { lock_key: this.lockKey },
            }));
            
            logger.info('Lock released', {
                lockKey: this.lockKey,
                acquiredBy: this.acquiredBy,
            });
        } catch (error: any) {
            logger.error('Lock release error', {
                lockKey: this.lockKey,
                error: error.message,
            });
            throw error;
        }
    }
    
    /**
     * 既存のロック情報をログに記録（デバッグ用）
     */
    private async logExistingLock(): Promise<void> {
        try {
            const result = await this.client.send(new GetCommand({
                TableName: this.tableName,
                Key: { lock_key: this.lockKey },
            }));
            
            if (result.Item) {
                logger.info('Existing lock info', {
                    lockKey: this.lockKey,
                    acquiredAt: new Date(result.Item.acquired_at).toISOString(),
                    acquiredBy: result.Item.acquired_by,
                    ttl: new Date(result.Item.ttl * 1000).toISOString(),
                });
            }
        } catch (error: any) {
            logger.error('Failed to get existing lock info', {
                lockKey: this.lockKey,
                error: error.message,
            });
        }
    }
}
```

### Lambda handlerでの使用例

**ファイル:** `lambda/collector/index.ts`

```typescript
import { DistributedLock } from '../../src/utils/distributed-lock';
import { TokenBucket } from '../../src/scraper/rate-limiter';
import { logger } from '../../src/utils/logger';

// グローバルインスタンス
const rateLimiter = new TokenBucket(5, 0.5);

export const handler = async (event: any, context: any): Promise<any> => {
    // 分散ロックを初期化
    const lock = new DistributedLock({
        tableName: process.env.LOCK_TABLE || 'tdnet-locks',
        lockKey: 'collector-lock',
        ttlSeconds: 300,
        acquiredBy: context.requestId,
    });
    
    // ロックを取得
    const acquired = await lock.acquire();
    if (!acquired) {
        logger.warn('Another collection is in progress, skipping', {
            requestId: context.requestId,
        });
        
        return {
            statusCode: 409,
            body: JSON.stringify({
                message: 'Another collection is in progress',
                requestId: context.requestId,
            }),
        };
    }
    
    try {
        // 収集処理を実行
        logger.info('Starting collection', { requestId: context.requestId });
        
        const results = await collectDisclosures(event);
        
        logger.info('Collection completed', {
            requestId: context.requestId,
            results,
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Collection completed successfully',
                results,
            }),
        };
    } catch (error: any) {
        logger.error('Collection failed', {
            requestId: context.requestId,
            error: error.message,
        });
        
        throw error;
    } finally {
        // 必ずロックを解放
        await lock.release();
    }
};

async function collectDisclosures(event: any): Promise<any> {
    // レート制限付きでデータ収集
    // 実装は省略
    return { success: true };
}
```

### TTL設定の重要性

**TTL（Time To Live）の役割:**

1. **自動クリーンアップ**: ロックが永続化しない
2. **デッドロック防止**: Lambda関数がクラッシュしてもロックが自動削除
3. **コスト削減**: 不要なデータを自動削除

**TTL設定値の選択:**

| TTL | 適用場面 |
|-----|---------|
| **60秒** | 短時間の処理（1分以内） |
| **300秒** | 中程度の処理（5分以内）← 推奨 |
| **900秒** | 長時間の処理（15分以内） |

**本プロジェクトの選択: 300秒（5分）**

理由:
- Lambda関数のタイムアウト: 15分
- 通常の収集処理: 2-3分
- 余裕を持たせて5分に設定

---

## テスト戦略

### ユニットテスト

**Token Bucketのテスト:**

**ファイル:** `src/scraper/__tests__/rate-limiter.test.ts`

```typescript
import { TokenBucket } from '../rate-limiter';

describe('TokenBucket', () => {
    test('should allow immediate request when tokens are available', async () => {
        const bucket = new TokenBucket(5, 0.5);
        
        const startTime = Date.now();
        await bucket.acquire();
        const elapsedTime = Date.now() - startTime;
        
        // トークンがあるので即座に取得できる
        expect(elapsedTime).toBeLessThan(100);
    });
    
    test('should wait when tokens are exhausted', async () => {
        const bucket = new TokenBucket(2, 0.5);
        
        // 2トークンを消費
        await bucket.acquire();
        await bucket.acquire();
        
        // 3つ目のトークンは待機が必要
        const startTime = Date.now();
        await bucket.acquire();
        const elapsedTime = Date.now() - startTime;
        
        // 2秒待機するはず（0.5トークン/秒）
        expect(elapsedTime).toBeGreaterThanOrEqual(1900);
        expect(elapsedTime).toBeLessThan(2500);
    });
    
    test('should refill tokens over time', async () => {
        const bucket = new TokenBucket(5, 0.5);
        
        // すべてのトークンを消費
        for (let i = 0; i < 5; i++) {
            await bucket.acquire();
        }
        
        // 4秒待機（2トークン補充）
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // 2トークン取得できるはず
        const startTime = Date.now();
        await bucket.acquire();
        await bucket.acquire();
        const elapsedTime = Date.now() - startTime;
        
        // 即座に取得できる
        expect(elapsedTime).toBeLessThan(100);
    });
});
```

**分散ロックのテスト:**

**ファイル:** `src/utils/__tests__/distributed-lock.test.ts`

```typescript
import { DistributedLock } from '../distributed-lock';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DistributedLock', () => {
    beforeEach(() => {
        ddbMock.reset();
    });
    
    test('should acquire lock successfully', async () => {
        ddbMock.on(PutCommand).resolves({});
        
        const lock = new DistributedLock({
            tableName: 'test-locks',
            lockKey: 'test-lock',
        });
        
        const acquired = await lock.acquire();
        
        expect(acquired).toBe(true);
    });
    
    test('should fail to acquire lock when already held', async () => {
        ddbMock.on(PutCommand).rejects({
            name: 'ConditionalCheckFailedException',
        });
        
        const lock = new DistributedLock({
            tableName: 'test-locks',
            lockKey: 'test-lock',
        });
        
        const acquired = await lock.acquire();
        
        expect(acquired).toBe(false);
    });
    
    test('should release lock successfully', async () => {
        ddbMock.on(DeleteCommand).resolves({});
        
        const lock = new DistributedLock({
            tableName: 'test-locks',
            lockKey: 'test-lock',
        });
        
        await expect(lock.release()).resolves.not.toThrow();
    });
});
```

### 統合テスト

**レート制限の統合テスト:**

**ファイル:** `tests/integration/rate-limiting.test.ts`

```typescript
import { handler } from '../../lambda/collector';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

describe('Rate Limiting Integration', () => {
    test('should prevent concurrent executions', async () => {
        const event = { date: '2024-01-15' };
        const context = { requestId: 'test-request-1' };
        
        // 2つのLambda関数を同時実行
        const [result1, result2] = await Promise.all([
            handler(event, { ...context, requestId: 'request-1' }),
            handler(event, { ...context, requestId: 'request-2' }),
        ]);
        
        // 1つは成功、1つは409エラー
        const statuses = [result1.statusCode, result2.statusCode].sort();
        expect(statuses).toEqual([200, 409]);
    });
    
    test('should maintain 2-second interval between requests', async () => {
        const timestamps: number[] = [];
        
        // 5回リクエストを実行
        for (let i = 0; i < 5; i++) {
            timestamps.push(Date.now());
            await fetchTdnetData('https://example.com');
        }
        
        // 各リクエスト間隔を確認
        for (let i = 1; i < timestamps.length; i++) {
            const interval = timestamps[i] - timestamps[i - 1];
            expect(interval).toBeGreaterThanOrEqual(1900); // 2秒 - 100ms
            expect(interval).toBeLessThan(2500); // 2秒 + 500ms
        }
    });
});
```

### 負荷テスト

**負荷テストスクリプト:**

**ファイル:** `tests/load/rate-limiting-load.test.ts`

```typescript
import axios from 'axios';

describe('Rate Limiting Load Test', () => {
    test('should handle 100 concurrent requests', async () => {
        const apiUrl = process.env.API_URL || 'https://api.example.com/collect';
        const results: any[] = [];
        
        // 100個の同時リクエスト
        const promises = Array.from({ length: 100 }, (_, i) => 
            axios.post(apiUrl, { date: '2024-01-15' })
                .then(res => ({ status: res.status, index: i }))
                .catch(err => ({ status: err.response?.status || 500, index: i }))
        );
        
        const responses = await Promise.all(promises);
        
        // 1つだけ200、残りは409
        const successCount = responses.filter(r => r.status === 200).length;
        const conflictCount = responses.filter(r => r.status === 409).length;
        
        expect(successCount).toBe(1);
        expect(conflictCount).toBe(99);
    }, 60000); // 60秒タイムアウト
});
```

---

## 監視とアラート

### CloudWatchメトリクス

**カスタムメトリクスの定義:**

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-northeast-1' });

/**
 * レート制限メトリクスを送信
 */
async function publishRateLimitMetrics(metrics: {
    tokensAvailable: number;
    waitTimeMs: number;
    requestInterval: number;
}): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnet/RateLimiting',
        MetricData: [
            {
                MetricName: 'TokensAvailable',
                Value: metrics.tokensAvailable,
                Unit: 'Count',
                Timestamp: new Date(),
            },
            {
                MetricName: 'WaitTime',
                Value: metrics.waitTimeMs,
                Unit: 'Milliseconds',
                Timestamp: new Date(),
            },
            {
                MetricName: 'RequestInterval',
                Value: metrics.requestInterval,
                Unit: 'Milliseconds',
                Timestamp: new Date(),
            },
        ],
    }));
}
```

**監視すべきメトリクス:**

| メトリクス | 説明 | 正常範囲 | アラート条件 |
|-----------|------|---------|------------|
| **TokensAvailable** | 利用可能なトークン数 | 0-5 | - |
| **WaitTime** | トークン待機時間 | 0-2000ms | > 5000ms |
| **RequestInterval** | リクエスト間隔 | 1900-2100ms | < 1500ms or > 3000ms |
| **LockAcquisitionFailures** | ロック取得失敗回数 | 0-1/日 | > 5/時間 |
| **ConcurrentExecutions** | 同時実行数 | 0-1 | > 1 |

### CloudWatchアラーム設定

**CDK実装:**

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';

// SNSトピック
const alertTopic = new sns.Topic(this, 'RateLimitAlertTopic', {
    displayName: 'TDnet Rate Limit Alerts',
});

// アラーム: リクエスト間隔が短すぎる
const requestIntervalAlarm = new cloudwatch.Alarm(this, 'RequestIntervalAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/RateLimiting',
        metricName: 'RequestInterval',
        statistic: 'Minimum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 1500, // 1.5秒未満
    evaluationPeriods: 2,
    comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
    alarmDescription: 'Request interval is too short (< 1.5s)',
});

requestIntervalAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// アラーム: ロック取得失敗が多い
const lockFailureAlarm = new cloudwatch.Alarm(this, 'LockFailureAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/RateLimiting',
        metricName: 'LockAcquisitionFailures',
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
    }),
    threshold: 5,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Too many lock acquisition failures (> 5/hour)',
});

lockFailureAlarm.addAlarmAction(new actions.SnsAction(alertTopic));

// アラーム: 同時実行数が1を超える
const concurrencyAlarm = new cloudwatch.Alarm(this, 'ConcurrencyAlarm', {
    metric: collectorFn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(1),
    }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    alarmDescription: 'Concurrent executions detected (> 1)',
});

concurrencyAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
```

### ログベースのアラート

**CloudWatch Logs Insights クエリ:**

```sql
-- レート制限違反の検出
fields @timestamp, @message
| filter @message like /Rate limit violated/
| stats count() as violations by bin(5m)
| sort @timestamp desc

-- ロック取得失敗の検出
fields @timestamp, requestId, lockKey
| filter @message like /Lock acquisition failed/
| stats count() as failures by lockKey
| sort failures desc

-- リクエスト間隔の分析
fields @timestamp, requestInterval
| filter @message like /Request completed/
| stats avg(requestInterval) as avgInterval, 
        min(requestInterval) as minInterval,
        max(requestInterval) as maxInterval
```

### ダッシュボード

**CloudWatch Dashboard設定:**

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

const dashboard = new cloudwatch.Dashboard(this, 'RateLimitDashboard', {
    dashboardName: 'TDnet-RateLimiting',
});

dashboard.addWidgets(
    // トークン数の推移
    new cloudwatch.GraphWidget({
        title: 'Available Tokens',
        left: [
            new cloudwatch.Metric({
                namespace: 'TDnet/RateLimiting',
                metricName: 'TokensAvailable',
                statistic: 'Average',
            }),
        ],
    }),
    
    // リクエスト間隔の推移
    new cloudwatch.GraphWidget({
        title: 'Request Interval',
        left: [
            new cloudwatch.Metric({
                namespace: 'TDnet/RateLimiting',
                metricName: 'RequestInterval',
                statistic: 'Average',
            }),
        ],
        leftYAxis: {
            min: 0,
            max: 3000,
        },
    }),
    
    // ロック取得失敗回数
    new cloudwatch.SingleValueWidget({
        title: 'Lock Acquisition Failures (24h)',
        metrics: [
            new cloudwatch.Metric({
                namespace: 'TDnet/RateLimiting',
                metricName: 'LockAcquisitionFailures',
                statistic: 'Sum',
                period: cdk.Duration.hours(24),
            }),
        ],
    }),
);
```

---

## 関連ドキュメント

### 実装チェックリスト

実装時は以下のドキュメントを参照してください：

- **実装チェックリスト**: `implementation-checklist.md` - Phase 1実装の詳細手順
- **スクレイピングパターン**: `../../steering/development/tdnet-scraping-patterns.md` - TDnetスクレイピングの詳細
- **エラーハンドリング**: `../../steering/core/error-handling-patterns.md` - エラー処理の基本原則

### 設計ドキュメント

- **要件定義書**: `requirements.md` - レート制限の要件定義
- **設計書**: `design.md` - システム全体の設計
- **アーキテクチャ図**: `architecture.md` - システムアーキテクチャ

### 改善記録

- **改善記録**: `../improvements/task-requirements-design-review-improvement-1-20260207-160000.md` - レート制限実装の改善提案

---

## まとめ

### 3層レート制限アーキテクチャ

| レイヤー | メカニズム | 実装場所 | 目的 |
|---------|-----------|---------|------|
| **Layer 1** | Token Bucket | Lambda関数内 | リクエスト間隔の制御（2秒） |
| **Layer 2** | Reserved Concurrency | Lambda設定 | 同時実行数の制限（1） |
| **Layer 3** | 分散ロック | DynamoDB | 複数トリガーの排他制御 |

### 実装のポイント

1. **Token Bucket**: リクエスト間隔を確実に2秒に維持
2. **Reserved Concurrency**: Lambda関数の同時実行を1に制限
3. **分散ロック**: 複数トリガーソースからの同時実行を防止
4. **TTL設定**: ロックの自動クリーンアップ（300秒）
5. **監視とアラート**: レート制限違反を即座に検知

### 次のステップ

1. **Phase 1実装**: Token Bucket、Reserved Concurrency、分散ロックを実装
2. **テスト**: ユニットテスト、統合テスト、負荷テストを実施
3. **監視設定**: CloudWatchメトリクス、アラーム、ダッシュボードを設定
4. **本番デプロイ**: 段階的にデプロイし、動作を確認

---

**作成日:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft  
**次回レビュー:** Phase 1実装完了後

---
inclusion: fileMatch
fileMatchPattern: '**/scraper/**/*.ts|**/collector/**/*.ts'
---

# TDnet Scraping Patterns

このファイルは、TDnetウェブサイトからのスクレイピングにおけるパターンとベストプラクティスをまとめたものです。

## TDnet Website Structure

### ベースURL

```
https://www.release.tdnet.info/inbs/I_main_00.html
```

### 開示情報一覧ページ

```
https://www.release.tdnet.info/inbs/I_list_001_{YYYYMMDD}.html

例:
https://www.release.tdnet.info/inbs/I_list_001_20240115.html
```

## HTML Structure Analysis

### 開示情報リストのテーブル構造

TDnetの開示情報は、HTMLテーブル形式で提供されています：

```html
<table class="kjTable">
  <tr>
    <td class="kjTime">15:00</td>
    <td class="kjCode">7203</td>
    <td class="kjName">トヨタ自動車株式会社</td>
    <td class="kjTitle">
      <a href="/inbs/140120240115512345.pdf">
        2024年3月期 第3四半期決算短信
      </a>
    </td>
  </tr>
  <!-- 他の開示情報 -->
</table>
```

### 主要なCSSセレクタ

- **テーブル**: `.kjTable` または `table.kjTable`
- **時刻**: `.kjTime`
- **企業コード**: `.kjCode`
- **企業名**: `.kjName`
- **タイトルとリンク**: `.kjTitle a`

## Scraping Implementation

### 推奨ライブラリ

**cheerio（推奨）:**
- 軽量で高速
- jQueryライクなAPI
- サーバーサイドに最適

```typescript
import * as cheerio from 'cheerio';
import axios from 'axios';
import { logger } from './utils/logger';
import { RetryableError } from './utils/errors';
import { Disclosure } from './types';

async function scrapeTdnetList(date: string): Promise<Disclosure[]> {
    const url = `https://www.release.tdnet.info/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)',
            },
            timeout: 30000, // 30秒
        });
        
        const $ = cheerio.load(response.data);
        const disclosures: Disclosure[] = [];
        
        $('table.kjTable tr').each((index, element) => {
            // ヘッダー行をスキップ
            if (index === 0) return;
            
            const $row = $(element);
            const time = $row.find('.kjTime').text().trim();
            const companyCode = $row.find('.kjCode').text().trim();
            const companyName = $row.find('.kjName').text().trim();
            const $link = $row.find('.kjTitle a');
            const title = $link.text().trim();
            const pdfPath = $link.attr('href');
            
            // データが不完全な行はスキップ
            if (!companyCode || !companyName || !title || !pdfPath) {
                logger.warn('Incomplete disclosure data', { index, companyCode, title });
                return;
            }
            
            const disclosure: Disclosure = {
                disclosure_id: generateDisclosureId(date, companyCode, index),
                company_code: companyCode,
                company_name: companyName,
                disclosure_type: extractDisclosureType(title),
                title: title,
                disclosed_at: `${date}T${time}:00+09:00`,
                pdf_url: `https://www.release.tdnet.info${pdfPath}`,
                pdf_s3_key: '', // 後で設定
                downloaded_at: new Date().toISOString(),
                file_size: 0, // ダウンロード後に設定
                date_partition: date.substring(0, 7), // YYYY-MM
            };
            
            disclosures.push(disclosure);
        });
        
        return disclosures;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
                logger.info('No disclosures found for date', { date });
                return [];
            }
            throw new RetryableError(`Failed to fetch TDnet list: ${error.message}`);
        }
        throw error;
    }
}
```

### 開示種類の抽出

タイトルから開示種類を推定：

```typescript
function extractDisclosureType(title: string): string {
    const patterns = [
        { pattern: /決算短信/, type: '決算短信' },
        { pattern: /業績予想/, type: '業績予想修正' },
        { pattern: /配当/, type: '配当予想修正' },
        { pattern: /自己株式/, type: '自己株式取得' },
        { pattern: /株式分割/, type: '株式分割' },
        { pattern: /合併/, type: '合併' },
        { pattern: /IR/, type: 'IR資料' },
    ];
    
    for (const { pattern, type } of patterns) {
        if (pattern.test(title)) {
            return type;
        }
    }
    
    return 'その他';
}
```

### 開示IDの生成

```typescript
function generateDisclosureId(date: string, companyCode: string, index: number): string {
    // YYYYMMDD_企業コード_連番（3桁）
    const dateStr = date.replace(/-/g, '');
    const indexStr = String(index).padStart(3, '0');
    return `${dateStr}_${companyCode}_${indexStr}`;
}
```

## PDF Download Patterns

### PDFダウンロード実装

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as crypto from 'crypto';
import { logger } from './utils/logger';
import { RetryableError } from './utils/errors';
import { ValidationError } from './utils/errors';

async function downloadPdf(
    pdfUrl: string,
    s3Key: string,
    s3Client: S3Client,
    bucketName: string
): Promise<{ success: boolean; fileSize: number }> {
    try {
        // PDFをダウンロード
        const response = await axios.get(pdfUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)',
            },
            timeout: 60000, // 60秒
            maxContentLength: 50 * 1024 * 1024, // 最大50MB
        });
        
        const buffer = Buffer.from(response.data);
        
        // PDFファイルの整合性検証
        validatePdfIntegrity(buffer);
        
        // S3にアップロード
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: buffer,
            ContentType: 'application/pdf',
            ServerSideEncryption: 'AES256',
            Metadata: {
                'original-url': pdfUrl,
                'downloaded-at': new Date().toISOString(),
                'md5-hash': crypto.createHash('md5').update(buffer).digest('hex'),
            },
        }));
        
        logger.info('PDF downloaded successfully', {
            s3Key,
            fileSize: buffer.length,
        });
        
        return {
            success: true,
            fileSize: buffer.length,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED') {
                throw new RetryableError('PDF download timeout');
            }
            if (error.response?.status === 404) {
                throw new Error('PDF not found');
            }
            if (error.response?.status >= 500) {
                throw new RetryableError(`Server error: ${error.response.status}`);
            }
        }
        throw error;
    }
}

function validatePdfIntegrity(buffer: Buffer): void {
    // 最小サイズチェック
    if (buffer.length < 10 * 1024) {
        throw new ValidationError('PDF file too small', 'file_size');
    }
    
    // 最大サイズチェック
    if (buffer.length > 50 * 1024 * 1024) {
        throw new ValidationError('PDF file too large', 'file_size');
    }
    
    // PDFヘッダーチェック
    const header = buffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
        throw new ValidationError('Invalid PDF header', 'pdf_integrity');
    }
}
```

## Error Handling Patterns

### HTMLパース失敗時のフォールバック

```typescript
import { logger } from './utils/logger';
import { Disclosure } from './types';

async function scrapeTdnetListWithFallback(date: string): Promise<Disclosure[]> {
    try {
        // 通常のスクレイピング
        return await scrapeTdnetList(date);
    } catch (error) {
        logger.error('Primary scraping failed', { date, error });
        
        // フォールバック1: 異なるURLパターンを試す
        try {
            return await scrapeTdnetListAlternative(date);
        } catch (fallbackError) {
            logger.error('Fallback scraping failed', { date, fallbackError });
            
            // フォールバック2: キャッシュから取得（前日のデータなど）
            const cachedData = await getCachedDisclosures(date);
            if (cachedData.length > 0) {
                logger.warn('Using cached data', { date, count: cachedData.length });
                return cachedData;
            }
            
            // すべて失敗した場合は空配列を返す
            logger.error('All scraping attempts failed', { date });
            return [];
        }
    }
}
```

### レート制限の実装

#### 基本的なレート制限（固定間隔）

```typescript
import { logger } from './utils/logger';

class RateLimiter {
    private lastRequestTime: number = 0;
    private minDelay: number;
    
    constructor(minDelayMs: number = 2000) {
        this.minDelay = minDelayMs;
    }
    
    async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelay) {
            const waitTime = this.minDelay - timeSinceLastRequest;
            logger.debug('Rate limiting: waiting', { waitTime });
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
    }
}

// 使用例
import axios from 'axios';

const rateLimiter = new RateLimiter(2000); // 2秒間隔

async function fetchWithRateLimit(url: string): Promise<any> {
    await rateLimiter.waitIfNeeded();
    return await axios.get(url);
}
```

#### 動的レート制限（適応型）

TDnetの応答時間や429エラーに応じて、自動的に遅延時間を調整します。

```typescript
import { logger } from './utils/logger';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

interface RateLimitMetrics {
    currentDelay: number;
    consecutiveSuccesses: number;
    consecutiveFailures: number;
    totalRequests: number;
    rateLimitViolations: number;
    averageResponseTime: number;
}

class AdaptiveRateLimiter {
    private lastRequestTime: number = 0;
    private currentDelay: number;
    private readonly minDelay: number;
    private readonly maxDelay: number;
    private consecutiveSuccesses: number = 0;
    private consecutiveFailures: number = 0;
    private totalRequests: number = 0;
    private rateLimitViolations: number = 0;
    private responseTimes: number[] = [];
    private cloudWatchClient: CloudWatchClient;
    
    constructor(options: {
        minDelay?: number;
        maxDelay?: number;
        initialDelay?: number;
        enableMetrics?: boolean;
    } = {}) {
        this.minDelay = options.minDelay ?? 2000; // 最小2秒
        this.maxDelay = options.maxDelay ?? 60000; // 最大60秒
        this.currentDelay = options.initialDelay ?? this.minDelay;
        
        if (options.enableMetrics !== false) {
            this.cloudWatchClient = new CloudWatchClient({});
        }
    }
    
    /**
     * 必要に応じて待機
     */
    async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.currentDelay) {
            const waitTime = this.currentDelay - timeSinceLastRequest;
            logger.debug('Adaptive rate limiting: waiting', {
                waitTime,
                currentDelay: this.currentDelay,
                consecutiveSuccesses: this.consecutiveSuccesses,
                consecutiveFailures: this.consecutiveFailures,
            });
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
        this.totalRequests++;
    }
    
    /**
     * リクエスト成功時の処理
     * @param responseTime レスポンス時間（ミリ秒）
     */
    handleSuccess(responseTime: number): void {
        this.consecutiveSuccesses++;
        this.consecutiveFailures = 0;
        this.responseTimes.push(responseTime);
        
        // 最新100件のレスポンス時間のみ保持
        if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
        }
        
        // 応答時間が3秒以上の場合、遅延時間を20%増加
        if (responseTime > 3000) {
            this.increaseDelay(1.2);
            logger.info('Slow response detected, increasing delay', {
                responseTime,
                newDelay: this.currentDelay,
            });
        }
        // 連続10回成功した場合、遅延時間を10%短縮
        else if (this.consecutiveSuccesses >= 10) {
            this.decreaseDelay(0.9);
            this.consecutiveSuccesses = 0;
            logger.info('Consecutive successes, decreasing delay', {
                newDelay: this.currentDelay,
            });
        }
        
        // メトリクス送信
        this.sendMetrics();
    }
    
    /**
     * 429エラー時の処理
     * @param retryAfter Retry-Afterヘッダーの値（秒）
     */
    handleRateLimitError(retryAfter?: number): void {
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        this.rateLimitViolations++;
        
        if (retryAfter) {
            // Retry-Afterヘッダーがある場合は優先的に使用
            this.currentDelay = Math.min(retryAfter * 1000, this.maxDelay);
            logger.warn('Rate limit exceeded, using Retry-After header', {
                retryAfter,
                newDelay: this.currentDelay,
            });
        } else {
            // 指数バックオフ（2倍に増加）
            this.increaseDelay(2.0);
            logger.warn('Rate limit exceeded, applying exponential backoff', {
                consecutiveFailures: this.consecutiveFailures,
                newDelay: this.currentDelay,
            });
        }
        
        // メトリクス送信
        this.sendMetrics();
    }
    
    /**
     * 遅延時間を増加
     */
    private increaseDelay(multiplier: number): void {
        this.currentDelay = Math.min(
            Math.ceil(this.currentDelay * multiplier),
            this.maxDelay
        );
    }
    
    /**
     * 遅延時間を短縮
     */
    private decreaseDelay(multiplier: number): void {
        this.currentDelay = Math.max(
            Math.floor(this.currentDelay * multiplier),
            this.minDelay
        );
    }
    
    /**
     * 現在の遅延時間を取得
     */
    getCurrentDelay(): number {
        return this.currentDelay;
    }
    
    /**
     * メトリクスを取得
     */
    getMetrics(): RateLimitMetrics {
        const avgResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
            : 0;
        
        return {
            currentDelay: this.currentDelay,
            consecutiveSuccesses: this.consecutiveSuccesses,
            consecutiveFailures: this.consecutiveFailures,
            totalRequests: this.totalRequests,
            rateLimitViolations: this.rateLimitViolations,
            averageResponseTime: avgResponseTime,
        };
    }
    
    /**
     * CloudWatchメトリクスを送信
     */
    private async sendMetrics(): Promise<void> {
        if (!this.cloudWatchClient) return;
        
        const metrics = this.getMetrics();
        
        try {
            await this.cloudWatchClient.send(new PutMetricDataCommand({
                Namespace: 'TDnetDataCollector/RateLimit',
                MetricData: [
                    {
                        MetricName: 'CurrentDelay',
                        Value: metrics.currentDelay,
                        Unit: 'Milliseconds',
                        Timestamp: new Date(),
                    },
                    {
                        MetricName: 'RateLimitViolations',
                        Value: 1,
                        Unit: 'Count',
                        Timestamp: new Date(),
                    },
                    {
                        MetricName: 'AverageResponseTime',
                        Value: metrics.averageResponseTime,
                        Unit: 'Milliseconds',
                        Timestamp: new Date(),
                    },
                    {
                        MetricName: 'RequestsPerMinute',
                        Value: 1,
                        Unit: 'Count',
                        Timestamp: new Date(),
                    },
                ],
            }));
        } catch (error) {
            // メトリクス送信失敗はログのみ（メイン処理に影響させない）
            logger.error('Failed to send CloudWatch metrics', { error });
        }
    }
}

// 使用例: 429エラー時の自動バックオフ
import axios, { AxiosError } from 'axios';

const adaptiveRateLimiter = new AdaptiveRateLimiter({
    minDelay: 2000,
    maxDelay: 60000,
    initialDelay: 2000,
    enableMetrics: true,
});

async function fetchWithAdaptiveRateLimit(url: string): Promise<any> {
    await adaptiveRateLimiter.waitIfNeeded();
    
    const startTime = Date.now();
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)',
            },
            timeout: 30000,
        });
        
        const responseTime = Date.now() - startTime;
        adaptiveRateLimiter.handleSuccess(responseTime);
        
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            
            // 429エラーの場合
            if (axiosError.response?.status === 429) {
                const retryAfter = axiosError.response.headers['retry-after'];
                const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
                
                adaptiveRateLimiter.handleRateLimitError(retryAfterSeconds);
                
                // 再試行
                logger.info('Retrying after rate limit error', {
                    url,
                    retryAfter: retryAfterSeconds,
                    currentDelay: adaptiveRateLimiter.getCurrentDelay(),
                });
                
                // 調整された遅延時間で待機
                await new Promise(resolve => setTimeout(resolve, adaptiveRateLimiter.getCurrentDelay()));
                
                // 再試行（最大3回）
                return await fetchWithAdaptiveRateLimit(url);
            }
        }
        
        throw error;
    }
}

// Lambda関数での使用例
import { Context } from 'aws-lambda';

// グローバルスコープで初期化（コールドスタート対策）
const globalRateLimiter = new AdaptiveRateLimiter({
    minDelay: parseInt(process.env.RATE_LIMIT_MIN_DELAY || '2000', 10),
    maxDelay: parseInt(process.env.RATE_LIMIT_MAX_DELAY || '60000', 10),
    enableMetrics: process.env.ENABLE_RATE_LIMIT_METRICS !== 'false',
});

export async function handler(event: any, context: Context) {
    const urls = event.urls || [];
    const results = [];
    
    for (const url of urls) {
        try {
            const data = await fetchWithAdaptiveRateLimit(url);
            results.push({ url, success: true, data });
        } catch (error) {
            logger.error('Failed to fetch URL', { url, error });
            results.push({ url, success: false, error: error.message });
        }
    }
    
    // 最終的なメトリクスをログ出力
    const metrics = globalRateLimiter.getMetrics();
    logger.info('Rate limiter metrics', metrics);
    
    return {
        statusCode: 200,
        body: JSON.stringify({
            results,
            rateLimitMetrics: metrics,
        }),
    };
}
```

#### レート制限メトリクスの監視

CloudWatchダッシュボードで以下のメトリクスを監視：

**メトリクス一覧:**
- `CurrentDelay`: 現在の遅延時間（ミリ秒）
- `RateLimitViolations`: 429エラーの発生回数
- `AverageResponseTime`: TDnetの平均応答時間（ミリ秒）
- `RequestsPerMinute`: 1分あたりのリクエスト数

**CloudWatchアラーム設定例:**

```typescript
import { Alarm, ComparisonOperator } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export class RateLimitAlarms extends Construct {
    constructor(scope: Construct, id: string, props: { alarmTopic: Topic }) {
        super(scope, id);
        
        // 429エラー頻発アラーム
        const rateLimitViolationsAlarm = new Alarm(this, 'RateLimitViolationsAlarm', {
            metric: {
                namespace: 'TDnetDataCollector/RateLimit',
                metricName: 'RateLimitViolations',
                statistic: 'Sum',
                period: Duration.minutes(5),
            },
            threshold: 10, // 5分間に10回以上
            evaluationPeriods: 1,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'TDnet rate limit violations exceeded threshold',
        });
        rateLimitViolationsAlarm.addAlarmAction(new SnsAction(props.alarmTopic));
        
        // 遅延時間増加アラーム
        const delayIncreaseAlarm = new Alarm(this, 'DelayIncreaseAlarm', {
            metric: {
                namespace: 'TDnetDataCollector/RateLimit',
                metricName: 'CurrentDelay',
                statistic: 'Average',
                period: Duration.minutes(5),
            },
            threshold: 30000, // 30秒以上
            evaluationPeriods: 2,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'Rate limit delay increased significantly',
        });
        delayIncreaseAlarm.addAlarmAction(new SnsAction(props.alarmTopic));
        
        // 応答時間悪化アラーム
        const responseTimeAlarm = new Alarm(this, 'ResponseTimeAlarm', {
            metric: {
                namespace: 'TDnetDataCollector/RateLimit',
                metricName: 'AverageResponseTime',
                statistic: 'Average',
                period: Duration.minutes(5),
            },
            threshold: 5000, // 5秒以上
            evaluationPeriods: 2,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: 'TDnet response time degraded',
        });
        responseTimeAlarm.addAlarmAction(new SnsAction(props.alarmTopic));
    }
}
```

#### グローバルレート制限（将来の拡張）

複数のLambda関数間でレート制限を共有する場合、DynamoDBまたはElastiCacheを使用：

```typescript
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

class GlobalRateLimiter {
    private dynamoClient: DynamoDBClient;
    private tableName: string;
    private lockKey: string;
    
    constructor(tableName: string, lockKey: string = 'tdnet-rate-limit') {
        this.dynamoClient = new DynamoDBClient({});
        this.tableName = tableName;
        this.lockKey = lockKey;
    }
    
    async acquireLock(ttlSeconds: number = 2): Promise<boolean> {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + ttlSeconds;
        
        try {
            await this.dynamoClient.send(new UpdateItemCommand({
                TableName: this.tableName,
                Key: { lock_key: { S: this.lockKey } },
                UpdateExpression: 'SET expires_at = :expires_at, last_request_at = :now',
                ConditionExpression: 'attribute_not_exists(lock_key) OR expires_at < :now',
                ExpressionAttributeValues: {
                    ':expires_at': { N: String(expiresAt) },
                    ':now': { N: String(now) },
                },
            }));
            
            return true;
        } catch (error) {
            if (error.name === 'ConditionalCheckFailedException') {
                return false; // ロック取得失敗
            }
            throw error;
        }
    }
    
    async waitForLock(maxWaitMs: number = 10000): Promise<void> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            if (await this.acquireLock()) {
                return;
            }
            
            // 100ms待機してリトライ
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Failed to acquire global rate limit lock');
    }
}

// 使用例
const globalLock = new GlobalRateLimiter('RateLimitLocks');

async function fetchWithGlobalRateLimit(url: string): Promise<any> {
    await globalLock.waitForLock();
    return await axios.get(url);
}
```

**注意:** グローバルレート制限は、複数のLambda関数が同時に実行される場合にのみ必要です。単一のLambda関数で順次処理する場合は、`AdaptiveRateLimiter`で十分です。

## Testing Patterns

### スクレイピングのモックテスト

```typescript
import nock from 'nock';
import { scrapeTdnetList } from './scraper';

describe('TDnet Scraping', () => {
    beforeEach(() => {
        nock.cleanAll();
    });
    
    test('should parse disclosure list correctly', async () => {
        const mockHtml = `
            <table class="kjTable">
                <tr>
                    <td class="kjTime">15:00</td>
                    <td class="kjCode">7203</td>
                    <td class="kjName">トヨタ自動車株式会社</td>
                    <td class="kjTitle">
                        <a href="/inbs/test.pdf">決算短信</a>
                    </td>
                </tr>
            </table>
        `;
        
        nock('https://www.release.tdnet.info')
            .get('/inbs/I_list_001_20240115.html')
            .reply(200, mockHtml);
        
        const disclosures = await scrapeTdnetList('2024-01-15');
        
        expect(disclosures).toHaveLength(1);
        expect(disclosures[0].company_code).toBe('7203');
        expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
        expect(disclosures[0].disclosure_type).toBe('決算短信');
    });
    
    test('should handle 404 gracefully', async () => {
        nock('https://www.release.tdnet.info')
            .get('/inbs/I_list_001_20240115.html')
            .reply(404);
        
        const disclosures = await scrapeTdnetList('2024-01-15');
        
        expect(disclosures).toHaveLength(0);
    });
});
```

## Best Practices

### 1. User-Agentの設定

必ず適切なUser-Agentを設定：

```typescript
const headers = {
    'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'ja,en;q=0.9',
};
```

### 2. タイムアウトの設定

すべてのHTTPリクエストにタイムアウトを設定：

```typescript
const config = {
    timeout: 30000, // 30秒
    maxRedirects: 5,
};
```

### 3. エラーログの詳細化

スクレイピング失敗時は詳細なログを記録：

```typescript
logger.error('Scraping failed', {
    url,
    statusCode: error.response?.status,
    errorMessage: error.message,
    responseData: error.response?.data?.substring(0, 500), // 最初の500文字のみ
});
```

### 4. HTMLの変更検知

TDnetのHTML構造が変更された場合を検知：

```typescript
function detectHtmlStructureChange($: cheerio.CheerioAPI): boolean {
    const expectedSelectors = ['.kjTable', '.kjTime', '.kjCode', '.kjName', '.kjTitle'];
    
    for (const selector of expectedSelectors) {
        if ($(selector).length === 0) {
            logger.error('HTML structure changed: selector not found', { selector });
            return true;
        }
    }
    
    return false;
}
```

### 5. キャッシング戦略

同じ日付のデータを複数回取得しない：

```typescript
const cache = new Map<string, Disclosure[]>();

async function scrapeTdnetListCached(date: string): Promise<Disclosure[]> {
    if (cache.has(date)) {
        logger.debug('Using cached data', { date });
        return cache.get(date)!;
    }
    
    const disclosures = await scrapeTdnetList(date);
    cache.set(date, disclosures);
    
    return disclosures;
}
```

## Maintenance Considerations

### HTML構造の変更監視

TDnetのHTML構造は予告なく変更される可能性があります：

1. **定期的な構造チェック**: 週次でHTML構造の変更を検知
2. **アラート設定**: 構造変更を検知したらSNS経由で通知
3. **フォールバック**: 旧構造と新構造の両方に対応

### robots.txtの確認

定期的にrobots.txtを確認：

```
https://www.release.tdnet.info/robots.txt
```

スクレイピングが許可されているか確認し、制限を遵守してください。

## まとめ

- cheerioを使用した軽量なHTMLパース
- 適切なUser-Agentとタイムアウトの設定
- レート制限の実装（2秒間隔）
- PDFファイルの整合性検証
- エラーハンドリングとフォールバック
- HTML構造変更の検知とアラート

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則（スクレイピングエラーの処理）

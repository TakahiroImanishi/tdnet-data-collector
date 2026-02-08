---
inclusion: fileMatch
fileMatchPattern: '**/scraper/**/*.ts|**/collector/**/*.ts|**/utils/rate-limiter*.ts|**/utils/disclosure-id*.ts|**/lambda/collector/**/*.ts'
---

# TDnet Scraping Patterns

## TDnet URL構造

```
ベースURL: https://www.release.tdnet.info/inbs/I_main_00.html
一覧ページ: https://www.release.tdnet.info/inbs/I_list_001_{YYYYMMDD}.html
例: https://www.release.tdnet.info/inbs/I_list_001_20240115.html
```

## HTMLパース

### CSSセレクタ

- テーブル: `.kjTable`
- 時刻: `.kjTime`
- 企業コード: `.kjCode`
- 企業名: `.kjName`
- タイトル・リンク: `.kjTitle a`

### スクレイピング実装

```typescript
import * as cheerio from 'cheerio';
import axios from 'axios';

async function scrapeTdnetList(date: string): Promise<Disclosure[]> {
    const url = `https://www.release.tdnet.info/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
    const response = await axios.get(url, {
        headers: { 'User-Agent': 'TDnet-Data-Collector/1.0 (contact@example.com)' },
        timeout: 30000,
    });
    
    const $ = cheerio.load(response.data);
    const disclosures: Disclosure[] = [];
    
    $('table.kjTable tr').each((index, element) => {
        if (index === 0) return; // ヘッダースキップ
        
        const $row = $(element);
        const time = $row.find('.kjTime').text().trim();
        const companyCode = $row.find('.kjCode').text().trim();
        const companyName = $row.find('.kjName').text().trim();
        const $link = $row.find('.kjTitle a');
        const title = $link.text().trim();
        const pdfPath = $link.attr('href');
        
        if (!companyCode || !companyName || !title || !pdfPath) {
            logger.warn('Incomplete data', { index, companyCode, title });
            return;
        }
        
        disclosures.push({
            disclosure_id: generateDisclosureId(date, companyCode, index),
            company_code: companyCode,
            company_name: companyName,
            disclosure_type: extractDisclosureType(title),
            title: title,
            disclosed_at: `${date}T${time}:00+09:00`,
            pdf_url: `https://www.release.tdnet.info${pdfPath}`,
            date_partition: date.substring(0, 7),
            // ...
        });
    });
    
    return disclosures;
}

function extractDisclosureType(title: string): string {
    const patterns = [
        { pattern: /決算短信/, type: '決算短信' },
        { pattern: /業績予想/, type: '業績予想修正' },
        { pattern: /配当/, type: '配当予想修正' },
        { pattern: /自己株式/, type: '自己株式取得' },
    ];
    for (const { pattern, type } of patterns) {
        if (pattern.test(title)) return type;
    }
    return 'その他';
}
```

## PDFダウンロード

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function downloadPdf(
    pdfUrl: string,
    s3Key: string,
    s3Client: S3Client,
    bucketName: string
): Promise<{ success: boolean; fileSize: number }> {
    const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'TDnet-Data-Collector/1.0' },
        timeout: 60000,
        maxContentLength: 50 * 1024 * 1024,
    });
    
    const buffer = Buffer.from(response.data);
    validatePdfIntegrity(buffer); // 10KB-50MB、%PDF-ヘッダー
    
    await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256',
    }));
    
    return { success: true, fileSize: buffer.length };
}
```

## レート制限

### 基本実装

```typescript
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
            await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }
}

// 使用例
const rateLimiter = new RateLimiter(2000);
async function fetchWithRateLimit(url: string): Promise<any> {
    await rateLimiter.waitIfNeeded();
    return await axios.get(url);
}
```

### 適応型レート制限（429エラー対応）

```typescript
class AdaptiveRateLimiter {
    private currentDelay: number;
    private readonly minDelay: number;
    private readonly maxDelay: number;
    private consecutiveSuccesses: number = 0;
    
    constructor(options: { minDelay?: number; maxDelay?: number } = {}) {
        this.minDelay = options.minDelay ?? 2000;
        this.maxDelay = options.maxDelay ?? 60000;
        this.currentDelay = this.minDelay;
    }
    
    handleSuccess(responseTime: number): void {
        this.consecutiveSuccesses++;
        if (responseTime > 3000) {
            this.currentDelay = Math.min(this.currentDelay * 1.2, this.maxDelay);
        } else if (this.consecutiveSuccesses >= 10) {
            this.currentDelay = Math.max(this.currentDelay * 0.9, this.minDelay);
            this.consecutiveSuccesses = 0;
        }
    }
    
    handleRateLimitError(retryAfter?: number): void {
        this.consecutiveSuccesses = 0;
        if (retryAfter) {
            this.currentDelay = Math.min(retryAfter * 1000, this.maxDelay);
        } else {
            this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
        }
    }
}

// 使用例
const adaptiveRateLimiter = new AdaptiveRateLimiter();
async function fetchWithAdaptiveRateLimit(url: string): Promise<any> {
    await adaptiveRateLimiter.waitIfNeeded();
    const startTime = Date.now();
    try {
        const response = await axios.get(url);
        adaptiveRateLimiter.handleSuccess(Date.now() - startTime);
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            adaptiveRateLimiter.handleRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
            await new Promise(resolve => setTimeout(resolve, adaptiveRateLimiter.getCurrentDelay()));
            return await fetchWithAdaptiveRateLimit(url); // 再試行
        }
        throw error;
    }
}
```

## エラーハンドリング

```typescript
async function scrapeTdnetListWithFallback(date: string): Promise<Disclosure[]> {
    try {
        return await scrapeTdnetList(date);
    } catch (error) {
        logger.error('Scraping failed', { date, error });
        // フォールバック: キャッシュから取得
        const cachedData = await getCachedDisclosures(date);
        if (cachedData.length > 0) {
            logger.warn('Using cached data', { date });
            return cachedData;
        }
        return [];
    }
}
```

## ベストプラクティス

1. **User-Agent設定**: `TDnet-Data-Collector/1.0 (contact@example.com)`
2. **タイムアウト**: 30秒（一覧）、60秒（PDF）
3. **レート制限**: 2秒間隔、429エラー時は指数バックオフ
4. **PDFバリデーション**: 10KB-50MB、`%PDF-`ヘッダー
5. **HTML構造変更検知**: 定期的にセレクタの存在確認

## 関連ドキュメント

- **エラーハンドリング**: `../core/error-handling-patterns.md` - 再試行戦略

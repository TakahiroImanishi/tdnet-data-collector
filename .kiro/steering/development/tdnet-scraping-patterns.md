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

### 基本実装

```typescript
import * as cheerio from 'cheerio';
import axios from 'axios';

async function scrapeTdnetList(date: string): Promise<Disclosure[]> {
    const url = `https://www.release.tdnet.info/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
    const response = await axios.get(url, {
        headers: { 'User-Agent': 'TDnet-Data-Collector/1.0' },
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
        
        if (!companyCode || !title || !pdfPath) return;
        
        disclosures.push({
            disclosure_id: generateDisclosureId(date, companyCode, index),
            company_code: companyCode,
            company_name: companyName,
            title: title,
            disclosed_at: `${date}T${time}:00+09:00`,
            pdf_url: `https://www.release.tdnet.info${pdfPath}`,
            date_partition: date.substring(0, 7),
        });
    });
    
    return disclosures;
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
        maxContentLength: 50 * 1024 * 1024, // 50MB
    });
    
    const buffer = Buffer.from(response.data);
    
    // PDFバリデーション: 10KB-50MB、%PDF-ヘッダー
    if (buffer.length < 10 * 1024 || buffer.length > 50 * 1024 * 1024) {
        throw new Error('Invalid PDF size');
    }
    if (!buffer.toString('utf-8', 0, 5).startsWith('%PDF-')) {
        throw new Error('Invalid PDF header');
    }
    
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
            await new Promise(resolve => 
                setTimeout(resolve, this.minDelay - timeSinceLastRequest)
            );
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

### 429エラー対応

```typescript
async function fetchWithRetry(url: string, maxRetries: number = 3): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await rateLimiter.waitIfNeeded();
            return await axios.get(url);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
```

## ベストプラクティス

1. **User-Agent設定**: `TDnet-Data-Collector/1.0 (contact@example.com)`
2. **タイムアウト**: 30秒（一覧）、60秒（PDF）
3. **レート制限**: 2秒間隔、429エラー時は指数バックオフ
4. **PDFバリデーション**: 10KB-50MB、`%PDF-`ヘッダー
5. **並行処理**: 最大5並列

## 関連ドキュメント

- **エラーハンドリング**: `../core/error-handling-patterns.md` - 再試行戦略

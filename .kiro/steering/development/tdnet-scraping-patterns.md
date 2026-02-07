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

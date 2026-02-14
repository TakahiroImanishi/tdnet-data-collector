---
inclusion: fileMatch
fileMatchPattern: '**/scraper/**/*.ts|**/collector/**/*.ts|**/utils/rate-limiter*.ts|**/utils/disclosure-id*.ts|**/lambda/collector/**/*.ts'
---

# TDnet Scraping Patterns

## TDnet URL構造

```
一覧: https://www.release.tdnet.info/inbs/I_list_001_{YYYYMMDD}.html
例: https://www.release.tdnet.info/inbs/I_list_001_20240115.html
```

## CSSセレクタ

| 要素 | セレクタ |
|------|---------|
| テーブル | `.kjTable` |
| 時刻 | `.kjTime` |
| 企業コード | `.kjCode` |
| 企業名 | `.kjName` |
| タイトル・リンク | `.kjTitle a` |

## 基本実装

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
        if (index === 0) return;
        const $row = $(element);
        const companyCode = $row.find('.kjCode').text().trim();
        const title = $row.find('.kjTitle a').text().trim();
        const pdfPath = $row.find('.kjTitle a').attr('href');
        
        if (!companyCode || !title || !pdfPath) return;
        
        disclosures.push({
            disclosure_id: generateDisclosureId(date, companyCode, index),
            company_code: companyCode,
            company_name: $row.find('.kjName').text().trim(),
            title: title,
            disclosed_at: `${date}T${$row.find('.kjTime').text().trim()}:00+09:00`,
            pdf_url: `https://www.release.tdnet.info${pdfPath}`,
            date_partition: date.substring(0, 7),
        });
    });
    
    return disclosures;
}
```

## レート制限

```typescript
class RateLimiter {
    private lastRequestTime = 0;
    constructor(private minDelay = 2000) {}
    
    async waitIfNeeded(): Promise<void> {
        const elapsed = Date.now() - this.lastRequestTime;
        if (elapsed < this.minDelay) {
            await new Promise(r => setTimeout(r, this.minDelay - elapsed));
        }
        this.lastRequestTime = Date.now();
    }
}

// 429エラー対応
async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await rateLimiter.waitIfNeeded();
            return await axios.get(url);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                const delay = error.response.headers['retry-after'] 
                    ? parseInt(error.response.headers['retry-after']) * 1000 
                    : 2000 * Math.pow(2, i);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
```

## ベストプラクティス

- User-Agent: `TDnet-Data-Collector/1.0 (contact@example.com)`
- タイムアウト: 30秒（一覧）、60秒（PDF）
- レート制限: 2秒間隔、429エラー時は指数バックオフ
- PDFバリデーション: 10KB-50MB、`%PDF-`ヘッダー
- 並行処理: 最大5並列

## 関連ドキュメント

- `../core/error-handling-patterns.md` - 再試行戦略

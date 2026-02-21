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
async function scrapeTdnetList(date: string): Promise<Disclosure[]> {
    const url = `https://www.release.tdnet.info/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
    const response = await axios.get(url, { timeout: 30000 });
    const $ = cheerio.load(response.data);
    const disclosures: Disclosure[] = [];
    
    $('table.kjTable tr').each((index, element) => {
        if (index === 0) return;
        const $row = $(element);
        disclosures.push({
            disclosure_id: generateDisclosureId(date, $row.find('.kjCode').text().trim(), index),
            company_code: $row.find('.kjCode').text().trim(),
            title: $row.find('.kjTitle a').text().trim(),
            pdf_url: `https://www.release.tdnet.info${$row.find('.kjTitle a').attr('href')}`,
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
        if (elapsed < this.minDelay) await new Promise(r => setTimeout(r, this.minDelay - elapsed));
        this.lastRequestTime = Date.now();
    }
}
```

429エラー対応: `error-handling-patterns.md`参照

## ベストプラクティス

- User-Agent: `TDnet-Data-Collector/1.0 (contact@example.com)`
- タイムアウト: 30秒（一覧）、60秒（PDF）
- レート制限: 2秒間隔、429エラー時は指数バックオフ
- PDFバリデーション: 10KB-50MB、`%PDF-`ヘッダー
- 並行処理: 最大5並列

## 関連

`../core/error-handling-patterns.md`

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

**定数管理**:

TDnetのベースURLは環境変数 `TDNET_BASE_URL` で設定可能です（デフォルト: `https://www.release.tdnet.info`）。

```typescript
// 環境変数から取得（未設定時はデフォルト値を使用）
const TDNET_BASE_URL = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info';

// URL構築
const listUrl = `${TDNET_BASE_URL}/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
```

これにより、テスト環境やモックサーバーを使用する際に柔軟に対応できます。

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
import { HTTP_TIMEOUT_MS, USER_AGENT_FULL } from '../constants/http-config';
import { TDNET_MIN_DELAY_MS } from '../constants/rate-limits';

async function scrapeTdnetList(date: string): Promise<Disclosure[]> {
    const TDNET_BASE_URL = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info';
    const url = `${TDNET_BASE_URL}/inbs/I_list_001_${date.replace(/-/g, '')}.html`;
    
    const response = await axios.get(url, { 
        timeout: HTTP_TIMEOUT_MS,
        headers: { 'User-Agent': USER_AGENT_FULL }
    });
    
    const $ = cheerio.load(response.data);
    const disclosures: Disclosure[] = [];
    
    $('table.kjTable tr').each((index, element) => {
        if (index === 0) return;
        const $row = $(element);
        disclosures.push({
            disclosure_id: generateDisclosureId(date, $row.find('.kjCode').text().trim(), index),
            company_code: $row.find('.kjCode').text().trim(),
            title: $row.find('.kjTitle a').text().trim(),
            pdf_url: `${TDNET_BASE_URL}${$row.find('.kjTitle a').attr('href')}`,
        });
    });
    return disclosures;
}
```

**定数の使用**:

- `HTTP_TIMEOUT_MS`: HTTPタイムアウト設定（デフォルト: 30秒）
- `USER_AGENT_FULL`: User-Agent文字列（プロジェクト情報を含む）
- `TDNET_MIN_DELAY_MS`: レート制限の最小遅延時間（デフォルト: 2秒）

詳細は `src/constants/` の各ファイルを参照してください。

## レート制限

```typescript
import { TDNET_MIN_DELAY_MS } from '../constants/rate-limits';

class RateLimiter {
    private lastRequestTime = 0;
    constructor(private minDelay = TDNET_MIN_DELAY_MS) {}
    async waitIfNeeded(): Promise<void> {
        const elapsed = Date.now() - this.lastRequestTime;
        if (elapsed < this.minDelay) await new Promise(r => setTimeout(r, this.minDelay - elapsed));
        this.lastRequestTime = Date.now();
    }
}
```

**定数の使用**:

- `TDNET_MIN_DELAY_MS`: レート制限の最小遅延時間（デフォルト: 2000ms = 2秒）
- 環境変数 `TDNET_MIN_DELAY_MS` で上書き可能

429エラー対応: `error-handling-patterns.md`参照

## ベストプラクティス

- User-Agent: `USER_AGENT_FULL` 定数を使用（`src/constants/http-config.ts`）
- タイムアウト: `HTTP_TIMEOUT_MS` 定数を使用（デフォルト: 30秒）
- レート制限: `TDNET_MIN_DELAY_MS` 定数を使用（デフォルト: 2秒）、429エラー時は指数バックオフ
- PDFバリデーション: `MIN_PDF_SIZE`～`MAX_PDF_SIZE` 定数を使用（`src/constants/file-limits.ts`）、`%PDF-`ヘッダー確認
- 並行処理: 最大5並列

**定数ファイルの参照**:

```typescript
import { MIN_PDF_SIZE, MAX_PDF_SIZE } from '../constants/file-limits';
import { HTTP_TIMEOUT_MS, USER_AGENT_FULL } from '../constants/http-config';
import { TDNET_MIN_DELAY_MS } from '../constants/rate-limits';
```

詳細は `src/constants/` の各ファイルを参照してください。

## 関連

`../core/error-handling-patterns.md`

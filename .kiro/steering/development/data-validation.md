---
inclusion: fileMatch
fileMatchPattern: '**/validators/**/*.ts|**/models/**/*.ts|**/types/**/*.ts|**/utils/date-partition*.ts|**/utils/disclosure-id*.ts'
---

# Data Validation Rules

## バリデーションルール

| フィールド | 必須 | 形式/範囲 |
|-----------|------|----------|
| disclosure_id | ✓ | `YYYYMMDD_CODE_NNN`、最大50文字 |
| company_code | ✓ | 4桁数字、1000-9999 |
| company_name | ✓ | 最大200文字 |
| disclosed_at | ✓ | ISO8601、1990年以降、未来不可 |
| date_partition | ✓ | `YYYY-MM`（disclosed_atから自動生成） |
| disclosure_type | ✓ | 最大100文字 |
| title | ✓ | 最大500文字 |
| pdf_s3_key | ✓ | `YYYY/MM/DD/CODE_TYPE_TIMESTAMP.pdf`、最大1024文字 |

## 基本実装

```typescript
function validateCompanyCode(code: string): void {
    if (!code || !/^\d{4}$/.test(code)) {
        throw new ValidationError('Invalid company_code', 'company_code');
    }
    const num = parseInt(code, 10);
    if (num < 1000 || num > 9999) {
        throw new ValidationError('company_code out of range', 'company_code');
    }
}

function generateDatePartition(disclosedAt: string): string {
    const partition = disclosedAt.substring(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(partition)) {
        throw new ValidationError('Invalid date_partition', 'disclosed_at');
    }
    return partition;
}
```

## PDFバリデーション

| 項目 | ルール |
|------|--------|
| Content-Type | `application/pdf` |
| サイズ | 10KB-50MB |
| ヘッダー | `%PDF-` で開始 |

## 必須ルール

- [ ] 早期バリデーション（入力受け取り直後）
- [ ] 詳細なエラーメッセージ
- [ ] サニタイゼーション（trim()）
- [ ] すべてのルールにテスト作成

## 関連ドキュメント

- `../core/tdnet-implementation-rules.md` - date_partition設計
- `../api/api-design-guidelines.md` - RESTful APIバリデーション

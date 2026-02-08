---
inclusion: fileMatch
fileMatchPattern: '**/validators/**/*.ts|**/models/**/*.ts|**/types/**/*.ts|**/utils/date-partition*.ts|**/utils/disclosure-id*.ts'
---

# Data Validation Rules

## バリデーションルール

| フィールド | 必須 | 形式/範囲 | 説明 |
|-----------|------|----------|------|
| disclosure_id | ✓ | `YYYYMMDD_CODE_NNN` | 一意ID、最大50文字 |
| company_code | ✓ | 4桁数字、1000-9999 | 企業コード |
| company_name | ✓ | 最大200文字 | 企業名 |
| disclosed_at | ✓ | ISO8601、1990年以降、未来不可 | 開示日時 |
| date_partition | ✓ | `YYYY-MM`、disclosed_atから自動生成 | 年月パーティション |
| disclosure_type | ✓ | 最大100文字 | 開示種類 |
| title | ✓ | 最大500文字 | タイトル |
| pdf_s3_key | ✓ | `YYYY/MM/DD/CODE_TYPE_TIMESTAMP.pdf` | S3キー、最大1024文字 |

## バリデーション実装

### 基本パターン

```typescript
import { ValidationError } from './errors';

function validateCompanyCode(code: string): void {
    if (!code || !/^\d{4}$/.test(code)) {
        throw new ValidationError('Invalid company_code', 'company_code');
    }
    const num = parseInt(code, 10);
    if (num < 1000 || num > 9999) {
        throw new ValidationError('company_code out of range', 'company_code');
    }
}
```

### date_partition生成

```typescript
function generateDatePartition(disclosedAt: string): string {
    const partition = disclosedAt.substring(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(partition)) {
        throw new ValidationError('Invalid date_partition', 'disclosed_at');
    }
    return partition;
}

// DynamoDBクエリ
async function queryByDatePartition(yearMonth: string): Promise<Disclosure[]> {
    const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: { ':partition': yearMonth },
    }));
    return result.Items as Disclosure[];
}
```

## PDFバリデーション

| 項目 | ルール |
|------|--------|
| Content-Type | `application/pdf` |
| サイズ | 10KB-50MB |
| ヘッダー | `%PDF-` で開始 |

```typescript
function validatePDFIntegrity(buffer: Buffer): void {
    if (buffer.length < 10 * 1024 || buffer.length > 50 * 1024 * 1024) {
        throw new ValidationError('Invalid file size', 'file_size');
    }
    if (buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
        throw new ValidationError('Invalid PDF header', 'pdf_integrity');
    }
}
```

## 必須ルール

- [ ] 早期バリデーション（入力受け取り直後）
- [ ] 詳細なエラーメッセージ（問題箇所を明確に）
- [ ] サニタイゼーション（バリデーション前にtrim()）
- [ ] すべてのルールにテストを作成

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - date_partition設計
- **API設計**: `../api/api-design-guidelines.md` - RESTful APIバリデーション

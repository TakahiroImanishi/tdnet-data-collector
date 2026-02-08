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
    if (!code || code.trim().length === 0) {
        throw new ValidationError('company_code is required', 'company_code');
    }
    const pattern = /^\d{4}$/;
    if (!pattern.test(code)) {
        throw new ValidationError('company_code must be a 4-digit number', 'company_code');
    }
    const codeNum = parseInt(code, 10);
    if (codeNum < 1000 || codeNum > 9999) {
        throw new ValidationError('company_code must be between 1000 and 9999', 'company_code');
    }
}
```

### date_partition生成

```typescript
function generateDatePartition(disclosedAt: string): string {
    if (!disclosedAt || disclosedAt.length < 7) {
        throw new ValidationError('Invalid disclosed_at format', 'disclosed_at');
    }
    const partition = disclosedAt.substring(0, 7); // YYYY-MM
    validateDatePartition(partition);
    return partition;
}

// DynamoDBクエリ
async function queryByDatePartition(yearMonth: string): Promise<Disclosure[]> {
    validateDatePartition(yearMonth);
    const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: { ':partition': yearMonth },
        ScanIndexForward: false,
    }));
    return result.Items as Disclosure[];
}
```

## PDFバリデーション

| 項目 | ルール |
|------|--------|
| Content-Type | `application/pdf` |
| 拡張子 | `.pdf` |
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

## 日付範囲バリデーション

```typescript
function validateDateRange(startDate: string, endDate: string): void {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
        throw new ValidationError('Invalid date format', 'date_range');
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
        throw new ValidationError('start_date must be before end_date', 'start_date');
    }
    if (start > new Date() || end > new Date()) {
        throw new ValidationError('Dates cannot be in the future', 'date_range');
    }
}
```

## 複合バリデーション

```typescript
interface DisclosureInput {
    disclosure_id: string;
    company_code: string;
    company_name: string;
    disclosure_type: string;
    title: string;
    disclosed_at: string;
    pdf_s3_key: string;
    date_partition?: string;
}

function validateAndEnrichDisclosure(input: DisclosureInput): DisclosureInput {
    validateDisclosure(input);
    if (!input.date_partition) {
        input.date_partition = generateDatePartition(input.disclosed_at);
    }
    return input;
}
```

## ベストプラクティス

1. **早期バリデーション**: 入力受け取り直後に実行
2. **詳細なエラーメッセージ**: 問題箇所を明確に
3. **サニタイゼーション**: バリデーション前にtrim()
4. **テスト**: すべてのルールにテストを作成

```typescript
// Lambda関数での使用例
export const handler = async (event: any): Promise<any> => {
    const input = JSON.parse(event.body);
    validateDisclosure(input); // 最初にバリデーション
    const result = await processDisclosure(input);
    return { statusCode: 200, body: JSON.stringify(result) };
};
```

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - date_partition設計
- **API設計**: `../api/api-design-guidelines.md` - RESTful APIバリデーション

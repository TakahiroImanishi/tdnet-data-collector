---
inclusion: fileMatch
fileMatchPattern: '**/validators/**/*.ts'
---

# Data Validation Rules

このファイルは、TDnet Data Collectorプロジェクトにおけるデータバリデーションのルールとパターンをまとめたものです。

## 開示情報バリデーション

### disclosure_id（開示情報ID）

**ルール:**
- 必須フィールド
- ユニーク制約
- 形式: `YYYYMMDD_企業コード_連番` (例: `20240115_7203_001`)
- 最大長: 50文字

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateDisclosureId(id: string): void {
    if (!id || id.trim().length === 0) {
        throw new ValidationError('disclosure_id is required', 'disclosure_id');
    }
    
    if (id.length > 50) {
        throw new ValidationError('disclosure_id must be 50 characters or less', 'disclosure_id');
    }
    
    const pattern = /^\d{8}_\d{4}_\d{3}$/;
    if (!pattern.test(id)) {
        throw new ValidationError(
            'disclosure_id must match format: YYYYMMDD_CODE_NNN',
            'disclosure_id'
        );
    }
}
```

### company_code（企業コード）

**ルール:**
- 必須フィールド
- 4桁の数字
- 範囲: 1000-9999

**バリデーション実装:**

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

### company_name（企業名）

**ルール:**
- 必須フィールド
- 最大長: 200文字
- 空白のみは不可

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateCompanyName(name: string): void {
    if (!name || name.trim().length === 0) {
        throw new ValidationError('company_name is required', 'company_name');
    }
    
    if (name.length > 200) {
        throw new ValidationError('company_name must be 200 characters or less', 'company_name');
    }
}
```

### disclosed_at（開示日時）

**ルール:**
- 必須フィールド
- ISO8601形式 (例: `2024-01-15T09:30:00+09:00`)
- 未来日付は不可
- 1990年以降のみ許可

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateDisclosedAt(dateStr: string): void {
    if (!dateStr || dateStr.trim().length === 0) {
        throw new ValidationError('disclosed_at is required', 'disclosed_at');
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        throw new ValidationError('disclosed_at must be a valid ISO8601 date', 'disclosed_at');
    }
    
    const now = new Date();
    if (date > now) {
        throw new ValidationError('disclosed_at cannot be in the future', 'disclosed_at');
    }
    
    const minDate = new Date('1990-01-01');
    if (date < minDate) {
        throw new ValidationError('disclosed_at must be after 1990-01-01', 'disclosed_at');
    }
}
```

### date_partition（年月パーティション）

**ルール:**
- 必須フィールド
- YYYY-MM形式（例: `2024-01`）
- disclosed_atから自動生成される
- 1990-01以降、現在年月以前

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateDatePartition(partition: string): void {
    if (!partition || partition.trim().length === 0) {
        throw new ValidationError('date_partition is required', 'date_partition');
    }
    
    const pattern = /^\d{4}-\d{2}$/;
    if (!pattern.test(partition)) {
        throw new ValidationError(
            'date_partition must be in YYYY-MM format',
            'date_partition'
        );
    }
    
    // 年月の妥当性チェック
    const [year, month] = partition.split('-').map(Number);
    if (month < 1 || month > 12) {
        throw new ValidationError(
            'date_partition month must be between 01 and 12',
            'date_partition'
        );
    }
    
    if (year < 1990) {
        throw new ValidationError(
            'date_partition year must be 1990 or later',
            'date_partition'
        );
    }
    
    // 未来の年月は不可
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (partition > currentYearMonth) {
        throw new ValidationError(
            'date_partition cannot be in the future',
            'date_partition'
        );
    }
}

function generateDatePartition(disclosedAt: string): string {
    /**
     * disclosed_atから年月パーティションを生成
     * 
     * @param disclosedAt - ISO8601形式の開示日時
     * @returns YYYY-MM形式の年月パーティション
     * 
     * @example
     * generateDatePartition('2024-01-15T15:00:00+09:00') // => '2024-01'
     * generateDatePartition('2024-12-31T23:59:59+09:00') // => '2024-12'
     * 
     * @throws {ValidationError} disclosed_atが不正な形式の場合
     */
    if (!disclosedAt || disclosedAt.length < 7) {
        throw new ValidationError(
            'Invalid disclosed_at format for partition generation',
            'disclosed_at'
        );
    }
    
    // ISO8601形式から年月部分を抽出（YYYY-MM）
    const partition = disclosedAt.substring(0, 7);
    
    // 生成されたパーティションをバリデーション
    validateDatePartition(partition);
    
    return partition;
}

// DynamoDBクエリでの使用例
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Disclosure } from './types';

async function queryByDatePartition(
    yearMonth: string
): Promise<Disclosure[]> {
    /**
     * date_partitionを使用した効率的なクエリ
     * 
     * @param yearMonth - YYYY-MM形式の年月
     * @returns 該当月の開示情報一覧
     */
    validateDatePartition(yearMonth);
    
    const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: {
            ':partition': yearMonth,
        },
        ScanIndexForward: false, // 降順（最新から）
    }));
    
    return result.Items as Disclosure[];
}

// 日付範囲クエリでの使用例
async function queryByDateRange(
    startDate: string,
    endDate: string
): Promise<Disclosure[]> {
    /**
     * 日付範囲での開示情報取得
     * 複数のdate_partitionにまたがる場合は並行クエリ
     * 
     * @param startDate - 開始日（YYYY-MM-DD）
     * @param endDate - 終了日（YYYY-MM-DD）
     * @returns 日付範囲内の開示情報一覧
     */
    validateDateRange(startDate, endDate);
    
    const startPartition = startDate.substring(0, 7);
    const endPartition = endDate.substring(0, 7);
    
    // 月のリストを生成
    const partitions = generateMonthRange(startPartition, endPartition);
    
    // 各月を並行クエリ
    const results = await Promise.all(
        partitions.map(partition => queryByDatePartition(partition))
    );
    
    // 結合してフィルタリング
    return results
        .flat()
        .filter(d => d.disclosed_at >= startDate && d.disclosed_at <= endDate)
        .sort((a, b) => b.disclosed_at.localeCompare(a.disclosed_at));
}

function generateMonthRange(start: string, end: string): string[] {
    /**
     * 開始月から終了月までの月リストを生成
     * 
     * @param start - 開始月（YYYY-MM）
     * @param end - 終了月（YYYY-MM）
     * @returns 月のリスト
     * 
     * @example
     * generateMonthRange('2024-01', '2024-03') // => ['2024-01', '2024-02', '2024-03']
     */
    const months: string[] = [];
    let current = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    
    while (current <= endDate) {
        months.push(
            `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
        );
        current.setMonth(current.getMonth() + 1);
    }
    
    return months;
}
```

### disclosure_type（開示種類）

**ルール:**
- 必須フィールド
- 許可される値: 決算短信、業績予想修正、配当予想修正、自己株式取得、その他
- 最大長: 100文字

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

const VALID_DISCLOSURE_TYPES = [
    '決算短信',
    '業績予想修正',
    '配当予想修正',
    '自己株式取得',
    'その他',
] as const;

function validateDisclosureType(type: string): void {
    if (!type || type.trim().length === 0) {
        throw new ValidationError('disclosure_type is required', 'disclosure_type');
    }
    
    if (type.length > 100) {
        throw new ValidationError('disclosure_type must be 100 characters or less', 'disclosure_type');
    }
}
```

### title（タイトル）

**ルール:**
- 必須フィールド
- 最大長: 500文字
- 空白のみは不可

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
        throw new ValidationError('title is required', 'title');
    }
    
    if (title.length > 500) {
        throw new ValidationError('title must be 500 characters or less', 'title');
    }
}
```

## PDFファイルバリデーション

### Content-Type検証

**ルール:**
- Content-Typeは `application/pdf` であること
- ファイル拡張子は `.pdf` であること

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validatePDFContentType(contentType: string, filename: string): void {
    if (contentType !== 'application/pdf') {
        throw new ValidationError(
            `Invalid content type: ${contentType}. Expected application/pdf`,
            'content_type'
        );
    }
    
    if (!filename.toLowerCase().endsWith('.pdf')) {
        throw new ValidationError(
            `Invalid file extension. Expected .pdf`,
            'filename'
        );
    }
}
```

### ファイルサイズ検証

**ルール:**
- 最小サイズ: 10KB（空または破損ファイルを除外）
- 最大サイズ: 50MB（Lambda制限を考慮）

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validatePDFFileSize(sizeInBytes: number): void {
    const MIN_SIZE = 10 * 1024; // 10KB
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    
    if (sizeInBytes < MIN_SIZE) {
        throw new ValidationError(
            `File size too small: ${sizeInBytes} bytes. Minimum is ${MIN_SIZE} bytes`,
            'file_size'
        );
    }
    
    if (sizeInBytes > MAX_SIZE) {
        throw new ValidationError(
            `File size too large: ${sizeInBytes} bytes. Maximum is ${MAX_SIZE} bytes`,
            'file_size'
        );
    }
}
```

### PDFファイル整合性検証

**ルール:**
- PDFヘッダー（`%PDF-`）で始まること
- PDFフッター（`%%EOF`）で終わること（オプション）

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';
import { logger } from './logger';

function validatePDFIntegrity(buffer: Buffer): void {
    // PDFヘッダーチェック
    const header = buffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
        throw new ValidationError('Invalid PDF header', 'pdf_integrity');
    }
    
    // PDFフッターチェック（オプション）
    const footer = buffer.slice(-6).toString('ascii');
    if (!footer.includes('%%EOF')) {
        logger.warn('PDF file does not end with %%EOF marker', {
            footer: footer.toString('hex'),
        });
    }
}
```

## 日付範囲バリデーション

### start_date / end_date

**ルール:**
- 両方とも必須（範囲検索の場合）
- YYYY-MM-DD形式
- start_date <= end_date
- 過去5年以内（TDnetの制限）
- 未来日付は不可

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateDateRange(startDate: string, endDate: string): void {
    // 形式チェック
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate)) {
        throw new ValidationError('start_date must be in YYYY-MM-DD format', 'start_date');
    }
    if (!datePattern.test(endDate)) {
        throw new ValidationError('end_date must be in YYYY-MM-DD format', 'end_date');
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    // 有効な日付かチェック
    if (isNaN(start.getTime())) {
        throw new ValidationError('start_date is not a valid date', 'start_date');
    }
    if (isNaN(end.getTime())) {
        throw new ValidationError('end_date is not a valid date', 'end_date');
    }
    
    // 順序チェック
    if (start > end) {
        throw new ValidationError('start_date must be before or equal to end_date', 'start_date');
    }
    
    // 未来日付チェック
    if (start > now || end > now) {
        throw new ValidationError('Dates cannot be in the future', 'date_range');
    }
    
    // 5年以内チェック
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    if (start < fiveYearsAgo) {
        throw new ValidationError(
            'start_date must be within the last 5 years',
            'start_date'
        );
    }
}
```

## S3キーバリデーション

### pdf_s3_key

**ルール:**
- 形式: `YYYY/MM/DD/{company_code}_{disclosure_type}_{timestamp}.pdf`
- 最大長: 1024文字
- 不正な文字を含まない

**バリデーション実装:**

```typescript
import { ValidationError } from './errors';

function validateS3Key(key: string): void {
    if (!key || key.trim().length === 0) {
        throw new ValidationError('s3_key is required', 's3_key');
    }
    
    if (key.length > 1024) {
        throw new ValidationError('s3_key must be 1024 characters or less', 's3_key');
    }
    
    // 不正な文字チェック
    const invalidChars = /[^a-zA-Z0-9\-_./]/;
    if (invalidChars.test(key)) {
        throw new ValidationError('s3_key contains invalid characters', 's3_key');
    }
    
    // パスの形式チェック
    const pattern = /^\d{4}\/\d{2}\/\d{2}\/\d{4}_[^_]+_\d{14}\.pdf$/;
    if (!pattern.test(key)) {
        throw new ValidationError(
            's3_key must match format: YYYY/MM/DD/CODE_TYPE_TIMESTAMP.pdf',
            's3_key'
        );
    }
}
```

### 複合バリデーション

### Disclosure全体のバリデーション

```typescript
import { ValidationError } from './errors';

interface DisclosureInput {
    disclosure_id: string;
    company_code: string;
    company_name: string;
    disclosure_type: string;
    title: string;
    disclosed_at: string;
    pdf_s3_key: string;
    date_partition?: string;  // オプション（自動生成可能）
}

function validateDisclosure(input: DisclosureInput): void {
    const errors: string[] = [];
    
    try {
        validateDisclosureId(input.disclosure_id);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateCompanyCode(input.company_code);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateCompanyName(input.company_name);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateDisclosureType(input.disclosure_type);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateTitle(input.title);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateDisclosedAt(input.disclosed_at);
    } catch (error) {
        errors.push(error.message);
    }
    
    try {
        validateS3Key(input.pdf_s3_key);
    } catch (error) {
        errors.push(error.message);
    }
    
    // date_partitionが提供されている場合はバリデーション
    if (input.date_partition) {
        try {
            validateDatePartition(input.date_partition);
        } catch (error) {
            errors.push(error.message);
        }
    }
    
    if (errors.length > 0) {
        throw new ValidationError(
            `Validation failed: ${errors.join(', ')}`,
            'disclosure'
        );
    }
}

function validateAndEnrichDisclosure(input: DisclosureInput): DisclosureInput {
    /**
     * バリデーションを実行し、不足している属性を補完
     * 
     * @param input - 開示情報入力
     * @returns バリデーション済み・補完済みの開示情報
     */
    
    // 基本バリデーション
    validateDisclosure(input);
    
    // date_partitionが未設定の場合は自動生成
    if (!input.date_partition) {
        input.date_partition = generateDatePartition(input.disclosed_at);
    }
    
    return input;
}
```

## バリデーションのベストプラクティス

### 1. 早期バリデーション

入力を受け取ったらすぐにバリデーションを実行：

```typescript
export const handler = async (event: any): Promise<any> => {
    // 最初にバリデーション
    const input = JSON.parse(event.body);
    validateDisclosure(input);
    
    // バリデーション通過後に処理
    const result = await processDisclosure(input);
    return { statusCode: 200, body: JSON.stringify(result) };
};
```

### 2. 詳細なエラーメッセージ

ユーザーが問題を理解できるように：

```typescript
throw new ValidationError(
    'company_code must be a 4-digit number between 1000 and 9999',
    'company_code'
);
```

### 3. サニタイゼーション

バリデーション前にデータをクリーンアップ：

```typescript
function sanitizeInput(input: any): DisclosureInput {
    return {
        disclosure_id: input.disclosure_id?.trim() || '',
        company_code: input.company_code?.trim() || '',
        company_name: input.company_name?.trim() || '',
        disclosure_type: input.disclosure_type?.trim() || '',
        title: input.title?.trim() || '',
        disclosed_at: input.disclosed_at?.trim() || '',
        pdf_s3_key: input.pdf_s3_key?.trim() || '',
    };
}
```

### 4. バリデーションのテスト

すべてのバリデーションルールに対してテストを作成：

```typescript
describe('validateCompanyCode', () => {
    it('should accept valid 4-digit code', () => {
        expect(() => validateCompanyCode('7203')).not.toThrow();
    });
    
    it('should reject non-numeric code', () => {
        expect(() => validateCompanyCode('ABC1')).toThrow(ValidationError);
    });
    
    it('should reject code less than 1000', () => {
        expect(() => validateCompanyCode('0999')).toThrow(ValidationError);
    });
    
    it('should reject code greater than 9999', () => {
        expect(() => validateCompanyCode('10000')).toThrow(ValidationError);
    });
});
```

## まとめ

- すべての入力データは必ずバリデーションする
- バリデーションは早期に実行（処理の最初）
- 詳細で理解しやすいエラーメッセージを提供
- サニタイゼーションとバリデーションを組み合わせる
- すべてのバリデーションルールにテストを作成
- カスタムValidationErrorクラスでエラーを明確にする

---

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - プロジェクトの基本実装原則とdate_partition設計
- **API設計ガイドライン**: `../api/api-design-guidelines.md` - RESTful API設計とバリデーション

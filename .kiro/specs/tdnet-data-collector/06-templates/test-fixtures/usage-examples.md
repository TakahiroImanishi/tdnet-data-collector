# テストフィクスチャ使用例

このドキュメントでは、TDnet Data Collectorのテストフィクスチャ（arbitraries.ts、mock-tdnet-response.html、sample-disclosure.json）の実践的な使用方法を説明します。

## 目次

1. [概要](#概要)
2. [Arbitrariesの使用方法](#arbitrariesの使用方法)
3. [Mock TDnet Responseの使用方法](#mock-tdnet-responseの使用方法)
4. [Sample Disclosureの使用方法](#sample-disclosureの使用方法)
5. [ベストプラクティス](#ベストプラクティス)

---

## 概要

### テストフィクスチャの目的

テストフィクスチャは、以下の目的で使用されます：

- **再現性**: 同じテストデータで一貫したテスト結果を得る
- **網羅性**: 正常系、エッジケース、異常系を網羅的にテスト
- **効率性**: テストデータの準備時間を削減
- **保守性**: テストデータを一元管理し、変更を容易にする

### 利点

✅ **プロパティベーステスト**: ランダムデータで広範囲のケースをテスト  
✅ **エッジケース検証**: 特殊文字、長いタイトル、欠損データなどを網羅  
✅ **統合テスト**: 実際のTDnetレスポンスに近いデータでテスト  
✅ **バリデーション**: 正常データと異常データの両方を検証

---

## Arbitrariesの使用方法

### 基本的な使い方

Arbitrariesは、fast-checkライブラリと組み合わせてプロパティベーステストを実装します。

#### 例1: 企業コードのバリデーション

```typescript
import fc from 'fast-check';
import { arbCompanyCode } from './test-fixtures/arbitraries';
import { validateCompanyCode } from '../validators/company-validator';

describe('Company Code Validation', () => {
    test('Property: 企業コードは常に4桁の数字', () => {
        fc.assert(
            fc.property(arbCompanyCode, (code) => {
                // 企業コードは4桁
                expect(code).toMatch(/^\d{4}$/);
                
                // 1000-9999の範囲
                const numCode = parseInt(code, 10);
                expect(numCode).toBeGreaterThanOrEqual(1000);
                expect(numCode).toBeLessThanOrEqual(9999);
            }),
            { numRuns: 100 } // 100回ランダムテスト
        );
    });

    test('Property: バリデーション関数は有効な企業コードを受け入れる', () => {
        fc.assert(
            fc.property(arbCompanyCode, (code) => {
                expect(() => validateCompanyCode(code)).not.toThrow();
            }),
            { numRuns: 100 }
        );
    });
});
```

#### 例2: 日付範囲のバリデーション

```typescript
import fc from 'fast-check';
import { arbDateRange } from './test-fixtures/arbitraries';
import { validateDateRange } from '../validators/date-validator';

describe('Date Range Validation', () => {
    test('Property: start_date は常に end_date 以前', () => {
        fc.assert(
            fc.property(arbDateRange, ({ start_date, end_date }) => {
                const start = new Date(start_date);
                const end = new Date(end_date);
                
                // start_date <= end_date
                expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
            }),
            { numRuns: 100 }
        );
    });
    
    test('Property: バリデーション関数は有効な日付範囲を受け入れる', () => {
        fc.assert(
            fc.property(arbDateRange, ({ start_date, end_date }) => {
                expect(() => validateDateRange(start_date, end_date)).not.toThrow();
            }),
            { numRuns: 100 }
        );
    });
});
```

#### 例3: 開示情報オブジェクトの完全性テスト

```typescript
import fc from 'fast-check';
import { arbDisclosure } from './test-fixtures/arbitraries';
import { validateDisclosure } from '../validators/disclosure-validator';

describe('Disclosure Object Validation', () => {
    test('Property: すべての必須フィールドが存在する', () => {
        fc.assert(
            fc.property(arbDisclosure, (disclosure) => {
                // 必須フィールドの存在確認
                expect(disclosure.disclosure_id).toBeDefined();
                expect(disclosure.company_code).toBeDefined();
                expect(disclosure.company_name).toBeDefined();
                expect(disclosure.disclosure_date).toBeDefined();
                expect(disclosure.disclosure_time).toBeDefined();
                expect(disclosure.disclosure_type).toBeDefined();
                expect(disclosure.title).toBeDefined();
                expect(disclosure.pdf_url).toBeDefined();
            }),
            { numRuns: 100 }
        );
    });
    
    test('Property: バリデーション関数は有効な開示情報を受け入れる', () => {
        fc.assert(
            fc.property(arbDisclosure, (disclosure) => {
                expect(() => validateDisclosure(disclosure)).not.toThrow();
            }),
            { numRuns: 100 }
        );
    });
    
    test('Property: disclosure_id は一意のフォーマット', () => {
        fc.assert(
            fc.property(arbDisclosure, (disclosure) => {
                // YYYYMMDD_企業コード_連番 のフォーマット
                expect(disclosure.disclosure_id).toMatch(/^\d{8}_\d{4}_\d{3}$/);
            }),
            { numRuns: 100 }
        );
    });
});
```

### ネガティブテスト（異常系）

#### 例4: 無効な企業コードのテスト

```typescript
import fc from 'fast-check';
import { arbInvalidCompanyCode } from './test-fixtures/arbitraries';
import { validateCompanyCode, ValidationError } from '../validators/company-validator';

describe('Invalid Company Code Handling', () => {
    test('Property: 無効な企業コードはValidationErrorをスロー', () => {
        fc.assert(
            fc.property(arbInvalidCompanyCode, (invalidCode) => {
                expect(() => validateCompanyCode(invalidCode))
                    .toThrow(ValidationError);
            }),
            { numRuns: 100 }
        );
    });
    
    test('Property: エラーメッセージに企業コードが含まれる', () => {
        fc.assert(
            fc.property(arbInvalidCompanyCode, (invalidCode) => {
                try {
                    validateCompanyCode(invalidCode);
                    fail('ValidationError should be thrown');
                } catch (error) {
                    expect(error).toBeInstanceOf(ValidationError);
                    expect(error.message).toContain('company_code');
                }
            }),
            { numRuns: 100 }
        );
    });
});
```

#### 例5: 無効な日付範囲のテスト

```typescript
import fc from 'fast-check';
import { arbInvalidDateRange } from './test-fixtures/arbitraries';
import { validateDateRange, ValidationError } from '../validators/date-validator';

describe('Invalid Date Range Handling', () => {
    test('Property: start_date > end_date の場合はエラー', () => {
        fc.assert(
            fc.property(arbInvalidDateRange, ({ start_date, end_date }) => {
                // start_date > end_date を確認
                const start = new Date(start_date);
                const end = new Date(end_date);
                expect(start.getTime()).toBeGreaterThan(end.getTime());
                
                // バリデーションエラーをスロー
                expect(() => validateDateRange(start_date, end_date))
                    .toThrow(ValidationError);
            }),
            { numRuns: 100 }
        );
    });
});
```

### 複合テスト

#### 例6: バッチ収集リクエストのテスト

```typescript
import fc from 'fast-check';
import { arbBatchCollectionRequest } from './test-fixtures/arbitraries';
import { processBatchRequest } from '../services/batch-collector';

describe('Batch Collection Request', () => {
    test('Property: バッチリクエストは正しく処理される', () => {
        fc.assert(
            fc.property(arbBatchCollectionRequest, async (request) => {
                const result = await processBatchRequest(request);
                
                // 結果の検証
                expect(result.success).toBeDefined();
                expect(result.failed).toBeDefined();
                expect(result.total).toBe(result.success + result.failed);
            }),
            { numRuns: 50 } // 非同期処理なので実行回数を減らす
        );
    });
});
```

---

## Mock TDnet Responseの使用方法

### HTMLパースのテスト

Mock TDnet Responseは、実際のTDnetのHTMLレスポンスを模倣したテストデータです。

#### 例7: 基本的なHTMLパース

```typescript
import fs from 'fs';
import path from 'path';
import { parseDisclosureList } from '../scraper/tdnet-parser';

describe('TDnet HTML Parser', () => {
    let mockHtml: string;
    
    beforeAll(() => {
        const htmlPath = path.join(__dirname, '../test-fixtures/mock-tdnet-response.html');
        mockHtml = fs.readFileSync(htmlPath, 'utf-8');
    });
    
    test('正常なHTMLから開示情報を抽出', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        // 7件の開示情報が抽出される
        expect(disclosures).toHaveLength(7);
        
        // 最初の開示情報を検証
        expect(disclosures[0]).toMatchObject({
            company_code: '7203',
            company_name: 'トヨタ自動車株式会社',
            disclosure_time: '15:00',
            title: expect.stringContaining('2024年3月期 第3四半期決算短信')
        });
    });

    test('PDFリンクの抽出', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        // PDFリンクが存在する開示情報
        const withPdf = disclosures.find(d => d.company_code === '7203');
        expect(withPdf?.pdf_url).toMatch(/\.pdf$/);
        expect(withPdf?.pdf_url).toContain('140120240115123456.pdf');
    });
});
```

### エッジケースのテスト

#### 例8: 特殊文字を含むデータの処理

```typescript
import fs from 'fs';
import path from 'path';
import { parseDisclosureList } from '../scraper/tdnet-parser';

describe('Edge Cases in HTML Parsing', () => {
    let mockHtml: string;
    
    beforeAll(() => {
        const htmlPath = path.join(__dirname, '../test-fixtures/mock-tdnet-response.html');
        mockHtml = fs.readFileSync(htmlPath, 'utf-8');
    });
    
    test('特殊文字を含む会社名とタイトルを正しく処理', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        const specialCase = disclosures.find(d => d.company_code === '9999');
        expect(specialCase).toBeDefined();
        expect(specialCase?.company_name).toContain('特殊文字テスト株式会社');
        expect(specialCase?.company_name).toContain('（旧：テスト＆サンプル）');
        expect(specialCase?.title).toContain('「」『』【】〔〕（）＆＜＞');
    });
    
    test('非常に長いタイトルを正しく処理', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        const longTitleCase = disclosures.find(d => d.company_code === '5678');
        expect(longTitleCase).toBeDefined();
        expect(longTitleCase?.title.length).toBeGreaterThan(100);
    });
    
    test('PDFリンクが存在しない場合の処理', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        const noPdfCase = disclosures.find(d => d.company_code === '1234');
        expect(noPdfCase).toBeDefined();
        expect(noPdfCase?.pdf_url).toBeUndefined();
    });
    
    test('時刻情報が欠落している場合の処理', () => {
        const disclosures = parseDisclosureList(mockHtml);
        
        const noTimeCase = disclosures.find(d => d.company_code === '4321');
        expect(noTimeCase).toBeDefined();
        expect(noTimeCase?.disclosure_time).toBeUndefined();
    });
});
```

### スクレイピングロジックのテスト

#### 例9: ページネーションの処理

```typescript
import fs from 'fs';
import path from 'path';
import { extractPaginationInfo } from '../scraper/tdnet-parser';

describe('Pagination Handling', () => {
    let mockHtml: string;
    
    beforeAll(() => {
        const htmlPath = path.join(__dirname, '../test-fixtures/mock-tdnet-response.html');
        mockHtml = fs.readFileSync(htmlPath, 'utf-8');
    });
    
    test('ページネーション情報を抽出', () => {
        const pagination = extractPaginationInfo(mockHtml);
        
        expect(pagination.currentPage).toBe(2);
        expect(pagination.totalPages).toBeGreaterThanOrEqual(5);
        expect(pagination.hasNextPage).toBe(true);
        expect(pagination.hasPreviousPage).toBe(true);
    });
});
```

#### 例10: エラーハンドリングのテスト

```typescript
import { parseDisclosureList } from '../scraper/tdnet-parser';

describe('Error Handling in HTML Parsing', () => {
    test('空のHTMLを処理', () => {
        const disclosures = parseDisclosureList('');
        expect(disclosures).toEqual([]);
    });
    
    test('不正なHTMLを処理', () => {
        const invalidHtml = '<html><body><div>Invalid</div></body></html>';
        const disclosures = parseDisclosureList(invalidHtml);
        expect(disclosures).toEqual([]);
    });
    
    test('テーブルが存在しないHTMLを処理', () => {
        const noTableHtml = '<html><body><p>No table here</p></body></html>';
        const disclosures = parseDisclosureList(noTableHtml);
        expect(disclosures).toEqual([]);
    });
});
```

---

## Sample Disclosureの使用方法

### バリデーションテスト

Sample Disclosureは、実際の開示情報データのサンプルです。

#### 例11: 正常データのバリデーション

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';
import { validateDisclosure } from '../validators/disclosure-validator';

describe('Disclosure Validation with Sample Data', () => {
    test('すべての正常データがバリデーションを通過', () => {
        sampleData.disclosures.forEach((disclosure) => {
            expect(() => validateDisclosure(disclosure)).not.toThrow();
        });
    });
    
    test('各開示情報の必須フィールドが存在', () => {
        sampleData.disclosures.forEach((disclosure) => {
            expect(disclosure.disclosure_id).toBeDefined();
            expect(disclosure.company_code).toMatch(/^\d{4}$/);
            expect(disclosure.company_name).toBeTruthy();
            expect(disclosure.disclosure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(disclosure.pdf_url).toMatch(/^https?:\/\//);
        });
    });
});
```

#### 例12: エッジケースのバリデーション

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';
import { validateDisclosure } from '../validators/disclosure-validator';

describe('Edge Cases Validation', () => {
    test('空のタイトルを処理', () => {
        const emptyTitle = sampleData.edge_cases.empty_title;
        
        // バリデーションエラーをスロー（タイトルは必須）
        expect(() => validateDisclosure(emptyTitle))
            .toThrow('title is required');
    });
    
    test('非常に長いタイトルを処理', () => {
        const longTitle = sampleData.edge_cases.long_title;
        
        // 長いタイトルも受け入れる
        expect(() => validateDisclosure(longTitle)).not.toThrow();
        expect(longTitle.title.length).toBeGreaterThan(200);
    });
    
    test('特殊文字を含むデータを処理', () => {
        const specialChars = sampleData.edge_cases.special_characters;
        
        // 特殊文字も正しく処理
        expect(() => validateDisclosure(specialChars)).not.toThrow();
        expect(specialChars.company_name).toContain('（旧：テスト＆サンプル）');
    });
});
```

#### 例13: 無効データのバリデーション

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';
import { validateDisclosure, ValidationError } from '../validators/disclosure-validator';

describe('Invalid Data Validation', () => {
    test('無効な企業コードはエラー', () => {
        const invalidCode = sampleData.invalid_data.invalid_company_code;
        
        expect(() => validateDisclosure(invalidCode))
            .toThrow(ValidationError);
        expect(() => validateDisclosure(invalidCode))
            .toThrow('company_code must be 4 digits');
    });
    
    test('無効な日付形式はエラー', () => {
        const invalidDate = sampleData.invalid_data.invalid_date_format;
        
        expect(() => validateDisclosure(invalidDate))
            .toThrow(ValidationError);
        expect(() => validateDisclosure(invalidDate))
            .toThrow('disclosure_date must be YYYY-MM-DD format');
    });
    
    test('必須フィールド欠落はエラー', () => {
        const missingField = sampleData.invalid_data.missing_required_field;
        
        expect(() => validateDisclosure(missingField))
            .toThrow(ValidationError);
        expect(() => validateDisclosure(missingField))
            .toThrow('company_name is required');
    });
});
```

### データ変換テスト

#### 例14: DynamoDB形式への変換

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';
import { convertToDynamoDBItem } from '../converters/dynamodb-converter';

describe('DynamoDB Conversion', () => {
    test('開示情報をDynamoDB形式に変換', () => {
        const disclosure = sampleData.disclosures[0];
        const dynamoItem = convertToDynamoDBItem(disclosure);
        
        // DynamoDB形式の検証
        expect(dynamoItem.disclosure_id).toEqual({ S: disclosure.disclosure_id });
        expect(dynamoItem.company_code).toEqual({ S: disclosure.company_code });
        expect(dynamoItem.company_name).toEqual({ S: disclosure.company_name });
        expect(dynamoItem.file_size).toEqual({ N: disclosure.file_size.toString() });
    });

    test('date_partition を自動生成', () => {
        const disclosure = sampleData.disclosures[0];
        const dynamoItem = convertToDynamoDBItem(disclosure);
        
        // date_partition は YYYY-MM 形式
        expect(dynamoItem.date_partition).toEqual({ S: '2024-01' });
    });
    
    test('すべてのサンプルデータを変換', () => {
        sampleData.disclosures.forEach((disclosure) => {
            expect(() => convertToDynamoDBItem(disclosure)).not.toThrow();
        });
    });
});
```

#### 例15: API レスポンス形式への変換

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';
import { convertToApiResponse } from '../converters/api-converter';

describe('API Response Conversion', () => {
    test('開示情報をAPIレスポンス形式に変換', () => {
        const disclosure = sampleData.disclosures[0];
        const apiResponse = convertToApiResponse(disclosure);
        
        // APIレスポンス形式の検証
        expect(apiResponse).toHaveProperty('disclosureId');
        expect(apiResponse).toHaveProperty('companyCode');
        expect(apiResponse).toHaveProperty('companyName');
        expect(apiResponse).toHaveProperty('disclosureDate');
        
        // キャメルケースに変換されている
        expect(apiResponse.disclosureId).toBe(disclosure.disclosure_id);
        expect(apiResponse.companyCode).toBe(disclosure.company_code);
    });
    
    test('複数の開示情報をリスト形式に変換', () => {
        const apiResponse = convertToApiResponse(sampleData.disclosures);
        
        expect(apiResponse).toHaveProperty('items');
        expect(apiResponse).toHaveProperty('total');
        expect(apiResponse.items).toHaveLength(3);
        expect(apiResponse.total).toBe(3);
    });
});
```

### 統合テスト

#### 例16: Lambda関数の統合テスト

```typescript
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import sampleData from './test-fixtures/sample-disclosure.json';
import { handler } from '../lambda/save-disclosure';

describe('Save Disclosure Lambda Integration', () => {
    const dynamoMock = mockClient(DynamoDBClient);
    
    beforeEach(() => {
        dynamoMock.reset();
    });
    
    test('開示情報をDynamoDBに保存', async () => {
        dynamoMock.on(PutItemCommand).resolves({});
        
        const disclosure = sampleData.disclosures[0];
        const event = {
            body: JSON.stringify(disclosure)
        };
        
        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        expect(dynamoMock.calls()).toHaveLength(1);
    });
    
    test('無効なデータはエラーレスポンス', async () => {
        const invalidData = sampleData.invalid_data.invalid_company_code;
        const event = {
            body: JSON.stringify(invalidData)
        };
        
        const response = await handler(event);
        
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toHaveProperty('error');
    });
});
```

---

## ベストプラクティス

### 1. テストデータの管理方法

#### ✅ 推奨: フィクスチャを一元管理

```typescript
// ✅ 良い例: フィクスチャをインポート
import sampleData from './test-fixtures/sample-disclosure.json';
import { arbDisclosure } from './test-fixtures/arbitraries';

test('バリデーションテスト', () => {
    sampleData.disclosures.forEach(disclosure => {
        expect(() => validateDisclosure(disclosure)).not.toThrow();
    });
});
```

#### ❌ 非推奨: テストコード内にハードコード

```typescript
// ❌ 悪い例: テストデータをハードコード
test('バリデーションテスト', () => {
    const disclosure = {
        disclosure_id: '20240115_7203_001',
        company_code: '7203',
        // ... 長いデータ定義
    };
    expect(() => validateDisclosure(disclosure)).not.toThrow();
});
```

### 2. フィクスチャの更新タイミング

#### 新しいフィールドを追加した場合

```typescript
// 1. arbitraries.ts を更新
export const arbDisclosure = fc.record({
    disclosure_id: arbDisclosureId,
    company_code: arbCompanyCode,
    // ... 既存フィールド
    new_field: fc.string(), // 新しいフィールドを追加
});

// 2. sample-disclosure.json を更新
{
    "disclosures": [
        {
            "disclosure_id": "20240115_7203_001",
            // ... 既存フィールド
            "new_field": "sample value" // 新しいフィールドを追加
        }
    ]
}

// 3. テストを実行して確認
npm test
```

#### バリデーションルールを変更した場合

```typescript
// 1. バリデーション関数を更新
export function validateDisclosure(disclosure: Disclosure): void {
    // 新しいバリデーションルールを追加
    if (disclosure.title.length > 500) {
        throw new ValidationError('title must be less than 500 characters');
    }
}

// 2. invalid_data にテストケースを追加
{
    "invalid_data": {
        "title_too_long": {
            "disclosure_id": "20240118_1234_003",
            "company_code": "1234",
            "title": "A".repeat(501), // 501文字のタイトル
            // ... その他のフィールド
        }
    }
}

// 3. テストを追加
test('タイトルが500文字を超える場合はエラー', () => {
    const tooLong = sampleData.invalid_data.title_too_long;
    expect(() => validateDisclosure(tooLong))
        .toThrow('title must be less than 500 characters');
});
```

### 3. プロパティテストの実行回数

```typescript
// ✅ 推奨: 用途に応じて実行回数を調整

// 高速なテスト（ユニットテスト）
fc.assert(
    fc.property(arbCompanyCode, (code) => {
        expect(code).toMatch(/^\d{4}$/);
    }),
    { numRuns: 100 } // 100回で十分
);

// 複雑なロジック（統合テスト）
fc.assert(
    fc.property(arbDisclosure, (disclosure) => {
        expect(() => validateDisclosure(disclosure)).not.toThrow();
    }),
    { numRuns: 500 } // より多くのケースをテスト
);

// 非同期処理（E2Eテスト）
fc.assert(
    fc.property(arbBatchCollectionRequest, async (request) => {
        const result = await processBatchRequest(request);
        expect(result.success).toBeGreaterThanOrEqual(0);
    }),
    { numRuns: 20 } // 実行時間を考慮して少なめに
);
```

### 4. エラーメッセージの検証

```typescript
// ✅ 推奨: エラーメッセージの内容を検証

test('無効な企業コードのエラーメッセージ', () => {
    const invalidCode = sampleData.invalid_data.invalid_company_code;
    
    try {
        validateDisclosure(invalidCode);
        fail('ValidationError should be thrown');
    } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toContain('company_code');
        expect(error.message).toContain('4 digits');
        expect(error.details).toEqual({
            field: 'company_code',
            value: invalidCode.company_code,
            constraint: '4 digits'
        });
    }
});
```

### 5. テストの独立性

```typescript
// ✅ 推奨: 各テストは独立して実行可能

describe('Disclosure Service', () => {
    let service: DisclosureService;
    
    beforeEach(() => {
        // 各テストの前に新しいインスタンスを作成
        service = new DisclosureService();
    });
    
    test('開示情報を保存', async () => {
        const disclosure = sampleData.disclosures[0];
        await service.save(disclosure);
        
        const saved = await service.findById(disclosure.disclosure_id);
        expect(saved).toEqual(disclosure);
    });
    
    test('重複する開示情報はエラー', async () => {
        const disclosure = sampleData.disclosures[0];
        await service.save(disclosure);
        
        // 同じデータを再度保存しようとするとエラー
        await expect(service.save(disclosure))
            .rejects.toThrow('Disclosure already exists');
    });
});
```

### 6. モックとフィクスチャの使い分け

```typescript
// ✅ 推奨: 適切な使い分け

// フィクスチャ: データ構造のテスト
test('開示情報のバリデーション', () => {
    const disclosure = sampleData.disclosures[0];
    expect(() => validateDisclosure(disclosure)).not.toThrow();
});

// モック: 外部サービスのテスト
test('TDnetからデータを取得', async () => {
    const mockHtml = fs.readFileSync('./test-fixtures/mock-tdnet-response.html', 'utf-8');
    
    // HTTPリクエストをモック
    nock('https://www.release.tdnet.info')
        .get('/inbs/I_list_001_01.html')
        .reply(200, mockHtml);
    
    const disclosures = await fetchDisclosures('2024-01-15');
    expect(disclosures).toHaveLength(7);
});
```

---

## まとめ

### テストフィクスチャの選択ガイド

| テスト種類 | 使用するフィクスチャ | 目的 |
|-----------|-------------------|------|
| **プロパティテスト** | arbitraries.ts | ランダムデータで広範囲のケースをテスト |
| **ユニットテスト** | sample-disclosure.json | 特定のデータ構造をテスト |
| **統合テスト** | mock-tdnet-response.html | HTMLパースとスクレイピングをテスト |
| **E2Eテスト** | すべて組み合わせ | エンドツーエンドのフローをテスト |

### 次のステップ

1. **テストを実装**: このドキュメントの例を参考にテストを作成
2. **フィクスチャを拡張**: プロジェクトの要件に応じてフィクスチャを追加
3. **継続的改善**: テストの実行結果を分析し、フィクスチャを改善

---

## 関連ドキュメント

- **[README.md](./README.md)** - テストフィクスチャの概要
- **[テスト戦略](../../../.kiro/steering/development/testing-strategy.md)** - テスト実装のベストプラクティス
- **[データバリデーション](../../../.kiro/steering/development/data-validation.md)** - バリデーションルール
- **[Correctness Propertiesチェックリスト](../../docs/correctness-properties-checklist.md)** - 検証項目

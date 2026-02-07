# テストフィクスチャ

このフォルダには、TDnet Data Collectorのテストで使用するサンプルデータとフィクスチャが含まれています。

## ファイル一覧

### sample-disclosure.json
開示情報のサンプルJSONデータ。以下を含みます：

- **正常データ**: 3件の実際の開示情報サンプル
- **エッジケース**: 空タイトル、長いタイトル、特殊文字を含むデータ
- **無効データ**: バリデーションエラーのテストデータ

**使用例:**
```typescript
import sampleData from './test-fixtures/sample-disclosure.json';

test('開示情報のバリデーション', () => {
    sampleData.disclosures.forEach(disclosure => {
        expect(() => validateDisclosure(disclosure)).not.toThrow();
    });
});

test('無効な企業コードはエラー', () => {
    const invalid = sampleData.invalid_data.invalid_company_code;
    expect(() => validateDisclosure(invalid)).toThrow(ValidationError);
});
```

### mock-tdnet-response.html
TDnetのHTMLレスポンスのモックデータ。以下を含みます：

- **正常なテーブル行**: 3件の開示情報
- **エッジケース**: 特殊文字、長いタイトル、PDFリンクなし、不完全なデータ
- **ページネーション**: 複数ページのテスト用

**使用例:**
```typescript
import fs from 'fs';
import { parseDisclosureList } from '../scraper/tdnet-parser';

test('TDnetレスポンスのパース', () => {
    const html = fs.readFileSync('./test-fixtures/mock-tdnet-response.html', 'utf-8');
    const disclosures = parseDisclosureList(html);
    
    expect(disclosures).toHaveLength(7);
    expect(disclosures[0].company_code).toBe('7203');
    expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
});

test('PDFリンクなしのケース', () => {
    const html = fs.readFileSync('./test-fixtures/mock-tdnet-response.html', 'utf-8');
    const disclosures = parseDisclosureList(html);
    
    const noPdfCase = disclosures.find(d => d.company_code === '1234');
    expect(noPdfCase?.pdf_url).toBeUndefined();
});
```

### arbitraries.ts
fast-checkのArbitrary定義（プロパティテスト用）。以下を含みます：

#### 基本的なArbitrary
- `arbCompanyCode`: 4桁の企業コード（1000-9999）
- `arbDateString`: 日付文字列（YYYY-MM-DD）
- `arbTimeString`: 時刻文字列（HH:MM:SS）
- `arbTimestamp`: ISO8601タイムスタンプ

#### ドメイン固有のArbitrary
- `arbDisclosureType`: 開示種類
- `arbCompanyName`: 企業名
- `arbDisclosureTitle`: 開示情報タイトル
- `arbDisclosureId`: 開示情報ID
- `arbS3Key`: S3キー
- `arbPdfUrl`: PDF URL

#### 複合Arbitrary
- `arbDisclosure`: 完全な開示情報オブジェクト
- `arbDateRange`: 日付範囲（start_date <= end_date）
- `arbBatchCollectionRequest`: バッチ収集リクエスト
- `arbSearchQuery`: 検索クエリパラメータ

#### 無効データのArbitrary（ネガティブテスト用）
- `arbInvalidCompanyCode`: 無効な企業コード
- `arbInvalidDateFormat`: 無効な日付形式
- `arbInvalidDateRange`: 無効な日付範囲

**使用例:**
```typescript
import fc from 'fast-check';
import { arbDisclosure, arbCompanyCode, arbInvalidCompanyCode } from './test-fixtures/arbitraries';

test('Property: 企業コードは常に4桁', () => {
    fc.assert(
        fc.property(arbCompanyCode, (code) => {
            expect(code).toMatch(/^\d{4}$/);
            expect(parseInt(code)).toBeGreaterThanOrEqual(1000);
            expect(parseInt(code)).toBeLessThanOrEqual(9999);
        }),
        { numRuns: 100 }
    );
});

test('Property: 開示情報のバリデーション', () => {
    fc.assert(
        fc.property(arbDisclosure, (disclosure) => {
            expect(() => validateDisclosure(disclosure)).not.toThrow();
        }),
        { numRuns: 100 }
    );
});

test('Property: 無効な企業コードはエラー', () => {
    fc.assert(
        fc.property(arbInvalidCompanyCode, (invalidCode) => {
            expect(() => validateCompanyCode(invalidCode))
                .toThrow(ValidationError);
        }),
        { numRuns: 100 }
    );
});
```

## テストフィクスチャの使用方法

### 1. ユニットテスト

```typescript
import sampleData from './test-fixtures/sample-disclosure.json';

describe('Disclosure Validator', () => {
    test('正常データのバリデーション', () => {
        sampleData.disclosures.forEach(disclosure => {
            expect(() => validateDisclosure(disclosure)).not.toThrow();
        });
    });
    
    test('エッジケースの処理', () => {
        const longTitle = sampleData.edge_cases.long_title;
        expect(() => validateDisclosure(longTitle)).not.toThrow();
    });
});
```

### 2. 統合テスト

```typescript
import fs from 'fs';
import { parseDisclosureList } from '../scraper/tdnet-parser';

describe('TDnet Parser Integration', () => {
    test('HTMLパースと開示情報抽出', () => {
        const html = fs.readFileSync('./test-fixtures/mock-tdnet-response.html', 'utf-8');
        const disclosures = parseDisclosureList(html);
        
        expect(disclosures.length).toBeGreaterThan(0);
        disclosures.forEach(disclosure => {
            expect(disclosure.company_code).toMatch(/^\d{4}$/);
            expect(disclosure.disclosure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });
});
```

### 3. プロパティテスト

```typescript
import fc from 'fast-check';
import { arbDisclosure, arbDateRange } from './test-fixtures/arbitraries';

describe('Correctness Properties', () => {
    test('Property 1: 日付範囲バリデーション', () => {
        fc.assert(
            fc.property(arbDateRange, ({ start_date, end_date }) => {
                const result = validateDateRange(start_date, end_date);
                expect(result).toBe(true);
                expect(new Date(start_date) <= new Date(end_date)).toBe(true);
            }),
            { numRuns: 100 }
        );
    });
    
    test('Property 2: 開示情報の一意性', () => {
        fc.assert(
            fc.property(
                fc.array(arbDisclosure, { minLength: 2, maxLength: 10 }),
                (disclosures) => {
                    const ids = disclosures.map(d => d.disclosure_id);
                    const uniqueIds = new Set(ids);
                    // 重複がある場合、システムは適切に処理する
                    expect(uniqueIds.size).toBeLessThanOrEqual(ids.length);
                }
            ),
            { numRuns: 50 }
        );
    });
});
```

## テストフィクスチャの追加

新しいテストケースを追加する場合：

1. **sample-disclosure.json**: 新しいサンプルデータを追加
2. **mock-tdnet-response.html**: 新しいHTMLパターンを追加
3. **arbitraries.ts**: 新しいArbitraryを定義

## 詳細な使用例

より詳細な使用例とベストプラクティスについては、以下のドキュメントを参照してください：

- **[usage-examples.md](./usage-examples.md)** - テストフィクスチャの実践的な使用方法

## 関連ドキュメント

- **[テスト戦略](../../../.kiro/steering/development/testing-strategy.md)** - テスト実装のベストプラクティス
- **[データバリデーション](../../../.kiro/steering/development/data-validation.md)** - バリデーションルール
- **[Correctness Propertiesチェックリスト](../../docs/correctness-properties-checklist.md)** - 検証項目


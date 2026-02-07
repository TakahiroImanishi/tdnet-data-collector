---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts'
---

# テスト戦略

このファイルは、TDnet Data Collectorプロジェクトのテスト戦略とベストプラクティスをまとめたものです。

## テストピラミッド

```
        /\
       /  \      E2Eテスト (10%)
      /____\     - API経由の完全なフロー
     /      \    - 実際のAWSリソースを使用
    /        \   
   /          \  統合テスト (20%)
  /____________\ - AWS SDK、DynamoDB、S3との統合
 /              \- モックを最小限に
/________________\
                  ユニットテスト (70%)
                  - 個別関数のテスト
                  - 完全にモック化
```

## ユニットテスト（70%）

### 対象

- 個別の関数・メソッド
- ビジネスロジック
- バリデーション
- データ変換

### ツール

- **テストフレームワーク**: Jest
- **モックライブラリ**: jest.mock()
- **プロパティテスト**: fast-check

### テストパターン

**詳細な実装例は以下を参照:**
- バリデーションテスト: `../../specs/tdnet-data-collector/templates/test-examples/validation-tests.ts`
- スクレイピングテスト: `../../specs/tdnet-data-collector/templates/test-examples/scraper-tests.ts`

**基本パターン:**

```typescript
describe('validateCompanyCode', () => {
    it('有効な4桁コードを受け入れる', () => {
        expect(() => validateCompanyCode('7203')).not.toThrow();
    });
    
    it('不正なコードを拒否する', () => {
        expect(() => validateCompanyCode('ABC1')).toThrow(ValidationError);
    });
});
```

**プロパティベーステスト:**

```typescript
import fc from 'fast-check';

it('Property: 有効な企業コード（1000-9999）は常に受け入れられる', () => {
    fc.assert(
        fc.property(
            fc.integer({ min: 1000, max: 9999 }),
            (code) => {
                const codeStr = code.toString().padStart(4, '0');
                expect(() => validateCompanyCode(codeStr)).not.toThrow();
            }
        )
    );
});
```

## 統合テスト（20%）

### 対象

- AWS SDKとの統合
- DynamoDB操作
- S3操作
- 複数コンポーネントの連携

### ツール

- **テストフレームワーク**: Jest
- **AWSモック**: aws-sdk-mock または LocalStack
- **テストコンテナ**: DynamoDB Local, LocalStack

### テストパターン

```typescript
describe('DynamoDB Integration Tests', () => {
    let client: DynamoDBDocumentClient;
    const tableName = 'tdnet-disclosures-test';
    
    beforeAll(async () => {
        // DynamoDB Localに接続
        const dynamoClient = new DynamoDBClient({
            endpoint: 'http://localhost:8000',
            region: 'ap-northeast-1',
        });
        client = DynamoDBDocumentClient.from(dynamoClient);
    });
    
    it('開示情報を保存して取得できる', async () => {
        const disclosure = createDisclosure();
        await saveDisclosure(client, tableName, disclosure);
        
        const retrieved = await getDisclosure(client, tableName, disclosure.disclosure_id);
        expect(retrieved).toMatchObject(disclosure);
    });
});
```

## E2Eテスト（10%）

### 対象

- API Gateway経由の完全なフロー
- Lambda関数の実行
- 実際のAWSリソースとの連携

### ツール

- **テストフレームワーク**: Jest
- **HTTPクライアント**: axios
- **環境**: 専用のテスト環境（AWS）

### テストパターン

```typescript
describe('API E2E Tests', () => {
    const apiUrl = process.env.API_URL;
    const apiKey = process.env.API_KEY;
    
    const client = axios.create({
        baseURL: apiUrl,
        headers: { 'X-API-Key': apiKey },
    });
    
    it('開示情報一覧を取得できる', async () => {
        const response = await client.get('/disclosures', {
            params: { limit: 10 },
        });
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status', 'success');
        expect(Array.isArray(response.data.data)).toBe(true);
    });
});
```

## テストカバレッジ目標

### 全体目標

- **ライン カバレッジ**: 80%以上
- **ブランチ カバレッジ**: 75%以上
- **関数 カバレッジ**: 85%以上

### コンポーネント別目標

| コンポーネント | カバレッジ目標 |
|--------------|--------------|
| バリデーション | 95%以上 |
| ビジネスロジック | 85%以上 |
| AWS統合 | 70%以上 |
| エラーハンドリング | 80%以上 |

### カバレッジ確認

```bash
# カバレッジレポート生成
npm run test:coverage

# カバレッジレポート表示
open coverage/lcov-report/index.html
```

## テスト実行

### ローカル実行

```bash
# すべてのテスト実行
npm test

# ユニットテストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# E2Eテストのみ
npm run test:e2e

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage
```

### CI/CD実行

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      dynamodb:
        image: amazon/dynamodb-local
        ports:
          - 8000:8000
      
      localstack:
        image: localstack/localstack
        ports:
          - 4566:4566
        env:
          SERVICES: s3,sns
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DYNAMODB_ENDPOINT: http://localhost:8000
          S3_ENDPOINT: http://localhost:4566
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## テストデータ管理

### フィクスチャ

```typescript
// fixtures/disclosures.ts
export const validDisclosure = {
    disclosure_id: '20240115_7203_001',
    company_code: '7203',
    company_name: 'トヨタ自動車株式会社',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T15:00:00+09:00',
    pdf_s3_key: '2024/01/15/7203_決算短信_20240115150000.pdf',
    downloaded_at: '2024-01-15T15:05:30+09:00',
};

export const invalidDisclosures = {
    missingCompanyCode: {
        ...validDisclosure,
        company_code: '',
    },
    invalidCompanyCode: {
        ...validDisclosure,
        company_code: 'ABC1',
    },
    futureDate: {
        ...validDisclosure,
        disclosed_at: '2099-12-31T23:59:59+09:00',
    },
};
```

### モックデータ生成

```typescript
// factories/disclosure.factory.ts
import { faker } from '@faker-js/faker';

export function createDisclosure(overrides?: Partial<Disclosure>): Disclosure {
    const date = faker.date.past();
    const companyCode = faker.number.int({ min: 1000, max: 9999 }).toString();
    
    return {
        disclosure_id: `${formatDate(date)}_${companyCode}_001`,
        company_code: companyCode,
        company_name: faker.company.name(),
        disclosure_type: faker.helpers.arrayElement([
            '決算短信',
            '業績予想修正',
            '配当予想修正',
        ]),
        title: faker.lorem.sentence(),
        disclosed_at: date.toISOString(),
        pdf_s3_key: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${companyCode}_test.pdf`,
        downloaded_at: new Date().toISOString(),
        ...overrides,
    };
}
```

## ベストプラクティス

### 1. テストの独立性

各テストは他のテストに依存せず、独立して実行可能であること。

```typescript
// ❌ 悪い例: テスト間で状態を共有
let sharedData: any;

test('test 1', () => {
    sharedData = { value: 1 };
});

test('test 2', () => {
    expect(sharedData.value).toBe(1); // test 1に依存
});

// ✅ 良い例: 各テストで独立したデータを使用
test('test 1', () => {
    const data = { value: 1 };
    expect(data.value).toBe(1);
});

test('test 2', () => {
    const data = { value: 2 };
    expect(data.value).toBe(2);
});
```

### 2. テストの可読性

テスト名は何をテストしているか明確にすること。

```typescript
// ❌ 悪い例
test('test1', () => { /* ... */ });

// ✅ 良い例
test('有効な企業コードを受け入れる', () => { /* ... */ });
test('空文字列の企業コードを拒否する', () => { /* ... */ });
```

### 3. AAA パターン

Arrange（準備）、Act（実行）、Assert（検証）の順序で記述。

```typescript
test('開示情報を保存できる', async () => {
    // Arrange
    const disclosure = createDisclosure();
    
    // Act
    await saveDisclosure(client, tableName, disclosure);
    
    // Assert
    const saved = await getDisclosure(client, tableName, disclosure.disclosure_id);
    expect(saved).toMatchObject(disclosure);
});
```

### 4. モックの適切な使用

外部依存はモック化するが、過度なモックは避ける。

```typescript
// ✅ 良い例: 外部APIはモック化
jest.mock('axios');

// ❌ 悪い例: 内部ロジックまでモック化
jest.mock('./businessLogic'); // これではテストにならない
```

## 関連ドキュメント

- **実装ルール**: `tdnet-implementation-rules.md` - プロパティテストの例
- **データバリデーション**: `data-validation.md` - バリデーションテストの対象
- **エラーハンドリング**: `error-handling-patterns.md` - エラーケースのテスト

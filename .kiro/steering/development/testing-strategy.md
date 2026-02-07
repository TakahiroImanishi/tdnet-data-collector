---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts|**/test/**/*.ts|**/tests/**/*.ts'
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

### 例: バリデーション関数のテスト

```typescript
// validateCompanyCode.test.ts
import { validateCompanyCode } from './validation';
import { ValidationError } from './errors';

describe('validateCompanyCode', () => {
    describe('正常系', () => {
        it('有効な4桁コードを受け入れる', () => {
            expect(() => validateCompanyCode('7203')).not.toThrow();
            expect(() => validateCompanyCode('1000')).not.toThrow();
            expect(() => validateCompanyCode('9999')).not.toThrow();
        });
    });
    
    describe('異常系', () => {
        it('空文字列を拒否する', () => {
            expect(() => validateCompanyCode('')).toThrow(ValidationError);
        });
        
        it('3桁以下を拒否する', () => {
            expect(() => validateCompanyCode('999')).toThrow(ValidationError);
        });
        
        it('5桁以上を拒否する', () => {
            expect(() => validateCompanyCode('10000')).toThrow(ValidationError);
        });
        
        it('数字以外を拒否する', () => {
            expect(() => validateCompanyCode('ABC1')).toThrow(ValidationError);
        });
        
        it('範囲外（< 1000）を拒否する', () => {
            expect(() => validateCompanyCode('0999')).toThrow(ValidationError);
        });
    });
});
```

### 例: プロパティベーステスト

```typescript
// validateCompanyCode.property.test.ts
import fc from 'fast-check';
import { validateCompanyCode } from './validation';
import { ValidationError } from './errors';

describe('validateCompanyCode - Property Tests', () => {
    it('Property: 有効な企業コード（1000-9999）は常に受け入れられる', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 9999 }),
                (code) => {
                    const codeStr = code.toString().padStart(4, '0');
                    expect(() => validateCompanyCode(codeStr)).not.toThrow();
                }
            ),
            { numRuns: 100 }
        );
    });
    
    it('Property: 範囲外の数値は常に拒否される', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer({ min: 0, max: 999 }),
                    fc.integer({ min: 10000, max: 99999 })
                ),
                (code) => {
                    const codeStr = code.toString();
                    expect(() => validateCompanyCode(codeStr)).toThrow(ValidationError);
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

### 例: ビジネスロジックのテスト

```typescript
// scraper.test.ts
import { scrapeDisclosureList } from './scraper';
import axios from 'axios';
import * as cheerio from 'cheerio';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('scrapeDisclosureList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    it('HTMLから開示情報を正しく抽出する', async () => {
        const mockHTML = `
            <table class="kjTable">
                <tr>
                    <td class="kjTime">15:00</td>
                    <td class="kjCode">7203</td>
                    <td class="kjName">トヨタ自動車株式会社</td>
                    <td class="kjPlace">東証プライム</td>
                    <td class="kjType">決算短信</td>
                    <td class="kjTitle">
                        <a href="/inbs/140120240115123456.pdf">
                            2024年3月期 第3四半期決算短信
                        </a>
                    </td>
                </tr>
            </table>
        `;
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            time: '15:00',
            company_code: '7203',
            company_name: 'トヨタ自動車株式会社',
            disclosure_type: '決算短信',
        });
        expect(result[0].pdf_url).toContain('/inbs/140120240115123456.pdf');
    });
    
    it('空のテーブルの場合は空配列を返す', async () => {
        const mockHTML = '<table class="kjTable"></table>';
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toEqual([]);
    });
    
    it('複数の開示情報を正しく抽出する', async () => {
        const mockHTML = `
            <table class="kjTable">
                <tr>
                    <td class="kjTime">15:00</td>
                    <td class="kjCode">7203</td>
                    <td class="kjName">トヨタ自動車株式会社</td>
                    <td class="kjPlace">東証プライム</td>
                    <td class="kjType">決算短信</td>
                    <td class="kjTitle">
                        <a href="/inbs/test1.pdf">決算短信</a>
                    </td>
                </tr>
                <tr>
                    <td class="kjTime">14:30</td>
                    <td class="kjCode">6758</td>
                    <td class="kjName">ソニーグループ株式会社</td>
                    <td class="kjPlace">東証プライム</td>
                    <td class="kjType">業績予想修正</td>
                    <td class="kjTitle">
                        <a href="/inbs/test2.pdf">業績予想修正</a>
                    </td>
                </tr>
            </table>
        `;
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toHaveLength(2);
        expect(result[0].company_code).toBe('7203');
        expect(result[1].company_code).toBe('6758');
    });
    
    it('不完全なデータ行はスキップする', async () => {
        const mockHTML = `
            <table class="kjTable">
                <tr>
                    <td class="kjTime">15:00</td>
                    <td class="kjCode">7203</td>
                    <td class="kjName">トヨタ自動車株式会社</td>
                    <td class="kjTitle">
                        <a href="/inbs/test1.pdf">決算短信</a>
                    </td>
                </tr>
                <tr>
                    <td class="kjTime"></td>
                    <td class="kjCode"></td>
                    <td class="kjName"></td>
                    <td class="kjTitle"></td>
                </tr>
                <tr>
                    <td class="kjTime">14:30</td>
                    <td class="kjCode">6758</td>
                    <td class="kjName">ソニーグループ株式会社</td>
                    <td class="kjTitle">
                        <a href="/inbs/test2.pdf">業績予想修正</a>
                    </td>
                </tr>
            </table>
        `;
        
        mockedAxios.get.mockResolvedValue({
            data: Buffer.from(mockHTML, 'utf-8'),
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        // 不完全な行（2行目）はスキップされる
        expect(result).toHaveLength(2);
    });
    
    it('ネットワークエラー時は適切にエラーをスローする', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network error'));
        
        await expect(scrapeDisclosureList('20240115')).rejects.toThrow('Network error');
    });
    
    it('404エラー時は空配列を返す', async () => {
        mockedAxios.get.mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        });
        
        const result = await scrapeDisclosureList('20240115');
        
        expect(result).toEqual([]);
    });
    
    it('500エラー時はRetryableErrorをスローする', async () => {
        mockedAxios.get.mockRejectedValue({
            isAxiosError: true,
            response: { status: 500 },
        });
        
        await expect(scrapeDisclosureList('20240115')).rejects.toThrow('RetryableError');
    });
});

describe('extractDisclosureType', () => {
    it('タイトルから開示種類を正しく抽出する', () => {
        expect(extractDisclosureType('2024年3月期 第3四半期決算短信')).toBe('決算短信');
        expect(extractDisclosureType('業績予想の修正に関するお知らせ')).toBe('業績予想修正');
        expect(extractDisclosureType('配当予想の修正に関するお知らせ')).toBe('配当予想修正');
        expect(extractDisclosureType('自己株式の取得に関するお知らせ')).toBe('自己株式取得');
        expect(extractDisclosureType('株式分割に関するお知らせ')).toBe('株式分割');
    });
    
    it('該当しない場合は「その他」を返す', () => {
        expect(extractDisclosureType('特別なお知らせ')).toBe('その他');
        expect(extractDisclosureType('')).toBe('その他');
    });
});

describe('generateDisclosureId', () => {
    it('正しいフォーマットのIDを生成する', () => {
        const id = generateDisclosureId('2024-01-15', '7203', 1);
        expect(id).toBe('20240115_7203_001');
    });
    
    it('連番を3桁でゼロパディングする', () => {
        expect(generateDisclosureId('2024-01-15', '7203', 1)).toBe('20240115_7203_001');
        expect(generateDisclosureId('2024-01-15', '7203', 10)).toBe('20240115_7203_010');
        expect(generateDisclosureId('2024-01-15', '7203', 100)).toBe('20240115_7203_100');
    });
});
```

### 例: PDFダウンロードのテスト

```typescript
// pdf-downloader.test.ts
import { downloadPDF } from './pdf-downloader';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';

jest.mock('axios');
jest.mock('@aws-sdk/client-s3');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedS3Client = S3Client as jest.MockedClass<typeof S3Client>;

describe('downloadPDF', () => {
    let s3Client: jest.Mocked<S3Client>;
    
    beforeEach(() => {
        jest.clearAllMocks();
        s3Client = new mockedS3Client({}) as jest.Mocked<S3Client>;
    });
    
    it('PDFを正常にダウンロードしてS3にアップロードする', async () => {
        const mockPDFBuffer = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
        
        mockedAxios.get.mockResolvedValue({
            data: mockPDFBuffer,
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/pdf' },
            config: {} as any,
        });
        
        s3Client.send = jest.fn().mockResolvedValue({});
        
        const result = await downloadPDF(
            'https://example.com/test.pdf',
            '2024/01/15/test.pdf',
            s3Client,
            'test-bucket'
        );
        
        expect(result.success).toBe(true);
        expect(result.fileSize).toBe(mockPDFBuffer.length);
        expect(s3Client.send).toHaveBeenCalledWith(
            expect.any(PutObjectCommand)
        );
    });
    
    it('PDFヘッダーが不正な場合はエラーをスローする', async () => {
        const invalidBuffer = Buffer.from('Not a PDF file');
        
        mockedAxios.get.mockResolvedValue({
            data: invalidBuffer,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        await expect(
            downloadPDF(
                'https://example.com/test.pdf',
                '2024/01/15/test.pdf',
                s3Client,
                'test-bucket'
            )
        ).rejects.toThrow('Invalid PDF header');
    });
    
    it('ファイルサイズが小さすぎる場合はエラーをスローする', async () => {
        const tooSmallBuffer = Buffer.from('%PDF-');
        
        mockedAxios.get.mockResolvedValue({
            data: tooSmallBuffer,
            status: 200,
            statusText: 'OK',
            headers: {},
            config: {} as any,
        });
        
        await expect(
            downloadPDF(
                'https://example.com/test.pdf',
                '2024/01/15/test.pdf',
                s3Client,
                'test-bucket'
            )
        ).rejects.toThrow('PDF file too small');
    });
    
    it('タイムアウト時はRetryableErrorをスローする', async () => {
        mockedAxios.get.mockRejectedValue({
            code: 'ECONNABORTED',
            isAxiosError: true,
        });
        
        await expect(
            downloadPDF(
                'https://example.com/test.pdf',
                '2024/01/15/test.pdf',
                s3Client,
                'test-bucket'
            )
        ).rejects.toThrow('RetryableError');
    });
    
    it('404エラー時は非再試行エラーをスローする', async () => {
        mockedAxios.get.mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        });
        
        await expect(
            downloadPDF(
                'https://example.com/test.pdf',
                '2024/01/15/test.pdf',
                s3Client,
                'test-bucket'
            )
        ).rejects.toThrow('PDF not found');
    });
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

### 例: DynamoDB統合テスト

```typescript
// dynamodb.integration.test.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { saveDisclosure, getDisclosure } from './dynamodb';

describe('DynamoDB Integration Tests', () => {
    let client: DynamoDBDocumentClient;
    const tableName = 'tdnet-disclosures-test';
    
    beforeAll(async () => {
        // DynamoDB Localに接続
        const dynamoClient = new DynamoDBClient({
            endpoint: 'http://localhost:8000',
            region: 'ap-northeast-1',
            credentials: {
                accessKeyId: 'dummy',
                secretAccessKey: 'dummy',
            },
        });
        
        client = DynamoDBDocumentClient.from(dynamoClient);
        
        // テストテーブルを作成
        // （実際にはsetup scriptで作成）
    });
    
    afterEach(async () => {
        // テストデータをクリーンアップ
    });
    
    it('開示情報を保存して取得できる', async () => {
        const disclosure = {
            disclosure_id: '20240115_7203_001',
            company_code: '7203',
            company_name: 'トヨタ自動車株式会社',
            disclosure_type: '決算短信',
            title: '2024年3月期 第3四半期決算短信',
            disclosed_at: '2024-01-15T15:00:00+09:00',
            pdf_s3_key: '2024/01/15/7203_決算短信_20240115150000.pdf',
            downloaded_at: new Date().toISOString(),
        };
        
        // 保存
        await saveDisclosure(client, tableName, disclosure);
        
        // 取得
        const retrieved = await getDisclosure(client, tableName, disclosure.disclosure_id);
        
        expect(retrieved).toMatchObject(disclosure);
    });
    
    it('重複する開示情報は拒否される', async () => {
        const disclosure = {
            disclosure_id: '20240115_7203_002',
            company_code: '7203',
            company_name: 'トヨタ自動車株式会社',
            disclosure_type: '決算短信',
            title: 'テスト',
            disclosed_at: '2024-01-15T15:00:00+09:00',
            pdf_s3_key: '2024/01/15/test.pdf',
            downloaded_at: new Date().toISOString(),
        };
        
        // 1回目は成功
        await saveDisclosure(client, tableName, disclosure);
        
        // 2回目は失敗
        await expect(
            saveDisclosure(client, tableName, disclosure)
        ).rejects.toThrow('ConditionalCheckFailedException');
    });
});
```

### 例: S3統合テスト

```typescript
// s3.integration.test.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { uploadPDF, downloadPDF } from './s3';

describe('S3 Integration Tests', () => {
    let client: S3Client;
    const bucketName = 'tdnet-pdfs-test';
    
    beforeAll(() => {
        // LocalStackに接続
        client = new S3Client({
            endpoint: 'http://localhost:4566',
            region: 'ap-northeast-1',
            credentials: {
                accessKeyId: 'test',
                secretAccessKey: 'test',
            },
            forcePathStyle: true,
        });
    });
    
    it('PDFファイルをアップロードしてダウンロードできる', async () => {
        const pdfBuffer = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
        const s3Key = '2024/01/15/test.pdf';
        
        // アップロード
        await uploadPDF(client, bucketName, s3Key, pdfBuffer);
        
        // ダウンロード
        const downloaded = await downloadPDF(client, bucketName, s3Key);
        
        expect(downloaded).toEqual(pdfBuffer);
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

### 例: API E2Eテスト

```typescript
// api.e2e.test.ts
import axios from 'axios';

describe('API E2E Tests', () => {
    const apiUrl = process.env.API_URL || 'https://api-test.example.com';
    const apiKey = process.env.API_KEY || 'test-api-key';
    
    const client = axios.create({
        baseURL: apiUrl,
        headers: {
            'X-API-Key': apiKey,
        },
    });
    
    describe('GET /disclosures', () => {
        it('開示情報一覧を取得できる', async () => {
            const response = await client.get('/disclosures', {
                params: {
                    limit: 10,
                },
            });
            
            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('status', 'success');
            expect(response.data).toHaveProperty('data');
            expect(Array.isArray(response.data.data)).toBe(true);
            expect(response.data).toHaveProperty('meta');
        });
        
        it('企業コードでフィルタリングできる', async () => {
            const response = await client.get('/disclosures', {
                params: {
                    company_code: '7203',
                    limit: 10,
                },
            });
            
            expect(response.status).toBe(200);
            response.data.data.forEach((item: any) => {
                expect(item.company_code).toBe('7203');
            });
        });
    });
    
    describe('POST /collect', () => {
        it('データ収集を開始できる', async () => {
            const response = await client.post('/collect', {
                start_date: '2024-01-15',
                end_date: '2024-01-15',
            });
            
            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('status', 'success');
            expect(response.data.data).toHaveProperty('execution_id');
        });
    });
});
```

### 例: Lambda E2Eテスト

```typescript
// lambda.e2e.test.ts
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

describe('Lambda E2E Tests', () => {
    let client: LambdaClient;
    const functionName = 'tdnet-collector-test';
    
    beforeAll(() => {
        client = new LambdaClient({
            region: 'ap-northeast-1',
        });
    });
    
    it('バッチ収集が正常に実行される', async () => {
        const payload = {
            mode: 'batch',
            date: '2024-01-15',
        };
        
        const command = new InvokeCommand({
            FunctionName: functionName,
            Payload: Buffer.from(JSON.stringify(payload)),
        });
        
        const response = await client.send(command);
        
        expect(response.StatusCode).toBe(200);
        
        const result = JSON.parse(
            Buffer.from(response.Payload!).toString()
        );
        
        expect(result).toHaveProperty('collected_count');
        expect(result).toHaveProperty('failed_count');
    }, 60000); // 60秒タイムアウト
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

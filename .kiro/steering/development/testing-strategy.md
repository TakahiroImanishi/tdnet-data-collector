---
inclusion: fileMatch
fileMatchPattern: '**/*.test.ts|**/*.spec.ts'
---

# テスト戦略

## テスト比率

- **ユニットテスト**: 70% - 個別関数、ビジネスロジック、バリデーション
- **統合テスト**: 20% - AWS SDK、DynamoDB、S3との統合
- **E2Eテスト**: 10% - API経由の完全なフロー

## カバレッジ目標

| 項目 | 目標 |
|------|------|
| ライン | 80%以上 |
| ブランチ | 75%以上 |
| 関数 | 85%以上 |
| バリデーション | 95%以上 |
| ビジネスロジック | 85%以上 |
| AWS統合 | 70%以上 |

## テストパターン

### ユニットテスト

```typescript
// 基本パターン
describe('validateCompanyCode', () => {
    it('有効な4桁コードを受け入れる', () => {
        expect(() => validateCompanyCode('7203')).not.toThrow();
    });
});

// プロパティテスト
import fc from 'fast-check';
it('Property: 1000-9999は常に受け入れられる', () => {
    fc.assert(fc.property(fc.integer({ min: 1000, max: 9999 }), (code) => {
        expect(() => validateCompanyCode(code.toString().padStart(4, '0'))).not.toThrow();
    }));
});
```

### 統合テスト

```typescript
// DynamoDB Local使用
describe('DynamoDB Integration', () => {
    let client: DynamoDBDocumentClient;
    
    beforeAll(() => {
        client = DynamoDBDocumentClient.from(new DynamoDBClient({
            endpoint: 'http://localhost:8000',
            region: 'ap-northeast-1',
        }));
    });
    
    it('開示情報を保存して取得できる', async () => {
        const disclosure = createDisclosure();
        await saveDisclosure(client, tableName, disclosure);
        const retrieved = await getDisclosure(client, tableName, disclosure.disclosure_id);
        expect(retrieved).toMatchObject(disclosure);
    });
});

// Secrets Managerモック
import { mockClient } from 'aws-sdk-client-mock';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

describe('Secrets Manager Integration', () => {
    const secretsManagerMock = mockClient(SecretsManagerClient);
    
    beforeEach(() => {
        secretsManagerMock.reset();
    });
    
    it('APIキーを取得できる', async () => {
        secretsManagerMock.on(GetSecretValueCommand).resolves({
            SecretString: JSON.stringify({ apiKey: 'test-api-key-12345' }),
        });
        
        const secret = await getSecret('tdnet-api-key');
        expect(secret.apiKey).toBe('test-api-key-12345');
    });
    
    it('シークレット取得失敗時にエラーをスローする', async () => {
        secretsManagerMock.on(GetSecretValueCommand).rejects(new Error('ResourceNotFoundException'));
        
        await expect(getSecret('invalid-secret')).rejects.toThrow('ResourceNotFoundException');
    });
});
```

### E2Eテスト

```typescript
// API経由のテスト
describe('API E2E', () => {
    const client = axios.create({
        baseURL: process.env.API_URL,
        headers: { 'X-API-Key': process.env.API_KEY },
    });
    
    it('開示情報一覧を取得できる', async () => {
        const response = await client.get('/disclosures', { params: { limit: 10 } });
        expect(response.status).toBe(200);
        expect(Array.isArray(response.data.data)).toBe(true);
    });
});
```

## テスト実行

### 基本コマンド

```bash
npm test                    # すべて
npm run test:unit           # ユニットのみ
npm run test:integration    # 統合のみ
npm run test:e2e            # E2Eのみ
npm run test:coverage       # カバレッジ付き
```

### CI/CD・自動化用コマンド

**必須**: テストは対話モードで停止せず、完全に自動実行されること。

```bash
# watch mode無効化（対話停止を防止）
npm test -- --watchAll=false

# 特定のテストのみ実行
npm test -- --testPathPattern="TestName" --watchAll=false --no-coverage

# カバレッジ付き（CI/CD推奨）
npm test -- --watchAll=false --coverage

# 失敗時に即座に終了
npm test -- --watchAll=false --bail
```

### テスト実行ルール

#### 1. 対話モード禁止

- ❌ `jest --watch` や `npm test`（デフォルト）は対話モードで停止する
- ✅ `--watchAll=false`を必ず指定してCI/CD環境で実行可能にする
- ✅ テスト完了後は自動的に終了すること

#### 2. 対話的入力禁止

- ❌ `readline`、`prompt`、`inquirer`などの対話的入力
- ❌ ユーザー入力待ちのテスト
- ❌ 手動確認が必要なテスト
- ✅ すべてのテストデータはコード内で定義
- ✅ モック、スタブ、フィクスチャを使用
- ✅ CI/CD環境で無人実行可能

#### 3. タイムアウト設定

```typescript
// 長時間実行テストにはタイムアウトを設定
it('長時間処理のテスト', async () => {
    // ...
}, 30000); // 30秒タイムアウト

// グローバル設定（jest.config.js）
module.exports = {
    testTimeout: 10000, // デフォルト10秒
};
```

#### 4. 並列実行制御

```bash
# 並列実行数を制限（メモリ不足対策）
npm test -- --maxWorkers=2 --watchAll=false

# シーケンシャル実行（統合テスト推奨）
npm test -- --runInBand --watchAll=false
```

## ベストプラクティス

### 1. テストの独立性
各テストは独立して実行可能であること（共有状態を避ける）

### 2. AAA パターン
Arrange（準備）→ Act（実行）→ Assert（検証）の順序

### 3. 明確なテスト名
何をテストしているか一目でわかる名前を使用

### 4. 適切なモック
外部依存はモック化、内部ロジックはモック化しない

## テストデータ

```typescript
// フィクスチャ（fixtures/disclosures.ts）
export const validDisclosure = {
    disclosure_id: '20240115_7203_001',
    company_code: '7203',
    company_name: 'トヨタ自動車株式会社',
    // ...
};

// ファクトリー（factories/disclosure.factory.ts）
export function createDisclosure(overrides?: Partial<Disclosure>): Disclosure {
    return {
        disclosure_id: `${formatDate(faker.date.past())}_${faker.number.int({ min: 1000, max: 9999 })}_001`,
        company_code: faker.number.int({ min: 1000, max: 9999 }).toString(),
        company_name: faker.company.name(),
        // ...
        ...overrides,
    };
}
```

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - プロパティテストの例
- **詳細な実装例**: `../../specs/tdnet-data-collector/templates/test-examples/` - バリデーション、スクレイピングテスト

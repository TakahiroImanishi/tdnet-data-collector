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

## テストパターン

### ユニットテスト

```typescript
describe('validateCompanyCode', () => {
    it('有効な4桁コードを受け入れる', () => {
        expect(() => validateCompanyCode('7203')).not.toThrow();
    });
});

// プロパティテスト
import fc from 'fast-check';
fc.assert(fc.property(fc.integer({ min: 1000, max: 9999 }), (code) => {
    expect(() => validateCompanyCode(code.toString())).not.toThrow();
}));
```

### 統合テスト

```typescript
// DynamoDB Local使用
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'ap-northeast-1',
}));

// Secrets Managerモック
import { mockClient } from 'aws-sdk-client-mock';
const secretsManagerMock = mockClient(SecretsManagerClient);
secretsManagerMock.on(GetSecretValueCommand).resolves({
    SecretString: JSON.stringify({ apiKey: 'test-key' }),
});
```

## テスト実行

```bash
npm test                    # すべて
npm run test:unit           # ユニットのみ
npm run test:integration    # 統合のみ
npm run test:coverage       # カバレッジ付き

# CI/CD用（対話モード無効化）
npm test -- --watchAll=false
npm test -- --watchAll=false --coverage
```

## 必須ルール

- [ ] 対話モード禁止（`--watchAll=false`必須）
- [ ] 各テストは独立して実行可能
- [ ] 外部依存はモック化
- [ ] AAA パターン（Arrange → Act → Assert）

## 関連ドキュメント

- **実装ルール**: `../core/tdnet-implementation-rules.md` - プロパティテストの例
- **詳細な実装例**: `../../specs/tdnet-data-collector/templates/test-examples/` - バリデーション、スクレイピングテスト

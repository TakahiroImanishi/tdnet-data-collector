# テスト戦略

**最終更新:** 2026-02-22

## 統合テストの必須要件

### LocalStack環境

すべての統合テストはLocalStack環境で実行すること：

- **必須サービス**: DynamoDB、S3、Lambda
- **環境変数**: 
  - `AWS_ENDPOINT_URL`: LocalStackエンドポイント
  - `DYNAMODB_TABLE`: テスト用テーブル名
  - `S3_BUCKET`: テスト用バケット名

### 条件付き実行

LocalStack環境でない場合は`test.skip`でスキップ：

```typescript
const isLocalStack = process.env.AWS_ENDPOINT_URL?.includes('localhost');

(isLocalStack ? describe : describe.skip)('Integration tests', () => {
  // テストケース
});
```

### テストケース

- DynamoDBへのデータ保存確認
- S3へのPDFアップロード確認
- 実行状態の遷移確認
- 複数データの一括保存確認
- エラー時の適切なハンドリング確認

### タイムアウト設定

統合テストは30秒のタイムアウトを設定：

```typescript
jest.setTimeout(30000);
```

## モック/スタブの標準パターン

### axios-mock-adapter

HTTPリクエストのモック：

```typescript
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

const mockAxios = new MockAdapter(axios);

mockAxios.onGet('/api/endpoint').reply(200, { data: 'test' });
```

### AWS SDK v3のモック

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

ddbMock.on(PutCommand).resolves({});
```

## 参照

- [testing-strategy.md](../../../steering/development/testing-strategy.md)
- [error-handling-patterns.md](../../../steering/core/error-handling-patterns.md)
- `work-log-20260222-185043-subagent3-testing-requirements.md`

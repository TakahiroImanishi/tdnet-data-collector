# 作業記録: タスク50サブタスク1 - Query Handlerテスト修正

## 基本情報
- **作業日時**: 2026-02-22 14:37:27
- **タスク**: タスク50サブタスク1
- **作業内容**: Lambda Query Handlerテストの3つの失敗を修正
- **対象ファイル**: `src/lambda/query/__tests__/handler.test.ts`

## 作業手順

### 1. テスト実行と失敗内容の確認


**テスト実行結果（初回）:**
```
Test Suites: 1 failed, 1 total
Tests:       3 failed, 23 passed, 26 total
```

**失敗したテスト:**
1. APIキーが未設定の場合は401エラー - 期待値401、実際は200
2. 無効なAPIキーの場合は401エラー - 期待値401、実際は200
3. エラーレスポンスにもCORSヘッダーが含まれる - 期待値401、実際は200

### 2. 失敗原因の特定

**根本原因:** Query Handlerの実装にAPIキー認証ロジックが存在しない

**詳細:**
- `src/lambda/query/handler.ts`にAPIキー認証の実装がない
- テストでは`process.env.TEST_ENV = 'e2e'`を設定しているが、実装側で認証チェックがないため全てのリクエストが200を返す
- 他のハンドラー（PDF download）には認証実装が存在する

### 3. 修正内容

#### 3.1 handler.tsの修正

**ファイル:** `src/lambda/query/handler.ts`

**変更1: AuthenticationErrorのインポート追加**
```typescript
import { ValidationError, NotFoundError, AuthenticationError } from '../../errors';
```

**変更2: handler関数内に認証チェック追加**
```typescript
// APIキー認証（テスト環境以外）
if (process.env.TEST_ENV !== 'e2e') {
  validateApiKey(event);
}
```

**変更3: validateApiKey関数の追加**
```typescript
/**
 * APIキー認証
 *
 * @param event APIGatewayProxyEvent
 * @throws AuthenticationError APIキーが無効な場合
 */
function validateApiKey(event: APIGatewayProxyEvent): void {
  const apiKey = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
  const expectedApiKey = process.env.API_KEY;

  if (!apiKey) {
    throw new AuthenticationError('API key is required');
  }

  if (!expectedApiKey) {
    throw new AuthenticationError('API key configuration is missing');
  }

  if (apiKey !== expectedApiKey) {
    throw new AuthenticationError('Invalid API key');
  }
}
```

**変更4: handleError関数にAuthenticationError処理追加**
```typescript
} else if (error instanceof AuthenticationError) {
  statusCode = 401;
  errorCode = 'UNAUTHORIZED';
}
```

#### 3.2 handler.test.tsの修正

**ファイル:** `src/lambda/query/__tests__/handler.test.ts`

**変更1: APIキー認証テストでTEST_ENVを削除**
```typescript
describe('APIキー認証', () => {
  beforeEach(() => {
    // APIキー認証テストでは認証を有効化
    delete process.env.TEST_ENV;
  });

  afterEach(() => {
    // 他のテストのために元に戻す
    process.env.TEST_ENV = 'e2e';
  });
  // ...
});
```

**変更2: CORS対応のエラーテストでTEST_ENVを削除**
```typescript
it('エラーレスポンスにもCORSヘッダーが含まれる', async () => {
  // APIキー認証を有効化
  delete process.env.TEST_ENV;
  
  mockEvent.headers = {}; // APIキーなし

  const result = await handler(mockEvent, mockContext);

  expect(result.statusCode).toBe(401);
  expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
  
  // 元に戻す
  process.env.TEST_ENV = 'e2e';
});
```

### 4. テスト実行結果（修正後）

```
Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
Time:        0.914 s
```

**結果:** ✅ 全テストパス

## 成果物

### 修正ファイル
1. `src/lambda/query/handler.ts` - APIキー認証ロジック追加
2. `src/lambda/query/__tests__/handler.test.ts` - テスト環境変数の制御追加

### 修正内容サマリー
- Query HandlerにAPIキー認証機能を実装
- AuthenticationErrorクラスを使用した認証エラー処理
- テスト環境（TEST_ENV='e2e'）では認証をスキップ
- ユニットテストでは認証を有効化して正しくテスト

## 申し送り事項

### 確認済み
- ✅ 全26テストがパス
- ✅ APIキー認証が正しく動作
- ✅ エラーレスポンスにCORSヘッダーが含まれる
- ✅ 他のテストに影響なし

### 次のステップ
- タスク50サブタスク2: Export Handlerテストの修正
- タスク50サブタスク3: API Handlerテストの修正

### 技術的メモ
- PDF downloadハンドラーと同じ認証パターンを採用
- TEST_ENV環境変数でE2Eテストと認証テストを分離
- beforeEach/afterEachで環境変数を適切に制御

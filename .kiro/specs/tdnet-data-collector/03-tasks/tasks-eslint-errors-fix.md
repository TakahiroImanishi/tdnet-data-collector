# ESLintエラー解消タスク

## 概要

プロジェクト全体のESLintエラー（2501エラー、466警告）を段階的に解消します。テストファイルのmock型安全性、require文、その他の型安全性問題を優先的に修正します。

**作成日時**: 2026-02-23 15:57:46  
**優先度**: 高（コード品質向上）  
**カテゴリ**: 型安全性・コード品質

---

## 現状分析

### Lint実行結果（2026-02-23 15:54時点）

```
✖ 2967 problems (2501 errors, 466 warnings)
  253 errors and 0 warnings potentially fixable with the `--fix` option.
```

### エラー分類

#### 1. テストファイルのmock型安全性エラー（最多）
- `@typescript-eslint/no-unsafe-assignment`: mock変数への`any`型代入
- `@typescript-eslint/no-unsafe-member-access`: mockオブジェクトのプロパティアクセス
- `@typescript-eslint/no-unsafe-call`: mock関数の呼び出し
- `@typescript-eslint/no-var-requires`: `require()`文の使用

**影響ファイル**:
- `src/utils/__tests__/logger.test.ts`: 約200エラー
- `src/utils/__tests__/metrics.test.ts`: 約100エラー
- その他のテストファイル

#### 2. 型安全性エラー
- `@typescript-eslint/no-explicit-any`: 明示的な`any`型の使用
- `@typescript-eslint/explicit-function-return-type`: 関数の戻り値型が未定義
- `@typescript-eslint/require-await`: `async`関数に`await`がない
- `@typescript-eslint/no-unused-vars`: 未使用変数

#### 3. その他のエラー
- `@typescript-eslint/unbound-method`: メソッドの参照問題
- `prettier/prettier`: コードスタイル（自動修正可能）

---

## タスク一覧

### Phase 1: 自動修正可能なエラー（優先度: 最高）

#### Task 1.1: Prettier自動修正 ⚡

**目的**: 自動修正可能なコードスタイルエラーを一括修正

**実装内容**:
```powershell
# Prettier自動修正
npm run lint -- --fix

# 修正結果確認
npm run lint > lint-report-after-fix.txt 2>&1
```

**完了条件**:
- [ ] Prettier自動修正実行
- [ ] 修正後のエラー数確認（253エラー減少予想）
- [ ] Git commit

**見積**: 10分

---

### Phase 2: テストファイルのmock型安全性修正（優先度: 高）

#### Task 2.1: logger.test.ts型安全性修正 ⚡

**目的**: logger.test.tsのmock型安全性エラー（約200エラー）を解消

**問題箇所**:
```typescript
// 現状（型安全でない）
const winston = require('winston');
const calls = winston.createLogger.mock.calls;

// 修正後（型安全）
import * as winston from 'winston';
const mockCreateLogger = winston.createLogger as jest.MockedFunction<typeof winston.createLogger>;
const calls = mockCreateLogger.mock.calls;
```

**実装方針**:
1. `require()`を`import`に変更
2. mock関数に適切な型アサーションを追加
3. `jest.MockedFunction`型を使用

**完了条件**:
- [ ] `require()`を`import`に変更
- [ ] mock関数に型アサーション追加
- [ ] ESLintエラー0件
- [ ] テスト49/49成功

**見積**: 1時間

---

#### Task 2.2: metrics.test.ts型安全性修正 ⚡

**目的**: metrics.test.tsのmock型安全性エラー（約100エラー）を解消

**問題箇所**:
```typescript
// 現状（型安全でない）
const mockCloudWatch = require('@aws-sdk/client-cloudwatch');
mockCloudWatch.send.mockResolvedValue({});

// 修正後（型安全）
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => ({ send: mockSend })),
}));
```

**実装方針**:
1. `require()`を`import`に変更
2. `jest.mock()`で型安全なmockを作成
3. mock関数に適切な型を追加

**完了条件**:
- [ ] `require()`を`import`に変更
- [ ] 型安全なmock作成
- [ ] ESLintエラー0件
- [ ] テスト成功

**見積**: 1時間

---

#### Task 2.3: その他テストファイルの型安全性修正 ⚡

**目的**: 残りのテストファイルのmock型安全性エラーを解消

**対象ファイル**:
- `src/utils/__tests__/rate-limiter.test.ts`
- `src/utils/__tests__/rate-limiter.property.test.ts`
- `src/utils/__tests__/retry.property.test.ts`
- `src/validators/__tests__/disclosure-schema.test.ts`

**実装方針**:
1. `require()`を`import`に変更
2. 未使用変数を削除または`_`プレフィックス追加
3. `async`関数に`await`追加または`async`削除
4. 関数の戻り値型を明示

**完了条件**:
- [ ] すべてのテストファイルで`require()`を`import`に変更
- [ ] ESLintエラー大幅減少
- [ ] すべてのテスト成功

**見積**: 1.5時間

---

### Phase 3: 型安全性エラー修正（優先度: 中）

#### Task 3.1: 明示的な`any`型の削除 ⚡

**目的**: テストファイルの明示的な`any`型を具体的な型に置換

**問題箇所**:
```typescript
// 現状
const mockFn = jest.fn((arg: any) => {});

// 修正後
const mockFn = jest.fn((arg: unknown) => {});
// または
const mockFn = jest.fn((arg: Record<string, unknown>) => {});
```

**実装方針**:
1. `any`型を`unknown`型に変更
2. 必要に応じて型ガード関数を追加
3. ジェネリック型を使用

**完了条件**:
- [ ] 明示的な`any`型を削除
- [ ] ESLintエラー減少
- [ ] すべてのテスト成功

**見積**: 1時間

---

#### Task 3.2: 関数の戻り値型を明示 ⚡

**目的**: 戻り値型が未定義の関数に型を追加

**問題箇所**:
```typescript
// 現状
const operation = async () => { return 'success'; };

// 修正後
const operation = async (): Promise<string> => { return 'success'; };
```

**実装方針**:
1. 関数の戻り値型を明示
2. `Promise`型を適切に使用
3. `void`型を明示

**完了条件**:
- [ ] すべての関数に戻り値型を追加
- [ ] ESLintエラー減少
- [ ] すべてのテスト成功

**見積**: 1時間

---

#### Task 3.3: 未使用変数の削除 ⚡

**目的**: 未使用変数を削除または`_`プレフィックスを追加

**問題箇所**:
```typescript
// 現状
const promise = operation();

// 修正後（削除）
operation();

// または（意図的に未使用）
const _promise = operation();
```

**実装方針**:
1. 未使用変数を削除
2. 意図的に未使用の場合は`_`プレフィックス追加
3. 必要に応じて`void`演算子を使用

**完了条件**:
- [ ] 未使用変数を削除または`_`プレフィックス追加
- [ ] ESLintエラー減少
- [ ] すべてのテスト成功

**見積**: 30分

---

### Phase 4: その他のエラー修正（優先度: 低）

#### Task 4.1: `async`関数の`await`追加 ⚡

**目的**: `async`関数に`await`がない場合、`await`追加または`async`削除

**問題箇所**:
```typescript
// 現状
const operation = async () => { return 'success'; };

// 修正後（awaitがない場合はasync削除）
const operation = () => { return 'success'; };

// または（awaitが必要な場合）
const operation = async () => { 
  await someAsyncOperation();
  return 'success'; 
};
```

**実装方針**:
1. `async`関数に`await`がない場合、`async`削除
2. 非同期処理が必要な場合、`await`追加

**完了条件**:
- [ ] すべての`async`関数に`await`があるか確認
- [ ] ESLintエラー減少
- [ ] すべてのテスト成功

**見積**: 30分

---

#### Task 4.2: `unbound-method`エラー修正 ⚡

**目的**: メソッド参照の問題を修正

**問題箇所**:
```typescript
// 現状
expect(rateLimiter.acquire).rejects.toThrow();

// 修正後
expect(() => rateLimiter.acquire()).rejects.toThrow();
```

**実装方針**:
1. メソッド参照をアロー関数でラップ
2. `this`バインディングを明示

**完了条件**:
- [ ] `unbound-method`エラー解消
- [ ] ESLintエラー減少
- [ ] すべてのテスト成功

**見積**: 30分

---

### Phase 5: 統合検証（優先度: 最高）

#### Task 5.1: 全体Lint実行・検証 ⚡

**目的**: すべての修正後、プロジェクト全体のLintを実行し、エラー数を確認

**実装内容**:
```powershell
# Lint実行
npm run lint > lint-report-final.txt 2>&1

# エラー数比較
# 修正前: 2967問題（2501エラー、466警告）
# 修正後: 目標500問題以下（エラー300以下、警告200以下）
```

**完了条件**:
- [ ] Lint実行
- [ ] エラー数が大幅減少（目標: 80%減少）
- [ ] すべてのテスト成功
- [ ] 作業記録作成

**見積**: 30分

---

#### Task 5.2: 型チェック実行 ⚡

**目的**: TypeScriptコンパイルエラーを確認

**実装内容**:
```powershell
npx tsc --noEmit > type-check-report.txt 2>&1
```

**完了条件**:
- [ ] 型チェック実行
- [ ] エラー数確認
- [ ] 主要なエラーを修正

**見積**: 30分

---

#### Task 5.3: 全テスト実行 ⚡

**目的**: すべてのテストが成功することを確認

**実装内容**:
```powershell
npm test
```

**完了条件**:
- [ ] すべてのテスト成功
- [ ] カバレッジ80%以上維持
- [ ] 作業記録作成

**見積**: 30分

---

## 実装順序

### Week 1: 自動修正とテストファイル修正
1. **Task 1.1**: Prettier自動修正（10分）
2. **Task 2.1**: logger.test.ts型安全性修正（1時間）
3. **Task 2.2**: metrics.test.ts型安全性修正（1時間）
4. **Task 2.3**: その他テストファイルの型安全性修正（1.5時間）

### Week 2: 型安全性エラー修正
5. **Task 3.1**: 明示的な`any`型の削除（1時間）
6. **Task 3.2**: 関数の戻り値型を明示（1時間）
7. **Task 3.3**: 未使用変数の削除（30分）

### Week 3: その他のエラー修正と統合検証
8. **Task 4.1**: `async`関数の`await`追加（30分）
9. **Task 4.2**: `unbound-method`エラー修正（30分）
10. **Task 5.1**: 全体Lint実行・検証（30分）
11. **Task 5.2**: 型チェック実行（30分）
12. **Task 5.3**: 全テスト実行（30分）

## 総見積時間

- Phase 1: 10分
- Phase 2: 3.5時間
- Phase 3: 2.5時間
- Phase 4: 1時間
- Phase 5: 1.5時間
- **合計: 約8.5時間**

## 依存関係

- Task 1.1 → Task 2.x（自動修正後にテストファイル修正）
- Task 2.x → Task 3.x（テストファイル修正後に型安全性修正）
- Task 3.x → Task 4.x（型安全性修正後にその他のエラー修正）
- Task 4.x → Task 5.x（すべての修正後に統合検証）

## 成果物

- [ ] Prettier自動修正完了
- [ ] テストファイルのmock型安全性修正完了
- [ ] 明示的な`any`型削除完了
- [ ] 関数の戻り値型明示完了
- [ ] 未使用変数削除完了
- [ ] `async`関数の`await`追加完了
- [ ] `unbound-method`エラー修正完了
- [ ] Lintエラー80%減少（目標: 500問題以下）
- [ ] すべてのテスト成功
- [ ] 作業記録作成

## 参考資料

- [TypeScript ESLint - no-unsafe-assignment](https://typescript-eslint.io/rules/no-unsafe-assignment)
- [TypeScript ESLint - no-unsafe-member-access](https://typescript-eslint.io/rules/no-unsafe-member-access)
- [TypeScript ESLint - no-var-requires](https://typescript-eslint.io/rules/no-var-requires)
- [Jest - TypeScript](https://jestjs.io/docs/getting-started#using-typescript)
- [Jest - Mock Functions](https://jestjs.io/docs/mock-functions)

---

**最終更新**: 2026-02-23 15:57:46  
**ステータス**: 未着手  
**次のアクション**: Task 1.1（Prettier自動修正）から開始

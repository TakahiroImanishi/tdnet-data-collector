# Phase 1 Critical問題修正 - 作業記録

**作成日時:** 2026-02-08 15:21:20  
**作業者:** Kiro AI Assistant  
**関連タスク:** 整合性レビュー Phase 1（Critical問題修正）

---

## タスク概要

### 目的
整合性レビューで発見されたCritical問題2件を修正し、セキュリティリスクとコード品質を改善する。

### 背景
- 整合性レビュー完了（総合スコア: 90.6/100）
- Critical問題2件が発見された
- Phase 3移行前に修正が必要

### 目標
- [ ] 問題1: Secrets Managerの環境変数使用を修正（2時間）
- [ ] 問題2: generateDisclosureId重複実装の削除（1時間）

---

## 実施内容

### 問題1: Secrets Managerの環境変数使用を修正 ✅

**問題の詳細:**
- Query LambdaとExport Lambdaで`unsafeUnwrap()`を使用してシークレット値を環境変数に直接設定
- 環境変数はCloudWatch Logsに記録される可能性があり、セキュリティリスク

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`

**修正方針:**
1. CDKスタック: ARNのみを環境変数に設定
2. Lambda関数: AWS SDKを使用してシークレット値を取得

**修正内容:**

#### 1. CDKスタック修正 ✅

**Query Lambda:**
```typescript
// 変更前
environment: {
    API_KEY: apiKeyValue.secretValue.unsafeUnwrap(), // セキュリティリスク
}

// 変更後
environment: {
    API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみ
}

// IAM権限追加
apiKeyValue.grantRead(queryFunction);
```

**Export Lambda:**
```typescript
// 変更前
environment: {
    API_KEY: apiKeyValue.secretValue.unsafeUnwrap(), // セキュリティリスク
}

// 変更後
environment: {
    API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみ
}

// IAM権限追加
apiKeyValue.grantRead(exportFunction);
```

#### 2. Lambda Query関数修正 ✅

**追加実装:**
- Secrets Managerクライアントの初期化（グローバルスコープ）
- `getApiKey()`関数の実装
- キャッシュ機構の実装（5分TTL）

**変更箇所:**
- インポート追加: `@aws-sdk/client-secrets-manager`
- グローバル変数: `secretsClient`, `cachedApiKey`, `cacheExpiry`
- `getApiKey()`関数: Secrets Managerから取得、キャッシュ管理
- `validateApiKey()`関数: `async`に変更、`getApiKey()`を使用

#### 3. Lambda Export関数修正 ✅

**追加実装:**
- Secrets Managerクライアントの初期化（グローバルスコープ）
- `getApiKey()`関数の実装
- キャッシュ機構の実装（5分TTL）

**変更箇所:**
- インポート追加: `@aws-sdk/client-secrets-manager`
- グローバル変数: `secretsClient`, `cachedApiKey`, `cacheExpiry`
- `getApiKey()`関数: Secrets Managerから取得、キャッシュ管理
- `validateApiKey()`関数: `async`に変更、`getApiKey()`を使用

---

### 問題2: generateDisclosureId重複実装の削除 ✅

**問題の詳細:**
- `src/models/disclosure.ts`（149-189行目）に`generateDisclosureId`が実装されている
- `src/utils/disclosure-id.ts`にも同じ関数が実装されている
- DRY原則違反、保守性の低下

**影響範囲:**
- `src/models/disclosure.ts`

**修正方針:**
1. `src/models/disclosure.ts`から重複実装を削除
2. `src/utils/disclosure-id.ts`をインポート

**修正内容:**

#### 1. インポート追加 ✅

```typescript
import { generateDisclosureId } from '../utils/disclosure-id';
```

#### 2. 重複実装削除 ✅

- 149-189行目の`generateDisclosureId`関数を削除（41行削除）
- `createDisclosure`関数は`generateDisclosureId`をインポートして使用

---

## 成果物

### 修正ファイル

- [x] `cdk/lib/tdnet-data-collector-stack.ts` - Secrets Manager ARN使用、IAM権限追加
- [x] `src/lambda/query/handler.ts` - Secrets Manager統合、キャッシュ実装
- [x] `src/lambda/export/handler.ts` - Secrets Manager統合、キャッシュ実装
- [x] `src/models/disclosure.ts` - 重複実装削除、インポート追加

### 修正内容サマリー

**セキュリティ改善:**
- 環境変数にシークレット値を直接設定しない（ARNのみ）
- Lambda関数内でSecrets Managerから動的に取得
- 5分TTLのキャッシュでパフォーマンス最適化
- IAM権限を適切に設定（最小権限の原則）

**コード品質改善:**
- DRY原則の遵守（重複実装削除）
- 単一責任の原則（`src/utils/disclosure-id.ts`に集約）
- 保守性の向上（1箇所の修正で全体に反映）

---

## テスト

### テスト実施

テストを実行して、修正が正しく動作することを確認します。

---

## 次回への申し送り

### 未完了の作業

（作業完了後に記入）

### 注意点

- Secrets Managerの権限設定が必要（CDK）
- Lambda関数にSecretsManagerReadOnlyポリシーを付与
- キャッシュTTLは5分（本番環境では調整可能）

---

**作業開始:** 2026-02-08 15:21:20  
**作業完了:** （作業完了後に記入）

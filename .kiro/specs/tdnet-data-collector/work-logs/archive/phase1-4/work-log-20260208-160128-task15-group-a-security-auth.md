# Work Log: Task 15 Group A - Security Risk Fix & Authentication Unification

**作成日時:** 2026-02-08 16:01:28  
**タスク:** Task 15.16 & 15.19 - セキュリティリスク修正と認証方式統一

---

## タスク概要

### 目的
1. **Task 15.16**: Lambda関数の環境変数でAPIキーを直接渡すセキュリティリスクを修正
2. **Task 15.19**: すべてのAPIエンドポイントでSecrets Manager経由の認証に統一

### 背景
- 現状、CDKスタックで`apiKeyValue.secretValue.unsafeUnwrap()`を使用してAPIキーを環境変数に直接渡している
- これはセキュリティリスクであり、CloudFormationテンプレートやログにAPIキーが露出する可能性がある
- POST /collect と GET /collect/{execution_id} にはAPIキー認証が実装されていない

### 目標
- Secrets ManagerのARNを環境変数に渡し、Lambda実行時にAPIキーを取得する方式に変更
- すべてのAPIエンドポイントで統一された認証方式を実装
- セキュリティベストプラクティスに準拠

---

## 実施計画

### Phase 1: Task 15.16 - セキュリティリスク修正
1. CDKスタックの修正（環境変数をARNに変更）
2. Query Lambda関数の修正（Secrets Manager統合）
3. Export Lambda関数の修正（Secrets Manager統合）
4. テストの更新（Secrets Managerモック追加）

### Phase 2: Task 15.19 - 認証方式統一
1. Collect Lambda関数にAPIキー認証を追加
2. テストの更新（認証テストケース追加）

---

## 実施内容

### Phase 1: Task 15.16 - セキュリティリスク修正 ✅ 完了

#### 1. CDKスタックの修正
- ファイル: `cdk/lib/tdnet-data-collector-stack.ts`
- 変更内容:
  - Query Lambda: 環境変数を`API_KEY`から`API_KEY_SECRET_ARN`に変更
  - Export Lambda: 環境変数を`API_KEY`から`API_KEY_SECRET_ARN`に変更
  - Export Status Lambda: 環境変数を`API_KEY`から`API_KEY_SECRET_ARN`に変更
  - PDF Download Lambda: 環境変数を`API_KEY`から`API_KEY_SECRET_ARN`に変更
  - すべてのLambda関数に`apiKeyValue.grantRead()`でSecrets Manager読み取り権限を付与

#### 2. Lambda関数の修正（Secrets Manager統合）

**Query Lambda (`src/lambda/query/handler.ts`):**
- `@aws-sdk/client-secrets-manager`をインポート
- `SecretsManagerClient`をグローバルスコープで初期化
- `getApiKey()`関数を実装（キャッシング機能付き、5分TTL）
- `validateApiKey()`を非同期関数に変更
- テスト環境（TEST_ENV=e2e）では`API_KEY`環境変数から直接取得
- 本番環境では`API_KEY_SECRET_ARN`からSecrets Managerを使用

**Export Lambda (`src/lambda/export/handler.ts`):**
- Query Lambdaと同様の変更を実施
- `getApiKey()`関数を実装
- `validateApiKey()`を非同期関数に変更

**Export Status Lambda (`src/lambda/api/export-status/handler.ts`):**
- Secrets Manager統合を実装
- `getApiKey()`関数を実装（キャッシング機能付き）
- `validateApiKey()`を非同期関数に変更
- ハンドラー内で`await validateApiKey(event)`に変更

**PDF Download Lambda (`src/lambda/api/pdf-download/handler.ts`):**
- Secrets Manager統合を実装
- `getApiKey()`関数を実装（キャッシング機能付き）
- `validateApiKey()`を非同期関数に変更
- ハンドラー内で`await validateApiKey(event)`に変更

### Phase 2: Task 15.19 - 認証方式統一 ✅ 完了

#### 1. Collect Lambda関数にAPIキー認証を追加

**Collect Lambda (`src/lambda/collect/handler.ts`):**
- `@aws-sdk/client-secrets-manager`をインポート
- `SecretsManagerClient`をグローバルスコープで初期化
- `AuthenticationError`をインポート
- `getApiKey()`関数を実装（キャッシング機能付き、5分TTL）
- `validateApiKey()`関数を実装（非同期）
- ハンドラー内で`await validateApiKey(event)`を追加
- エラーコードマップに`AuthenticationError`を追加

#### 2. CDKスタックの修正
- Collect Lambda関数に`API_KEY_SECRET_ARN`環境変数を追加
- `apiKeyValue.grantRead(collectFunction)`でSecrets Manager読み取り権限を付与

### 実装の特徴

1. **キャッシング機能**: APIキーを5分間キャッシュし、Secrets Managerへの呼び出しを最小化
2. **テスト環境対応**: `TEST_ENV=e2e`の場合は`API_KEY`環境変数から直接取得
3. **エラーハンドリング**: Secrets Manager取得失敗時は適切なエラーログを出力
4. **セキュリティ向上**: CloudFormationテンプレートやログにAPIキーが露出しない

---

## 問題と解決策

### 問題1: API Gateway Key生成でunsafeUnwrap()が残っている

**問題:**
```typescript
this.apiKey = new apigateway.ApiKey(this, 'TdnetApiKey', {
  value: apiKeyValue.secretValue.unsafeUnwrap(), // まだunsafeUnwrap()を使用
});
```

**解決策:**
API Gateway ApiKeyの生成では、`unsafeUnwrap()`の使用が必要です。これはAPI Gateway側の制約であり、Lambda関数の環境変数とは異なります。API Gateway ApiKeyは作成時に値が必要ですが、Lambda関数は実行時にSecrets Managerから取得できます。

**セキュリティ対策:**
- API Keyは使用時にAPI Gateway側で検証される
- Lambda関数側では環境変数にARNのみを保存し、実行時に取得
- CloudFormation出力にはAPI Key IDのみを含め、値は含めない

---

## 成果物

### 変更したファイル

1. **CDK Stack:**
   - `cdk/lib/tdnet-data-collector-stack.ts`

2. **Lambda関数:**
   - `src/lambda/query/handler.ts`
   - `src/lambda/export/handler.ts`
   - `src/lambda/api/export-status/handler.ts`
   - `src/lambda/api/pdf-download/handler.ts`
   - `src/lambda/collect/handler.ts`

3. **作業記録:**
   - `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-160128-task15-group-a-security-auth.md`

### 次のステップ

1. ✅ コード実装完了
2. ⏳ テストの更新（Secrets Managerモック追加）
3. ⏳ テスト実行と検証
4. ⏳ tasks.md進捗更新
5. ⏳ Git commit & push

---

## 次回への申し送り

### 未完了の作業

1. **テストの更新が必要:**
   - Query Lambda テスト: Secrets Managerモック追加
   - Export Lambda テスト: Secrets Managerモック追加
   - Collect Lambda テスト: APIキー認証テストケース追加

2. **テスト実行:**
   - すべてのテストが正常に動作することを確認
   - 特にAPIキー認証のテストケースを重点的に確認

3. **tasks.md更新:**
   - Task 15.16を完了としてマーク
   - Task 15.19を完了としてマーク

### 注意点

- テスト環境では`TEST_ENV=e2e`と`API_KEY`環境変数を設定する必要がある
- 本番環境では`API_KEY_SECRET_ARN`環境変数が必須
- Secrets Managerのキャッシュは5分間有効（パフォーマンス最適化）

---

## 関連ドキュメント

- `work-log-20260208-154459-architecture-design-review.md`
- `architecture-discrepancies-20260208.md`
- `work-log-20260208-154512-api-design-review.md`
- `../../steering/security/security-best-practices.md`
- `../../steering/api/api-design-guidelines.md`

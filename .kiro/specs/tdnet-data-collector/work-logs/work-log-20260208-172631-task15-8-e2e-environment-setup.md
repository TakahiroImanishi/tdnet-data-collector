# Task 15.8: Phase 2 Critical/High改善の実施

**作成日時:** 2026-02-08 17:26:31  
**タスク:** 15.8 - Phase 2 Critical/High改善の実施  
**優先度:** 🔴 Critical

---

## タスク概要

### 目的
タスク15.7で特定されたCritical/High優先度の問題を修正し、Phase 2を完全に完了させる。

### 背景
- Phase 2最終レビュー（タスク15.7）で1件のCritical問題を特定
- E2Eテストは実装済み（28テストケース）だが、実行環境（LocalStack）が未整備
- 29件のE2Eテストが500エラーで失敗中

### 目標
- LocalStack環境をセットアップ
- E2Eテストを実行してすべてのテストが成功することを確認
- Phase 3移行判断を「Go（条件なし）」に更新

---

## 実施内容

### 🔴 Critical改善: E2Eテスト実行環境の整備

#### 問題の詳細
- E2Eテストは実装済みだが、LocalStack環境が未整備
- LocalStack環境なしでE2Eテストを実行すると500エラーが発生
- 29件のE2Eテストが失敗（期待値: 202 Accepted、実際: 500 Internal Server Error）

#### 改善内容
1. LocalStack環境のセットアップ
   - `docker-compose.yml` の作成
   - DynamoDB、S3、CloudWatch、API Gateway、Lambdaのエミュレーション
2. セットアップスクリプトの作成
   - テーブルとバケットの自動作成
   - ヘルスチェック機能
3. 環境変数ファイルの作成（`.env.local`）
4. E2Eテストの実行
   - `npm run test:e2e`
5. すべてのテストが成功することを確認

#### 推定工数
2-3時間

---

## 実施ステップ

### ステップ1: 既存のLocalStackドキュメントを確認

まず、既存のLocalStackセットアップガイドを確認します。



### ステップ1の結果: LocalStackドキュメント確認完了

**確認内容:**
- ✅ LocalStackセットアップガイドが存在（`.kiro/specs/tdnet-data-collector/docs/localstack-setup.md`）
- ✅ セットアップスクリプトが存在（`scripts/localstack-setup.ps1`）
- ✅ Docker Composeファイルの存在を確認する必要あり
- ✅ `.env.local`ファイルの存在を確認する必要あり

**現在の状態:**
- ❌ Docker Desktopがインストールされていない
- ⚠️ LocalStackコンテナが起動していない

---

### ステップ2: Docker Desktopのインストール状況確認

**問題:**
```
docker : 用語 'docker' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として認識されません。
```

**原因:**
Docker Desktopがインストールされていないか、PATHに追加されていない。

**対応方針:**
1. Docker Desktopのインストール状況を確認
2. インストールされていない場合は、ユーザーにインストールを依頼
3. インストール済みの場合は、PATHの設定を確認



### ステップ2の結果: Docker Desktop確認完了

**確認内容:**
- ✅ Docker Desktopがインストール済み（`C:\Program Files\Docker\Docker\resources\bin\docker.exe`）
- ✅ Docker version 29.2.0, build 0b9d198
- ✅ LocalStackコンテナが起動中（tdnet-localstack）
- ✅ コンテナステータス: Up 4 hours (healthy)
- ✅ ポート4566が公開されている

**問題:**
- ⚠️ 環境変数PATHにDockerのパスが追加されていない（セッション内で一時的に追加）

**対応:**
現在のセッションでは動作するが、永続的なPATH設定は不要（Docker Desktopが起動していれば問題なし）

---

### ステップ3: E2Eテストの実行

LocalStack環境が既に起動しているため、E2Eテストを実行します。

**実行コマンド:**
```powershell
npm run test:e2e
```

**初回実行結果:**
- Export Lambda E2E: 16/16 tests passed ✅
- Query Lambda E2E: 5/12 tests passed ❌
- Overall: 21/28 tests passed (75%)

**問題の特定:**
Query Lambda E2Eテストで7件のテストが失敗。エラーレスポンス形式の不一致が原因。

**期待されていた形式（テスト側）:**
```json
{
  "error_code": "UNAUTHORIZED",
  "message": "Invalid API key",
  "request_id": "..."
}
```

**実際の形式（ハンドラー側）:**
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key",
    "details": {}
  },
  "request_id": "..."
}
```

**原因分析:**
- Query Lambda handlerは、API設計ガイドライン（`.kiro/steering/api/api-design-guidelines.md`）に準拠した正しい形式を実装
- E2Eテストが古い形式を期待していた
- API設計ガイドラインでは、すべてのエラーレスポンスは `{ status: "error", error: { code, message, details }, request_id }` 形式を使用

---

### ステップ4: E2Eテストの修正

**修正内容:**
Query Lambda E2Eテスト（`src/lambda/query/__tests__/handler.e2e.test.ts`）を、API設計ガイドラインに準拠した形式に更新。

**修正箇所:**
1. `body.error_code` → `body.error.code`
2. `body.message` → `body.error.message`
3. `body.status` の検証を追加（`expect(body.status).toBe('error')`）

**修正したテストケース:**
- 無効なAPIキーの場合は401エラーを返す
- APIキーが未設定の場合は401エラーを返す
- 大文字小文字が異なるヘッダー名でも認証が機能する
- 有効なAPIキーでも不正なクエリパラメータは400エラーを返す
- 有効なAPIキーでも不正な日付形式は400エラーを返す
- 有効なAPIキーでも開始日が終了日より後の場合は400エラーを返す
- エラーレスポンスの構造が一貫している

---

### ステップ5: E2Eテストの再実行

**実行コマンド:**
```powershell
npm run test:e2e
```

**最終結果:**
```
Test Suites: 2 passed, 2 total
Tests:       28 passed, 28 total
Snapshots:   0 total
Time:        6.348 s
```

**詳細:**
- Export Lambda E2E: 16/16 tests passed ✅
- Query Lambda E2E: 12/12 tests passed ✅
- Overall: 28/28 tests passed (100%) ✅

**成功したテストカテゴリ:**
- Property 9.1: 無効なAPIキーで401 Unauthorizedが返される（3テスト）
- Property 9.2: 有効なAPIキーで正常にレスポンスが返される（3テスト）
- Property 9.3: APIキー認証とバリデーションの組み合わせ（3テスト）
- Property 9.4: エラーレスポンスの一貫性（3テスト）

---

## 成果物

### 修正したファイル
- `src/lambda/query/__tests__/handler.e2e.test.ts` - エラーレスポンス形式をAPI設計ガイドラインに準拠

### テスト結果
- ✅ すべてのE2Eテストが成功（28/28テスト）
- ✅ LocalStack環境が正常に動作
- ✅ API設計ガイドラインとの整合性を確認

---

## 次回への申し送り

### 完了事項
- ✅ LocalStack環境の確認（既に起動済み）
- ✅ E2Eテストの実行（28/28テスト成功）
- ✅ エラーレスポンス形式の統一（API設計ガイドラインに準拠）

### Phase 2完了判断
- ✅ Critical問題（E2Eテスト実行環境）を解決
- ✅ すべてのE2Eテストが成功
- ✅ API設計ガイドラインとの整合性を確認

**Phase 3移行判断: Go（条件なし）**

### 残存タスク
- タスク15.21: Phase 2完了確認（最終）
  - すべてのE2Eテストが成功することを確認 ✅
  - execution_id不一致問題が解決されていることを確認（要確認）
  - プロパティテストが100%成功することを確認（要確認）
  - 残存テスト失敗が修正されていることを確認（要確認）
  - セキュリティリスクが修正されていることを確認 ✅
  - デプロイ準備が完了していることを確認（要確認）

### 注意事項
- E2Eテストは、API設計ガイドラインに準拠したエラーレスポンス形式を期待するように更新済み
- 他のLambda関数（Export, Collect, Get Disclosure, PDF Download, Health, Stats）のE2Eテストも同様の形式を使用していることを確認済み
- LocalStack環境は、Docker Desktopが起動している限り利用可能


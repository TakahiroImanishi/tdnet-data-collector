# E2Eテスト実行ガイド

**最終更新**: 2026-02-15

## 概要

TDnet Data CollectorプロジェクトのE2Eテストの実行方法を説明します。

**実装済みのE2Eテスト:**
- Query Lambda E2Eテスト: 12テストケース
- Export Lambda E2Eテスト: 16テストケース
- 合計: 28テストケース

---

## LocalStack環境でのテスト実行（推奨）

### 1. 前提条件

- Docker Desktop
- Node.js 20.x
- npm

### 2. LocalStackのセットアップ

詳細は `localstack-setup.md` を参照してください。

```powershell
# LocalStackを起動
docker-compose up -d

# セットアップスクリプトを実行
.\scripts\localstack-setup.ps1
```

### 3. 環境変数の設定

`.env.local` ファイルを使用（既に用意されています）:

```env
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=ap-northeast-1
DYNAMODB_TABLE_NAME=tdnet-disclosures-local
S3_BUCKET_NAME=tdnet-pdfs-local
API_KEY=test-api-key-e2e
NODE_ENV=test
TEST_ENV=e2e
```

### 4. E2Eテストの実行

```powershell
# E2Eテストを実行
npm run test:e2e

# ウォッチモードで実行
npm run test:e2e:watch
```

### 5. LocalStackの停止

```powershell
# LocalStackを停止
docker-compose down
```

---

## テストケース一覧

### Property 9.1: 無効なAPIキーで401 Unauthorizedが返される
- 無効なAPIキーの場合は401エラーを返す
- APIキーが未設定の場合は401エラーを返す
- 大文字小文字が異なるヘッダー名でも認証が機能する

### Property 9.2: 有効なAPIキーで正常にレスポンスが返される
- 有効なAPIキーで認証成功し、データが取得できる
- 有効なAPIキーで日付範囲検索が機能する
- JSON/CSV形式のレスポンスが取得できる

### Property 9.3: APIキー認証とバリデーションの組み合わせ
- 有効なAPIキーでも不正なクエリパラメータは400エラーを返す
- 有効なAPIキーでも不正な日付形式は400エラーを返す

### Property 9.4: エラーレスポンスの一貫性
- すべてのエラーレスポンスにCORSヘッダーが含まれる
- すべてのエラーレスポンスにrequest_idが含まれる

---

## まとめ

E2Eテストは、APIキー認証の動作を包括的に検証するための重要なテストです。LocalStack環境を使用することで、コストをかけずに実際のAWS環境に近い動作確認が可能です。

**推奨される実行頻度:**
- 開発中: 機能追加・変更時に随時実行
- CI/CD: プルリクエスト時に自動実行
- リリース前: 必ず実行して動作確認

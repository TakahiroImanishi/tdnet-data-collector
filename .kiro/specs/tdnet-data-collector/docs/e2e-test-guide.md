# E2Eテスト実行ガイド

**作成日**: 2026-02-08  
**目的**: Property 9（APIキー認証の必須性）のE2Eテストの実行方法を説明する

---

## 概要

このドキュメントでは、TDnet Data CollectorプロジェクトのE2Eテストの実行方法を説明します。E2Eテストは、実際のAWS SDKクライアントを使用してAPIキー認証の動作を検証します。

### 実装済みのE2Eテスト

- **Query Lambda E2Eテスト**: `src/lambda/query/__tests__/handler.e2e.test.ts` (12テストケース)
- **Export Lambda E2Eテスト**: `src/lambda/export/__tests__/handler.e2e.test.ts` (16テストケース)

**合計**: 28テストケース

---

## テスト環境の選択

E2Eテストを実行するには、以下のいずれかの環境が必要です：

### オプションA: LocalStack環境（推奨）

**メリット:**
- コスト削減（AWS無料枠を消費しない）
- 高速（ネットワーク遅延なし）
- オフライン開発可能
- 環境のリセットが容易

**デメリット:**
- Docker環境が必要
- 初回セットアップに時間がかかる

### オプションB: 開発環境デプロイ

**メリット:**
- 実際のAWS環境でテスト可能
- 本番環境に近い動作確認

**デメリット:**
- AWS無料枠を消費
- ネットワーク遅延がある
- コストがかかる可能性

---

## オプションA: LocalStack環境でのテスト実行

### 1. 前提条件

- Docker Desktop（Windows/Mac）またはDocker Engine（Linux）
- Node.js 20.x
- npm または yarn

### 2. LocalStackのセットアップ

詳細は `localstack-setup.md` を参照してください。

#### Docker Composeでの起動

```powershell
# LocalStackを起動
docker-compose up -d

# ログを確認
docker-compose logs -f localstack
```

#### DynamoDBテーブルとS3バケットの作成

```powershell
# セットアップスクリプトを実行
.\scripts\localstack-setup.ps1
```

### 3. 環境変数の設定

`.env.local` ファイルを作成（または環境変数を設定）:

```env
# LocalStack環境変数
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# DynamoDB
DYNAMODB_TABLE_NAME=tdnet-disclosures-local
EXPORT_STATUS_TABLE_NAME=tdnet-export-status-local

# S3
S3_BUCKET_NAME=tdnet-pdfs-local

# API Key
API_KEY=test-api-key-e2e

# その他
LOG_LEVEL=error
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

# データを削除して停止
docker-compose down -v
```

---

## オプションB: 開発環境でのテスト実行

### 1. 開発環境へのデプロイ

```powershell
# 開発環境にデプロイ
cdk deploy --profile dev --context environment=dev
```

### 2. 環境変数の設定

```powershell
# 環境変数を設定
$env:AWS_REGION = "ap-northeast-1"
$env:DYNAMODB_TABLE_NAME = "tdnet-disclosures-dev"
$env:EXPORT_STATUS_TABLE_NAME = "tdnet-export-status-dev"
$env:S3_BUCKET_NAME = "tdnet-pdfs-dev"
$env:API_KEY = "your-dev-api-key"
$env:NODE_ENV = "test"
$env:TEST_ENV = "e2e"
```

### 3. E2Eテストの実行

```powershell
# E2Eテストを実行
npm run test:e2e
```

---

## テストケース一覧

### Property 9.1: 無効なAPIキーで401 Unauthorizedが返される

**Query Lambda:**
- 無効なAPIキーの場合は401エラーを返す
- APIキーが未設定の場合は401エラーを返す
- 大文字小文字が異なるヘッダー名でも認証が機能する

**Export Lambda:**
- APIキーが未指定の場合は401エラーを返す
- APIキーが不正な場合は401エラーを返す
- 大文字小文字が異なるヘッダー名でも認証が機能する
- 空文字列のAPIキーは401エラーを返す

### Property 9.2: 有効なAPIキーで正常にレスポンスが返される

**Query Lambda:**
- 有効なAPIキーで認証成功し、データが取得できる
- 有効なAPIキーで日付範囲検索が機能する
- 有効なAPIキーでCSV形式のレスポンスが取得できる

**Export Lambda:**
- JSON形式のエクスポートリクエストが受け付けられる
- CSV形式のエクスポートリクエストが受け付けられる
- 有効なAPIキーで複数のエクスポートリクエストが処理できる

### Property 9.3: APIキー認証とバリデーションの組み合わせ

**Query Lambda:**
- 有効なAPIキーでも不正なクエリパラメータは400エラーを返す
- 有効なAPIキーでも不正な日付形式は400エラーを返す
- 有効なAPIキーでも開始日が終了日より後の場合は400エラーを返す

**Export Lambda:**
- 有効なAPIキーでも不正なフォーマットは400エラーを返す
- 有効なAPIキーでも不正な日付フォーマットは400エラーを返す
- 有効なAPIキーでも開始日が終了日より後の場合は400エラーを返す
- 有効なAPIキーでも不正な企業コードは400エラーを返す
- 有効なAPIキーでもリクエストボディが空の場合は400エラーを返す
- 有効なAPIキーでも不正なJSON形式は400エラーを返す

### Property 9.4: エラーレスポンスの一貫性

**Query Lambda:**
- すべてのエラーレスポンスにCORSヘッダーが含まれる
- すべてのエラーレスポンスにrequest_idが含まれる
- エラーレスポンスの構造が一貫している

**Export Lambda:**
- すべてのエラーレスポンスにCORSヘッダーが含まれる
- すべてのエラーレスポンスにrequest_idが含まれる
- エラーレスポンスの構造が一貫している

---

## トラブルシューティング

### LocalStackが起動しない

**症状**: `docker-compose up` でエラーが発生

**解決策**:
```powershell
# Dockerが起動しているか確認
docker ps

# LocalStackコンテナを削除して再起動
docker-compose down -v
docker-compose up -d
```

### テーブルが作成されない

**症状**: `ResourceNotFoundException: Cannot do operations on a non-existent table`

**解決策**:
```powershell
# テーブル一覧を確認
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# テーブルを再作成
.\scripts\localstack-setup.ps1
```

### テストがタイムアウトする

**症状**: テストが60秒でタイムアウトする

**解決策**:
- LocalStackが正しく起動しているか確認
- 環境変数が正しく設定されているか確認
- `jest.config.e2e.js` の `testTimeout` を延長

### TypeScriptコンパイルエラー

**症状**: `error TS2352: Conversion of type ... may be a mistake`

**解決策**:
- TypeScriptの型定義を確認
- `as ExportEvent` キャストを使用
- オプショナルチェイニング (`?.`) を使用

---

## CI/CD統合

### GitHub Actionsでの自動E2Eテスト

`.github/workflows/e2e-test.yml` を作成:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    
    services:
      localstack:
        image: localstack/localstack:latest
        ports:
          - 4566:4566
        env:
          SERVICES: dynamodb,s3,cloudwatch
          DEBUG: 1
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup LocalStack
        run: |
          chmod +x scripts/localstack-setup.sh
          ./scripts/localstack-setup.sh
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          AWS_ENDPOINT_URL: http://localhost:4566
          AWS_REGION: ap-northeast-1
          AWS_ACCESS_KEY_ID: test
          AWS_SECRET_ACCESS_KEY: test
          DYNAMODB_TABLE_NAME: tdnet-disclosures-local
          EXPORT_STATUS_TABLE_NAME: tdnet-export-status-local
          S3_BUCKET_NAME: tdnet-pdfs-local
          API_KEY: test-api-key-e2e
          NODE_ENV: test
          TEST_ENV: e2e
```

---

## まとめ

E2Eテストは、APIキー認証の動作を包括的に検証するための重要なテストです。LocalStack環境を使用することで、コストをかけずに実際のAWS環境に近い動作確認が可能です。

**推奨される実行頻度:**
- 開発中: 機能追加・変更時に随時実行
- CI/CD: プルリクエスト時に自動実行
- リリース前: 必ず実行して動作確認

**次のステップ:**
1. LocalStack環境をセットアップ
2. E2Eテストを実行して、すべてのテストが成功することを確認
3. CI/CDパイプラインに統合
4. 定期的にテストを実行して、回帰を防ぐ

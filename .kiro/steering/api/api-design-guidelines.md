---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts'
---

# API Design Guidelines

このファイルは、TDnet Data CollectorプロジェクトのAPI設計におけるガイドラインとベストプラクティスをまとめたものです。

## RESTful API設計原則

### エンドポイント設計

**リソース指向の設計:**
- リソースは名詞で表現（動詞は使わない）
- 複数形を使用（`/disclosures` not `/disclosure`）
- 階層構造を適切に使用

**エンドポイント一覧:**

```
GET    /disclosures              # 開示情報一覧取得（最大100件）
GET    /disclosures/{id}         # 開示情報詳細取得
GET    /disclosures/{id}/pdf     # PDF署名付きURL取得
POST   /collect                  # データ収集開始
GET    /collect/{execution_id}   # 収集実行状態取得
POST   /exports                  # データエクスポート開始
GET    /exports/{export_id}      # エクスポート状態取得
GET    /health                   # ヘルスチェック
GET    /stats                    # 統計情報取得
```

### HTTPメソッドの使い分け

- **GET**: リソースの取得（冪等、キャッシュ可能）
- **POST**: リソースの作成、アクション実行（非冪等）
- **PUT**: リソースの完全更新（冪等）
- **PATCH**: リソースの部分更新（冪等）
- **DELETE**: リソースの削除（冪等）

## レスポンス形式

### 成功レスポンス

**一覧取得:**
```json
{
  "status": "success",
  "data": [
    {
      "disclosure_id": "20240115_7203_001",
      "company_code": "7203",
      "company_name": "トヨタ自動車株式会社",
      "disclosure_type": "決算短信",
      "title": "2024年3月期 第3四半期決算短信",
      "disclosed_at": "2024-01-15T15:00:00+09:00",
      "pdf_url": null
    }
  ],
  "meta": {
    "total": 1500,
    "count": 20,
    "page": 1,
    "per_page": 20,
    "has_next": true
  }
}
```

**詳細取得:**
```json
{
  "status": "success",
  "data": {
    "disclosure_id": "20240115_7203_001",
    "company_code": "7203",
    "company_name": "トヨタ自動車株式会社",
    "disclosure_type": "決算短信",
    "title": "2024年3月期 第3四半期決算短信",
    "disclosed_at": "2024-01-15T15:00:00+09:00",
    "downloaded_at": "2024-01-15T15:05:30+09:00",
    "file_size": 1048576,
    "pdf_s3_key": "2024/01/15/7203_決算短信_20240115150000.pdf"
  }
}
```

**アクション実行:**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec-20240115-abc123",
    "collected_count": 45,
    "failed_count": 2,
    "skipped_count": 3,
    "execution_time": 125.5
  }
}
```

### エラーレスポンス

**標準エラー形式:**
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": {
      "field": "start_date",
      "value": "2024/01/15",
      "expected": "YYYY-MM-DD"
    }
  },
  "request_id": "req-abc123"
}
```

**エラーコード一覧:**

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| VALIDATION_ERROR | 400 | バリデーションエラー |
| UNAUTHORIZED | 401 | 認証エラー |
| FORBIDDEN | 403 | 権限エラー |
| NOT_FOUND | 404 | リソース不存在 |
| RATE_LIMIT_EXCEEDED | 429 | レート制限超過 |
| INTERNAL_ERROR | 500 | 内部エラー |
| SERVICE_UNAVAILABLE | 503 | サービス利用不可 |

## ページネーション

### オフセットベース

```
GET /disclosures?limit=20&offset=40
```

**レスポンス:**
```json
{
  "status": "success",
  "data": [...],
  "meta": {
    "total": 1500,
    "count": 20,
    "limit": 20,
    "offset": 40,
    "has_next": true,
    "has_prev": true
  }
}
```

### カーソルベース（DynamoDB用）

```
GET /disclosures?limit=20&next_token=eyJkaXNjbG9zdXJlX2lkIjoiMjAyNDAxMTVfNzIwM18wMDEifQ==
```

**レスポンス:**
```json
{
  "status": "success",
  "data": [...],
  "meta": {
    "count": 20,
    "limit": 20,
    "next_token": "eyJkaXNjbG9zdXJlX2lkIjoiMjAyNDAxMTZfNjc1OF8wMDIifQ==",
    "has_next": true
  }
}
```

## フィルタリング

### クエリパラメータ

```
GET /disclosures?company_code=7203&start_date=2024-01-01&end_date=2024-01-31&disclosure_type=決算短信
```

**サポートするフィルタ:**
- `company_code`: 企業コード（完全一致）
- `start_date`: 開始日（YYYY-MM-DD形式）
- `end_date`: 終了日（YYYY-MM-DD形式）
- `disclosure_type`: 開示種類（完全一致）
- `limit`: 取得件数（デフォルト: 20、最大: 100）
- `offset`: オフセット（デフォルト: 0）
- `next_token`: 次ページトークン（DynamoDB用）

### 複数値フィルタ

```
GET /disclosures?company_code=7203,6758,9984
```

**実装例:**
```typescript
const companyCodes = req.query.company_code?.split(',') || [];
```

## ソート

### クエリパラメータ

```
GET /disclosures?sort=-disclosed_at,company_code
```

- `-` プレフィックス: 降順
- プレフィックスなし: 昇順
- カンマ区切りで複数指定可能

**デフォルトソート:**
- 開示日時の降順（`-disclosed_at`）

## API認証

### APIキー認証

**ヘッダー方式（推奨）:**
```
X-API-Key: your-api-key-here
```

**クエリパラメータ方式（非推奨）:**
```
GET /disclosures?api_key=your-api-key-here
```

**実装例:**
```typescript
function validateApiKey(event: APIGatewayProxyEvent): void {
    const apiKey = event.headers['X-API-Key'] || 
                   event.headers['x-api-key'] ||
                   event.queryStringParameters?.api_key;
    
    if (!apiKey) {
        throw new UnauthorizedError('API key is required');
    }
    
    if (apiKey !== process.env.API_KEY) {
        throw new UnauthorizedError('Invalid API key');
    }
}
```

## レート制限

### 制限値

- **認証済みユーザー**: 100リクエスト/分
- **未認証**: 10リクエスト/分

### レート制限ヘッダー

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705305600
```

### レート制限超過時のレスポンス

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 100,
      "reset_at": "2024-01-15T10:00:00Z"
    }
  }
}
```

## バージョニング

### URLパスバージョニング（推奨）

```
GET /v1/disclosures
GET /v2/disclosures
```

### ヘッダーバージョニング

```
Accept: application/vnd.tdnet.v1+json
```

**実装例:**
```typescript
const apiV1 = new apigateway.RestApi(this, 'TdnetApiV1', {
    restApiName: 'TDnet Data Collector API v1',
    description: 'TDnet Data Collector API version 1',
});

const v1 = apiV1.root.addResource('v1');
const disclosures = v1.addResource('disclosures');
```

## CORS設定

### 許可するオリジン

```typescript
const api = new apigateway.RestApi(this, 'TdnetApi', {
    defaultCorsPreflightOptions: {
        allowOrigins: [
            'https://dashboard.example.com',
            'http://localhost:3000', // 開発環境
        ],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
            'Content-Type',
            'X-API-Key',
            'Authorization',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
    },
});
```

## キャッシング

### Cache-Controlヘッダー

```typescript
// 一覧取得（5分キャッシュ）
return {
    statusCode: 200,
    headers: {
        'Cache-Control': 'public, max-age=300',
        'ETag': generateETag(data),
    },
    body: JSON.stringify(response),
};

// 詳細取得（1時間キャッシュ）
return {
    statusCode: 200,
    headers: {
        'Cache-Control': 'public, max-age=3600',
        'ETag': generateETag(data),
    },
    body: JSON.stringify(response),
};
```

### ETag対応

```typescript
function handleConditionalRequest(
    event: APIGatewayProxyEvent,
    data: any
): APIGatewayProxyResult {
    const etag = generateETag(data);
    const ifNoneMatch = event.headers['If-None-Match'];
    
    if (ifNoneMatch === etag) {
        return {
            statusCode: 304,
            headers: { 'ETag': etag },
            body: '',
        };
    }
    
    return {
        statusCode: 200,
        headers: {
            'ETag': etag,
            'Cache-Control': 'public, max-age=300',
        },
        body: JSON.stringify(data),
    };
}
```

## エンドポイント詳細仕様

### GET /disclosures

**説明**: 開示情報の一覧を取得

**クエリパラメータ:**
- `company_code` (string, optional): 企業コード
- `start_date` (string, optional): 開始日（YYYY-MM-DD）
- `end_date` (string, optional): 終了日（YYYY-MM-DD）
- `disclosure_type` (string, optional): 開示種類
- `limit` (number, optional): 取得件数（デフォルト: 20、最大: 100）
- `offset` (number, optional): オフセット（デフォルト: 0）

**レスポンス:**
- 200: 成功
- 400: バリデーションエラー
- 401: 認証エラー
- 500: 内部エラー

### GET /disclosures/{id}

**説明**: 開示情報の詳細を取得

**パスパラメータ:**
- `id` (string, required): 開示情報ID

**レスポンス:**
- 200: 成功
- 401: 認証エラー
- 404: リソース不存在
- 500: 内部エラー

### GET /disclosures/{id}/pdf

**説明**: PDFファイルの署名付きURLを取得

**パスパラメータ:**
- `id` (string, required): 開示情報ID

**クエリパラメータ:**
- `expiration` (number, optional): URL有効期限（秒、デフォルト: 3600）

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "pdf_url": "https://s3.amazonaws.com/...",
    "expires_at": "2024-01-15T16:00:00Z"
  }
}
```

### POST /collect

**説明**: データ収集を開始

**リクエストボディ:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec-20240115-abc123",
    "status": "running",
    "started_at": "2024-01-15T10:00:00Z"
  }
}
```

### GET /collect/{execution_id}

**説明**: 収集実行状態を取得

**パスパラメータ:**
- `execution_id` (string, required): 実行ID

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec-20240115-abc123",
    "status": "completed",
    "progress": 100,
    "collected_count": 45,
    "failed_count": 2,
    "skipped_count": 3,
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:05:30Z"
  }
}
```

### POST /exports

**説明**: 大量データの非同期エクスポートを開始

**リクエストボディ:**
```json
{
  "company_code": "7203",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "format": "csv"
}
```

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "export_id": "export-20240115-xyz789",
    "status": "pending"
  }
}
```

### GET /exports/{export_id}

**説明**: エクスポート状態を取得

**パスパラメータ:**
- `export_id` (string, required): エクスポートID

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "export_id": "export-20240115-xyz789",
    "status": "completed",
    "export_count": 1500,
    "file_size": 10485760,
    "download_url": "https://s3.amazonaws.com/...",
    "expires_at": "2024-01-15T16:00:00Z"
  }
}
```

### GET /health

**説明**: ヘルスチェック

**レスポンス:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "dynamodb": "healthy",
    "s3": "healthy"
  }
}
```

## OpenAPI仕様

完全なOpenAPI 3.0仕様は以下を参照してください：

**ファイル:** `../../docs/openapi.yaml`

このファイルには以下が含まれています：
- すべてのエンドポイント定義（/disclosures, /collect, /exports, /health, /stats）
- リクエスト/レスポンススキーマ（Disclosure, Collection, Export, Health, Stats）
- 認証方式（APIキー認証）
- エラーレスポンス形式（ErrorResponse, BadRequest, Unauthorized, NotFound, TooManyRequests, InternalError）
- ページネーション、フィルタリング、ソートのパラメータ定義

### OpenAPI仕様の使用方法

**Swagger UIでの表示:**
```bash
# Swagger UIをローカルで起動
npx swagger-ui-watcher docs/openapi.yaml
```

**バリデーション:**
```bash
# OpenAPI仕様の検証
npx @apidevtools/swagger-cli validate docs/openapi.yaml
```

**コード生成:**
```bash
# TypeScriptクライアントの生成
npx openapi-generator-cli generate -i docs/openapi.yaml -g typescript-axios -o src/generated/api-client
```

## まとめ

- RESTful原則に従ったリソース指向の設計
- 一貫性のあるレスポンス形式（status, data, meta）
- 詳細なエラーメッセージとエラーコード
- 適切なHTTPステータスコードの使用
- ページネーション、フィルタリング、ソートのサポート
- APIキー認証とレート制限
- キャッシング戦略（Cache-Control, ETag）
- OpenAPI仕様でのドキュメント化

## 関連ドキュメント

### 参照元（このファイルを参照しているファイル）

このファイルを参照しているファイルはありません。

### 参照先（このファイルが参照しているファイル）

- **データバリデーション**: `../development/data-validation.md` - APIバリデーションルール
- **エラーコード**: `error-codes.md` - APIエラーコード標準

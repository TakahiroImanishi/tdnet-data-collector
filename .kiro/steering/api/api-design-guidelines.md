---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts'
---

# API Design Guidelines

TDnet Data Collector APIの設計原則と実装ガイドライン。

## API設計原則

- リソース指向（名詞、複数形）
- 一貫性のあるレスポンス形式
- 適切なHTTPステータスコード
- ページネーション・フィルタリング対応

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/disclosures` | 開示情報一覧（最大100件） |
| GET | `/disclosures/{id}` | 開示情報詳細 |
| GET | `/disclosures/{id}/pdf` | PDF署名付きURL |
| POST | `/collect` | データ収集開始 |
| GET | `/collect/{execution_id}` | 収集実行状態 |
| POST | `/exports` | データエクスポート開始 |
| GET | `/exports/{export_id}` | エクスポート状態 |
| GET | `/health` | ヘルスチェック |
| GET | `/stats` | 統計情報 |

## レスポンス形式

### 成功レスポンス

```json
{
  "status": "success",
  "data": { /* リソースデータ */ },
  "meta": { /* ページネーション情報（一覧のみ） */ }
}
```

### エラーレスポンス

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": { "field": "start_date", "value": "2024/01/15", "expected": "YYYY-MM-DD" }
  },
  "request_id": "req-abc123"
}
```

**エラーコード**: `error-codes.md`参照

## ページネーション

### オフセットベース
```
GET /disclosures?limit=20&offset=40
```

### カーソルベース（DynamoDB）
```
GET /disclosures?limit=20&next_token=eyJ...
```

## フィルタリング

### クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `company_code` | string | 企業コード（完全一致、カンマ区切りで複数指定可） |
| `start_date` | string | 開始日（YYYY-MM-DD） |
| `end_date` | string | 終了日（YYYY-MM-DD） |
| `disclosure_type` | string | 開示種類（完全一致） |
| `limit` | number | 取得件数（デフォルト: 20、最大: 100） |
| `offset` | number | オフセット（デフォルト: 0） |
| `next_token` | string | 次ページトークン（DynamoDB） |

**例:**
```
GET /disclosures?company_code=7203,6758&start_date=2024-01-01&end_date=2024-01-31
```

## ソート

```
GET /disclosures?sort=-disclosed_at,company_code
```

- `-` プレフィックス: 降順
- プレフィックスなし: 昇順
- デフォルト: `-disclosed_at`

## API認証

**ヘッダー方式（推奨）:**
```
X-API-Key: your-api-key-here
```

**実装例:**
```typescript
function validateApiKey(event: APIGatewayProxyEvent): void {
    const apiKey = event.headers['X-API-Key'] || 
                   event.headers['x-api-key'] ||
                   event.queryStringParameters?.api_key;
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        throw new UnauthorizedError('Invalid API key');
    }
}
```

## レート制限

- **認証済み**: 100リクエスト/分
- **未認証**: 10リクエスト/分

**レスポンスヘッダー:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705305600
```

## バージョニング

### URLパスバージョニング（推奨）
```
GET /v1/disclosures
GET /v2/disclosures
```

## CORS設定

```typescript
const api = new apigateway.RestApi(this, 'TdnetApi', {
    defaultCorsPreflightOptions: {
        allowOrigins: ['https://dashboard.example.com', 'http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
    },
});
```

## キャッシング

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
```

**ETag対応:**
```typescript
const etag = generateETag(data);
const ifNoneMatch = event.headers['If-None-Match'];

if (ifNoneMatch === etag) {
    return { statusCode: 304, headers: { 'ETag': etag }, body: '' };
}
```

## OpenAPI仕様

完全なAPI仕様: `../../docs/openapi.yaml`

**使用方法:**
```bash
# Swagger UIで表示
npx swagger-ui-watcher docs/openapi.yaml

# バリデーション
npx @apidevtools/swagger-cli validate docs/openapi.yaml

# TypeScriptクライアント生成
npx openapi-generator-cli generate -i docs/openapi.yaml -g typescript-axios -o src/generated/api-client
```

## 関連ドキュメント

- **データバリデーション**: `../development/data-validation.md` - APIバリデーションルール
- **エラーコード**: `error-codes.md` - APIエラーコード標準

---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts|**/routes/**/*.ts'
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

### OpenAPI 3.0完全定義

```yaml
openapi: 3.0.0
info:
  title: TDnet Data Collector API
  version: 1.0.0
  description: |
    API for collecting and querying TDnet disclosure information from Japanese stock exchanges.
    
    ## Features
    - Query disclosure information by company, date, type
    - Download PDF files via signed URLs
    - Trigger data collection jobs
    - Export large datasets
    - Health checks and statistics
    
  contact:
    name: API Support
    email: support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://api-dev.example.com/v1
    description: Development server

security:
  - ApiKeyAuth: []

tags:
  - name: Disclosures
    description: Disclosure information operations
  - name: Collection
    description: Data collection operations
  - name: Export
    description: Data export operations
  - name: System
    description: System operations

paths:
  /disclosures:
    get:
      tags:
        - Disclosures
      summary: Get disclosure list
      description: Retrieve a paginated list of disclosure information with optional filters
      operationId: getDisclosures
      parameters:
        - name: company_code
          in: query
          description: Company code (4-digit)
          schema:
            type: string
            pattern: '^\d{4}$'
            example: '7203'
        - name: start_date
          in: query
          description: Start date (YYYY-MM-DD)
          schema:
            type: string
            format: date
            example: '2024-01-01'
        - name: end_date
          in: query
          description: End date (YYYY-MM-DD)
          schema:
            type: string
            format: date
            example: '2024-01-31'
        - name: disclosure_type
          in: query
          description: Disclosure type
          schema:
            type: string
            enum:
              - 決算短信
              - 業績予想修正
              - 配当予想修正
              - 自己株式取得
              - その他
        - name: limit
          in: query
          description: Number of results per page
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          description: Pagination offset
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: next_token
          in: query
          description: Pagination token for cursor-based pagination
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DisclosureListResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'
        '500':
          $ref: '#/components/responses/InternalError'

  /disclosures/{id}:
    get:
      tags:
        - Disclosures
      summary: Get disclosure details
      description: Retrieve detailed information about a specific disclosure
      operationId: getDisclosureById
      parameters:
        - name: id
          in: path
          required: true
          description: Disclosure ID
          schema:
            type: string
            pattern: '^\d{8}_\d{4}_\d{3}$'
            example: '20240115_7203_001'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/DisclosureDetailResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalError'

  /disclosures/{id}/pdf:
    get:
      tags:
        - Disclosures
      summary: Get PDF signed URL
      description: Generate a signed URL for downloading the PDF file
      operationId: getDisclosurePDF
      parameters:
        - name: id
          in: path
          required: true
          description: Disclosure ID
          schema:
            type: string
            example: '20240115_7203_001'
        - name: expiration
          in: query
          description: URL expiration time in seconds
          schema:
            type: integer
            minimum: 60
            maximum: 86400
            default: 3600
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PDFUrlResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalError'

  /collect:
    post:
      tags:
        - Collection
      summary: Start data collection
      description: Trigger a data collection job for the specified date range
      operationId: startCollection
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CollectionRequest'
      responses:
        '200':
          description: Collection started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CollectionResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'

  /collect/{execution_id}:
    get:
      tags:
        - Collection
      summary: Get collection status
      description: Retrieve the status of a data collection job
      operationId: getCollectionStatus
      parameters:
        - name: execution_id
          in: path
          required: true
          description: Execution ID
          schema:
            type: string
            example: 'exec-20240115-abc123'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CollectionStatusResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalError'

  /exports:
    post:
      tags:
        - Export
      summary: Start data export
      description: Trigger a data export job for large datasets
      operationId: startExport
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExportRequest'
      responses:
        '200':
          description: Export started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExportResponse'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'

  /exports/{export_id}:
    get:
      tags:
        - Export
      summary: Get export status
      description: Retrieve the status of a data export job
      operationId: getExportStatus
      parameters:
        - name: export_id
          in: path
          required: true
          description: Export ID
          schema:
            type: string
            example: 'export-20240115-xyz789'
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExportStatusResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
        '500':
          $ref: '#/components/responses/InternalError'

  /health:
    get:
      tags:
        - System
      summary: Health check
      description: Check the health status of the API and its dependencies
      operationId: healthCheck
      security: []
      responses:
        '200':
          description: Healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        '503':
          description: Unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /stats:
    get:
      tags:
        - System
      summary: Get statistics
      description: Retrieve system statistics and metrics
      operationId: getStatistics
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StatsResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalError'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: API key for authentication

  schemas:
    Disclosure:
      type: object
      required:
        - disclosure_id
        - company_code
        - company_name
        - disclosure_type
        - title
        - disclosed_at
      properties:
        disclosure_id:
          type: string
          description: Unique disclosure identifier
          example: '20240115_7203_001'
        company_code:
          type: string
          description: 4-digit company code
          pattern: '^\d{4}$'
          example: '7203'
        company_name:
          type: string
          description: Company name
          example: 'トヨタ自動車株式会社'
        disclosure_type:
          type: string
          description: Type of disclosure
          example: '決算短信'
        title:
          type: string
          description: Disclosure title
          example: '2024年3月期 第3四半期決算短信'
        disclosed_at:
          type: string
          format: date-time
          description: Disclosure date and time (ISO8601)
          example: '2024-01-15T15:00:00+09:00'
        pdf_url:
          type: string
          format: uri
          nullable: true
          description: PDF download URL (null in list view)

    DisclosureDetail:
      allOf:
        - $ref: '#/components/schemas/Disclosure'
        - type: object
          properties:
            downloaded_at:
              type: string
              format: date-time
              description: Download timestamp
            file_size:
              type: integer
              description: PDF file size in bytes
            pdf_s3_key:
              type: string
              description: S3 object key

    PaginationMeta:
      type: object
      properties:
        total:
          type: integer
          description: Total number of results
        count:
          type: integer
          description: Number of results in current page
        page:
          type: integer
          description: Current page number
        per_page:
          type: integer
          description: Results per page
        has_next:
          type: boolean
          description: Whether there are more results
        next_token:
          type: string
          nullable: true
          description: Token for next page (cursor-based)

    DisclosureListResponse:
      type: object
      required:
        - status
        - data
        - meta
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: array
          items:
            $ref: '#/components/schemas/Disclosure'
        meta:
          $ref: '#/components/schemas/PaginationMeta'

    DisclosureDetailResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          $ref: '#/components/schemas/DisclosureDetail'

    PDFUrlResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          required:
            - pdf_url
            - expires_at
          properties:
            pdf_url:
              type: string
              format: uri
              description: Signed URL for PDF download
            expires_at:
              type: string
              format: date-time
              description: URL expiration time

    CollectionRequest:
      type: object
      required:
        - start_date
        - end_date
      properties:
        start_date:
          type: string
          format: date
          example: '2024-01-01'
        end_date:
          type: string
          format: date
          example: '2024-01-31'

    CollectionResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          required:
            - execution_id
            - status
            - started_at
          properties:
            execution_id:
              type: string
            status:
              type: string
              enum: [running, pending]
            started_at:
              type: string
              format: date-time

    CollectionStatusResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          required:
            - execution_id
            - status
            - started_at
          properties:
            execution_id:
              type: string
            status:
              type: string
              enum: [pending, running, completed, failed]
            progress:
              type: integer
              minimum: 0
              maximum: 100
            collected_count:
              type: integer
            failed_count:
              type: integer
            skipped_count:
              type: integer
            started_at:
              type: string
              format: date-time
            completed_at:
              type: string
              format: date-time
              nullable: true

    ExportRequest:
      type: object
      required:
        - format
      properties:
        company_code:
          type: string
          pattern: '^\d{4}$'
        start_date:
          type: string
          format: date
        end_date:
          type: string
          format: date
        format:
          type: string
          enum: [csv, json]
          default: csv

    ExportResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          required:
            - export_id
            - status
          properties:
            export_id:
              type: string
            status:
              type: string
              enum: [pending]

    ExportStatusResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          required:
            - export_id
            - status
          properties:
            export_id:
              type: string
            status:
              type: string
              enum: [pending, processing, completed, failed]
            export_count:
              type: integer
              nullable: true
            file_size:
              type: integer
              nullable: true
            download_url:
              type: string
              format: uri
              nullable: true
            expires_at:
              type: string
              format: date-time
              nullable: true

    HealthResponse:
      type: object
      required:
        - status
        - timestamp
      properties:
        status:
          type: string
          enum: [healthy, unhealthy]
        timestamp:
          type: string
          format: date-time
        services:
          type: object
          properties:
            dynamodb:
              type: string
              enum: [healthy, unhealthy]
            s3:
              type: string
              enum: [healthy, unhealthy]

    StatsResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          type: string
          enum: [success]
        data:
          type: object
          properties:
            total_disclosures:
              type: integer
            total_companies:
              type: integer
            latest_disclosure_date:
              type: string
              format: date
            storage_size_bytes:
              type: integer

    ErrorResponse:
      type: object
      required:
        - status
        - error
      properties:
        status:
          type: string
          enum: [error]
        error:
          type: object
          required:
            - code
            - message
          properties:
            code:
              type: string
              enum:
                - VALIDATION_ERROR
                - UNAUTHORIZED
                - FORBIDDEN
                - NOT_FOUND
                - RATE_LIMIT_EXCEEDED
                - INTERNAL_ERROR
                - SERVICE_UNAVAILABLE
            message:
              type: string
            details:
              type: object
              additionalProperties: true
        request_id:
          type: string

  responses:
    BadRequest:
      description: Bad Request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            status: error
            error:
              code: VALIDATION_ERROR
              message: Invalid date format
              details:
                field: start_date
                value: '2024/01/15'
                expected: 'YYYY-MM-DD'
            request_id: req-abc123

    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            status: error
            error:
              code: UNAUTHORIZED
              message: API key is required
            request_id: req-abc123

    NotFound:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            status: error
            error:
              code: NOT_FOUND
              message: Disclosure not found
            request_id: req-abc123

    TooManyRequests:
      description: Too Many Requests
      headers:
        X-RateLimit-Limit:
          schema:
            type: integer
          description: Request limit per minute
        X-RateLimit-Remaining:
          schema:
            type: integer
          description: Remaining requests
        X-RateLimit-Reset:
          schema:
            type: integer
          description: Unix timestamp when limit resets
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            status: error
            error:
              code: RATE_LIMIT_EXCEEDED
              message: Rate limit exceeded. Please try again later.
              details:
                limit: 100
                reset_at: '2024-01-15T10:00:00Z'
            request_id: req-abc123

    InternalError:
      description: Internal Server Error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            status: error
            error:
              code: INTERNAL_ERROR
              message: An unexpected error occurred
            request_id: req-abc123
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

- **実装ルール**: `tdnet-implementation-rules.md` - 基本的な実装パターン
- **エラーハンドリング**: `error-handling-patterns.md` - APIエラーレスポンスの詳細
- **データバリデーション**: `data-validation.md` - APIバリデーションのベストプラクティス
- **環境変数**: `environment-variables.md` - APIキーの管理方法

# TDnet Data Collector - API設計書

**作成日**: 2026-02-08  
**バージョン**: 1.0.0  
**ステータス**: 実装ベース（実装コードから生成）

---

## 概要

TDnet Data Collector APIは、日本取引所グループのTDnet（適時開示情報閲覧サービス）から収集した開示情報を提供するRESTful APIです。

### 主要機能

- 開示情報の検索・取得
- PDFファイルのダウンロード（署名付きURL）
- データ収集ジョブの実行・監視
- 大量データのエクスポート

### 技術スタック

- **API Gateway**: Amazon API Gateway (REST API)
- **Lambda**: AWS Lambda (Node.js 20.x, TypeScript)
- **認証**: APIキー認証（Secrets Manager）
- **データベース**: Amazon DynamoDB
- **ストレージ**: Amazon S3

---

## 認証

### APIキー認証

すべてのエンドポイント（`/health` を除く）はAPIキー認証が必要です。

**ヘッダー:**
```
X-API-Key: your-api-key-here
```

または

```
x-api-key: your-api-key-here
```

**実装の詳細:**
- **本番環境**: AWS Secrets Managerから取得
- **テスト環境**: 環境変数 `API_KEY` から取得（`TEST_ENV=e2e` の場合）

**エラーレスポンス:**
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key is required"
  },
  "request_id": "req-abc123"
}
```

---

## エンドポイント一覧

| メソッド | パス | 説明 | 実装状況 |
|---------|------|------|---------|
| GET | `/disclosures` | 開示情報一覧取得 | ✅ 実装済み |
| GET | `/disclosures/{id}` | 開示情報詳細取得 | ✅ 実装済み |
| GET | `/disclosures/{id}/pdf` | PDF署名付きURL取得 | ✅ 実装済み |
| POST | `/collect` | データ収集開始 | ✅ 実装済み |
| GET | `/collect/{execution_id}` | 収集状態取得 | ✅ 実装済み |
| POST | `/exports` | データエクスポート開始 | ✅ 実装済み |
| GET | `/exports/{export_id}` | エクスポート状態取得 | ✅ 実装済み |
| GET | `/health` | ヘルスチェック | ✅ 実装済み |
| GET | `/stats` | 統計情報取得 | ✅ 実装済み |

---

## エンドポイント詳細

### GET /disclosures

開示情報の一覧を取得します。

**実装ファイル:** `src/lambda/query/handler.ts`

#### リクエスト

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `company_code` | string | No | 企業コード（4桁） | - |
| `start_date` | string | No | 開始日（YYYY-MM-DD） | - |
| `end_date` | string | No | 終了日（YYYY-MM-DD） | - |
| `disclosure_type` | string | No | 開示種類 | - |
| `format` | string | No | レスポンス形式（`json` または `csv`） | `json` |
| `limit` | integer | No | 取得件数（1-1000） | 100 |
| `offset` | integer | No | オフセット（0以上） | 0 |

**バリデーション:**
- `company_code`: 4桁の数字（例: `7203`）
- `start_date`, `end_date`: YYYY-MM-DD形式、有効な日付
- `start_date` ≤ `end_date`（日付順序性チェック）
- `format`: `json` または `csv`
- `limit`: 1-1000の整数
- `offset`: 0以上の整数

**例:**
```
GET /disclosures?company_code=7203&start_date=2024-01-01&end_date=2024-01-31&limit=20
```

#### レスポンス

**成功（200 OK）- JSON形式:**
```json
{
  "disclosures": [
    {
      "disclosure_id": "20240115_7203_001",
      "company_code": "7203",
      "company_name": "トヨタ自動車株式会社",
      "disclosure_type": "決算短信",
      "title": "2024年3月期 第3四半期決算短信",
      "disclosed_at": "2024-01-15T15:00:00+09:00",
      "date_partition": "2024-01",
      "pdf_s3_key": "2024/01/15/7203_決算短信_20240115150000.pdf"
    }
  ],
  "total": 150,
  "total_count": 150,
  "count": 20,
  "offset": 0,
  "limit": 20
}
```

**注意:** `total` と `total_count` は同じ値を返します。`total_count` は将来的な拡張のために追加されました。

**成功（200 OK）- CSV形式:**
```csv
disclosure_id,company_code,company_name,disclosure_type,title,disclosed_at,date_partition,pdf_s3_key
20240115_7203_001,7203,トヨタ自動車株式会社,決算短信,2024年3月期 第3四半期決算短信,2024-01-15T15:00:00+09:00,2024-01,2024/01/15/7203_決算短信_20240115150000.pdf
```

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `401 UNAUTHORIZED`: 認証エラー
- `500 INTERNAL_ERROR`: 内部エラー

---

### GET /disclosures/{id}

開示情報の詳細を取得します。

**実装ファイル:** `src/lambda/get-disclosure/handler.ts`

#### リクエスト

**パスパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `id` | string | Yes | 開示ID（形式: `YYYYMMDD_CCCC_NNN`） |

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `expiration` | integer | No | PDF URL有効期限（秒、1-604800） | 3600 |

**バリデーション:**
- `id`: `YYYYMMDD_CCCC_NNN` 形式（例: `20240115_7203_001`）
- `expiration`: 1-604800の整数（1秒〜7日）

**例:**
```
GET /disclosures/20240115_7203_001?expiration=7200
```

#### レスポンス

**成功（200 OK):**
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
    "date_partition": "2024-01",
    "s3_key": "2024/01/15/7203_決算短信_20240115150000.pdf",
    "downloaded_at": "2024-01-15T15:05:30+09:00",
    "file_size": 1048576,
    "pdf_url": "https://s3.amazonaws.com/..."
  }
}
```

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `401 UNAUTHORIZED`: 認証エラー
- `404 NOT_FOUND`: 開示情報が存在しない
- `500 INTERNAL_ERROR`: 内部エラー

**処理フロー:**
1. APIキー認証（Secrets Manager経由）
2. `disclosure_id` のバリデーション
3. DynamoDBから開示情報を取得
4. S3署名付きURLを生成（PDFが存在する場合）
5. レスポンスを返却

---

### GET /disclosures/{id}/pdf

PDFファイルの署名付きURLを取得します。

**実装ファイル:** `src/lambda/api/pdf-download/handler.ts`

**注意:** このエンドポイントは非推奨です。代わりに `GET /disclosures/{id}` を使用してください（`pdf_url` フィールドに署名付きURLが含まれます）。

**実装ファイル:** `src/lambda/api/pdf-download/handler.ts`

#### リクエスト

**パスパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `id` | string | Yes | 開示ID（形式: `YYYYMMDD_CCCC_NNN`） |

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `expiration` | integer | No | URL有効期限（秒、60-86400） | 3600 |

**バリデーション:**
- `id`: `YYYYMMDD_CCCC_NNN` 形式（例: `20240115_7203_001`）
- `expiration`: 60-86400の整数

**例:**
```
GET /disclosures/20240115_7203_001/pdf?expiration=3600
```

#### レスポンス

**成功（200 OK):**
```json
{
  "status": "success",
  "data": {
    "download_url": "https://s3.amazonaws.com/...",
    "expires_at": "2024-01-15T16:00:00Z"
  }
}
```

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `401 UNAUTHORIZED`: 認証エラー
- `404 NOT_FOUND`: 開示情報またはPDFファイルが存在しない
- `500 INTERNAL_ERROR`: 内部エラー

**処理フロー:**
1. APIキー認証
2. `disclosure_id` のバリデーション
3. DynamoDBから開示情報を取得
4. S3オブジェクトの存在確認（HeadObject）
5. 署名付きURLを生成（GetObject）
6. レスポンスを返却

---

### POST /collect

データ収集ジョブを開始します。

**実装ファイル:** `src/lambda/collect/handler.ts`

#### リクエスト

**リクエストボディ:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

**バリデーション:**
- `start_date`, `end_date`: 必須、YYYY-MM-DD形式、有効な日付
- `start_date` ≤ `end_date`
- `start_date` は過去1年以内
- `end_date` は未来日不可

**例:**
```bash
curl -X POST https://api.example.com/v1/collect \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2024-01-01","end_date":"2024-01-31"}'
```

#### レスポンス

**成功（200 OK):**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec-20240115-abc123",
    "status": "pending",
    "message": "Data collection started successfully",
    "started_at": "2024-01-15T10:00:00Z"
  }
}
```

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `500 INTERNAL_ERROR`: 内部エラー

**処理フロー:**
1. リクエストボディのパース
2. バリデーション
3. Lambda Collectorを同期呼び出し（InvocationType: RequestResponse）
4. 実行IDを取得
5. レスポンスを返却

**注意:**
- 現在、APIキー認証は実装されていません（将来実装予定）

---

### GET /collect/{execution_id}

データ収集ジョブの状態を取得します。

**実装ファイル:** `src/lambda/collect-status/handler.ts`

#### リクエスト

**パスパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `execution_id` | string | Yes | 実行ID |

**例:**
```
GET /collect/exec-20240115-abc123
```

#### レスポンス

**成功（200 OK):**
```json
{
  "status": "success",
  "data": {
    "execution_id": "exec-20240115-abc123",
    "status": "completed",
    "progress": 100,
    "collected_count": 45,
    "failed_count": 2,
    "started_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:05:30Z",
    "completed_at": "2024-01-15T10:05:30Z"
  }
}
```

**ステータス値:**
- `pending`: 待機中
- `running`: 実行中
- `completed`: 完了
- `failed`: 失敗

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `404 NOT_FOUND`: 実行IDが存在しない
- `500 INTERNAL_ERROR`: 内部エラー

**注意:**
- 現在、APIキー認証は実装されていません（将来実装予定）

---

### POST /exports

大量データのエクスポートジョブを開始します。

**実装ファイル:** `src/lambda/export/handler.ts`

#### リクエスト

**リクエストボディ:**
```json
{
  "format": "csv",
  "filter": {
    "company_code": "7203",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "disclosure_type": "決算短信"
  }
}
```

**パラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `format` | string | Yes | エクスポート形式（`json` または `csv`） |
| `filter.company_code` | string | No | 企業コード（4桁） |
| `filter.start_date` | string | No | 開始日（YYYY-MM-DD） |
| `filter.end_date` | string | No | 終了日（YYYY-MM-DD） |
| `filter.disclosure_type` | string | No | 開示種類 |

**バリデーション:**
- `format`: `json` または `csv`
- `filter.company_code`: 4桁の数字
- `filter.start_date`, `filter.end_date`: YYYY-MM-DD形式、有効な日付
- `filter.start_date` ≤ `filter.end_date`

**例:**
```bash
curl -X POST https://api.example.com/v1/exports \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"format":"csv","filter":{"start_date":"2024-01-01","end_date":"2024-12-31"}}'
```

#### レスポンス

**成功（202 Accepted):**
```json
{
  "export_id": "export-20240115-xyz789",
  "status": "pending",
  "message": "Export job created successfully",
  "progress": 0
}
```

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `401 UNAUTHORIZED`: 認証エラー
- `500 INTERNAL_ERROR`: 内部エラー

**処理フロー:**
1. APIキー認証（Secrets Manager経由）
2. リクエストボディのパース
3. バリデーション
4. エクスポートジョブを作成（DynamoDB）
5. 非同期でエクスポート処理を開始
6. レスポンスを返却（202 Accepted）

---

### GET /exports/{export_id}

エクスポートジョブの状態を取得します。

**実装ファイル:** `src/lambda/api/export-status/handler.ts`

#### リクエスト

**パスパラメータ:**

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `export_id` | string | Yes | エクスポートID（形式: `export-YYYYMMDD-{id}`） |

**バリデーション:**
- `export_id`: `export-YYYYMMDD-{id}` 形式（例: `export-20240115-xyz789`）

**例:**
```
GET /exports/export-20240115-xyz789
```

#### レスポンス

**成功（200 OK):**
```json
{
  "status": "success",
  "data": {
    "export_id": "export-20240115-xyz789",
    "status": "completed",
    "progress": 100,
    "requested_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:05:30Z",
    "export_count": 1500,
    "file_size": 10485760,
    "download_url": "https://s3.amazonaws.com/...",
    "expires_at": "2024-01-15T16:00:00Z",
    "error_message": null
  }
}
```

**ステータス値:**
- `pending`: 待機中
- `processing`: 処理中
- `completed`: 完了
- `failed`: 失敗

**エラー:**
- `400 VALIDATION_ERROR`: バリデーションエラー
- `401 UNAUTHORIZED`: 認証エラー
- `404 NOT_FOUND`: エクスポートIDが存在しない
- `500 INTERNAL_ERROR`: 内部エラー

---

### GET /health

ヘルスチェックエンドポイント。

**実装ファイル:** `src/lambda/health/handler.ts`

#### リクエスト

**認証:** 不要（パブリックエンドポイント）

**例:**
```
GET /health
```

#### レスポンス

**成功（200 OK):**
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

**異常（200 OK - ステータスはbodyで判定):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "dynamodb": "unhealthy",
    "s3": "healthy"
  },
  "details": {
    "dynamodb": "Table status: UPDATING"
  }
}
```

**エラー（503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "dynamodb": "unknown",
    "s3": "unknown"
  },
  "details": {
    "error": "Health check failed"
  }
}
```

**処理フロー:**
1. DynamoDBテーブルの状態確認（DescribeTable）
2. S3バケットの存在確認（HeadBucket）
3. 全体のステータスを判定
4. レスポンスを返却

**注意:**
- ヘルスチェックは常に200を返します（bodyでステータスを判定）
- 例外が発生した場合のみ503を返します

---

### GET /stats

統計情報を取得します。

**実装ファイル:** `src/lambda/stats/handler.ts`

#### リクエスト

**認証:** 必須（APIキー）

**例:**
```
GET /stats
```

#### レスポンス

**成功（200 OK):**
```json
{
  "status": "success",
  "data": {
    "total_disclosures": 15000,
    "last_30_days": 450,
    "top_companies": [
      {
        "company_code": "7203",
        "company_name": "トヨタ自動車株式会社",
        "count": 45
      },
      {
        "company_code": "9984",
        "company_name": "ソフトバンクグループ株式会社",
        "count": 38
      }
    ]
  }
}
```

**エラー:**
- `401 UNAUTHORIZED`: 認証エラー
- `500 INTERNAL_ERROR`: 内部エラー

**処理フロー:**
1. APIキー認証（Secrets Manager経由）
2. 総開示情報件数を取得（Scan）
3. 直近30日の収集件数を取得（GSI_DatePartition使用）
4. 企業別件数トップ10を取得（メモリ上で集計）
5. レスポンスを返却

**パフォーマンス注意:**
- 統計情報の取得はScanを使用するため、大量データの場合はパフォーマンスに影響します
- レスポンスは5分間キャッシュされます（`Cache-Control: public, max-age=300`）
- 本番環境では集計テーブルを別途用意することを推奨します

---

## エラーレスポンス

### 標準エラー形式

すべてのエラーレスポンスは以下の形式に従います：

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": {
      "field": "フィールド名",
      "value": "不正な値",
      "expected": "期待される値"
    }
  },
  "request_id": "req-abc123"
}
```

### エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| `VALIDATION_ERROR` | 400 | バリデーションエラー |
| `UNAUTHORIZED` | 401 | 認証エラー（APIキー不正） |
| `FORBIDDEN` | 403 | 権限エラー |
| `NOT_FOUND` | 404 | リソース不存在 |
| `CONFLICT` | 409 | リソース競合 |
| `RATE_LIMIT_EXCEEDED` | 429 | レート制限超過 |
| `INTERNAL_ERROR` | 500 | 内部エラー |
| `SERVICE_UNAVAILABLE` | 503 | サービス利用不可 |
| `GATEWAY_TIMEOUT` | 504 | ゲートウェイタイムアウト |

### エラーレスポンス例

#### バリデーションエラー（400）

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format: 2024/01/15. Expected YYYY-MM-DD format.",
    "details": {
      "field": "start_date",
      "value": "2024/01/15",
      "expected": "YYYY-MM-DD"
    }
  },
  "request_id": "req-abc123"
}
```

#### 認証エラー（401）

```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key is required",
    "details": {}
  },
  "request_id": "req-abc123"
}
```

#### リソース不存在（404）

```json
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Disclosure not found: 20240115_7203_001",
    "details": {}
  },
  "request_id": "req-abc123"
}
```

---

## CORS設定

すべてのエンドポイントでCORSが有効化されています。

**レスポンスヘッダー:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,X-Api-Key
```

**注意:**
- 本番環境では、`Access-Control-Allow-Origin` を特定のドメインに制限することを推奨します。

---

## レート制限

**現在の実装:** レート制限ヘッダーは実装されていません。

**推奨実装:**
- API Gatewayレベルでレート制限を設定
- Lambda関数でレート制限ヘッダーを返却

**推奨ヘッダー:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705305600
```

---

## ページネーション

### オフセットベースページネーション（実装済み）

**GET /disclosures** エンドポイントで使用されています。

**パラメータ:**
- `limit`: 取得件数（デフォルト: 100、最大: 1000）
- `offset`: オフセット（デフォルト: 0）

**レスポンス:**
```json
{
  "disclosures": [...],
  "total": 1500,
  "count": 20,
  "offset": 0,
  "limit": 20
}
```

**次のページを取得:**
```
GET /disclosures?limit=20&offset=20
```

**特徴:**
- ✅ 直感的で理解しやすい
- ✅ 特定ページへのジャンプが可能
- ✅ RESTful APIの一般的なパターン
- ⚠️ 大量データ（10万件以上）ではパフォーマンスに注意

**将来の検討事項:**
- データ量が10万件を超える場合、カーソルベース（DynamoDB LastEvaluatedKey）への移行を検討
- その際は、API v2として新しいエンドポイントを作成することを推奨

---

## データモデル

### Disclosure（開示情報）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `disclosure_id` | string | Yes | 開示ID（形式: `YYYYMMDD_CCCC_NNN`） |
| `company_code` | string | Yes | 企業コード（4桁） |
| `company_name` | string | Yes | 企業名 |
| `disclosure_type` | string | Yes | 開示種類 |
| `title` | string | Yes | タイトル |
| `disclosed_at` | string | Yes | 開示日時（ISO 8601形式、JST） |
| `date_partition` | string | Yes | 日付パーティション（YYYY-MM形式） |
| `pdf_s3_key` | string | No | S3オブジェクトキー |
| `downloaded_at` | string | No | ダウンロード日時 |
| `file_size` | integer | No | ファイルサイズ（バイト） |

**例:**
```json
{
  "disclosure_id": "20240115_7203_001",
  "company_code": "7203",
  "company_name": "トヨタ自動車株式会社",
  "disclosure_type": "決算短信",
  "title": "2024年3月期 第3四半期決算短信",
  "disclosed_at": "2024-01-15T15:00:00+09:00",
  "date_partition": "2024-01",
  "pdf_s3_key": "2024/01/15/7203_決算短信_20240115150000.pdf",
  "downloaded_at": "2024-01-15T15:05:30+09:00",
  "file_size": 1048576
}
```

---

## 実装状況サマリー

### 実装済みエンドポイント（9/9）

- ✅ GET /disclosures
- ✅ GET /disclosures/{id}
- ✅ GET /disclosures/{id}/pdf
- ✅ POST /collect
- ✅ GET /collect/{execution_id}
- ✅ POST /exports
- ✅ GET /exports/{export_id}
- ✅ GET /health
- ✅ GET /stats

### 実装の品質

- ✅ エラーハンドリング: 適切に実装
- ✅ バリデーション: 詳細に実装
- ✅ CORS対応: 実装済み
- ✅ 構造化ログ: 実装済み
- ✅ CloudWatchメトリクス: 実装済み
- ✅ 認証方式: Secrets Manager経由で統一（一部エンドポイントを除く）
- ⚠️ レート制限ヘッダー: 未実装

---

## 今後の改善項目

### 優先度: 高

1. **認証方式の完全統一**
   - POST /collect と GET /collect/{execution_id} にAPIキー認証を追加
   - すべてのハンドラーでSecrets Manager経由の認証に統一

### 優先度: 中

2. **レート制限の実装**
   - API Gatewayレベルでレート制限を設定
   - Lambda関数でレート制限ヘッダーを返却

3. **統計情報の最適化**
   - 集計テーブルを別途用意（Scanの使用を避ける）
   - リアルタイム集計からバッチ集計への移行

### 優先度: 低

4. **CORS設定の最適化**
   - 本番環境では特定のドメインに制限

5. **GET /disclosures の `month` パラメータ**
   - date_partition を使用した効率的なクエリの実装

---

## 関連ドキュメント

- **OpenAPI仕様**: `docs/openapi.yaml` - OpenAPI 3.0仕様
- **API設計ガイドライン**: `.kiro/steering/api/api-design-guidelines.md` - API設計の基本原則
- **エラーコード標準**: `.kiro/steering/api/error-codes.md` - エラーコードの詳細定義
- **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-154512-api-design-review.md` - 実装レビュー記録

---

**最終更新**: 2026-02-12  
**レビュー担当**: Sub-agent (spec-task-execution)  
**更新内容**: 実装済みエンドポイント（GET /disclosures/{id}, GET /health, GET /stats）の詳細を追加

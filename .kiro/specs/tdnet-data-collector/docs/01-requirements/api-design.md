# TDnet Data Collector - API設計書

**作成日**: 2026-02-08  
**バージョン**: 1.0.0  
**ステータス**: 実装ベース

---

## 概要

TDnet Data Collector APIは、TDnetから収集した開示情報を提供するRESTful APIです。

### 主要機能

- 開示情報の検索・取得
- PDFファイルのダウンロード（署名付きURL）
- データ収集ジョブの実行・監視
- 大量データのエクスポート

### 技術スタック

- **API Gateway**: Amazon API Gateway (REST API)
- **Lambda**: AWS Lambda (Node.js 20.x, TypeScript)
- **認証**: APIキー認証（API Gateway使用量プラン）
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

**認証方式（2026-02-14更新）:**
- API Gateway使用量プランとAPIキー機能で認証
- Lambda関数では認証処理なし（API Gatewayで認証済み）

**エラーレスポンス:**
```json
{
  "status": "error",
  "error": {
    "code": "UNAUTHORIZED",
    "message": "API key is required"
  }
}
```

---

## エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/disclosures` | 開示情報一覧取得 | 必須 |
| GET | `/disclosures/{id}` | 開示情報詳細取得 | 必須 |
| GET | `/disclosures/{id}/pdf` | PDF署名付きURL取得 | 必須 |
| POST | `/collect` | データ収集開始 | 必須 |
| GET | `/collect/{execution_id}` | 収集状態取得 | 必須 |
| POST | `/exports` | データエクスポート開始 | 必須 |
| GET | `/exports/{export_id}` | エクスポート状態取得 | 必須 |
| GET | `/health` | ヘルスチェック | 不要 |
| GET | `/stats` | 統計情報取得 | 必須 |

---

## エンドポイント詳細

### GET /disclosures

開示情報の一覧を取得します。

**クエリパラメータ:**

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `company_code` | string | No | 企業コード（4桁） | - |
| `start_date` | string | No | 開始日（YYYY-MM-DD） | - |
| `end_date` | string | No | 終了日（YYYY-MM-DD） | - |
| `month` | string | No | 月指定（YYYY-MM）※start_date/end_dateより優先 | - |
| `disclosure_type` | string | No | 開示種類 | - |
| `format` | string | No | `json` または `csv` | `json` |
| `limit` | integer | No | 取得件数（1-1000） | 100 |

**レスポンス例（JSON）:**
```json
{
  "status": "success",
  "data": {
    "disclosures": [
      {
        "disclosure_id": "20240115_7203_001",
        "company_code": "7203",
        "company_name": "トヨタ自動車株式会社",
        "disclosure_type": "決算短信",
        "title": "2024年3月期 第3四半期決算短信",
        "disclosed_at": "2024-01-15T15:00:00+09:00",
        "pdf_url": "https://s3.amazonaws.com/...",
        "file_size": 1048576
      }
    ],
    "total": 1,
    "limit": 100
  }
}
```

### POST /collect

データ収集ジョブを開始します。

**リクエストボディ:**
```json
{
  "start_date": "2024-01-15",
  "end_date": "2024-01-17"
}
```

**レスポンス（ステータスコード: 200）:**
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

**注意**: 非同期処理のため、即座にexecution_idを返却します。実際の収集状態は`GET /collect/{execution_id}`で確認してください。

### GET /collect/{execution_id}

収集ジョブの状態を取得します。

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
    "started_at": "2024-01-15T10:00:00Z",
    "completed_at": "2024-01-15T10:05:30Z"
  }
}
```

### POST /exports

大量データのエクスポートジョブを開始します。

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

エクスポートジョブの状態を取得します。

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "export_id": "export-20240115-xyz789",
    "status": "completed",
    "download_url": "https://s3.amazonaws.com/...",
    "expires_at": "2024-01-22T16:00:00Z",
    "file_size": 10485760
  }
}
```

### GET /disclosures/{id}/pdf

PDFファイルの署名付きURLを取得します。

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

### GET /health

ヘルスチェックエンドポイント（認証不要）。

**レスポンス（healthy時: 200）:**
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

**レスポンス（unhealthy時: 503）:**
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

### GET /stats

統計情報を取得します。

**レスポンス:**
```json
{
  "status": "success",
  "data": {
    "total_disclosures": 12345,
    "last_30_days": 456,
    "top_companies": [
      {
        "company_code": "7203",
        "company_name": "トヨタ自動車株式会社",
        "count": 45
      }
    ]
  }
}
```

**注意**: 
- `total_disclosures`: 全開示情報件数（Scanを使用、大量データ時はパフォーマンス影響あり）
- `last_30_days`: 直近30日の収集件数（GSI_DatePartitionを使用）
- `top_companies`: 企業別件数トップ10（メモリ上で集計）

---

## エラーレスポンス

### エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|--------------|------|
| `UNAUTHORIZED` | 401 | APIキーが無効または未提供 |
| `FORBIDDEN` | 403 | アクセス権限なし |
| `NOT_FOUND` | 404 | リソースが見つからない |
| `VALIDATION_ERROR` | 400 | リクエストパラメータが不正 |
| `RATE_LIMIT_EXCEEDED` | 429 | レート制限超過 |
| `INTERNAL_ERROR` | 500 | サーバー内部エラー |

### エラーレスポンス形式

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "start_date must be before or equal to end_date",
    "details": {
      "field": "start_date",
      "value": "2024-01-17"
    }
  },
  "request_id": "req-abc123"
}
```

**詳細**: `../../steering/api/error-codes.md`

---

## レート制限

### API Gateway レート制限

| 制限種別 | 値 | 説明 |
|---------|---|------|
| WAF | 500リクエスト/5分 | IP単位のレート制限（100リクエスト/分相当） |
| API Gateway（バースト） | 200リクエスト | 瞬間的なバースト許容 |
| API Gateway（定常） | 100リクエスト/秒 | 定常的なレート制限 |
| 使用量プラン（月間） | 10,000リクエスト | 月間クォータ |

**レート制限超過時:**
```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

**詳細**: `../../steering/api/api-design-guidelines.md`

---

## ページネーション

### 実装方式

- **limit**: 取得件数（1-1000、デフォルト100）
- **offset**: 将来実装予定（現在は未実装）

### レスポンス例

```json
{
  "status": "success",
  "data": {
    "disclosures": [...],
    "total": 1234,
    "limit": 100,
    "has_more": true
  }
}
```

---

## バージョニング

### 現在のバージョン

- **バージョン**: v1
- **パス**: `/v1` プレフィックスなし（将来的に追加予定）

### 将来的な変更

- v2以降は `/v2/disclosures` のようにバージョンプレフィックスを追加
- 後方互換性を維持しながら新機能を追加

---

## 関連ドキュメント

### 設計ドキュメント
- **[Design Document](./design.md)** - システム全体設計
- **[OpenAPI仕様](./openapi.yaml)** - 詳細なAPI仕様
- **[Requirements](./requirements.md)** - 要件定義（要件4-6: API機能）

### 実装ガイドライン（Steering）
- **[API設計ガイドライン](../../steering/api/api-design-guidelines.md)** - RESTful設計原則
- **[エラーコード](../../steering/api/error-codes.md)** - エラーコード一覧と実装
- **[データバリデーション](../../steering/development/data-validation.md)** - リクエストバリデーション

---

**最終更新:** 2026-02-22

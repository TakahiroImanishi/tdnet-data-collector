---
inclusion: fileMatch
fileMatchPattern: '**/api/**/*.ts'
---

# API Design Guidelines

## API設計原則

| 原則 | 説明 |
|------|------|
| リソース指向 | 名詞、複数形（`/disclosures`） |
| 一貫性 | 統一されたレスポンス形式 |
| HTTPステータス | 適切なステータスコード使用 |
| ページネーション | limit/offset、next_token対応 |

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

### 成功
```json
{
  "status": "success",
  "data": { /* リソースデータ */ },
  "meta": { /* ページネーション情報 */ }
}
```

### エラー
```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date format",
    "details": { "field": "start_date" }
  },
  "request_id": "req-abc123"
}
```

## クエリパラメータ

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `company_code` | string | 企業コード（カンマ区切り複数可） |
| `start_date` | string | 開始日（YYYY-MM-DD） |
| `end_date` | string | 終了日（YYYY-MM-DD） |
| `disclosure_type` | string | 開示種類 |
| `limit` | number | 取得件数（デフォルト: 20、最大: 100） |
| `offset` | number | オフセット（デフォルト: 0） |
| `next_token` | string | 次ページトークン（DynamoDB） |
| `sort` | string | ソート（`-disclosed_at`で降順） |

## 認証・レート制限

- **API認証**: `X-API-Key: your-api-key-here`
- **認証済み**: 100リクエスト/分
- **未認証**: 10リクエスト/分

## 関連ドキュメント

- **データバリデーション**: `../development/data-validation.md`
- **エラーコード**: `error-codes.md`

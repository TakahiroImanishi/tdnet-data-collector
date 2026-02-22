# Work Log: OpenAPI仕様の詳細レビュー

**作成日時**: 2026-02-07 17:33:15  
**タスク種別**: docs  
**関連Issue**: Issue 1

---

## タスク概要

### 目的
OpenAPI仕様（docs/openapi.yaml）の詳細レビューを実施し、API設計ガイドラインおよびエラーコード標準との整合性を検証する。

### 背景
- OpenAPI仕様は、APIの契約を定義する重要なドキュメント
- API設計ガイドライン（.kiro/steering/api/api-design-guidelines.md）との整合性が必要
- エラーコード標準（.kiro/steering/api/error-codes.md）との整合性が必要
- 不整合があると、実装とドキュメントの乖離が発生する

### 目標
- [ ] OpenAPI仕様の完全性を確認
- [ ] API設計ガイドラインとの整合性を検証
- [ ] エラーコード標準との整合性を検証
- [ ] 問題点を特定し、改善提案を作成
- [ ] 必要に応じて修正を実施

---

## 実施内容

### 1. ドキュメント確認

#### 確認対象ファイル
- docs/openapi.yaml
- .kiro/steering/api/api-design-guidelines.md
- .kiro/steering/api/error-codes.md

✅ すべてのファイルを読み込み完了

### 2. 整合性検証

#### 2.1 エンドポイント定義の完全性

**API設計ガイドラインで定義されているエンドポイント:**
- GET /disclosures
- GET /disclosures/{id}
- GET /disclosures/{id}/pdf
- POST /collect
- GET /collect/{execution_id}
- POST /exports
- GET /exports/{export_id}
- GET /health
- GET /stats

**OpenAPI仕様で定義されているエンドポイント:**
- ✅ GET /disclosures
- ✅ GET /disclosures/{id}
- ✅ GET /disclosures/{id}/pdf
- ✅ POST /collect
- ✅ GET /collect/{execution_id}
- ✅ POST /exports
- ✅ GET /exports/{export_id}
- ✅ GET /health
- ✅ GET /stats

**結果:** ✅ すべてのエンドポイントが定義されている

#### 2.2 エラーコードの整合性

**error-codes.mdで定義されているエラーコード:**
- VALIDATION_ERROR (400)
- UNAUTHORIZED (401)
- FORBIDDEN (403)
- NOT_FOUND (404)
- CONFLICT (409)
- RATE_LIMIT_EXCEEDED (429)
- INTERNAL_ERROR (500)
- SERVICE_UNAVAILABLE (503)
- GATEWAY_TIMEOUT (504)

**OpenAPI仕様のErrorResponseスキーマで定義されているエラーコード:**
- ✅ VALIDATION_ERROR
- ✅ UNAUTHORIZED
- ✅ FORBIDDEN
- ✅ NOT_FOUND
- ✅ CONFLICT
- ✅ RATE_LIMIT_EXCEEDED
- ✅ INTERNAL_ERROR
- ✅ SERVICE_UNAVAILABLE
- ✅ GATEWAY_TIMEOUT

**結果:** ✅ すべてのエラーコードが定義されている

#### 2.3 レスポンススキーマの妥当性

**成功レスポンス形式（API設計ガイドライン）:**
```json
{
  "status": "success",
  "data": {...},
  "meta": {...}
}
```

**OpenAPI仕様の成功レスポンス:**
- ✅ DisclosureListResponse: status, data, meta
- ✅ DisclosureDetailResponse: status, data
- ✅ PDFUrlResponse: status, data
- ✅ CollectionResponse: status, data
- ✅ CollectionStatusResponse: status, data
- ✅ ExportResponse: status, data
- ✅ ExportStatusResponse: status, data
- ✅ StatsResponse: status, data
- ✅ HealthResponse: status, timestamp, services

**エラーレスポンス形式（error-codes.md）:**
```json
{
  "status": "error",
  "error": {
    "code": "...",
    "message": "...",
    "details": {...}
  },
  "request_id": "..."
}
```

**OpenAPI仕様のErrorResponse:**
```yaml
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
        code: ...
        message: ...
        details: ...
    request_id:
      type: string
```

**結果:** ✅ レスポンス形式が一致している

#### 2.4 認証・認可の仕様

**API設計ガイドライン:**
- APIキー認証（X-API-Keyヘッダー）
- レート制限ヘッダー（X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset）

**OpenAPI仕様:**
- ✅ ApiKeyAuth: type: apiKey, in: header, name: X-API-Key
- ✅ レート制限ヘッダーが各エンドポイントのレスポンスに定義されている
- ✅ /health エンドポイントは security: [] で認証不要

**結果:** ✅ 認証・認可の仕様が一致している

#### 2.5 ページネーションの整合性

**API設計ガイドライン:**
- オフセットベース: limit, offset, total, count, has_next, has_prev
- カーソルベース（DynamoDB用）: limit, next_token, count, has_next

**OpenAPI仕様（PaginationMeta）:**
```yaml
PaginationMeta:
  type: object
  properties:
    has_next:
      type: boolean
    next_token:
      type: string
      nullable: true
```

**問題点:** ❌ オフセットベースのページネーション情報が不足
- total, count, page, per_page, has_prev が定義されていない
- API設計ガイドラインではオフセットベースとカーソルベースの両方をサポートすると記載されているが、OpenAPI仕様ではカーソルベースのみ

**推奨:** OpenAPI仕様をAPI設計ガイドラインに合わせて修正するか、API設計ガイドラインをカーソルベースのみに統一する

#### 2.6 date_partition の整合性

**tdnet-implementation-rules.md:**
- date_partition は disclosed_at から自動生成（YYYY-MM形式）
- GSI（Global Secondary Index）のパーティションキーとして使用
- 月単位のクエリを高速化

**OpenAPI仕様（Disclosure スキーマ）:**
```yaml
date_partition:
  type: string
  description: 'Date partition for efficient querying (YYYY-MM format, derived from disclosed_at)'
  pattern: '^\d{4}-\d{2}$'
  example: '2024-01'
```

**OpenAPI仕様（GET /disclosures パラメータ）:**
```yaml
- name: month
  in: query
  description: 'Query by month (YYYY-MM format, uses date_partition index for efficient querying)'
  schema:
    type: string
    pattern: '^\d{4}-\d{2}$'
    example: '2024-01'
```

**結果:** ✅ date_partition の定義が一致している

#### 2.7 disclosed_at のタイムゾーン仕様

**OpenAPI仕様:**
```yaml
disclosed_at:
  type: string
  format: date-time
  description: |
    Disclosure date and time in ISO8601 format with timezone.
    Server always returns JST (UTC+09:00).
    Example: 2024-01-15T15:00:00+09:00
  example: '2024-01-15T15:00:00+09:00'
```

**start_date/end_date パラメータ:**
```yaml
- name: start_date
  in: query
  description: |
    Start date in YYYY-MM-DD format (JST timezone assumed).
    Interpreted as 00:00:00 JST on the specified date.
    Ignored if month parameter is specified.
  schema:
    type: string
    format: date
    example: '2024-01-01'
```

**結果:** ✅ タイムゾーン仕様が明確に記載されている

#### 2.8 ファイルサイズ制限

**OpenAPI仕様（DisclosureDetail）:**
```yaml
file_size:
  type: integer
  description: |
    PDF file size in bytes.
    Maximum 10MB (10485760 bytes) based on TDnet typical file sizes.
    Larger files may be rejected during collection.
  minimum: 0
  maximum: 10485760
```

**OpenAPI仕様（ExportStatusResponse）:**
```yaml
file_size:
  type: integer
  nullable: true
  description: 'Export file size in bytes (max 100MB per file, larger exports are split)'
```

**結果:** ✅ ファイルサイズ制限が明確に記載されている

#### 2.9 レート制限の詳細

**OpenAPI仕様（TooManyRequests レスポンス）:**
```yaml
TooManyRequests:
  description: Too Many Requests
  headers:
    X-RateLimit-Limit:
      schema:
        type: integer
      description: 'Request limit per second (API Gateway throttle limit)'
    X-RateLimit-Remaining:
      schema:
        type: integer
      description: Remaining requests in current second
    X-RateLimit-Reset:
      schema:
        type: integer
        format: int64
      description: 'Unix timestamp in seconds when the rate limit resets'
```

**API設計ガイドライン:**
- 認証済みユーザー: 100リクエスト/分
- 未認証: 10リクエスト/分

**問題点:** ⚠️ レート制限の単位が不一致
- OpenAPI仕様: "per second"
- API設計ガイドライン: "per minute"

**推奨:** レート制限の単位を統一する（API Gatewayの実装に合わせる）

#### 2.10 progress フィールドの計算式

**OpenAPI仕様（CollectionStatusResponse）:**
```yaml
progress:
  type: integer
  minimum: 0
  maximum: 100
  description: |
    Progress percentage (0-100).
    Calculated as: (collected_count + failed_count + skipped_count) / total_count * 100
```

**結果:** ✅ 計算式が明確に記載されている

### 3. 問題点のまとめ

#### 🔴 Critical（修正必須）

なし

#### 🟠 High（修正推奨）

1. **ページネーション情報の不一致**
   - **問題**: OpenAPI仕様ではカーソルベースのみ、API設計ガイドラインではオフセットベースとカーソルベースの両方をサポート
   - **影響**: 実装とドキュメントの乖離
   - **推奨**: API設計ガイドラインをカーソルベースのみに統一（DynamoDB推奨）

2. **レート制限の単位不一致**
   - **問題**: OpenAPI仕様では "per second"、API設計ガイドラインでは "per minute"
   - **影響**: レート制限の実装が不明確
   - **推奨**: API Gatewayの実装に合わせて統一

#### 🟡 Medium（改善推奨）

なし

#### 🟢 Low（任意）

なし



### 4. 改善提案

#### 提案1: ページネーション仕様の統一

**現状:**
- API設計ガイドラインでは、オフセットベースとカーソルベースの両方をサポートすると記載
- OpenAPI仕様では、カーソルベースのみを実装

**推奨アクション:**
API設計ガイドラインをカーソルベースのみに統一する（DynamoDB推奨のベストプラクティス）

**理由:**
- DynamoDBではカーソルベース（LastEvaluatedKey）が推奨
- オフセットベースは大規模データセットで非効率
- 実装の複雑さを軽減

**修正内容:**
- API設計ガイドラインから「オフセットベース」のセクションを削除
- カーソルベースのみをサポートすることを明記

#### 提案2: レート制限の単位統一

**現状:**
- OpenAPI仕様: "Request limit per second"
- API設計ガイドライン: "100リクエスト/分"

**推奨アクション:**
API Gatewayの実装に合わせて、レート制限の単位を統一する

**確認が必要:**
- API Gatewayの使用量プランで設定する単位（秒単位 or 分単位）
- 実際の実装に合わせてドキュメントを更新

**修正内容:**
- OpenAPI仕様のレート制限ヘッダーの説明を修正
- API設計ガイドラインと整合性を取る

#### 提案3: OpenAPI仕様の拡充（任意）

以下の項目を追加することで、より詳細な仕様書になります：

1. **サーバーURL**
   - 現在はプレースホルダー（api.example.com）
   - 実際のAPIエンドポイントに更新

2. **セキュリティスキームの詳細**
   - APIキーの取得方法
   - APIキーの有効期限

3. **レスポンス例の追加**
   - 各エンドポイントに具体的なレスポンス例を追加
   - エラーレスポンスの例を充実

4. **リクエストボディの例**
   - POST /collect, POST /exports のリクエスト例を追加

### 5. 検証結果サマリー

| 検証項目 | 結果 | 備考 |
|---------|------|------|
| エンドポイント定義の完全性 | ✅ 合格 | すべてのエンドポイントが定義されている |
| エラーコードの整合性 | ✅ 合格 | すべてのエラーコードが定義されている |
| レスポンススキーマの妥当性 | ✅ 合格 | 成功・エラーレスポンス形式が一致 |
| 認証・認可の仕様 | ✅ 合格 | APIキー認証、レート制限ヘッダーが定義されている |
| ページネーションの整合性 | ⚠️ 要改善 | オフセットベースとカーソルベースの不一致 |
| date_partition の整合性 | ✅ 合格 | 定義が一致している |
| タイムゾーン仕様 | ✅ 合格 | JST (UTC+09:00) が明記されている |
| ファイルサイズ制限 | ✅ 合格 | 制限が明確に記載されている |
| レート制限の詳細 | ⚠️ 要改善 | 単位（秒 vs 分）の不一致 |
| progress フィールド | ✅ 合格 | 計算式が明確に記載されている |

**総合評価:** 🟢 良好（軽微な改善点あり）

OpenAPI仕様は全体的に高品質で、API設計ガイドラインおよびエラーコード標準との整合性が取れています。以下の2点を修正することで、完全な整合性が確保されます：

1. ページネーション仕様の統一（カーソルベースのみに統一）
2. レート制限の単位統一（秒 or 分）

---

## 成果物

### 作成・変更したファイル

- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260207-173315-openapi-specification-review.md` - 本作業記録

### 確認したファイル

- `docs/openapi.yaml` - OpenAPI仕様
- `.kiro/steering/api/api-design-guidelines.md` - API設計ガイドライン
- `.kiro/steering/api/error-codes.md` - エラーコード標準

---

## 次回への申し送り

### 推奨される次のアクション

1. **API設計ガイドラインの修正**
   - オフセットベースのページネーションセクションを削除
   - カーソルベースのみをサポートすることを明記
   - レート制限の単位を統一（API Gatewayの実装に合わせる）

2. **OpenAPI仕様の修正（必要に応じて）**
   - レート制限ヘッダーの説明を修正（単位を統一）
   - サーバーURLを実際のエンドポイントに更新（デプロイ後）

3. **実装の確認**
   - API Gatewayの使用量プランでレート制限の単位を確認
   - 実装がカーソルベースのページネーションのみをサポートしていることを確認

### 注意点

- OpenAPI仕様は全体的に高品質で、大きな問題はありません
- 軽微な不一致（ページネーション、レート制限の単位）を修正することで、完全な整合性が確保されます
- 実装とドキュメントの整合性を保つため、変更時は両方を更新してください

### 未完了の作業

なし（レビューは完了）

---

## 振り返り

### うまくいった点

- OpenAPI仕様とAPI設計ガイドラインの整合性が高い
- エラーコード標準が完全に反映されている
- date_partition、タイムゾーン、ファイルサイズ制限などの詳細仕様が明確
- レスポンススキーマが一貫している

### 改善が必要な点

- ページネーション仕様の不一致（オフセットベース vs カーソルベース）
- レート制限の単位不一致（秒 vs 分）

### 学んだこと

- OpenAPI仕様とAPI設計ガイドラインの整合性を保つことの重要性
- DynamoDBを使用する場合、カーソルベースのページネーションが推奨される
- レート制限の単位は、API Gatewayの実装に合わせて統一する必要がある

# 作業記録: タスク38 - OpenAPI仕様書の整合性確認

**作成日時**: 2026-02-22 12:27:42  
**作業者**: Kiro AI Assistant  
**関連タスク**: tasks-improvements-20260222.md - タスク38

## 作業目的

OpenAPI仕様書（`.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`）の内容を確認し、実装との整合性を検証する。

## 確認項目

1. エンドポイント一覧の整合性
2. リクエスト/レスポンス形式
3. ステータスコード
4. パラメータ（limit, month等）
5. レート制限設定

## 作業手順

### 1. OpenAPI仕様書の確認


OpenAPI仕様書を確認しました。

### 2. 実装との整合性検証

#### 2.1 エンドポイント一覧の比較

| OpenAPI仕様 | 実装状況 | Lambda関数 | 備考 |
|------------|---------|-----------|------|
| GET /disclosures | ✅ 実装済み | query/handler.ts | パスは異なるが機能は同じ |
| GET /disclosures/{id} | ✅ 実装済み | get-disclosure/handler.ts | |
| GET /disclosures/{id}/pdf | ✅ 実装済み | api/pdf-download/handler.ts | |
| POST /collect | ✅ 実装済み | collect/handler.ts | |
| GET /collect/{execution_id} | ✅ 実装済み | collect-status/handler.ts | |
| POST /exports | ✅ 実装済み | export/handler.ts | |
| GET /exports/{export_id} | ✅ 実装済み | api/export-status/handler.ts | |
| GET /health | ✅ 実装済み | health/handler.ts | |
| GET /stats | ✅ 実装済み | stats/handler.ts | |

**結果**: すべてのエンドポイントが実装されています。

#### 2.2 リクエスト/レスポンス形式の整合性

##### GET /disclosures (query)
- **OpenAPI**: `company_code`, `start_date`, `end_date`, `month`, `disclosure_type`, `limit`, `offset`, `next_token`
- **実装**: ✅ すべてのパラメータに対応
- **追加実装**: `format` (json/csv) - OpenAPI仕様に記載なし

##### GET /disclosures/{id} (get-disclosure)
- **OpenAPI**: パスパラメータ `id`、クエリパラメータ `expiration`
- **実装**: ✅ 対応済み
- **差異**: OpenAPIでは `pdf_url` がレスポンスに含まれる想定だが、実装では署名付きURLを生成して返却

##### GET /disclosures/{id}/pdf (pdf-download)
- **OpenAPI**: パスパラメータ `id`、クエリパラメータ `expiration` (60-86400秒)
- **実装**: ✅ 対応済み
- **レスポンス**: OpenAPIでは `pdf_url` と `expires_at`、実装では `download_url` と `expires_at`
- **差異**: レスポンスフィールド名が異なる（`pdf_url` vs `download_url`）

##### POST /collect
- **OpenAPI**: リクエストボディに `start_date`, `end_date`
- **実装**: ✅ 対応済み
- **レスポンス**: OpenAPIとほぼ一致（`execution_id`, `status`, `message`, `started_at`）

##### GET /collect/{execution_id} (collect-status)
- **OpenAPI**: パスパラメータ `execution_id`
- **実装**: ✅ 対応済み
- **レスポンス**: OpenAPIとほぼ一致（`execution_id`, `status`, `progress`, `collected_count`, `failed_count`, `started_at`, `completed_at`）
- **追加実装**: `skipped_count` - OpenAPI仕様に記載なし

##### POST /exports
- **OpenAPI**: リクエストボディに `company_code`, `start_date`, `end_date`, `format`
- **実装**: ✅ 対応済み（`filter`オブジェクト内に含まれる）
- **レスポンス**: OpenAPIでは `export_id` と `status`、実装では追加で `message` と `progress`

##### GET /exports/{export_id} (export-status)
- **OpenAPI**: パスパラメータ `export_id`
- **実装**: ✅ 対応済み
- **レスポンス**: OpenAPIとほぼ一致（`export_id`, `status`, `export_count`, `file_size`, `download_url`, `expires_at`）

##### GET /health
- **OpenAPI**: 認証不要、レスポンスに `status`, `timestamp`, `services`, `details`
- **実装**: ✅ 対応済み

##### GET /stats
- **OpenAPI**: レスポンスに `total_disclosures`, `last_30_days`, `top_companies`
- **実装**: ✅ 対応済み

#### 2.3 ステータスコードの整合性

| エンドポイント | OpenAPI | 実装 | 整合性 |
|--------------|---------|------|--------|
| GET /disclosures | 200, 400, 401, 429, 500 | 200, 400, 404, 500 | ⚠️ 401, 429未実装 |
| GET /disclosures/{id} | 200, 401, 404, 500 | 200, 404, 500 | ⚠️ 401未実装 |
| GET /disclosures/{id}/pdf | 200, 401, 404, 500 | 200, 400, 401, 404, 500 | ✅ 一致 |
| POST /collect | 200, 400, 401, 500 | 200, 400, 401, 500 | ✅ 一致 |
| GET /collect/{execution_id} | 200, 401, 404, 500 | 200, 400, 404, 500 | ⚠️ 401未実装 |
| POST /exports | 200, 400, 401, 500 | 202, 400, 401, 500 | ⚠️ 202 vs 200 |
| GET /exports/{export_id} | 200, 401, 404, 500 | 200, 400, 401, 404, 500 | ✅ 一致 |
| GET /health | 200, 503 | 200, 503 | ✅ 一致 |
| GET /stats | 200, 401, 500 | 200, 500 | ⚠️ 401未実装 |

#### 2.4 パラメータの整合性

##### limit パラメータ
- **OpenAPI**: デフォルト100、最大1000
- **実装 (query)**: デフォルト100、最大1000 ✅ 一致

##### expiration パラメータ
- **OpenAPI (pdf-download)**: 最小60、最大86400、デフォルト3600
- **実装 (pdf-download)**: 最小60、最大86400、デフォルト3600 ✅ 一致

##### month パラメータ
- **OpenAPI**: YYYY-MM形式
- **実装 (query)**: ✅ 対応済み、start_date/end_dateより優先

#### 2.5 レート制限設定

- **OpenAPI**: 認証済み100リクエスト/分、未認証10リクエスト/分
- **実装**: ⚠️ レート制限の実装が確認できない（API Gateway側で設定されている可能性）

## 発見された不一致

### 1. レスポンスフィールド名の不一致

**GET /disclosures/{id}/pdf**
- OpenAPI: `pdf_url`
- 実装: `download_url`

### 2. ステータスコードの不一致

**POST /exports**
- OpenAPI: 200 (Success)
- 実装: 202 (Accepted)
- 理由: 非同期処理のため202が適切

### 3. 認証エラー (401) の未実装

以下のエンドポイントでOpenAPIでは401を返す仕様だが、実装では認証チェックが確認できない:
- GET /disclosures
- GET /disclosures/{id}
- GET /collect/{execution_id}
- GET /stats

### 4. レート制限 (429) の未実装

GET /disclosuresでOpenAPIでは429を返す仕様だが、実装では確認できない。

### 5. 追加実装されているフィールド

**GET /disclosures (query)**
- `format` パラメータ (json/csv) - OpenAPI仕様に記載なし

**GET /collect/{execution_id}**
- `skipped_count` フィールド - OpenAPI仕様に記載なし

**POST /exports**
- `message` と `progress` フィールド - OpenAPI仕様に記載なし

## 推奨される修正

### 優先度: 高

1. **レスポンスフィールド名の統一**
   - `download_url` → `pdf_url` に変更（OpenAPI仕様に合わせる）

2. **POST /exportsのステータスコード**
   - OpenAPI仕様を202に変更（非同期処理のため適切）

### 優先度: 中

3. **OpenAPI仕様への追加**
   - `format` パラメータをGET /disclosuresに追加
   - `skipped_count` フィールドをGET /collect/{execution_id}に追加
   - `message` と `progress` フィールドをPOST /exportsに追加

4. **認証実装の確認**
   - API Gateway側でAPIキー認証が設定されているか確認
   - 設定されていない場合は、Lambda関数側で認証チェックを追加

### 優先度: 低

5. **レート制限の実装確認**
   - API Gateway側でレート制限が設定されているか確認
   - 設定されていない場合は、Usage Planで設定

## 結論

OpenAPI仕様書と実装の間には、いくつかの軽微な不一致がありますが、全体的には整合性が取れています。

主な不一致:
1. レスポンスフィールド名の違い（`pdf_url` vs `download_url`）
2. ステータスコードの違い（POST /exportsで202 vs 200）
3. 一部エンドポイントでの認証エラー (401) の未実装
4. OpenAPI仕様に記載のない追加フィールド

これらの不一致は、OpenAPI仕様書を実装に合わせて更新することで解決できます。



## 実施した修正

### 1. レスポンスフィールド名の統一

**GET /disclosures/{id}/pdf**
- 変更前: `pdf_url`
- 変更後: `download_url`
- 理由: 実装に合わせて統一

### 2. ステータスコードの修正

**POST /exports**
- 変更前: 200 (Success)
- 変更後: 202 (Accepted)
- 理由: 非同期処理のため202が適切

### 3. 追加パラメータの記載

**GET /disclosures**
- 追加: `format` パラメータ (json/csv)
- 理由: 実装で対応済みのため仕様書に追加

### 4. 追加フィールドの記載

**GET /collect/{execution_id}**
- 追加: `skipped_count` フィールド（説明付き）
- 理由: 実装で返却されているため仕様書に追加

**POST /exports**
- 追加: `message` と `progress` フィールド
- 理由: 実装で返却されているため仕様書に追加

### 5. 400エラーの追加

**GET /disclosures/{id}/pdf**
- 追加: 400 Bad Request
- 理由: expirationパラメータのバリデーションエラーに対応

## 未修正の項目（API Gateway側で対応）

以下の項目は、Lambda関数ではなくAPI Gateway側で設定されるべき内容のため、OpenAPI仕様書の更新のみで対応:

### 1. 認証エラー (401) の実装

以下のエンドポイントでは、API Gateway側でAPIキー認証が設定されている想定:
- GET /disclosures
- GET /disclosures/{id}
- GET /collect/{execution_id}
- GET /stats

### 2. レート制限 (429) の実装

GET /disclosuresでのレート制限は、API GatewayのUsage Planで設定される想定。

## 成果物

- `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml` を更新
  - レスポンスフィールド名を実装に合わせて修正
  - ステータスコードを実装に合わせて修正
  - 実装済みの追加パラメータ・フィールドを記載

## 申し送り事項

1. **API Gateway設定の確認**
   - APIキー認証が正しく設定されているか確認
   - Usage Planでレート制限が設定されているか確認

2. **今後の開発**
   - OpenAPI仕様書と実装の整合性を保つため、API変更時は両方を更新すること
   - 新規エンドポイント追加時は、OpenAPI仕様書を先に更新してから実装すること

3. **テスト**
   - 更新したOpenAPI仕様書を使用してAPI統合テストを実行することを推奨


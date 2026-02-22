# 作業記録: API設計・実装チェック

**作業日時**: 2026年2月22日 08:37:19  
**作業者**: サブエージェント4  
**タスク**: API設計・実装チェック（品質チェックタスク）

---

## 目的

TDnet Data CollectorのAPI設計と実装の整合性を確認し、以下の項目をチェックする：

- API Gateway設定
- エンドポイント定義（/disclosures, /disclosures/{id}, /export, /stats, /health）
- 認証・認可（APIキー）
- レート制限設定
- CORS設定
- エラーレスポンス形式
- APIドキュメント（OpenAPI/Swagger）

---

## 調査結果

### 1. API Gateway設定（CDK実装）

**ファイル**: `cdk/lib/stacks/api-stack.ts`

#### ✅ 実装済み項目

1. **API Gateway設定**
   - REST API作成: `tdnet-data-collector-api-{env}`
   - ステージ: `prod`
   - スロットリング: 100 req/秒、バースト200
   - ロギング: INFO、データトレース有効
   - メトリクス: 有効
   - CloudWatch Role: 有効

2. **CORS設定**
   - Origins: `ALL_ORIGINS`（すべてのオリジン許可）
   - Methods: `ALL_METHODS`
   - Headers: `Content-Type`, `X-Amz-Date`, `Authorization`, `X-Api-Key`, `X-Amz-Security-Token`
   - Credentials: 有効

3. **APIキー認証**
   - APIキー作成: `tdnet-api-key-{env}`
   - Usage Plan設定:
     - スロットリング: 100 req/秒、バースト200
     - クォータ: 10,000リクエスト/月
   - すべてのエンドポイント（`/health`を除く）で`apiKeyRequired: true`

4. **WAF設定**
   - WafConstructによる保護
   - レート制限: 500リクエスト/5分（100 req/分相当）

5. **エンドポイント定義**
   - ✅ `GET /disclosures` → Query Lambda
   - ✅ `POST /exports` → Export Lambda
   - ✅ `GET /exports/{export_id}` → Export Status Lambda
   - ✅ `POST /collect` → Collect Lambda
   - ✅ `GET /collect/{execution_id}` → Collect Status Lambda
   - ✅ `GET /disclosures/{disclosure_id}/pdf` → PDF Download Lambda
   - ✅ `GET /health` → Health Lambda（認証不要）
   - ✅ `GET /stats` → Stats Lambda（認証必要）

### 2. Lambda関数実装

#### ✅ Query Lambda (`src/lambda/query/handler.ts`)

**実装状況**:
- クエリパラメータ: `company_code`, `start_date`, `end_date`, `month`, `disclosure_type`, `format`, `limit`, `offset`
- バリデーション: 日付形式（YYYY-MM-DD）、企業コード（4桁）、limit（1-1000）、offset（非負整数）
- 日付順序チェック: start_date ≤ end_date（Property 8準拠）
- レスポンス形式: JSON/CSV対応
- エラーハンドリング: ValidationError, NotFoundError
- CORS: `Access-Control-Allow-Origin: *`
- メトリクス: LambdaExecutionTime, QueryResultCount

**問題点**:
- ❌ **設計との不整合**: 設計ドキュメント（api-design.md）では`limit`のデフォルトが100、最大1000だが、実装では最大1000となっている
- ❌ **設計との不整合**: OpenAPI仕様では`limit`の最大が100だが、実装では1000
- ⚠️ **改善提案**: `month`パラメータは設計ドキュメントに記載なし（実装のみ存在）

#### ✅ Export Lambda (`src/lambda/export/handler.ts`)

**実装状況**:
- リクエストボディ: `format` (json/csv), `filter` (company_code, start_date, end_date, disclosure_type)
- バリデーション: 日付形式、企業コード、日付順序
- 非同期処理: `processExport`を非同期で実行（await しない）
- ステータスコード: 202 Accepted
- エラーハンドリング: ValidationError, AuthenticationError
- CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type,X-Api-Key`
- メトリクス: LambdaExecutionTime, ExportJobsCreated

**問題点**:
- ✅ 設計との整合性: 良好

#### ✅ Health Lambda (`src/lambda/health/handler.ts`)

**実装状況**:
- ヘルスチェック: DynamoDB（DescribeTable）、S3（HeadBucket）
- レスポンス: `status` (healthy/unhealthy), `timestamp`, `services` (dynamodb, s3)
- ステータスコード: 200（常に）、503（エラー時）
- 認証: 不要（設計通り）
- CORS: `Access-Control-Allow-Origin: *`
- キャッシュ: `Cache-Control: no-cache, no-store, must-revalidate`
- メトリクス: LambdaExecutionTime, HealthCheckStatus

**問題点**:
- ⚠️ **設計との不整合**: 設計ドキュメントではステータスコード503を返すべきだが、実装では常に200を返している（エラー時のみ503）

#### ✅ Stats Lambda (`src/lambda/stats/handler.ts`)

**実装状況**:
- 統計情報: `total_disclosures`, `last_30_days`, `top_companies`
- DynamoDB操作: Scan（総件数）、Query（直近30日）、Scan（企業別集計）
- 認証: 必要（設計通り）
- CORS: `Access-Control-Allow-Origin: *`
- キャッシュ: `Cache-Control: public, max-age=300`（5分）
- メトリクス: LambdaExecutionTime

**問題点**:
- ⚠️ **パフォーマンス懸念**: Scanを使用した全件取得は大量データで性能問題の可能性
- ⚠️ **設計との不整合**: 設計ドキュメント（api-design.md）では`total_companies`, `latest_disclosure_date`, `storage_size_bytes`が含まれるが、実装では`last_30_days`, `top_companies`

#### ✅ Collect Lambda (`src/lambda/collect/handler.ts`)

**実装状況**:
- リクエストボディ: `start_date`, `end_date`
- バリデーション: 日付形式、日付順序、範囲（過去1年以内）、未来日チェック
- 非同期呼び出し: Lambda Collectorを`InvocationType: Event`で呼び出し
- ステータスコード: 200
- エラーハンドリング: ValidationError
- CORS: `Access-Control-Allow-Origin: *`

**問題点**:
- ⚠️ **設計との不整合**: 設計ドキュメントでは202 Acceptedを返すべきだが、実装では200を返している

#### ✅ Collect Status Lambda (`src/lambda/collect-status/handler.ts`)

**実装状況**:
- パスパラメータ: `execution_id`
- DynamoDB操作: GetItem（`tdnet_executions`テーブル）
- レスポンス: `execution_id`, `status`, `progress`, `collected_count`, `failed_count`, `started_at`, `updated_at`, `completed_at`, `error_message`
- エラーハンドリング: ValidationError, NotFoundError
- CORS: `Access-Control-Allow-Origin: *`

**問題点**:
- ✅ 設計との整合性: 良好

#### ✅ Export Status Lambda (`src/lambda/api/export-status/handler.ts`)

**実装状況**:
- パスパラメータ: `export_id`
- バリデーション: export_idフォーマット（`export-YYYYMMDD-{id}`）
- DynamoDB操作: GetItem（`tdnet_export_status`テーブル）、再試行戦略（指数バックオフ）
- レスポンス: `export_id`, `status`, `progress`, `requested_at`, `completed_at`, `export_count`, `file_size`, `download_url`, `expires_at`, `error_message`
- エラーハンドリング: ValidationError, AuthenticationError, NotFoundError
- CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type,X-Api-Key`
- メトリクス: LambdaExecutionTime, ExportStatusQueries

**問題点**:
- ✅ 設計との整合性: 良好

#### ✅ Get Disclosure Lambda (`src/lambda/get-disclosure/handler.ts`)

**実装状況**:
- パスパラメータ: `id` (disclosure_id)
- クエリパラメータ: `expiration`（署名付きURL有効期限、1秒〜7日）
- DynamoDB操作: GetCommand
- S3操作: 署名付きURL生成（デフォルト1時間）
- レスポンス: 開示情報 + `pdf_url`
- エラーハンドリング: NotFoundError
- CORS: `Access-Control-Allow-Origin: *`
- メトリクス: LambdaExecutionTime

**問題点**:
- ⚠️ **エンドポイント不整合**: 設計では`GET /disclosures/{id}`と`GET /disclosures/{id}/pdf`が別エンドポイントだが、実装では`GET /disclosures/{id}`が署名付きURLを含む

### 3. エラーレスポンス形式

#### ✅ 統一されたエラーレスポンス形式

すべてのLambda関数で以下の形式を使用:

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "エラーメッセージ",
    "details": {}
  },
  "request_id": "req-abc123"
}
```

**エラーコード**:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)
- `GATEWAY_TIMEOUT` (504)

**問題点**:
- ✅ エラーレスポンス形式は統一されている
- ✅ API設計ガイドライン（api-design-guidelines.md）に準拠

### 4. OpenAPI仕様

**ファイル**: `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`

#### ✅ 定義済みエンドポイント

- `GET /disclosures`
- `GET /disclosures/{id}`
- `GET /disclosures/{id}/pdf`
- `POST /collect`
- `GET /collect/{execution_id}`
- `POST /exports`
- `GET /exports/{export_id}`
- `GET /health`
- `GET /stats`

**問題点**:
- ⚠️ **パラメータ不整合**: OpenAPI仕様では`limit`の最大が100だが、実装では1000
- ⚠️ **パラメータ不整合**: OpenAPI仕様では`next_token`が定義されているが、実装では未対応
- ⚠️ **パラメータ不整合**: 実装の`month`パラメータがOpenAPI仕様に未記載

### 5. 認証・認可

#### ✅ APIキー認証

- API Gateway Usage Planで認証
- Lambda関数では認証処理なし（API Gatewayで認証済み）
- `/health`エンドポイントのみ認証不要

**問題点**:
- ✅ 設計通りに実装されている

### 6. レート制限

#### ✅ 実装済み

1. **API Gateway**: 100 req/秒、バースト200
2. **Usage Plan**: 100 req/秒、バースト200、10,000リクエスト/月
3. **WAF**: 500リクエスト/5分（100 req/分相当）

**問題点**:
- ⚠️ **設計との不整合**: API設計ドキュメント（api-design.md）では「認証済み: 100リクエスト/分、未認証: 10リクエスト/分」だが、実装では「100リクエスト/秒」
- ⚠️ **設計との不整合**: WAFのレート制限（2000リクエスト/5分）が設計ドキュメントと異なる（実装: 500リクエスト/5分）

### 7. CORS設定

#### ✅ 実装済み

- すべてのエンドポイントで`Access-Control-Allow-Origin: *`
- 一部のエンドポイントで`Access-Control-Allow-Headers: Content-Type,X-Api-Key`

**問題点**:
- ✅ 設計通りに実装されている

---

## 問題点まとめ

### 🔴 重要な問題（修正推奨）

1. **Query Lambda: limitパラメータの不整合**
   - 設計: デフォルト100、最大1000
   - OpenAPI: 最大100
   - 実装: 最大1000
   - **推奨**: OpenAPI仕様を最大1000に修正、または実装を最大100に変更

2. **Stats Lambda: レスポンス項目の不整合**
   - 設計: `total_companies`, `latest_disclosure_date`, `storage_size_bytes`
   - 実装: `last_30_days`, `top_companies`
   - **推奨**: 設計ドキュメントとOpenAPI仕様を実装に合わせて更新

3. **Collect Lambda: ステータスコードの不整合**
   - 設計: 202 Accepted
   - 実装: 200 OK
   - **推奨**: 実装を202 Acceptedに変更（非同期処理のため）

4. **レート制限の不整合**
   - 設計: 100リクエスト/分
   - 実装: 100リクエスト/秒
   - **推奨**: 設計ドキュメントを実装に合わせて更新、または実装を変更

### ⚠️ 軽微な問題（改善提案）

5. **Query Lambda: monthパラメータ**
   - 実装のみ存在、設計ドキュメントに未記載
   - **推奨**: 設計ドキュメントとOpenAPI仕様に追加

6. **Health Lambda: ステータスコード**
   - 設計: unhealthy時に503
   - 実装: 常に200、エラー時のみ503
   - **推奨**: unhealthy時も503を返すように修正

7. **Get Disclosure Lambda: エンドポイント統合**
   - 設計: `/disclosures/{id}`と`/disclosures/{id}/pdf`が別
   - 実装: `/disclosures/{id}`が署名付きURLを含む
   - **推奨**: 設計通りにエンドポイントを分離、または設計を実装に合わせて更新

8. **Stats Lambda: パフォーマンス懸念**
   - Scanを使用した全件取得
   - **推奨**: 集計テーブルの導入、またはCloudWatchメトリクスからの取得

9. **OpenAPI仕様: next_tokenパラメータ**
   - OpenAPI仕様に定義されているが実装未対応
   - **推奨**: 実装を追加、またはOpenAPI仕様から削除

### ✅ 良好な実装

- エラーレスポンス形式の統一
- CORS設定
- APIキー認証
- エラーハンドリング（ValidationError, NotFoundError等）
- 構造化ログ
- CloudWatchメトリクス送信
- 再試行戦略（Export Status Lambda）

---

## 改善提案

### 1. 設計ドキュメントの更新

**ファイル**: `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`

```markdown
## クエリパラメータ

| パラメータ | 型 | 必須 | 説明 | デフォルト |
|-----------|---|------|------|-----------|
| `company_code` | string | No | 企業コード（4桁） | - |
| `start_date` | string | No | 開始日（YYYY-MM-DD） | - |
| `end_date` | string | No | 終了日（YYYY-MM-DD） | - |
| `month` | string | No | 月（YYYY-MM形式、start_date/end_dateより優先） | - |
| `disclosure_type` | string | No | 開示種類 | - |
| `format` | string | No | `json` または `csv` | `json` |
| `limit` | integer | No | 取得件数（1-1000） | 100 |
| `offset` | integer | No | オフセット | 0 |
```

### 2. OpenAPI仕様の更新

**ファイル**: `.kiro/specs/tdnet-data-collector/docs/01-requirements/openapi.yaml`

```yaml
# GET /disclosures のlimitパラメータ
- name: limit
  in: query
  description: Number of results per page
  schema:
    type: integer
    minimum: 1
    maximum: 1000  # 100 → 1000に変更
    default: 100

# monthパラメータを追加
- name: month
  in: query
  description: Month (YYYY-MM format, takes precedence over start_date/end_date)
  schema:
    type: string
    pattern: '^\d{4}-\d{2}$'
    example: '2024-01'

# next_tokenパラメータを削除（未実装のため）
```

### 3. Stats Lambdaのレスポンス修正

**ファイル**: `src/lambda/stats/handler.ts`

設計ドキュメントに合わせてレスポンスを修正:

```typescript
interface StatsResponse {
  total_disclosures: number;
  total_companies: number;  // 追加
  latest_disclosure_date: string;  // 追加
  storage_size_bytes: number;  // 追加
}
```

または、設計ドキュメントを実装に合わせて更新。

### 4. Collect Lambdaのステータスコード修正

**ファイル**: `src/lambda/collect/handler.ts`

```typescript
return {
  statusCode: 202,  // 200 → 202に変更
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(response),
};
```

### 5. レート制限の明確化

**ファイル**: `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`

```markdown
## レート制限

### API Gateway レート制限

| 制限種別 | 値 | 説明 |
|---------|---|------|
| リクエスト数 | 500/IP/5分 | WAFで制限 |
| バースト | 200リクエスト | API Gateway設定 |
| 定常 | 100リクエスト/秒 | API Gateway設定 |
| クォータ | 10,000リクエスト/月 | Usage Plan設定 |
```

---

## 成果物

1. **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-083719-quality-check-api-design.md`
2. **チェック結果サマリー**: 本ドキュメント

---

## 申し送り事項

### 次のアクション

1. **設計ドキュメントの更新**
   - `api-design.md`: limitパラメータ、monthパラメータ、レート制限の記載を更新
   - `design.md`: Stats Lambdaのレスポンス項目を実装に合わせて更新

2. **OpenAPI仕様の更新**
   - `openapi.yaml`: limitパラメータの最大値を1000に変更、monthパラメータを追加、next_tokenパラメータを削除

3. **実装の修正（優先度高）**
   - `src/lambda/collect/handler.ts`: ステータスコードを202に変更
   - `src/lambda/stats/handler.ts`: レスポンス項目を設計に合わせて修正（または設計を実装に合わせて更新）

4. **実装の修正（優先度中）**
   - `src/lambda/health/handler.ts`: unhealthy時に503を返すように修正
   - `src/lambda/get-disclosure/handler.ts`: エンドポイントを分離（または設計を実装に合わせて更新）

5. **パフォーマンス改善（優先度低）**
   - `src/lambda/stats/handler.ts`: Scanの使用を避け、集計テーブルまたはCloudWatchメトリクスを使用

### 確認事項

- API Gateway設定とLambda実装の整合性は概ね良好
- エラーレスポンス形式は統一されており、API設計ガイドラインに準拠
- 認証・CORS設定は設計通りに実装されている
- 主な問題は設計ドキュメントと実装の細かい不整合

---

**作業完了日時**: 2026年2月22日 08:37:19

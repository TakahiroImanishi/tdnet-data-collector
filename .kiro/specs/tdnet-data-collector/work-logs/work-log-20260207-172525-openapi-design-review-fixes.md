# 作業記録: OpenAPI設計レビュー対応

**作成日時**: 2026-02-07 17:25:25  
**タスク**: OpenAPI仕様の設計レビュー指摘事項の全対応  
**担当**: Main Agent

---

## タスク概要

### 目的
OpenAPI仕様（docs/openapi.yaml）の設計レビューで指摘された10件の問題をすべて修正し、実装ドキュメントとの整合性を確保する。

### 背景
- date_partition実装がOpenAPIスキーマに反映されていない
- ページネーション戦略が混在している
- エラーコードが不完全
- パターン定義に不備がある
- タイムゾーン処理が不明確

### 目標
- Critical Issues（1-4）: date_partition追加、パターン修正、タイムゾーン明確化
- High Priority Issues（5-7）: ページネーション統一、月単位クエリ追加、レート制限ヘッダー
- Medium Priority Issues（8-10）: エラーコード拡充、ファイルサイズ制限、progress計算式

---

## 実施内容

### グループ1: Critical Issues（1-4）



#### Issue 1: date_partitionフィールドの追加 ✅
- `Disclosure`スキーマに`date_partition`フィールドを追加
- `required`配列に`date_partition`を追加
- パターン: `^\d{4}-\d{2}$`
- 説明: "Date partition for efficient querying (YYYY-MM format, derived from disclosed_at)"

#### Issue 2: disclosure_idパターンの修正 ✅
- パターンを`^\d{8}_\d{4}_\d{3}$`に修正（末尾の`$`を追加）
- 説明を追加: "Unique disclosure identifier (format: YYYYMMDD_CCCC_NNN)"

#### Issue 3: company_codeパターンの修正 ✅
- パターンを`^\d{4}$`に修正（末尾の`$`を追加）
- すべての箇所（Disclosure, ExportRequest）で統一

#### Issue 4: タイムゾーン処理の明確化 ✅
- `disclosed_at`の説明を拡充:
  ```yaml
  description: |
    Disclosure date and time in ISO8601 format.
    Always returned in JST (UTC+09:00).
  ```

### グループ2: High Priority Issues（5-7）

#### Issue 5: ページネーション戦略の統一 ✅
- `offset`パラメータを削除
- `next_token`のみを使用（DynamoDB推奨）
- `PaginationMeta`から`total`, `page`, `per_page`を削除
- `count`, `has_next`, `next_token`のみを保持

#### Issue 6: 月単位クエリパラメータの追加 ✅
- `/disclosures`エンドポイントに`month`パラメータを追加:
  ```yaml
  - name: month
    in: query
    description: 'Query by month (YYYY-MM format, uses date_partition index for efficient querying)'
    schema:
      type: string
      pattern: '^\d{4}-\d{2}$'
      example: '2024-01'
  ```

#### Issue 7: レート制限ヘッダーの追加 ✅
- すべての成功レスポンス（200）にレート制限ヘッダーを追加:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
- 対象エンドポイント:
  - GET /disclosures
  - GET /disclosures/{id}
  - GET /disclosures/{id}/pdf
  - POST /collect
  - GET /collect/{execution_id}
  - POST /exports
  - GET /exports/{export_id}
  - GET /stats

### グループ3: Medium Priority Issues（8-10）

#### Issue 8: エラーコードの拡充 ✅
- `ErrorResponse.error.code`のenumに以下を追加:
  - `CONFLICT` (409)
  - `GATEWAY_TIMEOUT` (504)
- error-codes.mdで定義されているすべてのエラーコードを反映

#### Issue 9: ファイルサイズ制限の追加 ✅
- `DisclosureDetail.file_size`に制限を追加:
  ```yaml
  file_size:
    type: integer
    description: 'PDF file size in bytes (max 10MB)'
    minimum: 0
    maximum: 10485760  # 10MB
  ```

#### Issue 10: progress計算式の追加 ✅
- `CollectionStatusResponse.progress`に説明を追加:
  ```yaml
  progress:
    type: integer
    minimum: 0
    maximum: 100
    description: |
      Progress percentage (0-100).
      Calculated as: (collected_count + failed_count + skipped_count) / total_count * 100
  ```

---

## 成果物

### 変更ファイル
- ✅ `docs/openapi.yaml` - 全10件の設計レビュー指摘事項を修正

### 修正内容のサマリー

| 優先度 | Issue | 修正内容 | 影響範囲 |
|--------|-------|---------|---------|
| 🔴 Critical | 1 | date_partition追加 | Disclosureスキーマ |
| 🔴 Critical | 2 | disclosure_idパターン修正 | Disclosure, パスパラメータ |
| 🔴 Critical | 3 | company_codeパターン修正 | Disclosure, ExportRequest |
| 🔴 Critical | 4 | タイムゾーン明確化 | disclosed_at説明 |
| 🟠 High | 5 | ページネーション統一 | /disclosures, PaginationMeta |
| 🟠 High | 6 | 月単位クエリ追加 | /disclosuresパラメータ |
| 🟠 High | 7 | レート制限ヘッダー追加 | 全エンドポイント（8箇所） |
| 🟡 Medium | 8 | エラーコード拡充 | ErrorResponse |
| 🟡 Medium | 9 | ファイルサイズ制限 | DisclosureDetail |
| 🟡 Medium | 10 | progress計算式 | CollectionStatusResponse |

---

## 次回への申し送り

### 完了事項
- ✅ 作業記録を作成（work-log-20260207-172525-openapi-design-review-fixes.md）
- ✅ OpenAPI仕様の全10件の問題を修正
- ✅ 実装ドキュメント（tdnet-implementation-rules.md, error-codes.md）との整合性を確保

### 検証推奨事項
1. **OpenAPI Validator**: 修正後のYAMLファイルが有効なOpenAPI 3.0仕様に準拠しているか検証
2. **date_partition実装**: DynamoDBのGSI設定とLambda関数での実装を確認
3. **月単位クエリ**: `/disclosures?month=2024-01`のクエリパフォーマンスを検証
4. **レート制限**: API Gatewayの使用量プランとレート制限ヘッダーの実装を確認
5. **エラーコード**: Lambda関数でCONFLICT, GATEWAY_TIMEOUTエラーが適切に返されるか確認

### 注意点
- **ページネーション変更**: `offset`を削除したため、既存のクライアントコードは`next_token`に移行が必要
- **date_partition必須化**: 既存のDynamoDBデータに`date_partition`がない場合、マイグレーションが必要
- **レート制限ヘッダー**: API Gatewayの設定とLambda関数での実装が必要

### 今後の改善提案
- **バージョニング**: APIバージョン2.0を検討（破壊的変更を含むため）
- **GraphQL検討**: 複雑なクエリ要件に対応するため、GraphQL APIの追加を検討
- **Webhooks**: データ収集完了時の通知機能を追加

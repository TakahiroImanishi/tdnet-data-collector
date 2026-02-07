# OpenAPI仕様レビュー - 改善推奨事項

**作成日時**: 2026-02-07 17:33:15  
**関連作業記録**: work-log-20260207-173315-openapi-specification-review.md

---

## 概要

OpenAPI仕様（docs/openapi.yaml）の詳細レビューを実施した結果、全体的に高品質で整合性が取れていることを確認しました。ただし、以下の2点について軽微な不一致が見つかりました。

---

## 改善推奨事項

### 🟠 High Priority: ページネーション仕様の統一

#### 現状の問題

**API設計ガイドライン（api-design-guidelines.md）:**
- オフセットベースとカーソルベースの両方をサポートすると記載
- オフセットベース: `limit`, `offset`, `total`, `count`, `has_next`, `has_prev`
- カーソルベース: `limit`, `next_token`, `count`, `has_next`

**OpenAPI仕様（openapi.yaml）:**
- カーソルベースのみを実装
- `PaginationMeta`: `has_next`, `next_token` のみ

#### 推奨される修正

**Option 1: API設計ガイドラインを修正（推奨）**

API設計ガイドラインからオフセットベースのセクションを削除し、カーソルベースのみをサポートすることを明記する。

**理由:**
- DynamoDBではカーソルベース（LastEvaluatedKey）が推奨
- オフセットベースは大規模データセットで非効率（全件スキャンが必要）
- 実装の複雑さを軽減
- OpenAPI仕様と実装が既にカーソルベースのみをサポート

**修正箇所:**
`.kiro/steering/api/api-design-guidelines.md` の「ページネーション」セクション

**修正前:**
```markdown
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
...
```

**修正後:**
```markdown
## ページネーション

### カーソルベース（推奨）

DynamoDBを使用するため、カーソルベースのページネーションを採用しています。

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

**利点:**
- DynamoDBの`LastEvaluatedKey`を直接使用
- 大規模データセットでも効率的
- ページ番号の計算が不要
- データの追加・削除による影響を受けにくい

**注意:**
- `next_token`はBase64エンコードされたDynamoDBのキー情報
- クライアントは`next_token`を解析せず、そのまま次のリクエストに使用
- `total`（総件数）は提供しない（DynamoDBでの全件カウントはコストが高い）
```

**Option 2: OpenAPI仕様を修正（非推奨）**

OpenAPI仕様にオフセットベースのページネーション情報を追加する。

**理由で非推奨:**
- DynamoDBでオフセットベースを実装するのは非効率
- 実装コストが高い
- パフォーマンスが悪化する

---

### 🟠 High Priority: レート制限の単位統一

#### 現状の問題

**OpenAPI仕様（openapi.yaml）:**
```yaml
X-RateLimit-Limit:
  schema:
    type: integer
  description: 'Request limit per second (API Gateway throttle limit)'
```

**API設計ガイドライン（api-design-guidelines.md）:**
```markdown
### 制限値

- **認証済みユーザー**: 100リクエスト/分
- **未認証**: 10リクエスト/分
```

#### 推奨される修正

**Step 1: API Gatewayの実装を確認**

API Gatewayの使用量プランで設定されているレート制限の単位を確認する。

**Step 2: ドキュメントを統一**

API Gatewayの実装に合わせて、OpenAPI仕様とAPI設計ガイドラインを統一する。

**パターンA: 分単位の場合（推奨）**

**OpenAPI仕様を修正:**
```yaml
X-RateLimit-Limit:
  schema:
    type: integer
  description: 'Request limit per minute'
X-RateLimit-Remaining:
  schema:
    type: integer
  description: 'Remaining requests in current minute'
X-RateLimit-Reset:
  schema:
    type: integer
    format: int64
  description: 'Unix timestamp in seconds when the rate limit resets (start of next minute)'
```

**API設計ガイドラインはそのまま:**
```markdown
### 制限値

- **認証済みユーザー**: 100リクエスト/分
- **未認証**: 10リクエスト/分

### レート制限ヘッダー

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705305600
```
```

**パターンB: 秒単位の場合**

**API設計ガイドラインを修正:**
```markdown
### 制限値

- **認証済みユーザー**: 10リクエスト/秒（600リクエスト/分）
- **未認証**: 1リクエスト/秒（60リクエスト/分）

### レート制限ヘッダー

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1705305601
```
```

**OpenAPI仕様はそのまま:**
```yaml
X-RateLimit-Limit:
  schema:
    type: integer
  description: 'Request limit per second (API Gateway throttle limit)'
```

**推奨:** パターンA（分単位）を推奨します。理由は以下の通り：
- API設計ガイドラインが既に分単位で記載されている
- 分単位の方がユーザーにとって理解しやすい
- AWS API Gatewayの使用量プランは通常、分単位で設定される

---

## 修正の優先順位

| 優先度 | 項目 | 影響範囲 | 作業時間 |
|--------|------|---------|---------|
| 🟠 High | ページネーション仕様の統一 | API設計ガイドライン | 15分 |
| 🟠 High | レート制限の単位統一 | OpenAPI仕様、API設計ガイドライン | 10分 |

**合計作業時間:** 約25分

---

## 修正後の確認事項

### ページネーション

- [ ] API設計ガイドラインからオフセットベースのセクションを削除
- [ ] カーソルベースのみをサポートすることを明記
- [ ] OpenAPI仕様と整合性が取れていることを確認

### レート制限

- [ ] API Gatewayの使用量プランでレート制限の単位を確認
- [ ] OpenAPI仕様のレート制限ヘッダーの説明を修正
- [ ] API設計ガイドラインと整合性が取れていることを確認

---

## その他の推奨事項（任意）

### OpenAPI仕様の拡充

以下の項目を追加することで、より詳細な仕様書になります：

1. **サーバーURL**
   - 現在: `https://api.example.com/v1`（プレースホルダー）
   - 推奨: 実際のAPIエンドポイントに更新（デプロイ後）

2. **セキュリティスキームの詳細**
   - APIキーの取得方法
   - APIキーの有効期限
   - APIキーのローテーション方法

3. **レスポンス例の追加**
   - 各エンドポイントに具体的なレスポンス例を追加
   - エラーレスポンスの例を充実

4. **リクエストボディの例**
   - POST /collect, POST /exports のリクエスト例を追加

---

## まとめ

OpenAPI仕様は全体的に高品質で、API設計ガイドラインおよびエラーコード標準との整合性が取れています。以下の2点を修正することで、完全な整合性が確保されます：

1. ✅ ページネーション仕様の統一（カーソルベースのみに統一）
2. ✅ レート制限の単位統一（分単位を推奨）

これらの修正は軽微で、約25分で完了できます。修正後は、実装とドキュメントの整合性が完全に保たれます。

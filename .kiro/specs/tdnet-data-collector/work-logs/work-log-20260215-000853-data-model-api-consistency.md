# データモデルとAPI仕様の整合性チェック

**作業日時**: 2026-02-15 00:08:53  
**担当**: Sub-agent A (spec-task-execution)  
**タスク**: データモデルとAPI仕様の整合性チェック

---

## 確認対象ファイル

- ✅ `.kiro/specs/tdnet-data-collector/docs/requirements.md` - 要件定義
- ✅ `.kiro/specs/tdnet-data-collector/design/api-design.md` - API設計書
- ✅ `.kiro/specs/tdnet-data-collector/docs/openapi.yaml` - OpenAPI仕様
- ✅ `docs/openapi.yaml` - OpenAPI仕様（ルート）
- ✅ `src/models/disclosure.ts` - Disclosure型定義
- ✅ `src/lambda/query/handler.ts` - Query Lambda実装
- ✅ `src/lambda/export/handler.ts` - Export Lambda実装
- ✅ `src/lambda/collect/handler.ts` - Collect Lambda実装
- ✅ `cdk/lib/stacks/foundation-stack.ts` - DynamoDB定義

---

## 発見された不整合

### 🔴 Critical（重大な不整合）

#### 1. Disclosureモデルのフィールド不一致

**ファイル**: `src/models/disclosure.ts`

**問題**:
- モデル定義に `pdf_url` と `s3_key` が必須フィールドとして定義されている
- しかし、API設計書とOpenAPI仕様では `pdf_url` はオプショナル（nullable）
- API設計書では `pdf_s3_key` という名前だが、モデルでは `s3_key`

**影響**:
- データ収集時にPDFがまだダウンロードされていない場合、バリデーションエラーが発生する
- フィールド名の不一致により、APIレスポンスとモデルの変換でエラーが発生する可能性

**該当コード** (`src/models/disclosure.ts:14-24`):
```typescript
export function validateDisclosure(disclosure: Partial<Disclosure>): void {
  const requiredFields: Array<keyof Disclosure> = [
    'disclosure_id',
    'company_code',
    'company_name',
    'disclosure_type',
    'title',
    'disclosed_at',
    'pdf_url',        // ← 必須だが、API仕様ではnullable
    's3_key',         // ← API仕様では 'pdf_s3_key'
    'collected_at',
    'date_partition',
  ];
```

**修正提案**:
1. `pdf_url` と `s3_key` をオプショナルフィールドに変更
2. `s3_key` を `pdf_s3_key` にリネーム（API仕様に合わせる）
3. バリデーション関数を修正して、これらのフィールドを必須チェックから除外

---

#### 2. OpenAPI仕様のフィールド名不一致

**ファイル**: `.kiro/specs/tdnet-data-collector/docs/openapi.yaml`, `docs/openapi.yaml`

**問題**:
- OpenAPI仕様では `pdf_s3_key` と定義
- API設計書でも `pdf_s3_key` と記載
- しかし、実装（`src/models/disclosure.ts`）では `s3_key`

**影響**:
- APIレスポンスとOpenAPI仕様が一致しない
- クライアント側でフィールド名の不一致によるエラーが発生

**該当箇所** (OpenAPI仕様):
```yaml
DisclosureDetail:
  allOf:
    - $ref: '#/components/schemas/Disclosure'
    - type: object
      properties:
        downloaded_at:
          type: string
          format: date-time
        file_size:
          type: integer
        pdf_s3_key:    # ← 実装では 's3_key'
          type: string
```

**修正提案**:
- 実装を修正して `s3_key` → `pdf_s3_key` にリネーム
- または、OpenAPI仕様を修正して `pdf_s3_key` → `s3_key` に統一

---

#### 3. DynamoDBスキーマとモデルの不一致

**ファイル**: `cdk/lib/stacks/foundation-stack.ts`, `src/models/disclosure.ts`

**問題**:
- DynamoDB定義では `disclosure_id` がパーティションキー
- GSIとして `GSI_CompanyCode_DiscloseDate` と `GSI_DatePartition` が定義されている
- しかし、モデル定義では `disclosed_at` フィールドが必須だが、DynamoDBスキーマには明示的に定義されていない

**影響**:
- GSIのソートキーとして使用される `disclosed_at` が、DynamoDBに保存されない可能性
- クエリ時にGSIが正しく機能しない

**該当コード** (`cdk/lib/stacks/foundation-stack.ts:62-84`):
```typescript
this.disclosuresTable.addGlobalSecondaryIndex({
  indexName: 'GSI_CompanyCode_DiscloseDate',
  partitionKey: {
    name: 'company_code',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'disclosed_at',  // ← モデルでは必須だが、テーブル定義に明示なし
    type: dynamodb.AttributeType.STRING,
  },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

**修正提案**:
- DynamoDBはスキーマレスなので、実際には問題ないが、ドキュメントで明確化する
- モデル定義とDynamoDB定義の対応関係を明示的にドキュメント化

---

### 🟠 High（高優先度の不整合）

#### 4. API設計書とOpenAPI仕様のレスポンス形式の不一致

**ファイル**: `.kiro/specs/tdnet-data-collector/design/api-design.md`, `docs/openapi.yaml`

**問題**:
- API設計書では `GET /disclosures` のレスポンスが以下の形式:
  ```json
  {
    "disclosures": [...],
    "total": 150,
    "count": 20,
    "offset": 0,
    "limit": 20
  }
  ```
- しかし、OpenAPI仕様では `DisclosureListResponse` が以下の形式:
  ```yaml
  DisclosureListResponse:
    type: object
    required:
      - status
      - disclosures
      - total
      - count
      - offset
      - limit
    properties:
      status:
        type: string
        enum: [success]
      disclosures: [...]
      total: ...
  ```

**影響**:
- API設計書には `status` フィールドがないが、OpenAPI仕様には存在
- 実装（`src/lambda/query/handler.ts`）では `status` フィールドを含まない

**該当コード** (`src/lambda/query/handler.ts:95-103`):
```typescript
// JSON形式（デフォルト）
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(result),  // ← result には status フィールドがない
};
```

**修正提案**:
1. OpenAPI仕様から `status` フィールドを削除（API設計書に合わせる）
2. または、実装を修正して `status: 'success'` を追加

---

#### 5. `collected_at` vs `downloaded_at` フィールド名の不一致

**ファイル**: `src/models/disclosure.ts`, API設計書

**問題**:
- モデル定義では `collected_at` フィールドが必須
- API設計書とOpenAPI仕様では `downloaded_at` フィールドが使用されている

**影響**:
- フィールド名の不一致により、APIレスポンスとモデルの変換でエラーが発生
- データベースに保存されるフィールド名とAPIレスポンスのフィールド名が異なる

**該当箇所**:
- モデル: `collected_at` (必須)
- API設計書: `downloaded_at` (オプショナル)
- OpenAPI仕様: `downloaded_at` (オプショナル)

**修正提案**:
1. モデル定義を修正して `collected_at` → `downloaded_at` にリネーム
2. または、API設計書とOpenAPI仕様を修正して `downloaded_at` → `collected_at` に統一
3. 推奨: API設計書に合わせて `downloaded_at` に統一（より直感的）

---

#### 6. `month` パラメータの実装不足

**ファイル**: `docs/openapi.yaml`, `src/lambda/query/handler.ts`

**問題**:
- OpenAPI仕様では `month` パラメータ（YYYY-MM形式）が定義されている
- しかし、実装（`src/lambda/query/handler.ts`）では `month` パラメータが処理されていない

**影響**:
- `month` パラメータを使用したクエリが機能しない
- `date_partition` GSIを使用した効率的なクエリができない

**該当箇所** (OpenAPI仕様):
```yaml
- name: month
  in: query
  description: 'Query by month (YYYY-MM format, uses date_partition index for efficient querying)'
  schema:
    type: string
    pattern: '^\d{4}-\d{2}$'
    example: '2024-01'
```

**修正提案**:
- `src/lambda/query/handler.ts` に `month` パラメータの処理を追加
- `month` が指定された場合、`start_date` と `end_date` を無視する
- `date_partition` GSIを使用してクエリを実行

---

### 🟡 Medium（中優先度の不整合）

#### 7. エラーレスポンス形式の不一致

**ファイル**: API設計書, 実装

**問題**:
- API設計書では以下のエラーレスポンス形式:
  ```json
  {
    "status": "error",
    "error": {
      "code": "ERROR_CODE",
      "message": "エラーメッセージ",
      "details": {...}
    },
    "request_id": "req-abc123"
  }
  ```
- 実装（`src/lambda/query/handler.ts`）では同じ形式だが、`request_id` が `context.awsRequestId` から取得されている
- しかし、`context.awsRequestId` は `context.requestId` の誤り（AWS Lambda Contextには `requestId` プロパティは存在しない）

**影響**:
- `request_id` が正しく設定されない可能性
- エラーレスポンスのトレーサビリティが低下

**該当コード** (`src/lambda/query/handler.ts:186`):
```typescript
function handleError(error: Error, requestId: string): APIGatewayProxyResult {
  // ...
  const errorResponse = {
    status: 'error',
    error: {
      code: errorCode,
      message: error.message,
      details,
    },
    request_id: requestId,  // ← context.awsRequestId から渡される
  };
```

**修正提案**:
- `context.awsRequestId` は正しいプロパティ名なので、問題なし
- ただし、API Gatewayの `requestId` と Lambda の `awsRequestId` が異なる場合があるため、API Gatewayの `requestContext.requestId` を使用することを推奨

---

#### 8. `file_size` フィールドの型不一致

**ファイル**: OpenAPI仕様, モデル定義

**問題**:
- OpenAPI仕様では `file_size` に最大値（10MB = 10485760バイト）が定義されている
- しかし、モデル定義やバリデーションでは `file_size` の最大値チェックがない

**影響**:
- 10MBを超えるPDFファイルがダウンロードされた場合、バリデーションエラーが発生しない
- ストレージコストが予想外に増加する可能性

**該当箇所** (OpenAPI仕様):
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

**修正提案**:
- モデル定義にファイルサイズのバリデーションを追加
- PDF収集時に10MBを超えるファイルを拒否する処理を追加

---

#### 9. `total_count` フィールドの不一致

**ファイル**: OpenAPI仕様, API設計書

**問題**:
- OpenAPI仕様の `CollectionStatusResponse` では `total_count` フィールドが定義されている
- しかし、API設計書では `total_count` フィールドの記載がない

**影響**:
- API設計書とOpenAPI仕様の不一致
- クライアント側で進捗率の計算ができない可能性

**該当箇所** (OpenAPI仕様):
```yaml
CollectionStatusResponse:
  properties:
    data:
      properties:
        total_count:
          type: integer
          description: 'Total number of disclosures to collect'
        progress:
          type: integer
          description: |
            Progress percentage (0-100).
            Calculated as: (collected_count + failed_count + skipped_count) / total_count * 100
```

**修正提案**:
- API設計書に `total_count` フィールドを追加
- 実装を確認して、`total_count` が正しく返されることを確認

---

### 🟢 Low（低優先度の不整合）

#### 10. レート制限ヘッダーの実装不足

**ファイル**: OpenAPI仕様, 実装

**問題**:
- OpenAPI仕様では以下のレート制限ヘッダーが定義されている:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
- しかし、実装（Lambda関数）ではこれらのヘッダーが返されていない

**影響**:
- クライアント側でレート制限の状態を把握できない
- API設計書でも「未実装」と記載されている

**修正提案**:
- API Gatewayレベルでレート制限を設定
- Lambda関数でレート制限ヘッダーを返却する処理を追加
- または、OpenAPI仕様から削除（将来実装予定として記載）

---

#### 11. `format` パラメータのデフォルト値の不一致

**ファイル**: API設計書, 実装

**問題**:
- API設計書では `format` パラメータのデフォルト値が `json`
- 実装でも `json` がデフォルト
- しかし、OpenAPI仕様では明示的なデフォルト値の記載がない

**影響**:
- 軽微な不一致だが、ドキュメントの一貫性が低下

**修正提案**:
- OpenAPI仕様に `default: json` を追加

---

## 整合性チェック結果サマリー

| チェック項目 | 結果 | 備考 |
|------------|------|------|
| DynamoDBスキーマ（PK、GSI） | ⚠️ 部分的に一致 | GSIは一致、フィールド名に不一致あり |
| Disclosure型定義 | ❌ 不一致 | `pdf_url`, `s3_key`, `collected_at` に不一致 |
| APIエンドポイント | ✅ 一致 | パス、メソッドは一致 |
| APIパラメータ | ⚠️ 部分的に一致 | `month` パラメータが未実装 |
| OpenAPI仕様とAPI設計書 | ⚠️ 部分的に一致 | レスポンス形式に不一致あり |
| レスポンス形式 | ⚠️ 部分的に一致 | `status` フィールドの有無が不一致 |
| エラーコード | ✅ 一致 | エラーコードは一致 |

---

## 優先度別修正推奨順序

### 即座に修正すべき項目（Critical）

1. **Disclosureモデルのフィールド修正** (不整合1, 2, 5)
   - `pdf_url` と `s3_key` をオプショナルに変更
   - `s3_key` → `pdf_s3_key` にリネーム
   - `collected_at` → `downloaded_at` にリネーム

2. **OpenAPI仕様とモデルの統一** (不整合2)
   - フィールド名を統一（`pdf_s3_key` に統一推奨）

### 次に修正すべき項目（High）

3. **APIレスポンス形式の統一** (不整合4)
   - `status` フィールドの有無を統一（含める推奨）

4. **`month` パラメータの実装** (不整合6)
   - Query Lambdaに `month` パラメータの処理を追加

### 時間があれば修正（Medium/Low）

5. **ファイルサイズバリデーション** (不整合8)
6. **レート制限ヘッダー** (不整合10)
7. **その他のドキュメント整合性** (不整合9, 11)

---

## 成果物

- ✅ 不整合リスト（11件）
- ✅ 優先度付き修正提案
- ✅ 具体的なファイル名と行番号
- ✅ 修正推奨順序

---

## 申し送り事項

### 次のアクション

1. **Critical不整合の修正**
   - `src/models/disclosure.ts` のフィールド定義を修正
   - `src/types/index.ts` の型定義を確認・修正
   - 全Lambda関数でフィールド名の変更に対応

2. **テストの更新**
   - ユニットテストでフィールド名の変更を反映
   - E2Eテストでレスポンス形式を確認

3. **ドキュメントの更新**
   - API設計書とOpenAPI仕様を完全に同期
   - 実装とドキュメントの対応関係を明確化

### 注意事項

- フィールド名の変更は破壊的変更となるため、既存データの移行が必要
- DynamoDBのデータ移行スクリプトを作成する必要がある
- API v2として新しいエンドポイントを作成することも検討

---

**作業完了日時**: 2026-02-15 00:08:53

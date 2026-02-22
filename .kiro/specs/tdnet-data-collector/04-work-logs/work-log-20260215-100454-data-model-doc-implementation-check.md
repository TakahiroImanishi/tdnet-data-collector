# データモデル ドキュメント・実装整合性チェック

**作業日時:** 2026-02-15 10:04:54  
**作業者:** Kiro AI Assistant  
**作業概要:** データモデルのドキュメントと実装（CDK定義、TypeScript型定義）の整合性を確認

---

## 作業内容

### 1. チェック対象ドキュメント

- `.kiro/specs/tdnet-data-collector/docs/01-requirements/design.md`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/data-integrity-design.md`
- `.kiro/steering/development/data-validation.md`

### 2. チェック対象実装

- `cdk/lib/stacks/foundation-stack.ts` - DynamoDB/S3定義
- `src/types/index.ts` - TypeScript型定義
- `src/models/disclosure.ts` - Disclosureモデル実装

---

## チェック結果

### ✅ DynamoDBテーブル設計の整合性

#### 1. tdnet_disclosures テーブル

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| テーブル名 | `tdnet_disclosures` | `tdnet_disclosures_{env}` | ✅ 環境別命名規則に従っている |
| パーティションキー | `disclosure_id` (STRING) | `disclosure_id` (STRING) | ✅ 一致 |
| ソートキー | なし | なし | ✅ 一致 |
| GSI #1 | `date_partition` + `disclosed_at` | `GSI_DatePartition`: `date_partition` + `disclosed_at` | ✅ 一致 |
| GSI #2 | 設計書に記載なし | `GSI_CompanyCode_DiscloseDate`: `company_code` + `disclosed_at` | ⚠️ 追加実装（設計書に記載なし） |
| 暗号化 | 有効 | `AWS_MANAGED` | ✅ 一致 |
| バックアップ | 有効 | `pointInTimeRecovery: true` | ✅ 一致 |
| TTL | なし | なし | ✅ 一致 |
| 課金モード | オンデマンド | `PAY_PER_REQUEST` | ✅ 一致 |

**不整合の詳細:**
- **GSI #2 (`GSI_CompanyCode_DiscloseDate`)**: 実装には存在するが、設計ドキュメント（`design.md`）には記載されていない
- **影響**: 企業コード別のクエリが可能になっているが、設計書に記載がないため、ドキュメントと実装が乖離している
- **推奨対応**: `design.md`の「DynamoDB」セクションにGSI #2を追加記載

#### 2. tdnet_executions テーブル

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| テーブル名 | `tdnet_executions` | `tdnet_executions_{env}` | ✅ 環境別命名規則に従っている |
| パーティションキー | `execution_id` (STRING) | `execution_id` (STRING) | ✅ 一致 |
| ソートキー | なし | なし | ✅ 一致 |
| GSI | 設計書に記載なし | `GSI_Status_StartedAt`: `status` + `started_at` | ⚠️ 追加実装（設計書に記載なし） |
| TTL | 30日後自動削除 | `ttl` 属性 | ✅ 一致 |
| 暗号化 | 有効 | `AWS_MANAGED` | ✅ 一致 |
| バックアップ | 有効 | `pointInTimeRecovery: true` | ✅ 一致 |

**不整合の詳細:**
- **GSI (`GSI_Status_StartedAt`)**: 実装には存在するが、設計ドキュメントには記載されていない
- **影響**: ステータス別のクエリが可能になっているが、設計書に記載がないため、ドキュメントと実装が乖離している
- **推奨対応**: `design.md`の「DynamoDB」セクションにGSIを追加記載

#### 3. tdnet_export_status テーブル

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| テーブル名 | 設計書に記載なし | `tdnet_export_status_{env}` | ⚠️ 実装のみ存在 |
| パーティションキー | - | `export_id` (STRING) | ⚠️ 実装のみ存在 |
| GSI | - | `GSI_Status_RequestedAt`: `status` + `requested_at` | ⚠️ 実装のみ存在 |
| TTL | - | `ttl` 属性 | ⚠️ 実装のみ存在 |

**不整合の詳細:**
- **テーブル全体**: 実装には存在するが、設計ドキュメント（`design.md`）には記載されていない
- **影響**: エクスポート機能の状態管理テーブルが設計書に記載されていない
- **推奨対応**: `design.md`の「DynamoDB」セクションに`tdnet_export_status`テーブルを追加記載

---

### ✅ TypeScript型定義の整合性

#### 1. Disclosure型

| フィールド | 設計ドキュメント | TypeScript型定義 | 整合性 |
|-----------|----------------|-----------------|--------|
| `disclosure_id` | ✓ 必須、STRING | `string` | ✅ 一致 |
| `company_code` | ✓ 必須、STRING、4桁数字 | `string` | ✅ 一致 |
| `company_name` | ✓ 必須、STRING | `string` | ✅ 一致 |
| `disclosure_type` | ✓ 必須、STRING | `string` | ✅ 一致 |
| `title` | ✓ 必須、STRING | `string` | ✅ 一致 |
| `disclosed_at` | ✓ 必須、ISO8601 | `string` | ✅ 一致 |
| `pdf_s3_key` | ✓ 必須、STRING | `string?` (オプショナル) | ⚠️ 不一致 |
| `downloaded_at` | ✓ 必須、ISO8601 | `string` | ✅ 一致 |
| `file_size` | ✓ 必須、NUMBER | 型定義に存在しない | ❌ 欠落 |
| `date_partition` | ✓ 必須、YYYY-MM | `string` | ✅ 一致 |
| `pdf_url` | 設計書に記載なし | `string?` (オプショナル) | ⚠️ 追加実装 |

**不整合の詳細:**

1. **`pdf_s3_key`の必須性**:
   - 設計書: 必須フィールド
   - 型定義: オプショナル (`pdf_s3_key?: string`)
   - **影響**: PDFが保存されていない開示情報が存在する可能性がある
   - **推奨対応**: 設計書を修正し、`pdf_s3_key`をオプショナルとして明記（Two-Phase Commitの`pending`状態では未設定のため）

2. **`file_size`フィールドの欠落**:
   - 設計書: 必須フィールド（`file_size: number`）
   - 型定義: 存在しない
   - **影響**: PDFファイルサイズが記録されない
   - **推奨対応**: `src/types/index.ts`の`Disclosure`型に`file_size?: number`を追加

3. **`pdf_url`フィールドの追加**:
   - 設計書: 記載なし
   - 型定義: オプショナルフィールドとして存在
   - **影響**: TDnetの元URLを保存できるが、設計書に記載がない
   - **推奨対応**: `design.md`の「Data Models」セクションに`pdf_url`を追加記載

#### 2. ExecutionStatus型

| フィールド | 設計ドキュメント | TypeScript型定義 | 整合性 |
|-----------|----------------|-----------------|--------|
| `execution_id` | ✓ 必須 | `string` | ✅ 一致 |
| `execution_type` | ✓ 必須 | 型定義に存在しない | ❌ 欠落 |
| `status` | ✓ 必須 | `'pending' \| 'running' \| 'completed' \| 'failed'` | ✅ 一致 |
| `progress` | ✓ 必須 | `number` | ✅ 一致 |
| `started_at` | ✓ 必須 | `string` | ✅ 一致 |
| `completed_at` | オプショナル | `string?` | ✅ 一致 |
| `result` | ✓ 必須 | 型定義に存在しない | ❌ 欠落 |
| `error_message` | オプショナル | `string?` | ✅ 一致 |
| `ttl` | ✓ 必須 | `number` | ✅ 一致 |
| `success_count` | 設計書に記載なし | `number` | ⚠️ 追加実装 |
| `failed_count` | 設計書に記載なし | `number` | ⚠️ 追加実装 |

**不整合の詳細:**

1. **`execution_type`フィールドの欠落**:
   - 設計書: 必須フィールド
   - 型定義: 存在しない
   - **影響**: 実行タイプ（batch/ondemand）が記録されない
   - **推奨対応**: `src/types/index.ts`の`ExecutionStatus`型に`execution_type: 'batch' | 'ondemand'`を追加

2. **`result`フィールドの欠落**:
   - 設計書: 必須フィールド
   - 型定義: 存在しない
   - **影響**: 実行結果の詳細が記録されない
   - **推奨対応**: `src/types/index.ts`の`ExecutionStatus`型に`result?: CollectionResult`を追加

3. **`success_count`/`failed_count`の追加**:
   - 設計書: 記載なし
   - 型定義: 存在
   - **影響**: 成功/失敗件数が記録されるが、設計書に記載がない
   - **推奨対応**: `design.md`の「Data Models」セクションに追加記載

---

### ✅ S3バケット設計の整合性

#### 1. PDFバケット

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| バケット名 | `tdnet-data-collector-pdfs-{account-id}` | `tdnet-data-collector-pdfs-{env}-{account-id}` | ⚠️ 環境別命名 |
| ディレクトリ構造 | `/pdfs/YYYY/MM/DD/{company_code}_{disclosure_type}_{timestamp}.pdf` | 実装で確認必要 | ⚠️ 要確認 |
| 暗号化 | SSE-S3 | `S3_MANAGED` | ✅ 一致 |
| バージョニング | 有効 | `versioned: true` | ✅ 一致 |
| ライフサイクル（90日） | Standard-IA | `INFREQUENT_ACCESS` | ✅ 一致 |
| ライフサイクル（365日） | Glacier | `GLACIER` | ✅ 一致 |
| パブリックアクセス | ブロック | `BLOCK_ALL` | ✅ 一致 |

**不整合の詳細:**
- **バケット名**: 設計書では`{account-id}`のみだが、実装では`{env}-{account-id}`となっている
- **影響**: 環境別にバケットが分離されるため、より安全だが、設計書と異なる
- **推奨対応**: `design.md`のバケット名を`tdnet-data-collector-pdfs-{env}-{account-id}`に修正

#### 2. エクスポートバケット

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| バケット名 | `tdnet-data-collector-exports-{account-id}` | `tdnet-data-collector-exports-{env}-{account-id}` | ⚠️ 環境別命名 |
| ライフサイクル | 7日後自動削除 | `expiration: 7 days` | ✅ 一致 |
| 暗号化 | SSE-S3 | `S3_MANAGED` | ✅ 一致 |
| バージョニング | 設計書に記載なし | `versioned: true` | ⚠️ 追加実装 |

**不整合の詳細:**
- **バケット名**: PDFバケットと同様、環境別命名規則が適用されている
- **バージョニング**: 実装では有効だが、設計書に記載がない
- **推奨対応**: `design.md`のバケット名とバージョニング設定を更新

#### 3. ダッシュボードバケット

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| バケット名 | `tdnet-dashboard-{account-id}` | `tdnet-dashboard-{env}-{account-id}` | ⚠️ 環境別命名 |
| 静的Webホスティング | 有効 | 実装で確認必要 | ⚠️ 要確認 |
| CloudFront OAI | 有効 | `DashboardCloudFront` Construct使用 | ✅ 一致 |

#### 4. CloudTrailログバケット

| 項目 | 設計ドキュメント | CDK実装 | 整合性 |
|------|----------------|---------|--------|
| バケット名 | `tdnet-cloudtrail-logs-{account-id}` | `tdnet-cloudtrail-logs-{env}-{account-id}` | ⚠️ 環境別命名 |
| ライフサイクル（90日） | Glacier | `GLACIER` | ✅ 一致 |
| ライフサイクル（7年） | 自動削除 | `expiration: 2555 days` | ✅ 一致 |

---

### ✅ データ整合性設計の整合性

#### Two-Phase Commit実装

| 項目 | 設計ドキュメント | 実装 | 整合性 |
|------|----------------|------|--------|
| `status`フィールド | `'pending' \| 'committed' \| 'failed'` | 型定義に存在しない | ❌ 未実装 |
| `temp_s3_key`フィールド | pending時のみ存在 | 型定義に存在しない | ❌ 未実装 |
| Prepare Phase | PDFを一時キーでアップロード | 実装で確認必要 | ⚠️ 要確認 |
| Commit Phase | S3移動、status更新 | 実装で確認必要 | ⚠️ 要確認 |

**不整合の詳細:**
- **Two-Phase Commit関連フィールド**: `data-integrity-design.md`に記載されているが、`src/types/index.ts`の`Disclosure`型に存在しない
- **影響**: Two-Phase Commitパターンが実装されていない可能性が高い
- **推奨対応**: 
  1. `src/types/index.ts`の`Disclosure`型に以下を追加:
     ```typescript
     status?: 'pending' | 'committed' | 'failed';
     temp_s3_key?: string;
     created_at?: string;
     updated_at?: string;
     ```
  2. Lambda Collector関数でTwo-Phase Commitパターンを実装

---

## 不整合の優先度別まとめ

### 🔴 Critical（即座に対応が必要）

1. **Two-Phase Commit未実装**
   - `Disclosure`型に`status`, `temp_s3_key`フィールドが存在しない
   - データ整合性保証の根幹に関わる問題
   - **対応**: `src/types/index.ts`を修正し、Lambda Collector関数を実装

2. **`file_size`フィールド欠落**
   - 設計書では必須だが、型定義に存在しない
   - PDFファイルサイズが記録されない
   - **対応**: `src/types/index.ts`の`Disclosure`型に追加

3. **`execution_type`フィールド欠落**
   - 設計書では必須だが、型定義に存在しない
   - 実行タイプが記録されない
   - **対応**: `src/types/index.ts`の`ExecutionStatus`型に追加

### 🟡 High（早期対応が望ましい）

1. **`tdnet_export_status`テーブルが設計書に記載なし**
   - 実装には存在するが、設計ドキュメントに記載されていない
   - **対応**: `design.md`に追加記載

2. **GSI（Global Secondary Index）が設計書に記載なし**
   - `tdnet_disclosures`の`GSI_CompanyCode_DiscloseDate`
   - `tdnet_executions`の`GSI_Status_StartedAt`
   - **対応**: `design.md`に追加記載

3. **`pdf_s3_key`の必須性の不一致**
   - 設計書では必須、型定義ではオプショナル
   - **対応**: 設計書を修正（Two-Phase Commitの`pending`状態では未設定のため、オプショナルが正しい）

### 🟢 Medium（時間があれば対応）

1. **バケット名の環境別命名規則**
   - 設計書: `{account-id}`のみ
   - 実装: `{env}-{account-id}`
   - **対応**: `design.md`を更新

2. **`pdf_url`フィールドの追加**
   - 型定義には存在するが、設計書に記載なし
   - **対応**: `design.md`に追加記載

3. **`success_count`/`failed_count`の追加**
   - 型定義には存在するが、設計書に記載なし
   - **対応**: `design.md`に追加記載

---

## 推奨アクション

### 即座に実施すべき対応

1. **`src/types/index.ts`の`Disclosure`型を修正**
   ```typescript
   export interface Disclosure {
     disclosure_id: string;
     company_code: string;
     company_name: string;
     disclosure_type: string;
     title: string;
     disclosed_at: string;
     pdf_url?: string;
     pdf_s3_key?: string;  // オプショナル（Two-Phase Commit対応）
     downloaded_at: string;
     date_partition: string;
     file_size?: number;  // 追加
     status?: 'pending' | 'committed' | 'failed';  // 追加（Two-Phase Commit）
     temp_s3_key?: string;  // 追加（Two-Phase Commit）
     created_at?: string;  // 追加（Two-Phase Commit）
     updated_at?: string;  // 追加（Two-Phase Commit）
   }
   ```

2. **`src/types/index.ts`の`ExecutionStatus`型を修正**
   ```typescript
   export interface ExecutionStatus {
     execution_id: string;
     execution_type: 'batch' | 'ondemand';  // 追加
     status: 'pending' | 'running' | 'completed' | 'failed';
     started_at: string;
     completed_at?: string;
     progress: number;
     success_count: number;
     failed_count: number;
     result?: CollectionResult;  // 追加
     error_message?: string;
     ttl: number;
   }
   ```

3. **`design.md`を更新**
   - `tdnet_export_status`テーブルを追加
   - GSI（`GSI_CompanyCode_DiscloseDate`, `GSI_Status_StartedAt`）を追加
   - バケット名の環境別命名規則を反映
   - `Disclosure`型の`file_size`, `pdf_url`, `status`, `temp_s3_key`を追加
   - `ExecutionStatus`型の`execution_type`, `result`, `success_count`, `failed_count`を追加

### 次のステップ

1. Lambda Collector関数でTwo-Phase Commitパターンを実装
2. 整合性チェックバッチ（Lambda関数）を実装
3. E2Eテストで整合性を検証

---

## 申し送り事項

1. **Two-Phase Commit未実装**: データ整合性保証の根幹に関わる問題のため、最優先で対応が必要
2. **設計書と実装の乖離**: 多数の不整合が発見されたため、設計書の更新が必要
3. **型定義の不完全性**: 設計書に記載されているフィールドが型定義に欠落している箇所が複数存在
4. **GSIの追加実装**: 設計書に記載されていないGSIが実装されているため、ドキュメント更新が必要

---

**作業完了日時:** 2026-02-15 10:04:54

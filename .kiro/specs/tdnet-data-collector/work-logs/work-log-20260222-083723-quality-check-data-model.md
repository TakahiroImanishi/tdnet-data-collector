# 作業記録: データモデル・バリデーション実装チェック

**作業日時**: 2026年2月22日 08:37:23  
**作業者**: サブエージェント3  
**作業種別**: 品質チェック  
**関連タスク**: `.kiro/specs/tdnet-data-collector/tasks/tasks-quality-20260222.md` - タスク3

---

## 目的

データモデル・バリデーション実装の品質チェックを実施し、設計ドキュメントとの整合性を確認する。

### チェック項目
- DynamoDB テーブル設計（PK, GSI, TTL）
- disclosure_id生成ロジック
- date_partition生成ロジック（JST基準）
- Zodスキーマ定義
- 必須フィールドバリデーション
- データ整合性チェック

---

## 調査結果

### 1. DynamoDBテーブル設計

#### 1.1 tdnet_disclosures テーブル

**実装状況**: ✅ 完全実装

**ファイル**: `cdk/lib/stacks/foundation-stack.ts`

**設計内容**:
- **PK**: `disclosure_id` (STRING)
- **GSI1**: `GSI_CompanyCode_DiscloseDate`
  - PK: `company_code` (STRING)
  - SK: `disclosed_at` (STRING)
  - Projection: ALL
- **GSI2**: `GSI_DatePartition`
  - PK: `date_partition` (STRING)
  - SK: `disclosed_at` (STRING)
  - Projection: ALL
- **課金モード**: PAY_PER_REQUEST（オンデマンド）
- **暗号化**: AWS_MANAGED
- **PITR**: 有効
- **削除保護**: RETAIN

**設計ドキュメントとの整合性**: ✅ 完全一致

#### 1.2 tdnet_executions テーブル

**実装状況**: ✅ 完全実装

**設計内容**:
- **PK**: `execution_id` (STRING)
- **GSI**: `GSI_Status_StartedAt`
  - PK: `status` (STRING)
  - SK: `started_at` (STRING)
  - Projection: ALL
- **TTL**: `ttl` 属性（30日後自動削除）
- **課金モード**: PAY_PER_REQUEST
- **暗号化**: AWS_MANAGED
- **PITR**: 有効
- **削除保護**: RETAIN

**設計ドキュメントとの整合性**: ✅ 完全一致

#### 1.3 tdnet_export_status テーブル

**実装状況**: ✅ 完全実装

**設計内容**:
- **PK**: `export_id` (STRING)
- **GSI**: `GSI_Status_RequestedAt`
  - PK: `status` (STRING)
  - SK: `requested_at` (STRING)
  - Projection: ALL
- **TTL**: `ttl` 属性（30日後自動削除）
- **課金モード**: PAY_PER_REQUEST
- **暗号化**: AWS_MANAGED
- **PITR**: 有効
- **削除保護**: RETAIN

**設計ドキュメントとの整合性**: ✅ 完全一致

---

### 2. disclosure_id生成ロジック

**実装状況**: ✅ 完全実装

**ファイル**: `src/utils/disclosure-id.ts`

**実装内容**:
```typescript
export function generateDisclosureId(
  disclosedAt: string,
  companyCode: string,
  sequence: number
): string
```

**主要機能**:
1. **JST基準の日付抽出**: UTC時刻をJST（UTC+9時間）に変換してから日付を抽出
2. **フォーマット**: `YYYYMMDD_企業コード_連番` (例: `20240115_1234_001`)
3. **バリデーション**:
   - `disclosedAt`: ISO 8601形式チェック
   - `companyCode`: 4-5桁の英数字チェック（正規表現: `^[0-9A-Z]{4,5}$`）
   - `sequence`: 0-999の整数チェック
4. **連番**: 3桁ゼロパディング

**月またぎエッジケース対応**: ✅ 実装済み
- UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00 → ID: `20240201_xxxx_xxx`
- UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01T00:30:00 → ID: `20240101_xxxx_xxx`

**テストカバレッジ**: ✅ 包括的
- 正常系: JST基準の日付抽出、連番ゼロパディング
- エッジケース: 月またぎ（UTC→JST変換）
- 異常系: 不正なフォーマット、不正な企業コード、不正な連番

**設計ドキュメントとの整合性**: ✅ 完全一致

---

### 3. date_partition生成ロジック

**実装状況**: ✅ 完全実装

**ファイル**: `src/utils/date-partition.ts`

**実装内容**:
```typescript
export function generateDatePartition(disclosedAt: string): string
export function validateDisclosedAt(disclosedAt: string): void
export function generateMonthRange(start: string, end: string): string[]
export function validateYearMonth(yearMonth: string): void
```

**主要機能**:

#### 3.1 generateDatePartition
- **JST基準**: UTC時刻をJST（UTC+9時間）に変換してから年月を抽出
- **フォーマット**: `YYYY-MM` (例: `2024-01`)
- **用途**: DynamoDB GSI2のパーティションキー（月単位クエリ高速化）

**月またぎエッジケース対応**: ✅ 実装済み
- UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00 → `2024-02`
- UTC: 2024-01-31T14:59:59Z → JST: 2024-01-31T23:59:59 → `2024-01`
- UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01T00:30:00 → `2024-01`（年またぎ）

#### 3.2 validateDisclosedAt
- **ISO 8601形式チェック**: 正規表現による厳密な検証
- **有効な日付チェック**: `Date`オブジェクトによる検証
- **日付正規化チェック**: 存在しない日付（2024-02-30等）を検出
- **範囲チェック**: 1970-01-01以降、現在時刻+1日以内

#### 3.3 generateMonthRange
- **月範囲生成**: 開始月から終了月までの月リストを生成
- **用途**: 日付範囲クエリで複数月を並行クエリする際に使用

#### 3.4 validateYearMonth
- **YYYY-MM形式チェック**: 正規表現による検証
- **月範囲チェック**: 01-12の範囲内であることを確認

**テストカバレッジ**: ✅ 包括的
- 正常系: JST基準のYYYY-MM形式生成、境界値テスト
- エッジケース: 月またぎ（UTC→JST変換）、月末の深夜、年またぎ
- 異常系: 不正なフォーマット、存在しない日付、範囲外の日付

**設計ドキュメントとの整合性**: ✅ 完全一致

---

### 4. Zodスキーマ定義

**実装状況**: ❌ 未実装

**調査結果**:
- `src/validators/` フォルダが存在しない
- Zodライブラリを使用したスキーマ定義が見つからない
- 代わりに、TypeScript型定義（`src/types/index.ts`）とカスタムバリデーション関数（`src/models/disclosure.ts`）を使用

**現在の実装方式**:
1. **TypeScript型定義**: `src/types/index.ts`で`Disclosure`インターフェースを定義
2. **カスタムバリデーション**: `src/models/disclosure.ts`の`validateDisclosure`関数で必須フィールドとフォーマットを検証

**問題点**:
- Zodスキーマを使用していないため、ランタイムバリデーションの型安全性が低い
- バリデーションロジックが分散している（disclosure.ts, date-partition.ts, disclosure-id.ts）

**推奨事項**:
- Zodスキーマを導入し、型定義とバリデーションを統合
- `src/validators/disclosure-schema.ts`を作成し、Zodスキーマを定義
- 既存のバリデーション関数をZodスキーマに移行

---

### 5. 必須フィールドバリデーション

**実装状況**: ✅ 実装済み（カスタムバリデーション）

**ファイル**: `src/models/disclosure.ts`

**実装内容**:
```typescript
export function validateDisclosure(disclosure: Partial<Disclosure>): void
```

**検証項目**:
1. **必須フィールドの存在チェック**:
   - `disclosure_id`
   - `company_code`
   - `company_name`
   - `disclosure_type`
   - `title`
   - `disclosed_at`
   - `downloaded_at`
   - `date_partition`

2. **フォーマット検証**:
   - `disclosed_at`: ISO 8601形式（`validateDisclosedAt`を使用）
   - `downloaded_at`: ISO 8601形式（`validateDisclosedAt`を使用）
   - `company_code`: 4桁の数字（正規表現: `^\d{4}$`）
   - `date_partition`: YYYY-MM形式（正規表現: `^\d{4}-\d{2}$`）

3. **エラーハンドリング**:
   - 欠落フィールドがある場合: `ValidationError`をスロー
   - 不正なフォーマットの場合: `ValidationError`をスロー
   - エラーメッセージに欠落フィールド名を含める

**テストカバレッジ**: ✅ 包括的
- 正常系: すべての必須フィールドが存在する場合
- 異常系: 各必須フィールドの欠落、複数フィールドの欠落
- 異常系: 不正なフォーマット（disclosed_at, downloaded_at, company_code, date_partition）

**設計ドキュメントとの整合性**: ⚠️ 部分的一致
- 必須フィールドバリデーションは実装済み
- ただし、Zodスキーマではなくカスタムバリデーション関数を使用

---

### 6. データ整合性チェック

**実装状況**: ✅ 実装済み

**ファイル**: `src/models/disclosure.ts`

**実装内容**:

#### 6.1 DynamoDBアイテム変換時の整合性チェック

**toDynamoDBItem関数**:
- 変換前に`validateDisclosure`を実行
- すべての必須フィールドとフォーマットを検証
- バリデーション失敗時は`ValidationError`をスロー

**fromDynamoDBItem関数**:
- 必須フィールドの存在チェック
- 変換後に`validateDisclosure`を実行
- DynamoDBアイテムの不整合を検出

#### 6.2 Disclosure作成時の整合性チェック

**createDisclosure関数**:
- `date_partition`が指定されていない場合は自動生成（JST基準）
- `downloaded_at`が指定されていない場合は現在時刻を使用
- 作成後に`validateDisclosure`を実行
- バリデーション失敗時は`ValidationError`をスロー

#### 6.3 Two-Phase Commit原則

**実装方針**:
- `date_partition`は保存前に生成（`createDisclosure`または明示的に指定）
- `toDynamoDBItem`は変換のみを行い、`date_partition`の生成は行わない
- これにより、データ生成と保存のフェーズを分離

**テストカバレッジ**: ✅ 包括的
- DynamoDBアイテム変換の正常系・異常系
- Disclosure作成の正常系・異常系
- JST基準のdate_partition自動生成
- nullish coalescing演算子のエッジケーステスト

**設計ドキュメントとの整合性**: ✅ 完全一致

---

## 問題点・改善点

### 問題1: Zodスキーマ未実装

**重要度**: 中

**詳細**:
- 設計ドキュメント（`tdnet-implementation-rules.md`）では「バリデーション: Zod使用、必須フィールド検証」と記載
- 実際にはカスタムバリデーション関数を使用
- Zodライブラリがインストールされているか不明

**影響**:
- ランタイムバリデーションの型安全性が低い
- バリデーションロジックが分散している
- スキーマ定義とTypeScript型定義が分離している

**改善提案**:
1. Zodライブラリをインストール: `npm install zod`
2. `src/validators/disclosure-schema.ts`を作成
3. Zodスキーマを定義:
   ```typescript
   import { z } from 'zod';
   
   export const DisclosureSchema = z.object({
     disclosure_id: z.string().regex(/^\d{8}_[0-9A-Z]{4,5}_\d{3}$/),
     company_code: z.string().regex(/^\d{4}$/),
     company_name: z.string().min(1),
     disclosure_type: z.string().min(1),
     title: z.string().min(1),
     disclosed_at: z.string().datetime(),
     downloaded_at: z.string().datetime(),
     date_partition: z.string().regex(/^\d{4}-\d{2}$/),
     pdf_url: z.string().url().optional(),
     pdf_s3_key: z.string().optional(),
   });
   
   export type Disclosure = z.infer<typeof DisclosureSchema>;
   ```
4. 既存のバリデーション関数をZodスキーマに移行
5. `src/types/index.ts`の`Disclosure`型をZodから生成

**優先度**: 中（機能的には問題ないが、設計ドキュメントとの整合性のため）

---

### 問題2: company_codeバリデーションの不一致

**重要度**: 低

**詳細**:
- `src/utils/disclosure-id.ts`の`generateDisclosureId`関数:
  - 正規表現: `^[0-9A-Z]{4,5}$`（4-5桁の英数字）
- `src/models/disclosure.ts`の`validateDisclosure`関数:
  - 正規表現: `^\d{4}$`（4桁の数字のみ）

**影響**:
- `generateDisclosureId`は5桁の企業コードや英字を含む企業コードを許可
- `validateDisclosure`は4桁の数字のみを許可
- 不整合により、`generateDisclosureId`で生成したIDが`validateDisclosure`でエラーになる可能性

**改善提案**:
1. 企業コードの仕様を明確化（4桁の数字のみ、または4-5桁の英数字）
2. 両方のバリデーションを統一
3. 推奨: 4桁の数字のみに統一（日本の証券コードは4桁の数字）
   ```typescript
   // disclosure-id.ts
   if (!companyCode || !/^\d{4}$/.test(companyCode)) {
     throw new ValidationError(`Invalid companyCode: ${companyCode}`);
   }
   ```

**優先度**: 低（現在のテストでは問題が発生していない）

---

### 問題3: file_sizeバリデーションの実装漏れ

**重要度**: 低

**詳細**:
- `src/models/__tests__/disclosure.test.ts`にfile_sizeバリデーションのテストが存在
- しかし、`src/models/disclosure.ts`の`validateDisclosure`関数にfile_sizeバリデーションが実装されていない
- `src/types/index.ts`の`Disclosure`型にもfile_sizeフィールドが定義されていない

**影響**:
- テストが実際の実装と乖離している
- file_sizeバリデーションが機能していない

**改善提案**:
1. `src/types/index.ts`の`Disclosure`型に`file_size?: number`を追加
2. `src/models/disclosure.ts`の`validateDisclosure`関数にfile_sizeバリデーションを追加:
   ```typescript
   // file_sizeのバリデーション（オプショナル）
   if (disclosure.file_size !== undefined && disclosure.file_size !== null) {
     const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
     if (disclosure.file_size < 0) {
       throw new ValidationError('File size must be non-negative', {
         file_size: disclosure.file_size,
       });
     }
     if (disclosure.file_size > MAX_FILE_SIZE) {
       throw new ValidationError(
         `File size exceeds maximum allowed size (${MAX_FILE_SIZE} bytes)`,
         { file_size: disclosure.file_size, max_file_size: MAX_FILE_SIZE }
       );
     }
   }
   ```
3. または、テストからfile_size関連のテストケースを削除

**優先度**: 低（file_sizeフィールドが現在使用されていない場合）

---

## 成果物

### チェック結果サマリー

| 項目 | 実装状況 | 設計整合性 | 備考 |
|------|---------|-----------|------|
| DynamoDB テーブル設計 | ✅ 完全実装 | ✅ 完全一致 | PK, GSI, TTL すべて正しく実装 |
| disclosure_id生成ロジック | ✅ 完全実装 | ✅ 完全一致 | JST基準、月またぎ対応済み |
| date_partition生成ロジック | ✅ 完全実装 | ✅ 完全一致 | JST基準、月またぎ対応済み |
| Zodスキーマ定義 | ❌ 未実装 | ⚠️ 不一致 | カスタムバリデーションで代替 |
| 必須フィールドバリデーション | ✅ 実装済み | ⚠️ 部分的一致 | Zodではなくカスタム実装 |
| データ整合性チェック | ✅ 実装済み | ✅ 完全一致 | Two-Phase Commit原則遵守 |

### 総合評価

**実装品質**: ⭐⭐⭐⭐☆ (4/5)

**強み**:
- DynamoDBテーブル設計が完璧に実装されている
- disclosure_id、date_partition生成ロジックがJST基準で正しく実装
- 月またぎエッジケースに対応
- 包括的なテストカバレッジ
- Two-Phase Commit原則を遵守したデータ整合性チェック

**改善点**:
- Zodスキーマ未実装（設計ドキュメントとの不一致）
- company_codeバリデーションの不一致（軽微）
- file_sizeバリデーションの実装漏れ（軽微）

**推奨アクション**:
1. **優先度: 中** - Zodスキーマの導入（設計ドキュメントとの整合性のため）
2. **優先度: 低** - company_codeバリデーションの統一
3. **優先度: 低** - file_sizeバリデーションの実装またはテスト削除

---

## 申し送り事項

### 次のタスクへの引き継ぎ

1. **Zodスキーマ導入の検討**:
   - 設計ドキュメントでは「Zod使用」と記載されているが、実装されていない
   - 機能的には問題ないが、設計ドキュメントとの整合性のため導入を検討
   - 導入する場合は、既存のカスタムバリデーション関数をZodスキーマに移行

2. **company_codeバリデーションの統一**:
   - `disclosure-id.ts`と`disclosure.ts`でバリデーションが異なる
   - 日本の証券コードは4桁の数字なので、`^\d{4}$`に統一を推奨

3. **file_sizeバリデーションの整理**:
   - テストに存在するが実装されていない
   - file_sizeフィールドが必要な場合は実装、不要な場合はテスト削除

4. **テストカバレッジの維持**:
   - 現在のテストカバレッジは非常に高い
   - 新機能追加時も同様のテストカバレッジを維持すること

---

**作業完了日時**: 2026年2月22日 08:37:23  
**作業時間**: 約15分  
**ステータス**: 完了

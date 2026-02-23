# AWS統合サービス インターフェース整合性点検

**作業日時**: 2026-02-23 15:31:55  
**担当**: Subagent 2  
**タスク**: tasks-interface-consistency-check.md セクション2-4  
**対象**: DynamoDB/S3/Secrets Manager

## 実施内容

### 1. 型定義の確認

#### 1.1 Disclosure型（src/types/index.ts）
- ✅ 基本型定義は完全
- ✅ DynamoDBItem型定義あり
- ✅ ExecutionStatus型定義あり

#### 1.2 モデル実装（src/models/disclosure.ts）
- ✅ `toDynamoDBItem()`: Disclosure → DynamoDBItem変換
- ✅ `fromDynamoDBItem()`: DynamoDBItem → Disclosure変換
- ✅ `validateDisclosure()`: バリデーション実装
- ✅ `createDisclosure()`: ヘルパー関数

### 2. DynamoDB操作の整合性

#### 2.1 Disclosures Table操作

**実装パターン**:
- `src/lambda/collector/save-metadata.ts`: PutItemCommand（低レベルAPI）
- `src/lambda/query/query-disclosures.ts`: QueryCommand（低レベルAPI）
- `src/lambda/stats/handler.ts`: DynamoDBDocumentClient（高レベルAPI）
- `src/lambda/get-disclosure/handler.ts`: DynamoDBDocumentClient（高レベルAPI）

**不整合1: APIレベルの混在**
- ❌ 低レベルAPI（DynamoDBClient + marshall/unmarshall）と高レベルAPI（DynamoDBDocumentClient）が混在
- 影響: コードの一貫性欠如、保守性低下
- 推奨: DynamoDBDocumentClientに統一

**不整合2: 型定義の不一致**
- ❌ `src/types/index.ts`の`DynamoDBItem`型は低レベルAPI用
- ❌ DynamoDBDocumentClient使用箇所では`Record<string, any>`を使用
- 影響: 型安全性の欠如

#### 2.2 ExecutionState Table操作

**実装箇所**:
- `src/lambda/collector/update-execution-status.ts`

**型定義の重複**:
- ❌ `src/types/index.ts`に`ExecutionStatus`型あり
- ❌ `src/lambda/collector/update-execution-status.ts`に独自の`ExecutionStatus`型あり
- 影響: 型定義の重複、不整合の可能性

**フィールド名の不一致**:
```typescript
// src/types/index.ts
interface ExecutionStatus {
  success_count: number;
  failed_count: number;
  // ...
}

// src/lambda/collector/update-execution-status.ts
interface ExecutionStatus {
  collected_count: number;  // ← 不一致
  failed_count: number;
  // ...
}
```

**不整合3: ExecutionStatus型の重複定義**
- ❌ 2箇所で異なる定義
- ❌ フィールド名が不一致（`success_count` vs `collected_count`）
- 影響: 実装の混乱、バグの原因

#### 2.3 環境変数の不整合

**テーブル名環境変数**:
- `DYNAMODB_TABLE`: Disclosures Table
- `EXECUTION_STATE_TABLE`: ExecutionState Table
- `DYNAMODB_TABLE_NAME`: Disclosures Table（別名）

**不整合4: 環境変数名の重複**
- ❌ `DYNAMODB_TABLE`と`DYNAMODB_TABLE_NAME`が混在
- 影響: 設定ミスの可能性

### 3. S3操作の整合性

#### 3.1 PDF保存操作

**実装箇所**:
- `src/lambda/collector/download-pdf.ts`: PutObjectCommand

**型定義**:
- ✅ S3Client使用（一貫性あり）
- ✅ PutObjectCommandのパラメータ型は正しい

**環境変数**:
- `S3_BUCKET`: PDFバケット名
- `S3_BUCKET_NAME`: PDFバケット名（別名）

**不整合5: 環境変数名の重複**
- ❌ `S3_BUCKET`と`S3_BUCKET_NAME`が混在
- 影響: 設定ミスの可能性

#### 3.2 署名付きURL生成

**実装箇所**:
- `src/lambda/query/generate-presigned-url.ts`

**型定義**:
- ✅ S3Client使用（一貫性あり）
- ✅ GetObjectCommandのパラメータ型は正しい

**環境変数**:
- ハードコーディング: `BUCKET_NAME = 'tdnet-data-collector-pdfs'`

**不整合6: 環境変数のハードコーディング**
- ❌ デフォルト値がハードコーディング
- 影響: 環境別設定の柔軟性欠如

### 4. Secrets Manager操作の整合性

#### 4.1 API Key取得

**実装箇所**:
- `src/utils/secrets-manager.ts`

**型定義**:
- ✅ SecretsManagerClient使用（一貫性あり）
- ✅ GetSecretValueCommandのパラメータ型は正しい
- ✅ キャッシュ機能実装済み

**環境変数**:
- `API_KEY_SECRET_NAME`: シークレット名
- デフォルト値: `/tdnet/api-key`

**整合性**:
- ✅ 型定義と実装は整合
- ✅ エラーハンドリング実装済み
- ✅ 再試行ロジック実装済み

### 5. Logger実装の問題

**不整合7: createErrorContext関数の欠落**
- ❌ `src/utils/logger.ts`に`createErrorContext`関数が存在しない
- ❌ 複数のLambda関数でインポートエラー発生
  - `src/lambda/collector-save/handler.ts`
  - `src/lambda/collector-fetch/handler.ts`
  - `src/lambda/stats/handler.ts`
  - `src/lambda/collector-init/handler.ts`
- 影響: コンパイルエラー、実行時エラー

## 不整合リスト（優先度順）

### 高優先度（実装エラー）

1. **Logger: createErrorContext関数の欠落**
   - 箇所: `src/utils/logger.ts`
   - 影響: コンパイルエラー
   - 対応: 関数実装または使用箇所の修正

2. **ExecutionStatus型の重複定義**
   - 箇所: `src/types/index.ts` vs `src/lambda/collector/update-execution-status.ts`
   - 影響: フィールド名不一致（`success_count` vs `collected_count`）
   - 対応: 型定義の統一

### 中優先度（一貫性の問題）

3. **DynamoDB APIレベルの混在**
   - 箇所: 複数のLambda関数
   - 影響: コードの一貫性欠如
   - 対応: DynamoDBDocumentClientに統一

4. **環境変数名の重複**
   - `DYNAMODB_TABLE` vs `DYNAMODB_TABLE_NAME`
   - `S3_BUCKET` vs `S3_BUCKET_NAME`
   - 影響: 設定ミスの可能性
   - 対応: 環境変数名の統一

### 低優先度（改善推奨）

5. **DynamoDBItem型定義の不一致**
   - 箇所: `src/types/index.ts`
   - 影響: 型安全性の欠如
   - 対応: DynamoDBDocumentClient用の型定義追加

6. **環境変数のハードコーディング**
   - 箇所: `src/lambda/query/generate-presigned-url.ts`
   - 影響: 環境別設定の柔軟性欠如
   - 対応: 環境変数の使用

## 推奨対応

### 即時対応が必要

1. `createErrorContext`関数の実装または使用箇所の修正
2. `ExecutionStatus`型定義の統一

### 計画的対応

3. DynamoDB操作のDynamoDBDocumentClientへの統一
4. 環境変数名の統一（`DYNAMODB_TABLE`, `S3_BUCKET`に統一）
5. 型定義の整理（DynamoDBDocumentClient用の型追加）

## 完了条件

- ✅ すべてのAWS統合サービスの型定義を確認
- ✅ 不整合リストを作成
- ✅ 作業記録を作成

## 申し送り事項

1. **Logger問題**: `createErrorContext`関数が複数箇所で使用されているが実装が存在しない。即時対応が必要。
2. **ExecutionStatus型**: 2箇所で異なる定義があり、フィールド名が不一致。型定義の統一が必要。
3. **DynamoDB API**: 低レベルAPIと高レベルAPIが混在。DynamoDBDocumentClientへの統一を推奨。
4. **環境変数**: テーブル名とバケット名で環境変数名が重複。統一が必要。

## 次のステップ

tasks-interface-consistency-fix.mdで修正作業を実施する際、上記の不整合リストを参照してください。

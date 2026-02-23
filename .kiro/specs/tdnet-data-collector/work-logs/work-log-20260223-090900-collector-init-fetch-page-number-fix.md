# 作業記録: collector-init/fetch page_number型修正

**作業日時**: 2026-02-23 09:09:00
**タスク**: タスク8.1.6 - collect-status API 500エラーの調査と修正（続き）
**作業者**: AI Assistant

## 作業概要

Step Functions実行時に`collector-fetch` Lambda関数で`page_number`の型エラーが発生していた問題を修正しました。

## 問題の詳細

### 根本原因

`collector-init`が`pages`フィールドとして日付文字列の配列（例: `["2026-02-20"]`）を返していましたが、`collector-fetch`は`page_number`を正の整数として期待していました。

### エラーログ

```
Invalid page_number: 2026-02-20. Expected positive integer.
```

### 設計の不一致

- **collector-init**: `pages`として日付文字列の配列を返す
- **Step Functions**: `page_number`として日付文字列を渡す
- **collector-fetch**: `page_number`を`number`型として期待

## 実施した修正

### 1. collector-fetch/handler.ts

#### FetchEventインターフェース修正

```typescript
// 修正前
export interface FetchEvent {
  execution_id: string;
  page_number: number; // ❌ 整数型
  start_date: string;
  end_date: string;
  max_items?: number;
}

// 修正後
export interface FetchEvent {
  execution_id: string;
  page_number: string; // ✅ 日付文字列（YYYY-MM-DD形式）
  start_date: string;
  end_date: string;
  max_items?: number;
}
```

#### FetchResponseインターフェース修正

```typescript
// 修正前
export interface FetchResponse {
  execution_id: string;
  page_number: number; // ❌ 整数型
  items: DisclosureMetadata[];
  count: number;
}

// 修正後
export interface FetchResponse {
  execution_id: string;
  page_number: string; // ✅ 日付文字列
  items: DisclosureMetadata[];
  count: number;
}
```

#### validateEvent関数修正

```typescript
// 修正前
if (!event.page_number || typeof event.page_number !== 'number' || event.page_number < 1) {
  throw new ValidationError(
    `Invalid page_number: ${event.page_number}. Expected positive integer.`
  );
}

// 修正後
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

if (!event.page_number || typeof event.page_number !== 'string') {
  throw new ValidationError(
    `Invalid page_number: ${event.page_number}. Expected non-empty string (YYYY-MM-DD format).`
  );
}

if (!dateRegex.test(event.page_number)) {
  throw new ValidationError(
    `Invalid page_number format: ${event.page_number}. Expected YYYY-MM-DD format.`
  );
}
```

#### fetchTdnetPage呼び出し修正

```typescript
// 修正前
const items = await fetchTdnetPage(
  event.start_date,
  event.page_number
);

// 修正後
const items = await fetchTdnetPage(
  event.page_number, // 日付文字列を渡す
  1 // 常に1ページ目を取得
);
```

#### dateRegex重複宣言の修正

`validateEvent`関数内で`dateRegex`が2回宣言されていた問題を修正し、関数の先頭で1回だけ宣言するように変更しました。

### 2. collector-init/handler.ts

#### modeフィールドの削除

`InitEvent`インターフェースから`mode`フィールドが削除されていましたが、handler実装では`event.mode`を使用していたため、削除しました。

```typescript
// 修正前
let dates: string[];
if (event.mode === 'batch') {
  // バッチモード処理
  const yesterday = getYesterday();
  const dateStr = formatDate(yesterday);
  dates = [dateStr];
} else {
  // オンデマンドモード処理
  dates = generateDateRange(event.start_date!, event.end_date!);
}

// 修正後
const dates = generateDateRange(event.start_date, event.end_date);
```

### 3. collector-save/handler.ts

#### SaveEventインターフェース修正

```typescript
// 修正前
export interface SaveEvent {
  execution_id: string;
  page_number: number; // ❌ 整数型
  items: DisclosureMetadata[];
}

// 修正後
export interface SaveEvent {
  execution_id: string;
  page_number: string; // ✅ 日付文字列（YYYY-MM-DD形式）
  items: DisclosureMetadata[];
}
```

#### SaveResponseインターフェース修正

```typescript
// 修正前
export interface SaveResponse {
  execution_id: string;
  page_number: number; // ❌ 整数型
  saved_count: number;
  failed_count: number;
  failed_items: Array<{ disclosure_id: string; error: string; }>;
}

// 修正後
export interface SaveResponse {
  execution_id: string;
  page_number: string; // ✅ 日付文字列
  saved_count: number;
  failed_count: number;
  failed_items: Array<{ disclosure_id: string; error: string; }>;
}
```

## 成果物

- `src/lambda/collector-fetch/handler.ts` (修正)
- `src/lambda/collector-init/handler.ts` (修正)
- `src/lambda/collector-save/handler.ts` (修正)

## 次のステップ

1. ユニットテストの修正と実行
   - `src/lambda/collector-fetch/__tests__/handler.test.ts`
   - `src/lambda/collector-init/__tests__/handler.test.ts`
   - `src/lambda/collector-save/__tests__/handler.test.ts`

2. CDKデプロイ
   ```powershell
   cd cdk
   npm run cdk deploy -- --all --require-approval never --profile imanishi-awssso
   ```

3. 本番環境での動作確認
   ```powershell
   .\scripts\manual-data-collection.ps1 -StartDate "2026-02-20" -EndDate "2026-02-20" -MaxItems 10
   ```

4. Git commit
   ```
   [fix] Step Functions collector-fetch page_number型修正（日付文字列対応）
   ```

## 申し送り事項

- ユニットテストは`page_number`を整数として期待しているため、日付文字列に修正する必要があります
- 統合テストも同様に修正が必要です
- 本番環境での動作確認後、CloudWatch Logsで各Lambda関数の実行ログを確認してください

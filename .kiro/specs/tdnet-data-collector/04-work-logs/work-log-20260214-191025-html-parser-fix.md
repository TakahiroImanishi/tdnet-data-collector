# Work Log: HTML Parser Fix for Actual TDnet Structure

**Task**: 31.2.6.1 HTMLパーサーの修正（Critical）
**Started**: 2026-02-14 19:10:25
**Status**: In Progress

## Objective
実際のTDnet HTML構造に合わせてHTMLパーサーを修正する。

## Current Implementation Analysis

### Files to Modify
1. `src/scraper/html-parser.ts` - CSSセレクタとパースロジック
2. `src/lambda/collector/scrape-tdnet-list.ts` - Shift_JISエンコーディング対応

### Current Parser Assumptions
- Uses CSS selector: `table.disclosure-list`
- Expects table rows with 6 cells:
  - Cell 0: company_code
  - Cell 1: company_name
  - Cell 2: disclosure_type
  - Cell 3: title
  - Cell 4: disclosed_at
  - Cell 5: pdf_url (link in anchor tag)

## Investigation Steps

### Step 1: Fetch Real TDnet HTML
Need to fetch actual HTML from TDnet to understand the real structure.



### Step 2: Actual TDnet HTML Structure Analysis

**Fetched**: https://www.release.tdnet.info/inbs/I_list_001_20260213.html
**Status**: 200 OK
**Content-Type**: text/html (Shift_JIS encoding expected)
**Content Length**: 65,702 bytes

**Actual HTML Structure**:
```html
<table id="main-list-table">
  <tr>
    <td class="oddnew-L kjTime">22:00</td>           <!-- Cell 0: Time -->
    <td class="oddnew-M kjCode">93380</td>           <!-- Cell 1: Company Code -->
    <td class="oddnew-M kjName">GINFORICH</td>       <!-- Cell 2: Company Name -->
    <td class="oddnew-M kjTitle">                    <!-- Cell 3: Title with PDF link -->
      <a href="140120260213562187.pdf">タイトル</a>
    </td>
    <td class="oddnew-M kjXbrl">                     <!-- Cell 4: XBRL (optional) -->
      <div class="xbrl-mask">...</div>
    </td>
    <td class="oddnew-M kjPlace">東</td>              <!-- Cell 5: Exchange -->
    <td class="oddnew-R kjHistroy">ニューー</td>      <!-- Cell 6: History -->
  </tr>
</table>
```

**Key Findings**:
1. Table ID: `main-list-table` (NOT `disclosure-list`)
2. Row classes alternate: `oddnew-L/M/R` and `evennew-L/M/R`
3. Cell structure (7 cells):
   - Cell 0: `kjTime` - Time (HH:MM format)
   - Cell 1: `kjCode` - Company Code (5 digits, e.g., "93380")
   - Cell 2: `kjName` - Company Name
   - Cell 3: `kjTitle` - Title with PDF link (relative URL)
   - Cell 4: `kjXbrl` - XBRL link (optional, may be empty)
   - Cell 5: `kjPlace` - Exchange (e.g., "東", "東札")
   - Cell 6: `kjHistroy` - History (e.g., "ニューー")
4. PDF URLs are relative (e.g., "140120260213562187.pdf")
5. Date is in page header: "2026年02月13日"
6. Encoding: Shift_JIS (Japanese characters are garbled in UTF-8 view)

**Required Changes**:
1. Update CSS selector: `table.disclosure-list` → `table#main-list-table`
2. Update cell mapping (7 cells instead of 6)
3. Extract time from Cell 0, combine with date from page header
4. Handle 5-digit company codes
5. Build absolute PDF URLs from relative paths
6. Add Shift_JIS encoding support in scrape-tdnet-list.ts
7. Extract date from page header (div#kaiji-date-1)



## Implementation

### Step 3: HTML Parser Modifications

**File**: `src/scraper/html-parser.ts`

**Changes**:
1. ✅ Updated `parseDisclosureList()` signature to accept `requestDate` parameter
2. ✅ Changed CSS selector from `table.disclosure-list` to `table#main-list-table`
3. ✅ Updated cell mapping for 7-cell structure:
   - Cell 0: kjTime (時刻)
   - Cell 1: kjCode (企業コード - 5桁対応)
   - Cell 2: kjName (企業名)
   - Cell 3: kjTitle (タイトル + PDFリンク)
   - Cell 4-6: Skipped (XBRL, 取引所, 履歴)
4. ✅ Added `extractPageDate()` - ページヘッダーから日付抽出
5. ✅ Added `extractDisclosureType()` - タイトルから開示種類を推測
6. ✅ Added `buildAbsolutePdfUrl()` - 相対URLを絶対URLに変換
7. ✅ Updated `parseDisclosedAt()` - 日付と時刻を別々に受け取る
8. ✅ Updated `validateDisclosureMetadata()` - 5桁企業コード対応
9. ✅ Updated `detectHtmlStructureChange()` - 新しいセレクタに対応

### Step 4: Scrape TDnet List Modifications

**File**: `src/lambda/collector/scrape-tdnet-list.ts`

**Changes**:
1. ✅ Added `decodeShiftJIS()` - Shift_JISデコード関数
2. ✅ Updated `fetchTdnetHtml()`:
   - `responseType: 'arraybuffer'` を追加
   - Shift_JISデコード処理を追加
3. ✅ Updated `parseDisclosureList()` call to pass `date` parameter



## Testing

### Step 5: Test Execution

**HTML Parser Tests**:
```
npm test -- html-parser.test.ts
```
**Result**: ✅ 17/17 tests passed (100%)

**Scrape TDnet List Tests**:
```
npm test -- scrape-tdnet-list.test.ts
```
**Result**: ✅ 35/35 tests passed (100%)

### Test Coverage
- ✅ 正常系: 実際のTDnet HTML構造でのパース成功
- ✅ 5桁企業コード対応
- ✅ 異常系: エラーハンドリング（空HTML、不正な行、不正なフィールド）
- ✅ 部分的失敗の処理（Graceful Degradation）
- ✅ バリデーションエラー: 必須フィールド欠落
- ✅ エッジケース: 空テーブル、ホワイトスペース、フォールバック日付
- ✅ Shift_JISエンコーディング対応（後方互換性あり）

## Summary

### 完了した変更

1. **HTML Parser (`src/scraper/html-parser.ts`)**:
   - ✅ CSS selector更新: `table.disclosure-list` → `table#main-list-table`
   - ✅ セル構造を7セルに対応（時刻、企業コード、企業名、タイトル、XBRL、取引所、履歴）
   - ✅ 5桁企業コード対応（バリデーション: `/^\d{4,5}$/`）
   - ✅ 相対PDF URLを絶対URLに変換（`buildAbsolutePdfUrl`）
   - ✅ ページヘッダーから日付抽出（`extractPageDate`）
   - ✅ タイトルから開示種類を推測（`extractDisclosureType`）
   - ✅ 日付と時刻を別々に処理（`parseDisclosedAt`）
   - ✅ HTML構造変更検知の更新

2. **Scrape TDnet List (`src/lambda/collector/scrape-tdnet-list.ts`)**:
   - ✅ Shift_JISエンコーディング対応（`decodeShiftJIS`）
   - ✅ `responseType: 'arraybuffer'` 設定
   - ✅ `parseDisclosureList` に日付パラメータを渡す
   - ✅ 後方互換性（テスト用に文字列も受け入れ）

3. **Tests (`src/scraper/__tests__/html-parser.test.ts`)**:
   - ✅ 実際のTDnet HTML構造に合わせて全テストを更新
   - ✅ 17テストケース、すべて成功

4. **Tests (`src/lambda/collector/__tests__/scrape-tdnet-list.test.ts`)**:
   - ✅ `parseDisclosureList` の呼び出しに日付パラメータを追加
   - ✅ 35テストケース、すべて成功

### 技術的な改善点

1. **実際のTDnet HTML構造に完全対応**:
   - 実際のTDnetサイトからHTMLをフェッチして構造を分析
   - 正確なCSSセレクタとセル構造を実装

2. **Shift_JISエンコーディング対応**:
   - TDnetはShift_JISを使用しているため、TextDecoderで正しくデコード
   - 日本語文字化け問題を解決

3. **5桁企業コード対応**:
   - 従来の4桁に加えて、5桁の企業コードもサポート
   - バリデーションを `/^\d{4,5}$/` に更新

4. **相対URL→絶対URL変換**:
   - TDnetのPDF URLは相対パス（例: "140120260213562187.pdf"）
   - 絶対URL（`https://www.release.tdnet.info/inbs/...`）に変換

5. **開示種類の自動推測**:
   - タイトルから開示種類を推測（決算短信、適時開示、IR資料、その他）
   - より正確なメタデータ分類

### 申し送り事項

1. **実際のTDnetサイトでの動作確認が必要**:
   - 本実装は2026-02-13のTDnet HTMLに基づいている
   - TDnetのHTML構造が変更される可能性があるため、定期的な確認が推奨される
   - HTML構造変更検知機能が実装済み（ログに記録）

2. **Shift_JISエンコーディングの検証**:
   - TextDecoderの'shift_jis'サポートはNode.js環境に依存
   - 本番環境での動作確認が必要

3. **開示種類の推測ロジック**:
   - 現在は簡易的な実装（タイトルのキーワードマッチング）
   - より正確な分類が必要な場合は、TDnetのカテゴリ情報を使用することを推奨

4. **次のステップ**:
   - 実際のTDnetサイトでのE2Eテスト実行
   - 本番環境へのデプロイ前の動作確認
   - HTML構造変更時のアラート設定（CloudWatch Logs Insights）

## Completion

**Status**: ✅ Complete
**Date**: 2026-02-14 19:17
**Test Results**: 52/52 tests passed (100%)
**Files Modified**: 3
**Files Created**: 1 (tdnet-sample.html - 検証用)


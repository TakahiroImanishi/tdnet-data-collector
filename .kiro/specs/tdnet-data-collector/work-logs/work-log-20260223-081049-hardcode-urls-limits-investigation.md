# 作業記録: 外部API URLとファイルサイズ制限のハードコード調査

**作業日時**: 2026-02-23 08:10:49  
**作業者**: Kiro AI Assistant  
**タスク**: tasks-hardcoded-values-improvement.md - 外部API URLとファイルサイズ制限のハードコード調査

## 作業概要

プロジェクト全体を調査し、外部API URLとファイルサイズ制限のハードコード箇所を特定。定数ファイル化・環境変数化の対応方針を提案。

## 調査結果サマリー

### 外部API URL
- **箇所数**: 2箇所（本番コード）
- **環境依存性**: あり（環境変数フォールバック実装済み）

### ファイルサイズ制限
- **箇所数**: 4箇所（本番コード）
- **環境依存性**: なし（ビジネスロジック定数）

### タイムアウト設定
- **箇所数**: 3箇所（本番コード）
- **環境依存性**: なし（技術的制約）

### User-Agent設定
- **箇所数**: 3箇所（本番コード）
- **環境依存性**: なし（識別情報）

### レート制限設定
- **箇所数**: 2箇所（本番コード）
- **環境依存性**: なし（TDnet API制約）

### 再試行設定
- **箇所数**: 1箇所（ユーティリティ）
- **環境依存性**: なし（エラーハンドリング戦略）

## 詳細リスト

### 1. 外部API URL

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/lambda/collector/scrape-tdnet-list.ts` | TDNET_BASE_URL | `process.env.TDNET_BASE_URL \|\| 'https://www.release.tdnet.info/inbs'` | TDnet一覧ページURL構築 | 低（環境変数対応済み） |
| `src/lambda/collector-fetch/handler.ts` | TDNET_BASE_URL | `process.env.TDNET_BASE_URL \|\| 'https://www.release.tdnet.info/inbs'` | TDnet一覧ページURL構築 | 低（環境変数対応済み） |
| `src/scraper/README.md` | TDnet API URL | `https://api.tdnet.info/v1/disclosures` | ドキュメント内の例示 | 低（ドキュメントのみ） |

**対応状況**:
- ✅ 環境変数フォールバック実装済み（`TDNET_BASE_URL`）
- ✅ CDKスタックで環境変数設定済み（`cdk/lib/stacks/compute-stack.ts`）
- ✅ 公式URLをフォールバック値として使用（妥当性高い）

**推奨対応**: 現状維持（環境変数対応済みのため）

---

### 2. ファイルサイズ制限

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/scraper/pdf-downloader.ts` | MIN_PDF_SIZE | `10 * 1024` (10KB) | PDFファイル最小サイズ検証 | 高 |
| `src/scraper/pdf-downloader.ts` | MAX_PDF_SIZE | `50 * 1024 * 1024` (50MB) | PDFファイル最大サイズ検証 | 高 |
| `src/models/disclosure.ts` | MAX_FILE_SIZE | `100 * 1024 * 1024` (100MB) | メタデータfile_size範囲検証 | 高 |
| `src/validators/disclosure-schema.ts` | MAX_FILE_SIZE | `100 * 1024 * 1024` (100MB) | Zodスキーマfile_size検証 | 高 |

**ビジネスロジック根拠**:
- **10KB**: 有効なPDFファイルの最小サイズ（ヘッダー + 最小コンテンツ）
- **50MB**: TDnetからダウンロード可能なPDF最大サイズ（実測値ベース）
- **100MB**: DynamoDB/S3保存時の最大ファイルサイズ（AWS制約考慮）

**推奨対応**: 定数ファイル化（`src/constants/file-size-limits.ts`）

---

### 3. タイムアウト設定

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/lambda/collector/scrape-tdnet-list.ts` | HTTP_TIMEOUT_MS | `30000` (30秒) | TDnet HTMLフェッチタイムアウト | 中 |
| `src/lambda/collector-fetch/handler.ts` | HTTP_TIMEOUT_MS | `30000` (30秒) | TDnet HTMLフェッチタイムアウト | 中 |
| `src/scraper/pdf-downloader.ts` | timeout | `30000` (30秒) | PDFダウンロードタイムアウト | 中 |

**技術的根拠**:
- **30秒**: HTTPリクエストの標準的なタイムアウト時間
- Lambda関数のタイムアウト（15分）より十分短い
- TDnetサーバーの応答時間を考慮

**推奨対応**: 定数ファイル化（`src/constants/http-config.ts`）

---

### 4. User-Agent設定

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/lambda/collector/scrape-tdnet-list.ts` | USER_AGENT | `'TDnet-Data-Collector/1.0 (https://github.com/your-org/tdnet-data-collector)'` | TDnetへのHTTPリクエスト識別 | 中 |
| `src/lambda/collector-fetch/handler.ts` | USER_AGENT | `'TDnet-Data-Collector/1.0 (https://github.com/your-org/tdnet-data-collector)'` | TDnetへのHTTPリクエスト識別 | 中 |
| `src/scraper/pdf-downloader.ts` | User-Agent | `'TDnet-Data-Collector/1.0'` | PDFダウンロード識別 | 中 |

**識別情報の役割**:
- TDnetサーバーへのアクセス元識別
- ロボット検知回避
- 問題発生時の連絡先情報提供

**推奨対応**: 定数ファイル化（`src/constants/http-config.ts`）

---

### 5. レート制限設定

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/lambda/collector/scrape-tdnet-list.ts` | minDelayMs | `2000` (2秒) | TDnetへのリクエスト間隔制限 | 高 |
| `src/lambda/collector-fetch/handler.ts` | minDelayMs | `2000` (2秒) | TDnetへのリクエスト間隔制限 | 高 |

**ビジネスロジック根拠**:
- **2秒間隔**: TDnet APIの推奨レート制限（1リクエスト/秒の2倍の余裕）
- サーバー負荷軽減
- アクセス制限回避

**推奨対応**: 定数ファイル化（`src/constants/rate-limit-config.ts`）

---

### 6. 再試行設定

| ファイルパス | 項目 | 現在の値 | 使用目的 | 優先度 |
|-------------|------|---------|---------|--------|
| `src/utils/retry.ts` | maxRetries | `3` | 最大再試行回数 | 中 |
| `src/utils/retry.ts` | initialDelay | `2000` (2秒) | 初期遅延時間 | 中 |
| `src/utils/retry.ts` | backoffMultiplier | `2` | バックオフ倍率 | 中 |

**エラーハンドリング戦略**:
- **3回再試行**: 一時的なネットワークエラー対応
- **2秒初期遅延**: サーバー回復時間考慮
- **指数バックオフ**: 2秒 → 4秒 → 8秒（サンダリングハード回避）

**推奨対応**: 現状維持（ユーティリティのデフォルト値として妥当）

---

## テストコード内のハードコード

### 対応方針: 現状維持

テストコード内のハードコード値（URL、サイズ制限等）は以下の理由で現状維持を推奨:

1. **テストの可読性**: 定数化すると値が見えにくくなる
2. **テストの独立性**: 本番コードの定数変更がテストに影響しない
3. **境界値テスト**: 明示的な値でテストケースを記述

**例外**: 本番コードの定数を参照すべきケース
- 定数の整合性を検証するテスト
- 定数の変更に追従すべきテスト

---

## 対応方針の提案

### 優先度: 高（定数ファイル化推奨）

#### 1. ファイルサイズ制限

**新規ファイル**: `src/constants/file-size-limits.ts`

```typescript
/**
 * ファイルサイズ制限定数
 * 
 * TDnetから取得するPDFファイルのサイズ制限を定義。
 * ビジネスロジックに基づく制限値。
 */

/** PDFファイル最小サイズ（10KB） */
export const MIN_PDF_SIZE = 10 * 1024;

/** PDFファイル最大サイズ（50MB） */
export const MAX_PDF_SIZE = 50 * 1024 * 1024;

/** メタデータfile_size最大値（100MB） */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
```

**影響範囲**:
- `src/scraper/pdf-downloader.ts`: `validatePdfFile`関数
- `src/models/disclosure.ts`: `validateDisclosure`関数
- `src/validators/disclosure-schema.ts`: `fileSizeSchema`

#### 2. レート制限設定

**新規ファイル**: `src/constants/rate-limit-config.ts`

```typescript
/**
 * レート制限設定定数
 * 
 * TDnet APIへのリクエストレート制限を定義。
 * TDnet APIの推奨値に基づく。
 */

/** TDnetへのリクエスト最小間隔（2秒） */
export const TDNET_MIN_DELAY_MS = 2000;
```

**影響範囲**:
- `src/lambda/collector/scrape-tdnet-list.ts`: `RateLimiter`初期化
- `src/lambda/collector-fetch/handler.ts`: `RateLimiter`初期化

---

### 優先度: 中（定数ファイル化推奨）

#### 3. HTTP設定

**新規ファイル**: `src/constants/http-config.ts`

```typescript
/**
 * HTTP設定定数
 * 
 * HTTPリクエストのタイムアウトとUser-Agent設定。
 */

/** HTTPリクエストタイムアウト（30秒） */
export const HTTP_TIMEOUT_MS = 30000;

/** User-Agent文字列（フルバージョン） */
export const USER_AGENT_FULL = 'TDnet-Data-Collector/1.0 (https://github.com/your-org/tdnet-data-collector)';

/** User-Agent文字列（簡易バージョン） */
export const USER_AGENT_SHORT = 'TDnet-Data-Collector/1.0';
```

**影響範囲**:
- `src/lambda/collector/scrape-tdnet-list.ts`: `HTTP_TIMEOUT_MS`, `USER_AGENT`
- `src/lambda/collector-fetch/handler.ts`: `HTTP_TIMEOUT_MS`, `USER_AGENT`
- `src/scraper/pdf-downloader.ts`: `timeout`, `User-Agent`

---

### 優先度: 低（現状維持推奨）

#### 4. 外部API URL

**理由**:
- ✅ 環境変数フォールバック実装済み（`TDNET_BASE_URL`）
- ✅ CDKスタックで環境変数設定済み
- ✅ 公式URLをフォールバック値として使用（妥当性高い）

**推奨対応**: 現状維持

#### 5. 再試行設定

**理由**:
- ✅ `src/utils/retry.ts`のデフォルト値として定義済み
- ✅ エラーハンドリング戦略として妥当
- ✅ 各Lambda関数で必要に応じてオーバーライド可能

**推奨対応**: 現状維持

---

## 実装計画

### Phase 1: 定数ファイル作成（優先度: 高）

1. **ファイルサイズ制限定数**
   - [ ] `src/constants/file-size-limits.ts`作成
   - [ ] `src/scraper/pdf-downloader.ts`修正
   - [ ] `src/models/disclosure.ts`修正
   - [ ] `src/validators/disclosure-schema.ts`修正
   - [ ] ユニットテスト実行・確認

2. **レート制限設定定数**
   - [ ] `src/constants/rate-limit-config.ts`作成
   - [ ] `src/lambda/collector/scrape-tdnet-list.ts`修正
   - [ ] `src/lambda/collector-fetch/handler.ts`修正
   - [ ] ユニットテスト実行・確認

### Phase 2: 定数ファイル作成（優先度: 中）

3. **HTTP設定定数**
   - [ ] `src/constants/http-config.ts`作成
   - [ ] `src/lambda/collector/scrape-tdnet-list.ts`修正
   - [ ] `src/lambda/collector-fetch/handler.ts`修正
   - [ ] `src/scraper/pdf-downloader.ts`修正
   - [ ] ユニットテスト実行・確認

### Phase 3: ドキュメント更新

4. **関連ドキュメント更新**
   - [ ] `README.md`に定数ファイルの説明追加
   - [ ] `.kiro/steering/development/tdnet-scraping-patterns.md`更新
   - [ ] `.kiro/steering/core/tdnet-implementation-rules.md`更新

---

## 成果物

- ✅ 外部API URLのハードコード箇所特定（2箇所）
- ✅ ファイルサイズ制限のハードコード箇所特定（4箇所）
- ✅ タイムアウト設定のハードコード箇所特定（3箇所）
- ✅ User-Agent設定のハードコード箇所特定（3箇所）
- ✅ レート制限設定のハードコード箇所特定（2箇所）
- ✅ 再試行設定のハードコード箇所特定（1箇所）
- ✅ 対応方針の提案（優先度付き）
- ✅ 実装計画の作成

---

## 申し送り事項

### 次のタスクへの引き継ぎ

1. **Phase 1実装時の注意点**:
   - ファイルサイズ制限定数は3箇所で使用されているため、整合性を保つこと
   - レート制限設定は2箇所で同じ値を使用しているため、定数化により一元管理すること

2. **テストコードの扱い**:
   - テストコード内のハードコード値は現状維持を推奨
   - 定数の整合性を検証するテストケースを追加することを検討

3. **環境変数の扱い**:
   - `TDNET_BASE_URL`は既に環境変数対応済みのため、追加対応不要
   - 新規定数ファイルは環境変数化せず、コード内定数として管理

4. **ドキュメント更新**:
   - 定数ファイル作成後、関連ドキュメントを更新すること
   - 特に`tdnet-scraping-patterns.md`と`tdnet-implementation-rules.md`の更新が重要

---

## 関連ファイル

- `tasks-hardcoded-values-improvement.md`: タスク定義
- `src/lambda/collector/scrape-tdnet-list.ts`: TDnet一覧スクレイピング
- `src/lambda/collector-fetch/handler.ts`: TDnet一覧フェッチ
- `src/scraper/pdf-downloader.ts`: PDFダウンロード
- `src/models/disclosure.ts`: Disclosureモデル
- `src/validators/disclosure-schema.ts`: Zodスキーマ
- `src/utils/rate-limiter.ts`: レート制限ユーティリティ
- `src/utils/retry.ts`: 再試行ユーティリティ

# 品質チェック: Dashboard PDF生成機能

作成日時: 2026-02-22 08:56:07

## チェック結果

### PDF生成機能
- **実装状況**: ❌ 未実装
- **使用ライブラリ**: なし
- **問題点**: 
  - PDF生成ライブラリ（jsPDF、pdfmake等）がpackage.jsonに含まれていない
  - PDF生成機能のコンポーネントやユーティリティが存在しない
  - 開示情報からPDFを生成する機能は実装されていない

### PDFダウンロード機能
- **実装状況**: ✅ 実装済み
- **実装ファイル**:
  - `dashboard/src/components/PdfDownload.tsx` - PDFダウンロードボタンコンポーネント
  - `dashboard/src/services/api.ts` - `getPdfDownloadUrl()` API関数
  - `dashboard/src/components/__tests__/PdfDownload.test.tsx` - ユニットテスト
- **機能詳細**:
  - 署名付きURLを取得してPDFをダウンロード
  - ローディング状態表示
  - エラーハンドリング（Snackbarでエラー表示）
  - Material-UIコンポーネント使用
- **問題点**: 
  - E2Eテストに含まれていない
  - DisclosureListコンポーネントで使用されていない（直接リンクのみ）

### PDF表示機能
- **実装状況**: ⚠️ 部分実装
- **実装ファイル**:
  - `dashboard/src/components/DisclosureList.tsx` - PDF URLへの直接リンク表示
  - `dashboard/src/types/disclosure.ts` - `pdf_url`フィールド定義
- **機能詳細**:
  - `pdf_url`フィールドを使用してPDFアイコンとリンクを表示
  - 新しいタブでPDFを開く（`target="_blank"`）
  - モバイル・デスクトップ両対応
- **問題点**:
  - PDFビューアー機能なし（外部リンクのみ）
  - PdfDownloadコンポーネントが統合されていない
  - プレビュー機能なし

## 総合評価
⚠️ **部分実装 - 改善が必要**

### 実装状況サマリー
| 機能 | 状態 | 優先度 |
|------|------|--------|
| PDF生成 | ❌ 未実装 | 低（要件次第） |
| PDFダウンロード | ✅ 実装済み | - |
| PDF表示（リンク） | ✅ 実装済み | - |
| PDFビューアー | ❌ 未実装 | 中 |
| E2Eテスト | ❌ 未実装 | 高 |
| コンポーネント統合 | ⚠️ 部分的 | 高 |

## 改善推奨

### 1. PdfDownloadコンポーネントの統合 - 優先度: 高
**現状**: PdfDownloadコンポーネントが実装されているが、DisclosureListで使用されていない

**推奨対応**:
```typescript
// DisclosureList.tsx内で使用
import PdfDownload from './PdfDownload';

// テーブルセル内
<TableCell align="center">
  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
    {disclosure.pdf_url && (
      <PdfDownload 
        disclosureId={disclosure.disclosure_id}
        fileName={`${disclosure.company_code}_${disclosure.title}.pdf`}
      />
    )}
  </Box>
</TableCell>
```

### 2. E2Eテストの追加 - 優先度: 高
**現状**: PDFダウンロード機能のE2Eテストが存在しない

**推奨対応**:
- `dashboard/src/__tests__/e2e/pdf-download.spec.ts`を作成
- テストケース:
  - PDFダウンロードボタンの表示確認
  - ダウンロードボタンクリック時のAPI呼び出し確認
  - 署名付きURL取得の確認
  - エラーハンドリングの確認

### 3. PDF生成機能の実装検討 - 優先度: 低
**現状**: PDF生成機能は未実装

**推奨対応**（要件次第）:
- ライブラリ選定: jsPDF、pdfmake、react-pdf等
- 用途明確化:
  - 開示情報の一覧をPDF化？
  - 検索結果をPDF化？
  - レポート生成？
- 実装前に要件確認が必要

### 4. PDFビューアーの実装検討 - 優先度: 中
**現状**: 外部リンクでPDFを開くのみ

**推奨対応**（UX改善）:
- ライブラリ選定: react-pdf、pdfjs-dist等
- モーダルまたは専用ページでPDFプレビュー表示
- ページナビゲーション、ズーム機能

### 5. API統合の確認 - 優先度: 中
**現状**: `/disclosures/{disclosureId}/pdf`エンドポイントの実装状況不明

**推奨対応**:
- Lambda関数`get-disclosure`でPDF署名付きURL生成機能の確認
- S3バケットからのPDF取得フローの確認
- エラーハンドリングの確認

## 関連ファイル

### 実装済み
- `dashboard/src/components/PdfDownload.tsx` - PDFダウンロードコンポーネント
- `dashboard/src/components/__tests__/PdfDownload.test.tsx` - ユニットテスト
- `dashboard/src/components/DisclosureList.tsx` - PDF表示（リンク）
- `dashboard/src/services/api.ts` - API関数
- `dashboard/src/types/disclosure.ts` - 型定義

### 未実装
- `dashboard/src/__tests__/e2e/pdf-download.spec.ts` - E2Eテスト（要作成）
- PDF生成関連ファイル（要件次第）
- PDFビューアー関連ファイル（要件次第）

## 次のアクション
1. PdfDownloadコンポーネントをDisclosureListに統合
2. E2Eテストの作成
3. API統合の確認（Lambda関数側）
4. PDF生成・ビューアー機能の要件確認

## 申し送り
- PDFダウンロード機能は実装済みだが、UIに統合されていない
- E2Eテストが不足しているため、統合テストの追加が必要
- PDF生成機能は要件が不明確なため、実装前に確認が必要

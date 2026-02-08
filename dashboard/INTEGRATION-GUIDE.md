# ダッシュボードコンポーネント統合ガイド

## 概要

Task 17.4-17.6で実装した3つのコンポーネントを既存のダッシュボードに統合するためのガイドです。

## 実装済みコンポーネント

### 1. PdfDownload（Task 17.4）
**ファイル**: `src/components/PdfDownload.tsx`

**用途**: 開示情報のPDFをダウンロード

**使用例**:
```tsx
import PdfDownload from './components/PdfDownload';

<PdfDownload 
  disclosureId="TD20240115001" 
  fileName="開示資料.pdf" 
/>
```

**Props**:
- `disclosureId` (string, 必須): 開示ID
- `fileName` (string, オプション): ダウンロードファイル名

**統合先**: `DisclosureList.tsx`の各行に追加

### 2. ExportDialog（Task 17.5）
**ファイル**: `src/components/ExportDialog.tsx`

**用途**: 開示情報のエクスポート（CSV/JSON）

**使用例**:
```tsx
import { useState } from 'react';
import ExportDialog from './components/ExportDialog';
import { Button } from '@mui/material';

function MyComponent() {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setExportOpen(true)}>
        エクスポート
      </Button>
      
      <ExportDialog 
        open={exportOpen} 
        onClose={() => setExportOpen(false)} 
      />
    </>
  );
}
```

**Props**:
- `open` (boolean, 必須): ダイアログの開閉状態
- `onClose` (function, 必須): 閉じる時のコールバック

**統合先**: `Home.tsx`または`SearchFilter.tsx`にエクスポートボタンを追加

### 3. ExecutionStatus（Task 17.6）
**ファイル**: `src/components/ExecutionStatus.tsx`

**用途**: 収集実行の進捗表示

**使用例**:
```tsx
import ExecutionStatus from './components/ExecutionStatus';

<ExecutionStatus 
  executionId="exec-123"
  onComplete={() => console.log('収集完了')}
  onError={(error) => console.error('収集エラー:', error)}
/>
```

**Props**:
- `executionId` (string, 必須): 実行ID
- `onComplete` (function, オプション): 完了時のコールバック
- `onError` (function, オプション): エラー時のコールバック

**統合先**: 新しいページ（`CollectionStatus.tsx`）を作成するか、`Home.tsx`に追加

## 統合手順

### Step 1: DisclosureListにPdfDownloadを追加

`src/components/DisclosureList.tsx`を編集:

```tsx
import PdfDownload from './PdfDownload';

// テーブルの各行に追加
<TableCell>
  <PdfDownload 
    disclosureId={disclosure.disclosure_id}
    fileName={`${disclosure.company_name}_${disclosure.title}.pdf`}
  />
</TableCell>
```

### Step 2: HomeまたはSearchFilterにエクスポートボタンを追加

`src/pages/Home.tsx`を編集:

```tsx
import { useState } from 'react';
import ExportDialog from '../components/ExportDialog';
import { Button } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

function Home() {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <Container>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">TDnet開示情報</Typography>
        <Button
          variant="contained"
          startIcon={<FileDownloadIcon />}
          onClick={() => setExportOpen(true)}
        >
          エクスポート
        </Button>
      </Box>

      {/* 既存のコンポーネント */}
      <SearchFilter onSearch={handleSearch} />
      <DisclosureList disclosures={disclosures} />

      {/* エクスポートダイアログ */}
      <ExportDialog 
        open={exportOpen} 
        onClose={() => setExportOpen(false)} 
      />
    </Container>
  );
}
```

### Step 3: 収集実行状態ページを作成（オプション）

`src/pages/CollectionStatus.tsx`を新規作成:

```tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Container, Typography, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExecutionStatus from '../components/ExecutionStatus';

function CollectionStatus() {
  const { executionId } = useParams<{ executionId: string }>();
  const navigate = useNavigate();

  const handleComplete = () => {
    console.log('収集完了');
    // 必要に応じて通知を表示
  };

  const handleError = (error: string) => {
    console.error('収集エラー:', error);
    // 必要に応じてエラー通知を表示
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
        >
          戻る
        </Button>
      </Box>

      <Typography variant="h4" gutterBottom>
        収集実行状態
      </Typography>

      {executionId && (
        <ExecutionStatus
          executionId={executionId}
          onComplete={handleComplete}
          onError={handleError}
        />
      )}
    </Container>
  );
}

export default CollectionStatus;
```

ルーティングを追加（`src/App.tsx`）:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CollectionStatus from './pages/CollectionStatus';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collection/:executionId" element={<CollectionStatus />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## テストの実行

```bash
cd dashboard
npm test -- --coverage
```

各コンポーネントのテストファイル:
- `src/components/__tests__/PdfDownload.test.tsx` (5テスト)
- `src/components/__tests__/ExportDialog.test.tsx` (8テスト)
- `src/components/__tests__/ExecutionStatus.test.tsx` (9テスト)

## API依存関係

これらのコンポーネントは以下のAPIエンドポイントに依存しています:

1. **GET /disclosures/{disclosure_id}/pdf** - PDFの署名付きURL取得
2. **POST /exports** - エクスポートジョブ作成
3. **GET /exports/{export_id}** - エクスポート状態取得
4. **GET /collect/{execution_id}** - 収集実行状態取得

APIが実装されていない場合、モックサーバーを使用してテストできます。

## 環境変数

`.env`ファイルに以下を設定:

```env
REACT_APP_API_URL=http://localhost:4566
REACT_APP_API_KEY=your-api-key-here
```

## 注意事項

1. **ポーリング処理**: ExportDialogとExecutionStatusは5秒間隔でAPIをポーリングします
2. **クリーンアップ**: コンポーネントのアンマウント時に自動的にポーリングを停止します
3. **エラーハンドリング**: すべてのAPI呼び出しにエラーハンドリングが実装されています
4. **Material-UI**: すべてのコンポーネントはMaterial-UIを使用しています

## 次のステップ

1. コンポーネントを既存のページに統合
2. 統合テストの実行
3. UIの調整（色、レイアウト、レスポンシブ対応）
4. APIエンドポイントの実装確認
5. E2Eテストの実施（Task 17.9）

## トラブルシューティング

### ポーリングが停止しない
- useEffectのクリーンアップ関数が正しく実行されているか確認
- コンポーネントのアンマウント時にclearIntervalが呼ばれているか確認

### APIエラーが発生する
- 環境変数（REACT_APP_API_URL、REACT_APP_API_KEY）が正しく設定されているか確認
- APIエンドポイントが実装されているか確認
- CORSの設定を確認

### テストが失敗する
- jest.useFakeTimers()とjest.useRealTimers()が正しく使用されているか確認
- APIモックが正しく設定されているか確認

## 参考資料

- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260208-210658-task17-4-6-dashboard-features.md`
- タスク定義: `.kiro/specs/tdnet-data-collector/tasks.md` (Task 17.4-17.6)

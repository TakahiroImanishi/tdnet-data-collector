# Dashboard テスト失敗原因分析レポート

**作成日時**: 2026-02-09  
**対象テスト**: ExecutionStatus.test.tsx, PdfDownload.test.tsx  
**現在の成功率**: ExecutionStatus (8/9 = 89%), PdfDownload (3/5 = 60%)

---

## 📊 テスト結果サマリー

### ExecutionStatus.test.tsx
- **成功**: 8/9 (89%)
- **失敗**: 1/9 (11%)
- **失敗テスト**: "完了後はポーリングを停止する"

### PdfDownload.test.tsx
- **成功**: 3/5 (60%)
- **失敗**: 2/5 (40%)
- **失敗テスト**: 
  1. "ダウンロードボタンクリック時に署名付きURLを取得する"
  2. "ダウンロード中はボタンが無効化される"

---

## 🔍 詳細分析

## 1. ExecutionStatus: "完了後はポーリングを停止する" (失敗)

### 🐛 エラー内容
```
expect(jest.fn()).toHaveBeenCalledTimes(expected)
Expected number of calls: 2
Received number of calls: 4
```

### 📝 原因分析

#### 根本原因の特定

**期待2回 → 実測4回という"ちょうど2倍"のズレ**は、典型的に以下を示唆：
- インターバルが2本走っている
- または`fetchStatus`が2回ずつ起きている（二重化）

テストコードは以下の流れを期待：
1. 初回API呼び出し（running状態）→ 呼び出し回数: 1
2. 5秒後のポーリング（completed状態）→ 呼び出し回数: 2
3. さらに5秒後（ポーリング停止を確認）→ 呼び出し回数: 2（増えない）

しかし実際には4回呼び出されている。

#### 根本原因（優先順位順）

##### 第一候補（最有力）：React 18 StrictMode / 依存配列による useEffect 多重実行
**問題箇所**: `ExecutionStatus.tsx` の `useEffect`

```typescript
useEffect(() => {
  // ... fetchStatus定義
  
  fetchStatus(); // 初回実行
  
  pollInterval = setInterval(() => {
    if (status !== 'completed' && status !== 'failed') {
      fetchStatus();
    }
  }, 5000);
  
  return () => {
    if (pollInterval) clearInterval(pollInterval);
  };
}, [executionId, status, onComplete, onError]); // ← status が依存配列に含まれている
```

**問題点**:
1. **StrictMode**: 開発環境では`useEffect`が2回実行される（mount → unmount → remount）
2. **依存配列に`status`を含む**: `status`が変更されるたびに`useEffect`が再実行される
3. **インターバル多重生成**: 各実行で新しい`setInterval`が生成されるが、前のインターバルのクリーンアップが不完全
4. **結果**: 複数のインターバルが同時に動作し、API呼び出しが多重化

**証拠**:
- 呼び出し回数が"ちょうど2倍"（2本のインターバルが並走）
- StrictModeは開発環境でデフォルト有効

##### 第二候補（併発しやすい）：クロージャで古い status を参照

```typescript
pollInterval = setInterval(() => {
  if (status !== 'completed' && status !== 'failed') { // ← クロージャで古いstatusを参照
    fetchStatus();
  }
}, 5000);
```

**問題点**:
- `setInterval`のコールバック内の`status`は、インターバル設定時の値をキャプチャ
- `status`が`completed`に更新されても、既存のインターバルは古い`status`値を参照し続ける
- 結果: `completed`後もポーリングが継続する可能性

**注意**: この問題単体だと"止まらない方向へじわじわ増える"症状になりやすいが、今回の"2倍"という明確なズレとは異なる。

##### 補助要因：fake timers の進め方 / マイクロタスクフラッシュ不足

```typescript
await act(async () => {
  jest.advanceTimersByTime(5000);
});
```

**問題点**:
- `advanceTimersByTime`後にマイクロタスク（Promise）がフラッシュされない
- 非同期の状態更新が完了する前に次のアサーションが実行される
- 結果: 観測タイミングのズレによる不安定なテスト

#### 技術的詳細：多重インターバル vs クロージャ問題

これらは**別の問題**として理解すべき：

**多重インターバル問題**:
- `useEffect`が複数回実行されることで、`setInterval`が複数回呼ばれる
- 各インターバルが独立して動作し、API呼び出しが多重化
- 症状: 呼び出し回数が期待の整数倍になる

**クロージャ問題**:
- 1本のインターバル内で参照している`status`が古い
- 状態更新後も古い値を参照し続ける
- 症状: 停止すべきタイミングで停止しない

#### 再現条件
- React 18のStrictモード有効（開発環境デフォルト）
- `useEffect`の依存配列に`status`を含む
- `jest.useFakeTimers()`使用
- 複数回の`jest.advanceTimersByTime()`呼び出し

### 💡 推奨修正案

#### オプション1: useRefでインターバルIDを管理 + 二重呼び出し防止（推奨）

```typescript
const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
const inFlightRef = useRef(false); // 二重呼び出し防止
const isMountedRef = useRef(true); // unmount後のsetState防止

useEffect(() => {
  isMountedRef.current = true;
  
  // 既存のインターバルをクリア（多重生成防止）
  if (pollIntervalRef.current) {
    clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
  }

  const fetchStatus = async () => {
    // 二重呼び出し防止
    if (inFlightRef.current) {
      return;
    }
    
    inFlightRef.current = true;
    
    try {
      const response = await getCollectionStatus(executionId);
      
      // unmount後はsetStateしない
      if (!isMountedRef.current) return;
      
      if (response.success) {
        const data = response.data;
        
        setStatus(data.status);
        setProgress(data.progress);
        // ... その他の状態更新
        
        // 完了時にインターバルをクリア
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          
          // コールバック実行
          if (data.status === 'completed' && onComplete) {
            onComplete();
          } else if (data.status === 'failed' && onError) {
            onError(data.error_message || '収集に失敗しました');
          }
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      
      console.error('Collection status fetch error:', err);
      setErrorMessage('実行状態の取得に失敗しました');
      setStatus('failed');
      
      // エラー時もインターバルをクリア
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (onError) {
        onError('実行状態の取得に失敗しました');
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  fetchStatus(); // 初回実行

  // ポーリング開始
  pollIntervalRef.current = setInterval(fetchStatus, 5000);

  return () => {
    isMountedRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };
}, [executionId, onComplete, onError]); // statusを依存配列から削除
```

**この修正のポイント**:
1. **`useRef`でインターバルID管理**: 多重生成を防止
2. **`inFlightRef`で二重呼び出し防止**: 前回のAPI呼び出しが完了していない場合はスキップ（5秒ごとに前回が終わってない場合の並列実行を防止）
3. **`isMountedRef`でunmount後のsetState防止**: メモリリーク防止（AbortControllerの代替）
4. **依存配列から`status`を削除**: `useEffect`の再実行を最小化
5. **cleanup関数で確実にクリア**: StrictModeでも安全

#### オプション2: 状態ベースのポーリング制御（非推奨）

```typescript
useEffect(() => {
  if (status === 'completed' || status === 'failed') {
    return; // ポーリング不要
  }

  const pollIntervalId = setInterval(fetchStatus, 5000);
  
  return () => clearInterval(pollIntervalId);
}, [status, executionId]);
```

**非推奨の理由**:
- `status`変更のたびに`useEffect`が再実行され、インターバルが張り替えられる
- cleanupが走るまでに次のtickが実行される可能性がある
- StrictModeで不安定になりやすい（mount/unmount/remountのたびに再実行）
- 実装次第で多重インターバルが発生しやすい

### 🔬 問題の確認方法（デバッグ手順）

修正前に以下を確認すると、問題の特定が確実になります：

#### 1. インターバル生成回数の確認
```typescript
// テストコード内
const setIntervalSpy = jest.spyOn(global, 'setInterval');
const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

// テスト実行後
console.log('setInterval called:', setIntervalSpy.mock.calls.length);
console.log('clearInterval called:', clearIntervalSpy.mock.calls.length);
```

**期待値**: StrictModeで2回、通常モードで1回

#### 2. StrictModeの影響確認
```typescript
// テスト環境でStrictModeを無効化して再実行
// index.tsx または App.tsx
<React.StrictMode>  // ← これをコメントアウト
  <App />
</React.StrictMode>
```

**期待結果**: StrictMode無効で問題が解消すれば、多重実行が原因

#### 3. fetchStatus呼び出し回数のログ
```typescript
// ExecutionStatus.tsx内
const fetchStatus = async () => {
  console.log('[DEBUG] fetchStatus called at', new Date().toISOString());
  // ... 既存のロジック
};
```

**観測ポイント**: 5秒ごとに2回ずつ呼ばれていないか確認

---

## 2. PdfDownload: DOM操作関連テスト (2件失敗)

### 🐛 エラー内容
```
TypeError: nextResource.appendChild is not a function
```

### 📝 原因分析

#### 根本原因の正確な理解

**エラーの本質**: `document.createElement`を全面的にモックしたことで、Reactが必要とする通常のDOMノードまでプレーンオブジェクト化され、`appendChild`メソッドが存在しなくなった。

**誤解されやすいポイント**: 
- ❌ 「Reactが`<a>`タグに`appendChild`を期待している」ではない
- ✅ 「createElementの全面モックにより、ReactがDOMノードとして扱う要素までプレーンオブジェクト化され、commitフェーズで`appendChild`できずに落ちた」

#### 技術的詳細

**エラー発生箇所**: `fireEvent.click(button)`実行時

**エラースタック**:
```
at completeWork (react-dom-client.development.js:12638:32)
at completeUnitOfWork (react-dom-client.development.js:17777:19)
at performUnitOfWork (react-dom-client.development.js:17658:11)
```

**問題の流れ**:
1. テストコードで`document.createElement`を全面的にモック
2. Reactのレンダリング中に、通常のDOM要素（`div`, `button`など）も生成される
3. モックが返すプレーンオブジェクトには`appendChild`などのDOMメソッドが存在しない
4. ReactのcommitフェーズでDOM操作を試みた際に`appendChild is not a function`エラー

**現在のテストコードの問題**:
```typescript
const mockLink = { 
  click: jest.fn(), 
  href: '', 
  download: '', 
  target: '', 
  style: {} 
};
const createElementSpy = jest.spyOn(document, 'createElement')
  .mockReturnValue(mockLink as any); // ← すべての要素がこのオブジェクトになる
```

#### 影響範囲
- "ダウンロードボタンクリック時に署名付きURLを取得する"
- "ダウンロード中はボタンが無効化される"

両方とも`fireEvent.click(button)`を実行するテストで失敗。

### 💡 推奨修正案

#### オプション1: 完全なHTMLAnchorElementモック + 無限再帰防止（推奨）

```typescript
it('ダウンロードボタンクリック時に署名付きURLを取得する', async () => {
  const mockUrl = 'https://s3.amazonaws.com/bucket/file.pdf?signature=xxx';
  jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
    success: true,
    data: { url: mockUrl, expires_in: 3600 },
  });

  // 実際のHTMLAnchorElementを使用
  const mockLink = document.createElement('a');
  const clickSpy = jest.spyOn(mockLink, 'click').mockImplementation(() => {});
  
  // 無限再帰を防ぐため、元のcreateElementを保存
  const originalCreateElement = document.createElement.bind(document);
  
  const createElementSpy = jest.spyOn(document, 'createElement')
    .mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockLink;
      }
      // 他の要素は通常通り生成（無限再帰防止）
      return originalCreateElement(tagName);
    });

  render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
  
  const button = screen.getByRole('button', { name: /PDFダウンロード/i });
  fireEvent.click(button);

  await waitFor(() => {
    expect(api.getPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
    expect(clickSpy).toHaveBeenCalled();
    expect(mockLink.href).toBe(mockUrl);
    expect(mockLink.download).toBe(mockFileName);
  });

  // 必ずrestoreする（グローバルモックの漏れ防止）
  createElementSpy.mockRestore();
});
```

**重要な修正ポイント**:
1. **`originalCreateElement`の保存**: 無限再帰を防止
2. **`tagName === 'a'`の条件分岐**: `<a>`タグのみモック、他は通常生成
3. **`mockRestore()`の確実な実行**: グローバルモックの漏れ防止（他テストへの影響回避）

**⚠️ 危険なパターン（無限再帰）**:
```typescript
// ❌ これは無限再帰になる
jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
  if (tagName === 'a') return mockLink;
  return document.createElement(tagName); // ← mockが呼ばれて無限再帰
});
```

#### オプション2: userEvent使用（より実際のユーザー操作に近い）

```typescript
import userEvent from '@testing-library/user-event';

it('ダウンロードボタンクリック時に署名付きURLを取得する', async () => {
  const user = userEvent.setup();
  const mockUrl = 'https://s3.amazonaws.com/bucket/file.pdf?signature=xxx';
  
  jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
    success: true,
    data: { url: mockUrl, expires_in: 3600 },
  });

  const mockLink = document.createElement('a');
  const clickSpy = jest.spyOn(mockLink, 'click').mockImplementation(() => {});
  
  const originalCreateElement = document.createElement.bind(document);
  const createElementSpy = jest.spyOn(document, 'createElement')
    .mockImplementation((tagName) => {
      if (tagName === 'a') return mockLink;
      return originalCreateElement(tagName);
    });

  render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
  
  const button = screen.getByRole('button', { name: /PDFダウンロード/i });
  await user.click(button); // fireEventより実際のユーザー操作に近い

  await waitFor(() => {
    expect(api.getPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
    expect(clickSpy).toHaveBeenCalled();
  });
  
  createElementSpy.mockRestore();
});
```

**userEventの利点**:
- より実際のユーザー操作に近い（イベントの順序、タイミング）
- 非同期処理の扱いが自然
- React 18との互換性が高い

#### オプション3: テスト対象コードのリファクタリング（最も保守性が高い）

**実装コードの変更**:
```typescript
// PdfDownload.tsx
const handleDownload = async () => {
  setLoading(true);
  setError(null);

  try {
    const response = await getPdfDownloadUrl(disclosureId);
    
    if (response.success && response.data.url) {
      // ダウンロード処理を別関数に分離
      downloadFile(response.data.url, fileName || `${disclosureId}.pdf`);
    } else {
      throw new Error('PDFのURLを取得できませんでした');
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'PDFのダウンロードに失敗しました';
    setError(errorMessage);
  } finally {
    setLoading(false);
  }
};

// テスト可能な純粋関数として分離（exportして別ファイルでも可）
export const downloadFile = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

**テストコード**:
```typescript
import * as PdfDownloadModule from '../PdfDownload';

jest.spyOn(PdfDownloadModule, 'downloadFile').mockImplementation(() => {});

it('ダウンロードボタンクリック時に署名付きURLを取得する', async () => {
  const mockUrl = 'https://s3.amazonaws.com/bucket/file.pdf?signature=xxx';
  jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
    success: true,
    data: { url: mockUrl, expires_in: 3600 },
  });

  render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
  
  const button = screen.getByRole('button', { name: /PDFダウンロード/i });
  fireEvent.click(button);

  await waitFor(() => {
    expect(api.getPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
    expect(PdfDownloadModule.downloadFile).toHaveBeenCalledWith(mockUrl, mockFileName);
  });
});
```

**オプション3の利点**:
- **DOM実装依存を排除**: テストが「振る舞い」に集中
- **保守性向上**: JSDOMの差異やReact更新で壊れにくい
- **テスト範囲の明確化**: UIテストは「API呼び出しとボタンdisabled/ローディング表示」に集中
- **RTLの推奨に沿う**: 実装詳細ではなく振る舞いをテスト

### 🔬 ボタン無効化テストの観測対象

「ダウンロード中はボタンが無効化」テストでは、DOM落ちの前に以下を確認すべき：

```typescript
it('ダウンロード中はボタンが無効化される', async () => {
  let resolvePromise: any;
  const mockPromise = new Promise((resolve) => {
    resolvePromise = resolve;
  });
  
  jest.spyOn(api, 'getPdfDownloadUrl').mockReturnValue(mockPromise as any);
  jest.spyOn(PdfDownloadModule, 'downloadFile').mockImplementation(() => {});

  render(<PdfDownload disclosureId={mockDisclosureId} />);
  
  const button = screen.getByRole('button');
  
  // 初期状態: 有効
  expect(button).not.toBeDisabled();
  expect(screen.getByText(/PDFダウンロード/i)).toBeInTheDocument();
  
  fireEvent.click(button);

  // ダウンロード中: 無効化 + ローディング表示
  await waitFor(() => {
    expect(button).toBeDisabled();
    expect(screen.getByText(/ダウンロード中/i)).toBeInTheDocument();
  });
  
  // API完了後: 有効に戻る
  act(() => {
    resolvePromise({ success: true, data: { url: 'http://test.com/file.pdf', expires_in: 3600 } });
  });
  
  await waitFor(() => {
    expect(button).not.toBeDisabled();
    expect(screen.getByText(/PDFダウンロード/i)).toBeInTheDocument();
  });
});
```

**観測軸**:
1. クリック直後に`disabled=true`になる
2. ローディング表示が出る
3. API完了後に`disabled=false`に戻る
4. エラー時も戻る + エラーメッセージ表示

---

## 3. 副次的な問題: React act() 警告

### ⚠️ 警告内容
```
console.error
  An update to ExecutionStatus inside a test was not wrapped in act(...)
```

### 📝 原因
非同期の状態更新が`act()`でラップされていない、またはマイクロタスクがフラッシュされていない。

### 💡 修正案

#### fake timers + async の正しい扱い

```typescript
it('5秒間隔でポーリングする', async () => {
  const mockGetCollectionStatus = jest.spyOn(api, 'getCollectionStatus');
  
  mockGetCollectionStatus.mockResolvedValueOnce({
    success: true,
    data: { /* ... */ },
  });

  render(<ExecutionStatus executionId={mockExecutionId} />);

  // 初回呼び出し
  await waitFor(() => {
    expect(mockGetCollectionStatus).toHaveBeenCalledTimes(1);
  });

  // 5秒後のポーリング（正しい順序）
  await act(async () => {
    jest.advanceTimersByTime(5000);
    await Promise.resolve(); // マイクロタスクキューをフラッシュ
  });

  await waitFor(() => {
    expect(mockGetCollectionStatus).toHaveBeenCalledTimes(2);
  });
});
```

**重要なポイント**:
1. **`advanceTimersByTime` → `await Promise.resolve()`の順を守る**
2. **マイクロタスク（Promise）のフラッシュが必須**
3. **`act()`で非同期処理をラップ**

#### userEvent.setup with advanceTimers（環境による）

```typescript
const user = userEvent.setup({ 
  advanceTimers: jest.advanceTimersByTime 
});
```

**注意**: Jest環境によっては動作しない場合がある。

---

## 📋 修正優先度

### 🔴 最優先（即座に修正推奨）
**1. PdfDownload DOM操作モック** - 2件のテスト失敗の原因
- **推奨**: オプション1（完全なHTMLAnchorElementモック + 無限再帰防止）
- **理由**: 最小限の変更で修正可能、即効性が高い
- **注意**: `originalCreateElement`の保存と`mockRestore()`の確実な実行が必須

### 🟡 高優先度（次回修正推奨）
**2. ExecutionStatus ポーリング停止** - 1件のテスト失敗
- **推奨**: オプション1（useRefでインターバルID管理 + 二重呼び出し防止）
- **理由**: より堅牢なポーリング制御が可能、StrictModeでも安全
- **効果**: 多重インターバル生成を根本的に防止

### 🟢 中優先度（時間があれば）
**3. React act() 警告** - テスト実行時の警告
- **推奨**: `advanceTimersByTime` → `await Promise.resolve()`の順序を守る
- **理由**: 機能には影響しないが、テストの信頼性向上
- **効果**: 非同期処理の観測タイミングが安定

### 🔵 低優先度（長期的改善）
**4. テスト対象コードのリファクタリング**
- **推奨**: PdfDownloadの`downloadFile`関数を分離（オプション3）
- **理由**: DOM実装依存を排除、保守性向上
- **効果**: テストが「振る舞い」に集中、React更新で壊れにくい

---

## 🎯 期待される修正後の成功率

### 修正前
- ExecutionStatus: 8/9 (89%)
- PdfDownload: 3/5 (60%)
- **合計**: 11/14 (79%)

### 修正後（予測）
- ExecutionStatus: 9/9 (100%)
- PdfDownload: 5/5 (100%)
- **合計**: 14/14 (100%)

## 🌐 CI/ローカル環境差分の考慮

### なぜ差が出るか

#### 1. StrictMode設定の差
- **ローカル**: 開発環境でStrictMode有効（デフォルト）
- **CI**: 設定によってはStrictMode無効の可能性
- **影響**: `useEffect`の実行回数が異なる（2回 vs 1回）

#### 2. Node/JSDOMバージョン差
- **ローカル**: `package.json`のバージョン
- **CI**: キャッシュされた古いバージョンの可能性
- **影響**: DOM APIの挙動が微妙に異なる

#### 3. タイマー解像度の差
- **fake timersのモード**: `modern` vs `legacy`
- **`setInterval`の扱い**: 環境によって微妙に異なる
- **影響**: ポーリングのタイミングがズレる

#### 4. テスト並列実行によるグローバルモックの漏れ
- **問題**: `document.createElement`のspyが他テストに影響
- **原因**: `mockRestore()`の実行漏れ
- **影響**: 予期しないテスト失敗

### 対策

#### グローバルモックは必ず restore
```typescript
afterEach(() => {
  jest.restoreAllMocks(); // すべてのspyをリストア
});

// または個別に
it('test', () => {
  const spy = jest.spyOn(document, 'createElement');
  // ... テスト
  spy.mockRestore(); // 必ず実行
});
```

#### CI環境でのStrictMode確認
```typescript
// CI用の設定ファイルで確認
// .github/workflows/test.yml
env:
  NODE_ENV: test
  REACT_APP_STRICT_MODE: true
```

#### fake timersのモード統一
```typescript
// jest.config.js
module.exports = {
  timers: 'modern', // または 'legacy'
};
```

### React Testing Library ベストプラクティス
- [Testing Library - Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [React Testing Library - act()](https://react.dev/link/wrap-tests-with-act)
- [Jest - Timer Mocks](https://jestjs.io/docs/timer-mocks)

### 関連Issue
- React 18 Strict Mode: https://react.dev/reference/react/StrictMode
- Testing Library userEvent: https://testing-library.com/docs/user-event/intro

---

## ✅ レビュー依頼事項

### 確認してほしいポイント
1. **ExecutionStatus ポーリングロジック**: 現在の実装で`useEffect`の依存配列に`status`を含めるべきか？
2. **PdfDownload DOM操作**: オプション1（モック改善）とオプション3（リファクタリング）のどちらが望ましいか？
3. **テスト戦略**: 統合テスト（E2E）でカバーすべき範囲はどこまでか？

### 追加調査が必要な項目
- React 18のStrictモードがポーリングロジックに与える影響の詳細
- `document.createElement`モックのベストプラクティス
- CI/CD環境でのテスト実行時の挙動（ローカルとの差異）

---

**作成者**: Kiro AI Assistant  
**レビュー依頼先**: 開発チーム  
**次のアクション**: 修正案の承認後、実装とテスト実行


### 確認してほしいポイント

#### 1. ExecutionStatus ポーリングロジック
- **質問**: 現在の実装で`useEffect`の依存配列に`status`を含めるべきか？
- **背景**: `status`を含めると再実行が頻繁になるが、含めないとクロージャ問題が残る可能性
- **推奨**: 依存配列から削除し、`useRef`で管理（オプション1）

#### 2. PdfDownload DOM操作
- **質問**: オプション1（モック改善）とオプション3（リファクタリング）のどちらが望ましいか？
- **オプション1の利点**: 即効性、最小限の変更
- **オプション3の利点**: 保守性、テストの安定性、RTLの推奨に沿う
- **推奨**: 短期的にはオプション1、長期的にはオプション3への移行

#### 3. テスト戦略
- **質問**: 統合テスト（E2E）でカバーすべき範囲はどこまでか？
- **現状**: ユニットテストでDOM操作の詳細までテスト
- **提案**: ユニットテストは「振る舞い」に集中、DOM操作の詳細はE2Eでカバー

### 追加調査が必要な項目

#### 1. React 18 StrictModeの影響詳細
- **調査内容**: ポーリングロジックに与える具体的な影響
- **方法**: StrictMode on/offでテスト実行回数を比較
- **期待結果**: 多重インターバル生成の確認

#### 2. document.createElementモックのベストプラクティス
- **調査内容**: React Testing Libraryの推奨パターン
- **方法**: 公式ドキュメント、コミュニティのベストプラクティス調査
- **期待結果**: より安全なモック方法の発見

#### 3. CI/CD環境でのテスト実行時の挙動
- **調査内容**: ローカルとの差異の特定
- **方法**: CI環境でのログ出力、StrictMode設定確認
- **期待結果**: 環境差分の原因特定と対策

---

**レビュー依頼先**: 開発チーム  
**次のアクション**: 修正案の承認後、優先度順に実装とテスト実行

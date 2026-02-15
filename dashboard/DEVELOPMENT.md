# TDnet Dashboard - 開発ガイドライン

## 開発環境セットアップ

### 前提条件

- Node.js 20.x以上
- npm 10.x以上
- Git
- VSCode (推奨)

### 初回セットアップ

```bash
# リポジトリのクローン
git clone <repository-url>
cd tdnet-data-collector/dashboard

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.development.example .env.development
# .env.developmentを編集してAPI URLとAPI Keyを設定

# 開発サーバーの起動
npm start
```

### VSCode推奨拡張機能

- **ESLint**: コード品質チェック
- **Prettier**: コードフォーマット
- **TypeScript**: 型チェック
- **ES7+ React/Redux/React-Native snippets**: Reactスニペット
- **Material-UI Snippets**: MUIスニペット

## コーディング規約

### TypeScript

#### 型定義

```typescript
// ✅ Good: 明示的な型定義
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
};

// ❌ Bad: any型の使用
const user: any = { ... };
```

#### 関数の型定義

```typescript
// ✅ Good: 引数と戻り値の型を明示
function fetchUser(userId: string): Promise<User> {
  return api.get(`/users/${userId}`);
}

// ❌ Bad: 型定義なし
function fetchUser(userId) {
  return api.get(`/users/${userId}`);
}
```

#### Optional vs Undefined

```typescript
// ✅ Good: オプショナルプロパティ
interface SearchParams {
  query?: string;
  page?: number;
}

// ❌ Bad: undefined型の明示
interface SearchParams {
  query: string | undefined;
  page: number | undefined;
}
```

### React

#### コンポーネント定義

```typescript
// ✅ Good: 関数コンポーネント + TypeScript
interface MyComponentProps {
  title: string;
  onClose: () => void;
}

const MyComponent: React.FC<MyComponentProps> = ({ title, onClose }) => {
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={onClose}>閉じる</button>
    </div>
  );
};

export default MyComponent;
```

#### Hooks

```typescript
// ✅ Good: 型付きuseState
const [count, setCount] = useState<number>(0);
const [user, setUser] = useState<User | null>(null);

// ✅ Good: useCallbackでメモ化
const handleClick = useCallback(() => {
  console.log('Clicked');
}, []);

// ✅ Good: useEffectの依存配列
useEffect(() => {
  fetchData();
}, [fetchData]); // fetchDataをuseCallbackでメモ化
```

#### Props

```typescript
// ✅ Good: Propsの分割代入
const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  description, 
  onClose 
}) => {
  // ...
};

// ❌ Bad: props.xxxの繰り返し
const MyComponent: React.FC<MyComponentProps> = (props) => {
  return <h1>{props.title}</h1>;
};
```

### Material-UI

#### コンポーネントのインポート

```typescript
// ✅ Good: 名前付きインポート
import { Button, TextField, Box } from '@mui/material';

// ❌ Bad: デフォルトインポート
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
```

#### スタイリング

```typescript
// ✅ Good: sx propを使用
<Box sx={{ 
  display: 'flex', 
  gap: 2, 
  p: 3,
  backgroundColor: 'primary.main' 
}}>
  {/* ... */}
</Box>

// ✅ Good: テーマの値を参照
<Typography 
  variant="h6" 
  sx={{ 
    color: 'text.secondary',
    mb: theme => theme.spacing(2)
  }}
>
  タイトル
</Typography>
```

#### レスポンシブデザイン

```typescript
// ✅ Good: ブレークポイントを使用
<Box sx={{
  display: { xs: 'block', md: 'flex' },
  gap: { xs: 1, md: 2 },
  p: { xs: 2, md: 3 }
}}>
  {/* ... */}
</Box>

// ✅ Good: useMediaQueryを使用
const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

return isMobile ? <MobileView /> : <DesktopView />;
```

### API通信

#### エラーハンドリング

```typescript
// ✅ Good: try-catchでエラー処理
const fetchData = async () => {
  setLoading(true);
  setError('');
  
  try {
    const response = await api.searchDisclosures(params);
    setData(response.data);
  } catch (err) {
    console.error('データ取得エラー:', err);
    setError(
      err instanceof Error 
        ? err.message 
        : 'データの取得に失敗しました'
    );
  } finally {
    setLoading(false);
  }
};
```

#### ローディング状態

```typescript
// ✅ Good: ローディング状態を管理
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    // API呼び出し
  } finally {
    setLoading(false); // 必ずfinallyで解除
  }
};

// UIでローディング表示
{loading ? <CircularProgress /> : <DataView />}
```

### 命名規則

#### ファイル名

```
# コンポーネント: PascalCase
SearchFilter.tsx
DisclosureList.tsx

# ユーティリティ: camelCase
api.ts
formatDate.ts

# 型定義: camelCase
disclosure.ts
user.ts

# テスト: 元のファイル名 + .test.tsx
SearchFilter.test.tsx
api.test.ts
```

#### 変数・関数名

```typescript
// ✅ Good: 意味のある名前
const disclosureList = [...];
const isLoading = true;
const handleSearchClick = () => { ... };

// ❌ Bad: 短すぎる/意味不明
const dl = [...];
const flag = true;
const onClick = () => { ... };
```

#### コンポーネント名

```typescript
// ✅ Good: 機能を表す名前
<SearchFilter />
<DisclosureList />
<PdfDownload />

// ❌ Bad: 抽象的すぎる
<Component1 />
<Widget />
```

### コメント

#### JSDoc

```typescript
/**
 * 開示情報を検索する
 * 
 * @param params - 検索パラメータ
 * @returns 開示情報の配列とページネーション情報
 * @throws {Error} API通信エラー
 */
export const searchDisclosures = async (
  params: SearchParams
): Promise<ApiResponse<Disclosure[]>> => {
  // ...
};
```

#### インラインコメント

```typescript
// ✅ Good: 複雑なロジックの説明
// 日付範囲が指定されていない場合は過去30日間を検索
if (!params.start_date && !params.end_date) {
  params.start_date = getDateBefore(30);
  params.end_date = getToday();
}

// ❌ Bad: 自明なコメント
// countを1増やす
setCount(count + 1);
```

## Git ワークフロー

### ブランチ戦略

```
main (本番環境)
  ├── develop (開発環境)
  │   ├── feature/search-filter
  │   ├── feature/pdf-download
  │   └── bugfix/pagination-error
  └── hotfix/critical-bug
```

### コミットメッセージ

```bash
# フォーマット
[type] 変更内容

# 例
[feat] 検索フィルターコンポーネントを追加
[fix] ページネーションのバグを修正
[refactor] API通信ロジックをリファクタリング
[test] E2Eテストを追加
[docs] READMEを更新
[style] コードフォーマットを修正
[chore] 依存関係を更新
```

### プルリクエスト

#### テンプレート

```markdown
## 変更内容
- 検索フィルターコンポーネントを追加
- 企業名、企業コード、開示種類でフィルタリング可能

## 関連Issue
Closes #123

## テスト
- [ ] ユニットテスト追加
- [ ] E2Eテスト追加
- [ ] 手動テスト完了

## スクリーンショット
(必要に応じて)

## チェックリスト
- [ ] コードレビュー依頼
- [ ] テスト通過
- [ ] ドキュメント更新
```

## テスト

### ユニットテスト

```typescript
// SearchFilter.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilter from './SearchFilter';

describe('SearchFilter', () => {
  it('検索ボタンをクリックすると検索が実行される', () => {
    const onSearch = jest.fn();
    render(<SearchFilter onSearch={onSearch} />);
    
    const searchButton = screen.getByRole('button', { name: /検索/i });
    fireEvent.click(searchButton);
    
    expect(onSearch).toHaveBeenCalled();
  });
});
```

### E2Eテスト

```typescript
// dashboard.spec.ts
import { test, expect } from '@playwright/test';

test('開示情報一覧が表示される', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const list = page.locator('[data-testid="disclosure-list"]');
  await expect(list).toBeVisible();
});
```

詳細は [TESTING.md](./TESTING.md) を参照。

## デバッグ

### React Developer Tools

1. Chrome拡張機能をインストール
2. 開発者ツールの「Components」タブでコンポーネントツリーを確認
3. Propsとstateを検査

### ネットワークデバッグ

```typescript
// api.tsにログを追加
apiClient.interceptors.request.use((config) => {
  console.log('API Request:', config.method, config.url, config.params);
  return config;
});

apiClient.interceptors.response.use((response) => {
  console.log('API Response:', response.status, response.data);
  return response;
});
```

### ブレークポイント

```typescript
// デバッガーを起動
debugger;

// 条件付きブレークポイント
if (process.env.NODE_ENV === 'development') {
  debugger;
}
```

## パフォーマンス最適化

### React DevTools Profiler

1. React DevToolsの「Profiler」タブを開く
2. 記録開始 → 操作 → 記録停止
3. レンダリング時間を確認

### Lighthouse

```bash
# Chrome DevToolsのLighthouseタブで実行
# または
npm install -g lighthouse
lighthouse http://localhost:3000 --view
```

### バンドルサイズ分析

```bash
# source-map-explorerをインストール
npm install -g source-map-explorer

# ビルド
npm run build

# 分析
source-map-explorer 'build/static/js/*.js'
```

## トラブルシューティング

### よくある問題

#### 1. npm installが失敗する

```bash
# node_modulesとpackage-lock.jsonを削除
rm -rf node_modules package-lock.json

# 再インストール
npm install
```

#### 2. ポート3000が使用中

```bash
# Windowsの場合
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# 別のポートを使用
PORT=3001 npm start
```

#### 3. TypeScriptエラー

```bash
# 型定義を再インストール
npm install --save-dev @types/react @types/react-dom @types/node

# TypeScriptキャッシュをクリア
rm -rf node_modules/.cache
```

#### 4. Material-UIのスタイルが適用されない

```typescript
// App.tsxでThemeProviderとCssBaselineを確認
import { ThemeProvider, CssBaseline } from '@mui/material';

<ThemeProvider theme={theme}>
  <CssBaseline />
  {/* ... */}
</ThemeProvider>
```

## 開発ツール

### 推奨ツール

- **Postman**: API動作確認
- **React Developer Tools**: コンポーネント検査
- **Redux DevTools**: 状態管理デバッグ (将来的に使用)
- **Lighthouse**: パフォーマンス測定

### VSCode設定

`.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\n"
}
```

## 関連ドキュメント

- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ
- [TESTING.md](./TESTING.md) - テスト戦略
- [DEPLOYMENT.md](./DEPLOYMENT.md) - デプロイ手順
- [README.md](./README.md) - プロジェクト概要

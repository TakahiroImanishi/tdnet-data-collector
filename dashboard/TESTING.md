# TDnet Dashboard - テスト戦略

## テスト概要

TDnet Dashboardでは、以下の3層のテスト戦略を採用しています:

1. **ユニットテスト** (Jest + React Testing Library): コンポーネント単体のテスト
2. **統合テスト** (Jest + React Testing Library): 複数コンポーネントの連携テスト
3. **E2Eテスト** (Playwright): ブラウザでの実際の動作テスト

## テストピラミッド

```
        ┌─────────────┐
        │   E2E (10%)  │  ← 少数の重要なシナリオ
        ├─────────────┤
        │ 統合 (20%)   │  ← コンポーネント間の連携
        ├─────────────┤
        │ ユニット(70%)│  ← 個別コンポーネントの詳細テスト
        └─────────────┘
```

## ユニットテスト

### 実行方法

```bash
# すべてのテストを実行
npm test

# カバレッジ付きで実行
npm test -- --coverage

# 特定のファイルのみ実行
npm test SearchFilter.test.tsx

# ウォッチモード
npm test -- --watch
```

### テストファイルの配置

```
src/
├── components/
│   ├── SearchFilter.tsx
│   └── __tests__/
│       └── SearchFilter.test.tsx
├── services/
│   ├── api.ts
│   └── __tests__/
│       └── api.test.ts
```

### コンポーネントテストの基本

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import SearchFilter from '../SearchFilter';

describe('SearchFilter', () => {
  it('検索ボタンが表示される', () => {
    // Arrange
    const onSearch = jest.fn();
    
    // Act
    render(<SearchFilter onSearch={onSearch} />);
    
    // Assert
    const searchButton = screen.getByRole('button', { name: /検索/i });
    expect(searchButton).toBeInTheDocument();
  });

  it('検索ボタンをクリックすると検索が実行される', () => {
    // Arrange
    const onSearch = jest.fn();
    render(<SearchFilter onSearch={onSearch} />);
    
    // Act
    const searchButton = screen.getByRole('button', { name: /検索/i });
    fireEvent.click(searchButton);
    
    // Assert
    expect(onSearch).toHaveBeenCalled();
  });

  it('企業名を入力できる', () => {
    // Arrange
    const onSearch = jest.fn();
    render(<SearchFilter onSearch={onSearch} />);
    
    // Act
    const input = screen.getByLabelText(/企業名/i);
    fireEvent.change(input, { target: { value: 'トヨタ' } });
    
    // Assert
    expect(input).toHaveValue('トヨタ');
  });
});
```

### 非同期処理のテスト

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import Home from '../Home';
import * as api from '../../services/api';

// APIをモック
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

describe('Home', () => {
  it('開示情報を取得して表示する', async () => {
    // Arrange
    const mockData = {
      success: true,
      data: [
        {
          disclosure_id: 'TD20240115001',
          company_name: 'テスト株式会社',
          title: 'テスト開示',
          disclosed_at: '2024-01-15T10:00:00Z',
          disclosure_type: '決算短信',
        },
      ],
      pagination: {
        current_page: 1,
        total_pages: 1,
        total_items: 1,
        items_per_page: 20,
      },
    };
    
    mockedApi.searchDisclosures.mockResolvedValue(mockData);
    
    // Act
    render(<Home />);
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText('テスト株式会社')).toBeInTheDocument();
    });
  });

  it('APIエラー時にエラーメッセージを表示する', async () => {
    // Arrange
    mockedApi.searchDisclosures.mockRejectedValue(
      new Error('API通信エラー')
    );
    
    // Act
    render(<Home />);
    
    // Assert
    await waitFor(() => {
      expect(screen.getByText(/エラー/i)).toBeInTheDocument();
    });
  });
});
```

### Material-UIコンポーネントのテスト

```typescript
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import MyComponent from '../MyComponent';

// テーマプロバイダーでラップ
const renderWithTheme = (component: React.ReactElement) => {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('MyComponent', () => {
  it('Material-UIコンポーネントが正しく表示される', () => {
    renderWithTheme(<MyComponent />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
```

### カバレッジ目標

| カテゴリ | 目標 |
|---------|------|
| Statements | 80%以上 |
| Branches | 75%以上 |
| Functions | 80%以上 |
| Lines | 80%以上 |

## E2Eテスト (Playwright)

### 実行方法

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# UIモードで実行 (デバッグに便利)
npm run test:e2e:ui

# ヘッドモードで実行 (ブラウザを表示)
npm run test:e2e:headed

# デバッグモード
npm run test:e2e:debug

# 特定のテストのみ実行
npx playwright test dashboard.spec.ts
```

### テストファイルの配置

```
src/__tests__/e2e/
├── dashboard.spec.ts        # ダッシュボード基本機能
└── api-integration.spec.ts  # API統合テスト
```

### E2Eテストの基本

```typescript
import { test, expect } from '@playwright/test';

test.describe('TDnet Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // 各テストの前にホームページに移動
    await page.goto('/');
  });

  test('ページタイトルが正しく表示される', async ({ page }) => {
    // Assert
    await expect(page).toHaveTitle(/TDnet Data Collector/i);
  });

  test('開示情報リストが表示される', async ({ page }) => {
    // Arrange & Act
    await page.waitForLoadState('networkidle');
    
    // Assert
    const list = page.locator('[data-testid="disclosure-list"]');
    await expect(list).toBeVisible();
  });
});
```

### APIモックを使用したテスト

```typescript
test('APIエラー時にエラーメッセージが表示される', async ({ page }) => {
  // Arrange: APIリクエストを失敗させる
  await page.route('**/api/disclosures*', (route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });

  // Act
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Assert
  const errorMessage = page.locator('text=/エラー|error/i');
  await expect(errorMessage).toBeVisible({ timeout: 5000 });
});
```

### レスポンシブテスト

```typescript
test('モバイル表示が正しく動作する', async ({ page }) => {
  // Arrange: モバイルサイズに設定
  await page.setViewportSize({ width: 375, height: 667 });

  // Act
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Assert
  const header = page.locator('header');
  await expect(header).toBeVisible();
});
```

### ネットワーク監視

```typescript
test('APIリクエストが正しく送信される', async ({ page }) => {
  // Arrange
  let apiCalled = false;
  
  page.on('request', (request) => {
    if (request.url().includes('/api/disclosures')) {
      apiCalled = true;
    }
  });

  // Act
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Assert
  expect(apiCalled).toBeTruthy();
});
```

## テストのベストプラクティス

### 1. AAA (Arrange-Act-Assert) パターン

```typescript
test('検索が正しく動作する', async () => {
  // Arrange: テストの準備
  const onSearch = jest.fn();
  render(<SearchFilter onSearch={onSearch} />);
  
  // Act: 操作を実行
  const input = screen.getByLabelText(/企業名/i);
  fireEvent.change(input, { target: { value: 'トヨタ' } });
  fireEvent.click(screen.getByRole('button', { name: /検索/i }));
  
  // Assert: 結果を検証
  expect(onSearch).toHaveBeenCalledWith(
    expect.objectContaining({ company_name: 'トヨタ' })
  );
});
```

### 2. テストの独立性

```typescript
// ✅ Good: 各テストが独立
describe('SearchFilter', () => {
  it('テスト1', () => {
    render(<SearchFilter onSearch={jest.fn()} />);
    // ...
  });

  it('テスト2', () => {
    render(<SearchFilter onSearch={jest.fn()} />);
    // ...
  });
});

// ❌ Bad: テスト間で状態を共有
let component;
describe('SearchFilter', () => {
  beforeAll(() => {
    component = render(<SearchFilter onSearch={jest.fn()} />);
  });

  it('テスト1', () => {
    // componentを使用
  });
});
```

### 3. 意味のあるテスト名

```typescript
// ✅ Good: 何をテストしているか明確
it('検索ボタンをクリックすると検索が実行される', () => { ... });
it('企業名が空の場合はエラーメッセージが表示される', () => { ... });

// ❌ Bad: 抽象的すぎる
it('動作する', () => { ... });
it('テスト1', () => { ... });
```

### 4. data-testid の使用

```typescript
// コンポーネント
<div data-testid="disclosure-list">
  {/* ... */}
</div>

// テスト
const list = screen.getByTestId('disclosure-list');
expect(list).toBeInTheDocument();
```

### 5. ユーザー視点でのテスト

```typescript
// ✅ Good: ユーザーが見る要素でテスト
const button = screen.getByRole('button', { name: /検索/i });
const input = screen.getByLabelText(/企業名/i);

// ❌ Bad: 実装の詳細に依存
const button = screen.getByClassName('search-button');
const input = screen.getByTestId('company-name-input');
```

## テストカバレッジ

### カバレッジレポートの確認

```bash
# カバレッジ付きでテスト実行
npm test -- --coverage

# カバレッジレポートを開く
open coverage/lcov-report/index.html
```

### カバレッジの改善

1. **未テストのファイルを特定**
   ```bash
   npm test -- --coverage --collectCoverageFrom='src/**/*.{ts,tsx}'
   ```

2. **カバレッジが低い箇所を確認**
   - `coverage/lcov-report/index.html` を開く
   - 赤色の行 = 未実行
   - 黄色の行 = 部分的に実行

3. **テストを追加**
   - エッジケース
   - エラーハンドリング
   - 条件分岐

## CI/CDでのテスト

### GitHub Actions設定例

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## トラブルシューティング

### よくある問題

#### 1. テストがタイムアウトする

```typescript
// タイムアウトを延長
test('長時間かかる処理', async () => {
  // ...
}, 10000); // 10秒
```

#### 2. 非同期処理が完了しない

```typescript
// waitForを使用
await waitFor(() => {
  expect(screen.getByText('完了')).toBeInTheDocument();
}, { timeout: 5000 });
```

#### 3. Material-UIのスタイルが適用されない

```typescript
// ThemeProviderでラップ
const renderWithTheme = (component) => {
  return render(
    <ThemeProvider theme={createTheme()}>
      {component}
    </ThemeProvider>
  );
};
```

#### 4. Playwrightのブラウザが起動しない

```bash
# ブラウザを再インストール
npx playwright install
```

## テストデータ

### モックデータの管理

```typescript
// src/__mocks__/disclosures.ts
export const mockDisclosures = [
  {
    disclosure_id: 'TD20240115001',
    company_code: '7203',
    company_name: 'トヨタ自動車株式会社',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T15:00:00Z',
    disclosure_type: '決算短信',
    pdf_url: 'https://example.com/pdf/TD20240115001.pdf',
    xbrl_url: 'https://example.com/xbrl/TD20240115001.xbrl',
    date_partition: '2024-01',
    created_at: '2024-01-15T15:05:00Z',
    updated_at: '2024-01-15T15:05:00Z',
  },
  // ...
];
```

### テストで使用

```typescript
import { mockDisclosures } from '../__mocks__/disclosures';

test('開示情報が表示される', () => {
  render(<DisclosureList disclosures={mockDisclosures} />);
  
  expect(screen.getByText('トヨタ自動車株式会社')).toBeInTheDocument();
});
```

## 参考資料

### 公式ドキュメント

- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright](https://playwright.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

### 関連ドキュメント

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 開発ガイドライン
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ
- [README.md](./README.md) - プロジェクト概要

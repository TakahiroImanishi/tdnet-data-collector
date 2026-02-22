# Vite移行ガイド

Create React App (CRA) から Vite への移行手順と検討事項

## 目次

1. [移行の目的](#移行の目的)
2. [移行手順](#移行手順)
3. [期待される効果](#期待される効果)
4. [注意事項](#注意事項)
5. [移行後の検証](#移行後の検証)

## 移行の目的

### CRAの課題
- ビルド速度が遅い（大規模プロジェクトで顕著）
- HMR（Hot Module Replacement）が遅い
- メンテナンスが停滞気味
- 設定のカスタマイズが困難（eject必要）

### Viteの利点
- **高速なビルド**: ESBuildベースで5-10倍高速
- **高速なHMR**: ネイティブESMを活用
- **柔軟な設定**: 設定ファイルで簡単にカスタマイズ可能
- **最新のツール**: 活発に開発・メンテナンスされている
- **バンドルサイズ最適化**: Rollupベースで効率的

## 移行手順

### 1. 依存関係の更新

```bash
# CRA関連パッケージを削除
npm uninstall react-scripts

# Vite関連パッケージをインストール
npm install -D vite @vitejs/plugin-react

# テストツールをVitestに移行（オプション）
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

### 2. 設定ファイルの作成

`vite.config.ts` を作成（`vite.config.ts.sample`を参考）

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
  },
});
```

### 3. index.htmlの移行

`public/index.html` → `index.html`（ルートディレクトリ）

変更点:
```html
<!-- 削除 -->
%PUBLIC_URL%

<!-- 追加 -->
<script type="module" src="/src/index.tsx"></script>
```

### 4. 環境変数の変更

`.env` ファイル内の環境変数プレフィックスを変更:

```bash
# 変更前
REACT_APP_API_ENDPOINT=https://api.example.com
REACT_APP_API_KEY=xxx

# 変更後
VITE_API_ENDPOINT=https://api.example.com
VITE_API_KEY=xxx
```

コード内の参照も変更:
```typescript
// 変更前
const apiEndpoint = process.env.REACT_APP_API_ENDPOINT;

// 変更後
const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;
```

### 5. package.jsonの更新

```json
{
  "scripts": {
    "start": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test"
  }
}
```

### 6. tsconfig.jsonの更新

```json
{
  "compilerOptions": {
    "types": ["vite/client"],
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  }
}
```

### 7. テストの移行（Vitest使用時）

`setupTests.ts` を更新:
```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
```

テストファイルの変更:
```typescript
// 変更前
import { jest } from '@jest/globals';

// 変更後
import { vi } from 'vitest';

// jest.fn() → vi.fn()
// jest.mock() → vi.mock()
```

### 8. 静的ファイルの配置

`public/` ディレクトリの静的ファイルはそのまま使用可能。
参照方法:
```typescript
// 変更前
<img src={process.env.PUBLIC_URL + '/logo.png'} />

// 変更後
<img src="/logo.png" />
```

## 期待される効果

### ビルド速度の比較

| 項目 | CRA | Vite | 改善率 |
|------|-----|------|--------|
| 初回ビルド | 30-60秒 | 5-10秒 | 5-6倍 |
| HMR | 1-3秒 | 0.1-0.5秒 | 5-10倍 |
| 本番ビルド | 60-120秒 | 20-40秒 | 3-4倍 |

### バンドルサイズの最適化

- Tree-shaking: より効率的な未使用コード削除
- Code-splitting: 自動的な最適なチャンク分割
- 圧縮: より効率的な圧縮アルゴリズム

期待される削減率: 10-20%

### 開発体験の向上

- **高速な起動**: 開発サーバーが数秒で起動
- **即座のHMR**: コード変更が即座に反映
- **エラー表示**: より詳細で分かりやすいエラーメッセージ

## 注意事項

### 互換性の問題

1. **グローバル変数**: `process.env` → `import.meta.env`
2. **require()**: ESMのみサポート、`import`を使用
3. **CommonJS**: 一部のパッケージで問題が発生する可能性
4. **Jest固有の機能**: Vitestへの移行が必要

### 段階的な移行

1. **Phase 1**: Vite設定の作成とビルド確認
2. **Phase 2**: 開発環境での動作確認
3. **Phase 3**: テストの移行（Vitest）
4. **Phase 4**: CI/CDパイプラインの更新
5. **Phase 5**: 本番デプロイ

### ロールバック計画

移行に問題が発生した場合:
1. Gitで前のコミットに戻す
2. `node_modules`を削除して`npm install`
3. CRA環境で動作確認

## 移行後の検証

### 1. 機能テスト

```bash
# ユニットテスト
npm test

# E2Eテスト
npm run test:e2e

# ビルド確認
npm run build
npm run preview
```

### 2. パフォーマンス測定

```bash
# Lighthouseスコア
npm run lighthouse

# バンドルサイズ分析
npm run analyze
```

### 3. 本番環境での確認

- デプロイ後の動作確認
- パフォーマンス監視
- エラーログの確認

## 参考リンク

- [Vite公式ドキュメント](https://vitejs.dev/)
- [Vite移行ガイド](https://vitejs.dev/guide/migration.html)
- [Vitest公式ドキュメント](https://vitest.dev/)
- [Create React App → Vite移行事例](https://github.com/vitejs/vite/discussions/categories/migration)

## 移行タイムライン（推奨）

| フェーズ | 期間 | 内容 |
|---------|------|------|
| 調査 | 1週間 | POC実施、互換性確認 |
| 実装 | 1-2週間 | 設定変更、テスト移行 |
| テスト | 1週間 | 動作確認、パフォーマンス測定 |
| デプロイ | 1日 | 本番環境へのデプロイ |
| 監視 | 1週間 | 本番環境での動作監視 |

**合計**: 約4-5週間

## 結論

Viteへの移行は、開発体験とビルドパフォーマンスの大幅な向上が期待できます。
ただし、移行には一定の工数が必要なため、プロジェクトの状況に応じて判断してください。

**推奨**: 新規プロジェクトではViteを採用、既存プロジェクトは段階的に移行を検討

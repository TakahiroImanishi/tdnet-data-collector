# TDnet Dashboard - アーキテクチャ

## 概要

TDnet Dashboardは、TDnetから収集した上場企業の開示情報を検索・閲覧するためのReact SPAです。Material-UIを使用したモダンなUIと、レスポンシブデザインを実現しています。

## 技術スタック

| カテゴリ | 技術 | バージョン | 用途 |
|---------|------|-----------|------|
| フレームワーク | React | 19.x | UIフレームワーク |
| 言語 | TypeScript | 4.9.x | 型安全な開発 |
| UIライブラリ | Material-UI (MUI) | 7.x | UIコンポーネント |
| HTTP通信 | Axios | 1.x | API通信 |
| テスト | Jest | 27.x | ユニットテスト |
| E2Eテスト | Playwright | 1.58.x | E2Eテスト |
| ビルドツール | React Scripts | 5.0.x | Webpack/Babel統合 |

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    React App                          │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │              App.tsx (Root)                     │  │  │
│  │  │  - ThemeProvider                                │  │  │
│  │  │  - CssBaseline                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │                        │                              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           Pages (pages/)                        │  │  │
│  │  │  - Home.tsx (メインページ)                      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │           │                    │                       │  │
│  │  ┌────────────────┐   ┌────────────────────────────┐  │  │
│  │  │  Components    │   │      Services              │  │  │
│  │  │  (components/) │   │      (services/)           │  │  │
│  │  │                │   │                            │  │  │
│  │  │ - SearchFilter │◄──┤ - api.ts                   │  │  │
│  │  │ - DisclosureList│  │   (Axios Client)           │  │  │
│  │  │ - PdfDownload  │   │                            │  │  │
│  │  │ - ExportDialog │   └────────────┬───────────────┘  │  │
│  │  │ - ExecutionStatus│              │                  │  │
│  │  └────────────────┘                │                  │  │
│  │           │                         │                  │  │
│  │  ┌────────────────┐                │                  │  │
│  │  │  Types         │                │                  │  │
│  │  │  (types/)      │                │                  │  │
│  │  │                │                │                  │  │
│  │  │ - disclosure.ts│                │                  │  │
│  │  └────────────────┘                │                  │  │
│  └────────────────────────────────────┼──────────────────┘  │
└─────────────────────────────────────┼─────────────────────┘
                                       │
                                       │ HTTPS
                                       │
                        ┌──────────────▼──────────────┐
                        │   API Gateway + Lambda      │
                        │   (Backend API)             │
                        └─────────────────────────────┘
```

## ディレクトリ構造

```
dashboard/
├── public/                    # 静的ファイル
│   ├── index.html            # HTMLテンプレート
│   ├── favicon.ico           # ファビコン
│   └── manifest.json         # PWA設定
│
├── src/
│   ├── components/           # Reactコンポーネント
│   │   ├── DisclosureList.tsx      # 開示情報一覧
│   │   ├── SearchFilter.tsx        # 検索フィルター
│   │   ├── PdfDownload.tsx         # PDFダウンロード
│   │   ├── ExportDialog.tsx        # エクスポートダイアログ
│   │   ├── ExecutionStatus.tsx     # 収集実行状態
│   │   └── __tests__/              # コンポーネントテスト
│   │
│   ├── pages/                # ページコンポーネント
│   │   └── Home.tsx                # ホームページ
│   │
│   ├── services/             # API通信
│   │   └── api.ts                  # APIクライアント
│   │
│   ├── types/                # TypeScript型定義
│   │   └── disclosure.ts           # 開示情報の型
│   │
│   ├── __tests__/            # テスト
│   │   └── e2e/                    # E2Eテスト
│   │       ├── dashboard.spec.ts
│   │       └── api-integration.spec.ts
│   │
│   ├── App.tsx               # アプリケーションルート
│   ├── App.css               # アプリケーションスタイル
│   ├── index.tsx             # エントリーポイント
│   ├── index.css             # グローバルスタイル
│   └── setupTests.ts         # テスト設定
│
├── .env.development          # 開発環境変数
├── .env.production           # 本番環境変数
├── package.json              # 依存関係
├── tsconfig.json             # TypeScript設定
├── playwright.config.ts      # Playwright設定
└── README.md                 # プロジェクト概要
```

## コンポーネント設計

### 1. App.tsx (ルートコンポーネント)

**責務**:
- Material-UIテーマの提供
- グローバルスタイルの適用
- ページコンポーネントのレンダリング

**主要機能**:
- ThemeProvider: カラーパレット、タイポグラフィ設定
- CssBaseline: ブラウザデフォルトスタイルのリセット

### 2. Home.tsx (メインページ)

**責務**:
- 開示情報の検索・一覧表示
- 検索パラメータの管理
- API通信の制御

**状態管理**:
```typescript
const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
const [pagination, setPagination] = useState<PaginationInfo>();
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string>('');
const [searchParams, setSearchParams] = useState<SearchParams>({
  page: 1,
  limit: 20,
  sort_by: 'disclosed_at',
  sort_order: 'desc',
});
```

**データフロー**:
1. 初回レンダリング時にAPI呼び出し
2. 検索パラメータ変更時に再取得
3. 子コンポーネントにデータとコールバックを渡す

### 3. SearchFilter.tsx (検索フィルター)

**責務**:
- 検索条件の入力UI
- フィルター条件の管理
- 検索実行のトリガー

**Props**:
```typescript
interface SearchFilterProps {
  onSearch: (params: SearchParams) => void;
  loading?: boolean;
}
```

**機能**:
- 企業名検索
- 企業コード検索
- 開示種類フィルター
- 日付範囲フィルター
- 折りたたみ可能な詳細フィルター

### 4. DisclosureList.tsx (開示情報一覧)

**責務**:
- 開示情報のテーブル/カード表示
- ソート機能
- ページネーション
- レスポンシブ対応

**Props**:
```typescript
interface DisclosureListProps {
  disclosures: Disclosure[];
  pagination?: PaginationInfo;
  loading?: boolean;
  error?: string;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onSortChange: (sortBy: string, sortOrder: string) => void;
}
```

**レスポンシブ対応**:
- モバイル (< 600px): カード表示
- タブレット (600-959px): 簡略テーブル
- デスクトップ (≥ 960px): 完全テーブル

### 5. PdfDownload.tsx (PDFダウンロード)

**責務**:
- PDFの署名付きURL取得
- ダウンロード処理

**Props**:
```typescript
interface PdfDownloadProps {
  disclosureId: string;
  fileName?: string;
}
```

### 6. ExportDialog.tsx (エクスポートダイアログ)

**責務**:
- エクスポート条件の入力
- エクスポートジョブの作成
- 進捗状態の表示

**Props**:
```typescript
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}
```

**状態管理**:
- エクスポート条件 (日付範囲、企業コード、開示種類)
- エクスポート状態 (pending, processing, completed, failed)
- ポーリング処理 (5秒間隔)

### 7. ExecutionStatus.tsx (収集実行状態)

**責務**:
- 収集実行の進捗表示
- 統計情報の表示
- 完了/エラー通知

**Props**:
```typescript
interface ExecutionStatusProps {
  executionId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}
```

**状態管理**:
- 実行状態 (running, completed, failed)
- 進捗率 (0-100%)
- 処理済み/失敗アイテム数
- ポーリング処理 (5秒間隔)

## API通信 (services/api.ts)

### Axiosインスタンス設定

```typescript
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.REACT_APP_API_KEY,
  },
});
```

### エラーハンドリング

レスポンスインターセプターで統一的にエラー処理:
- 401/403: 認証エラー
- 404: リソース不在
- 5xx: サーバーエラー
- ネットワークエラー: 接続失敗

### API関数

| 関数 | エンドポイント | 用途 |
|------|--------------|------|
| `searchDisclosures` | GET /disclosures | 開示情報検索 |
| `getDisclosureById` | GET /disclosures/:id | 開示情報詳細 |
| `getDisclosureTypes` | - | 開示種類一覧 (固定値) |
| `getPdfDownloadUrl` | GET /disclosures/:id/pdf | PDF署名付きURL |
| `createExportJob` | POST /exports | エクスポートジョブ作成 |
| `getExportStatus` | GET /exports/:id | エクスポート状態取得 |
| `getCollectionStatus` | GET /collect/:id | 収集実行状態取得 |

## 型定義 (types/disclosure.ts)

### Disclosure (開示情報)

```typescript
interface Disclosure {
  disclosure_id: string;
  company_code: string;
  company_name: string;
  title: string;
  disclosed_at: string;
  disclosure_type: string;
  pdf_url?: string;
  xbrl_url?: string;
  date_partition: string;
  created_at: string;
  updated_at: string;
}
```

### SearchParams (検索パラメータ)

```typescript
interface SearchParams {
  company_name?: string;
  company_code?: string;
  start_date?: string;
  end_date?: string;
  disclosure_type?: string;
  page?: number;
  limit?: number;
  sort_by?: 'disclosed_at' | 'company_name';
  sort_order?: 'asc' | 'desc';
}
```

### PaginationInfo (ページネーション情報)

```typescript
interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}
```

### ApiResponse (APIレスポンス)

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationInfo;
}
```

## 状態管理

現在はReact Hooksによるローカル状態管理を使用しています。

### 状態管理の方針

1. **ローカル状態**: コンポーネント固有の状態 (useState)
2. **Props**: 親子間のデータ受け渡し
3. **コールバック**: 子から親への通知

### 将来的な拡張

複雑な状態管理が必要になった場合:
- Context API: グローバル状態 (ユーザー情報、テーマ設定)
- Redux/Zustand: 複雑な状態管理
- React Query: サーバー状態管理、キャッシング

## パフォーマンス最適化

### 実装済み

1. **useCallback**: 関数のメモ化 (fetchDisclosures)
2. **レスポンシブ画像**: 適切なサイズの画像読み込み
3. **遅延ローディング**: 必要なコンポーネントのみ読み込み

### 今後の改善案

1. **React.memo**: コンポーネントのメモ化
2. **useMemo**: 計算結果のメモ化
3. **仮想スクロール**: 大量データの効率的な表示
4. **コード分割**: React.lazy + Suspense
5. **Service Worker**: オフライン対応、キャッシング

## セキュリティ

### 実装済み

1. **API Key認証**: x-api-keyヘッダー
2. **HTTPS通信**: 本番環境では必須
3. **環境変数**: 機密情報の分離
4. **XSS対策**: Reactのデフォルト保護

### 今後の改善案

1. **CSP (Content Security Policy)**: XSS対策強化
2. **CSRF対策**: トークンベース認証
3. **入力バリデーション**: クライアント側検証
4. **レート制限**: API呼び出し制限

## デプロイアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    CloudFront                           │
│  - HTTPS強制                                            │
│  - キャッシング (静的ファイル: 1年)                      │
│  - Gzip圧縮                                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ OAI (Origin Access Identity)
                     │
          ┌──────────▼──────────┐
          │   S3 Bucket         │
          │   (Static Website)  │
          │                     │
          │  - index.html       │
          │  - static/          │
          │    - js/            │
          │    - css/           │
          │    - media/         │
          └─────────────────────┘
```

### デプロイフロー

1. **ビルド**: `npm run build` → `build/` フォルダ生成
2. **S3アップロード**: `aws s3 sync build/ s3://bucket-name/`
3. **CloudFront Invalidation**: キャッシュクリア
4. **動作確認**: CloudFront URLでアクセス

## 監視とログ

### CloudWatch Logs

- CloudFront アクセスログ
- S3 アクセスログ

### メトリクス

- CloudFront: リクエスト数、エラー率、レイテンシ
- S3: GetObject/PutObject リクエスト数

### アラート

- CloudFront エラー率 > 5%
- S3 4xx/5xx エラー増加

## 関連ドキュメント

- [README.md](./README.md) - プロジェクト概要
- [DEVELOPMENT.md](./DEVELOPMENT.md) - 開発ガイドライン
- [TESTING.md](./TESTING.md) - テスト戦略
- [DEPLOYMENT.md](./DEPLOYMENT.md) - デプロイ手順
- [INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md) - コンポーネント統合ガイド

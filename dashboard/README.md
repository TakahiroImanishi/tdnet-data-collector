# TDnet 開示情報ダッシュボード

TDnetから収集した上場企業の開示情報を検索・閲覧するためのWebダッシュボードです。

## 技術スタック

- **React 19** - UIフレームワーク
- **TypeScript** - 型安全な開発
- **Material-UI (MUI)** - UIコンポーネントライブラリ
- **Axios** - HTTP通信

## 機能

### 実装済み
- ✅ 開示情報一覧表示（テーブル形式）
- ✅ 検索・フィルタリング機能
  - 企業名検索
  - 企業コード検索
  - 開示種類フィルター
  - 日付範囲フィルター
- ✅ ページネーション
- ✅ ソート機能（開示日時、企業名）
- ✅ レスポンシブデザイン
  - デスクトップ: テーブル表示
  - タブレット: 簡略テーブル表示
  - モバイル: カード表示
- ✅ PDF/XBRLファイルへのリンク
- ✅ エラーハンドリング

### 今後の実装予定
- [ ] 開示情報の詳細表示
- [ ] お気に入り機能
- [ ] エクスポート機能（CSV、Excel）
- [ ] ダークモード対応
- [ ] 通知機能

## セットアップ

### 前提条件
- Node.js 16.x以上
- npm 7.x以上

### インストール

```bash
# 依存パッケージのインストール
npm install
```

### 環境変数の設定

`.env.development`ファイルを作成し、以下の環境変数を設定してください：

```env
# API Gateway URL（開発環境）
REACT_APP_API_URL=http://localhost:4566

# API Key（開発環境用）
REACT_APP_API_KEY=dev-api-key-12345

# 環境
REACT_APP_ENV=development
```

本番環境用には`.env.production`を作成してください。

### 開発サーバーの起動

```bash
npm start
```

ブラウザで http://localhost:3000 を開いてください。

### ビルド

```bash
npm run build
```

ビルド成果物は`build/`フォルダに出力されます。

## プロジェクト構造

```
dashboard/
├── public/              # 静的ファイル
├── src/
│   ├── components/      # Reactコンポーネント
│   │   ├── DisclosureList.tsx    # 開示情報一覧
│   │   └── SearchFilter.tsx      # 検索フィルター
│   ├── pages/           # ページコンポーネント
│   │   └── Home.tsx              # ホームページ
│   ├── services/        # API通信
│   │   └── api.ts                # APIクライアント
│   ├── types/           # TypeScript型定義
│   │   └── disclosure.ts         # 開示情報の型
│   ├── App.tsx          # アプリケーションルート
│   └── index.tsx        # エントリーポイント
├── .env.development     # 開発環境変数
├── package.json
└── README.md
```

## API仕様

### エンドポイント

#### GET /disclosures
開示情報の検索・一覧取得

**クエリパラメータ:**
- `company_name` (string, optional): 企業名（部分一致）
- `company_code` (string, optional): 企業コード
- `start_date` (string, optional): 開示日（開始）YYYY-MM-DD形式
- `end_date` (string, optional): 開示日（終了）YYYY-MM-DD形式
- `disclosure_type` (string, optional): 開示種類
- `page` (number, optional): ページ番号（デフォルト: 1）
- `limit` (number, optional): 1ページあたりの件数（デフォルト: 20）
- `sort_by` (string, optional): ソートフィールド（`disclosed_at` | `company_name`）
- `sort_order` (string, optional): ソート順（`asc` | `desc`）

**レスポンス:**
```json
{
  "success": true,
  "data": [
    {
      "disclosure_id": "TD20240115001",
      "company_code": "7203",
      "company_name": "トヨタ自動車株式会社",
      "title": "2024年3月期 第3四半期決算短信",
      "disclosed_at": "2024-01-15T15:00:00Z",
      "disclosure_type": "決算短信",
      "pdf_url": "https://...",
      "xbrl_url": "https://...",
      "date_partition": "2024-01",
      "created_at": "2024-01-15T15:05:00Z",
      "updated_at": "2024-01-15T15:05:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 10,
    "total_items": 200,
    "items_per_page": 20
  }
}
```

#### GET /disclosures/:disclosureId
開示情報の詳細取得

**レスポンス:**
```json
{
  "success": true,
  "data": {
    "disclosure_id": "TD20240115001",
    ...
  }
}
```

## レスポンシブデザイン

### ブレークポイント
- **モバイル**: 0-599px（カード表示）
- **タブレット**: 600-959px（簡略テーブル表示）
- **デスクトップ**: 960px以上（完全テーブル表示）

### 表示の違い
- **モバイル**: カード形式で表示、企業コードは企業名の上に表示
- **タブレット**: テーブル形式だが企業コード列を非表示
- **デスクトップ**: すべての列を表示

## エラーハンドリング

### API通信エラー
- **401/403**: 認証エラー（APIキーを確認）
- **404**: リソースが見つからない
- **5xx**: サーバーエラー
- **ネットワークエラー**: 接続できない

すべてのエラーは画面上部にAlertコンポーネントで表示されます。

## テスト

```bash
# テスト実行
npm test

# カバレッジ付きテスト
npm test -- --coverage
```

## デプロイ

### S3 + CloudFront
1. ビルド: `npm run build`
2. S3バケットにアップロード
3. CloudFrontディストリビューションを設定
4. 環境変数を本番用に設定

### Amplify Hosting
1. GitHubリポジトリと連携
2. ビルド設定を自動検出
3. 環境変数を設定
4. 自動デプロイ

## ライセンス

MIT License

## 作成者

TDnet Data Collector Project

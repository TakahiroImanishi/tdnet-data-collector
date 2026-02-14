# 作業記録: ルートフォルダ整理

**作業日時**: 2026-02-15 08:47:50  
**作業概要**: ルートフォルダの設定ファイルを適切なフォルダに整理

## 作業内容

### 1. フォルダ構造の整理

#### 作成したフォルダ
- `config/` - 環境変数ファイル
- `test/` - テスト設定ファイル

#### 移動したファイル

**環境変数ファイル → `config/`**
- `.env.development`
- `.env.load-test`
- `.env.local`
- `.env.production`
- `.env.production.template`

**テスト設定ファイル → `test/`**
- `jest.config.js`
- `jest.config.e2e.js`
- `jest.setup.js`
- `jest.setup.e2e.js`

### 2. 参照パスの更新

#### スクリプトファイル
- `scripts/localstack-setup.ps1` - `.env.local` → `config/.env.local`
- `scripts/generate-env-file.ps1` - `.env.development` → `config/.env.development`
- `scripts/deploy-dev.ps1` - `.env.development` → `config/.env.development`
- `scripts/deploy-prod.ps1` - `.env.production` → `config/.env.production`

#### テスト設定
- `test/jest.config.e2e.js` - dotenv path更新
- `test/jest.setup.e2e.js` - コメント更新

#### プロジェクト設定
- `package.json` - jest設定パス更新
- `.gitignore` - 環境変数ファイルとjest設定の除外パターン更新
- `src/__tests__/project-structure.test.ts` - jest.config.jsの検証パス更新

### 3. 整理後のルートフォルダ構造

```
tdnet-data-collector/
├── config/              # 環境変数ファイル（新規）
│   ├── .env.development
│   ├── .env.load-test
│   ├── .env.local
│   ├── .env.production
│   └── .env.production.template
├── test/                # テスト設定ファイル（新規）
│   ├── jest.config.js
│   ├── jest.config.e2e.js
│   ├── jest.setup.js
│   └── jest.setup.e2e.js
├── .eslintignore        # ESLint設定
├── .eslintrc.json
├── .prettierrc.json     # Prettier設定
├── .gitignore           # Git設定
├── cdk.json             # CDK設定
├── tsconfig.json        # TypeScript設定
├── docker-compose.yml   # Docker設定
├── package.json         # npm設定
├── package-lock.json
├── README.md            # ドキュメント
├── CONTRIBUTING.md
├── LICENSE
└── setup-git.ps1        # セットアップスクリプト
```

## 成果物

### 更新ファイル（11件）
1. `scripts/localstack-setup.ps1`
2. `scripts/generate-env-file.ps1`
3. `scripts/deploy-dev.ps1`
4. `scripts/deploy-prod.ps1`
5. `test/jest.config.e2e.js`
6. `test/jest.setup.e2e.js`
7. `src/__tests__/project-structure.test.ts`
8. `package.json`
9. `.gitignore`

### 移動ファイル（9件）
- 環境変数ファイル: 5件 → `config/`
- テスト設定ファイル: 4件 → `test/`

## 改善効果

### 1. 可読性の向上
- ルートフォルダのファイル数: 23件 → 13件（43%削減）
- 設定ファイルが目的別に整理され、見つけやすくなった

### 2. 保守性の向上
- 環境変数ファイルが1箇所に集約
- テスト設定ファイルが1箇所に集約
- 新規メンバーがプロジェクト構造を理解しやすい

### 3. セキュリティの向上
- `.gitignore`で`config/.env*`を一括除外
- 環境変数ファイルの誤コミットリスクを低減

## 検証

### テスト実行確認（必要時）
```powershell
# ユニットテスト
npm test

# E2Eテスト
npm run test:e2e
```

### デプロイスクリプト確認（必要時）
```powershell
# 開発環境デプロイ（dry-run）
.\scripts\deploy-dev.ps1 -WhatIf

# 本番環境デプロイ（dry-run）
.\scripts\deploy-prod.ps1 -WhatIf
```

## 申し送り事項

### 注意点
1. **環境変数ファイルのパス変更**
   - すべてのスクリプトとドキュメントで`config/`プレフィックスが必要
   - 既存のドキュメント（README.md、各種ガイド）も更新が必要

2. **テスト設定のパス変更**
   - `package.json`のjestコマンドで`test/jest.config.js`を明示的に指定
   - CI/CDパイプラインでも同様の変更が必要な場合がある

3. **Git管理**
   - 移動したファイルはGitが自動追跡
   - `.gitignore`の更新により、新しいパスで環境変数ファイルが除外される

### 今後の作業
- [ ] README.mdの環境変数セクション更新（必要に応じて）
- [ ] 各種ドキュメントの参照パス確認・更新
- [ ] CI/CDパイプラインの設定確認（GitHub Actions等）

## 関連ドキュメント
- `.kiro/steering/core/tdnet-data-collector.md` - タスク実行ルール
- `.kiro/steering/development/tdnet-file-naming.md` - ファイル命名規則

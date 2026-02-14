---
inclusion: fileMatch
fileMatchPattern: "scripts/deploy*.ps1"
---

# デプロイスクリプト

## スクリプト一覧

| スクリプト | 用途 | 環境 |
|-----------|------|------|
| **deploy.ps1** | 統合デプロイ（推奨） | dev/prod |
| **deploy-dev.ps1** | 開発環境専用 | dev |
| **deploy-prod.ps1** | 本番環境専用 | prod |
| **deploy-split-stacks.ps1** | スタック分割デプロイ | dev/prod |

## deploy.ps1（統合デプロイ）

**目的**: 前提条件チェック、ビルド、テスト、デプロイを一括実行

**パラメータ**:
```powershell
-Environment <dev|prod>      # デフォルト: dev
-Region <string>             # デフォルト: ap-northeast-1
-SkipTests                   # テストスキップ
-SkipBootstrap               # CDK Bootstrapスキップ
-SkipSecretCreation          # API Key Secretスキップ
-SkipEnvGeneration           # .env生成スキップ
```

**使用例**:
```powershell
# 開発環境デプロイ（全ステップ実行）
.\scripts\deploy.ps1

# 本番環境デプロイ（テストスキップ）
.\scripts\deploy.ps1 -Environment prod -SkipTests

# 既存環境への再デプロイ
.\scripts\deploy.ps1 -SkipBootstrap -SkipSecretCreation
```

**実行順序**:
1. 前提条件チェック（Node.js, npm, AWS CLI, CDK, AWS認証）
2. 依存関係インストール（`npm install`）
3. テスト実行（`npm run test`、オプション）
4. ビルド（`npm run build`）
5. API Key Secret作成（オプション）
6. 環境変数ファイル生成（オプション）
7. CDK Bootstrap（オプション）
8. CDK Deploy（本番環境は承認必須）

**出力**: `deployment-log-[YYYYMMDD-HHMMSS].md`

## deploy-dev.ps1（開発環境専用）

**目的**: `.env.development`を使用した開発環境デプロイ

**前提条件**: `.env.development`ファイル必須

**使用例**:
```powershell
.\scripts\deploy-dev.ps1
```

**実行内容**:
1. `.env.development`読み込み
2. CDKディレクトリ移動
3. 依存関係インストール（初回のみ）
4. CDK synth検証
5. CDK deploy（承認不要）

## deploy-prod.ps1（本番環境専用）

**目的**: `.env.production`を使用した本番環境デプロイ

**前提条件**: `.env.production`ファイル必須

**使用例**:
```powershell
.\scripts\deploy-prod.ps1
```

**実行内容**:
1. `.env.production`読み込み
2. 2段階確認プロンプト（"yes" → "DEPLOY"）
3. CDKディレクトリ移動
4. 依存関係インストール（初回のみ）
5. CDK synth検証
6. CDK deploy
7. デプロイ後チェックリスト表示

## deploy-split-stacks.ps1（スタック分割）

**目的**: 依存関係順にスタックを個別デプロイ

**パラメータ**:
```powershell
-Environment <dev|prod>      # 必須
-Action <deploy|destroy|diff|synth>  # 必須
-Stack <foundation|compute|api|monitoring|all>  # デフォルト: all
```

**スタック依存関係**:
```
foundation → compute → api → monitoring
```

**使用例**:
```powershell
# 全スタックデプロイ（依存順）
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy

# 特定スタックのみデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack api

# 差分確認
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff

# 全スタック削除（逆順）
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action destroy
```

**デプロイ順序**: foundation → compute → api → monitoring  
**削除順序**: monitoring → api → compute → foundation

**ビルド検証**: Lambda関数ビルド結果を自動検証（`dist/src/lambda/*/index.js`）

## 推奨フロー

### 初回デプロイ
```powershell
.\scripts\deploy.ps1 -Environment dev
```

### 再デプロイ
```powershell
.\scripts\deploy.ps1 -SkipBootstrap -SkipSecretCreation
```

### 本番デプロイ
```powershell
.\scripts\deploy.ps1 -Environment prod
```

### スタック分割デプロイ
```powershell
# 差分確認
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff

# デプロイ
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy
```

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| AWS認証エラー | `aws configure`で認証情報設定 |
| CDK未インストール | `npm install -g aws-cdk` |
| ビルドファイル不足 | `npm run build`実行 |
| Bootstrap未実行 | `-SkipBootstrap`を外して実行 |
| Secret作成失敗 | 既存Secretを確認、`-SkipSecretCreation`使用 |

## 関連ドキュメント

- **デプロイチェックリスト**: `deployment-checklist.md` - デプロイ前後の確認事項
- **環境変数**: `environment-variables.md` - 環境変数設定方法
- **監視とアラート**: `monitoring-alerts.md` - デプロイ後の監視設定

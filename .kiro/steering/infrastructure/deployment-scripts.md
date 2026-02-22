---
inclusion: fileMatch
fileMatchPattern: "scripts/deploy*.ps1"
---

# デプロイスクリプト

## AWS SSO認証

すべてのデプロイスクリプトは起動時に自動的にAWS SSO認証を実行します。

**プロファイル**: `imanishi-awssso`

**認証フロー**:
1. `startup.ps1`を呼び出し
2. AWS SSO認証状態を確認（`aws sts get-caller-identity`）
3. 未認証または期限切れの場合、`aws sso login --profile imanishi-awssso`を実行
4. 認証成功後、環境変数`AWS_PROFILE=imanishi-awssso`を設定
5. デプロイ処理を継続

**手動でSSO認証のみ実行**:
```powershell
npm run startup
# または
.\scripts\startup.ps1

# 強制的に再認証
.\scripts\startup.ps1 -Force
```

## スクリプト一覧

| スクリプト | 用途 |
|-----------|------|
| **startup.ps1** | AWS SSO認証 |
| **deploy.ps1** | 統合デプロイ（推奨） |
| **deploy-dev.ps1** | 開発環境専用 |
| **deploy-prod.ps1** | 本番環境専用 |
| **deploy-split-stacks.ps1** | スタック分割デプロイ |

## deploy.ps1

```powershell
.\scripts\deploy.ps1 [-Environment dev|prod] [-Region ap-northeast-1] [-SkipTests] [-SkipBootstrap] [-SkipSecretCreation] [-SkipEnvGeneration]
```

実行順序: AWS SSO認証 → 前提条件チェック → npm install → テスト → ビルド → Secret作成 → .env生成 → Bootstrap → Deploy

出力: `deployment-log-[YYYYMMDD-HHMMSS].md`

## deploy-dev.ps1 / deploy-prod.ps1

```powershell
.\scripts\deploy-dev.ps1   # .env.development使用
.\scripts\deploy-prod.ps1  # .env.production使用、2段階確認
```

## deploy-split-stacks.ps1

```powershell
.\scripts\deploy-split-stacks.ps1 -Environment <dev|prod> -Action <deploy|destroy|diff|synth> [-Stack <foundation|compute|api|monitoring|all>]
```

スタック依存: foundation → compute → api → monitoring

## 推奨フロー

```powershell
# 初回
.\scripts\deploy.ps1 -Environment dev

# 再デプロイ
.\scripts\deploy.ps1 -SkipBootstrap -SkipSecretCreation

# 本番
.\scripts\deploy.ps1 -Environment prod

# スタック分割
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy
```

## トラブルシューティング

| エラー | 対処 |
|--------|------|
| AWS SSO認証失敗 | `.\scripts\startup.ps1 -Force` で再認証 |
| AWS認証エラー | `aws configure sso` でプロファイル設定 |
| CDK未インストール | `npm install -g aws-cdk` |
| ビルドファイル不足 | `npm run build` |
| Bootstrap未実行 | `-SkipBootstrap`を外す |
| Secret作成失敗 | `-SkipSecretCreation`使用 |

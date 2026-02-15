# Scripts Overview

TDnet Data Collectorプロジェクトで使用する運用スクリプトの完全ガイド。

## 📁 フォルダ構造

```
scripts/
├── dynamodb-tables/              # DynamoDBテーブル定義
│   ├── tdnet_disclosures.json
│   └── tdnet_executions.json
├── check-iam-permissions.ps1     # IAM権限確認
├── create-api-key-secret.ps1     # APIキー作成
├── deploy-dashboard.ps1          # ダッシュボードデプロイ
├── deploy-dev.ps1                # 開発環境デプロイ
├── deploy-prod.ps1               # 本番環境デプロイ
├── deploy-split-stacks.ps1       # スタック分割デプロイ
├── deploy.ps1                    # 統合デプロイ
├── fetch-data-range.ps1          # データ取得・検証
├── generate-env-file.ps1         # 環境変数ファイル生成
├── localstack-setup.ps1          # LocalStack環境構築
├── manual-data-collection.ps1    # 手動データ収集
└── migrate-disclosure-fields.ts  # DynamoDBデータ移行
```

## 🎯 スクリプト分類

### セットアップスクリプト
初回環境構築時に使用

- `create-api-key-secret.ps1` - Secrets ManagerにAPIキー作成
- `generate-env-file.ps1` - 環境変数ファイル生成
- `localstack-setup.ps1` - LocalStack環境構築（E2Eテスト用）

### デプロイスクリプト
AWS環境へのデプロイ

- `deploy.ps1` - 統合デプロイ（推奨）
- `deploy-dev.ps1` - 開発環境専用
- `deploy-prod.ps1` - 本番環境専用
- `deploy-split-stacks.ps1` - スタック分割デプロイ

### データ操作スクリプト
データ収集・移行・検証

- `fetch-data-range.ps1` - 本番APIからデータ取得
- `manual-data-collection.ps1` - 手動データ収集
- `migrate-disclosure-fields.ts` - DynamoDBフィールド移行

### 監視・運用スクリプト
デプロイ後の監視・確認

- `deploy-dashboard.ps1` - ダッシュボードデプロイ
- `check-iam-permissions.ps1` - IAM権限確認

## 🚀 クイックスタート

### 初回セットアップ（開発環境）

```powershell
# 1. APIキー作成
.\scripts\create-api-key-secret.ps1 -Region ap-northeast-1

# 2. 環境変数ファイル生成
.\scripts\generate-env-file.ps1 -Region ap-northeast-1

# 3. LocalStack環境構築（E2Eテスト用）
docker compose up -d
.\scripts\localstack-setup.ps1

# 4. 統合デプロイ
.\scripts\deploy.ps1 -Environment dev
```

### 本番環境デプロイ

```powershell
# 1. 本番用環境変数ファイル作成
.\scripts\generate-env-file.ps1 -OutputFile config/.env.production -Force

# 2. 本番デプロイ（2段階確認あり）
.\scripts\deploy.ps1 -Environment prod
```

### ダッシュボードデプロイ

```powershell
# 開発環境
.\scripts\deploy-dashboard.ps1 -Environment dev

# 本番環境
.\scripts\deploy-dashboard.ps1 -Environment prod
```

## 📋 詳細ドキュメント

各スクリプトの詳細は以下のドキュメントを参照：

- [セットアップスクリプト](./setup-scripts.md) - 初回環境構築
- [デプロイスクリプト](./deployment-scripts.md) - AWS環境デプロイ
- [データ操作スクリプト](./data-scripts.md) - データ収集・移行
- [監視・運用スクリプト](./monitoring-scripts.md) - 監視・確認

## ⚠️ 前提条件

### 必須ツール

- **PowerShell** 7.0以上（Windows/macOS/Linux）
- **Node.js** 20.x以上
- **npm** 10.x以上
- **AWS CLI** 2.x以上
- **AWS CDK** 2.x以上
- **Docker Desktop**（LocalStack使用時）

### AWS認証情報

すべてのスクリプトは以下のAWS認証情報が必要：

```powershell
# AWS認証情報設定
aws configure

# 認証確認
aws sts get-caller-identity
```

## 🔧 トラブルシューティング

### 共通エラー

| エラー | 解決策 |
|--------|--------|
| AWS CLI not found | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | `aws configure` 実行 |
| CDK not installed | `npm install -g aws-cdk` |
| Node.js version mismatch | Node.js 20.x以上をインストール |
| PowerShell execution policy | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |

### スクリプト別トラブルシューティング

各スクリプトの詳細なトラブルシューティングは、対応するドキュメントを参照してください。

## 📝 ベストプラクティス

### デプロイ前チェックリスト

- [ ] AWS認証情報が正しく設定されている
- [ ] 環境変数ファイル（.env.development/.env.production）が存在する
- [ ] テストが全て通過している（`npm test`）
- [ ] ビルドが成功している（`npm run build`）
- [ ] 本番デプロイの場合、変更内容をレビュー済み

### 本番環境デプロイ時の注意事項

1. **低トラフィック時間帯に実行**
   - 推奨: 深夜0時〜6時（JST）

2. **事前確認**
   ```powershell
   # 変更内容確認
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action diff
   ```

3. **段階的デプロイ**
   ```powershell
   # スタック単位でデプロイ
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack foundation
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack api
   .\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack monitoring
   ```

4. **デプロイ後確認**
   - CloudWatch Logsでエラー確認
   - CloudWatch Metricsで異常値確認
   - API動作確認（スモークテスト）

### データ移行時の注意事項

1. **必ずdry-runで事前確認**
   ```bash
   npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-prod --dry-run
   ```

2. **バックアップ確認**
   - DynamoDBのポイントインタイムリカバリが有効か確認
   - 必要に応じてオンデマンドバックアップ作成

3. **低トラフィック時間帯に実行**

4. **CloudWatch Logsで進捗監視**

## 🔗 関連ドキュメント

- [デプロイメントガイド](../04-deployment/deployment-guide.md)
- [環境セットアップ](../04-deployment/environment-setup.md)
- [監視ガイド](../05-operations/monitoring-guide.md)
- [トラブルシューティング](../05-operations/troubleshooting.md)

# 環境設定ガイド

TDnet Data Collectorの開発環境と本番環境の設定方法。

**最終更新:** 2026-02-15

---

## 関連ドキュメント

- **環境変数管理**: `../../steering/infrastructure/environment-variables.md` - 環境変数一覧と管理方法
- **デプロイチェックリスト**: `../../steering/infrastructure/deployment-checklist.md` - デプロイ手順
- **トラブルシューティング**: `../05-operations/troubleshooting.md` - 問題解決ガイド

---

## 環境一覧

| 環境 | 用途 | デプロイ方法 |
|------|------|------------|
| **local** | ローカル開発（LocalStack） | 手動 |
| **dev** | 開発環境（AWS） | GitHub Actions（developブランチ） |
| **prod** | 本番環境（AWS） | GitHub Actions（mainブランチ） |

---

## 環境変数

環境変数の詳細は `../../steering/infrastructure/environment-variables.md` を参照してください。

**主要な環境変数:**
- `NODE_ENV`: 実行環境（development/production）
- `LOG_LEVEL`: ログレベル（DEBUG/INFO/WARN/ERROR）
- `DYNAMODB_TABLE_NAME`: DynamoDBテーブル名
- `S3_BUCKET_NAME`: S3バケット名

---

## AWS設定概要

### 主要リソース

| リソース | local | dev | prod |
|---------|-------|-----|------|
| **S3バケット（PDF）** | tdnet-pdfs-local | tdnet-pdfs-dev | tdnet-pdfs-prod |
| **S3バケット（Export）** | tdnet-exports-local | tdnet-exports-dev | tdnet-exports-prod |
| **DynamoDBテーブル** | tdnet_disclosures_local | tdnet_disclosures_dev | tdnet_disclosures_prod |
| **Lambda関数** | - | tdnet-collector-dev | tdnet-collector-prod |

**詳細設定:**
- S3: SSE-S3暗号化、パブリックアクセスブロック
- DynamoDB: オンデマンド課金、AWS管理キー暗号化
- Lambda: Node.js 20.x、arm64、X-Rayトレーシング有効

---

## 環境構築手順

### ローカル環境（LocalStack）

1. **LocalStack起動**
   ```powershell
   docker compose up -d
   ```

2. **リソース作成**
   ```powershell
   .\scripts\localstack-setup.ps1
   ```

3. **環境変数設定**
   - `.env.local` ファイルを作成（`.env.example` を参照）

### 開発環境（AWS）

1. **CDK Bootstrap**
   ```powershell
   npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
   ```

2. **デプロイ**
   ```powershell
   npx cdk deploy --context environment=dev
   ```

詳細は `cdk-bootstrap-guide.md` と `deployment-smoke-test.md` を参照。

### 本番環境（AWS）

GitHub Actionsによる自動デプロイ。詳細は `ci-cd-setup.md` を参照。

---

## よくある問題

詳細なトラブルシューティングは `../05-operations/troubleshooting.md` を参照。

### LocalStack接続エラー
- Docker Desktopが起動しているか確認
- `docker ps` でLocalStackコンテナが実行中か確認

### CDK認証エラー
- `aws sts get-caller-identity` で認証情報を確認
- AWS_PROFILE環境変数が正しく設定されているか確認

### Lambda環境変数エラー
- CDKスタックで環境変数が正しく設定されているか確認
- デプロイ後にLambdaコンソールで環境変数を確認

---

## 関連ドキュメント

- **CDK Bootstrap**: `cdk-bootstrap-guide.md` - CDK Bootstrap詳細手順
- **デプロイ**: `deployment-smoke-test.md` - デプロイとスモークテスト
- **CI/CD**: `ci-cd-setup.md` - GitHub Actions設定
- **トラブルシューティング**: `../05-operations/troubleshooting.md` - 問題解決ガイド

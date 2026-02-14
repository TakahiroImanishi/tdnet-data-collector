# LocalStack環境構築ガイド

**最終更新**: 2026-02-15

## LocalStackとは

LocalStackは、AWSクラウドサービスをローカル環境でエミュレートするツールです。

**メリット:**
- コスト削減（AWS無料枠を消費しない）
- 高速（ネットワーク遅延なし）
- オフライン開発可能
- 環境のリセットが容易

## 前提条件

- Docker Desktop
- Node.js 20.x
- npm

---

## クイックスタートガイド

LocalStack環境を素早くセットアップするには、以下の手順を実行してください：

```powershell
# 1. LocalStackを起動
docker-compose up -d

# 2. LocalStackが起動するまで待機（約30秒）
Start-Sleep -Seconds 30

# 3. セットアップスクリプトを実行
.\scripts\localstack-setup.ps1

# 4. 動作確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls

# 5. E2Eテストを実行
npm run test:e2e
```

---

## インストール手順

### 1. Docker Desktopのインストール

- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)

### 2. LocalStackのセットアップ

プロジェクトルートに `docker-compose.yml` が既に用意されています。

```powershell
# LocalStackを起動
docker-compose up -d

# ログを確認
docker-compose logs -f localstack

# 停止
docker-compose down
```

### 3. セットアップスクリプトの実行

`scripts/localstack-setup.ps1` を実行します：

```powershell
# 実行権限を付与（初回のみ）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# LocalStackを起動
docker-compose up -d

# セットアップスクリプトを実行
.\scripts\localstack-setup.ps1
```

スクリプトは以下を自動的に実行します：
- LocalStackの起動確認
- DynamoDBテーブルの作成
- S3バケットの作成
- 作成したリソースの検証

### 4. 環境変数の設定

`.env.local` ファイルが既に用意されています：

```env
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=ap-northeast-1
DYNAMODB_TABLE_DISCLOSURES=tdnet_disclosures
S3_BUCKET_PDFS=tdnet-data-collector-pdfs-local
API_KEY=test-api-key-localstack-e2e
NODE_ENV=test
TEST_ENV=e2e
```

### 5. 動作確認

```powershell
# DynamoDBテーブル一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables

# S3バケット一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls
```

---

## トラブルシューティング

### LocalStackが起動しない

```powershell
# Dockerが起動しているか確認
docker ps

# LocalStackコンテナを削除して再起動
docker-compose down -v
docker-compose up -d
```

### テーブルが作成されない

```powershell
# LocalStackが完全に起動するまで待機
Start-Sleep -Seconds 30

# テーブルを再作成
.\scripts\localstack-setup.ps1
```

### ポート4566が使用中

```powershell
# ポート4566を使用しているプロセスを確認
netstat -ano | findstr :4566

# プロセスを終了（PIDを確認してから）
taskkill /PID <PID> /F

# LocalStackを再起動
docker-compose up -d
```

---

## 参考リンク

- [LocalStack公式ドキュメント](https://docs.localstack.cloud/)
- [Docker Compose公式ドキュメント](https://docs.docker.com/compose/)

# LocalStack環境構築ガイド

**作成日**: 2026-02-08  
**目的**: ローカル開発環境でAWSサービス（DynamoDB、S3）をエミュレートし、統合テストを実行する

## LocalStackとは

LocalStackは、AWSクラウドサービスをローカル環境でエミュレートするツールです。開発・テスト時にAWSリソースを使用せずに、ローカルで完結した開発が可能になります。

### メリット

- **コスト削減**: AWS無料枠を消費せずにテスト可能
- **高速**: ネットワーク遅延がなく、テストが高速
- **オフライン開発**: インターネット接続不要
- **リセット容易**: 環境を簡単にリセット可能

## 前提条件

- Docker Desktop（Windows/Mac）またはDocker Engine（Linux）
- Node.js 20.x
- npm または yarn

## インストール手順

### 1. Docker Desktopのインストール

**Windows:**
1. [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)をダウンロード
2. インストーラーを実行
3. WSL 2バックエンドを有効化（推奨）
4. Docker Desktopを起動

**Mac:**
1. [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)をダウンロード
2. インストーラーを実行
3. Docker Desktopを起動

### 2. LocalStackのインストール

#### 方法1: Docker Composeを使用（推奨）

プロジェクトルートに `docker-compose.yml` を作成:

```yaml
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    container_name: tdnet-localstack
    ports:
      - "4566:4566"  # LocalStack Gateway
      - "4510-4559:4510-4559"  # 外部サービスポート範囲
    environment:
      - SERVICES=dynamodb,s3,cloudwatch,sns,sqs
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - DOCKER_HOST=unix:///var/run/docker.sock
      - LAMBDA_EXECUTOR=docker
      - LAMBDA_REMOTE_DOCKER=false
    volumes:
      - "./localstack-data:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
    networks:
      - tdnet-network

networks:
  tdnet-network:
    driver: bridge
```

起動コマンド:

```powershell
# LocalStackを起動
docker-compose up -d

# ログを確認
docker-compose logs -f localstack

# 停止
docker-compose down

# データを削除して再起動
docker-compose down -v
docker-compose up -d
```

#### 方法2: LocalStack CLIを使用

```powershell
# LocalStack CLIをインストール
pip install localstack

# LocalStackを起動
localstack start -d

# 状態確認
localstack status

# 停止
localstack stop
```

### 3. AWS CLIのLocalStack設定

#### AWS CLI v2のインストール

**Windows:**
```powershell
# MSIインストーラーをダウンロード
# https://awscli.amazonaws.com/AWSCLIV2.msi
```

**Mac:**
```bash
brew install awscli
```

#### LocalStack用プロファイル設定

`~/.aws/config` に追加:

```ini
[profile localstack]
region = ap-northeast-1
output = json
endpoint_url = http://localhost:4566
```

`~/.aws/credentials` に追加:

```ini
[localstack]
aws_access_key_id = test
aws_secret_access_key = test
```

#### 動作確認

```powershell
# S3バケット一覧を取得（LocalStack）
aws --profile localstack --endpoint-url=http://localhost:4566 s3 ls

# DynamoDBテーブル一覧を取得（LocalStack）
aws --profile localstack --endpoint-url=http://localhost:4566 dynamodb list-tables
```

## LocalStack環境のセットアップ

### 1. DynamoDBテーブルの作成

`scripts/localstack-setup.sh` を作成:

```bash
#!/bin/bash

# LocalStackエンドポイント
ENDPOINT="http://localhost:4566"
REGION="ap-northeast-1"

echo "Creating DynamoDB tables..."

# Disclosuresテーブル
aws --endpoint-url=$ENDPOINT \
    --region=$REGION \
    dynamodb create-table \
    --table-name tdnet-disclosures-local \
    --attribute-definitions \
        AttributeName=disclosure_id,AttributeType=S \
        AttributeName=date_partition,AttributeType=S \
        AttributeName=disclosed_at,AttributeType=S \
    --key-schema \
        AttributeName=disclosure_id,KeyType=HASH \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"DatePartitionIndex\",
                \"KeySchema\": [
                    {\"AttributeName\":\"date_partition\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"disclosed_at\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"},
                \"ProvisionedThroughput\": {\"ReadCapacityUnits\":5,\"WriteCapacityUnits\":5}
            }
        ]" \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5

# ExecutionStatusテーブル
aws --endpoint-url=$ENDPOINT \
    --region=$REGION \
    dynamodb create-table \
    --table-name tdnet-execution-status-local \
    --attribute-definitions \
        AttributeName=execution_id,AttributeType=S \
    --key-schema \
        AttributeName=execution_id,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5

echo "DynamoDB tables created successfully!"
```

PowerShell版 `scripts/localstack-setup.ps1`:

```powershell
# LocalStackエンドポイント
$ENDPOINT = "http://localhost:4566"
$REGION = "ap-northeast-1"

Write-Host "Creating DynamoDB tables..."

# Disclosuresテーブル
aws --endpoint-url=$ENDPOINT `
    --region=$REGION `
    dynamodb create-table `
    --table-name tdnet-disclosures-local `
    --attribute-definitions `
        AttributeName=disclosure_id,AttributeType=S `
        AttributeName=date_partition,AttributeType=S `
        AttributeName=disclosed_at,AttributeType=S `
    --key-schema `
        AttributeName=disclosure_id,KeyType=HASH `
    --global-secondary-indexes `
        '[{"IndexName":"DatePartitionIndex","KeySchema":[{"AttributeName":"date_partition","KeyType":"HASH"},{"AttributeName":"disclosed_at","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' `
    --provisioned-throughput `
        ReadCapacityUnits=5,WriteCapacityUnits=5

# ExecutionStatusテーブル
aws --endpoint-url=$ENDPOINT `
    --region=$REGION `
    dynamodb create-table `
    --table-name tdnet-execution-status-local `
    --attribute-definitions `
        AttributeName=execution_id,AttributeType=S `
    --key-schema `
        AttributeName=execution_id,KeyType=HASH `
    --provisioned-throughput `
        ReadCapacityUnits=5,WriteCapacityUnits=5

Write-Host "DynamoDB tables created successfully!"
```

実行:

```powershell
# 実行権限を付与（初回のみ）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# スクリプトを実行
.\scripts\localstack-setup.ps1
```

### 2. S3バケットの作成

```powershell
# S3バケットを作成
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    s3 mb s3://tdnet-pdfs-local

# バケット一覧を確認
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    s3 ls
```

### 3. 環境変数の設定

`.env.local` ファイルを作成:

```env
# LocalStack環境変数
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# DynamoDB
DYNAMODB_TABLE_NAME=tdnet-disclosures-local
EXECUTION_STATUS_TABLE_NAME=tdnet-execution-status-local

# S3
S3_BUCKET_NAME=tdnet-pdfs-local

# その他
LOG_LEVEL=debug
NODE_ENV=local
```

## 統合テストでの使用

### Jest設定の更新

`jest.config.js` に環境変数を追加:

```javascript
module.exports = {
  // ... 既存の設定
  setupFiles: ['<rootDir>/jest.setup.js'],
};
```

`jest.setup.js` を作成:

```javascript
// LocalStack環境変数を設定
if (process.env.NODE_ENV === 'test') {
  process.env.AWS_ENDPOINT_URL = 'http://localhost:4566';
  process.env.AWS_REGION = 'ap-northeast-1';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.DYNAMODB_TABLE_NAME = 'tdnet-disclosures-local';
  process.env.EXECUTION_STATUS_TABLE_NAME = 'tdnet-execution-status-local';
  process.env.S3_BUCKET_NAME = 'tdnet-pdfs-local';
}
```

### AWS SDKクライアントの設定

`src/utils/aws-clients.ts` を作成:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';

const isLocalStack = process.env.AWS_ENDPOINT_URL !== undefined;

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});

export const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  forcePathStyle: true, // LocalStackで必須
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});
```

### 統合テストの実行

```powershell
# LocalStackを起動
docker-compose up -d

# テーブルとバケットを作成
.\scripts\localstack-setup.ps1

# 統合テストを実行
npm run test:integration

# LocalStackを停止
docker-compose down
```

## トラブルシューティング

### 1. LocalStackが起動しない

**症状**: `docker-compose up` でエラーが発生

**解決策**:
```powershell
# Dockerが起動しているか確認
docker ps

# LocalStackコンテナを削除して再起動
docker-compose down -v
docker-compose up -d
```

### 2. テーブルが作成されない

**症状**: `ResourceNotFoundException: Cannot do operations on a non-existent table`

**解決策**:
```powershell
# テーブル一覧を確認
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# テーブルを再作成
.\scripts\localstack-setup.ps1
```

### 3. S3バケットにアクセスできない

**症状**: `NoSuchBucket` エラー

**解決策**:
```powershell
# バケット一覧を確認
aws --endpoint-url=http://localhost:4566 s3 ls

# バケットを再作成
aws --endpoint-url=http://localhost:4566 s3 mb s3://tdnet-pdfs-local
```

### 4. ポート4566が使用中

**症状**: `Error starting userland proxy: listen tcp4 0.0.0.0:4566: bind: address already in use`

**解決策**:
```powershell
# ポート4566を使用しているプロセスを確認
netstat -ano | findstr :4566

# プロセスを終了（PIDを確認してから）
taskkill /PID <PID> /F

# LocalStackを再起動
docker-compose up -d
```

## 参考リンク

- [LocalStack公式ドキュメント](https://docs.localstack.cloud/)
- [LocalStack GitHub](https://github.com/localstack/localstack)
- [AWS CLI LocalStack設定](https://docs.localstack.cloud/user-guide/integrations/aws-cli/)
- [Docker Compose公式ドキュメント](https://docs.docker.com/compose/)

## 次のステップ

1. **統合テストの実装**: Property 1-2の統合テストを完成させる
2. **CI/CD統合**: GitHub ActionsでLocalStackを使用した自動テストを実行
3. **パフォーマンステスト**: LocalStackでの負荷テストを実施
4. **開発環境デプロイ**: 実際のAWS環境へのデプロイとスモークテスト

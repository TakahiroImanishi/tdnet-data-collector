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

### 2. LocalStackのセットアップ（Docker Compose使用）

プロジェクトルートに `docker-compose.yml` が既に用意されています。

#### LocalStackの起動

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

#### DynamoDBテーブルとS3バケットの自動作成

セットアップスクリプト `scripts/localstack-setup.ps1` を実行します：

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
- DynamoDBテーブルの作成（`tdnet_disclosures`, `tdnet_executions`）
- S3バケットの作成（`tdnet-data-collector-pdfs-local`, `tdnet-data-collector-exports-local`）
- 作成したリソースの検証

### 3. 環境変数の設定

`.env.local` ファイルが既に用意されています。このファイルには以下の設定が含まれています：

```env
# LocalStack環境変数
AWS_ENDPOINT_URL=http://localhost:4566
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# DynamoDB
DYNAMODB_TABLE_DISCLOSURES=tdnet_disclosures
DYNAMODB_TABLE_EXECUTIONS=tdnet_executions

# S3
S3_BUCKET_PDFS=tdnet-data-collector-pdfs-local
S3_BUCKET_EXPORTS=tdnet-data-collector-exports-local

# API Key
API_KEY=test-api-key-localstack-e2e

# その他
LOG_LEVEL=DEBUG
ENVIRONMENT=local
NODE_ENV=test
TEST_ENV=e2e
```

### 4. 動作確認

```powershell
# DynamoDBテーブル一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables

# S3バケット一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls
```

### 5. AWS CLIのLocalStack設定（オプション）

### 5. AWS CLIのLocalStack設定（オプション）

AWS CLIでLocalStackを使用する場合は、プロファイルを設定できます。

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

## LocalStack環境のセットアップ（詳細）

### セットアップスクリプトの詳細

`scripts/localstack-setup.ps1` は以下の処理を実行します：

1. **LocalStackの起動確認**
   - ヘルスチェックエンドポイント（`http://localhost:4566/_localstack/health`）を確認
   - LocalStackが起動していない場合は、エラーメッセージを表示して終了

2. **DynamoDBテーブルの作成**
   - `tdnet_disclosures` テーブル
     - パーティションキー: `disclosure_id` (String)
     - GSI: `DatePartitionIndex`（`date_partition` + `disclosed_at`）
   - `tdnet_executions` テーブル
     - パーティションキー: `execution_id` (String)
     - GSI: `StartedAtIndex`（`started_at`）

3. **S3バケットの作成**
   - `tdnet-data-collector-pdfs-local` - PDF保存用
   - `tdnet-data-collector-exports-local` - エクスポートファイル保存用

4. **リソースの検証**
   - 作成したテーブルとバケットが正しく作成されたか確認
   - 結果をカラフルな出力で表示

### 手動でのリソース作成（参考）

セットアップスクリプトを使用せずに、手動でリソースを作成する場合：

#### DynamoDBテーブルの作成

```powershell
# Disclosuresテーブル
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    dynamodb create-table `
    --table-name tdnet_disclosures `
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

# Executionsテーブル
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    dynamodb create-table `
    --table-name tdnet_executions `
    --attribute-definitions `
        AttributeName=execution_id,AttributeType=S `
        AttributeName=started_at,AttributeType=S `
    --key-schema `
        AttributeName=execution_id,KeyType=HASH `
    --global-secondary-indexes `
        '[{"IndexName":"StartedAtIndex","KeySchema":[{"AttributeName":"started_at","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' `
    --provisioned-throughput `
        ReadCapacityUnits=5,WriteCapacityUnits=5
```

#### S3バケットの作成

```powershell
# S3バケットを作成
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    s3 mb s3://tdnet-data-collector-pdfs-local

aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    s3 mb s3://tdnet-data-collector-exports-local

# バケット一覧を確認
aws --endpoint-url=http://localhost:4566 `
    --region=ap-northeast-1 `
    s3 ls
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
  process.env.DYNAMODB_TABLE_DISCLOSURES = 'tdnet_disclosures';
  process.env.DYNAMODB_TABLE_EXECUTIONS = 'tdnet_executions';
  process.env.S3_BUCKET_PDFS = 'tdnet-data-collector-pdfs-local';
  process.env.S3_BUCKET_EXPORTS = 'tdnet-data-collector-exports-local';
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

# E2Eテストを実行
npm run test:e2e

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

# ログを確認
docker-compose logs -f localstack
```

### 2. テーブルが作成されない

**症状**: `ResourceNotFoundException: Cannot do operations on a non-existent table`

**解決策**:
```powershell
# LocalStackが完全に起動するまで待機
Start-Sleep -Seconds 30

# テーブル一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables

# テーブルを再作成
.\scripts\localstack-setup.ps1
```

### 3. S3バケットにアクセスできない

**症状**: `NoSuchBucket` エラー

**解決策**:
```powershell
# バケット一覧を確認
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls

# バケットを再作成
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 mb s3://tdnet-data-collector-pdfs-local
aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 mb s3://tdnet-data-collector-exports-local
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

### 5. セットアップスクリプトが実行できない

**症状**: `.\scripts\localstack-setup.ps1 : このシステムではスクリプトの実行が無効になっているため...`

**解決策**:
```powershell
# 実行ポリシーを確認
Get-ExecutionPolicy

# 実行ポリシーを変更（CurrentUserスコープのみ）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# スクリプトを再実行
.\scripts\localstack-setup.ps1
```

### 6. AWS CLIが見つからない

**症状**: `aws : 用語 'aws' は、コマンドレット、関数、スクリプト ファイル、または操作可能なプログラムの名前として認識されません。`

**解決策**:
```powershell
# AWS CLI v2をインストール
# https://awscli.amazonaws.com/AWSCLIV2.msi からダウンロードしてインストール

# インストール後、PowerShellを再起動

# AWS CLIのバージョンを確認
aws --version
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

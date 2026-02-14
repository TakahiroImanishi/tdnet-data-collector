# Work Log: LocalStack環境のセットアップ

**作成日時**: 2026-02-08 12:19:21  
**タスク**: 15.11 LocalStack環境のセットアップ  
**優先度**: 🔴 Critical  
**推定工数**: 2-3時間

---

## タスク概要

### 目的
E2Eテスト環境として、LocalStackを使用したローカルAWS環境をセットアップする。

### 背景
- E2Eテストを実行するために、ローカルでAWSサービス（DynamoDB、S3、CloudWatch、API Gateway、Lambda）をエミュレートする必要がある
- 実際のAWS環境を使用せずに、コスト効率的にテストを実行できる環境を構築する

### 目標
- Docker Composeファイルの作成
- セットアップスクリプトの作成（DynamoDBテーブル、S3バケットの自動作成）
- 環境変数ファイルの作成
- ドキュメントの更新

---

## 実施計画

1. **既存ファイルの確認**
   - docs/localstack-setup.md の確認
   - docs/e2e-test-guide.md の確認
   - .env.development の確認

2. **Docker Composeファイルの作成**
   - docker-compose.yml の作成
   - LocalStackサービスの設定

3. **セットアップスクリプトの作成**
   - scripts/localstack-setup.ps1 の作成
   - DynamoDBテーブルの自動作成
   - S3バケットの自動作成

4. **環境変数ファイルの作成**
   - .env.local の作成

5. **ドキュメントの更新**
   - docs/localstack-setup.md の更新

---

## 実施内容

### 1. 既存ファイルの確認

既存のドキュメントを確認しました：
- `.kiro/specs/tdnet-data-collector/docs/localstack-setup.md` - LocalStack環境構築ガイド（既存）
- `.kiro/specs/tdnet-data-collector/docs/e2e-test-guide.md` - E2Eテスト実行ガイド（既存）
- `.env.development` - 開発環境設定ファイル（既存）

既存のドキュメントには、LocalStackの基本的なセットアップ方法が記載されていましたが、Docker Composeファイルやセットアップスクリプトは未作成でした。

### 2. Docker Composeファイルの作成

`docker-compose.yml` を作成しました：

**主な設定:**
- LocalStackイメージ: `localstack/localstack:latest`
- ポート設定: 4566（LocalStack Gateway）、4510-4559（外部サービスポート範囲）
- エミュレートするサービス: DynamoDB、S3、CloudWatch、API Gateway、Lambda
- データ永続化: `./localstack-data` ディレクトリにマウント
- ヘルスチェック: 10秒間隔でLocalStackの健全性を確認

**特徴:**
- `PERSISTENCE=1` でデータを永続化
- `LAMBDA_EXECUTOR=docker` でLambda関数をDockerコンテナで実行
- ヘルスチェックにより、LocalStackが完全に起動するまで待機

### 3. セットアップスクリプトの作成

`scripts/localstack-setup.ps1` を作成しました：

**機能:**
1. LocalStackの起動確認（ヘルスチェックエンドポイントを確認）
2. DynamoDBテーブルの自動作成:
   - `tdnet_disclosures` テーブル（DatePartitionIndex GSI付き）
   - `tdnet_executions` テーブル（StartedAtIndex GSI付き）
3. S3バケットの自動作成:
   - `tdnet-data-collector-pdfs-local`
   - `tdnet-data-collector-exports-local`
4. 作成したリソースの検証
5. カラフルな出力（成功、情報、警告、エラーを色分け）

**エラーハンドリング:**
- LocalStackが起動していない場合は、エラーメッセージを表示して終了
- テーブルやバケットが既に存在する場合は、警告を表示して継続
- すべてのリソースを検証し、作成状況を確認

### 4. 環境変数ファイルの作成

`.env.local` を作成しました：

**主な設定:**
- AWS_ENDPOINT_URL: `http://localhost:4566`（LocalStackエンドポイント）
- AWS_REGION: `ap-northeast-1`
- AWS_ACCESS_KEY_ID/SECRET_ACCESS_KEY: `test`（LocalStackの仕様）
- DynamoDBテーブル名: `tdnet_disclosures`, `tdnet_executions`
- S3バケット名: `tdnet-data-collector-pdfs-local`, `tdnet-data-collector-exports-local`
- API_KEY: `test-api-key-localstack-e2e`（E2Eテスト用）
- LOG_LEVEL: `DEBUG`
- ENVIRONMENT: `local`
- NODE_ENV: `test`
- TEST_ENV: `e2e`

**注意事項:**
- LocalStack環境専用の設定
- 本番環境では絶対に使用しない
- E2Eテスト実行前にLocalStackを起動する必要がある

### 5. .gitignoreの更新


LocalStackのデータディレクトリ（`localstack-data/`）を `.gitignore` に追加しました。

### 6. ドキュメントの更新

`.kiro/specs/tdnet-data-collector/docs/localstack-setup.md` を更新しました：

**更新内容:**
- Docker Composeを使用したセットアップ手順を追加
- セットアップスクリプトの使用方法を追加
- クイックスタートガイドを追加
- トラブルシューティングセクションを拡充
- 手動でのリソース作成手順を追加（参考用）

**主な改善点:**
- セットアップ手順を簡素化（3ステップで完了）
- カラフルな出力で視認性を向上
- エラーハンドリングを強化
- 動作確認コマンドを追加

---

## 成果物

### 作成したファイル

1. **docker-compose.yml**
   - LocalStackサービスの定義
   - ポート設定、環境変数、ボリュームマウント
   - ヘルスチェック設定

2. **scripts/localstack-setup.ps1**
   - DynamoDBテーブルの自動作成
   - S3バケットの自動作成
   - リソースの検証
   - カラフルな出力

3. **.env.local**
   - LocalStack環境変数の設定
   - DynamoDB、S3、API設定
   - E2Eテスト用の設定

### 更新したファイル

1. **.gitignore**
   - `localstack-data/` ディレクトリを除外

2. **.kiro/specs/tdnet-data-collector/docs/localstack-setup.md**
   - セットアップ手順を更新
   - クイックスタートガイドを追加
   - トラブルシューティングを拡充

---

## 動作確認

### 1. LocalStackの起動

```powershell
PS> docker-compose up -d
[+] Running 2/2
 ✔ Network investment_analysis_opopo_tdnet-network  Created
 ✔ Container tdnet-localstack                       Started
```

### 2. セットアップスクリプトの実行

```powershell
PS> .\scripts\localstack-setup.ps1
ℹ️  Checking LocalStack availability...
✅ LocalStack is running
ℹ️  Creating DynamoDB tables...
ℹ️  Creating table: tdnet_disclosures
✅ Table 'tdnet_disclosures' created successfully
ℹ️  Creating table: tdnet_executions
✅ Table 'tdnet_executions' created successfully
ℹ️  Waiting for tables to be active...
ℹ️  Verifying tables...
✅ Table 'tdnet_disclosures' verified
✅ Table 'tdnet_executions' verified
ℹ️  Creating S3 buckets...
ℹ️  Creating bucket: tdnet-data-collector-pdfs-local
✅ Bucket 'tdnet-data-collector-pdfs-local' created successfully
ℹ️  Creating bucket: tdnet-data-collector-exports-local
✅ Bucket 'tdnet-data-collector-exports-local' created successfully
ℹ️  Verifying buckets...
✅ Bucket 'tdnet-data-collector-pdfs-local' verified
✅ Bucket 'tdnet-data-collector-exports-local' verified

========================================
LocalStack Setup Complete!
========================================

ℹ️  DynamoDB Tables:
  - tdnet_disclosures (with DatePartitionIndex GSI)
  - tdnet_executions (with StartedAtIndex GSI)

ℹ️  S3 Buckets:
  - tdnet-data-collector-pdfs-local
  - tdnet-data-collector-exports-local

ℹ️  Next Steps:
  1. Copy .env.local.example to .env.local
  2. Run tests: npm run test:e2e
  3. Check LocalStack logs: docker-compose logs -f localstack
```

### 3. リソースの確認

```powershell
# DynamoDBテーブル一覧
PS> aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 dynamodb list-tables
{
    "TableNames": [
        "tdnet_disclosures",
        "tdnet_executions"
    ]
}

# S3バケット一覧
PS> aws --endpoint-url=http://localhost:4566 --region=ap-northeast-1 s3 ls
2026-02-08 12:25:00 tdnet-data-collector-exports-local
2026-02-08 12:25:00 tdnet-data-collector-pdfs-local
```

---

## 次回への申し送り

### 完了した作業

✅ Docker Composeファイルの作成  
✅ セットアップスクリプトの作成（PowerShell版）  
✅ 環境変数ファイルの作成（.env.local）  
✅ .gitignoreの更新  
✅ ドキュメントの更新（localstack-setup.md）  
✅ 動作確認（LocalStack起動、リソース作成、検証）

### 未完了の作業

なし（すべての要件を満たしました）

### 注意事項

1. **Docker Desktopのインストールが必要**
   - LocalStackを使用するには、Docker Desktopがインストールされている必要があります
   - Windows: WSL 2バックエンドを有効化することを推奨

2. **AWS CLIのインストールが必要**
   - セットアップスクリプトを実行するには、AWS CLI v2がインストールされている必要があります
   - インストール: https://awscli.amazonaws.com/AWSCLIV2.msi

3. **PowerShell実行ポリシー**
   - セットアップスクリプトを実行する前に、実行ポリシーを変更する必要がある場合があります
   - コマンド: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

4. **LocalStackの起動時間**
   - LocalStackが完全に起動するまで約30秒かかります
   - セットアップスクリプトを実行する前に、LocalStackが起動していることを確認してください
   - 確認方法: `docker-compose logs -f localstack` でログを確認

5. **データの永続化**
   - LocalStackのデータは `localstack-data/` ディレクトリに永続化されます
   - データをリセットする場合は、`docker-compose down -v` を実行してください

6. **E2Eテストの実行**
   - E2Eテストを実行する前に、LocalStackが起動していることを確認してください
   - 環境変数は `.env.local` ファイルに設定されています

### 推奨される次のステップ

1. **E2Eテストの実行**
   - LocalStack環境でE2Eテストを実行し、動作を確認する
   - コマンド: `npm run test:e2e`

2. **CI/CD統合**
   - GitHub ActionsでLocalStackを使用した自動テストを設定する
   - `.github/workflows/e2e-test.yml` を作成

3. **統合テストの実装**
   - Property 1-2の統合テストを完成させる
   - LocalStack環境でテストを実行

4. **パフォーマンステスト**
   - LocalStackでの負荷テストを実施
   - レート制限の動作を確認

---

## まとめ

LocalStack環境のセットアップを完了しました。Docker Compose、セットアップスクリプト、環境変数ファイルを作成し、ドキュメントを更新しました。

**主な成果:**
- 3ステップで簡単にセットアップ可能
- カラフルな出力で視認性が向上
- エラーハンドリングを強化
- データの永続化に対応
- ヘルスチェックで起動を確認

**次のアクション:**
- E2Eテストの実行
- CI/CD統合
- 統合テストの実装


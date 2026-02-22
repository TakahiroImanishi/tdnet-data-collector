# テンプレートファイル - 使用ガイド

このフォルダには、TDnet Data Collectorプロジェクトの実装に必要なテンプレートファイルが含まれています。

## 📋 目次

1. [クイックスタート](#クイックスタート)
2. [テンプレートファイル一覧](#テンプレートファイル一覧)
3. [環境別セットアップガイド](#環境別セットアップガイド)
4. [トラブルシューティング](#トラブルシューティング)
5. [よくある質問（FAQ）](#よくある質問faq)

---

## クイックスタート

### 初回セットアップ（5分で完了）

プロジェクトルートで以下のコマンドを実行：

```bash
# 1. package.jsonをコピー
cp .kiro/specs/tdnet-data-collector/templates/package.json.example package.json

# 2. 依存関係をインストール
npm install

# 3. 環境変数ファイルを作成
cp .kiro/specs/tdnet-data-collector/templates/.env.example .env.local

# 4. CDK Context設定をコピー
cp .kiro/specs/tdnet-data-collector/templates/cdk.context.json.example cdk.context.json

# 5. GitHub Actionsワークフローをコピー（オプション）
mkdir -p .github/workflows
cp .kiro/specs/tdnet-data-collector/templates/github-workflows/*.yml .github/workflows/
```

### 次のステップ

1. `.env.local`を編集してAWS設定を入力
2. `cdk.context.json`を編集してアカウントIDとリージョンを設定
3. `npm run build`でビルドを確認
4. `npm test`でテストを実行

---

## テンプレートファイル一覧

### 1. package.json.example

**概要:** プロジェクトのnpm設定とスクリプト定義

**含まれる内容:**
- AWS SDK v3（DynamoDB、S3、Secrets Manager、SNS、CloudWatch）
- スクレイピングライブラリ（cheerio、axios）
- テストフレームワーク（Jest、fast-check）
- 開発ツール（TypeScript、ESLint、Prettier）
- AWS CDK v2

**使用方法:**

```bash
# プロジェクトルートで実行
cp .kiro/specs/tdnet-data-collector/templates/package.json.example package.json
npm install
```


**利用可能なnpmスクリプト:**

| スクリプト | 説明 | 使用例 |
|-----------|------|--------|
| `npm run build` | TypeScriptをコンパイル | ビルド確認 |
| `npm test` | すべてのテストを実行 | CI/CD |
| `npm run test:coverage` | カバレッジレポート生成 | カバレッジ確認 |
| `npm run test:property` | プロパティテストのみ実行 | 特定テスト |
| `npm run lint` | ESLintでコードチェック | コード品質確認 |
| `npm run lint:fix` | ESLintで自動修正 | コード整形 |
| `npm run format` | Prettierでフォーマット | コード整形 |
| `npm run cdk:synth` | CDKテンプレート生成 | デプロイ前確認 |
| `npm run cdk:diff` | CDK差分確認 | 変更内容確認 |
| `npm run cdk:deploy` | CDKデプロイ | インフラデプロイ |

---

### 2. .env.example

**概要:** 環境変数テンプレート（ローカル開発・デプロイ用）

**使用方法:**

```bash
# 環境別にファイルを作成
cp .kiro/specs/tdnet-data-collector/templates/.env.example .env.local
cp .kiro/specs/tdnet-data-collector/templates/.env.example .env.development
cp .kiro/specs/tdnet-data-collector/templates/.env.example .env.production

# .gitignoreに追加（重要！）
echo ".env*" >> .gitignore
echo "!.env.example" >> .gitignore
```

**詳細な設定方法は後述の「環境別セットアップガイド」を参照してください。**

---

### 3. cdk.context.json.example

**概要:** AWS CDK環境別設定テンプレート

**使用方法:**

```bash
# プロジェクトルートにコピー
cp .kiro/specs/tdnet-data-collector/templates/cdk.context.json.example cdk.context.json

# 環境を指定してデプロイ
cdk deploy --context environment=development
cdk deploy --context environment=production
```

---

### 4. github-workflows/

**概要:** GitHub Actions CI/CDワークフローテンプレート

**使用方法:**

```bash
# プロジェクトルートで実行
mkdir -p .github/workflows
cp .kiro/specs/tdnet-data-collector/templates/github-workflows/*.yml .github/workflows/
```

#### 4.1 test.yml - テスト自動実行

**トリガー:** `main`/`develop`ブランチへのpush、Pull Request作成時

**実行内容:** Linter、型チェック、テスト、カバレッジチェック（80%以上）

#### 4.2 deploy.yml - デプロイ自動化

**トリガー:** `main`ブランチへのpush、手動実行

**必要なGitHub Secrets:**
- `AWS_ROLE_ARN` - AWSロールARN
- `API_ENDPOINT` - APIエンドポイントURL
- `API_KEY` - APIキー
- `SLACK_WEBHOOK` - Slack Webhook URL（オプション）

---

## 環境別セットアップガイド

### ローカル開発環境（local）

**.env.local の設定例:**

```bash
AWS_REGION=ap-northeast-1
AWS_PROFILE=default
ENVIRONMENT=local
LOG_LEVEL=DEBUG
```

**テスト実行:**

```bash
npm test
npm run test:coverage
```

---

### 開発環境（development）

**.env.development の設定例:**

```bash
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012
DYNAMODB_TABLE_NAME=tdnet-disclosures-dev
S3_PDF_BUCKET_NAME=tdnet-pdfs-dev-123456789012
ENVIRONMENT=development
LOG_LEVEL=INFO
```

**デプロイ手順:**

```bash
npm run cdk:synth -- --context environment=development
npm run cdk:diff -- --context environment=development
npm run cdk:deploy -- --context environment=development
```

---

### 本番環境（production）

**.env.production の設定例:**

```bash
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=987654321098
DYNAMODB_TABLE_NAME=tdnet-disclosures-prod
S3_PDF_BUCKET_NAME=tdnet-pdfs-prod-987654321098
LAMBDA_MEMORY_SIZE=1024
LOG_LEVEL=WARN
ENVIRONMENT=production
SECRETS_MANAGER_SECRET_NAME=tdnet-data-collector-prod
```

**本番デプロイ手順:**

```bash
# 1. テスト実行
npm test
npm run test:coverage

# 2. 変更内容確認
npm run cdk:diff -- --context environment=production

# 3. デプロイ実行
npm run cdk:deploy -- --context environment=production

# 4. スモークテスト
npm run test:smoke
```

---

## トラブルシューティング

### 問題1: npm installが失敗する

**症状:** `npm ERR! code ERESOLVE`

**解決策:**

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

### 問題2: CDKデプロイが失敗する

**症状:** `Error: Need to perform AWS calls for account`

**解決策:**

```bash
aws configure
export AWS_PROFILE=your-profile-name
npm run cdk:deploy -- --context environment=development
```

---

### 問題3: 環境変数が読み込まれない

**原因:** CDKスタックで環境変数が設定されていない

**解決策:** CDKスタックで環境変数を明示的に設定

```typescript
environment: {
    S3_BUCKET_NAME: pdfBucket.bucketName,
    DYNAMODB_TABLE_NAME: table.tableName,
}
```

---

### 問題4: GitHub Actionsワークフローが失敗する

**原因:** GitHub Secretsが未設定

**解決策:**

```bash
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::123456789012:role/GitHubActionsRole"
gh secret set API_KEY --body "your-api-key"
```

---

## よくある質問（FAQ）

### Q1: どの環境変数が必須ですか？

**A:** 以下が必須です：
- `AWS_REGION`
- `DYNAMODB_TABLE_NAME`
- `S3_PDF_BUCKET_NAME`
- `ENVIRONMENT`

---

### Q2: ローカル開発時にAWSリソースを使用しますか？

**A:** はい、実際のAWSリソースを使用します。LocalStackやモックも使用可能です。

---

### Q3: 本番環境と開発環境で異なるAWSアカウントを使用すべきですか？

**A:** はい、強く推奨します。セキュリティの分離と誤操作の防止のためです。

---

### Q4: APIキーはどこに保存すべきですか？

**A:** 
- ローカル開発: `.env.local`（gitignore必須）
- 本番環境: AWS Secrets Manager（必須）

---

### Q5: コスト最適化のヒントは？

**A:** 
- DynamoDB: オンデマンドモード使用
- S3: ライフサイクルポリシーでGlacierに移行
- Lambda: メモリサイズを適切に設定（512MB推奨）
- CloudWatch Logs: ログ保持期間を短く（7-30日）
- Point-in-Time Recovery: 個人利用では無効化

---

## 関連ドキュメント

- **環境セットアップ**: `../docs/environment-setup.md`
- **設計書**: `../docs/design.md`
- **実装チェックリスト**: `../docs/implementation-checklist.md`
- **トラブルシューティング**: `../docs/troubleshooting.md`

---

**最終更新日**: 2026-02-07

# Deployment Scripts

AWS環境へのデプロイを実行するスクリプトの詳細ガイド。

## スクリプト一覧

| スクリプト | 用途 | 推奨度 |
|-----------|------|--------|
| **deploy.ps1** | 統合デプロイ（前提条件チェック〜デプロイまで） | ⭐⭐⭐ 推奨 |
| **deploy-dev.ps1** | 開発環境専用デプロイ | ⭐⭐ 簡易デプロイ |
| **deploy-prod.ps1** | 本番環境専用デプロイ（2段階確認） | ⭐⭐ 簡易デプロイ |
| **deploy-split-stacks.ps1** | スタック分割デプロイ（詳細制御） | ⭐ 高度な使用 |

## deploy.ps1

統合デプロイスクリプト。前提条件チェックからデプロイまでを自動実行します。

### 使用方法

```powershell
# 基本的な使用方法（開発環境）
.\scripts\deploy.ps1

# 本番環境デプロイ
.\scripts\deploy.ps1 -Environment prod

# テストスキップ
.\scripts\deploy.ps1 -SkipTests

# Bootstrap・Secret作成スキップ（再デプロイ時）
.\scripts\deploy.ps1 -SkipBootstrap -SkipSecretCreation

# すべてのオプション指定
.\scripts\deploy.ps1 `
    -Environment prod `
    -Region ap-northeast-1 `
    -SkipTests `
    -SkipBootstrap `
    -SkipSecretCreation `
    -SkipEnvGeneration
```

### パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `-Environment` | No | dev | デプロイ環境（dev/prod） |
| `-Region` | No | ap-northeast-1 | AWSリージョン |
| `-SkipTests` | No | false | テスト実行をスキップ |
| `-SkipBootstrap` | No | false | CDK Bootstrapをスキップ |
| `-SkipSecretCreation` | No | false | APIキー作成をスキップ |
| `-SkipEnvGeneration` | No | false | 環境変数ファイル生成をスキップ |

### 実行フロー

```
1. 前提条件チェック
   ├─ Node.js確認
   ├─ npm確認
   ├─ AWS CLI確認
   ├─ AWS CDK確認
   └─ AWS認証情報確認

2. 依存関係インストール
   └─ npm install

3. テスト実行（-SkipTestsで省略可）
   └─ npm run test

4. ビルド
   └─ npm run build

5. APIキー作成（-SkipSecretCreationで省略可）
   └─ create-api-key-secret.ps1 実行

6. 環境変数ファイル生成（-SkipEnvGenerationで省略可）
   └─ generate-env-file.ps1 実行

7. CDK Bootstrap（-SkipBootstrapで省略可）
   └─ cdk bootstrap

8. CDK Deploy
   └─ cdk deploy
      ├─ dev: --require-approval never
      └─ prod: --require-approval always

9. デプロイログ作成
   └─ deployment-log-[YYYYMMDD-HHMMSS].md
```

### 出力例

```
========================================
TDnet Data Collector - Deployment
========================================

Environment: dev
Region: ap-northeast-1
Project Root: C:\Projects\tdnet-data-collector

[1/8] 🔍 Checking prerequisites...
  ✅ Node.js: v20.11.0
  ✅ npm: 10.2.4
  ✅ AWS CLI: aws-cli/2.15.17
  ✅ AWS CDK: 2.122.0
  ✅ AWS credentials configured
     Account: 123456789012
     User/Role: arn:aws:iam::123456789012:user/admin

[2/8] 📦 Installing dependencies...
  ✅ Dependencies installed

[3/8] 🧪 Running tests...
  ✅ All tests passed

[4/8] 🔨 Building project...
  ✅ Build successful

[5/8] 🔑 Creating API Key Secret...
  ✅ API Key Secret created/updated

[6/8] 📝 Generating environment file...
  ✅ Environment file generated: .env.dev

[7/8] 🚀 Running CDK Bootstrap...
  ✅ CDK Bootstrap completed

[8/8] 🚢 Deploying to AWS...
  ✅ Deployment successful

========================================
✅ Deployment Complete!
========================================

Next Steps:
  1. Verify deployment in AWS Console
  2. Check CloudWatch Logs for any errors
  3. Run smoke tests (if available)
  4. Monitor metrics for 30 minutes

Useful Commands:
  # View CloudFormation stack
  aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack

  # View Lambda logs
  aws logs tail /aws/lambda/tdnet-collector --follow

  # Get API endpoint
  aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text

  # Get API Key
  aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region ap-northeast-1 --query SecretString --output text

Deployment log saved: deployment-log-20260215-143022.md
```

### 生成されるデプロイログ

`deployment-log-[YYYYMMDD-HHMMSS].md`ファイルが生成されます：

```markdown
# Deployment Log

**Date**: 2026-02-15 14:30:22
**Environment**: dev
**Region**: ap-northeast-1
**AWS Account**: 123456789012
**Deployed By**: arn:aws:iam::123456789012:user/admin

## Deployment Steps

- [x] Prerequisites checked
- [x] Dependencies installed
- [x] Tests executed
- [x] Project built
- [x] API Key Secret created
- [x] Environment file generated
- [x] CDK Bootstrap executed
- [x] CDK Deploy executed

## Status

✅ Deployment successful

## Notes

- Deployment completed successfully
- Monitor CloudWatch Logs for any issues
- Verify all Lambda functions are working correctly
```

---

## deploy-dev.ps1

開発環境専用の簡易デプロイスクリプト。

### 使用方法

```powershell
# 開発環境デプロイ
.\scripts\deploy-dev.ps1
```

### 前提条件

- `config/.env.development`ファイルが存在すること

### 実行フロー

```
1. 環境変数読み込み
   └─ config/.env.development

2. CDKディレクトリ移動
   └─ cdk/

3. 依存関係確認
   └─ node_modules存在確認（なければnpm install）

4. CDK Synth（検証）
   └─ npx cdk synth --context environment=dev

5. CDK Deploy
   └─ npx cdk deploy --context environment=dev --require-approval never
```

### 出力例

```
========================================
TDnet Data Collector - Development Deploy
========================================

📋 Loading development environment variables...
  ✓ Set AWS_ACCOUNT_ID
  ✓ Set AWS_REGION
  ✓ Set DYNAMODB_TABLE_NAME
  ...

🔧 Environment: Development
🌏 Region: ap-northeast-1

📂 Changed directory to: C:\Projects\tdnet-data-collector\cdk

🔍 Validating CDK stack...
✓ CDK stack validation successful

🚀 Deploying to development environment...

========================================
✅ Development deployment successful!
========================================
```

---

## deploy-prod.ps1

本番環境専用の簡易デプロイスクリプト（2段階確認あり）。

### 使用方法

```powershell
# 本番環境デプロイ
.\scripts\deploy-prod.ps1
```

### 前提条件

- `config/.env.production`ファイルが存在すること

### 実行フロー

```
1. 環境変数読み込み
   └─ config/.env.production

2. 第1確認プロンプト
   └─ "Are you sure you want to deploy to production? (yes/no)"

3. CDKディレクトリ移動
   └─ cdk/

4. 依存関係確認
   └─ node_modules存在確認（なければnpm install）

5. CDK Synth（検証）
   └─ npx cdk synth --context environment=prod

6. 第2確認プロンプト
   └─ "Type 'DEPLOY' to proceed"

7. CDK Deploy
   └─ npx cdk deploy --context environment=prod

8. デプロイ後チェックリスト表示
```

### 出力例

```
========================================
TDnet Data Collector - Production Deploy
========================================

📋 Loading production environment variables...
  ✓ Set AWS_ACCOUNT_ID
  ✓ Set AWS_REGION
  ...

⚠️  WARNING: You are about to deploy to PRODUCTION!
🌏 Region: ap-northeast-1

Are you sure you want to deploy to production? (yes/no): yes

🔧 Environment: Production

📂 Changed directory to: C:\Projects\tdnet-data-collector\cdk

🔍 Validating CDK stack...
✓ CDK stack validation successful

⚠️  FINAL CONFIRMATION: Deploy to PRODUCTION?
Type 'DEPLOY' to proceed: DEPLOY

🚀 Deploying to production environment...

========================================
✅ Production deployment successful!
========================================

📝 Post-deployment checklist:
  1. Verify CloudWatch logs for errors
  2. Check CloudWatch metrics and alarms
  3. Test API endpoints
  4. Monitor initial Lambda executions
```

---

## deploy-split-stacks.ps1

スタック分割デプロイスクリプト。詳細な制御が可能です。

### 使用方法

```powershell
# 変更内容確認（diff）
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff

# 全スタックデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy

# 特定スタックのみデプロイ
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack foundation

# CloudFormationテンプレート生成
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action synth

# 全スタック削除
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action destroy
```

### パラメータ

| パラメータ | 必須 | 値 | 説明 |
|-----------|------|-----|------|
| `-Environment` | Yes | dev/prod | デプロイ環境 |
| `-Action` | Yes | deploy/destroy/diff/synth | 実行アクション |
| `-Stack` | No | foundation/compute/api/monitoring/all | 対象スタック（デフォルト: all） |

### スタック構成と依存関係

```
foundation (基盤)
  ├─ DynamoDB Tables
  ├─ S3 Buckets
  ├─ Secrets Manager
  └─ CloudTrail
      ↓
compute (コンピュート)
  ├─ Lambda Functions
  ├─ Lambda Layers
  └─ DLQ
      ↓
api (API)
  ├─ API Gateway
  ├─ WAF
  └─ CloudFront
      ↓
monitoring (監視)
  ├─ CloudWatch Alarms
  ├─ CloudWatch Dashboard
  └─ SNS Topics
```

### デプロイ順序

```
# 依存関係順にデプロイ
foundation → compute → api → monitoring

# 削除は逆順
monitoring → api → compute → foundation
```

### 実行フロー

```
1. Lambda関数ビルド
   └─ npm run build

2. ビルド結果検証
   └─ dist/src/lambda/*/index.js 存在確認

3. アクション実行
   ├─ synth: CloudFormationテンプレート生成
   ├─ diff: 変更内容確認
   ├─ deploy: デプロイ実行
   └─ destroy: スタック削除
```

### 出力例（deploy）

```
========================================
TDnet Data Collector - Stack Split Deploy
========================================

Environment: dev
Action: deploy
Target Stack: all

Building Lambda functions...
Build verification completed

========================================
Deploying: TdnetFoundation-dev
========================================

[CDK output...]

Deployment completed for TdnetFoundation-dev

========================================
Deploying: TdnetCompute-dev
========================================

[CDK output...]

Deployment completed for TdnetCompute-dev

========================================
Deploying: TdnetApi-dev
========================================

[CDK output...]

Deployment completed for TdnetApi-dev

========================================
Deploying: TdnetMonitoring-dev
========================================

[CDK output...]

Deployment completed for TdnetMonitoring-dev

========================================
All stacks deployed successfully!
========================================

Process completed
```

### 出力例（diff）

```
========================================
TDnet Data Collector - Stack Split Deploy
========================================

Environment: dev
Action: diff
Target Stack: all

Building Lambda functions...
Build verification completed

Checking differences...

--- Diff for TdnetFoundation-dev ---
Stack TdnetFoundation-dev
Resources
[+] AWS::DynamoDB::Table tdnet_disclosures_new
[~] AWS::S3::Bucket tdnet-pdfs
 └─ [~] LifecycleConfiguration
     └─ [+] Rules[0]

--- Diff for TdnetCompute-dev ---
Stack TdnetCompute-dev
Resources
[~] AWS::Lambda::Function CollectorFunction
 └─ [~] Environment
     └─ [~] Variables
         └─ [+] NEW_ENV_VAR

Process completed
```

---

## 推奨デプロイフロー

### 初回デプロイ（開発環境）

```powershell
# 統合デプロイスクリプト使用（推奨）
.\scripts\deploy.ps1 -Environment dev
```

### 再デプロイ（開発環境）

```powershell
# Bootstrap・Secret作成をスキップ
.\scripts\deploy.ps1 -Environment dev -SkipBootstrap -SkipSecretCreation
```

### 本番環境デプロイ

```powershell
# 1. 変更内容確認
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action diff

# 2. 本番デプロイ
.\scripts\deploy.ps1 -Environment prod

# または段階的デプロイ
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack foundation
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack compute
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack api
.\scripts\deploy-split-stacks.ps1 -Environment prod -Action deploy -Stack monitoring
```

### 特定スタックのみ更新

```powershell
# 変更内容確認
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action diff -Stack compute

# デプロイ
.\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy -Stack compute
```

---

## トラブルシューティング

### 共通エラー

| エラー | 原因 | 解決策 |
|--------|------|--------|
| AWS CLI not found | AWS CLIが未インストール | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | AWS認証情報が未設定 | `aws configure` 実行 |
| CDK not installed | AWS CDKが未インストール | `npm install -g aws-cdk` |
| Build failed | TypeScriptコンパイルエラー | `npm run build` でエラー確認 |
| Bootstrap not executed | CDK Bootstrapが未実行 | `cdk bootstrap` 実行 |
| Secret creation failed | Secretが既に存在 | `-SkipSecretCreation` 使用 |

### deploy.ps1 特有のエラー

| エラー | 原因 | 解決策 |
|--------|------|--------|
| Tests failed | テストが失敗 | テスト修正、または `-SkipTests` 使用 |
| Environment file generation failed | AWS認証情報エラー | `aws configure` 確認 |

### deploy-split-stacks.ps1 特有のエラー

| エラー | 原因 | 解決策 |
|--------|------|--------|
| Build files missing | Lambda関数がビルドされていない | `npm run build` 実行 |
| Stack dependency error | 依存スタックが未デプロイ | 依存順にデプロイ（foundation → compute → api → monitoring） |
| CDK app not found | CDKアプリケーションパスが不正 | `cdk/bin/tdnet-data-collector-split.ts` 存在確認 |

---

## デプロイ後の確認

### CloudFormationスタック確認

```powershell
# スタック一覧
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# スタック詳細
aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack

# スタック出力値取得
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack `
    --query 'Stacks[0].Outputs' `
    --output table
```

### Lambda関数確認

```powershell
# Lambda関数一覧
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `tdnet`)].FunctionName'

# Lambda関数詳細
aws lambda get-function --function-name tdnet-collector

# Lambda関数ログ確認
aws logs tail /aws/lambda/tdnet-collector --follow
```

### API Gateway確認

```powershell
# API一覧
aws apigateway get-rest-apis

# APIエンドポイント取得
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack `
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' `
    --output text
```

---

## 関連ドキュメント

- [Scripts Overview](./scripts-overview.md)
- [セットアップスクリプト](./setup-scripts.md)
- [デプロイメントガイド](../04-deployment/deployment-guide.md)
- [CI/CDガイド](../04-deployment/ci-cd-guide.md)

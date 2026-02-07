# CI/CD設定ガイド

**バージョン:** 1.0.0  
**最終更新:** 2026-02-07

このドキュメントは、TDnet Data CollectorのCI/CDパイプライン設定方法を説明します。

---

## 目次

1. [概要](#概要)
2. [GitHub Secrets設定](#github-secrets設定)
3. [環境変数管理](#環境変数管理)
4. [ワークフロー設定](#ワークフロー設定)
5. [デプロイフロー](#デプロイフロー)
6. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### CI/CDパイプラインの構成

```
┌─────────────────────────────────────────────────────────┐
│ GitHub Actions CI/CDパイプライン                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Push/PR → Test Workflow                               │
│            ├─ Lint                                      │
│            ├─ Type Check                                │
│            ├─ Unit Tests                                │
│            ├─ Property Tests                            │
│            ├─ Coverage Check (≥80%)                     │
│            └─ Security Audit                            │
│                                                         │
│  Push to main → Deploy Workflow                        │
│                 ├─ Run Tests                            │
│                 ├─ Build                                │
│                 ├─ CDK Synth                            │
│                 ├─ CDK Deploy                           │
│                 ├─ Smoke Tests                          │
│                 └─ Notify (Slack)                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 主要な機能

- ✅ **自動テスト**: PR作成時に自動実行
- ✅ **カバレッジチェック**: 80%未満はデプロイ不可
- ✅ **セキュリティ監査**: npm audit自動実行
- ✅ **自動デプロイ**: mainブランチへのpushで自動デプロイ
- ✅ **スモークテスト**: デプロイ後の動作確認
- ✅ **通知**: Slack通知（成功/失敗）

---

## GitHub Secrets設定

### 必要なSecretsの一覧

| Secret名 | 説明 | 必須 | 例 |
|---------|------|------|-----|
| `AWS_ROLE_ARN` | AWS IAMロールARN | ✅ | `arn:aws:iam::123456789012:role/GitHubActionsRole` |
| `API_ENDPOINT` | APIエンドポイントURL | ✅ | `https://api.example.com` |
| `API_KEY` | API認証キー | ✅ | `your-api-key-here` |
| `SLACK_WEBHOOK` | Slack Webhook URL | ⚠️ | `https://hooks.slack.com/services/...` |

⚠️ = オプション（通知機能を使用する場合のみ）

### Secrets設定手順

#### 1. GitHubリポジトリのSettings画面を開く

```
https://github.com/<username>/<repository>/settings/secrets/actions
```

#### 2. "New repository secret"をクリック

#### 3. 各Secretを追加

**AWS_ROLE_ARN:**
```
Name: AWS_ROLE_ARN
Value: arn:aws:iam::123456789012:role/GitHubActionsRole
```

**API_ENDPOINT:**
```
Name: API_ENDPOINT
Value: https://your-api-gateway-url.execute-api.ap-northeast-1.amazonaws.com/prod
```

**API_KEY:**
```
Name: API_KEY
Value: your-generated-api-key
```

**SLACK_WEBHOOK (オプション):**
```
Name: SLACK_WEBHOOK
Value: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### AWS IAMロールの設定

GitHub ActionsからAWSリソースにアクセスするため、OIDC認証を使用します。

#### IAMロールの作成

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:<username>/<repository>:*"
        }
      }
    }
  ]
}
```

#### 必要な権限ポリシー（最小権限の原則）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationAccess",
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate"
      ],
      "Resource": [
        "arn:aws:cloudformation:ap-northeast-1:123456789012:stack/TdnetStack/*",
        "arn:aws:cloudformation:ap-northeast-1:123456789012:stack/CDKToolkit/*"
      ]
    },
    {
      "Sid": "LambdaAccess",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunction",
        "lambda:DeleteFunction",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:AddPermission",
        "lambda:RemovePermission"
      ],
      "Resource": "arn:aws:lambda:ap-northeast-1:123456789012:function:tdnet-*"
    },
    {
      "Sid": "DynamoDBAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:UpdateTable",
        "dynamodb:DescribeTable",
        "dynamodb:DeleteTable",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:UpdateTimeToLive"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:123456789012:table/tdnet-*"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutBucketPolicy",
        "s3:GetBucketLocation",
        "s3:PutBucketVersioning",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutEncryptionConfiguration",
        "s3:DeleteBucket"
      ],
      "Resource": "arn:aws:s3:::tdnet-*"
    },
    {
      "Sid": "S3ObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::tdnet-*/*"
    },
    {
      "Sid": "APIGatewayAccess",
      "Effect": "Allow",
      "Action": [
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:PATCH",
        "apigateway:DELETE",
        "apigateway:GET"
      ],
      "Resource": "arn:aws:apigateway:ap-northeast-1::/restapis/*"
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::123456789012:role/tdnet-*",
      "Condition": {
        "StringEquals": {
          "iam:PassedToService": [
            "lambda.amazonaws.com",
            "apigateway.amazonaws.com"
          ]
        }
      }
    },
    {
      "Sid": "IAMRoleRead",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole",
        "iam:GetRolePolicy"
      ],
      "Resource": "arn:aws:iam::123456789012:role/tdnet-*"
    },
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:ap-northeast-1:123456789012:log-group:/aws/lambda/tdnet-*"
    },
    {
      "Sid": "EventBridgeAccess",
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:DeleteRule",
        "events:DescribeRule",
        "events:PutTargets",
        "events:RemoveTargets"
      ],
      "Resource": "arn:aws:events:ap-northeast-1:123456789012:rule/tdnet-*"
    },
    {
      "Sid": "SSMParameterAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:PutParameter"
      ],
      "Resource": "arn:aws:ssm:ap-northeast-1:123456789012:parameter/cdk-bootstrap/*"
    }
  ]
}
```

**重要な変更点:**
- ✅ すべてのリソースARNを具体的に指定（`*` を削除）
- ✅ 各サービスごとに必要最小限のアクションのみ許可
- ✅ IAM PassRoleに条件を追加（特定のサービスのみ）
- ✅ リソース名に `tdnet-` プレフィックスを強制

**セキュリティ強化のポイント:**
1. リソースARNを具体的に指定することで、意図しないリソースへのアクセスを防止
2. IAM PassRoleに条件を追加し、Lambda/API Gatewayのみにロールを渡せるよう制限
3. CloudWatch Logsのアクセスを `/aws/lambda/tdnet-*` に限定

### セキュリティベストプラクティス

#### ✅ 推奨事項

1. **最小権限の原則**: 必要最小限の権限のみ付与
2. **環境ごとに異なるSecret**: dev/prod で異なるAPIキーを使用
3. **定期的なローテーション**: APIキーを定期的に更新
4. **監査ログの有効化**: CloudTrailでアクセスログを記録

#### ❌ 避けるべき事項

1. **長期的なアクセスキーの使用**: OIDC認証を使用すること
2. **過度な権限付与**: `AdministratorAccess` は使用しない
3. **Secretのハードコード**: コード内にSecretを記述しない
4. **公開リポジトリでのSecret使用**: プライベートリポジトリを使用

---

## 環境変数管理

### 環境変数の管理方針

**管理場所の使い分け:**

| 環境 | 管理場所 | 用途 | 例 |
|------|---------|------|-----|
| **ローカル開発** | `.env` ファイル | 開発者のローカル環境 | `DYNAMODB_ENDPOINT=http://localhost:8000` |
| **CI/CD** | GitHub Secrets | GitHub Actionsでのビルド・デプロイ | `AWS_ROLE_ARN`, `API_KEY` |
| **Lambda実行時** | CDKで定義 | Lambda関数の環境変数 | `DYNAMODB_TABLE`, `S3_BUCKET` |
| **機密情報** | AWS Secrets Manager | APIキー、データベース認証情報 | `TDNET_API_KEY` |

**重要な原則:**

1. **機密情報はコードに含めない**
   - ❌ ハードコード
   - ❌ `.env` ファイルをGitにコミット
   - ✅ GitHub Secrets または AWS Secrets Manager

2. **環境ごとに異なる値を使用**
   - dev: 開発用のリソース
   - staging: 本番に近い環境
   - prod: 本番環境

3. **デフォルト値を設定**
   - ローカル開発時に環境変数が未設定でもエラーにならないよう、適切なデフォルト値を設定
   - 例: `process.env.LOG_LEVEL || 'DEBUG'`

4. **環境変数の検証**
   - Lambda起動時に必須の環境変数が設定されているか確認
   - 不正な値の場合はエラーを投げる

**環境変数の優先順位:**
```
1. Lambda環境変数（CDKで定義） - 最優先
2. GitHub Secrets（CI/CD時）
3. .env ファイル（ローカル開発時）
4. デフォルト値（コード内）
```

### 環境ごとの変数の違い

| 変数名 | dev | staging | prod |
|--------|-----|---------|------|
| `ENVIRONMENT` | `dev` | `staging` | `prod` |
| `LOG_LEVEL` | `DEBUG` | `INFO` | `WARN` |
| `DYNAMODB_TABLE` | `tdnet-disclosures-dev` | `tdnet-disclosures-staging` | `tdnet-disclosures-prod` |
| `S3_BUCKET` | `tdnet-pdfs-dev` | `tdnet-pdfs-staging` | `tdnet-pdfs-prod` |
| `API_ENDPOINT` | `https://dev-api.example.com` | `https://staging-api.example.com` | `https://api.example.com` |

### GitHub Actionsでの環境変数設定

#### ワークフローファイル内での設定

```yaml
env:
  ENVIRONMENT: ${{ github.event.inputs.environment || 'dev' }}
  LOG_LEVEL: ${{ github.event.inputs.environment == 'prod' && 'WARN' || 'DEBUG' }}
```

#### 環境ごとのSecrets

GitHub Environmentsを使用して環境ごとに異なるSecretsを管理：

```yaml
environment:
  name: ${{ github.event.inputs.environment || 'dev' }}
```

**設定手順:**
1. Settings → Environments → New environment
2. 環境名を入力（dev, staging, prod）
3. Environment secretsを追加

### ローカル開発での .env ファイル

#### .env.example（テンプレート）

```bash
# AWS設定
AWS_REGION=ap-northeast-1
AWS_PROFILE=default

# 環境
ENVIRONMENT=dev
LOG_LEVEL=DEBUG

# DynamoDB
DYNAMODB_TABLE=tdnet-disclosures-dev
DYNAMODB_ENDPOINT=http://localhost:8000  # ローカルDynamoDB

# S3
S3_BUCKET=tdnet-pdfs-dev
S3_ENDPOINT=http://localhost:4566  # LocalStack

# API
API_ENDPOINT=http://localhost:3000
API_KEY=local-dev-key

# TDnet
TDNET_BASE_URL=https://www.release.tdnet.info
TDNET_REQUEST_INTERVAL=2000  # ミリ秒
```

#### .env ファイルの作成

```powershell
# .env.exampleをコピー
Copy-Item .env.example .env

# 必要に応じて値を編集
notepad .env
```

#### .gitignore に追加

```gitignore
# 環境変数ファイル
.env
.env.local
.env.*.local
```

### CDKでの環境変数の使用

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const environment = process.env.ENVIRONMENT || 'dev';

const collectorFn = new lambda.Function(this, 'CollectorFunction', {
    // ...
    environment: {
        ENVIRONMENT: environment,
        LOG_LEVEL: environment === 'prod' ? 'WARN' : 'DEBUG',
        DYNAMODB_TABLE: `tdnet-disclosures-${environment}`,
        S3_BUCKET: `tdnet-pdfs-${environment}`,
        TDNET_BASE_URL: 'https://www.release.tdnet.info',
        TDNET_REQUEST_INTERVAL: '2000',
    },
});
```

---

## ワークフロー設定

### test.yml の詳細

**トリガー条件:**
- `push` イベント: main, develop ブランチ
- `pull_request` イベント: main, develop ブランチ

**実行内容:**

1. **Lint**: ESLintでコード品質チェック
2. **Type Check**: TypeScriptの型チェック
3. **Unit Tests**: ユニットテストの実行
4. **Property Tests**: プロパティベーステストの実行
5. **Coverage**: カバレッジレポート生成
6. **Coverage Threshold**: 80%未満は失敗
7. **Codecov Upload**: カバレッジレポートをアップロード
8. **Security Audit**: npm auditで脆弱性チェック
9. **Outdated Check**: 古い依存関係の確認

**カバレッジチェックの詳細（クロスプラットフォーム対応）:**

```yaml
- name: Check coverage threshold (80%)
  run: |
    node -e "
      const fs = require('fs');
      const coverage = JSON.parse(fs.readFileSync('./coverage/coverage-summary.json', 'utf8'));
      const lineCoverage = coverage.total.lines.pct;
      console.log(\`Coverage: \${lineCoverage}%\`);
      if (lineCoverage < 80) {
        console.error(\`❌ Coverage \${lineCoverage}% is below 80% threshold\`);
        process.exit(1);
      }
      console.log(\`✅ Coverage \${lineCoverage}% meets 80% threshold\`);
    "
```

**変更理由:**
- ✅ `bc` コマンドに依存しない（GitHub Actions Runnerに標準インストール）
- ✅ Windows環境でも動作
- ✅ Node.jsは既にインストール済み（npm実行のため）
- ✅ エラーメッセージが明確

### deploy.yml の詳細

**トリガー条件:**
- `push` イベント: main ブランチ
- `workflow_dispatch`: 手動実行（環境選択可能）

**実行内容:**

1. **Tests**: テストの実行（デプロイ前の最終確認）
2. **Coverage Check**: 80%未満はデプロイ中止
3. **Build**: TypeScriptのビルド
4. **AWS Credentials**: OIDC認証でAWSアクセス
5. **CDK Synth**: CloudFormationテンプレート生成
6. **CDK Diff**: 変更内容の確認
7. **CDK Deploy**: AWSリソースのデプロイ
8. **Smoke Tests**: デプロイ後の動作確認
9. **Slack Notification**: 成功/失敗を通知

**手動実行の方法:**

```
GitHub → Actions → Deploy → Run workflow
→ Environment を選択（dev/prod）
→ Run workflow
```

### ブランチ戦略

```
main (本番環境)
  ↑
  │ PR + Review
  │
develop (開発環境)
  ↑
  │ PR
  │
feature/* (機能開発)
```

**ルール:**
- `feature/*` → `develop`: PR必須、レビュー推奨
- `develop` → `main`: PR必須、レビュー必須、テスト通過必須

---

## デプロイフロー

### 開発環境へのデプロイ

**自動デプロイ:**
```bash
# developブランチにpush
git push origin develop
```

**手動デプロイ:**
```
GitHub Actions → Deploy → Run workflow → dev
```

### ステージング環境へのデプロイ

```
GitHub Actions → Deploy → Run workflow → staging
```

### 本番環境へのデプロイ

**手順:**

1. **developからmainへPR作成**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.0.0
   git push origin release/v1.0.0
   ```

2. **PRレビュー**
   - コードレビュー
   - テスト結果確認
   - カバレッジ確認

3. **mainへマージ**
   - PRをマージ
   - 自動的にデプロイ開始

4. **デプロイ確認**
   - GitHub Actionsのログ確認
   - Slack通知確認
   - スモークテスト結果確認

### ロールバック手順（推奨順序）

#### 優先度1: CloudFormationからロールバック（最速・最安全）

**適用条件:**
- ✅ Lambda関数のコード変更のみ
- ✅ 環境変数の変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし
- ✅ S3バケットの削除なし

**手順:**
```
AWS Console → CloudFormation → TdnetStack → Stack actions → Roll back
```

**所要時間:** 5-10分

**メリット:**
- 最も安全（AWSが自動的に前の状態に戻す）
- 最も速い
- 手動操作が最小限

---

#### 優先度2: 前のコミットにロールバック

**適用条件:**
- ✅ コード変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし
- ✅ S3バケットの削除なし
- ⚠️ 新しいリソースの追加なし

**手順:**
```bash
# 1. 前のコミットを確認
git log --oneline -n 10

# 2. ロールバック対象のコミットを特定
# 例: abc1234 が正常動作していたコミット

# 3. revertコミットを作成
git revert <commit-hash>

# 4. mainブランチにpush（自動デプロイ）
git push origin main
```

**所要時間:** 10-15分

**メリット:**
- Git履歴が保持される
- 自動デプロイが実行される
- 監査ログが残る

---

#### 優先度3: 手動デプロイ（最終手段）

**適用条件:**
- ⚠️ DynamoDBテーブルのスキーマ変更あり
- ⚠️ S3バケットの削除あり
- ⚠️ 複雑な変更
- ⚠️ 優先度1-2が使えない場合

**手順:**
```bash
# 1. 正常動作していたタグをチェックアウト
git checkout v1.0.0

# 2. 依存関係をインストール
npm ci

# 3. CDK Diffで変更内容を確認
npx cdk diff

# 4. 手動デプロイ
npx cdk deploy --require-approval never

# 5. スモークテスト
npm run test:smoke
```

**所要時間:** 20-30分

**メリット:**
- 完全な制御が可能
- 複雑な変更に対応

---

### ⚠️ データベーススキーマ変更時の特別な注意事項

#### DynamoDBテーブルの変更

**削除不可能な操作（ロールバック不可）:**
- ❌ テーブルの削除
- ❌ GSI（Global Secondary Index）の削除
- ❌ データの削除

**ロールバック可能な操作:**
- ✅ GSIの追加（削除すればロールバック）
- ✅ TTLの有効化/無効化
- ✅ ストリームの有効化/無効化

**推奨手順:**
1. **事前バックアップ**: AWS Backup または On-Demand Backup
2. **段階的変更**: 一度に複数の変更を行わない
3. **テスト環境で検証**: dev環境で十分にテスト
4. **ロールバックプランの準備**: 事前にロールバック手順を文書化

#### S3バケットの変更

**削除不可能な操作（ロールバック不可）:**
- ❌ バケットの削除（オブジェクトが存在する場合）
- ❌ バージョニング無効化後のオブジェクト削除

**推奨手順:**
1. **バージョニング有効化**: 誤削除からの復旧を可能にする
2. **ライフサイクルポリシー**: 古いバージョンを自動削除
3. **クロスリージョンレプリケーション**: 重要データのバックアップ

---

### ロールバック判断フローチャート

```
デプロイ失敗/問題発生
    ↓
DynamoDBスキーマ変更あり？
    ├─ Yes → 優先度3: 手動デプロイ + データ復旧
    └─ No → 新しいリソース追加あり？
              ├─ Yes → 優先度2: 前のコミットにロールバック
              └─ No → 優先度1: CloudFormationからロールバック
```

---

### ロールバック後の確認事項

**必須チェック:**
- ✅ Lambda関数が正常に動作しているか
- ✅ DynamoDBテーブルにアクセスできるか
- ✅ S3バケットにアクセスできるか
- ✅ API Gatewayが正常にレスポンスを返すか
- ✅ CloudWatch Logsにエラーがないか

**スモークテストの実行:**
```bash
# APIエンドポイントのテスト
curl -X GET https://api.example.com/health

# 収集機能のテスト
curl -X POST https://api.example.com/collect \
  -H "x-api-key: $API_KEY" \
  -d '{"date": "2024-01-15"}'
```

---

## トラブルシューティング

### よくある問題と解決策

#### 問題1: AWS認証エラー

**エラーメッセージ:**
```
Error: Unable to assume role
```

**原因:**
- IAMロールのARNが間違っている
- Trust Relationshipが正しく設定されていない
- リポジトリ名が一致していない

**解決策:**
1. `AWS_ROLE_ARN` Secretを確認
2. IAMロールのTrust Relationshipを確認
3. リポジトリ名が正しいか確認

#### 問題2: カバレッジチェック失敗

**エラーメッセージ:**
```
❌ Coverage 75% is below 80% threshold
```

**原因:**
- テストカバレッジが80%未満

**解決策:**
1. カバレッジレポートを確認
   ```bash
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```
2. カバレッジが低いファイルにテストを追加
3. 再度テストを実行

#### 問題3: CDK Deploy失敗

**エラーメッセージ:**
```
Error: Stack update failed
```

**原因:**
- CloudFormationスタックの更新に失敗
- リソースの競合
- 権限不足

**解決策:**
1. CloudFormationコンソールでエラー詳細を確認
2. CDK Diffで変更内容を確認
   ```bash
   npx cdk diff
   ```
3. 必要に応じて手動で修正

#### 問題4: スモークテスト失敗

**エラーメッセージ:**
```
Error: API endpoint returned 500
```

**原因:**
- デプロイ直後でLambda関数がまだ準備中
- APIエンドポイントが間違っている
- Lambda関数にエラーがある

**解決策:**
1. 待機時間を延長
   ```yaml
   - name: Wait for deployment to stabilize
     run: sleep 60  # 30秒 → 60秒
   ```
2. CloudWatch Logsでエラーを確認
3. 手動でAPIをテスト

#### 問題5: Slack通知が届かない

**原因:**
- Webhook URLが間違っている
- Slackアプリの権限不足

**解決策:**
1. `SLACK_WEBHOOK` Secretを確認
2. Slackアプリの設定を確認
3. `continue-on-error: true` を確認（通知失敗でもデプロイは継続）

### ログの確認方法

#### GitHub Actionsログ

```
GitHub → Actions → ワークフロー名 → 実行履歴 → ログ
```

#### CloudWatch Logs

```
AWS Console → CloudWatch → Log groups → /aws/lambda/<function-name>
```

#### CDKデプロイログ

```bash
# ローカルでCDKデプロイ
npx cdk deploy --verbose
```

---

## 関連ドキュメント

- **[環境構築](./environment-setup.md)** - ローカル開発環境のセットアップ
- **[デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)** - デプロイ前後の確認事項
- **[環境変数](../../.kiro/steering/infrastructure/environment-variables.md)** - 環境変数の詳細定義
- **[トラブルシューティング](./troubleshooting.md)** - 一般的な問題の解決方法

---

**最終更新:** 2026-02-07

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

#### 必要な権限ポリシー

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "dynamodb:*",
        "s3:*",
        "apigateway:*",
        "iam:PassRole",
        "iam:GetRole",
        "logs:*",
        "events:*"
      ],
      "Resource": "*"
    }
  ]
}
```

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

**カバレッジチェックの詳細:**

```yaml
- name: Check coverage threshold (80%)
  run: |
    COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
    echo "Coverage: $COVERAGE%"
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      echo "❌ Coverage $COVERAGE% is below 80% threshold"
      exit 1
    fi
    echo "✅ Coverage $COVERAGE% meets 80% threshold"
```

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

### ロールバック手順

#### 方法1: 前のコミットにロールバック

```bash
# 前のコミットを確認
git log --oneline -n 5

# ロールバック
git revert <commit-hash>
git push origin main
```

#### 方法2: 手動で前のバージョンをデプロイ

```bash
# 前のタグをチェックアウト
git checkout v1.0.0

# 手動デプロイ
npm run cdk:deploy
```

#### 方法3: CloudFormationから直接ロールバック

```
AWS Console → CloudFormation → Stack → Actions → Roll back
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

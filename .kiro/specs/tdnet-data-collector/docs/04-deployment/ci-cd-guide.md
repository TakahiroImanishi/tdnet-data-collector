# CI/CD設定ガイド

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0

TDnet Data CollectorのCI/CDパイプライン設定方法を説明します。

---

## 目次

1. [概要](#概要)
2. [GitHub Secrets設定](#github-secrets設定)
3. [AWS IAMロール設定](#aws-iamロール設定)
4. [ワークフロー設定](#ワークフロー設定)
5. [デプロイフロー](#デプロイフロー)
6. [ロールバック手順](#ロールバック手順)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### CI/CDパイプラインの構成

```
Push/PR → Test Workflow
          ├─ Lint
          ├─ Type Check
          ├─ Unit Tests
          ├─ Coverage Check (≥80%)
          └─ Security Audit

Push to main → Deploy Workflow
               ├─ Run Tests
               ├─ Build
               ├─ CDK Deploy
               ├─ Smoke Tests
               └─ Notify (Slack)
```

### 主要な機能

- ✅ 自動テスト: PR作成時に自動実行
- ✅ カバレッジチェック: 80%未満はデプロイ不可
- ✅ 自動デプロイ: mainブランチへのpushで自動デプロイ
- ✅ スモークテスト: デプロイ後の動作確認

### テストカバレッジ目標

すべてのコードメトリクスで**80%以上**のカバレッジを維持：

- **Statements**: 80%以上
- **Branches**: 80%以上
- **Functions**: 80%以上
- **Lines**: 80%以上

---

## GitHub Secrets設定

### 必要なSecretsの一覧

| Secret名 | 説明 | 必須 | 例 |
|---------|------|------|-----|
| `AWS_ROLE_ARN` | AWS IAMロールARN（OIDC認証） | ✅ | `arn:aws:iam::123456789012:role/GitHubActionsRole` |
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID（IAMユーザー認証） | ⚠️ | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー（IAMユーザー認証） | ⚠️ | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWSリージョン | ✅ | `ap-northeast-1` |
| `API_ENDPOINT` | APIエンドポイントURL | ✅ | `https://api.example.com` |
| `API_KEY` | API認証キー | ✅ | `your-api-key-here` |
| `SLACK_WEBHOOK_URL` | Slack Webhook URL | ⚠️ | `https://hooks.slack.com/services/...` |

⚠️ = オプション（通知機能を使用する場合のみ）

### Secrets設定手順

#### 方法1: IAMユーザー認証（シンプル）

1. **IAMユーザーの作成**

```powershell
# AWS Management Consoleで実行
# IAM → ユーザー → ユーザーを追加
# ユーザー名: github-actions-tdnet
# アクセスタイプ: プログラムによるアクセス
```

2. **IAMポリシーのアタッチ**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "dynamodb:*",
        "apigateway:*",
        "iam:*",
        "logs:*",
        "events:*",
        "sqs:*",
        "cloudwatch:*",
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "*"
    }
  ]
}
```

**注意**: 本番環境では、最小権限の原則に従い、必要な権限のみを付与してください。

3. **GitHub Secretsに登録**

```
GitHub → Settings → Secrets and variables → Actions → New repository secret

- AWS_ACCESS_KEY_ID: IAMユーザーのアクセスキーID
- AWS_SECRET_ACCESS_KEY: IAMユーザーのシークレットアクセスキー
- AWS_REGION: ap-northeast-1
```

#### 方法2: OIDC認証（推奨）

1. **GitHubアイデンティティプロバイダーの作成**

```powershell
# AWS Management Consoleで実行
# IAM → アイデンティティプロバイダー → プロバイダーを追加
# プロバイダーのタイプ: OpenID Connect
# プロバイダーのURL: https://token.actions.githubusercontent.com
# 対象者: sts.amazonaws.com
```

2. **IAMロールの作成**

Trust Relationship:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
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
  }]
}
```

3. **GitHub Secretsに登録**

```
- AWS_ROLE_ARN: arn:aws:iam::123456789012:role/GitHubActionsRole
- AWS_REGION: ap-northeast-1
```

4. **ワークフローファイルの更新**

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: ${{ secrets.AWS_REGION || 'ap-northeast-1' }}
```

### Slack通知の設定（オプション）

1. **Slack Incoming Webhookの作成**

```
Slack API → Create New App → From scratch
→ Incoming Webhooks → Activate → Add New Webhook to Workspace
→ チャンネルを選択 → Webhook URLをコピー
```

2. **GitHub Secretsに登録**

```
- SLACK_WEBHOOK_URL: https://hooks.slack.com/services/...
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

---

## AWS IAMロール設定

### 必要な権限ポリシー（最小権限の原則）

**重要な原則**:
- ✅ すべてのリソースARNを具体的に指定（`*` を削除）
- ✅ 各サービスごとに必要最小限のアクションのみ許可
- ✅ IAM PassRoleに条件を追加（特定のサービスのみ）
- ✅ リソース名に `tdnet-` プレフィックスを強制

**主要な権限**:

| サービス | 必要なアクション | リソース制限 |
|---------|----------------|-------------|
| CloudFormation | DescribeStacks, CreateStack, UpdateStack, DeleteStack | `tdnet-*` スタックのみ |
| Lambda | CreateFunction, UpdateFunction, GetFunction, DeleteFunction | `tdnet-*` 関数のみ |
| DynamoDB | CreateTable, UpdateTable, DescribeTable, DeleteTable | `tdnet-*` テーブルのみ |
| S3 | CreateBucket, PutObject, GetObject, DeleteObject | `tdnet-*` バケットのみ |
| API Gateway | POST, PUT, PATCH, DELETE, GET | `/restapis/*` |
| IAM | PassRole, GetRole, GetRolePolicy | `tdnet-*` ロールのみ |

---

## ワークフロー設定

### test.yml の詳細

**トリガー条件**:
- `push` イベント: main, develop ブランチ
- `pull_request` イベント: main, develop ブランチ

**実行内容**:
1. Lint: ESLintでコード品質チェック
2. Type Check: TypeScriptの型チェック
3. Unit Tests: ユニットテストの実行
4. Coverage: カバレッジレポート生成（80%未満は失敗）
5. Security Audit: npm auditで脆弱性チェック

**カバレッジチェック（クロスプラットフォーム対応）**:
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

### deploy.yml の詳細

**トリガー条件**:
- `push` イベント: main ブランチ
- `workflow_dispatch`: 手動実行（環境選択可能）

**実行内容**:
1. Tests: テストの実行（デプロイ前の最終確認）
2. Coverage Check: 80%未満はデプロイ中止
3. Build: TypeScriptのビルド
4. AWS Credentials: OIDC認証でAWSアクセス
5. CDK Deploy: AWSリソースのデプロイ
6. Smoke Tests: デプロイ後の動作確認
7. Slack Notification: 成功/失敗を通知

**手動実行の方法**:
```
GitHub → Actions → Deploy → Run workflow
→ Environment を選択（dev/prod）
→ Run workflow
```

### e2e-test.yml の詳細

**トリガー条件**:
- `pull_request` イベント
- `push` イベント: main ブランチ
- `workflow_dispatch`: 手動実行

**実行内容**:
1. LocalStack起動
2. DynamoDBテーブル作成
3. S3バケット作成
4. E2Eテスト実行
5. 詳細なテストレポート生成
6. アーティファクト収集（ログ、環境情報）

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

**ルール**:
- `feature/*` → `develop`: PR必須、レビュー推奨
- `develop` → `main`: PR必須、レビュー必須、テスト通過必須

---

## デプロイフロー

### 開発環境へのデプロイ

**自動デプロイ**:
```bash
# developブランチにpush
git push origin develop
```

**手動デプロイ**:
```
GitHub Actions → Deploy → Run workflow → dev
```

### 本番環境へのデプロイ

**手順**:

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

---

## ロールバック手順

### 優先度1: CloudFormationからロールバック（最速・最安全）

**適用条件**:
- ✅ Lambda関数のコード変更のみ
- ✅ 環境変数の変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし

**手順**:
```
AWS Console → CloudFormation → TdnetStack → Stack actions → Roll back
```

**所要時間**: 5-10分

### 優先度2: 前のコミットにロールバック

**適用条件**:
- ✅ コード変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし
- ⚠️ 新しいリソースの追加なし

**手順**:
```bash
# 前のコミットを確認
git log --oneline -n 10

# revertコミットを作成
git revert <commit-hash>

# mainブランチにpush（自動デプロイ）
git push origin main
```

**所要時間**: 10-15分

### 優先度3: 手動デプロイ（最終手段）

**適用条件**:
- ⚠️ DynamoDBテーブルのスキーマ変更あり
- ⚠️ S3バケットの削除あり
- ⚠️ 複雑な変更

**手順**:
```bash
# 正常動作していたタグをチェックアウト
git checkout v1.0.0

# 依存関係をインストール
npm ci

# 手動デプロイ
npx cdk deploy --require-approval never

# スモークテスト
npm run test:smoke
```

**所要時間**: 20-30分

### ロールバック判断フローチャート

```
デプロイ失敗/問題発生
    ↓
DynamoDBスキーマ変更あり?
    ├─ Yes → 優先度3: 手動デプロイ + データ復旧
    └─ No → 新しいリソース追加あり?
              ├─ Yes → 優先度2: 前のコミットにロールバック
              └─ No → 優先度1: CloudFormationからロールバック
```

### ロールバック後の確認事項

**必須チェック**:
- ✅ Lambda関数が正常に動作しているか
- ✅ DynamoDBテーブルにアクセスできるか
- ✅ S3バケットにアクセスできるか
- ✅ API Gatewayが正常にレスポンスを返すか
- ✅ CloudWatch Logsにエラーがないか

**スモークテストの実行**:
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

| 問題 | 原因 | 解決策 |
|------|------|--------|
| AWS認証エラー | IAMロールのARNが間違っている | `AWS_ROLE_ARN` Secretを確認 |
| カバレッジチェック失敗 | テストカバレッジが80%未満 | カバレッジが低いファイルにテストを追加 |
| CDK Deploy失敗 | CloudFormationスタックの更新に失敗 | CloudFormationコンソールでエラー詳細を確認 |
| スモークテスト失敗 | デプロイ直後でLambda関数がまだ準備中 | 待機時間を延長（30秒 → 60秒） |
| Slack通知が届かない | Webhook URLが間違っている | `SLACK_WEBHOOK_URL` Secretを確認 |
| LocalStackが起動しない | Docker Composeの起動失敗 | docker-compose.ymlの設定を確認 |
| テーブル作成に失敗 | LocalStackの起動未完了 | LocalStackのヘルスチェックを確認 |
| テストがタイムアウト | LocalStackの応答遅延 | jest.config.e2e.jsのtestTimeoutを延長 |

### ローカルでのテスト実行

```powershell
# すべてのテストを実行
npm test

# カバレッジレポート生成
npm test -- --coverage

# カバレッジレポート確認
start coverage/lcov-report/index.html  # Windows
open coverage/lcov-report/index.html   # macOS

# 特定のテストのみ実行
npm test -- --testPathPattern="\.test\.ts$"  # ユニットテストのみ
npm test -- --testPathPattern="\.property\.test\.ts$"  # プロパティテストのみ
npm test -- --testPathPattern="\.e2e\.test\.ts$"  # E2Eテストのみ
```

### E2Eテストのローカル実行

```powershell
# LocalStackを起動
docker-compose up -d

# セットアップスクリプトを実行
.\scripts\localstack-setup.ps1

# E2Eテストを実行
npm run test:e2e

# LocalStackを停止
docker-compose down -v
```

---

## ベストプラクティス

### 1. プルリクエスト前にローカルでテスト

```powershell
# Lint
npm run lint

# Type Check
npm run type-check

# Tests
npm test -- --coverage

# Security Audit
npm audit --audit-level=high
```

### 2. テスト失敗時はアーティファクトを確認

1. GitHub Actionsのワークフロー実行ページを開く
2. 「Artifacts」セクションから「e2e-test-artifacts」をダウンロード
3. `logs/localstack.log`を確認
4. `environment.txt`で環境情報を確認

### 3. 定期的にワークフローを実行

- 週1回、手動でワークフローを実行
- 依存関係の更新後は必ず実行
- LocalStackのバージョン更新後は必ず実行

---

## 関連ドキュメント

- **環境構築**: `environment-setup.md` - ローカル開発環境のセットアップ
- **デプロイ**: `deployment-guide.md` - デプロイ手順
- **デプロイチェックリスト**: `../../steering/infrastructure/deployment-checklist.md` - デプロイ前後の確認事項
- **環境変数**: `../../steering/infrastructure/environment-variables.md` - 環境変数の詳細定義
- **トラブルシューティング**: `../05-operations/troubleshooting.md` - 一般的な問題の解決方法
- **GitHub Actions公式ドキュメント**: https://docs.github.com/en/actions

---

**最終更新**: 2026-02-15  
**バージョン**: 2.0.0  
**作成者**: TDnet Data Collector Team

# CI/CD設定ガイド

**バージョン:** 1.0.0  
**最終更新:** 2026-02-15

TDnet Data CollectorのCI/CDパイプライン設定方法を説明します。

---

## 目次

1. [概要](#概要)
2. [GitHub Secrets設定](#github-secrets設定)
3. [AWS IAMロール設定](#aws-iamロール設定)
4. [ワークフロー設定](#ワークフロー設定)
5. [デプロイフロー](#デプロイフロー)
6. [ロールバック手順](#ロールバック手順)

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

1. GitHubリポジトリの Settings → Secrets and variables → Actions を開く
2. "New repository secret" をクリック
3. 各Secretを追加:
   - Name: `AWS_ROLE_ARN`
   - Value: `arn:aws:iam::123456789012:role/GitHubActionsRole`

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

### IAMロールの作成

GitHub ActionsからAWSリソースにアクセスするため、OIDC認証を使用します。

**Trust Relationship:**
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

### 必要な権限ポリシー（最小権限の原則）

**重要な原則:**
- ✅ すべてのリソースARNを具体的に指定（`*` を削除）
- ✅ 各サービスごとに必要最小限のアクションのみ許可
- ✅ IAM PassRoleに条件を追加（特定のサービスのみ）
- ✅ リソース名に `tdnet-` プレフィックスを強制

**主要な権限:**

| サービス | 必要なアクション | リソース制限 |
|---------|----------------|-------------|
| CloudFormation | DescribeStacks, CreateStack, UpdateStack, DeleteStack | `tdnet-*` スタックのみ |
| Lambda | CreateFunction, UpdateFunction, GetFunction, DeleteFunction | `tdnet-*` 関数のみ |
| DynamoDB | CreateTable, UpdateTable, DescribeTable, DeleteTable | `tdnet-*` テーブルのみ |
| S3 | CreateBucket, PutObject, GetObject, DeleteObject | `tdnet-*` バケットのみ |
| API Gateway | POST, PUT, PATCH, DELETE, GET | `/restapis/*` |
| IAM | PassRole, GetRole, GetRolePolicy | `tdnet-*` ロールのみ |

**詳細なポリシー例は以下を参照:**
- [AWS IAMベストプラクティス](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [セキュリティベストプラクティス](../../.kiro/steering/security/security-best-practices.md)

---

## ワークフロー設定

### test.yml の詳細

**トリガー条件:**
- `push` イベント: main, develop ブランチ
- `pull_request` イベント: main, develop ブランチ

**実行内容:**
1. Lint: ESLintでコード品質チェック
2. Type Check: TypeScriptの型チェック
3. Unit Tests: ユニットテストの実行
4. Coverage: カバレッジレポート生成（80%未満は失敗）
5. Security Audit: npm auditで脆弱性チェック

**カバレッジチェック（クロスプラットフォーム対応）:**
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

**トリガー条件:**
- `push` イベント: main ブランチ
- `workflow_dispatch`: 手動実行（環境選択可能）

**実行内容:**
1. Tests: テストの実行（デプロイ前の最終確認）
2. Coverage Check: 80%未満はデプロイ中止
3. Build: TypeScriptのビルド
4. AWS Credentials: OIDC認証でAWSアクセス
5. CDK Deploy: AWSリソースのデプロイ
6. Smoke Tests: デプロイ後の動作確認
7. Slack Notification: 成功/失敗を通知

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

---

## ロールバック手順

### 優先度1: CloudFormationからロールバック（最速・最安全）

**適用条件:**
- ✅ Lambda関数のコード変更のみ
- ✅ 環境変数の変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし

**手順:**
```
AWS Console → CloudFormation → TdnetStack → Stack actions → Roll back
```

**所要時間:** 5-10分

---

### 優先度2: 前のコミットにロールバック

**適用条件:**
- ✅ コード変更のみ
- ✅ DynamoDBテーブルのスキーマ変更なし
- ⚠️ 新しいリソースの追加なし

**手順:**
```bash
# 前のコミットを確認
git log --oneline -n 10

# revertコミットを作成
git revert <commit-hash>

# mainブランチにpush（自動デプロイ）
git push origin main
```

**所要時間:** 10-15分

---

### 優先度3: 手動デプロイ（最終手段）

**適用条件:**
- ⚠️ DynamoDBテーブルのスキーマ変更あり
- ⚠️ S3バケットの削除あり
- ⚠️ 複雑な変更

**手順:**
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

**所要時間:** 20-30分

---

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

| 問題 | 原因 | 解決策 |
|------|------|--------|
| AWS認証エラー | IAMロールのARNが間違っている | `AWS_ROLE_ARN` Secretを確認 |
| カバレッジチェック失敗 | テストカバレッジが80%未満 | カバレッジが低いファイルにテストを追加 |
| CDK Deploy失敗 | CloudFormationスタックの更新に失敗 | CloudFormationコンソールでエラー詳細を確認 |
| スモークテスト失敗 | デプロイ直後でLambda関数がまだ準備中 | 待機時間を延長（30秒 → 60秒） |
| Slack通知が届かない | Webhook URLが間違っている | `SLACK_WEBHOOK` Secretを確認 |

---

## 関連ドキュメント

- **[環境構築](./environment-setup.md)** - ローカル開発環境のセットアップ
- **[デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)** - デプロイ前後の確認事項
- **[環境変数](../../.kiro/steering/infrastructure/environment-variables.md)** - 環境変数の詳細定義
- **[トラブルシューティング](../05-operations/troubleshooting.md)** - 一般的な問題の解決方法

---

**最終更新:** 2026-02-15


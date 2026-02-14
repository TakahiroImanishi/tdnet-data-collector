# GitHub Secrets設定手順書

## 概要

TDnet Data CollectorのCI/CDパイプラインで使用するGitHub Secretsの設定手順を説明します。

## 必須のSecrets

### 1. AWS認証情報

CI/CDパイプラインでAWSリソースにアクセスするために必要です。

| Secret名 | 説明 | 例 |
|---------|------|-----|
| `AWS_ACCESS_KEY_ID` | AWSアクセスキーID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWSシークレットアクセスキー | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` |

### 2. Slack通知（オプション）

デプロイ結果をSlackに通知する場合に必要です。

| Secret名 | 説明 | 例 |
|---------|------|-----|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL | `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX` |

## 設定方法

### 方法1: IAMユーザー認証（シンプル）

#### ステップ1: IAMユーザーの作成

1. AWS Management Consoleにログイン
2. IAMサービスに移動
3. 「ユーザー」→「ユーザーを追加」をクリック
4. ユーザー名を入力（例: `github-actions-tdnet`）
5. 「アクセスキー - プログラムによるアクセス」を選択
6. 「次へ: アクセス許可」をクリック

#### ステップ2: IAMポリシーのアタッチ

以下のポリシーをアタッチします：

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

#### ステップ3: アクセスキーの取得

1. ユーザー作成完了後、アクセスキーIDとシークレットアクセスキーが表示されます
2. **必ずこの時点でダウンロードまたはコピーしてください**（後で確認できません）

#### ステップ4: GitHub Secretsに登録

1. GitHubリポジトリに移動
2. 「Settings」→「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. 以下のSecretsを追加：

   **AWS_ACCESS_KEY_ID**
   - Name: `AWS_ACCESS_KEY_ID`
   - Secret: IAMユーザーのアクセスキーID

   **AWS_SECRET_ACCESS_KEY**
   - Name: `AWS_SECRET_ACCESS_KEY`
   - Secret: IAMユーザーのシークレットアクセスキー

   **AWS_REGION**
   - Name: `AWS_REGION`
   - Secret: `ap-northeast-1`（または使用するリージョン）

### 方法2: OIDC認証（推奨）

OIDC（OpenID Connect）を使用すると、長期的なアクセスキーを保存する必要がなく、よりセキュアです。

#### ステップ1: IAMロールの作成

1. AWS Management Consoleにログイン
2. IAMサービスに移動
3. 「ロール」→「ロールを作成」をクリック
4. 「ウェブアイデンティティ」を選択
5. 「アイデンティティプロバイダー」で「GitHub」を選択（初回の場合は作成が必要）

#### ステップ2: GitHubアイデンティティプロバイダーの作成（初回のみ）

1. IAM → 「アイデンティティプロバイダー」→「プロバイダーを追加」
2. プロバイダーのタイプ: `OpenID Connect`
3. プロバイダーのURL: `https://token.actions.githubusercontent.com`
4. 対象者: `sts.amazonaws.com`
5. 「プロバイダーを追加」をクリック

#### ステップ3: 信頼ポリシーの設定

以下の信頼ポリシーを設定します（`YOUR_GITHUB_ORG`と`YOUR_REPO_NAME`を置き換えてください）：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO_NAME:*"
        }
      }
    }
  ]
}
```

#### ステップ4: IAMポリシーのアタッチ

方法1と同じポリシーをアタッチします。

#### ステップ5: ロールARNの取得

1. 作成したロールの詳細ページを開く
2. ロールARNをコピー（例: `arn:aws:iam::123456789012:role/github-actions-tdnet`）

#### ステップ6: GitHub Secretsに登録

1. GitHubリポジトリに移動
2. 「Settings」→「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. 以下のSecretsを追加：

   **AWS_ROLE_ARN**
   - Name: `AWS_ROLE_ARN`
   - Secret: ロールARN

   **AWS_REGION**
   - Name: `AWS_REGION`
   - Secret: `ap-northeast-1`

#### ステップ7: ワークフローファイルの更新

`.github/workflows/deploy.yml`を以下のように更新します：

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
    aws-region: ${{ secrets.AWS_REGION || 'ap-northeast-1' }}
```

## Slack通知の設定（オプション）

### ステップ1: Slack Incoming Webhookの作成

1. Slackワークスペースにログイン
2. [Slack API](https://api.slack.com/apps)に移動
3. 「Create New App」→「From scratch」を選択
4. アプリ名を入力（例: `TDnet Deployment Notifier`）
5. ワークスペースを選択
6. 「Incoming Webhooks」を有効化
7. 「Add New Webhook to Workspace」をクリック
8. 通知先のチャンネルを選択
9. Webhook URLをコピー

### ステップ2: GitHub Secretsに登録

1. GitHubリポジトリに移動
2. 「Settings」→「Secrets and variables」→「Actions」をクリック
3. 「New repository secret」をクリック
4. 以下のSecretを追加：

   **SLACK_WEBHOOK_URL**
   - Name: `SLACK_WEBHOOK_URL`
   - Secret: Webhook URL

## 設定の確認

### 1. GitHub Secretsの確認

1. GitHubリポジトリに移動
2. 「Settings」→「Secrets and variables」→「Actions」をクリック
3. 以下のSecretsが登録されていることを確認：
   - ✅ `AWS_ACCESS_KEY_ID`（または`AWS_ROLE_ARN`）
   - ✅ `AWS_SECRET_ACCESS_KEY`（IAMユーザー認証の場合）
   - ✅ `AWS_REGION`
   - ✅ `SLACK_WEBHOOK_URL`（オプション）

### 2. ワークフローの手動実行

1. GitHubリポジトリに移動
2. 「Actions」タブをクリック
3. 「Deploy」ワークフローを選択
4. 「Run workflow」をクリック
5. 環境を選択（dev/prod）
6. 「Run workflow」をクリック
7. ワークフローが正常に実行されることを確認

## トラブルシューティング

### エラー: `Unable to locate credentials`

**原因**: AWS認証情報が正しく設定されていません。

**解決策**:
1. GitHub Secretsが正しく登録されているか確認
2. Secret名が正確か確認（大文字小文字を区別）
3. ワークフローファイルでSecret名が正しく参照されているか確認

### エラー: `Access Denied`

**原因**: IAMユーザー/ロールに必要な権限がありません。

**解決策**:
1. IAMポリシーが正しくアタッチされているか確認
2. 必要な権限が含まれているか確認
3. リソースベースのポリシーで拒否されていないか確認

### エラー: `Invalid webhook URL`

**原因**: Slack Webhook URLが正しくありません。

**解決策**:
1. Webhook URLが正しくコピーされているか確認
2. Webhook URLが有効か確認（Slack APIで確認）
3. Secret名が`SLACK_WEBHOOK_URL`であることを確認

### OIDC認証エラー

**原因**: 信頼ポリシーが正しく設定されていません。

**解決策**:
1. アイデンティティプロバイダーが正しく作成されているか確認
2. 信頼ポリシーのリポジトリ名が正確か確認
3. ロールARNが正しくコピーされているか確認

## セキュリティベストプラクティス

### 1. 最小権限の原則

- 必要最小限の権限のみを付与
- 本番環境では、リソースごとに権限を制限

### 2. アクセスキーのローテーション

- IAMユーザー認証を使用する場合、定期的にアクセスキーをローテーション
- 90日ごとのローテーションを推奨

### 3. OIDC認証の使用

- 可能な限りOIDC認証を使用
- 長期的なアクセスキーの保存を避ける

### 4. Secretsの監査

- 定期的にSecretsの使用状況を確認
- 不要なSecretsは削除

### 5. 環境ごとの分離

- 開発環境と本番環境で異なるIAMユーザー/ロールを使用
- GitHub Environmentsを使用して環境ごとにSecretsを管理

## 参考資料

- [GitHub Actions - Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [AWS - IAM ユーザーの作成](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_users_create.html)
- [AWS - OIDC アイデンティティプロバイダー](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [Slack - Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)


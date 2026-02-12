# CI/CDパイプライン

TDnet Data CollectorプロジェクトのCI/CDパイプラインドキュメント。

## 概要

GitHub Actionsを使用した自動化されたCI/CDパイプラインを構築しています。

### ワークフロー

1. **Test** - コード品質とテストの自動実行
2. **Deploy** - AWSへの自動デプロイ
3. **Dependency Update** - 依存関係の週次更新

## ワークフロー詳細

### 1. Test Workflow (`.github/workflows/test.yml`)

**トリガー**:
- プルリクエスト作成時（main, developブランチ）
- main, developブランチへのプッシュ時
- 手動実行

**ジョブ**:

#### Lint & Type Check
- ESLintによるコード品質チェック
- TypeScriptの型チェック
- コードフォーマットチェック（Prettier）

#### Security Audit
- `npm audit`によるセキュリティ脆弱性チェック
- 脆弱性レポート生成
- moderate以上の脆弱性を検出

#### Unit Tests
- ユニットテストの実行
- カバレッジレポート生成
- カバレッジ閾値チェック（80%以上）
- カバレッジレポートのアップロード

#### Property-Based Tests
- プロパティベーステストの実行
- fast-checkを使用したテスト

#### Test Summary
- すべてのテスト結果の集約
- GitHub Step Summaryへのレポート出力
- テスト失敗時はワークフロー失敗

**成果物**:
- カバレッジレポート（30日間保持）
- セキュリティ監査結果（30日間保持）
- テスト結果（30日間保持）

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

**トリガー**:
- mainブランチへのプッシュ時
- 手動実行（環境選択可能: dev/prod）

**ジョブ**:

#### CDK Diff
- CDKの変更差分を確認
- デプロイ前の変更内容レビュー

#### CDK Deploy
- プロジェクトのビルド
- AWS CDKによるデプロイ
- スタック出力の取得
- デプロイレポート生成

**環境変数**:
- `AWS_ACCESS_KEY_ID` - AWS認証情報（GitHub Secrets）
- `AWS_SECRET_ACCESS_KEY` - AWS認証情報（GitHub Secrets）
- `AWS_REGION` - AWSリージョン（デフォルト: ap-northeast-1）

#### Smoke Tests
- API Healthエンドポイントのテスト
- Lambda関数の存在確認
- DynamoDBテーブルの状態確認
- S3バケットの存在確認

#### Slack Notification（オプション）
- デプロイ結果のSlack通知
- `SLACK_WEBHOOK_URL`が設定されている場合のみ実行

**成果物**:
- スタック出力（30日間保持）
- CDK出力ファイル（30日間保持）

### 3. Dependency Update Workflow (`.github/workflows/dependency-update.yml`)

**トリガー**:
- 毎週月曜日午前9時（JST）に自動実行
- 手動実行

**ジョブ**:

#### Update Dependencies
- 古いパッケージの検出
- パッチ・マイナーバージョンの自動更新
- テストの実行（lint, build, test）
- プルリクエストの自動作成

**更新ポリシー**:
- パッチバージョン（1.0.x）: 自動更新
- マイナーバージョン（1.x.0）: 自動更新
- メジャーバージョン（x.0.0）: 手動確認が必要

#### Security Audit
- 更新後のセキュリティ監査
- 脆弱性レポート生成

**成果物**:
- 更新レポート（30日間保持）
- セキュリティ監査レポート（30日間保持）
- 更新されたpackage.json（30日間保持）

## GitHub Secrets設定

以下のSecretsをGitHubリポジトリに設定する必要があります：

### 必須
- `AWS_ACCESS_KEY_ID` - AWSアクセスキーID
- `AWS_SECRET_ACCESS_KEY` - AWSシークレットアクセスキー
- `AWS_REGION` - AWSリージョン（デフォルト: ap-northeast-1）

### オプション
- `SLACK_WEBHOOK_URL` - Slack通知用WebhookURL

## セットアップ手順

### 1. GitHub Secretsの設定

```bash
# GitHubリポジトリの Settings > Secrets and variables > Actions に移動
# 以下のSecretsを追加:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_REGION (オプション)
# - SLACK_WEBHOOK_URL (オプション)
```

### 2. AWS IAMユーザーの作成

CI/CD用のIAMユーザーを作成し、以下の権限を付与：

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
        "iam:*",
        "apigateway:*",
        "logs:*",
        "events:*",
        "sns:*",
        "sqs:*",
        "secretsmanager:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**注意**: 本番環境では、最小権限の原則に従い、必要な権限のみを付与してください。

### 3. ワークフローの有効化

ワークフローは自動的に有効化されます。手動実行する場合：

```bash
# GitHub Actions タブに移動
# 実行したいワークフローを選択
# "Run workflow" ボタンをクリック
```

## ワークフロー実行例

### テストワークフローの実行

```bash
# プルリクエスト作成時に自動実行
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# GitHubでプルリクエストを作成
```

### デプロイワークフローの実行

```bash
# mainブランチへのマージ時に自動実行
git checkout main
git merge feature/new-feature
git push origin main
```

### 依存関係更新ワークフローの手動実行

```bash
# GitHub Actions タブに移動
# "Dependency Update" ワークフローを選択
# "Run workflow" ボタンをクリック
```

## トラブルシューティング

### テストが失敗する場合

1. ローカルでテストを実行して問題を特定
   ```bash
   npm run lint
   npm run build
   npm test
   ```

2. カバレッジが80%未満の場合
   ```bash
   npm run test:coverage
   # カバレッジレポートを確認: coverage/lcov-report/index.html
   ```

### デプロイが失敗する場合

1. AWS認証情報を確認
   ```bash
   aws sts get-caller-identity
   ```

2. CDK Diffで変更内容を確認
   ```bash
   npm run cdk:diff
   ```

3. CloudFormationコンソールでエラーを確認
   - AWS Console > CloudFormation > TdnetDataCollectorStack
   - Eventsタブでエラーメッセージを確認

### 依存関係更新が失敗する場合

1. ローカルで依存関係を更新
   ```bash
   npm update
   npm test
   ```

2. メジャーバージョン更新が必要な場合
   ```bash
   # 手動で更新
   npm install <package>@latest
   npm test
   ```

## ベストプラクティス

### 1. プルリクエストのマージ前
- すべてのテストが成功していることを確認
- カバレッジが80%以上であることを確認
- セキュリティ監査で重大な脆弱性がないことを確認

### 2. デプロイ前
- CDK Diffで変更内容を確認
- 本番環境へのデプロイは慎重に実行
- デプロイ後はスモークテストの結果を確認

### 3. 依存関係更新
- 週次で自動更新されるプルリクエストをレビュー
- メジャーバージョン更新は手動で確認
- 更新後は必ずテストを実行

### 4. セキュリティ
- AWS認証情報は絶対にコードにコミットしない
- GitHub Secretsを使用して機密情報を管理
- 定期的にセキュリティ監査を実行

## 監視とアラート

### GitHub Actions
- ワークフロー実行状態はGitHub Actionsタブで確認
- 失敗時はメール通知が送信される

### Slack通知（オプション）
- デプロイ成功/失敗時にSlackに通知
- `SLACK_WEBHOOK_URL`を設定することで有効化

### CloudWatch
- Lambda関数のログはCloudWatch Logsで確認
- メトリクスとアラームはCloudWatchで設定

## 関連ドキュメント

- [デプロイチェックリスト](../.kiro/steering/infrastructure/deployment-checklist.md)
- [テスト戦略](../.kiro/steering/development/testing-strategy.md)
- [セキュリティベストプラクティス](../.kiro/steering/security/security-best-practices.md)
- [環境変数管理](../.kiro/steering/infrastructure/environment-variables.md)

## 更新履歴

- 2026-02-12: CI/CDパイプライン初版作成

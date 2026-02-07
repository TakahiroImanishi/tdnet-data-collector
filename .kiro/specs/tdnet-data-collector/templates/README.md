# テンプレートファイル

このフォルダには、TDnet Data Collectorプロジェクトの実装に必要なテンプレートファイルが含まれています。

## ファイル一覧

### package.json.example
プロジェクトのpackage.jsonテンプレート。

**使用方法:**
```bash
cp package.json.example ../../package.json
cd ../..
npm install
```

**含まれる内容:**
- 必要な依存関係（AWS SDK、cheerio、axios等）
- 開発依存関係（TypeScript、Jest、ESLint等）
- npm scripts（test、build、deploy等）
- エンジン要件（Node.js 20.x以上）

### github-workflows/
GitHub Actionsワークフローのテンプレート。

**使用方法:**
```bash
# プロジェクトルートで実行
mkdir -p .github/workflows
cp .kiro/specs/tdnet-data-collector/templates/github-workflows/*.yml .github/workflows/
```

#### test.yml
テスト自動実行ワークフロー。

**トリガー:**
- mainブランチへのpush
- developブランチへのpush
- Pull Request作成時

**実行内容:**
- Linter実行
- 型チェック
- ユニットテスト
- プロパティベーステスト
- カバレッジチェック（80%以上）
- セキュリティ監査

#### deploy.yml
デプロイワークフロー。

**トリガー:**
- mainブランチへのpush
- 手動実行（環境選択可能: dev/prod）

**実行内容:**
- テスト実行
- カバレッジチェック
- CDK Synth
- CDK Diff
- CDK Deploy
- スモークテスト
- Slack通知（オプション）

**必要なGitHub Secrets:**
- `AWS_ROLE_ARN` - AWSロールARN
- `API_ENDPOINT` - APIエンドポイントURL
- `API_KEY` - APIキー
- `SLACK_WEBHOOK` - Slack Webhook URL（オプション）

#### dependency-update.yml
依存関係自動更新ワークフロー。

**トリガー:**
- 毎週月曜日 00:00 UTC
- 手動実行

**実行内容:**
- npm update実行
- セキュリティ修正適用
- テスト実行
- Pull Request自動作成

## カスタマイズ

テンプレートファイルは、プロジェクトの要件に応じてカスタマイズしてください：

### package.json
- `name`: プロジェクト名
- `author`: 作成者情報
- `repository`: リポジトリURL

### GitHub Actionsワークフロー
- `reviewers`: Pull Requestレビュアー
- `assignees`: Pull Request担当者
- Node.jsバージョン（必要に応じて）
- テストタイムアウト値

## 注意事項

1. **GitHub Secrets**: デプロイワークフローを使用する前に、必要なSecretsを設定してください
2. **AWS認証**: OIDC認証を使用する場合は、AWSでIAMロールを事前に作成してください
3. **Slack通知**: オプション機能です。不要な場合はワークフローから削除してください
4. **カバレッジ閾値**: 80%未満の場合、デプロイが失敗します

## 関連ドキュメント

- **実装チェックリスト**: `../docs/implementation-checklist.md`
- **設計書**: `../docs/design.md`
- **CI/CD設計**: `../docs/design.md`の「CI/CDパイプライン」セクション

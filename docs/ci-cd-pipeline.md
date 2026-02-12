# CI/CDパイプライン

## 概要

TDnet Data Collectorプロジェクトでは、GitHub Actionsを使用したCI/CDパイプラインを構築しています。

## テストカバレッジ目標

すべてのコードメトリクスで**80%以上**のカバレッジを維持します：

- **Statements**: 80%以上
- **Branches**: 80%以上
- **Functions**: 80%以上
- **Lines**: 80%以上

## GitHub Actionsワークフロー

### 1. Test Workflow (`.github/workflows/test.yml`)

プルリクエストおよびmainブランチへのプッシュ時に自動実行されます。

**実行内容:**
- Lint（ESLint）
- 型チェック（TypeScript）
- ユニットテスト
- プロパティベーステスト
- カバレッジレポート生成
- セキュリティ監査（npm audit）

**カバレッジチェック:**
```yaml
- name: Run tests with coverage
  run: npm test -- --coverage --coverageReporters=json-summary

- name: Check coverage threshold
  run: |
    node -e "
      const coverage = require('./coverage/coverage-summary.json');
      const total = coverage.total;
      if (total.statements.pct < 80 || total.branches.pct < 80 || 
          total.functions.pct < 80 || total.lines.pct < 80) {
        console.error('カバレッジが80%未満です');
        process.exit(1);
      }
    "
```

### 2. Deploy Workflow (`.github/workflows/deploy.yml`)

mainブランチへのマージ時に自動実行されます。

**実行内容:**
- CDK Diff実行（変更内容の確認）
- CDK Deploy実行（本番環境へのデプロイ）
- スモークテスト実行
- Slack通知

**必要なGitHub Secrets:**
- `AWS_ACCESS_KEY_ID`: AWSアクセスキーID
- `AWS_SECRET_ACCESS_KEY`: AWSシークレットアクセスキー
- `AWS_REGION`: AWSリージョン（例: ap-northeast-1）
- `SLACK_WEBHOOK_URL`: Slack通知用WebhookURL

### 3. Dependency Update Workflow (`.github/workflows/dependency-update.yml`)

毎週月曜日午前9時（JST）に自動実行されます。

**実行内容:**
- 依存関係の更新（npm update）
- セキュリティ監査（npm audit）
- テスト実行
- プルリクエスト作成

## ローカルでのテスト実行

### すべてのテストを実行
```bash
npm test
```

### カバレッジレポート生成
```bash
npm test -- --coverage
```

### カバレッジレポート確認
```bash
# HTMLレポートを開く
start coverage/lcov-report/index.html  # Windows
open coverage/lcov-report/index.html   # macOS
```

### 特定のテストのみ実行
```bash
# ユニットテストのみ
npm test -- --testPathPattern="\.test\.ts$"

# プロパティテストのみ
npm test -- --testPathPattern="\.property\.test\.ts$"

# E2Eテストのみ
npm test -- --testPathPattern="\.e2e\.test\.ts$"
```

## CI/CD検証テスト

`src/__tests__/ci-cd-verification.test.ts` で以下を検証します：

1. **Property 15: テストカバレッジの維持**
   - Statements カバレッジが80%以上
   - Branches カバレッジが80%以上
   - Functions カバレッジが80%以上
   - Lines カバレッジが80%以上

2. **GitHub Actions Workflow検証**
   - test.yml ワークフローが存在
   - test.yml にカバレッジチェックが含まれている
   - deploy.yml ワークフローが存在
   - dependency-update.yml ワークフローが存在

3. **セキュリティ監査**
   - npm audit で重大な脆弱性がない

## トラブルシューティング

### カバレッジが80%未満の場合

1. カバレッジレポートを確認
   ```bash
   npm test -- --coverage
   start coverage/lcov-report/index.html
   ```

2. 未カバーの箇所を特定
   - 赤色: 未実行のコード
   - 黄色: 部分的に実行されたコード

3. 追加テストを作成
   - 条件分岐のテスト
   - エラーハンドリングのテスト
   - エッジケースのテスト

### GitHub Actionsが失敗する場合

1. ローカルで同じコマンドを実行
   ```bash
   npm run lint
   npm run type-check
   npm test -- --coverage
   npm audit --audit-level=high
   ```

2. エラーメッセージを確認
3. 修正後、再度プッシュ

## 参考資料

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Jest Coverage Configuration](https://jestjs.io/docs/configuration#coveragethreshold-object)
- [npm audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)

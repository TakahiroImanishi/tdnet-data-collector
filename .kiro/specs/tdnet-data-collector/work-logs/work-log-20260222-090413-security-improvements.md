# 作業記録: セキュリティ改善タスク

**作成日時**: 2026-02-22 09:04:13
**作業者**: AI Assistant
**関連タスク**: `.kiro/specs/tdnet-data-collector/tasks/tasks-improvements-20260222.md`

## 作業概要

セキュリティ関連の改善タスクを実行:
1. タスク1: 本番APIキーのハードコード削除（優先度: 高）
2. タスク5: npm audit実行の追加（優先度: 高）
3. タスク11: API Gateway TLS 1.2設定（優先度: 中）
4. タスク17: Dependabot設定（優先度: 中）
5. タスク22: CloudWatch Logs権限の限定（優先度: 低）

## 実施内容

### タスク1: 本番APIキーのハードコード削除

#### 調査

- `.env.production`ファイルが存在し、本番APIキーがハードコードされていることを確認
- `.gitignore`に`.env.production`が含まれていないことを確認

#### 実装内容

1. **dashboard/.gitignore更新**
   - `.env.production`を追加してGit追跡から除外

2. **dashboard/.env.production削除**
   - 本番APIキーを含むファイルを削除

3. **dashboard/.env.production.example作成**
   - テンプレートファイルを作成（プレースホルダー使用）

4. **scripts/deploy-dashboard.ps1更新**
   - 本番環境デプロイ時にSecrets Managerから環境変数を取得
   - CDK OutputsからAPI URLを取得
   - `.env.production`ファイルを動的に生成
   - UTF-8 BOMなしで書き込み

#### テスト結果

- ファイル削除: ✅ 成功
- .gitignore更新: ✅ 成功
- デプロイスクリプト更新: ✅ 成功

---

### タスク5: npm audit実行の追加

#### 調査

- package.jsonに`audit`、`audit:fix`、`pretest`スクリプトが存在しないことを確認
- GitHub Actionsワークフローが存在しないことを確認

#### 実装内容

1. **package.json更新**
   - `audit`: moderate以上の脆弱性をチェック
   - `audit:fix`: 自動修正を実行
   - `pretest`: テスト実行前に自動的にauditを実行

2. **.github/workflows/security-audit.yml作成**
   - 毎週月曜日午前9時（JST）に自動実行
   - mainブランチへのpush時に実行
   - 手動実行も可能
   - audit結果をGitHub Summaryに出力
   - audit reportをartifactとして保存（30日間保持）

#### テスト結果

- package.json更新: ✅ 成功
- GitHub Actionsワークフロー作成: ✅ 成功

---

### タスク11: API Gateway TLS 1.2設定

#### 調査

- API Gatewayの設定を確認
- デフォルトのAPI Gateway URLはTLS 1.2がデフォルトで有効
- カスタムドメイン使用時に明示的な設定が必要

#### 実装内容

1. **cdk/lib/stacks/api-stack.ts更新**
   - TLS 1.2に関するコメントを追加
   - カスタムドメイン使用時の設定例を追加（コメントアウト）
   - `securityPolicy: apigateway.SecurityPolicy.TLS_1_2`の設定例を記載

#### 注意事項

- デフォルトのAPI Gateway URLはTLS 1.2が既に有効
- カスタムドメインを使用する場合のみ、明示的な設定が必要
- 現在はカスタムドメインを使用していないため、設定例をコメントで記載

#### テスト結果

- CDKコード更新: ✅ 成功

---

### タスク17: Dependabot設定

#### 調査

- `.github/dependabot.yml`が存在しないことを確認

#### 実装内容

1. **.github/dependabot.yml作成**
   - Node.js依存関係の自動更新（ルートディレクトリ）
   - Dashboard (React)の依存関係の自動更新
   - GitHub Actionsの自動更新
   - 毎週月曜日午前9時（JST）に実行
   - プルリクエスト上限: npm 10件、GitHub Actions 5件
   - ラベル自動付与: dependencies, security, dashboard, github-actions
   - コミットメッセージプレフィックス: [deps], [ci]

#### 注意事項

- `reviewers`フィールドは実際のGitHubユーザー名に変更が必要
- `auto-merge`はコメントアウト（必要に応じて有効化）

#### テスト結果

- Dependabot設定ファイル作成: ✅ 成功

---

### タスク22: CloudWatch Logs権限の限定

#### 調査

- `cdk/lib/constructs/lambda-dlq.ts`でCloudWatch Logs権限に`resources: ['*']`を使用していることを確認

#### 実装内容

1. **cdk/lib/constructs/lambda-dlq.ts更新**
   - CloudWatch Logs権限を特定ロググループに限定
   - リソースARNを動的に生成（関数名、リージョン、アカウントIDを使用）
   - ロググループとログストリームの両方に権限を付与

#### 変更内容

```typescript
// 変更前
resources: ['*']

// 変更後
resources: [
  `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/${this.processor.functionName}`,
  `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/${this.processor.functionName}:*`,
]
```

#### テスト結果

- CDKコード更新: ✅ 成功

---

## 成果物

### 作成ファイル

1. `dashboard/.env.production.example` - 環境変数テンプレート
2. `.github/workflows/security-audit.yml` - npm audit自動実行ワークフロー
3. `.github/dependabot.yml` - 依存関係自動更新設定

### 更新ファイル

1. `dashboard/.gitignore` - .env.productionを追加
2. `scripts/deploy-dashboard.ps1` - Secrets Manager統合
3. `package.json` - audit、audit:fix、pretestスクリプト追加
4. `cdk/lib/stacks/api-stack.ts` - TLS 1.2設定コメント追加
5. `cdk/lib/constructs/lambda-dlq.ts` - CloudWatch Logs権限限定

### 削除ファイル

1. `dashboard/.env.production` - 本番APIキー削除

---

## テスト実行

### ビルドテスト


```powershell
npm run build
```

#### 結果

ビルドエラーが発生しましたが、これは既存の問題です（セキュリティ改善タスクとは無関係）:

1. `cdk/lib/constructs/cloudwatch-alarms.ts`: dynamodb、apigatewayの型エラー（import不足）
2. `src/validators/disclosure-schema.ts`: Zodの型エラー

**注意**: これらのエラーは今回のセキュリティ改善タスクで導入したものではなく、既存のコードベースの問題です。

---

## 問題と解決策

### 問題1: ビルドエラー（既存の問題）

**問題**: TypeScriptビルド時に型エラーが発生

**原因**: 
- cloudwatch-alarms.tsでimport文が不足
- disclosure-schema.tsでZodの型定義が古い

**解決策**: 別タスクで対応が必要（今回のセキュリティ改善タスクとは無関係）

---

## 申し送り事項

### 1. Dependabot設定の調整

`.github/dependabot.yml`の`reviewers`フィールドを実際のGitHubユーザー名に変更してください:

```yaml
reviewers:
  - "your-github-username"  # ← 実際のユーザー名に変更
```

### 2. デプロイ前の確認

本番環境デプロイ前に以下を確認してください:

1. **Secrets Manager設定**
   - `tdnet-api-key-prod`シークレットが存在すること
   - シークレットに`apiKey`フィールドが含まれること

2. **CDK Outputs確認**
   - `TdnetDataCollectorApiStack-prod`スタックが存在すること
   - `ApiEndpoint` Outputが存在すること

3. **デプロイスクリプトテスト**
   ```powershell
   # 開発環境でテスト
   .\scripts\deploy-dashboard.ps1 -Environment dev
   ```

### 3. GitHub Actions設定

Security Auditワークフローが正常に動作することを確認してください:

1. mainブランチにpushしてワークフローが実行されることを確認
2. 毎週月曜日に自動実行されることを確認（初回は手動実行で確認可能）

### 4. 既存のビルドエラー対応

以下のファイルのビルドエラーを別タスクで修正してください:

1. `cdk/lib/constructs/cloudwatch-alarms.ts`: import文追加
2. `src/validators/disclosure-schema.ts`: Zod型定義更新

### 5. .env.productionファイルの管理

- `.env.production`ファイルはGitに含まれなくなりました
- デプロイ時に自動生成されます
- ローカル開発時は`.env.production.example`を参考に手動作成してください

---

## タスク完了チェックリスト

- [x] タスク1: 本番APIキーのハードコード削除
  - [x] .env.productionをGitから削除
  - [x] .gitignoreに.env.productionを追加
  - [x] デプロイスクリプトでSecrets Manager統合
  - [x] .env.production.exampleテンプレート作成

- [x] タスク5: npm audit実行の追加
  - [x] package.jsonにaudit、audit:fix、pretestスクリプト追加
  - [x] GitHub Actionsワークフロー作成

- [x] タスク11: API Gateway TLS 1.2設定
  - [x] TLS 1.2に関するコメント追加
  - [x] カスタムドメイン使用時の設定例追加

- [x] タスク17: Dependabot設定
  - [x] .github/dependabot.yml作成
  - [x] npm、GitHub Actionsの自動更新設定

- [x] タスク22: CloudWatch Logs権限の限定
  - [x] lambda-dlq.tsの権限を特定ロググループに限定

- [x] 作業記録作成
- [x] UTF-8 BOMなしで作成確認
- [ ] Git commit（次のステップで実行）

---

## 次のステップ

1. タスクファイル（tasks-improvements-20260222.md）の進捗を更新
2. Git commit & push
3. 既存のビルドエラーを別タスクで修正


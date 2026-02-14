# 実装開始前チェックリスト

**最終更新:** 2026-02-15

## 関連ドキュメント

- `requirements.md` - 要件定義
- `design.md` - 設計書
- `correctness-properties-checklist.md` - 設計検証項目
- `../../steering/core/tdnet-implementation-rules.md` - 実装ルール

---

## 1. 要件・設計の確認

- [ ] すべての要件が設計に反映されている
- [ ] Correctness Propertiesが定義されている
- [ ] データモデルが確定している
- [ ] API仕様が確定している

## 2. 技術スタックの確認

- [ ] Node.js 20.x環境が準備されている
- [ ] AWS CDK v2がインストールされている
- [ ] TypeScript 5.x以上がインストールされている
- [ ] AWSアカウントが準備されている

## 3. 開発環境の準備

- [ ] GitHubリポジトリが作成されている
- [ ] ESLint/Prettier設定が完了している
- [ ] Jest設定が完了している
- [ ] fast-checkがインストールされている

## 4. CI/CDの準備

- [ ] GitHub Actionsワークフローが作成されている
- [ ] AWS認証情報がGitHub Secretsに設定されている
- [ ] テスト自動実行が設定されている
- [ ] カバレッジ閾値（80%）が設定されている

## 5. セキュリティの準備

- [ ] IAMロールが設計されている
- [ ] Secrets Managerの使用が計画されている
- [ ] 暗号化設定（S3, DynamoDB）が計画されている
- [ ] APIキー認証が計画されている

## 6. 監視の準備

- [ ] CloudWatch Logsの設定が計画されている
- [ ] カスタムメトリクスが定義されている
- [ ] アラームが設計されている

## 7. ドキュメントの確認

- [ ] requirements.mdが最新である
- [ ] design.mdが最新である
- [ ] すべてのsteeringファイルが作成されている

## 8. テスト戦略の確認

- [ ] ユニットテストの方針が決定されている
- [ ] プロパティベーステストの方針が決定されている
- [ ] 統合テストの方針が決定されている
- [ ] テストカバレッジ80%以上の目標が設定されている

## 9. 実装順序の確認

- [ ] Phase 1（基本機能）の範囲が明確である
- [ ] Phase 2（拡張機能）の範囲が明確である
- [ ] Phase 3（最適化）の範囲が明確である

## 10. 最終確認

- [ ] すべてのsteeringファイルを読んで理解した
- [ ] requirements.mdとdesign.mdに矛盾がない
- [ ] 実装に必要な情報がすべて揃っている

---

## 実装開始アクション

すべての項目をチェックしたら、以下を実行：

```bash
# リポジトリの初期化
git init
npm init -y
npm install

# CDKプロジェクトの初期化
npx cdk init app --language typescript

# 最初のコミット
git add .
git commit -m "chore: initial commit"
```

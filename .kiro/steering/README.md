# TDnet Data Collector - Steering Files

## フォルダ構造

| フォルダ | 読み込み | 内容 |
|---------|---------|------|
| **core/** | 常時 | 実装ルール、エラーハンドリング、タスク実行 |
| **development/** | 条件付 | テスト、バリデーション、Lambda、命名規則、ワークフロー、MCP |
| **infrastructure/** | 条件付 | デプロイ、環境変数、パフォーマンス、監視 |
| **security/** | 条件付 | セキュリティベストプラクティス |
| **api/** | 条件付 | API設計、エラーコード |
| **meta/** | 条件付 | fileMatchPatternテスト |

**条件付き読み込み**: front-matterの`fileMatchPattern`一致時のみ

## 主要fileMatchパターン

| パターン | トリガーされるsteering |
|---------|---------------------|
| `**/*.test.ts\|**/*.spec.ts` | testing-strategy, mcp-server-guidelines |
| `**/lambda/**/*.ts` | lambda-implementation, error-handling-*, environment-variables, performance-optimization, mcp-server-guidelines |
| `**/api/**/*.ts` | api-design-guidelines, error-codes, error-handling-implementation, mcp-server-guidelines |
| `**/cdk/**/*.ts` | environment-variables, mcp-server-guidelines |
| `**/cdk/lib/**/*-stack.ts` | security-best-practices, deployment-checklist, mcp-server-guidelines |
| `**/scraper/**/*.ts` | tdnet-scraping-patterns, error-handling-implementation, mcp-server-guidelines |
| `**/validators/**/*.ts` | data-validation |
| `**/.env*` | environment-variables |
| `**/docs/**/*.md` | documentation-standards, mcp-server-guidelines |

**詳細**: `meta/pattern-matching-tests.md`

## メンテナンス

新規steeringファイル追加時:
1. 適切なフォルダに配置
2. front-matter設定
3. README.md更新
4. 関連ファイルの「関連ドキュメント」更新



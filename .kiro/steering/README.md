# TDnet Data Collector - Steering Files

## フォルダ構造

| フォルダ | 読み込み | 内容 |
|---------|---------|------|
| **core/** | 常時 | 実装ルール、エラーハンドリング、タスク実行、ファイルエンコーディング |
| **development/** | 条件付 | Lambda、Scripts、Step Functions、テスト、バリデーション、命名規則、ワークフロー、MCP |
| **infrastructure/** | 条件付 | CDK、デプロイ、環境変数、パフォーマンス、監視 |
| **security/** | 条件付 | セキュリティベストプラクティス |
| **api/** | 条件付 | API設計、エラーコード |
| **meta/** | 条件付 | fileMatchPatternテスト |
| **archive/** | - | 旧バージョンファイル（読み込まれない） |

**条件付き読み込み**: front-matterの`fileMatchPattern`一致時のみ

## 主要fileMatchパターン

| パターン | トリガーされるsteering |
|---------|---------------------|
| `**/*.test.ts\|**/*.spec.ts` | testing-strategy, mcp-server-guidelines |
| `**/lambda/**/*.ts` | lambda-guide, mcp-server-guidelines |
| `**/lambda/collector-*/**/*.ts` | step-functions-guide |
| `**/step-functions/**/*.ts\|**/state-machines/**/*.json` | step-functions-guide |
| `**/api/**/*.ts` | api-design-guidelines, error-codes, mcp-server-guidelines |
| `**/cdk/lib/**/*.ts` | cdk-implementation, mcp-server-guidelines |
| `**/cdk/lib/**/*-stack.ts` | security-best-practices, deployment-checklist, tdnet-file-naming |
| `**/cdk/lib/constructs/*lambda*.ts` | performance-optimization |
| `**/scraper/**/*.ts` | tdnet-scraping-patterns, mcp-server-guidelines |
| `**/validators/**/*.ts` | data-validation |
| `**/utils/error*.ts` | error-handling-implementation |
| `**/.env*` | environment-variables |
| `**/config/**/*.ts` | environment-variables |
| `scripts/**/*.ps1\|scripts/**/*.ts` | scripts-guide, powershell-encoding-guidelines |
| `scripts/{check-step-functions-execution,cancel-step-functions-execution}.ps1` | step-functions-guide |
| `**/docs/**/*.md` | documentation-standards, mcp-documentation-guidelines |
| `README.md` | documentation-standards |
| `**/.kiro/specs/**/tasks*.md` | workflow-guidelines |
| `**/.kiro/specs/**/work-logs/**/*.md` | workflow-guidelines, mcp-documentation-guidelines |

**詳細**: `meta/pattern-matching-tests.md`

## 最適化履歴

### 2026-02-23: Steering統合・最適化

**統合されたファイル**:
- `scripts-guide.md` ← deployment-scripts, setup-scripts, data-scripts, monitoring-scripts, scripts-implementation
- `lambda-guide.md` ← lambda-implementation, lambda-utils-implementation
- `cdk-implementation.md` ← error-handling-enforcement（統合）

**新規作成**:
- `step-functions-guide.md` - Step Functions実装・運用ガイド

**メリット**:
- fileMatchPatternがシンプル化（保守性向上）
- 関連情報が1箇所に集約（可読性向上）
- 新規ファイル追加時のREADME.md更新が不要

## メンテナンス

新規steeringファイル追加時:
1. 適切なフォルダに配置
2. front-matter設定
3. README.md更新（必要に応じて）
4. 関連ファイルの「関連ドキュメント」更新




---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/**/*.ts|**/api/**/*.ts|**/scraper/**/*.ts|**/collector/**/*.ts|**/*.test.ts|**/*.spec.ts'
---

# MCP Server 活用ガイドライン（AWS実装）

MCPサーバーを活用してAWS実装を効率化する。

## 利用可能なMCPサーバー

| MCPサーバー | 主要ツール | 使用場面 |
|-----------|----------|---------|
| **AWS Knowledge** | search_documentation, read_documentation, get_regional_availability | AWSサービス実装、CDK設計、仕様確認 |
| **AWS Labs CDK** | CDKGeneralGuidance, ExplainCDKNagRule, GetAwsSolutionsConstructPattern | CDK実装、CDK Nagエラー解決 |
| **Brave Web Search** | brave_web_search, brave_news_search | エラー解決、最新情報、ベストプラクティス |
| **Context7** | resolve_library_id, query_docs | ライブラリドキュメント、コード例 |

## 活用原則

### MCPサーバー選択

| 情報の種類 | MCPサーバー |
|-----------|-----------|
| AWS公式情報 | AWS Knowledge |
| CDK実装 | AWS Labs CDK |
| エラー解決 | Brave Web Search |
| ライブラリAPI | Context7 |

## 検索クエリ

具体的で明確なクエリを使用（例: "DynamoDB GSI query performance optimization"）

## プロジェクト固有パターン

| パターン | 使用MCPサーバー |
|---------|---------------|
| TDnetスクレイピング | Brave Web Search |
| DynamoDB設計 | AWS Knowledge, AWS Labs CDK |
| CDK Nagエラー解決 | AWS Labs CDK, Brave Web Search |
| エラー解決 | Brave Web Search, AWS Knowledge |

## 注意事項

- AWS公式ドキュメント優先、複数情報源で検証
- センシティブ情報除外（APIキー、PII、機密情報）
- トークン消費最適化（適切な件数設定）

## 関連

`workflow-guidelines.md`, `error-handling-implementation.md`

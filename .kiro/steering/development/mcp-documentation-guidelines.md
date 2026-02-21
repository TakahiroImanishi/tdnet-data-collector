---
inclusion: fileMatch
fileMatchPattern: '**/docs/**/*.md|**/.kiro/specs/**/*.md'
---

# MCP Server 活用ガイドライン（ドキュメント作成）

MCPサーバーを活用してドキュメント作成を効率化する。

## 利用可能なMCPサーバー

| MCPサーバー | 主要ツール | 使用場面 |
|-----------|----------|---------|
| **AWS Knowledge** | search_documentation, read_documentation | AWS公式情報の引用、技術仕様の確認 |
| **Brave Web Search** | brave_web_search, brave_news_search | 最新情報、ベストプラクティス、事例調査 |
| **Context7** | resolve_library_id, query_docs | ライブラリドキュメント、API仕様 |
| **Fetch** | fetch | 特定URLのコンテンツ取得 |

## ドキュメント作成パターン

| パターン | MCPサーバー | 使用ツール |
|---------|-----------|----------|
| アーキテクチャ | AWS Knowledge | search_documentation |
| API仕様書 | Brave Web Search | brave_web_search |
| 運用ドキュメント | AWS Knowledge | search_documentation |
| 技術調査 | Brave News Search | brave_news_search |

## ドキュメント品質

- 情報源を明記（AWS公式、ブログ等）
- 最新性確認（freshness: "py"で過去1年以内）
- 複数情報源で検証
- センシティブ情報除外（APIキー、PII、機密情報）
- 著作権・ライセンス確認

## 関連

`documentation-standards.md`, `workflow-guidelines.md`

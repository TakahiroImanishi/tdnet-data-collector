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

### 検索クエリのベストプラクティス

```typescript
// ✅ 具体的で明確
"DynamoDB GSI query performance optimization"
"Lambda Node.js 20 cold start reduction"
"CDK Nag AwsSolutions-IAM4 remediation"

// ❌ 曖昧で広すぎる
"database", "lambda", "error"
```

## プロジェクト固有パターン

### TDnetスクレイピング実装

```typescript
// 1. HTTPクライアントのベストプラクティス
brave_web_search({ query: "Node.js axios rate limiting retry best practices" })

// 2. Lambdaスクレイピング
search_documentation({ search_phrase: "Lambda web scraping best practices", topics: ["general"] })
```

### DynamoDB設計

```typescript
// 1. 設計ベストプラクティス
search_documentation({ search_phrase: "DynamoDB design patterns GSI", topics: ["reference_documentation"] })

// 2. CDK実装
GetAwsSolutionsConstructPattern({ services: ["dynamodb"] })
```

### CDK Nagエラー解決

```typescript
// 1. ルール解説
ExplainCDKNagRule({ rule_id: "AwsSolutions-IAM4" })

// 2. 修正方法
brave_web_search({ query: "CDK Nag AwsSolutions-IAM4 remediation example" })
```

### エラー解決

```typescript
// 1. エラーメッセージ検索
brave_web_search({ query: "TypeScript error TS2345 Argument of type..." })

// 2. AWS SDKエラー
search_documentation({ search_phrase: "DynamoDB ConditionalCheckFailedException", topics: ["troubleshooting"] })
```

## 注意事項

### 情報の信頼性

- ✅ AWS公式ドキュメント優先
- ✅ 複数の情報源で検証
- ⚠️ Web検索結果は公開日確認

### センシティブ情報の除外

- ❌ APIキー、パスワード、認証情報
- ❌ 個人情報（PII）
- ❌ 企業の機密情報

### トークン消費の最適化

```typescript
// ✅ 適切な件数設定
brave_web_search({ query: "Lambda best practices", count: 5 })

// ❌ 過剰な件数設定
brave_web_search({ query: "Lambda best practices", count: 50 })
```

## 関連ドキュメント

- `workflow-guidelines.md` - サブエージェント活用
- `error-handling-implementation.md` - エラー解決パターン

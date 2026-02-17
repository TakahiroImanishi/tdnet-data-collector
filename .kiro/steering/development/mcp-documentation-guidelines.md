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

### アーキテクチャドキュメント

```typescript
// 1. AWS公式のベストプラクティス
search_documentation({ 
    search_phrase: "serverless architecture best practices", 
    topics: ["general"] 
})

// 2. 類似事例の調査
brave_web_search({ 
    query: "serverless data collection architecture AWS" 
})
```

### API仕様書

```typescript
// 1. RESTful API設計ガイドライン
brave_web_search({ 
    query: "RESTful API design best practices 2024" 
})

// 2. OpenAPI仕様の例
brave_web_search({ 
    query: "OpenAPI 3.0 specification examples" 
})
```

### 運用ドキュメント

```typescript
// 1. デプロイ手順
search_documentation({ 
    search_phrase: "CDK deployment best practices", 
    topics: ["cdk_docs"] 
})

// 2. トラブルシューティング
search_documentation({ 
    search_phrase: "Lambda troubleshooting common issues", 
    topics: ["troubleshooting"] 
})
```

### 技術調査レポート

```typescript
// 1. 最新技術動向
brave_news_search({ 
    query: "AWS Lambda Node.js 20 new features" 
})

// 2. ライブラリ比較
resolve_library_id({ 
    libraryName: "axios", 
    query: "HTTP client comparison" 
})
```

## ドキュメント品質ガイドライン

### 情報源の明記

```markdown
✅ 良い例:
AWS公式ドキュメントによると、Lambda関数のコールドスタート時間は...[^1]

[^1]: [AWS Lambda Cold Start](https://docs.aws.amazon.com/lambda/...)

❌ 悪い例:
Lambda関数のコールドスタート時間は...（出典なし）
```

### 最新性の確認

```typescript
// ✅ 公開日を確認
brave_web_search({ 
    query: "AWS Lambda best practices",
    freshness: "py"  // 過去1年以内
})

// ❌ 古い情報を使用
brave_web_search({ 
    query: "AWS Lambda best practices"
    // freshnessパラメータなし
})
```

### 複数情報源の検証

```typescript
// 1. AWS公式
search_documentation({ search_phrase: "DynamoDB GSI design" })

// 2. コミュニティベストプラクティス
brave_web_search({ query: "DynamoDB GSI design patterns" })

// 3. 実装例
query_docs({ 
    libraryId: "/aws/aws-sdk-js-v3", 
    query: "DynamoDB GSI query example" 
})
```

## 注意事項

### センシティブ情報の除外

- ❌ APIキー、パスワード、認証情報
- ❌ 個人情報（PII）
- ❌ 企業の機密情報
- ❌ 内部システムの詳細

### 著作権・ライセンス

- ✅ AWS公式ドキュメント: 引用可（出典明記）
- ✅ オープンソースライブラリ: ライセンス確認
- ⚠️ ブログ記事: 要約・パラフレーズ推奨

### トークン消費の最適化

```typescript
// ✅ 必要な情報のみ取得
brave_web_search({ query: "specific topic", count: 3 })

// ❌ 過剰な情報取得
brave_web_search({ query: "broad topic", count: 20 })
```

## 関連ドキュメント

- `documentation-standards.md` - ドキュメント作成標準
- `workflow-guidelines.md` - ワークフロー

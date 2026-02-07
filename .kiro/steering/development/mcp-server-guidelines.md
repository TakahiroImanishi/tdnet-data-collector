# MCP Server 活用ガイドライン

このファイルは、TDnet Data Collectorプロジェクトにおける Model Context Protocol (MCP) サーバーの活用方法をまとめたものです。

## MCP Server とは

MCP (Model Context Protocol) は、AIエージェントが外部ツールやサービスと連携するための標準プロトコルです。MCPサーバーを活用することで、以下が可能になります：

- **最新情報の取得**: AWS公式ドキュメント、ライブラリドキュメントの検索
- **Web検索**: 技術情報、エラー解決策、ベストプラクティスの検索
- **コード例の取得**: 最新のライブラリ使用例、実装パターンの参照
- **AWS情報**: リージョン情報、サービス可用性、CDKガイダンスの取得

---

## 利用可能な MCP Server

### 1. AWS Knowledge MCP Server

**用途**: AWS公式ドキュメント、CDK、CloudFormationの情報取得

**主要ツール**:
- `search_documentation`: AWSドキュメント検索
- `read_documentation`: AWS公式ページの内容取得
- `get_regional_availability`: AWSサービスのリージョン可用性確認
- `list_regions`: AWSリージョン一覧取得
- `recommend`: 関連ドキュメントの推薦

**使用場面**:
- Lambda、DynamoDB、S3などのAWSサービス実装時
- CDKスタック設計時
- AWSサービスの制限や仕様確認時
- リージョン選択時

**例**:
```typescript
// Lambda関数のベストプラクティスを検索
search_documentation({
    search_phrase: "Lambda best practices Node.js",
    topics: ["reference_documentation", "general"]
})

// DynamoDBのGSI設計を検索
search_documentation({
    search_phrase: "DynamoDB Global Secondary Index design patterns",
    topics: ["reference_documentation"]
})

// 特定リージョンでのサービス可用性確認
get_regional_availability({
    region: "ap-northeast-1",
    resource_type: "product",
    filters: ["AWS Lambda", "Amazon DynamoDB"]
})
```

---

### 2. AWS Labs CDK MCP Server

**用途**: CDK実装ガイダンス、CDK Nag、Solutions Constructs

**主要ツール**:
- `CDKGeneralGuidance`: CDK実装の一般的なガイダンス
- `ExplainCDKNagRule`: CDK Nagルールの説明と修正方法
- `GetAwsSolutionsConstructPattern`: AWS Solutions Constructsパターン検索
- `SearchGenAICDKConstructs`: GenAI CDKコンストラクトの検索

**使用場面**:
- CDKスタック実装時
- CDK Nagエラーの解決時
- ベストプラクティスパターンの適用時
- GenAI機能（Bedrock等）の実装時

**例**:
```typescript
// CDK Nagエラーの解決方法を取得
ExplainCDKNagRule({
    rule_id: "AwsSolutions-IAM4"
})

// Lambda + DynamoDBパターンを検索
GetAwsSolutionsConstructPattern({
    services: ["lambda", "dynamodb"]
})

// CDK実装の一般的なガイダンスを取得
CDKGeneralGuidance()
```

---

### 3. AWS Labs Frontend MCP Server

**用途**: React、フロントエンドアプリケーションの実装ガイダンス

**主要ツール**:
- `GetReactDocsByTopic`: React実装のドキュメント取得

**使用場面**:
- 管理画面やダッシュボードの実装時
- フロントエンドのトラブルシューティング時

**例**:
```typescript
// React実装の基本知識を取得
GetReactDocsByTopic({
    topic: "essential-knowledge"
})

// トラブルシューティング情報を取得
GetReactDocsByTopic({
    topic: "troubleshooting"
})
```

---

### 4. Web Search MCP Server (Brave)

**用途**: 最新の技術情報、エラー解決策、ライブラリドキュメントの検索

**主要ツール**:
- `brave_web_search`: 一般的なWeb検索
- `brave_local_search`: ローカル検索（場所ベース）
- `brave_news_search`: ニュース検索
- `brave_video_search`: 動画検索
- `brave_image_search`: 画像検索

**使用場面**:
- エラーメッセージの解決策検索
- 最新のライブラリバージョン確認
- 実装パターンの検索
- ベストプラクティスの調査

**例**:
```typescript
// TypeScriptのエラー解決策を検索
brave_web_search({
    query: "TypeScript error TS2345 Argument of type is not assignable",
    count: 10
})

// Node.js 20の新機能を検索
brave_web_search({
    query: "Node.js 20 new features",
    freshness: "pm" // 過去1ヶ月
})

// DynamoDBのパフォーマンス最適化を検索
brave_web_search({
    query: "DynamoDB query performance optimization best practices"
})
```

---

### 5. Context7 MCP Server

**用途**: ライブラリドキュメント、コード例の検索

**主要ツール**:
- `resolve_library_id`: ライブラリIDの解決
- `query_docs`: ライブラリドキュメントの検索

**使用場面**:
- 特定ライブラリの使用方法確認
- コード例の取得
- ライブラリAPIリファレンスの参照

**例**:
```typescript
// AWS SDK for JavaScriptのドキュメント検索
// ステップ1: ライブラリIDを解決
resolve_library_id({
    libraryName: "aws-sdk-js-v3",
    query: "DynamoDB client usage"
})

// ステップ2: ドキュメントを検索
query_docs({
    libraryId: "/aws/aws-sdk-js-v3",
    query: "How to use DynamoDB DocumentClient with TypeScript"
})
```

---

### 6. Fetch MCP Server

**用途**: 特定URLのコンテンツ取得

**主要ツール**:
- `fetch`: URLからコンテンツを取得

**使用場面**:
- 公式ドキュメントの詳細確認
- GitHubのREADMEやコード例の取得
- 技術記事の内容確認

**例**:
```typescript
// AWS公式ブログ記事を取得
fetch({
    url: "https://aws.amazon.com/blogs/compute/optimizing-lambda-functions-for-nodejs/",
    mode: "full"
})

// GitHubのREADMEを取得
fetch({
    url: "https://github.com/aws/aws-cdk/blob/main/README.md",
    mode: "truncated"
})
```

---

## MCP Server 活用の基本原則

### 1. 最新情報が必要な場合は積極的に活用

**MCPサーバーを使うべき場面**:
- ✅ AWSサービスの最新仕様や制限を確認する
- ✅ ライブラリの最新バージョンや使用方法を調べる
- ✅ エラーメッセージの解決策を検索する
- ✅ ベストプラクティスや実装パターンを調査する
- ✅ CDK Nagエラーの修正方法を確認する

**MCPサーバーを使わなくてよい場面**:
- ❌ 基本的なプログラミング概念（変数、関数、クラスなど）
- ❌ 確立された技術（HTTP、REST API、JSONなど）
- ❌ プロジェクト内のコードやドキュメント（readFileなどを使用）

---

### 2. 適切なMCPサーバーを選択

| 情報の種類 | 使用するMCPサーバー | 理由 |
|-----------|-------------------|------|
| AWS公式情報 | AWS Knowledge | 最も正確で最新のAWS情報 |
| CDK実装 | AWS Labs CDK | CDK特化の詳細ガイダンス |
| エラー解決 | Brave Web Search | 幅広い情報源から解決策を検索 |
| ライブラリAPI | Context7 | ライブラリ特化のドキュメント |
| 特定URL | Fetch | 直接コンテンツを取得 |

---

### 3. 検索クエリの最適化

**良い検索クエリの例**:
```typescript
// ✅ 具体的で明確
"DynamoDB GSI query performance optimization"
"Lambda Node.js 20 cold start reduction"
"CDK Nag AwsSolutions-IAM4 remediation"

// ❌ 曖昧で広すぎる
"database"
"lambda"
"error"
```

**検索クエリのベストプラクティス**:
- サービス名を含める（例: "DynamoDB", "Lambda"）
- 具体的な問題や目的を記述（例: "performance optimization", "error handling"）
- バージョン情報を含める（例: "Node.js 20", "CDK v2"）
- エラーメッセージは正確に引用（例: "TS2345 Argument of type"）

---

### 4. 複数のMCPサーバーを組み合わせる

**例: Lambda関数のパフォーマンス最適化**

```typescript
// ステップ1: AWS公式ドキュメントを検索
search_documentation({
    search_phrase: "Lambda performance optimization Node.js",
    topics: ["reference_documentation", "general"]
})

// ステップ2: 最新のベストプラクティスをWeb検索
brave_web_search({
    query: "AWS Lambda Node.js 20 performance best practices 2024",
    freshness: "pm"
})

// ステップ3: CDKでの実装ガイダンスを取得
CDKGeneralGuidance()

// ステップ4: 具体的なコード例を取得
query_docs({
    libraryId: "/aws/aws-sdk-js-v3",
    query: "Lambda function optimization examples"
})
```

---

## プロジェクト固有の活用パターン

### パターン1: TDnetスクレイピング実装

**目的**: レート制限、エラーハンドリング、リトライロジックの実装

```typescript
// 1. Node.jsのHTTPクライアントのベストプラクティスを検索
brave_web_search({
    query: "Node.js axios rate limiting retry best practices"
})

// 2. AWS Lambdaでのスクレイピングのベストプラクティスを検索
search_documentation({
    search_phrase: "Lambda web scraping best practices",
    topics: ["general"]
})

// 3. エラーハンドリングパターンを検索
brave_web_search({
    query: "Node.js error handling retry exponential backoff"
})
```

---

### パターン2: DynamoDB設計

**目的**: GSI設計、パーティションキー設計、クエリ最適化

```typescript
// 1. DynamoDB設計のベストプラクティスを検索
search_documentation({
    search_phrase: "DynamoDB design patterns GSI partition key",
    topics: ["reference_documentation"]
})

// 2. date_partitionを使用したクエリパターンを検索
brave_web_search({
    query: "DynamoDB date partition query optimization"
})

// 3. CDKでのDynamoDB実装を検索
GetAwsSolutionsConstructPattern({
    services: ["dynamodb"]
})
```

---

### パターン3: CDK Nagエラー解決

**目的**: セキュリティベストプラクティスの適用

```typescript
// 1. 特定のCDK Nagルールを解説
ExplainCDKNagRule({
    rule_id: "AwsSolutions-IAM4"
})

// 2. 修正方法の詳細をWeb検索
brave_web_search({
    query: "CDK Nag AwsSolutions-IAM4 remediation example"
})

// 3. AWS公式のIAMベストプラクティスを確認
search_documentation({
    search_phrase: "IAM best practices least privilege",
    topics: ["reference_documentation"]
})
```

---

### パターン4: エラー解決

**目的**: 実装中のエラーを迅速に解決

```typescript
// 1. エラーメッセージで検索
brave_web_search({
    query: "TypeScript error TS2345 Argument of type 'string' is not assignable to parameter of type 'number'"
})

// 2. AWS SDKのエラーを検索
search_documentation({
    search_phrase: "DynamoDB ConditionalCheckFailedException handling",
    topics: ["troubleshooting"]
})

// 3. ライブラリのドキュメントを確認
query_docs({
    libraryId: "/aws/aws-sdk-js-v3",
    query: "How to handle DynamoDB errors"
})
```

---

### パターン5: パフォーマンス最適化

**目的**: コスト削減とパフォーマンス向上

```typescript
// 1. Lambda最適化のベストプラクティスを検索
search_documentation({
    search_phrase: "Lambda performance optimization cold start",
    topics: ["reference_documentation", "general"]
})

// 2. DynamoDBのコスト最適化を検索
brave_web_search({
    query: "DynamoDB cost optimization on-demand vs provisioned"
})

// 3. CDKでのパフォーマンス設定を確認
CDKGeneralGuidance()
```

---

## MCP Server 使用時の注意点

### 1. 情報の信頼性を確認

- ✅ AWS公式ドキュメント（AWS Knowledge MCP Server）を優先
- ✅ 複数の情報源を参照して検証
- ⚠️ Web検索結果は公開日を確認（古い情報の可能性）
- ⚠️ コード例はそのまま使用せず、プロジェクトに合わせて調整

---

### 2. センシティブ情報の除外

**MCPサーバーに送信してはいけない情報**:
- ❌ APIキー、パスワード、認証情報
- ❌ 個人情報（PII）
- ❌ 企業の機密情報
- ❌ 内部システムの詳細

**良い例**:
```typescript
// ✅ 一般的な質問
brave_web_search({
    query: "DynamoDB query optimization best practices"
})

// ❌ センシティブ情報を含む
brave_web_search({
    query: "How to fix error in my-company-secret-api with key abc123xyz"
})
```

---

### 3. トークン消費の最適化

**効率的な使用方法**:
- 検索結果の件数を適切に設定（`count`パラメータ）
- 必要な情報が見つかったら追加検索を避ける
- 同じ情報を繰り返し検索しない

**例**:
```typescript
// ✅ 適切な件数設定
brave_web_search({
    query: "Lambda Node.js best practices",
    count: 5  // 5件で十分
})

// ❌ 過剰な件数設定
brave_web_search({
    query: "Lambda Node.js best practices",
    count: 50  // 不要に多い
})
```

---

### 4. エラーハンドリング

MCPサーバーの呼び出しが失敗した場合の対応：

1. **リトライ**: 一時的なネットワークエラーの可能性
2. **代替手段**: 別のMCPサーバーや検索クエリを試す
3. **既存知識**: MCPサーバーが利用できない場合は既存知識で対応

---

## 実装チェックリスト

### タスク開始時

- [ ] 最新のAWS情報が必要か確認
- [ ] 使用するライブラリのバージョンを確認
- [ ] 類似の実装例を検索

### 実装中

- [ ] エラーが発生したら即座に検索
- [ ] ベストプラクティスを確認
- [ ] CDK Nagエラーを解決

### 実装完了後

- [ ] パフォーマンス最適化の余地を確認
- [ ] セキュリティベストプラクティスを確認
- [ ] 最新のドキュメントと照合

---

## トラブルシューティング

### MCPサーバーが応答しない

**原因**:
- ネットワーク接続の問題
- MCPサーバーの一時的な障害
- レート制限

**対処法**:
1. ネットワーク接続を確認
2. 数分待ってから再試行
3. 別のMCPサーバーを使用
4. 既存知識で対応

---

### 検索結果が期待と異なる

**原因**:
- 検索クエリが曖昧
- 検索対象が適切でない

**対処法**:
1. 検索クエリをより具体的にする
2. サービス名やバージョンを追加
3. 別のMCPサーバーを試す
4. 検索結果を絞り込む（`topics`, `freshness`パラメータ）

---

### 情報が古い

**原因**:
- Web検索結果が古い記事
- キャッシュされた情報

**対処法**:
1. `freshness`パラメータで期間を指定（例: `"pm"` = 過去1ヶ月）
2. AWS公式ドキュメントを優先
3. 公開日を確認

---

## 関連ドキュメント

- **ワークフローガイドライン**: `workflow-guidelines.md` - サブエージェント活用と並列実行
- **エラーハンドリング**: `error-handling-implementation.md` - エラー解決パターン
- **ドキュメント標準**: `documentation-standards.md` - ドキュメント作成時の参照方法
- **テスト戦略**: `testing-strategy.md` - テスト実装時の情報収集

---

## 変更履歴

- 2026-02-07: 初版作成 - MCP Server活用ガイドラインを追加

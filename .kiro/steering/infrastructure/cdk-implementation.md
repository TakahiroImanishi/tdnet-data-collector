---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*.ts'
---

# CDK実装ガイド

CDKコード実装時の必須チェックリスト。

## 実装チェックリスト

### Stack実装時（`**/cdk/lib/**/*-stack.ts`）
- [ ] セキュリティベストプラクティス適用（`security-best-practices.md`参照）
- [ ] 命名規則遵守（`tdnet-file-naming.md`参照）
- [ ] デプロイチェックリスト確認（`deployment-checklist.md`参照）

### Construct実装時（`**/cdk/lib/constructs/**/*.ts`）
- [ ] Lambda Construct: エラーハンドリング強制（`error-handling-enforcement.md`参照）
- [ ] Lambda Construct: パフォーマンス最適化（`performance-optimization.md`参照）
- [ ] 命名規則遵守（`tdnet-file-naming.md`参照）

### 共通
- [ ] MCPサーバー活用（`mcp-server-guidelines.md`参照）
- [ ] CDK Nag適用（`AwsSolutionsChecks.check(app)`）

## 基本原則

### 1. セキュリティ
- IAM: 最小権限、ワイルドカード禁止
- 暗号化: TLS 1.2以上、SSE-S3/AWS管理キー
- 監査: CloudTrail有効化

### 2. コスト最適化
- Lambda: メモリ128-512MB、タイムアウト最小化
- DynamoDB: オンデマンド課金、GSI最小限
- S3: ライフサイクルポリシー設定

### 3. エラーハンドリング
- Lambda: DLQ設定（非同期のみ）
- CloudWatch Alarms: エラー率、DLQメッセージ数
- 構造化ログ: error_type, error_message, context

### 4. 命名規則
- Stack: `{ProjectName}{Purpose}Stack`（例: `TdnetDataCollectorFoundationStack`）
- Construct: `{Service}{Purpose}Construct`（例: `LambdaCollectorConstruct`）
- リソース: ケバブケース（例: `tdnet-data-collector-table`）

## 関連ドキュメント

- `security-best-practices.md` - セキュリティ詳細
- `error-handling-enforcement.md` - Lambda Constructエラーハンドリング
- `performance-optimization.md` - Lambda Constructパフォーマンス
- `tdnet-file-naming.md` - 命名規則詳細
- `deployment-checklist.md` - デプロイ手順
- `mcp-server-guidelines.md` - MCPサーバー活用

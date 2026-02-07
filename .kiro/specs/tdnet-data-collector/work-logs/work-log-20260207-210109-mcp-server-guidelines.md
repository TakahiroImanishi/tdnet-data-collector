# 作業記録: MCP Server活用ガイドライン作成

**作成日時**: 2026-02-07 21:01:09  
**作業者**: Kiro AI Assistant  
**関連Issue**: ユーザーリクエスト - steeringルールにMCPサーバーの活用を追加

---

## タスク概要

### 目的
TDnet Data Collectorプロジェクトのsteeringファイルに、MCP (Model Context Protocol) サーバーの活用ガイドラインを追加する。

### 背景
- プロジェクトでは複数のMCPサーバー（AWS Knowledge、AWS Labs CDK、Brave Web Search、Context7、Fetch）が利用可能
- 開発者がMCPサーバーを効果的に活用できるよう、具体的なガイドラインが必要
- 最新情報の取得、エラー解決、ベストプラクティスの調査などでMCPサーバーを活用することで、開発効率が向上

### 目標
- [ ] MCP Server活用ガイドラインを作成
- [ ] 各MCPサーバーの用途と使用例を明記
- [ ] プロジェクト固有の活用パターンを定義
- [ ] README.mdを更新してファイル一覧に追加
- [ ] Git commitとpush

---

## 実施内容

### 1. MCP Server活用ガイドラインの作成

**ファイル**: `.kiro/steering/development/mcp-server-guidelines.md`

**内容**:
- MCPサーバーの概要と利点
- 利用可能な6つのMCPサーバーの詳細説明
  - AWS Knowledge MCP Server
  - AWS Labs CDK MCP Server
  - AWS Labs Frontend MCP Server
  - Web Search MCP Server (Brave)
  - Context7 MCP Server
  - Fetch MCP Server
- MCP Server活用の基本原則
- プロジェクト固有の活用パターン（5パターン）
  - TDnetスクレイピング実装
  - DynamoDB設計
  - CDK Nagエラー解決
  - エラー解決
  - パフォーマンス最適化
- 使用時の注意点（信頼性、センシティブ情報、トークン消費、エラーハンドリング）
- 実装チェックリスト
- トラブルシューティング

**特徴**:
- 各MCPサーバーの具体的な使用例をTypeScriptコードで記載
- プロジェクト固有のユースケースに特化したパターンを提供
- セキュリティとトークン消費の最適化を考慮

### 2. README.mdの更新

**変更内容**:
- `development/`フォルダのファイル一覧に`mcp-server-guidelines.md`を追加
- レベル0（基盤ファイル）のリストに`development/mcp-server-guidelines.md`を追加

**理由**:
- 新しいsteeringファイルをドキュメント構造に統合
- 他のファイルから参照される可能性があるため、レベル0に分類

---

## 成果物

### 作成したファイル

1. **`.kiro/steering/development/mcp-server-guidelines.md`**
   - MCP Server活用ガイドライン（約500行）
   - 6つのMCPサーバーの詳細説明
   - 5つのプロジェクト固有活用パターン
   - 実装チェックリストとトラブルシューティング

### 更新したファイル

1. **`.kiro/steering/README.md`**
   - `development/`セクションに新ファイルを追加
   - レベル0（基盤ファイル）リストに追加

---

## 問題と解決策

### 問題1: fileMatchPatternの設定

**問題**: mcp-server-guidelines.mdは常時読み込みか、条件付き読み込みか？

**解決策**: 
- 常時読み込み（front-matter不要）として設定
- 理由: MCPサーバーはすべてのタスクで活用可能であり、特定のファイルパターンに限定されない

### 問題2: 参照関係の整理

**問題**: 他のsteeringファイルとの参照関係をどう設定するか？

**解決策**:
- レベル0（基盤ファイル）として分類
- 他のファイルから参照される可能性があるが、自身は他のファイルを参照しない
- 関連ドキュメントとして以下を記載:
  - `workflow-guidelines.md`
  - `error-handling-implementation.md`
  - `documentation-standards.md`
  - `testing-strategy.md`

---

## 次回への申し送り

### 完了した作業
- ✅ MCP Server活用ガイドラインの作成
- ✅ README.mdの更新

### 未完了の作業
- [ ] Git commitとpush（次のステップで実施）
- [ ] 他のsteeringファイルからの参照追加（必要に応じて）
- [ ] pattern-matching-tests.mdの更新（fileMatchPatternを設定する場合）

### 注意点
- mcp-server-guidelines.mdは常時読み込みとして設定したため、fileMatchPatternは不要
- 今後、特定のファイルパターンでのみ読み込みたい場合は、front-matterを追加してfileMatchPatternを設定

### 推奨される次のアクション
1. Git commitとpush
2. 他のsteeringファイル（特にerror-handling-implementation.md、workflow-guidelines.md）にMCPサーバー活用の参照を追加
3. 実際の開発タスクでMCPサーバーを活用し、ガイドラインの有効性を検証

---

## 学んだこと

### ベストプラクティス
- MCPサーバーは最新情報の取得に非常に有効
- プロジェクト固有のユースケースに特化したパターンを提供することで、開発者の活用を促進
- セキュリティ（センシティブ情報の除外）とトークン消費の最適化を明示的に記載することが重要

### 改善点
- 今後、実際の使用例を蓄積し、ガイドラインを継続的に改善
- MCPサーバーの応答時間やエラー率を監視し、トラブルシューティングセクションを充実

---

## 関連ドキュメント

- **steeringファイル構造**: `.kiro/steering/README.md`
- **ワークフローガイドライン**: `.kiro/steering/development/workflow-guidelines.md`
- **エラーハンドリング**: `.kiro/steering/development/error-handling-implementation.md`
- **ドキュメント標準**: `.kiro/steering/development/documentation-standards.md`

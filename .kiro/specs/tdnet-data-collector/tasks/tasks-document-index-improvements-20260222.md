# タスク: ドキュメントインデックス改善

**作成日**: 2026-02-22  
**優先度**: 中  
**カテゴリ**: ドキュメント整備  
**関連作業記録**: [work-log-20260222-165947-document-index-verification.md](../work-logs/work-log-20260222-165947-document-index-verification.md)

> **タスク管理ガイドライン**: このファイルの使い方については [workflow-guidelines.md](../../../steering/development/workflow-guidelines.md) を参照してください。

## 概要

ドキュメントと実装ファイル間の相互参照を改善し、開発者がガイドラインに容易にアクセスできるようにする。

## 背景

4つのサブエージェントによる並列検証の結果、以下の問題が発見された：
- Steeringファイル: 35.5%で「関連」セクションが欠落
- Specs Docs: 16.7%で「関連ドキュメント」セクションが欠落
- 実装ファイル: 94.1%でドキュメントリンクが欠落

## タスク一覧

### 優先度: 高（即座に実施）

#### タスク1: tasks.mdへの相互参照追加
- [ ] tasks.mdの冒頭に workflow-guidelines.md への参照を追加
- 見積もり: 5分
- 理由: タスク管理の中核ドキュメント

#### タスク2: プロジェクトルートREADME.mdの改善
- [ ] 「実装ガイドライン」セクションを追加
- [ ] 主要Steeringファイルへのリンクを記載
  - tdnet-implementation-rules.md
  - error-handling-patterns.md
  - testing-strategy.md
  - cdk-implementation.md
  - security-best-practices.md
- 見積もり: 15分
- 理由: 新規開発者が最初に読むドキュメント

#### タスク3: src/utils/README.md の作成
- [ ] README.mdを作成
- [ ] 以下へのリンクを含める：
  - lambda-utils-implementation.md
  - error-handling-implementation.md
  - testing-strategy.md
- [ ] ユーティリティ関数の概要を記載
- 見積もり: 20分
- 理由: ユーティリティ関数の実装ガイドラインが不明確

#### タスク4: Steeringファイルの関連セクション追加（6ファイル）
- [ ] error-handling-patterns.md に「関連」セクションを追加
  - リンク: tdnet-implementation-rules.md, error-handling-implementation.md, error-handling-enforcement.md
- [ ] tdnet-data-collector.md に「関連」セクションを追加
  - リンク: tdnet-implementation-rules.md, file-encoding-rules.md, workflow-guidelines.md
- [ ] error-handling-implementation.md に「関連ドキュメント」セクションを追加
  - リンク: error-handling-patterns.md, lambda-implementation.md, testing-strategy.md
- [ ] deployment-scripts.md に「関連」セクションを追加
  - リンク: deployment-checklist.md, powershell-encoding-guidelines.md, security-best-practices.md
- [ ] performance-optimization.md に「関連」セクションを追加
  - リンク: lambda-implementation.md, cdk-implementation.md, monitoring-alerts.md
- [ ] security-best-practices.md に「関連」セクションを追加
  - リンク: cdk-implementation.md, deployment-checklist.md, environment-variables.md
- 見積もり: 30分
- 理由: Steeringファイル間のナビゲーション改善

#### タスク5: Specs Docsの関連ドキュメントセクション追加（3ファイル）
- [x] 03-testing/e2e-test-guide.md に「関連ドキュメント」セクションを追加
  - リンク: localstack-setup.md, testing-strategy.md, smoke-test-guide.md, load-testing-guide.md
- [x] 03-testing/localstack-setup.md に「関連ドキュメント」セクションを追加
  - リンク: e2e-test-guide.md, testing-strategy.md, setup-scripts.md
- [x] docs/milestones.md に「関連ドキュメント」セクションを追加
  - リンク: requirements.md, design.md, implementation-checklist.md, testing-strategy.md
- 見積もり: 20分
- 理由: Specs Docs間のナビゲーション改善
- **完了日時**: 2026-02-22 17:06
- **作業記録**: [work-log-20260222-170551-subagent3-high-priority-task5.md](../work-logs/work-log-20260222-170551-subagent3-high-priority-task5.md)

### 優先度: 中（近日中に実施）

#### タスク6: cdk/lib/constructs/README.md の作成
- [ ] README.mdを作成
- [ ] 以下へのリンクを含める：
  - error-handling-enforcement.md
  - cdk-implementation.md
  - security-best-practices.md
- [ ] CDK Construct実装ガイドラインの概要を記載
- 見積もり: 20分
- 理由: CDK Construct実装時のガイドラインが不明確

#### タスク7: src/validators/README.md の作成
- [ ] README.mdを作成
- [ ] 以下へのリンクを含める：
  - data-validation.md
  - testing-strategy.md
- [ ] バリデーション実装ガイドラインの概要を記載
- 見積もり: 15分
- 理由: バリデーション実装時のガイドラインが不明確

#### タスク8: src/scraper/README.md の作成
- [ ] README.mdを作成
- [ ] 以下へのリンクを含める：
  - tdnet-scraping-patterns.md
  - error-handling-patterns.md
  - testing-strategy.md
- [ ] スクレイピング実装ガイドラインの概要を記載
- 見積もり: 15分
- 理由: スクレイピング実装時のガイドラインが不明確

#### タスク9: Lambda関数ヘッダーコメント統一（10ファイル）
- [ ] collector/handler.ts
- [ ] query/handler.ts
- [ ] export/handler.ts
- [ ] get-disclosure/handler.ts
- [ ] collect-status/handler.ts
- [ ] stats/handler.ts
- [ ] health/handler.ts
- [ ] collect/handler.ts
- [ ] api-key-rotation/index.ts
- [ ] api/export-status/handler.ts, api/pdf-download/handler.ts（未検証）
- 各ファイルに以下を追加：
  ```typescript
  /**
   * [ファイル名] - [説明]
   * 
   * [詳細説明]
   * 
   * Requirements: [要件番号]
   * 
   * 関連ドキュメント:
   * - .kiro/steering/core/tdnet-implementation-rules.md
   * - .kiro/steering/development/lambda-implementation.md
   * - .kiro/steering/core/error-handling-patterns.md
   * - .kiro/steering/api/api-design-guidelines.md（API関連のみ）
   */
  ```
- 見積もり: 1時間（10ファイル × 6分）
- 理由: 実装ガイドラインへのアクセスが不明確
- 参考: dlq-processor/index.ts（良好な例）

#### タスク10: CDKスタックヘッダーコメント統一（4ファイル）
- [ ] foundation-stack.ts
- [ ] compute-stack.ts
- [ ] api-stack.ts
- [ ] monitoring-stack.ts
- 各ファイルに以下を追加：
  ```typescript
  /**
   * [スタック名] - [説明]
   * 
   * [詳細説明]
   * 
   * 関連ドキュメント:
   * - .kiro/steering/infrastructure/cdk-implementation.md
   * - .kiro/steering/security/security-best-practices.md
   * - .kiro/steering/infrastructure/deployment-checklist.md
   */
  ```
- 見積もり: 20分（4ファイル × 5分）
- 理由: CDK実装ガイドラインへのアクセスが不明確

### 優先度: 低（時間があれば実施）

#### タスク11: テストファイルへのコメント追加
- [ ] 主要テストファイルの冒頭コメントに testing-strategy.md へのリンクを追加
- 見積もり: 30分
- 理由: テスト戦略の参照が不明確（fileMatchPatternで自動トリガーされるため緊急性は低い）

#### タスク12: mcp-server-guidelines.md の明示的参照追加
- [ ] 実装ドキュメントに「MCP活用方法」セクションを追加
- 見積もり: 15分
- 理由: fileMatchPatternで自動トリガーされるため緊急性は低い

#### タスク13: mcp-documentation-guidelines.md の明示的参照追加
- [ ] docs/README.mdに「ドキュメント作成ガイドライン」セクションを追加
- 見積もり: 10分
- 理由: fileMatchPatternで自動トリガーされるため緊急性は低い

#### タスク14: 03-operations/ フォルダの整理
- [ ] 03-operations/troubleshooting.md と 05-operations/troubleshooting.md の役割を確認
- [ ] 統合または役割を明確に分離
- 見積もり: 30分
- 理由: 同名ファイルが2箇所に存在

## 見積もり合計

- 優先度: 高 - 1時間30分
- 優先度: 中 - 2時間30分
- 優先度: 低 - 1時間25分
- 合計: 5時間25分

## 完了条件

- [ ] 優先度: 高のタスク5個をすべて完了
- [ ] 優先度: 中のタスク5個をすべて完了
- [ ] 優先度: 低のタスク4個を完了（任意）
- [ ] すべてのファイルがUTF-8 BOMなしで作成されている
- [ ] 作業記録を更新
- [ ] Git commit & push

## 関連ドキュメント

- [work-log-20260222-165947-document-index-verification.md](../work-logs/work-log-20260222-165947-document-index-verification.md) - メイン検証記録
- [work-log-20260222-170002-steering-index-verification.md](../work-logs/work-log-20260222-170002-steering-index-verification.md) - Steering検証
- [work-log-20260222-170006-subagent2-specs-docs-index-verification.md](../work-logs/work-log-20260222-170006-subagent2-specs-docs-index-verification.md) - Specs Docs検証
- [work-log-20260222-165947-subagent3-implementation-index-verification.md](../work-logs/work-log-20260222-165947-subagent3-implementation-index-verification.md) - 実装ファイル検証
- [work-log-20260222-170017-subagent4-cross-reference-matrix.md](../work-logs/work-log-20260222-170017-subagent4-cross-reference-matrix.md) - 相互参照マトリクス

## 申し送り事項

### テンプレート作成

以下のテンプレートを作成することを推奨：
- Lambda関数用ヘッダーコメントテンプレート
- CDKスタック用ヘッダーコメントテンプレート
- PowerShellスクリプト用ヘッダーコメントテンプレート
- README.mdテンプレート（各ディレクトリ用）

### 相互参照の維持

- 新規Steeringファイル追加時は、関連するSpecs Docsに参照を追加
- 新規Specs Docs追加時は、関連するSteeringファイルに参照を追加
- fileMatchPatternの更新時は、pattern-matching-tests.mdも更新
- 新規実装ファイル作成時は、必ず関連ドキュメントリンクを含める

### 定期的な検証

四半期ごとに同様の検証を実施し、ドキュメントインデックスの整合性を維持することを推奨。

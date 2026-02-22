# Step Functions設計ドキュメント

このフォルダには、AWS Step Functionsを使用したデータ収集ワークフローの設計ドキュメントが含まれています。

## 📁 ファイル一覧

| ファイル | 内容 |
|---------|------|
| step-functions-architecture.md | Step Functionsアーキテクチャ設計 |
| step-functions-workflow-diagram.md | ワークフロー図と状態遷移 |
| step-functions-state-machine.json | ステートマシン定義（JSON） |
| step-functions-error-handling.md | エラーハンドリング戦略 |
| step-functions-cost-analysis.md | コスト分析と最適化 |

## 概要

Step Functionsを使用して、TDnetからのデータ収集を以下の4つのステップに分割して実行します：

1. **Init**: 収集パラメータの初期化と検証
2. **Fetch**: TDnetからのデータ取得（並列実行）
3. **Aggregate**: 取得データの集約と検証
4. **Save**: DynamoDB/S3への保存

## アーキテクチャの利点

- **並列処理**: 複数日のデータを並列取得（最大5並列）
- **エラーハンドリング**: 各ステップでの再試行とエラー回復
- **可視性**: 実行状態の追跡とモニタリング
- **コスト最適化**: 無料枠内での運用（月1000回実行まで無料）

## 関連ドキュメント

- [実装チェックリスト](../02-implementation/implementation-checklist.md)
- [CDKインフラストラクチャ](../02-implementation/cdk-infrastructure.md)
- [エラーハンドリングパターン](../../../steering/core/error-handling-patterns.md)

---

**最終更新**: 2026-02-22

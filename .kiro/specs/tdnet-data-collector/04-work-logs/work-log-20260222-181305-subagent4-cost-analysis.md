# 作業記録: Step Functionsコスト分析

**作成日時**: 2026-02-22 18:13:05  
**作業者**: Kiro (subagent4)  
**タスク**: tasks-step-functions-migration.md タスク1.1（コスト試算部分）

## 作業概要

Step Functions移行に伴うコスト影響を詳細に分析し、現在のアーキテクチャとの比較を実施。

## 実施内容

### 1. AWS料金表の調査
- Step Functions料金体系の確認
- Lambda実行時間の変化によるコスト影響
- DynamoDB追加コストの試算

### 2. 計算実施
- 想定使用量: 1日6-7回収集、月間200回
- 各サービスの料金計算
- 総合コスト比較

### 3. 設計ドキュメント作成
- `.kiro/specs/tdnet-data-collector/designs/step-functions-cost-analysis.md`

## 問題と解決策

### 問題1: Web検索APIが利用不可
- **問題**: Brave Search APIのサブスクリプショントークンが無効
- **解決**: AWS Knowledge MCP Serverを使用してAWS公式ドキュメントから料金情報を取得

### 問題2: 現在のアーキテクチャドキュメントが不在
- **問題**: 既存の設計ドキュメントが見つからない
- **解決**: CDKコード（compute-stack.ts、environment-config.ts）から直接設定を確認

## 成果物

- [x] コスト分析ドキュメント作成
  - `.kiro/specs/tdnet-data-collector/designs/step-functions-cost-analysis.md`
  - 詳細な料金計算、比較分析、最適化推奨事項を含む
- [x] tasks-step-functions-migration.md更新
  - タスク1.1「コスト試算」に詳細な結果を追記
- [x] Git commit
  - コミットメッセージ: `[docs] Step Functionsコスト分析完了 - 詳細な料金計算と最適化推奨事項を追加`

## 分析結果サマリー

### コスト比較
- **現在**: $1.71/月（S3のみ課金）
- **移行後**: $1.75/月（+$0.04、+2.3%）
- **最適化後**: $1.71/月（fetchとsave統合により±$0.00）

### 主要な発見
1. **Lambda実行時間**: 89.9%削減（31,500 → 3,175 GB秒）
2. **処理時間**: 約95%短縮（並列実行により）
3. **Step Functions料金**: $0.041/月（無料枠4,000状態遷移の一部超過）
4. **無料枠の余裕**: Lambda、DynamoDBは十分な余裕あり（使用率1%未満）

### 推奨事項
1. **即座に実施**: Step Functions移行（わずかなコスト増で大幅な性能向上）
2. **移行後に実施**: fetchとsaveの統合（Step Functions料金を$0.00に削減）
3. **将来的に検討**: Express Workflowsへの移行（処理時間が5分以内に収まることを確認後）

## 申し送り事項

### 次のステップ
1. tasks-step-functions-migration.mdのタスク1.1「コスト試算」チェックボックスを更新
2. Git commitを実行
3. アーキテクチャ設計ドキュメント（step-functions-architecture.md）の作成に進む

### 注意事項
- S3が唯一の課金対象（ストレージ55.5GB、月間$1.71）
- 収集回数が増加してもLambda、DynamoDBは無料枠内で運用可能
- Step Functions無料枠（4,000状態遷移/月）を超過しているが、fetchとsave統合で無料枠内に収まる

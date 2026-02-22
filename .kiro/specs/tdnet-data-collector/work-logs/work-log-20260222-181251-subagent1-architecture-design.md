# 作業記録: Step Functionsアーキテクチャ設計

**作業日時**: 2026-02-22 18:12:51
**タスク**: タスク1.1 - Step Functionsアーキテクチャ設計
**担当**: Subagent1
**関連タスクファイル**: `.kiro/specs/tdnet-data-collector/tasks/tasks-step-functions-migration.md`

## 作業概要

既存のcollector Lambda関数を分析し、Step Functionsを使用したオーケストレーションアーキテクチャを設計しました。

## 実施内容

### 1. 既存システム分析

#### collector Lambda関数の構造
- **メインハンドラー**: `handler.ts` (約750行)
- **主要機能**:
  - イベントバリデーション
  - バッチモード/オンデマンドモード処理
  - 日付範囲生成
  - 並列処理制御（並列度5）
  - 実行状態管理
  - メトリクス送信

#### 依存モジュール
1. **scrapeTdnetList**: TDnet HTMLスクレイピング、ページネーション処理
2. **downloadPdf**: PDFダウンロード、S3アップロード
3. **saveMetadata**: DynamoDB保存、重複チェック
4. **updateExecutionStatus**: 実行状態管理（pending/running/completed/failed）

#### 現在の問題点
- 単一Lambda関数で全処理を実行（最大15分タイムアウト）
- 大量データ収集時（2,700件以上）に処理時間が長期化
- 進捗の可視性が低い（ログベース）
- エラー時の部分的リトライが困難
- 並列処理の制御が複雑

### 2. Step Functionsアーキテクチャ設計

設計ドキュメント `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md` を作成しました。

#### 主要設計決定
- **ワークフロータイプ**: Standard Workflows（長時間実行対応）
- **Lambda関数分割**: 4つの専用関数（init, fetch, save, aggregate）
- **並列処理**: Map状態による動的並列実行
- **状態管理**: 既存のDynamoDB実行状態テーブルを活用

#### コスト試算結果
- 月間200回の収集で無料枠内に収まることを確認
- Standard Workflows: 4,000状態遷移/月（無料枠）
- 1回の収集: 約10-20状態遷移

### 3. 成果物

以下のドキュメントを作成しました：
- `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`

## 問題と解決策

### 問題1: 既存の実行状態管理との統合
**解決策**: 既存のDynamoDB実行状態テーブル（`tdnet_executions`）を継続使用し、Step Functionsの実行ARNを追加フィールドとして保存。

### 問題2: API互換性の維持
**解決策**: `/collect` エンドポイントは引き続き`execution_id`を返却し、内部でStep Functions実行を開始。既存のクライアントコードは変更不要。

### 問題3: LocalStackでのE2Eテスト
**解決策**: LocalStackはStep Functionsをサポート。既存のE2Eテスト環境を拡張してStep Functionsテストを追加。

## 次のステップ

1. タスク1.2: ワークフロー詳細設計（ASL定義、エラーハンドリング）
2. タスク2.1-2.4: Lambda関数の分割実装
3. タスク3.1-3.3: CDK実装

## 申し送り事項

- 設計ドキュメントのレビューが必要
- コスト試算は概算値のため、本番環境での実測が必要
- 既存collector関数は段階的廃止（2週間の並行運用期間を設定）

## 関連ファイル

- `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`
- `.kiro/specs/tdnet-data-collector/tasks/tasks-step-functions-migration.md`
- `src/lambda/collector/handler.ts`

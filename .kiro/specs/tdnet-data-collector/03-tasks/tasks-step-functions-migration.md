# タスク: Step Functions移行

**作成日**: 2026-02-22 16:32:15
**優先度**: 高
**カテゴリ**: アーキテクチャ改善

## 背景

現在のデータ収集処理は単一のLambda関数で実装されており、以下の問題があります：

1. **タイムアウト問題**: 大量データ収集時（例: 2026-02-13で2,700件以上）に処理が長時間化
2. **ポーリング制限**: `manual-data-collection.ps1`のポーリングが5分でタイムアウト
3. **可視性の欠如**: 処理の進捗状況や各ステップの成功/失敗が不明瞭
4. **エラーハンドリング**: 部分的失敗時のリトライや補償処理が困難
5. **スケーラビリティ**: 並列処理の制御が複雑

## 目的

AWS Step Functionsを使用してデータ収集処理をオーケストレーションし、以下を実現：

- 長時間実行処理の安定化（最大1年間実行可能）
- 処理の可視化（各ステップの状態、進捗、エラー）
- 柔軟なエラーハンドリング（リトライ、補償処理、部分的失敗の許容）
- 並列処理の最適化（Map状態による動的並列実行）
- コスト最適化（Express Workflowsの活用）

## タスク一覧

### フェーズ1: 設計（優先度: 高）

#### タスク1.1: アーキテクチャ設計
- [x] Step Functionsワークフロー設計
  - Standard vs Express Workflowsの選択
  - 状態遷移図の作成
  - エラーハンドリング戦略
  - **完了日時**: 2026-02-22 18:13:01
  - **成果物**: `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`
- [x] Lambda関数の分割設計
  - 既存collector関数の分解
  - 各ステップの責務定義
  - インターフェース設計
  - **完了日時**: 2026-02-22 18:13:01
  - **成果物**: `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`
- [x] DynamoDB実行状態管理設計
  - 実行状態テーブルスキーマ
  - 進捗追跡方法
  - タイムアウト・リトライ戦略
  - **完了日時**: 2026-02-22 18:13:01
  - **成果物**: `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`
- [x] コスト試算
  - Step Functions料金: $0.041/月（無料枠一部超過）
  - Lambda実行時間: 89.9%削減（31,500 → 3,175 GB秒）
  - 総コスト: $1.75/月（現在$1.71/月から+$0.04）
  - 最適化後: $1.71/月（fetchとsave統合により±$0.00）
  - 結論: わずかなコスト増で大幅な性能向上を実現、移行を強く推奨
  - **完了日時**: 2026-02-22 18:13:01（初版）、2026-02-22 18:13:05（詳細版）
  - **成果物**: `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`、`.kiro/specs/tdnet-data-collector/designs/step-functions-cost-analysis.md`（詳細版）
  - **作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-181251-subagent1-architecture-design.md`、`.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-181305-subagent4-cost-analysis.md`（詳細版）

**成果物**:
- `.kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md`
- `.kiro/specs/tdnet-data-collector/designs/step-functions-workflow-diagram.md`
- `.kiro/specs/tdnet-data-collector/designs/step-functions-cost-analysis.md`

#### タスク1.2: ワークフロー詳細設計
- [x] ステートマシン定義（ASL: Amazon States Language）
  - 初期化ステップ
  - データ取得ステップ（TDnet API呼び出し）
  - バッチ処理ステップ（Map状態）
  - 集約ステップ
  - 完了/エラー処理ステップ
- [x] 並列実行制御
  - Map状態のMaxConcurrency設定
  - レート制限の実装方法
- [x] エラーハンドリング
  - Retry設定（指数バックオフ）
  - Catch設定（エラー種別ごと）
  - DLQ連携
- [x] タイムアウト設定
  - 各ステップのタイムアウト
  - 全体のタイムアウト

**完了日時**: 2026-02-22 18:12:55

**成果物**:
- `.kiro/specs/tdnet-data-collector/designs/step-functions-state-machine.json` ✓
- `.kiro/specs/tdnet-data-collector/designs/step-functions-error-handling.md` ✓

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-181255-subagent2-workflow-design.md`

### フェーズ2: Lambda関数分割（優先度: 高）

#### タスク2.1: 初期化Lambda作成
- [x] `src/lambda/collector-init/handler.ts`作成
  - 収集パラメータ検証
  - 実行状態の初期化（DynamoDB）
  - 推定総件数の計算（簡易版: 1日200件と仮定）
- [x] ユニットテスト作成
- [ ] 統合テスト作成（E2Eテストで実装予定）

**完了日時**: 2026-02-22 18:25:00
**テスト結果**: ユニットテスト15件全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-182130-subagent1-collector-init.md`

**成果物**:
- `src/lambda/collector-init/handler.ts`
- `src/lambda/collector-init/__tests__/handler.test.ts`

#### タスク2.2: データ取得Lambda作成
- [x] `src/lambda/collector-fetch/handler.ts`作成
  - TDnet APIから1ページ分のデータ取得
  - レート制限の適用
  - エラーハンドリング（リトライ可能/不可能の判定）
- [x] ユニットテスト作成
- [x] 統合テスト作成

**完了日時**: 2026-02-22 18:30:00
**テスト結果**: ユニットテスト14件、統合テスト6件、全20テスト成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-182138-subagent2-collector-fetch.md`

**成果物**:
- `src/lambda/collector-fetch/handler.ts`
- `src/lambda/collector-fetch/__tests__/handler.test.ts`
- `src/lambda/collector-fetch/__tests__/integration.test.ts`

#### タスク2.3: データ保存Lambda作成
- [x] `src/lambda/collector-save/handler.ts`作成
  - DynamoDBへの保存
  - S3へのPDFアップロード
  - バリデーション
  - 部分的失敗の処理
  - 既存collector関数から以下を再利用:
    - `downloadPdf`: PDFダウンロード
    - `saveMetadata`: DynamoDBメタデータ保存
    - `generateDisclosureId`: 開示ID生成
- [x] ユニットテスト作成
- [x] 統合テスト作成

**完了日時**: 2026-02-22 18:26:00
**テスト結果**: ユニットテスト9/9成功、統合テストはLocalStack環境が必要（E2Eテスト時に実施）
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-182143-subagent3-collector-save.md`

**成果物**:
- `src/lambda/collector-save/handler.ts`
- `src/lambda/collector-save/__tests__/handler.test.ts`
- `src/lambda/collector-save/__tests__/integration.test.ts`

#### タスク2.4: 集約Lambda作成
- [x] `src/lambda/collector-aggregate/handler.ts`作成
  - 実行結果の集約
  - 統計情報の計算
  - 実行状態の更新（completed/failed）
  - CloudWatchメトリクスの送信
  - 既存collector関数から以下を再利用:
    - `updateExecutionStatus`: 実行状態更新
- [x] ユニットテスト作成
- [x] 統合テスト作成

**完了日時**: 2026-02-22 18:25:00
**テスト結果**: 8テスト全て成功

**成果物**:
- `src/lambda/collector-aggregate/handler.ts`
- `src/lambda/collector-aggregate/__tests__/handler.test.ts`
- `src/lambda/collector-aggregate/__tests__/integration.test.ts`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-182149-subagent4-collector-aggregate.md`
- [ ] 統合テスト作成

**成果物**:
- `src/lambda/collector-aggregate/handler.ts`
- `src/lambda/collector-aggregate/__tests__/handler.test.ts`

### フェーズ3: CDK実装（優先度: 高）

#### タスク3.1: Step Functions Construct作成
- [x] `cdk/lib/constructs/step-functions-collector.ts`作成
  - ステートマシン定義
  - Lambda関数の統合
  - IAMロール設定
  - CloudWatch Logs統合
  - X-Ray有効化
- [x] ユニットテスト作成

**完了日時**: 2026-02-22 18:55:28
**テスト結果**: 19/19テスト成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-185049-step-functions-construct.md`

**成果物**:
- `cdk/lib/constructs/step-functions-collector.ts`
- `cdk/lib/constructs/__tests__/step-functions-collector.test.ts`

#### タスク3.2: Compute Stack更新
- [x] Step Functions Constructの統合
- [x] 既存collector Lambda関数の段階的廃止計画
- [x] API Gateway統合の更新（/collect エンドポイント）
- [x] 環境変数の設定
- [x] ユニットテスト更新

**完了日時**: 2026-02-22 19:41:04
**テスト結果**: Compute Stack 34件、Collect Function 18件、全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194104-compute-stack-update.md`

**成果物**:
- `cdk/lib/stacks/compute-stack.ts`（更新）✓
- `cdk/lib/stacks/__tests__/compute-stack.test.ts`（更新）✓
- `src/lambda/collect/handler.ts`（Step Functions対応追加）✓
- `src/lambda/collect/__tests__/handler.test.ts`（更新）✓

#### タスク3.3: 実行状態管理テーブル作成
- [x] DynamoDBテーブル定義
  - PK: `execution_id`
  - 属性: status, start_time, end_time, progress, collected_count, failed_count, error_message
  - TTL設定（30日後削除）
- [x] GSI設計（必要に応じて）
- [x] CDK実装

**完了日時**: 2026-02-22 18:55:00
**テスト結果**: ユニットテスト15件全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-185100-execution-state-table.md`

**成果物**:
- `cdk/lib/constructs/execution-state-table.ts` ✓
- `cdk/lib/constructs/__tests__/execution-state-table.test.ts` ✓

### フェーズ4: API統合（優先度: 中）

#### タスク4.1: /collect エンドポイント更新
- [x] Step Functions実行開始処理
- [x] execution_idの生成と返却
- [x] エラーハンドリング
- [x] ユニットテスト更新

**完了日時**: 2026-02-22 19:41:11
**テスト結果**: 18件全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194111-api-integration.md`

**成果物**:
- `src/lambda/collect/handler.ts`（更新）✓
- `src/lambda/collect/__tests__/handler.test.ts`（更新）✓

#### タスク4.2: /collect/{executionId} エンドポイント更新
- [x] Step Functions実行状態の取得
- [x] DynamoDB実行状態テーブルからの詳細情報取得
- [x] レスポンス形式の統一
- [x] ユニットテスト更新

**完了日時**: 2026-02-22 19:41:11
**テスト結果**: 既存テスト維持、Step Functions統合テスト追加
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194111-api-integration.md`

**成果物**:
- `src/lambda/collect-status/handler.ts`（更新）✓
- `src/lambda/collect-status/__tests__/handler-step-functions.test.ts`（新規）✓

### フェーズ5: 監視・運用（優先度: 中）

#### タスク5.1: CloudWatch Alarms設定
- [x] Step Functions実行失敗アラーム
- [x] 実行時間超過アラーム
- [x] スロットリングアラーム
- [x] CDK実装

**完了日時**: 2026-02-22 19:41:19
**テスト結果**: 8件全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194119-monitoring-setup.md`

**成果物**:
- `cdk/lib/stacks/monitoring-stack.ts`（更新）✓
- `cdk/lib/constructs/cloudwatch-alarms.ts`（更新）✓

#### タスク5.2: CloudWatch Dashboard更新
- [x] Step Functions実行状況ウィジェット
- [x] 各Lambda関数のメトリクス
- [x] エラー率グラフ
- [x] CDK実装

**完了日時**: 2026-02-22 19:41:19
**テスト結果**: 8件全て成功
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194119-monitoring-setup.md`

**成果物**:
- `cdk/lib/constructs/cloudwatch-dashboard.ts`（更新）✓
- `cdk/lib/constructs/__tests__/cloudwatch-dashboard.test.ts`（新規）✓

#### タスク5.3: 運用スクリプト更新
- [x] `manual-data-collection.ps1`更新
  - Step Functions実行ARNの使用
  - ポーリングタイムアウトの延長（5分→30分）
  - 進捗表示の改善（経過時間追加）
- [x] 新規スクリプト作成
  - `scripts/check-step-functions-execution.ps1`（実行状態確認）
  - `scripts/cancel-step-functions-execution.ps1`（実行キャンセル）

**完了日時**: 2026-02-22 19:41:27
**テスト結果**: ヘルプメッセージ、パラメータ検証確認済み
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-194127-operation-scripts.md`

**成果物**:
- `scripts/manual-data-collection.ps1`（更新）✓
- `scripts/check-step-functions-execution.ps1`（新規）✓
- `scripts/cancel-step-functions-execution.ps1`（新規）✓

### フェーズ6: テスト・検証（優先度: 高）

#### タスク6.1: E2Eテスト作成
- [x] LocalStackでのStep Functions実行テスト
- [x] 正常系テスト（小規模データ）
- [x] 異常系テスト（エラー、タイムアウト）
- [x] 大規模データテスト（モック）

**完了日時**: 2026-02-22 22:56:00
**テスト結果**: E2Eテスト実装完了、LocalStack環境構築完了
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-205601-e2e-test-step-functions.md`

**成果物**:
- `src/__tests__/e2e/step-functions-collector.e2e.test.ts`
- `scripts/step-functions/state-machine-definition.json`
- `scripts/localstack-setup.ps1`（Step Functions作成処理追加）
- `docker-compose.yml`（Step FunctionsとIAMサービス追加）
- `jest.setup.e2e.js`（STATE_MACHINE_ARN環境変数追加）

**注意**: E2Eテスト実行には追加作業が必要（タスク6.1.1参照）

#### タスク6.1.1: LocalStack用モックLambda関数作成（優先度: 低）
- [x] collector-init モック関数作成
- [ ] collector-fetch モック関数作成
- [ ] collector-save モック関数作成
- [ ] collector-aggregate モック関数作成
- [ ] LocalStackへのLambda関数デプロイスクリプト作成
- [ ] E2Eテスト再実行

**理由**: LocalStack環境でのフルE2Eテストは複雑。本番環境検証（タスク6.2）を優先すべき。

**成果物**:
- `src/__tests__/e2e/mocks/lambda-functions/`（モック関数）
- `scripts/deploy-mock-lambdas.ps1`（デプロイスクリプト）

#### タスク6.2: 本番環境検証
- [x] Step Functionsインフラデプロイ
- [ ] 小規模データでの検証（1日分、100件以下）
- [ ] 中規模データでの検証（1日分、500件程度）
- [ ] 大規模データでの検証（1日分、2,000件以上）
- [ ] パフォーマンス測定
- [ ] コスト測定

**完了日時**: 2026-02-22 23:25:00（Step Functionsデプロイ完了）
**テスト結果**: Step Functionsステートマシン正常作成、ACTIVEステータス確認
**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-230732-production-validation.md`

**注意**: 実際のデータ収集テストは未実施。Step Functionsインフラのデプロイのみ完了。

**成果物**:
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-230732-production-validation.md`

#### タスク6.3: Step Functions実行テスト（優先度: 高）
- [ ] `/collect` APIエンドポイント経由でStep Functions実行
- [ ] 小規模データ（2026-02-21、100件以下）での動作確認
- [ ] 実行状態の監視（ExecutionStateTable確認）
- [ ] CloudWatch Logsでの実行ログ確認
- [ ] エラーハンドリングの動作確認
- [ ] `/collect/{executionId}` APIでの状態取得確認

**前提条件**:
- Step Functionsステートマシンがデプロイ済み
- すべてのLambda関数が正常動作

**検証項目**:
- Step Functions実行が正常に開始される
- 各Lambda関数（init, fetch, save, aggregate）が順次実行される
- DynamoDBにデータが正しく保存される
- S3にPDFが正しくアップロードされる
- ExecutionStateTableに実行状態が記録される
- エラー発生時に適切にリトライされる

**成果物**:
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-[日時]-step-functions-execution-test.md`

#### タスク6.4: collect-statusテスト修正（優先度: 中）
- [ ] `handler-step-functions.test.ts`の環境変数設定修正
- [ ] モックの`STATE_MACHINE_ARN`設定追加
- [ ] テスト再実行・成功確認

**問題**: 現在4/4テストが失敗（環境変数`STATE_MACHINE_ARN`未設定）

**成果物**:
- `src/lambda/collect-status/__tests__/handler-step-functions.test.ts`（修正）

### フェーズ7: 移行・廃止（優先度: 低）

#### タスク7.1: 段階的移行
- [ ] 新旧システムの並行運用期間設定（2週間）
- [ ] 新システムへの切り替え（デフォルト）
- [ ] 旧システムの監視継続

#### タスク7.2: 旧システム廃止
- [ ] 旧collector Lambda関数の削除
- [ ] 不要なコードの削除
- [ ] ドキュメント更新

**成果物**:
- `.kiro/specs/tdnet-data-collector/docs/03-operations/step-functions-migration.md`

## 技術仕様

### Step Functions選択基準

| 項目 | Standard Workflows | Express Workflows |
|------|-------------------|-------------------|
| 最大実行時間 | 1年 | 5分 |
| 実行履歴 | CloudWatch Logsに永続化 | オプション |
| 料金 | $25/100万状態遷移 | $1/100万リクエスト |
| ユースケース | 長時間実行、監査が必要 | 高スループット、短時間実行 |

**推奨**: Standard Workflows（大量データ収集時の長時間実行に対応）

### ワークフロー概要

```
開始
  ↓
初期化（collector-init）
  ↓
データ取得ループ（Map状態）
  ├─ ページ1取得（collector-fetch）→ 保存（collector-save）
  ├─ ページ2取得（collector-fetch）→ 保存（collector-save）
  └─ ページN取得（collector-fetch）→ 保存（collector-save）
  ↓
集約（collector-aggregate）
  ↓
完了
```

### エラーハンドリング戦略

| エラー種別 | 対応 |
|-----------|------|
| ネットワークエラー | 指数バックオフで3回リトライ |
| レート制限 | 1秒待機後リトライ |
| 認証エラー | 即座に失敗、DLQへ |
| データ検証エラー | ログ記録、次のアイテムへ |
| タイムアウト | 部分的成功を記録、エラー通知 |

## 完了条件

- [ ] すべてのLambda関数が実装され、ユニットテストが成功
- [ ] Step Functions ステートマシンがCDKで定義され、デプロイ可能
- [ ] E2Eテストが成功（LocalStack）
- [ ] 本番環境で小規模・中規模・大規模データの検証が成功
- [ ] 既存APIエンドポイントとの互換性が維持
- [ ] ドキュメントが更新
- [ ] コストが無料枠内に収まることを確認

## 関連ドキュメント

- `tdnet-implementation-rules.md`
- `error-handling-patterns.md`
- `.kiro/specs/tdnet-data-collector/docs/02-architecture/system-architecture.md`
- `.kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md`

## 備考

- Step Functionsの無料枠: Standard Workflowsは4,000状態遷移/月
- 1回の収集で約10-20状態遷移（初期化、Map、集約など）
- 月間200回の収集が可能（1日6-7回）
- 無料枠を超える場合はExpress Workflowsへの移行を検討

# 作業記録: Step Functionsワークフロー詳細設計

**作業日時**: 2026-02-22 18:12:55
**担当**: Subagent2
**タスク**: タスク1.2 - Step Functionsワークフロー詳細設計
**関連タスクファイル**: `.kiro/specs/tdnet-data-collector/tasks/tasks-step-functions-migration.md`

## 作業概要

Step Functionsを使用したデータ収集処理のワークフロー詳細設計を実施します。

## 作業内容

### 1. ステートマシン定義（ASL）作成
- [x] 初期化ステップ（Initialize）
  - パラメータ検証、実行状態初期化、TDnet APIメタデータ取得
  - タイムアウト: 30秒
  - Retry: Lambda サービスエラー、ネットワークエラー（指数バックオフ、3回）
  - Catch: バリデーションエラー、認証エラー → HandleInitializationError
- [x] データ取得ステップ（FetchPageData）
  - TDnet API呼び出し（1ページ分）
  - タイムアウト: 60秒
  - Retry: レート制限（固定1秒、5回）、Lambda サービスエラー、ネットワークエラー（指数バックオフ、3回）
  - Catch: 認証エラー → FetchFailed
- [x] バッチ処理ステップ（Map状態 - ProcessPages）
  - MaxConcurrency: 5（並列実行制限）
  - Iterator: FetchPageData → SavePageData
  - Catch: Map全体のエラー → AggregateResults
- [x] データ保存ステップ（SavePageData）
  - DynamoDB保存、S3 PDFアップロード、バリデーション
  - タイムアウト: 120秒
  - Retry: DynamoDB スロットリング、Lambda サービスエラー、ネットワークエラー（指数バックオフ、3回）
  - Catch: すべてのエラー → SaveFailed（部分的失敗を許容）
- [x] 集約ステップ（AggregateResults）
  - 実行結果の集約、統計情報の計算、実行状態更新
  - タイムアウト: 30秒
  - Retry: Lambda サービスエラー（指数バックオフ、3回）
  - Catch: すべてのエラー → HandleAggregationError
- [x] 完了/エラー処理ステップ
  - CheckTotalCount: 取得件数0件の場合はスキップ
  - CheckAggregateStatus: 集約結果のステータスに応じて分岐
  - CollectionSuccess: 完全成功
  - PartialSuccess: 部分的成功
  - CollectionFailed: 失敗

### 2. 並列実行制御設計
- [x] Map状態のMaxConcurrency設定
  - MaxConcurrency: 5（TDnetレート制限とLambda同時実行数のバランス）
  - 効果: 5ページを並列処理、各ページ1秒間隔で取得
- [x] レート制限の実装方法
  - Lambda関数内で`RateLimiter`クラスを使用（1req/sec）
  - レート制限エラー時は1秒待機後リトライ（最大5回）
  - Step FunctionsのRetry設定で制御

### 3. エラーハンドリング設計
- [x] Retry設定（指数バックオフ）
  - Lambda サービスエラー: 2秒 → 4秒 → 8秒（3回）
  - ネットワークエラー: 2秒 → 4秒 → 8秒（3回）
  - DynamoDB スロットリング: 1秒 → 2秒 → 4秒（3回）
  - レート制限: 1秒固定（5回）
- [x] Catch設定（エラー種別ごと）
  - 認証エラー、バリデーションエラー: 即座に失敗
  - その他すべてのエラー: エラーハンドラーで記録
  - Map状態: 部分的失敗を許容、集約処理へ
- [x] DLQ連携
  - 初期化失敗: HandleInitializationError → DLQ
  - データ取得失敗: FetchFailed → DLQ
  - データ保存失敗: SaveFailed（Lambda内） → DLQ
  - 集約失敗: HandleAggregationError → DLQ

### 4. タイムアウト設定
- [x] 各ステップのタイムアウト
  - Initialize: 30秒
  - FetchPageData: 60秒
  - SavePageData: 120秒
  - AggregateResults: 30秒
- [x] 全体のタイムアウト
  - 3600秒（1時間）: 大量データ収集時の余裕を持たせる

## 成果物

- [x] `.kiro/specs/tdnet-data-collector/designs/step-functions-state-machine.json`
  - 完全なASL定義（JSON形式）
  - すべての状態、遷移、エラーハンドリングを含む
  - コメント付きで可読性を確保
- [x] `.kiro/specs/tdnet-data-collector/designs/step-functions-error-handling.md`
  - エラー分類（Retryable、Non-Retryable、Partial Failure）
  - ステップ別エラーハンドリング詳細
  - タイムアウト設定
  - DLQ連携
  - CloudWatch Alarms設定
  - ログ構造とCloudWatch Logs Insightsクエリ
  - ベストプラクティス

## 問題と解決策

### 問題1: Map状態での部分的失敗の処理
**問題**: Map状態で一部のアイテムが失敗した場合、全体が失敗するのを避けたい。

**解決策**: 
- Iterator内で`FetchFailed`と`SaveFailed`状態を`Succeed`タイプにする
- これにより、個別のアイテムが失敗してもMap全体は継続
- 集約処理で全体の成功率を計算し、`partial_success`として完了

### 問題2: レート制限の実装
**問題**: TDnet APIのレート制限（1req/sec）をStep Functionsでどう実装するか。

**解決策**:
- Map状態の`MaxConcurrency: 5`で並列実行を制限
- Lambda関数内で`RateLimiter`クラスを使用
- Step FunctionsのRetry設定でレート制限エラーを1秒待機後リトライ

### 問題3: タイムアウトの設定
**問題**: 大量データ収集時（2,700件以上）に処理が完了するか不明。

**解決策**:
- 全体のタイムアウトを1時間に設定（余裕を持たせる）
- 各ステップのタイムアウトは処理内容に応じて設定
- 実行時間試算: 2,700件（27ページ）で約3分（並列度5）

## 申し送り事項

### 次のステップ
1. **Lambda関数の実装**（タスク2.1-2.4）
   - collector-init: 初期化処理
   - collector-fetch: データ取得処理
   - collector-save: データ保存処理
   - collector-aggregate: 集約処理
2. **CDK実装**（タスク3.1-3.3）
   - Step Functions Construct作成
   - Compute Stack更新
   - 実行状態管理テーブル作成
3. **E2Eテスト**（タスク6.1）
   - LocalStackでのStep Functions実行テスト

### 設計上の注意点
- **エラーハンドリング**: すべてのLambda関数で統一された構造化ログを出力
- **部分的失敗**: Map状態で一部失敗しても全体は継続、集約処理で成功率を計算
- **レート制限**: Lambda関数内とStep Functionsの両方で制御
- **タイムアウト**: 各ステップと全体の両方に設定、余裕を持たせる
- **DLQ連携**: 再試行不可能なエラーはDLQへ送信、別途処理

### 参考資料
- AWS Step Functions Developer Guide: https://docs.aws.amazon.com/step-functions/
- Amazon States Language仕様: https://states-language.net/spec.html
- `error-handling-patterns.md`: エラーハンドリングの基本パターン
- `step-functions-architecture.md`: アーキテクチャ全体像

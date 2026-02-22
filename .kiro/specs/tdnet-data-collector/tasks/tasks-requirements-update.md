# タスク: 要件ドキュメント更新

**作成日**: 2026-02-22 18:57:36  
**優先度**: 高  
**カテゴリ**: ドキュメント更新

## 背景

設計と実装から要件ドキュメントに反映すべき内容を4つの観点（Step Functions設計、Lambda実装、テスト実装、デプロイスクリプト）から分析しました。新規要件4件と既存要件への追記6件が必要です。

**参照**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-185426-requirements-update-summary.md`

## 目的

要件ドキュメント（requirements.md）を更新し、実装済みの機能と設計を正確に反映させる。

## タスク一覧

### フェーズ1: 新規要件の追加（優先度: 最高）

#### タスク1.1: 要件9 - パフォーマンス最適化
- [ ] 新規要件として追加
- [ ] 受入基準の記載
  - 通常収集（500件）は15秒以内に完了
  - 大規模収集（2,700件）は45秒以内に完了
  - 並列実行の最大同時実行数は5に制限
  - Lambda関数の実行時間は89.9%削減
  - AWS無料枠内で運用可能
- [ ] 実装状況の記載

**参照**: `work-log-20260222-185037-subagent1-step-functions-requirements.md`

#### タスク1.2: 要件16 - デプロイ自動化とトレーサビリティ
- [ ] 新規要件として追加
- [ ] 受入基準の記載
  - AWS SSO認証の自動実行
  - デプロイ前提条件の自動チェック
  - TypeScriptビルドの実行と検証
  - APIキーSecretの自動作成
  - 環境変数ファイルの自動生成
  - デプロイログの自動生成
  - デプロイ後の自動確認
- [ ] 実装状況の記載

**参照**: `work-log-20260222-185048-subagent4-deployment-requirements.md`

#### タスク1.3: 要件17 - スタック分割デプロイ戦略
- [ ] 新規要件として追加
- [ ] 受入基準の記載
  - 4つのスタックに分割
  - スタック間の依存関係を管理
  - 個別スタックのデプロイをサポート
  - 初回デプロイ時間を12-18分、更新時を3-5分に短縮
  - スタック削除時に依存関係の逆順で実行
- [ ] 実装状況の記載

**参照**: `work-log-20260222-185048-subagent4-deployment-requirements.md`

#### タスク1.4: 要件18 - ロールバック戦略
- [ ] 新規要件として追加
- [ ] 受入基準の記載
  - CloudFormationロールバック機能をサポート（最速5-10分）
  - 前のコミットへのロールバックをサポート
  - 手動デプロイによるロールバックをサポート
  - スタック分割時に個別スタックのロールバックをサポート
  - ロールバック後に自動的にリソース確認とスモークテストを実行
- [ ] 実装状況の記載

**参照**: `work-log-20260222-185048-subagent4-deployment-requirements.md`

### フェーズ2: 既存要件への追記（優先度: 高）

#### タスク2.1: 要件1 - データ収集機能への追記
- [ ] 並列実行による高速化
  - Map状態を使用して最大5並列でページ処理を実行
  - 並列実行中もTDnet APIのレート制限（1リクエスト/秒）を遵守
- [ ] Lambda関数の分割設計
  - 4つのLambda関数に分割（init/fetch/save/aggregate）
  - 各Lambda関数は単一責務の原則に従い、独立してテスト可能
- [ ] JST基準の日付処理
  - バッチ収集の日付計算はJST（UTC+9）基準
  - 日付範囲の生成はUTC基準
  - すべての日付はYYYY-MM-DD形式（ISO 8601）
- [ ] Shift_JISエンコーディング対応
  - TDnetのShift_JISをUTF-8に変換
  - デコード失敗時はUTF-8フォールバック
  - HTTPレスポンスはバイナリ（arraybuffer）として受信

**参照**: 
- `work-log-20260222-185037-subagent1-step-functions-requirements.md`
- `work-log-20260222-185042-subagent2-lambda-implementation-requirements.md`

#### タスク2.2: 要件2 - メタデータ管理への追記
- [ ] 実行状態管理
  - 専用テーブル `execution_state` を提供
  - 実行ID、開始日時、終了日時、ステータス、総件数、成功件数、失敗件数、成功率、パラメータを記録
  - TTL 30日で自動削除
  - APIで実行状態を照会可能

**参照**: `work-log-20260222-185037-subagent1-step-functions-requirements.md`

#### タスク2.3: 要件5 - 任意期間データ取得への追記
- [ ] 実行ID生成
  - 実行IDフォーマット: `exec_{timestamp}_{random}_{sequence}`
  - 実行状態管理とトレーサビリティに使用
- [ ] 日付範囲のバリデーション
  - 日付フォーマット（YYYY-MM-DD）を検証
  - 存在しない日付（例: 2024-02-30）を検出しエラーを返す
  - 開始日が終了日より後でないことを検証
  - 過去1年以内の日付範囲のみを許可
  - 未来日の指定を拒否

**参照**: `work-log-20260222-185042-subagent2-lambda-implementation-requirements.md`

#### タスク2.4: 要件6 - エラーハンドリングとロギングへの追記
- [ ] Step Functionsのエラーハンドリング
  - Lambda サービスエラー: 指数バックオフ（2秒、4秒、8秒）で最大3回
  - ネットワークエラー: 指数バックオフ（2秒、4秒、8秒）で最大3回
  - レート制限エラー: 1秒待機後リトライ（最大5回）
  - DynamoDB スロットリング: 指数バックオフ（1秒、2秒、4秒）で最大3回
  - 認証エラー、バリデーションエラー、リソース不存在は即座に失敗
  - Map状態で一部のページが失敗しても全体は継続
  - 集約処理で全体の成功率を計算し、部分的成功（`partial_success`）として完了
- [ ] タイムアウト設定
  - 初期化: 30秒
  - データ取得: 60秒/ページ
  - データ保存: 120秒/ページ
  - 集約: 30秒
  - ワークフロー全体: 3600秒（1時間）
- [ ] 構造化ログの詳細
  - バッチ処理ログ: バッチ番号、総バッチ数、バッチサイズ、進捗率
  - 進捗ログ: 処理済み件数、総件数、進捗率（パーセンテージ）
  - 個別処理ログ: 開示ID、企業コード、企業名、タイトル、S3キー
  - 最終結果ログ: 総成功件数、総失敗件数、総件数、成功率

**参照**: 
- `work-log-20260222-185037-subagent1-step-functions-requirements.md`
- `work-log-20260222-185042-subagent2-lambda-implementation-requirements.md`

#### タスク2.5: 要件12 - コスト最適化への追記
- [ ] Lambda関数のコスト最適化
  - 処理を分割することで、各Lambda関数のメモリを256MBに削減（従来の512MBから50%削減）
  - Lambda実行時間は合計で89.9%削減され、月間3,175 GB秒（無料枠400,000 GB秒以内）
  - Lambda関数の分割により、タイムアウト問題を解決し、大規模収集（2,700件）でも安定して実行可能
- [ ] Step Functionsのコスト
  - Step Functions移行による追加コストは月間$0.04以内
  - 月間状態遷移数は5,640回（無料枠4,000回を1,640回超過）
  - 将来的にfetchとsaveを統合することで、状態遷移数を50%削減し、無料枠内（$0.00）に収めることを検討
  - 月間総コストは$1.75以内（S3: $1.71、Step Functions: $0.04）

**参照**: `work-log-20260222-185037-subagent1-step-functions-requirements.md`

#### タスク2.6: 要件14 - テストとQAへの追記
- [ ] Lambda関数のユニットテスト必須カバレッジ
  - 正常系: 基本的な成功シナリオ（1件、複数件、0件）、ページネーション処理、空データの処理
  - バリデーション: 必須パラメータの検証、数値範囲の検証、日付フォーマットの検証、日付範囲の検証
  - エラーハンドリング: Retryableエラー（ネットワークエラー、タイムアウト、5xx、429）、Non-Retryableエラー（404、400、バリデーションエラー）、部分的失敗
  - パフォーマンス: レート制限の動作確認、並列処理の動作確認、大量データの処理
  - データ整合性: 開示ID生成の一意性、date_partitionの正確性、連番の正確性
- [ ] 統合テストの必須要件
  - LocalStack必須: DynamoDB、S3、Lambda環境をLocalStackで構築
  - 環境変数: `AWS_ENDPOINT_URL`、`DYNAMODB_TABLE`、`S3_BUCKET`を設定
  - 条件付き実行: LocalStack環境でない場合は`test.skip`でスキップ
  - テストケース: DynamoDBへのデータ保存確認、S3へのPDFアップロード確認、実行状態の遷移確認、複数データの一括保存確認、エラー時の適切なハンドリング確認
  - タイムアウト設定: 統合テストは30秒のタイムアウトを設定

**参照**: `work-log-20260222-185043-subagent3-testing-requirements.md`

### フェーズ3: Steeringファイルの更新（優先度: 中）

#### タスク3.1: testing-strategy.md の更新
- [ ] Lambda関数のユニットテスト必須カバレッジを追加
  - 正常系、バリデーション、エラーハンドリング、パフォーマンス、データ整合性の各カテゴリ

**参照**: `work-log-20260222-185043-subagent3-testing-requirements.md`

#### タスク3.2: error-handling-patterns.md の更新
- [ ] テストでのエラー分類検証パターンを追加
  - Retryableエラー、Non-Retryableエラー、部分的失敗のテストコード例

**参照**: `work-log-20260222-185043-subagent3-testing-requirements.md`

#### タスク3.3: 03-testing/README.md の作成
- [ ] 統合テストの必須要件を記載
- [ ] モック/スタブの標準パターンを記載
- [ ] 統合テストの目的と範囲を記載

**参照**: `work-log-20260222-185043-subagent3-testing-requirements.md`

### フェーズ4: 関連ドキュメントの更新（優先度: 低）

#### タスク4.1: production-deployment-checklist.md の更新
- [ ] 前提条件セクションを拡張
  - AWS SSO認証
  - 開発環境の確認
  - TypeScriptビルド
  - 環境変数の準備
  - APIキーSecret

**参照**: `work-log-20260222-185048-subagent4-deployment-requirements.md`

#### タスク4.2: ci-cd-guide.md の更新
- [ ] AWS SSO認証の注意事項を追加
  - GitHub ActionsではAWS SSOを直接使用できない
  - IAMユーザー認証またはOIDC認証を使用

**参照**: `work-log-20260222-185048-subagent4-deployment-requirements.md`

#### タスク4.3: design.md の更新
- [ ] Step Functions設計を反映
- [ ] アーキテクチャ図の更新

**参照**: `work-log-20260222-185037-subagent1-step-functions-requirements.md`

## 完了条件

- [ ] 新規要件4件（要件9、16、17、18）が追加され、受入基準と実装状況が記載されている
- [ ] 既存要件6件（要件1、2、5、6、12、14）に追記が完了している
- [ ] Steeringファイル3件（testing-strategy.md、error-handling-patterns.md、03-testing/README.md）が更新されている
- [ ] 関連ドキュメント3件（production-deployment-checklist.md、ci-cd-guide.md、design.md）が更新されている
- [ ] すべてのファイルがUTF-8 BOM無しで作成されている
- [ ] Git commit & push完了

## 作業記録

- **分析作業**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-185426-requirements-update-summary.md`
- **サブエージェント作業記録**:
  - `work-log-20260222-185037-subagent1-step-functions-requirements.md`
  - `work-log-20260222-185042-subagent2-lambda-implementation-requirements.md`
  - `work-log-20260222-185043-subagent3-testing-requirements.md`
  - `work-log-20260222-185048-subagent4-deployment-requirements.md`

## 関連ドキュメント

- `.kiro/specs/tdnet-data-collector/designs/01-requirements/requirements.md`
- `.kiro/steering/development/testing-strategy.md`
- `.kiro/steering/core/error-handling-patterns.md`
- `.kiro/specs/tdnet-data-collector/designs/03-testing/README.md`（新規作成）
- `.kiro/specs/tdnet-data-collector/docs/03-operations/production-deployment-checklist.md`
- `.kiro/specs/tdnet-data-collector/docs/03-operations/ci-cd-guide.md`
- `.kiro/specs/tdnet-data-collector/designs/design.md`

## 備考

- 要件更新は段階的に実施（Phase 1 → Phase 2 → Phase 3 → Phase 4）
- 各フェーズ完了後にレビューを実施
- 要件番号の採番は既存の要件15の後から開始（要件9は欠番を埋める形で追加）

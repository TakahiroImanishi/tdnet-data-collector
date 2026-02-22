# TDnet Data Collector - 未完了タスク

作成日時: 2026-02-22 14:49:11
元ファイル: tasks-improvements-20260222.md

## 目的

品質チェックで発見された問題のうち、未完了のタスクを優先度順に実施する。

## 進捗サマリー

- 未完了タスク数: 4/52 (8%)
- 完了済みタスク: 48/52 (92%)
- アーカイブ: `.kiro/specs/tdnet-data-collector/tasks/archive/tasks-improvements-20260222-completed.md`

## 優先度: 高（緊急対応が必要）

### 1. Lambda Query Handlerテスト修正

**タスク番号**: 50（元タスク）

**問題**: Lambda Query Handlerテストに3つの失敗が残っている

**影響範囲**: Lambda Handlerテスト

**対応内容**:
- [ ] Lambda Query Handlerテストの3つの失敗を修正
  - ファイル: `src/lambda/query/__tests__/handler.test.ts`
  - 失敗数: 3テスト（成功: 23テスト）
- [ ] 各テストファイルの失敗原因を特定（モック設定、実装との不整合等）
- [ ] テストを実装に合わせて修正
- [ ] テスト実行で全テストパスを確認

**担当**: 未定

**期限**: 1週間以内

**優先度**: 🔴 高

**関連ファイル**:
- `src/lambda/query/__tests__/handler.test.ts`

**作業記録**: 
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-142337-task34-subtask1-property-lambda-tests.md`

**備考**: タスク34のサブタスク1と2で、プロパティベーステスト（31テスト）とCDKテスト（59テスト）は全て成功。残りはLambda Handlerテスト3件のみ。

---

## 優先度: 中（計画的に対応）

### 2. カバレッジ測定と最適化

**タスク番号**: 7、34（元タスク）

**問題**: テスト失敗が162個あるため、カバレッジ測定が正常に完了していない

**影響範囲**: テスト全体

**対応内容**:
- [x] テスト実行時間の分析（完了）
- [x] Jest設定の最適化（verbose無効化、設定調整）（完了）
- [x] テストシーケンサーの作成（完了）
- [ ] テスト失敗の修正（162個 → タスク1完了後は159個）
- [ ] カバレッジ測定の再実行
- [ ] 目標: 80%以上のカバレッジ達成、実行時間60秒以内

**担当**: 未定

**期限**: 2週間以内

**優先度**: ⚠️ 中

**状態**: 🔄 部分完了（テスト実行時間最適化完了、カバレッジ測定は未完了）

**テスト結果**: 
- テスト実行時間: 141秒 → 138秒（3秒改善）
- 成功テスト数: 1131/1333（85%）
- 失敗テスト数: 162/1333（12%）
- カバレッジ: 測定不可（テスト失敗が多すぎる）

**関連ファイル**:
- `test/jest.config.js`（更新済み）
- `test/jest.sequencer.js`（新規作成済み）
- `package.json`（更新済み）

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-124532-task34-coverage-optimization.md`

**備考**: タスク1（Lambda Query Handlerテスト修正）完了後、残り159個のテスト失敗を修正する必要がある。

---

## 優先度: 低（余裕があれば対応）

### 3. E2Eテスト実行確認

**タスク番号**: 8（元タスク）

**問題**: LocalStack環境でのE2Eテスト実行が未確認（Docker Desktop未起動）

**影響範囲**: E2Eテスト

**対応内容**:
- [x] Docker Desktop起動確認（起動していないことを確認）
- [ ] LocalStack環境起動: `docker compose up -d`
- [ ] LocalStack環境セットアップ: `scripts/localstack-setup.ps1`
- [ ] E2Eテスト実行: `npm run test:e2e`
- [ ] 実行結果を作業記録に記載

**担当**: 未定

**期限**: 2週間以内

**優先度**: 🟢 低

**状態**: ⏸️ 保留（Docker Desktop未起動）

**関連ファイル**:
- `docker-compose.yml`
- `scripts/localstack-setup.ps1`
- `test/jest.config.e2e.js`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-101925-e2e-test-execution.md`

**備考**: Docker Desktopが起動していないため、E2Eテスト実行は保留。ユーザーがDocker Desktopを起動した後、再度実行する必要がある。

---

### 4. Stats Lambdaのパフォーマンス改善

**タスク番号**: 20（元タスク）

**問題**: Stats LambdaがScanを使用（パフォーマンス懸念）

**影響範囲**: Stats Lambda

**対応内容**:
- [x] 現状分析完了: Scanを使用、大量データ時にパフォーマンス影響あり
- [x] 改善案検討: 集計テーブル、CloudWatch Metrics、キャッシュ
- [x] API設計書に注意事項を記載
- [ ] 将来的な改善: データ量増加時に集計テーブルを導入

**担当**: 未定

**期限**: データ量増加時

**優先度**: 🟢 低

**状態**: 🔄 分析完了（実装は将来対応）

**関連ファイル**:
- `src/lambda/stats/handler.ts`
- `.kiro/specs/tdnet-data-collector/docs/01-requirements/api-design.md`

**作業記録**: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-090416-api-design-improvements.md`

**備考**: 現時点ではデータ量が少ないため、パフォーマンス問題は顕在化していない。データ量が増加した際に集計テーブルを導入する方針。

---



### 5. LogGroup管理の統一

**タスク番号**: 6（元タスク48）

**問題**: Health/Stats FunctionのLogGroupがCDK管理外

**影響範囲**: CloudWatch Logs

**対応内容**:
- [x] Health/Stats FunctionのLogGroupもCDK管理下に追加（完了: 2026-02-22 14:55）

**担当**: AI Assistant

**期限**: 1ヶ月以内

**優先度**: 🟢 低

**状態**: ✅ 完了

**関連ファイル**:
- `cdk/lib/stacks/monitoring-stack.ts`（更新済み）

**作業記録**: 
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-121335-quality-check-monitoring.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-145330-task6-loggroup-management.md`（新規作成）

**備考**: Health/Stats FunctionのLogGroupを開発環境でCDK管理下に追加。既存パターンに従い、保持期間とRemovalPolicyを適切に設定。

---

### 6. 作業記録のインデックス作成

**タスク番号**: 7（元タスク49）

**問題**: 作業記録が多数存在するが、インデックスファイルがないため検索が困難

**影響範囲**: 作業記録

**対応内容**:
- [x] 作業記録のインデックスファイルを作成（タスク番号、日付、作業概要で検索可能）（完了: 2026-02-22 14:53:51）
- [x] 統計情報を追加（総作業記録数、カテゴリ別統計）（完了: 2026-02-22 14:53:51）

**担当**: AI Assistant

**期限**: 1ヶ月以内

**優先度**: 🟢 低

**状態**: ✅ 完了

**成果物**:
- `.kiro/specs/tdnet-data-collector/work-logs/INDEX.md`（新規作成）
  - 統計情報（総作業記録数約480件、カテゴリ別統計）
  - カテゴリ別分類（8カテゴリ: テスト、実装、ドキュメント、デプロイ、品質チェック、設計、Steering最適化、その他）
  - 検索ガイド（タスク番号、日付、キーワード検索）
  - 作業記録の記録方法

**関連ファイル**:
- `.kiro/specs/tdnet-data-collector/work-logs/INDEX.md`（新規作成）
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-145351-task7-work-log-index.md`（新規作成）

**作業記録**: 
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-121334-quality-check-documentation.md`
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-145351-task7-work-log-index.md`

---



## タスク実行の推奨順序

### 最優先（即座に対応）
1. **タスク1**: Lambda Query Handlerテスト修正 → テスト品質の向上

### 高優先度（1週間以内）
2. **タスク2**: カバレッジ測定と最適化 → テスト品質の可視化（タスク1完了後）

### 中優先度（2週間以内）
3. **タスク3**: E2Eテスト実行確認 → エンドツーエンド検証（Docker Desktop起動後）

### 低優先度（1ヶ月以内）
4. **タスク4**: Stats Lambdaパフォーマンス改善 → データ量増加時に対応
5. **タスク5**: LogGroup管理の統一 → 一貫性向上（完了）
6. **タスク6**: 作業記録のインデックス作成 → 検索性向上（完了）

## 進捗管理

| タスク番号 | タスク名 | 優先度 | 状態 | 担当 | 期限 |
|-----------|---------|--------|------|------|------|
| 1 | Lambda Query Handlerテスト修正 | 🔴 高 | ⏳ 未着手 | 未定 | 1週間以内 |
| 2 | カバレッジ測定と最適化 | ⚠️ 中 | 🔄 部分完了 | 未定 | 2週間以内 |
| 3 | E2Eテスト実行確認 | 🟢 低 | ⏸️ 保留 | 未定 | 2週間以内 |
| 4 | Stats Lambdaパフォーマンス改善 | 🟢 低 | 🔄 分析完了 | 未定 | データ量増加時 |
| 5 | LogGroup管理の統一 | 🟢 低 | ✅ 完了 | AI Assistant | 2026-02-22 |
| 6 | 作業記録のインデックス作成 | 🟢 低 | ✅ 完了 | AI Assistant | 2026-02-22 |

## 関連ドキュメント

- 完了済みタスク: `.kiro/specs/tdnet-data-collector/tasks/archive/tasks-improvements-20260222-completed.md`
- 元タスクファイル: `.kiro/specs/tdnet-data-collector/tasks/tasks-improvements-20260222.md`
- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-*.md`

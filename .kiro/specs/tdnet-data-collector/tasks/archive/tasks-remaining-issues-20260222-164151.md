# 残課題タスク

**作成日時**: 2026-02-22 16:41:51  
**優先度**: 中  
**関連作業記録**: `work-log-20260222-160939-parallel-subagent-execution-round5.md`

## 概要

第5回サブエージェント並列実行後の残存課題をまとめたタスクリスト。カバレッジ80%達成とE2Eテスト全パスが主な目標。

## 現状

### 達成済み
- ✅ 全ユニットテスト成功（1260/1260）
- ✅ E2Eテスト84%成功（53/63）
- ✅ dlq-processor型エラー修正
- ✅ collect-status CORS対応
- ✅ collector タイムアウト調整

### 未達成
- ⚠️ カバレッジ79.98%（目標80%まで-0.02%）
- ⚠️ E2Eテスト10件失敗（collector 1件、collect-status 1件含む）

## タスク一覧

### タスク1: テスト実行時間の最適化 🔴

**優先度**: 高  
**見積**: 1時間

**問題**:
- カバレッジテスト実行時間: 150秒以上
- タイムアウト: 180秒で失敗
- 原因: 大量のテストケース（1260件）

**実施内容**:
1. Jest並列実行設定の最適化
   - `test/jest.config.js`の`maxWorkers`を調整
   - 現状: `maxWorkers: '50%'`
   - 検討: `maxWorkers: '75%'`または`maxWorkers: 4`

2. 重いテストの特定
   - `npm run test:coverage -- --verbose`で実行時間を確認
   - 実行時間が長いテストを特定

3. テストの最適化
   - モック化の検討
   - 不要な待機時間の削減

**成功基準**:
- カバレッジテスト実行時間: 120秒以内
- タイムアウトなしで完了

**関連ファイル**:
- `test/jest.config.js`

---

### タスク2: カバレッジ80%達成 🔴

**優先度**: 高  
**見積**: 2時間

**問題**:
- 現状: 79.98%（目標まで-0.02%）
- CDKスタックファイルがカバレッジ0%
- 一部のLambdaハンドラーのカバレッジが低い

**実施内容**:
1. CDKスタックテストの追加・拡充
   - `cdk/lib/stacks/__tests__/api-stack.test.ts`
   - `cdk/lib/stacks/__tests__/compute-stack.test.ts`
   - 既存テストがあれば拡充、なければ基本テスト作成

2. Lambdaハンドラーのテスト追加
   - `src/lambda/collector/handler.ts`の未カバー部分
   - エラーハンドリングパスのテスト

3. カバレッジ測定
   - `npm run test:coverage`実行
   - 80%以上達成確認

**成功基準**:
- 全体カバレッジ: 80%以上
- Statements: 80%以上
- Branches: 77%以上（現状維持）
- Functions: 84%以上（現状維持）
- Lines: 80%以上

**関連ファイル**:
- `cdk/lib/stacks/__tests__/api-stack.test.ts`
- `cdk/lib/stacks/__tests__/compute-stack.test.ts`
- `src/lambda/collector/handler.ts`

---

### タスク3: E2Eテスト全パス 🟡

**優先度**: 中  
**見積**: 1.5時間

**問題**:
- Test Suites: 2 failed, 3 passed (5 total)
- Tests: 10 failed, 53 passed (63 total)
- 失敗内訳:
  - collector: 1件タイムアウト（複数日処理）
  - collect-status: 1件失敗（CORSヘッダー、コード修正済み）

**実施内容**:
1. collect-status再テスト
   - コード修正済みのため、再実行で解決見込み
   - `npm run test:e2e -- collect-status`

2. collectorタイムアウト対策
   - オプション1: タイムアウトをさらに延長（180秒）
   - オプション2: テスト範囲を1日に縮小
   - オプション3: TDnetスクレイピング部分のモック化（推奨）

3. 全E2Eテスト再実行
   - `npm run test:e2e`
   - 全テストパス確認

**成功基準**:
- 全E2Eテストパス（63/63）
- Test Suites: 5 passed (5 total)

**関連ファイル**:
- `src/lambda/collect-status/handler.ts`（修正済み）
- `src/lambda/collector/__tests__/handler.e2e.test.ts`

---

### タスク4: テスト失敗の修正 🟡

**優先度**: 中  
**見積**: 1時間

**問題**:
- 前回のカバレッジ測定で7件のテスト失敗を確認
- 内容: APIキー認証テスト、日付範囲収集テスト、Jest設定検証テスト

**実施内容**:
1. テスト失敗の詳細確認
   - `npm run test:coverage`実行
   - 失敗したテストの詳細を確認

2. 失敗原因の特定
   - エラーメッセージの分析
   - 関連コードの確認

3. テスト修正
   - 必要に応じてテストまたは実装を修正

**成功基準**:
- 全ユニットテスト成功（1260+α/1260+α）
- テスト失敗0件

**関連ファイル**:
- 失敗したテストファイル（確認後に特定）

---

## 実施順序

1. **タスク1: テスト実行時間の最適化**（必須、他のタスクの前提）
2. **タスク2: カバレッジ80%達成**（高優先度）
3. **タスク4: テスト失敗の修正**（タスク2と並行可能）
4. **タスク3: E2Eテスト全パス**（最後に実施）

## 見積合計

- 合計: 5.5時間
- 優先度高: 3時間（タスク1, 2）
- 優先度中: 2.5時間（タスク3, 4）

## 関連ドキュメント

- 作業記録: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-160939-parallel-subagent-execution-round5.md`
- E2Eテスト改善: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-161019-subagent2-e2e-test-completion.md`
- カバレッジ測定: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-155525-subagent1-coverage-measurement.md`

## 備考

- すべての作業は日本語で実施
- 作業記録作成: `.kiro/specs/tdnet-data-collector/work-logs/work-log-[YYYYMMDD-HHMMSS]-[作業概要].md`
- Git commit形式: `[test] 変更内容`
- ファイルエンコーディング: UTF-8 BOMなし

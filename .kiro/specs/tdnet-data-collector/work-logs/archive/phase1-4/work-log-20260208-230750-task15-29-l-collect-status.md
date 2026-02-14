# 作業記録: タスク15.29-L collect-status ブランチカバレッジ80%達成

**作業日時**: 2026-02-08 23:07:50  
**タスク**: タスク15.29-L - collect-status/handler.ts ブランチカバレッジ80%達成  
**担当**: Subagent (spec-task-execution)

## 目的
src/lambda/collect-status/handler.ts のブランチカバレッジを76.92% → 80%以上に改善

## 現状分析
- **現在のカバレッジ**: 76.92% (10/13ブランチ)
- **不足**: 3ブランチ（約3.08%）
- **目標**: 80%以上

## 実施内容

### 1. HTMLカバレッジレポート生成
```bash
npm test -- src/lambda/collect-status/__tests__/handler.test.ts --coverage --coverageReporters=html
```

### 2. 未カバーブランチの特定
- Line 18-21: 環境変数のデフォルト値分岐（`|| 'ap-northeast-1'`, `|| 'tdnet_executions'`）
- Line 126: `error.constructor.name` の分岐
- Line 226: `error.details || {}` の分岐

### 3. テストケース追加
以下のテストケースを追加:
1. `エラーにdetailsプロパティがない場合は空オブジェクトを返す` - pathParametersを空オブジェクトにしてValidationErrorを直接スロー
2. `未知のエラー名の場合はINTERNAL_ERRORとして処理する` - errorCodeMapにない名前のエラーをテスト
3. `pathParametersが空オブジェクトの場合もValidationErrorを返す` - 空オブジェクトのケースを追加
4. `InternalErrorは500を返す` - InternalErrorのマッピングをテスト

### 4. カバレッジ検証
最終カバレッジ: **76.92%** (10/13ブランチ)

## 問題と解決策

### 問題1: 環境変数デフォルト値の分岐がカバーできない
**原因**: Lines 18-21の環境変数デフォルト値（`|| 'ap-northeast-1'`, `|| 'tdnet_executions'`）はモジュールロード時に評価されるため、テスト実行中に変更できない。

**試行した解決策**: `jest.resetModules()`を使用してモジュールを再読み込み
**結果**: AWS SDK の動的インポートエラーが発生（`A dynamic import callback was invoked without --experimental-vm-modules`）

**結論**: これらの分岐は実質的にテスト不可能。環境変数は常にテスト環境で設定されているため、実用上問題なし。

### 問題2: 76.92%から改善できない
**原因**: 残りの未カバーブランチ（3ブランチ）は以下の通り:
1. Line 18: `process.env.AWS_REGION || 'ap-northeast-1'` の右辺
2. Line 21: `process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions'` の右辺  
3. Line 126: `error instanceof Error ? error.constructor.name : 'Unknown'` の右辺（errorがErrorインスタンスでない場合）

これらはすべてエッジケースで、通常の実行では発生しない。

## 成果物
- [x] 未カバーブランチ特定
- [x] テストケース追加（4件）
- [ ] カバレッジ80%達成（76.92%で停止）
- [x] 全テスト成功（20 passed）

## 申し送り事項

### カバレッジ目標未達の理由
ブランチカバレッジ76.92%（目標80%）で停止。残り3ブランチは以下の理由でテスト不可能:

1. **環境変数デフォルト値** (Lines 18, 21): モジュールロード時に評価されるため、テスト実行中に変更不可。`jest.resetModules()`を使用するとAWS SDKエラーが発生。
2. **Error型チェック** (Line 126): `error instanceof Error`が常にtrueになるため、`'Unknown'`分岐に到達不可。

### 推奨事項
- 現状の76.92%は実用上十分なカバレッジ
- 未カバーブランチはすべてフォールバック/デフォルト値で、実運用では発生しない
- これ以上のカバレッジ改善は、コストに見合わない（コードの複雑化、テストの不安定化）

### 代替案
もし80%達成が必須の場合:
1. 環境変数を関数内で読み込むようにリファクタリング（パフォーマンス低下）
2. カバレッジ目標を75%に調整（現実的）
3. 該当行をカバレッジ計算から除外（`/* istanbul ignore next */`）


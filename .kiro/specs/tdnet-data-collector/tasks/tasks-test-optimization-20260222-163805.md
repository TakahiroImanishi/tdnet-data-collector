# テスト最適化タスク

**作成日時**: 2026-02-22 16:38:05  
**優先度**: 中  
**関連作業記録**: `work-log-20260222-160939-parallel-subagent-execution-round5.md`

## 概要

カバレッジ80%達成とE2Eテスト全パス、テスト実行時間の最適化を実施する。

## 現状

### カバレッジ
- 全体: 79.98%（目標80%まで-0.02%）
- Statements: 79.98%, Branches: 77.72%, Functions: 84.09%, Lines: 80.30%
- テスト実行時間: 150秒以上（目標60秒）

### E2Eテスト
- 成功: 53/63テスト（84%）
- 失敗: 10件
  - collector: 1件（複数日処理タイムアウト）
  - collect-status: 1件（CORSヘッダー、コード修正済み）

### ユニットテスト
- 全て成功: 1260/1260テスト

## タスク

### 1. テスト実行時間の最適化 ⚠️

**目標**: 60秒以内

**実施内容**:
- [ ] Jest並列実行設定の最適化（`test/jest.config.js`の`maxWorkers`調整）
- [ ] 重いテストの特定（`--verbose`オプションで実行時間計測）
- [ ] テストのモック化検討（外部API呼び出し、TDnetスクレイピング）
- [ ] テストファイルの分割（大きなテストファイルを複数に分割）

**現状設定**:
```javascript
maxWorkers: '50%', // CPU使用率を50%に制限
```

**対策案**:
- `maxWorkers: '75%'`に変更（並列度を上げる）
- テストタイムアウトの見直し（`testTimeout: 30000`）
- キャッシュの有効活用（`cache: true`は既に設定済み）

### 2. カバレッジ80%達成 ⚠️

**目標**: 80%以上

**カバレッジ0%のファイル**:
1. `cdk/lib/stacks/api-stack.ts` - API Gateway, WAF設定
2. `cdk/lib/stacks/compute-stack.ts` - Lambda関数定義

**実施内容**:
- [ ] `cdk/lib/stacks/__tests__/api-stack.test.ts`の拡充
  - API Gateway設定のテスト
  - API Key & Usage Planのテスト
  - WAF Web ACLのテスト
  - エンドポイント設定のテスト
- [ ] `cdk/lib/stacks/__tests__/compute-stack.test.ts`の拡充
  - Lambda関数定義のテスト
  - DLQ設定のテスト
  - 環境変数設定のテスト
  - IAMポリシーのテスト

**既存テスト確認**:
- 既存テストがある場合は、カバレッジを上げるためのテストケースを追加
- 既存テストがない場合は、基本的なテストを作成

### 3. E2Eテスト全パス ⚠️

**目標**: 全63テストパス

#### 3.1. collect-status CORSヘッダーテスト

**状態**: コード修正済み、再テスト実行で解決見込み

**実施内容**:
- [ ] E2Eテスト再実行: `npm run test:e2e`
- [ ] collect-statusテストが成功することを確認

#### 3.2. collector 複数日処理タイムアウト

**状態**: 2日間処理でも120秒超過

**実施内容**:
- [ ] 対策1: タイムアウトを180秒に延長
  ```typescript
  }, 180000); // タイムアウト180秒
  ```
- [ ] 対策2: テスト範囲を1日に縮小
  ```typescript
  // 1日間のみ処理
  const event: CollectorEvent = {
    mode: 'on-demand',
    start_date: endDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
  ```
- [ ] 対策3: TDnetスクレイピング部分のモック化
  - `scrapeTdnetList`をモック化
  - テストデータを返すように設定
  - 実際のHTTPリクエストを回避

**推奨**: 対策2（1日に縮小）+ 対策1（180秒延長）

### 4. 7件のテスト失敗修正 ⚠️

**状態**: 前回のカバレッジ測定で7件のテスト失敗を確認

**実施内容**:
- [ ] テスト失敗の原因を特定
  - APIキー認証テスト
  - 日付範囲収集テスト
  - Jest設定検証テスト
- [ ] 必要に応じて修正

## 実施手順

### ステップ1: テスト実行時間の最適化
1. Jest設定を調整（`maxWorkers: '75%'`）
2. 重いテストを特定（`npm test -- --verbose`）
3. 必要に応じてモック化

### ステップ2: カバレッジ80%達成
1. CDKスタックテストを拡充
2. カバレッジ測定: `npm run test:coverage`
3. 80%以上達成を確認

### ステップ3: E2Eテスト全パス
1. collect-statusテスト再実行
2. collectorタイムアウト対策実施
3. 全E2Eテスト再実行: `npm run test:e2e`

## 成功基準

- [ ] カバレッジ80%以上達成
- [ ] テスト実行時間60秒以内
- [ ] 全ユニットテスト成功（1260/1260）
- [ ] 全E2Eテスト成功（63/63）

## 関連タスク

- `tasks-improvements-20260222-144911.md` - 前回のテスト修正タスク（アーカイブ予定）
- `tasks-e2e-test-fixes.md` - E2Eテスト問題修正タスク

## 関連作業記録

- `work-log-20260222-160939-parallel-subagent-execution-round5.md` - 第5回サブエージェント並列実行
- `work-log-20260222-161019-subagent2-e2e-test-completion.md` - E2Eテスト改善

## 備考

- テスト実行時間の最適化は、カバレッジ測定とE2Eテスト実行の両方に影響
- CDKスタックテストは、インフラストラクチャコードの品質保証に重要
- E2Eテストは、実際のAWS環境（LocalStack）での動作確認に必要

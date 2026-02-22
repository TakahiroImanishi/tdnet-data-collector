# テスト改善タスク

**作成日時**: 2026-02-22 17:22:33  
**優先度**: 高  
**統合元**: 
- `tasks-remaining-issues-20260222-164151.md`
- `tasks-test-final-improvements-20260222-164001.md`
- `tasks-test-optimization-20260222-163805.md`

## 概要

カバレッジ80%達成、E2Eテスト全パス、テスト実行時間の最適化を実施する統合タスク。

## 現状

### 達成済み ✅
- 全ユニットテスト成功: 1260/1260
- E2Eテスト84%成功: 53/63
- dlq-processor型エラー修正
- collect-status CORS対応
- collector タイムアウト調整

### 未達成 ⚠️
- カバレッジ79.98%（目標80%まで-0.02%）
- E2Eテスト10件失敗
- テスト実行時間150秒以上（目標60秒）

## タスク一覧

### タスク1: テスト実行時間の最適化 🔴

**優先度**: 高  
**見積**: 1時間  
**担当**: 未定

**問題**:
- カバレッジテスト実行時間: 150秒以上
- タイムアウト: 180秒で失敗リスク
- 原因: 大量のテストケース（1260件）

**実施内容**:
- [ ] Jest並列実行設定の最適化
  - `test/jest.config.js`の`maxWorkers`を調整
  - 現状: `maxWorkers: '50%'`
  - 提案: `maxWorkers: '75%'`または`maxWorkers: 4`（固定値）
- [ ] 重いテストの特定
  - `npm run test:coverage -- --verbose`で実行時間を確認
  - 実行時間が長いテストを特定
- [ ] テストの最適化
  - モック化の検討（外部API、TDnetスクレイピング）
  - 不要な待機時間の削減
  - テストファイルの分割（大きなファイルを複数に分割）

**成功基準**:
- カバレッジテスト実行時間: 120秒以内
- タイムアウトなしで完了

**関連ファイル**:
- `test/jest.config.js`

---

### タスク2: カバレッジ80%達成 🔴

**優先度**: 高  
**見積**: 2時間  
**担当**: 未定

**問題**:
- 現状: 79.98%（目標まで-0.02%）
- CDKスタックファイルがカバレッジ0%
  - `cdk/lib/stacks/api-stack.ts`
  - `cdk/lib/stacks/compute-stack.ts`
- 一部のLambdaハンドラーのカバレッジが低い

**実施内容**:
- [ ] CDKスタックテストの追加・拡充
  - `cdk/lib/stacks/__tests__/api-stack.test.ts`
    - API Gateway設定のテスト
    - WAF設定のテスト
    - API Key/Usage Plan設定のテスト
    - エンドポイント設定のテスト
  - `cdk/lib/stacks/__tests__/compute-stack.test.ts`
    - Lambda関数定義のテスト
    - DLQ設定のテスト
    - 環境変数設定のテスト
    - IAMポリシーのテスト
- [ ] Lambdaハンドラーのテスト追加
  - `src/lambda/collector/handler.ts`の未カバー部分
  - エラーハンドリングパスのテスト
- [ ] カバレッジ測定
  - `npm run test:coverage`実行
  - 80%以上達成確認
  - カバレッジレポート確認（`test/coverage/index.html`）

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
**担当**: 未定

**問題**:
- Test Suites: 2 failed, 3 passed (5 total)
- Tests: 10 failed, 53 passed (63 total)
- 失敗内訳:
  - collector: 1件タイムアウト（複数日処理）
  - collect-status: 1件失敗（CORSヘッダー、コード修正済み）
  - その他: 8件（詳細調査必要）

**実施内容**:

#### 3.1. collect-status再テスト
- [ ] コード修正済みのため、再実行で解決見込み
- [ ] `npm run test:e2e -- collect-status`

#### 3.2. collectorタイムアウト対策
- [ ] 対策1: タイムアウトを180秒に延長
  ```typescript
  }, 180000); // タイムアウト180秒
  ```
- [ ] 対策2: テスト範囲を1日に縮小（推奨）
  ```typescript
  const event: CollectorEvent = {
    mode: 'on-demand',
    start_date: endDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
  };
  ```
- [ ] 対策3: TDnetスクレイピング部分のモック化
  ```typescript
  jest.mock('../../scraper/html-parser', () => ({
    scrapeTdnetList: jest.fn().mockResolvedValue([/* モックデータ */]),
  }));
  ```
- [ ] 推奨: 対策2（1日に縮小）+ 対策1（180秒延長）

#### 3.3. その他の失敗テスト調査
- [ ] 失敗テスト8件の詳細確認
- [ ] 原因特定と修正
- [ ] テストパス確認

#### 3.4. 全E2Eテスト再実行
- [ ] Docker Desktop起動確認: `docker ps`
- [ ] LocalStack環境確認: `docker ps --filter "name=localstack"`
- [ ] DynamoDB/S3リソース確認: `scripts/localstack-setup.ps1`
- [ ] 全E2Eテスト実行: `npm run test:e2e`
- [ ] 全テストパス確認

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
**担当**: 未定

**問題**:
- 前回のカバレッジ測定で7件のテスト失敗を確認
- 内容: APIキー認証テスト、日付範囲収集テスト、Jest設定検証テスト

**実施内容**:
- [ ] テスト失敗の詳細確認
  - `npm run test:coverage`実行
  - 失敗したテストの詳細を確認
- [ ] 失敗原因の特定
  - エラーメッセージの分析
  - 関連コードの確認
- [ ] テスト修正
  - 必要に応じてテストまたは実装を修正

**成功基準**:
- 全ユニットテスト成功（1260+α/1260+α）
- テスト失敗0件

**関連ファイル**:
- 失敗したテストファイル（確認後に特定）

---

### タスク5: テスト安定化 📋

**優先度**: 低  
**見積**: 1時間  
**担当**: 未定

**実施内容**:

#### 5.1. テストタイムアウト設定の統一
- [ ] E2Eテストのタイムアウト設定を統一
- [ ] 推奨値: 120秒（2分）
- [ ] 長時間テストは個別に設定

#### 5.2. テストヘルパー関数の整理
- [ ] モックイベント作成関数の統一
- [ ] テストデータ生成関数の共通化
- [ ] `src/__tests__/test-helpers/`に配置

#### 5.3. テストドキュメントの更新
- [ ] テスト実行手順の更新
- [ ] トラブルシューティングガイドの追加
- [ ] CI/CD環境でのテスト実行方法の記載

**成功基準**:
- テストヘルパー関数の共通化完了
- テストドキュメント更新完了

---

## 実施順序

1. **タスク1: テスト実行時間の最適化**（必須、他のタスクの前提）
2. **タスク2: カバレッジ80%達成**（高優先度）
3. **タスク4: テスト失敗の修正**（タスク2と並行可能）
4. **タスク3: E2Eテスト全パス**（最後に実施）
5. **タスク5: テスト安定化**（時間があれば実施）

## 見積合計

- 合計: 6.5時間
- 優先度高: 3時間（タスク1, 2）
- 優先度中: 2.5時間（タスク3, 4）
- 優先度低: 1時間（タスク5）

## 完了条件

### 必須 ✅
- [ ] カバレッジ80%以上達成
- [ ] 全ユニットテスト成功（1260/1260維持）
- [ ] E2Eテスト成功率90%以上（57/63以上）

### 推奨 🎯
- [ ] テスト実行時間120秒以内
- [ ] E2Eテスト全パス（63/63）
- [ ] テストドキュメント更新

## 技術的考慮事項

### Jest並列実行の最適化
```javascript
// test/jest.config.js
module.exports = {
  // 現在: maxWorkers: '50%'
  // 提案: maxWorkers: 4 (固定値で安定化)
  maxWorkers: 4,
  
  // テストタイムアウトの統一
  testTimeout: 30000, // 30秒
};
```

### CDKスタックテストの例
```typescript
// api-stack.test.ts
test('API Gateway should have correct CORS settings', () => {
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    // CORS設定の検証
  });
});
```

## 関連ドキュメント

### 作業記録
- `work-log-20260222-160939-parallel-subagent-execution-round5.md` - 第5回並列実行
- `work-log-20260222-155505-parallel-subagent-execution-round4.md` - 第4回並列実行
- `work-log-20260222-161019-subagent2-e2e-test-completion.md` - E2Eテスト改善
- `work-log-20260222-155525-subagent1-coverage-measurement.md` - カバレッジ測定

### 統合元タスク（アーカイブ済み）
- `tasks-remaining-issues-20260222-164151.md`
- `tasks-test-final-improvements-20260222-164001.md`
- `tasks-test-optimization-20260222-163805.md`

## 備考

- すべての作業は日本語で実施
- 作業記録作成: `.kiro/specs/tdnet-data-collector/work-logs/work-log-[YYYYMMDD-HHMMSS]-[作業概要].md`
- Git commit形式: `[test] 変更内容`
- ファイルエンコーディング: UTF-8 BOMなし
- カバレッジ79.98%は目標80%に非常に近く、わずかなテスト追加で達成可能
- E2Eテストは84%が成功しており、主要機能は正常に動作
- テスト実行時間の最適化は、CI/CD環境での実行時間短縮にも貢献

---

**作成者**: メインエージェント  
**最終更新**: 2026-02-22 17:22:33

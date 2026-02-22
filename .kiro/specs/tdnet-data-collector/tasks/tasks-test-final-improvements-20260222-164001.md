# テスト最終改善タスク

**作成日時**: 2026-02-22 16:40:01  
**優先度**: 中  
**関連作業記録**: `work-log-20260222-160939-parallel-subagent-execution-round5.md`

## 概要

全ユニットテスト（1260/1260）は成功しているが、カバレッジ目標（80%）未達成とE2Eテストの一部失敗を解決する。

## 現状

### ユニットテスト
- ✅ 全テスト成功: 1260/1260
- ⚠️ カバレッジ: 79.98%（目標80%まで-0.02%）
- ❌ テスト実行時間: 150秒以上（目標60秒）

### E2Eテスト
- 🔄 部分成功: 53/63テスト（84%）
- ❌ 失敗: 10件
  - collector: 1件（複数日処理タイムアウト）
  - collect-status: 1件（CORSヘッダー、コード修正済み）
  - その他: 8件（詳細調査必要）

## タスク一覧

### 1. カバレッジ80%達成 ⚠️

**優先度**: 中  
**見積**: 1-2時間

#### 1.1 テスト実行時間の最適化
- [ ] Jest並列実行設定の調整（`test/jest.config.js`の`maxWorkers`）
- [ ] 重いテストケースの特定（`--verbose`オプション使用）
- [ ] テストのモック化検討（外部API呼び出し部分）
- [ ] 目標: 60秒以内でカバレッジ測定完了

#### 1.2 CDKスタックテストの追加
- [ ] `cdk/lib/stacks/__tests__/api-stack.test.ts`の拡充
  - API Gateway設定のテスト
  - WAF設定のテスト
  - API Key/Usage Plan設定のテスト
- [ ] `cdk/lib/stacks/__tests__/compute-stack.test.ts`の拡充
  - Lambda関数定義のテスト
  - DLQ設定のテスト
  - 環境変数設定のテスト

#### 1.3 カバレッジ測定の再実行
- [ ] `npm run test:coverage`実行
- [ ] 80%以上達成確認
- [ ] カバレッジレポート確認（`test/coverage/index.html`）

### 2. E2Eテスト全パス達成 🔄

**優先度**: 中  
**見積**: 1-2時間

#### 2.1 collect-status CORSヘッダーテスト
- [ ] E2Eテスト再実行（コード修正済み）
- [ ] テストパス確認

#### 2.2 collector複数日処理タイムアウト対策
- [ ] オプション1: タイムアウトを180秒に延長
- [ ] オプション2: テスト範囲を1日に縮小
- [ ] オプション3: TDnetスクレイピング部分のモック化
- [ ] 推奨: オプション2（テスト範囲縮小）

#### 2.3 その他の失敗テスト調査
- [ ] 失敗テスト8件の詳細確認
- [ ] 原因特定と修正
- [ ] テストパス確認

#### 2.4 全E2Eテスト再実行
- [ ] Docker Desktop起動確認: `docker ps`
- [ ] LocalStack環境確認: `docker ps --filter "name=localstack"`
- [ ] 全E2Eテスト実行: `npm run test:e2e`
- [ ] 全テストパス確認

### 3. テスト安定化 📋

**優先度**: 低  
**見積**: 1時間

#### 3.1 テストタイムアウト設定の統一
- [ ] E2Eテストのタイムアウト設定を統一
- [ ] 推奨値: 120秒（2分）
- [ ] 長時間テストは個別に設定

#### 3.2 テストヘルパー関数の整理
- [ ] モックイベント作成関数の統一
- [ ] テストデータ生成関数の共通化
- [ ] `src/__tests__/test-helpers/`に配置

#### 3.3 テストドキュメントの更新
- [ ] テスト実行手順の更新
- [ ] トラブルシューティングガイドの追加
- [ ] CI/CD環境でのテスト実行方法の記載

## 完了条件

### 必須
- [ ] カバレッジ80%以上達成
- [ ] 全ユニットテスト成功（1260/1260維持）
- [ ] E2Eテスト成功率90%以上（57/63以上）

### 推奨
- [ ] テスト実行時間60秒以内
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

### E2Eテストのモック化
```typescript
// TDnetスクレイピング部分のモック化例
jest.mock('../../scraper/html-parser', () => ({
  scrapeTdnetList: jest.fn().mockResolvedValue([
    // モックデータ
  ]),
}));
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

## 関連ファイル

### テスト設定
- `test/jest.config.js` - Jest設定
- `jest.config.js` - ルートJest設定

### E2Eテスト
- `src/lambda/collector/__tests__/handler.e2e.test.ts`
- `src/lambda/collect-status/__tests__/handler.e2e.test.ts`
- `src/lambda/dlq-processor/__tests__/handler.e2e.test.ts`
- `src/lambda/export/__tests__/handler.e2e.test.ts`
- `src/lambda/query/__tests__/handler.e2e.test.ts`

### CDKスタックテスト
- `cdk/lib/stacks/__tests__/api-stack.test.ts`
- `cdk/lib/stacks/__tests__/compute-stack.test.ts`
- `cdk/lib/stacks/__tests__/foundation-stack.test.ts`
- `cdk/lib/stacks/__tests__/monitoring-stack.test.ts`

## 参考

### 前回の作業記録
- `work-log-20260222-160939-parallel-subagent-execution-round5.md` - 第5回並列実行
- `work-log-20260222-155505-parallel-subagent-execution-round4.md` - 第4回並列実行
- `work-log-20260222-161019-subagent2-e2e-test-completion.md` - E2Eテスト改善

### 関連タスク
- `tasks-improvements-20260222-144911.md` - 改善タスク（アーカイブ予定）
- `tasks-e2e-test-fixes.md` - E2Eテスト修正タスク

## 備考

- カバレッジ79.98%は目標80%に非常に近く、わずかなテスト追加で達成可能
- E2Eテストは84%が成功しており、主要機能は正常に動作
- テスト実行時間の最適化は、CI/CD環境での実行時間短縮にも貢献
- 全ユニットテスト成功を維持しながら、カバレッジとE2Eテストを改善することが重要

---

**作成者**: メインエージェント  
**最終更新**: 2026-02-22 16:40:01

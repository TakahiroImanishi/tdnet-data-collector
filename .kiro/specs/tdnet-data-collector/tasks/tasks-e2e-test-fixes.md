# E2Eテスト問題修正タスク

**作成日時**: 2026-02-22 15:55:34  
**優先度**: 高  
**関連作業記録**: `work-log-20260222-155534-subagent2-e2e-test-fixes.md`

## 概要
E2Eテストの20個の失敗を修正し、全テストをパスさせる。

## 完了したタスク

### 1. TypeScriptコンパイルエラーの修正 ✅
- [x] collector: 未使用変数 `CollectorResponse` を削除
- [x] collect-status: 不完全なテストケースを完成
- [x] dlq-processor: 未使用の `SQSRecord` インポートを削除

### 2. requestContext未定義エラーの修正 ✅
- [x] Export Handlerテストに `createMockExportEvent` ヘルパー関数を作成
- [x] 全イベントモック（17箇所）に `requestContext` を追加

### 3. APIキー認証の実装 ✅
- [x] Export Handlerに `validateApiKey` 関数を実装
- [x] Export/Query Handlerから `TEST_ENV` 条件を削除

## 残存問題

### 4. dlq-processorのSQSRecord型エラー修正 ⚠️
- [ ] `createMockSQSEvent`関数のSQSRecordAttributes型を修正
- [ ] `ApproximateReceiveCount`, `SentTimestamp`, `SenderId`, `ApproximateFirstReceiveTimestamp`を正しい型で設定

### 5. Export/Query Handlerの認証テスト確認 ⚠️
- [ ] 残りの認証テストが失敗している原因を調査
- [ ] 必要に応じてテストまたは実装を修正

### 6. 全E2Eテスト実行 ⚠️
- [ ] Docker Desktop起動確認
- [ ] LocalStack環境起動
- [ ] 全E2Eテスト実行: `npm run test:e2e`
- [ ] 全テストパスを確認

## 成果物
- 修正済みファイル: 5ファイル
- 解決した問題: TypeScriptエラー、requestContext未定義、APIキー認証実装
- 残存問題: dlq-processor型エラー、一部の認証テスト

## 参考
- 以前の作業記録: `work-log-20260222-155011-subagent2-e2e-test-execution.md`
- E2Eテスト結果: 8/28成功、20失敗 → 改善中

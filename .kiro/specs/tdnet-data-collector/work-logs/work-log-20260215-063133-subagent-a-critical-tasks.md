# 作業記録: タスク31.3.1-31.3.4実行（Critical優先度）

**作成日時**: 2026-02-15 06:31:33  
**担当**: Subagent A  
**タスク**: 設計と実装の整合性修正（Phase 1: Critical）

## 実行タスク

### 31.3.1 Disclosureモデルのフィールド修正（Critical）
- [ ] `pdf_url` と `s3_key` をオプショナルに変更
- [ ] `s3_key` → `pdf_s3_key` にリネーム
- [ ] `collected_at` → `downloaded_at` にリネーム
- [ ] `src/models/disclosure.ts` のフィールド定義修正
- [ ] `src/types/index.ts` の型定義修正
- [ ] 全Lambda関数でフィールド名の変更に対応
- [ ] DynamoDBデータ移行スクリプト作成
- [ ] ユニットテスト更新
- [ ] E2Eテスト更新

### 31.3.2 CloudWatch Logsの保持期間設定（Critical）
- [ ] `cdk/lib/stacks/monitoring-stack.ts` にLogGroup追加
- [ ] 9個のLambda関数のログ保持期間を設定
- [ ] RemovalPolicy設定
- [ ] CDKテスト追加

### 31.3.3 WAF Construct分離（Critical）
- [ ] `cdk/lib/constructs/waf.ts` を新規作成
- [ ] `api-stack.ts` からWAF設定を移動
- [ ] CDKテスト追加

### 31.3.4 DynamoDBスキーマドキュメント化（Critical）
- [ ] `docs/database-schema.md` を作成

## 作業ログ

### 開始時刻: 06:31:33


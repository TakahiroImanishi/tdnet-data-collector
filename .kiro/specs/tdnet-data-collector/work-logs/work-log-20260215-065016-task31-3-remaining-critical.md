# タスク31.3残りのCriticalタスク完了作業

**作業日時**: 2026-02-15 06:50:16  
**担当**: メインエージェント  
**タスク**: 31.3.1〜31.3.4（Critical優先度）

## 作業概要

タスク31.3（設計と実装の整合性修正）の残り4つのCriticalタスクを完了させる。

### 未完了タスク

1. **31.3.1 Disclosureモデルのフィールド修正**
   - `pdf_url` と `s3_key` をオプショナルに変更
   - `s3_key` → `pdf_s3_key` にリネーム
   - `collected_at` → `downloaded_at` にリネーム
   - DynamoDBデータ移行スクリプト作成
   - 推定工数: 8-12時間
   - 破壊的変更: 既存データの移行が必要

2. **31.3.2 CloudWatch Logsの保持期間設定**
   - 9個のLambda関数のログ保持期間を設定
   - 推定工数: 2-3時間

3. **31.3.3 WAF Construct分離**
   - `cdk/lib/constructs/waf.ts` を新規作成
   - 推定工数: 3-4時間

4. **31.3.4 DynamoDBスキーマドキュメント化**
   - `docs/database-schema.md` を作成
   - 推定工数: 1-2時間

## サブエージェント並列実行計画

### サブエージェントF（31.3.1〜31.3.2）
- Disclosureモデルのフィールド修正
- CloudWatch Logsの保持期間設定

### サブエージェントG（31.3.3〜31.3.4）
- WAF Construct分離
- DynamoDBスキーマドキュメント化

## 実施内容


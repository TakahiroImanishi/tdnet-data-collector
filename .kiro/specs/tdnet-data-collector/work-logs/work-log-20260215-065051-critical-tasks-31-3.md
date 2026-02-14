# 作業記録: タスク31.3.1〜31.3.2実施

**作成日時**: 2026-02-15 06:50:51  
**作業概要**: Disclosureモデルフィールド修正とCloudWatch Logs保持期間設定

## タスク概要

### タスク31.3.1: Disclosureモデルのフィールド修正
- `pdf_url` をオプショナルに変更
- `s3_key` → `pdf_s3_key` にリネーム（オプショナル）
- `collected_at` → `downloaded_at` にリネーム（オプショナル）
- 全Lambda関数の対応
- データ移行スクリプト作成
- テスト更新

### タスク31.3.2: CloudWatch Logsの保持期間設定
- 9個のLambda関数のログ保持期間設定
- 本番環境: Collector=3ヶ月、その他=1ヶ月
- 開発環境: 1週間
- RemovalPolicy設定

## 実施内容


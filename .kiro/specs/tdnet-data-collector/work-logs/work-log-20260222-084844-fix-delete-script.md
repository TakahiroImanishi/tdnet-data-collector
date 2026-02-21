# 作業記録: データ削除スクリプト修正

**作業日時**: 2026-02-22 08:48:44  
**作業者**: Kiro AI  
**タスク**: データ削除スクリプトの修正

## 作業概要

`scripts/delete-all-data.ps1`の問題を特定して修正。

## 問題分析

現在のスクリプトの問題点：

1. **DynamoDBスキャン結果の処理エラー**
   - `$items.Items.Count`が正しく取得できない可能性
   - スキャン結果が空の場合のハンドリング不足

2. **バッチ削除の非効率性**
   - 1件ずつ削除しているため大量データで時間がかかる
   - DynamoDB BatchWriteItemを使用していない

3. **エラーハンドリング不足**
   - テーブルやバケットが存在しない場合の処理が不十分
   - 部分的失敗時の継続処理が不明確

4. **S3削除の問題**
   - `aws s3 rm --recursive`の出力が`--output text`で抑制されている
   - 削除進捗が見えにくい

## 実施内容

### 1. DynamoDB削除処理の改善

- スキャン結果の安全な処理
- BatchWriteItemによる効率的な削除（最大25件/バッチ）
- エラーハンドリングの強化

### 2. S3削除処理の改善

- バケット存在確認の追加
- 削除進捗の可視化
- エラー時の詳細メッセージ

### 3. エンコーディング対応

- UTF-8 BOMなしで保存（PowerShellガイドライン準拠）

## 成果物

- `scripts/delete-all-data.ps1`: 修正版スクリプト

## テスト

実行コマンド:
```powershell
# ドライラン（確認のみ）
.\scripts\delete-all-data.ps1 -Environment prod

# 強制実行
.\scripts\delete-all-data.ps1 -Environment prod -Force
```

## 申し送り

- 本番環境での実行前に必ずバックアップを取得すること
- 大量データ（1000件以上）の場合は時間がかかる可能性あり
- DynamoDB BatchWriteItemは最大25件/バッチの制限あり

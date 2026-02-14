---
inclusion: fileMatch
fileMatchPattern: "scripts/{fetch-data-range,manual-data-collection,migrate-disclosure-fields}.*"
---

# データ操作スクリプト

本番環境データ操作用スクリプトの使用ガイド。

## fetch-data-range.ps1

**目的**: 本番APIから特定日付範囲のデータを取得・検証

**パラメータ**:
- `-Date` (必須): 取得日付 (YYYY-MM-DD)
- `-Offset` (任意): 開始位置 (デフォルト: 0)
- `-Limit` (任意): 取得件数 (デフォルト: 100)

**使用例**:
```powershell
# 2024-01-15の最初の100件
.\scripts\fetch-data-range.ps1 -Date "2024-01-15"

# 101件目から200件目まで
.\scripts\fetch-data-range.ps1 -Date "2024-01-15" -Offset 100 -Limit 100
```

**出力**: `data-{Date}-offset{Offset}-limit{Limit}.json`

## manual-data-collection.ps1

**目的**: 本番環境で手動データ収集を実行・監視

**パラメータ**:
- `-StartDate` (任意): 開始日 (デフォルト: 昨日)
- `-EndDate` (任意): 終了日 (デフォルト: 今日)
- `-MaxItems` (任意): 最大収集件数 (デフォルト: 10)

**使用例**:
```powershell
# 昨日から今日までのデータを10件収集
.\scripts\manual-data-collection.ps1

# 特定期間のデータを100件収集
.\scripts\manual-data-collection.ps1 -StartDate "2024-01-01" -EndDate "2024-01-31" -MaxItems 100
```

**処理フロー**:
1. `/collect` APIでデータ収集開始
2. 5秒間隔で実行状態をポーリング (最大5分)
3. 収集結果を確認・表示
4. 最終サマリーを出力

## migrate-disclosure-fields.ts

**目的**: DynamoDBフィールド名変更時のデータ移行

**移行内容**:
- `s3_key` → `pdf_s3_key`
- `collected_at` → `downloaded_at`

**パラメータ**:
- `--table-name` (必須): DynamoDBテーブル名
- `--dry-run` (任意): 実行せず変更内容のみ表示

**使用例**:
```bash
# 開発環境でドライラン
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-dev --dry-run

# 本番環境で実行
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-prod
```

**処理内容**:
- テーブル全体をスキャン
- 旧フィールド存在時に新フィールドへコピー
- 旧フィールドを削除
- 100件ごとに進捗表示

## 本番環境使用時の注意事項

### 共通
- [ ] 実行前にバックアップ確認
- [ ] 本番APIキー・エンドポイント確認
- [ ] 実行時刻を記録（トラブルシューティング用）

### fetch-data-range.ps1
- [ ] レート制限考慮（大量取得時は間隔を空ける）
- [ ] 取得データの機密性確認（ローカル保存時）

### manual-data-collection.ps1
- [ ] CloudWatch Logsで実行状態を並行監視
- [ ] タイムアウト時はCloudWatch Logsで詳細確認
- [ ] 失敗件数が多い場合は原因調査

### migrate-disclosure-fields.ts
- [ ] **必ず--dry-runで事前確認**
- [ ] DynamoDBバックアップ取得済み確認
- [ ] 本番実行は低トラフィック時間帯推奨
- [ ] 実行中はCloudWatchメトリクス監視
- [ ] WCU消費量に注意（大量データ時）

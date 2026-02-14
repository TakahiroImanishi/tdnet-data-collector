---
inclusion: fileMatch
fileMatchPattern: "scripts/{fetch-data-range,manual-data-collection,migrate-disclosure-fields}.*"
---

# データ操作スクリプト

## fetch-data-range.ps1

本番APIからデータ取得・検証

```powershell
.\scripts\fetch-data-range.ps1 -Date "2024-01-15" [-Offset 0] [-Limit 100]
```

出力: `data-{Date}-offset{Offset}-limit{Limit}.json`

## manual-data-collection.ps1

本番環境で手動データ収集

```powershell
.\scripts\manual-data-collection.ps1 [-StartDate "昨日"] [-EndDate "今日"] [-MaxItems 10]
```

処理: `/collect` API実行 → 5秒間隔ポーリング（最大5分） → 結果表示

## migrate-disclosure-fields.ts

DynamoDBフィールド移行（`s3_key`→`pdf_s3_key`, `collected_at`→`downloaded_at`）

```bash
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-dev [--dry-run]
```

## 本番実行チェックリスト

- [ ] バックアップ確認
- [ ] APIキー・エンドポイント確認
- [ ] 実行時刻記録
- [ ] CloudWatch Logs監視（manual-data-collection.ps1）
- [ ] `--dry-run`事前確認（migrate-disclosure-fields.ts）
- [ ] 低トラフィック時間帯実行（migrate-disclosure-fields.ts）

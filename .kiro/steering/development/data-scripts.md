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

### APIキー取得方法

スクリプトは以下の順序でAPIキーを取得します：

1. **環境変数**: `$env:TDNET_API_KEY`
2. **Secrets Manager**: `/tdnet/api-key-prod`（環境変数が未設定の場合）

#### 環境変数の設定

```powershell
# 一時的に設定（現在のセッションのみ）
$env:TDNET_API_KEY = "your-api-key"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
```

#### エラー対処方法

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| SECRET_NOT_FOUND | Secrets Managerにシークレット未登録 | `.\scripts\register-api-key.ps1 -Environment prod` を実行 |
| ACCESS_DENIED | IAM権限不足 | `secretsmanager:GetSecretValue` 権限を付与 |
| NETWORK_ERROR | ネットワーク接続エラー | ネットワーク接続とAWS CLI設定を確認 |

## manual-data-collection.ps1

本番環境で手動データ収集

```powershell
.\scripts\manual-data-collection.ps1 [-StartDate "昨日"] [-EndDate "今日"] [-MaxItems 10]
```

処理: `/collect` API実行 → 5秒間隔ポーリング（最大5分） → 結果表示

### APIキー取得方法

スクリプトは以下の順序でAPIキーを取得します：

1. **環境変数**: `$env:TDNET_API_KEY`
2. **Secrets Manager**: `/tdnet/api-key-prod`（環境変数が未設定の場合）

#### 環境変数の設定

```powershell
# 一時的に設定（現在のセッションのみ）
$env:TDNET_API_KEY = "your-api-key"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("TDNET_API_KEY", "your-api-key", "User")
```

#### エラー対処方法

| エラー種別 | 原因 | 対処方法 |
|-----------|------|---------|
| SECRET_NOT_FOUND | Secrets Managerにシークレット未登録 | `.\scripts\register-api-key.ps1 -Environment prod` を実行 |
| ACCESS_DENIED | IAM権限不足 | `secretsmanager:GetSecretValue` 権限を付与 |
| NETWORK_ERROR | ネットワーク接続エラー | ネットワーク接続とAWS CLI設定を確認 |

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

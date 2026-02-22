---
inclusion: fileMatch
fileMatchPattern: "scripts/{fetch-data-range,manual-data-collection,migrate-disclosure-fields,check-step-functions-execution,cancel-step-functions-execution}.*"
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

本番環境で手動データ収集（Step Functions対応）

```powershell
.\scripts\manual-data-collection.ps1 [-StartDate "昨日"] [-EndDate "今日"] [-MaxItems 10]
```

処理: `/collect` API実行 → 5秒間隔ポーリング（最大30分） → 結果表示

**更新内容（タスク5.3）**:
- ポーリングタイムアウトを5分→30分に延長
- 進捗表示に経過時間を追加
- タイムアウト時に実行継続の可能性を通知

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

## check-step-functions-execution.ps1

Step Functions実行状態の確認（タスク5.3で追加）

```powershell
# 実行IDで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionId <実行ID>

# 実行ARNで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionArn <実行ARN>

# JSON形式で出力
.\scripts\check-step-functions-execution.ps1 -ExecutionId <実行ID> -Json
```

**機能**:
- 実行状態、進捗率、収集件数、失敗件数を表示
- 人間が読みやすい形式またはJSON形式で出力
- APIキー取得（環境変数 → Secrets Manager）

**出力項目**:
- 実行ID、状態、進捗率
- 収集件数、失敗件数
- 開始時刻、更新時刻、完了時刻（完了時のみ）
- エラーメッセージ（失敗時のみ）

## cancel-step-functions-execution.ps1

Step Functions実行のキャンセル（タスク5.3で追加）

```powershell
# 実行IDでキャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID>

# 実行ARNでキャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionArn <実行ARN>

# 確認プロンプトをスキップ
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID> -Force

# キャンセル理由を指定
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID> -Reason "誤実行のため"
```

**機能**:
- Step Functions実行のキャンセル
- 確認プロンプト（-Forceでスキップ可能）
- キャンセル理由の入力（オプション）
- エラー分類（実行が見つからない、既に停止、権限不足）

**安全機能**:
- デフォルトで確認プロンプトを表示
- キャンセル理由の記録
- エラー時の詳細なガイダンス

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

## Step Functions実行管理

### 実行状態の確認

```powershell
# 実行IDで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123

# JSON形式で出力（スクリプト連携用）
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123 -Json
```

### 実行のキャンセル

```powershell
# 確認プロンプト付きでキャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123

# 確認プロンプトをスキップ（自動化用）
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Force -Reason "自動キャンセル"
```

### トラブルシューティング

**タイムアウト時の対応**:
1. `check-step-functions-execution.ps1`で実行状態を確認
2. 実行が継続中の場合は待機
3. 必要に応じて`cancel-step-functions-execution.ps1`でキャンセル

**エラー時の対応**:
1. CloudWatch Logsで詳細なエラーログを確認
2. 実行状態がfailedの場合、error_messageを確認
3. 必要に応じて再実行

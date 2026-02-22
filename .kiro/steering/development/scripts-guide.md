---
inclusion: fileMatch
fileMatchPattern: 'scripts/**/*.ps1|scripts/**/*.ts'
---

# Scripts実装・運用ガイド

PowerShellスクリプトとTypeScriptスクリプトの実装・運用ガイドライン。

## 共通原則

### 1. エンコーディング
- **PowerShell**: UTF-8 BOM付き
- **TypeScript**: UTF-8 BOMなし
- **詳細**: `powershell-encoding-guidelines.md`, `../core/file-encoding-rules.md`

### 2. エラーハンドリング

**PowerShell**:
```powershell
$ErrorActionPreference = "Stop"

try {
    # 処理
} catch {
    Write-Error "エラー: $_"
    exit 1
}
```

**TypeScript**:
```typescript
try {
    // 処理
} catch (error) {
    console.error('エラー:', error);
    process.exit(1);
}
```

### 3. ログ出力

**PowerShell**:
```powershell
Write-Host "[INFO] 処理開始" -ForegroundColor Green
Write-Host "[ERROR] エラー発生" -ForegroundColor Red
```

**TypeScript**:
```typescript
console.log('[INFO] 処理開始');
console.error('[ERROR] エラー発生');
```

### 4. 環境変数検証

**PowerShell**:
```powershell
if (-not $env:AWS_REGION) {
    Write-Error "AWS_REGIONが設定されていません"
    exit 1
}
```

**TypeScript**:
```typescript
if (!process.env.AWS_REGION) {
    throw new Error('AWS_REGIONが設定されていません');
}
```

---

## デプロイスクリプト

### deploy-*.ps1

CDKスタックのデプロイ

```powershell
.\scripts\deploy-all.ps1 [-Environment dev|prod] [-Profile imanishi-awssso]
```

**実行フロー**: AWS認証確認 → CDKブートストラップ → スタックデプロイ → 出力表示

### deploy-dashboard.ps1

React製ダッシュボードをS3/CloudFront経由で配信

```powershell
.\scripts\deploy-dashboard.ps1 [-Environment dev|prod] [-SkipBuild]
```

**実行フロー**: AWS認証確認 → ビルド → S3アップロード → CloudFront Invalidation → URL表示

---

## セットアップスクリプト

### 実行順序

1. `create-api-key-secret.ps1` - Secrets ManagerにAPIキー作成
2. `generate-env-file.ps1` - .env.developmentファイル生成
3. `localstack-setup.ps1` - LocalStack環境構築（E2Eテスト用）

### create-api-key-secret.ps1

```powershell
.\scripts\create-api-key-secret.ps1 [-Region ap-northeast-1] [-SecretName /tdnet/api-key] [-ApiKey "key"] [-Force]
```

**前提**: `aws configure`実行済み

### generate-env-file.ps1

```powershell
.\scripts\generate-env-file.ps1 [-Region ap-northeast-1] [-OutputFile .env.development] [-Force]
```

**生成内容**: AWS_ACCOUNT_ID, AWS_REGION, DynamoDB/S3/Lambda設定

**前提**: `aws configure`実行済み

### localstack-setup.ps1

```powershell
docker compose up -d
.\scripts\localstack-setup.ps1
```

**作成リソース**: 
- DynamoDBテーブル（tdnet_disclosures, tdnet_executions, tdnet-export-status）
- S3バケット（pdfs-local, exports-local）

**前提**: Docker Desktop起動、LocalStackコンテナ起動

---

## データ操作スクリプト

### fetch-data-range.ps1

本番APIからデータ取得・検証

```powershell
.\scripts\fetch-data-range.ps1 -Date "2024-01-15" [-Offset 0] [-Limit 100]
```

**出力**: `data-{Date}-offset{Offset}-limit{Limit}.json`

### manual-data-collection.ps1

本番環境で手動データ収集（Step Functions対応）

```powershell
.\scripts\manual-data-collection.ps1 [-StartDate "昨日"] [-EndDate "今日"] [-MaxItems 10]
```

**処理**: `/collect` API実行 → 5秒間隔ポーリング（最大30分） → 結果表示

**更新内容（タスク5.3）**:
- ポーリングタイムアウトを5分→30分に延長
- 進捗表示に経過時間を追加
- タイムアウト時に実行継続の可能性を通知

### APIキー取得方法（共通）

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

### check-step-functions-execution.ps1

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

### cancel-step-functions-execution.ps1

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

### migrate-disclosure-fields.ts

DynamoDBフィールド移行（`s3_key`→`pdf_s3_key`, `collected_at`→`downloaded_at`）

```bash
npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-dev [--dry-run]
```

---

## 監視スクリプト

### check-iam-permissions.ps1

Lambda IAMロールの`cloudwatch:PutMetricData`権限確認

```powershell
.\scripts\check-iam-permissions.ps1 [-Environment prod] [-Region ap-northeast-1]
```

**確認内容**: Lambda関数存在 → IAMロール取得 → インライン/アタッチポリシー確認 → 結果表示

---

## 本番実行チェックリスト

### データ操作スクリプト実行前
- [ ] バックアップ確認
- [ ] APIキー・エンドポイント確認
- [ ] 実行時刻記録
- [ ] CloudWatch Logs監視（manual-data-collection.ps1）
- [ ] `--dry-run`事前確認（migrate-disclosure-fields.ts）
- [ ] 低トラフィック時間帯実行（migrate-disclosure-fields.ts）

### デプロイスクリプト実行前
- [ ] AWS認証確認（`aws sts get-caller-identity`）
- [ ] 環境指定確認（dev/prod）
- [ ] バックアップ確認（本番環境）
- [ ] 実行時刻記録

---

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

---

## トラブルシューティング

### セットアップスクリプト

| エラー | 解決策 |
|--------|--------|
| AWS CLI not found | https://aws.amazon.com/cli/ からインストール |
| AWS credentials not configured | `aws configure` 実行 |
| LocalStack not running | `docker compose up -d` 実行 |
| Secret/File already exists | `-Force` オプション使用 |

### デプロイスクリプト

| エラー | 解決策 |
|--------|--------|
| AWS認証エラー | `aws sso login --profile imanishi-awssso` |
| S3バケット未存在 | `.\scripts\deploy-all.ps1` |
| ビルド失敗 | `dashboard/`で`npm install` |

### 監視スクリプト

| エラー | 解決策 |
|--------|--------|
| Lambda未存在 | `.\scripts\deploy-all.ps1 -Environment {env}` |
| 権限不足 | CDK再デプロイ（`MonitoredLambda` Construct使用） |

---

## 関連ドキュメント

- `powershell-encoding-guidelines.md` - PowerShellエンコーディング
- `../core/file-encoding-rules.md` - ファイルエンコーディング
- `../core/tdnet-implementation-rules.md` - 実装ルール
- `operation-checklist.md` - 運用チェックリスト

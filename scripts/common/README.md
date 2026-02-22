# 共通スクリプト

このディレクトリには、複数のスクリプトから使用される共通関数が含まれています。

## Get-TdnetApiKey.ps1

Secrets ManagerからTDnet APIキーを安全に取得する共通関数です。

### 機能

1. **Secrets Managerからの取得**: AWS Secrets Managerから環境別のAPIキーを取得
2. **キャッシュ機能**: スクリプト実行中の複数回呼び出しでもAPIコールを最小化
3. **環境変数フォールバック**: `TDNET_API_KEY`環境変数が設定されている場合は優先使用
4. **統一されたエラーハンドリング**: 詳細なエラーメッセージと対処方法を表示
5. **詳細ログ出力**: `-Verbose`オプションでデバッグ情報を表示

### 使用方法

#### 基本的な使用例

```powershell
# 本番環境のAPIキーを取得
try {
    $apiKey = .\scripts\common\Get-TdnetApiKey.ps1
    Write-Host "APIキー: $apiKey"
} catch {
    Write-Host "エラー: $($_.Exception.Message)"
    exit 1
}
```

#### 開発環境のAPIキーを取得

```powershell
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Environment dev
```

#### キャッシュを使用せずに取得

```powershell
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -NoCache
```

#### 詳細ログ付きで取得

```powershell
$apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Verbose
```

### パラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `Environment` | string | `prod` | 環境名（prod/dev）。Secrets Managerのシークレット名は `/tdnet/api-key-{Environment}` |
| `NoCache` | switch | - | キャッシュを使用せず、常にSecrets Managerから取得 |
| `Verbose` | switch | - | 詳細なログ出力を有効化 |

### フォールバック順序

1. **環境変数**: `TDNET_API_KEY`が設定されている場合は優先使用
2. **キャッシュ**: `-NoCache`未指定かつキャッシュ存在時
3. **Secrets Manager**: 上記が利用できない場合

### 前提条件

- AWS CLIがインストールされていること
- Secrets Managerへのアクセス権限（`secretsmanager:GetSecretValue`）
- Secrets Managerにシークレットが登録されていること

### エラーハンドリング

関数は以下のエラーを検出し、適切なメッセージを表示します：

1. **ResourceNotFoundException**: シークレットが見つからない
   - 対処方法: `.\scripts\register-api-key.ps1 -Environment {環境名}` を実行

2. **AccessDeniedException**: アクセス権限がない
   - 対処方法: IAMユーザー/ロールに `secretsmanager:GetSecretValue` 権限を付与

3. **JSONパースエラー**: シークレットの形式が不正
   - 対処方法: Secrets Managerのシークレット形式を確認

4. **api_keyフィールド不在**: シークレットに `api_key` フィールドがない
   - 対処方法: シークレットのJSON形式を修正

### 既存スクリプトでの使用例

#### manual-data-collection.ps1での使用

```powershell
# 既存のコード（置き換え前）
$secretJson = aws secretsmanager get-secret-value `
    --secret-id $SecretName `
    --region $Region `
    --query SecretString `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    throw "Secrets Manager接続失敗: $secretJson"
}

$secret = $secretJson | ConvertFrom-Json
$ApiKey = $secret.api_key

# 新しいコード（置き換え後）
try {
    $ApiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Environment prod
} catch {
    exit 1
}
```

#### fetch-data-range.ps1での使用

```powershell
# 既存のコード（置き換え前）
$secretJson = aws secretsmanager get-secret-value `
    --secret-id $SecretName `
    --region $Region `
    --query SecretString `
    --output text 2>&1

if ($LASTEXITCODE -ne 0) {
    throw "Secrets Manager connection failed: $secretJson"
}

$secret = $secretJson | ConvertFrom-Json
$ApiKey = $secret.api_key

# 新しいコード（置き換え後）
try {
    $ApiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Environment prod
} catch {
    exit 1
}
```

### テスト

```powershell
# 基本的なテスト
.\scripts\common\Get-TdnetApiKey.ps1 -Verbose

# 開発環境のテスト
.\scripts\common\Get-TdnetApiKey.ps1 -Environment dev -Verbose

# キャッシュなしのテスト
.\scripts\common\Get-TdnetApiKey.ps1 -NoCache -Verbose

# 環境変数フォールバックのテスト
$env:TDNET_API_KEY = "test-api-key"
.\scripts\common\Get-TdnetApiKey.ps1 -Verbose
Remove-Item Env:\TDNET_API_KEY
```

### セキュリティ考慮事項

1. **APIキーの保護**: 取得したAPIキーはメモリ内でのみ使用し、ファイルに保存しない
2. **ログ出力**: APIキーの値は標準出力に表示されないため、ログファイルに記録されない
3. **キャッシュ**: キャッシュはスクリプトスコープ変数に保存され、スクリプト終了時に破棄される
4. **エラーメッセージ**: エラーメッセージにAPIキーの値は含まれない

### パフォーマンス

- **初回呼び出し**: Secrets Manager APIコール（約200-500ms）
- **2回目以降**: キャッシュから取得（約1ms）
- **環境変数使用時**: 即座に取得（約0.1ms）

### 関連ドキュメント

- `tasks-api-key-management.md`: APIキー管理タスク
- `register-api-key.ps1`: APIキー登録スクリプト
- `security-best-practices.md`: セキュリティベストプラクティス

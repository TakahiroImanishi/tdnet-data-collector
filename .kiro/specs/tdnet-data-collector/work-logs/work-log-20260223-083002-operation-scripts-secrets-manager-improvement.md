# 作業記録: 運用スクリプトのSecrets Manager統合改善

**作業日時**: 2026-02-23 08:30:02
**作業者**: Kiro AI Assistant
**関連タスク**: タスク6.2（本番環境での動作確認）、タスク6.2.2（Secrets Manager APIキー取得の改善）

## 作業概要

運用スクリプト（`manual-data-collection.ps1`、`fetch-data-range.ps1`）のSecrets Manager API統合を改善し、より堅牢なエラーハンドリングと詳細なエラーメッセージを実装しました。

## 背景

前回のStep Functions実行テスト時に、Secrets Manager APIからのAPIキー取得でネットワークエラーが発生しました。既存の実装では以下の問題がありました：

1. **プロファイル指定の欠如**: AWS CLIコマンドにプロファイル指定が含まれていない
2. **エラー分類の不足**: AUTH_EXPIRED、INVALID_SECRET_FORMATなどのエラーが分類されていない
3. **エラーメッセージの不足**: 具体的な解決方法が提示されていない
4. **エラー出力のキャプチャ不足**: `2>&1`リダイレクトが正しく機能していない可能性

## 実装内容

### 1. APIキー取得関数の改善

#### 変更前
```powershell
function Get-ApiKeyWithRetry {
    param(
        [string]$SecretName,
        [string]$Region,
        [int]$MaxRetries = 3
    )
    
    # AWS CLIコマンド（プロファイル指定なし）
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    # エラー分類（3種類のみ）
    if ($secretJson -match "ResourceNotFoundException") {
        throw [System.Exception]::new("SECRET_NOT_FOUND")
    } elseif ($secretJson -match "AccessDeniedException") {
        throw [System.Exception]::new("ACCESS_DENIED")
    } else {
        throw [System.Exception]::new("NETWORK_ERROR")
    }
}
```

#### 変更後
```powershell
function Get-ApiKeyWithRetry {
    param(
        [string]$SecretName,
        [string]$Region,
        [string]$Profile,  # プロファイル指定追加
        [int]$MaxRetries = 3
    )
    
    # AWS CLIコマンド構築（プロファイル対応）
    $awsCmd = "aws secretsmanager get-secret-value --secret-id `"$SecretName`" --region $Region"
    if ($Profile) {
        $awsCmd += " --profile $Profile"
    }
    $awsCmd += " --query SecretString --output text"
    
    # エラー出力を変数にキャプチャ
    $ErrorActionPreference = 'Continue'
    $secretJson = Invoke-Expression $awsCmd 2>&1
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    
    # 成功時の検証
    if ($exitCode -eq 0 -and $secretJson -is [string]) {
        try {
            $secret = $secretJson | ConvertFrom-Json
            if ($secret.api_key) {
                return $secret.api_key
            } else {
                throw [System.Exception]::new("INVALID_SECRET_FORMAT")
            }
        } catch {
            throw [System.Exception]::new("INVALID_SECRET_FORMAT")
        }
    }
    
    # エラー分類（5種類に拡張）
    $errorMessage = $secretJson | Out-String
    if ($errorMessage -match "ResourceNotFoundException") {
        throw [System.Exception]::new("SECRET_NOT_FOUND")
    } elseif ($errorMessage -match "AccessDeniedException") {
        throw [System.Exception]::new("ACCESS_DENIED")
    } elseif ($errorMessage -match "ExpiredToken|InvalidClientTokenId") {
        throw [System.Exception]::new("AUTH_EXPIRED")  # 新規
    } elseif ($errorMessage -match "Could not connect|Network|Timeout|Connection") {
        throw [System.Exception]::new("NETWORK_ERROR")
    } else {
        throw [System.Exception]::new("UNKNOWN_ERROR:$errorMessage")
    }
}
```

### 2. エラーメッセージの改善

各エラー種別に対して、具体的な解決方法を提示するようにしました：

#### SECRET_NOT_FOUND
```powershell
Write-Host "原因: Secrets Managerにシークレットが登録されていません" -ForegroundColor Yellow
Write-Host "シークレット名: $SecretName" -ForegroundColor Gray
Write-Host ""
Write-Host "解決方法:" -ForegroundColor Cyan
Write-Host "1. 以下のコマンドでシークレットを登録してください:" -ForegroundColor White
Write-Host "   .\scripts\create-api-key-secret.ps1 -Environment $Environment" -ForegroundColor Gray
Write-Host ""
Write-Host "2. または、環境変数を設定してください:" -ForegroundColor White
Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
```

#### AUTH_EXPIRED（新規）
```powershell
Write-Host "原因: AWS認証が期限切れです" -ForegroundColor Yellow
Write-Host ""
Write-Host "解決方法:" -ForegroundColor Cyan
Write-Host "1. AWS SSOで再ログインしてください:" -ForegroundColor White
Write-Host "   aws sso login --profile $Profile" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 認証状態を確認してください:" -ForegroundColor White
Write-Host "   aws sts get-caller-identity --profile $Profile" -ForegroundColor Gray
```

#### NETWORK_ERROR
```powershell
Write-Host "原因: ネットワークエラー（最大リトライ回数に到達）" -ForegroundColor Yellow
Write-Host ""
Write-Host "解決方法:" -ForegroundColor Cyan
Write-Host "1. ネットワーク接続を確認してください:" -ForegroundColor White
Write-Host "   ping aws.amazon.com" -ForegroundColor Gray
Write-Host ""
Write-Host "2. AWS CLIの設定を確認してください:" -ForegroundColor White
Write-Host "   aws configure list --profile $Profile" -ForegroundColor Gray
Write-Host ""
Write-Host "3. リージョンエンドポイントへの接続を確認してください:" -ForegroundColor White
Write-Host "   Test-NetConnection secretsmanager.$Region.amazonaws.com -Port 443" -ForegroundColor Gray
Write-Host ""
Write-Host "4. または、環境変数を設定してください:" -ForegroundColor White
Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
```

#### INVALID_SECRET_FORMAT（新規）
```powershell
Write-Host "原因: シークレットの形式が不正です" -ForegroundColor Yellow
Write-Host ""
Write-Host "解決方法:" -ForegroundColor Cyan
Write-Host "1. シークレットの内容を確認してください:" -ForegroundColor White
Write-Host "   aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --profile $Profile" -ForegroundColor Gray
Write-Host ""
Write-Host "2. シークレットは以下の形式である必要があります:" -ForegroundColor White
Write-Host '   {"api_key": "your-api-key"}' -ForegroundColor Gray
```

### 3. 関数呼び出しの修正

両スクリプトで、`Get-ApiKeyWithRetry`関数呼び出し時に`-Profile`パラメータを追加：

```powershell
$ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region -Profile $Profile
```

## 改善効果

1. **エラー分類の詳細化**: 5種類のエラーを正確に分類
2. **プロファイル対応**: AWS SSOプロファイルを正しく使用
3. **エラーメッセージの改善**: 具体的な解決方法を提示
4. **堅牢性の向上**: エラー出力のキャプチャを改善

## エラーハンドリングパターンへの準拠

`error-handling-patterns.md`に従って実装：

- **Retryable**: NETWORK_ERROR（指数バックオフで3回リトライ）
- **Non-Retryable**: SECRET_NOT_FOUND、ACCESS_DENIED、AUTH_EXPIRED、INVALID_SECRET_FORMAT（即座に失敗）

## 成果物

- `scripts/manual-data-collection.ps1`（更新）
- `scripts/fetch-data-range.ps1`（更新）

## 次のステップ

1. Git commit
2. Step Functions実行テストを再実行（2026-02-20の小規模データ）
3. 実行状態の監視
4. タスク6.2の完了

## 申し送り事項

- 他の運用スクリプト（`check-step-functions-execution.ps1`、`cancel-step-functions-execution.ps1`）も同様の改善が必要な場合は、別タスクで対応
- ネットワークエラーが継続する場合は、環境変数`$env:TDNET_API_KEY`を使用することで回避可能

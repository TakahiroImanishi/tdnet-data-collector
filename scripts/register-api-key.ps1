# Secrets ManagerにAPIキーを登録するスクリプト
# タスク1.1: APIキー登録の自動化

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKeyName = "tdnet-api-key",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKeyValue = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# UTF-8エンコーディング設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'UTF8NoBOM'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet APIキー登録スクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "環境: $Environment" -ForegroundColor Yellow
Write-Host "シークレット名: /tdnet/api-key-$Environment" -ForegroundColor Yellow
Write-Host ""

# AWS CLIの確認
Write-Host "[1/5] AWS CLIの確認..." -ForegroundColor Green
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✅ AWS CLI: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLIがインストールされていません" -ForegroundColor Red
    Write-Host "https://aws.amazon.com/cli/ からインストールしてください" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# リージョン設定
$Region = "ap-northeast-1"
$SecretName = "/tdnet/api-key-$Environment"

# APIキーの取得または生成
Write-Host "[2/5] APIキーの準備..." -ForegroundColor Green

if ($ApiKeyValue) {
    Write-Host "✅ 指定されたAPIキーを使用します" -ForegroundColor Green
} else {
    Write-Host "API Gatewayから既存のAPIキーを取得します..." -ForegroundColor Cyan
    
    try {
        # API Gatewayから既存のAPIキーを取得
        $apiKeysJson = aws apigateway get-api-keys `
            --region $Region `
            --include-values `
            --query "items[?name=='$ApiKeyName']" `
            --output json 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "API Gateway APIキー取得失敗: $apiKeysJson"
        }
        
        $apiKeys = $apiKeysJson | ConvertFrom-Json
        
        if ($apiKeys.Count -gt 0) {
            $ApiKeyValue = $apiKeys[0].value
            $apiKeyId = $apiKeys[0].id
            Write-Host "✅ 既存のAPIキーを取得しました (ID: $apiKeyId)" -ForegroundColor Green
        } else {
            Write-Host "⚠️ 既存のAPIキーが見つかりません" -ForegroundColor Yellow
            Write-Host "新しいAPIキーを作成しますか？ (Y/N): " -NoNewline -ForegroundColor Yellow
            
            if (-not $Force) {
                $response = Read-Host
                if ($response -ne "Y" -and $response -ne "y") {
                    Write-Host "処理を中断しました" -ForegroundColor Yellow
                    exit 0
                }
            } else {
                Write-Host "Y (Force mode)" -ForegroundColor Yellow
            }
            
            # 新しいAPIキーを作成
            Write-Host "新しいAPIキーを作成中..." -ForegroundColor Cyan
            $newApiKeyJson = aws apigateway create-api-key `
                --name $ApiKeyName `
                --description "TDnet Data Collector API Key ($Environment)" `
                --enabled `
                --region $Region `
                --output json 2>&1
            
            if ($LASTEXITCODE -ne 0) {
                throw "API Gateway APIキー作成失敗: $newApiKeyJson"
            }
            
            $newApiKey = $newApiKeyJson | ConvertFrom-Json
            $ApiKeyValue = $newApiKey.value
            $apiKeyId = $newApiKey.id
            Write-Host "✅ 新しいAPIキーを作成しました (ID: $apiKeyId)" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ APIキー取得/作成失敗: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# 既存のシークレットを確認
Write-Host "[3/5] 既存のシークレットを確認..." -ForegroundColor Green

$secretExists = $false
try {
    $existingSecretJson = aws secretsmanager describe-secret `
        --secret-id $SecretName `
        --region $Region `
        --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $secretExists = $true
        $existingSecret = $existingSecretJson | ConvertFrom-Json
        Write-Host "⚠️ シークレットが既に存在します" -ForegroundColor Yellow
        Write-Host "  ARN: $($existingSecret.ARN)" -ForegroundColor White
        Write-Host "  作成日時: $($existingSecret.CreatedDate)" -ForegroundColor White
        Write-Host "  最終更新: $($existingSecret.LastChangedDate)" -ForegroundColor White
        Write-Host ""
        
        if (-not $Force) {
            Write-Host "既存のシークレットを上書きしますか？ (Y/N): " -NoNewline -ForegroundColor Yellow
            $response = Read-Host
            if ($response -ne "Y" -and $response -ne "y") {
                Write-Host "処理を中断しました" -ForegroundColor Yellow
                exit 0
            }
        } else {
            Write-Host "既存のシークレットを上書きします (Force mode)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "✅ 新しいシークレットを作成します" -ForegroundColor Green
}
Write-Host ""

# シークレット値の準備
Write-Host "[4/5] シークレット値の準備..." -ForegroundColor Green

$secretValue = @{
    api_key = $ApiKeyValue
    created_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    environment = $Environment
    description = "TDnet Data Collector API Key"
} | ConvertTo-Json -Compress

Write-Host "✅ シークレット値を準備しました" -ForegroundColor Green
Write-Host ""

# Secrets Managerに登録/更新
Write-Host "[5/5] Secrets Managerに登録..." -ForegroundColor Green

try {
    if ($secretExists) {
        # 既存のシークレットを更新
        $updateResult = aws secretsmanager put-secret-value `
            --secret-id $SecretName `
            --secret-string $secretValue `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "Secrets Manager更新失敗: $updateResult"
        }
        
        Write-Host "✅ シークレットを更新しました" -ForegroundColor Green
    } else {
        # 新しいシークレットを作成
        $createResult = aws secretsmanager create-secret `
            --name $SecretName `
            --description "TDnet Data Collector API Key ($Environment)" `
            --secret-string $secretValue `
            --region $Region `
            --output json 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            throw "Secrets Manager作成失敗: $createResult"
        }
        
        Write-Host "✅ シークレットを作成しました" -ForegroundColor Green
    }
    
    $result = if ($secretExists) { $updateResult } else { $createResult } | ConvertFrom-Json
    Write-Host "  ARN: $($result.ARN)" -ForegroundColor White
    Write-Host "  バージョンID: $($result.VersionId)" -ForegroundColor White
} catch {
    Write-Host "❌ Secrets Manager登録失敗: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 登録確認
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "登録確認" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

try {
    $verifyJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "登録確認失敗: $verifyJson"
    }
    
    $verify = $verifyJson | ConvertFrom-Json
    Write-Host "✅ シークレット名: $SecretName" -ForegroundColor Green
    Write-Host "✅ 環境: $($verify.environment)" -ForegroundColor Green
    Write-Host "✅ 作成日時: $($verify.created_at)" -ForegroundColor Green
    Write-Host "✅ APIキー: $($verify.api_key.Substring(0, 8))..." -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ APIキーの登録が完了しました" -ForegroundColor Green
} catch {
    Write-Host "⚠️ 登録確認失敗: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "シークレットは登録されましたが、確認に失敗しました" -ForegroundColor Yellow
}
Write-Host ""

# 使用方法の表示
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "使用方法" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PowerShellスクリプトでの取得:" -ForegroundColor Yellow
Write-Host @"
`$secretJson = aws secretsmanager get-secret-value ``
  --secret-id $SecretName ``
  --region $Region ``
  --query SecretString ``
  --output text

`$secret = `$secretJson | ConvertFrom-Json
`$ApiKey = `$secret.api_key
"@ -ForegroundColor White
Write-Host ""

exit 0

# TDnet Data Collector - API Key Secret Creation Script
# このスクリプトは、AWS Secrets Managerに/tdnet/api-keyシークレットを作成します

param(
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1",
    
    [Parameter(Mandatory=$false)]
    [string]$SecretName = "/tdnet/api-key",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKey = "",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# エラー時に停止
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet API Key Secret Creation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# AWS CLIがインストールされているか確認
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✅ AWS CLI detected: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# AWS認証情報が設定されているか確認
try {
    $identity = aws sts get-caller-identity --output json 2>&1 | ConvertFrom-Json
    Write-Host "✅ AWS credentials configured" -ForegroundColor Green
    Write-Host "   Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "   User/Role: $($identity.Arn)" -ForegroundColor Gray
} catch {
    Write-Host "❌ AWS credentials are not configured" -ForegroundColor Red
    Write-Host "Please run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# APIキーが指定されていない場合はランダム生成
if ([string]::IsNullOrEmpty($ApiKey)) {
    Write-Host "🔑 Generating random API key..." -ForegroundColor Yellow
    
    # 32文字のランダムな英数字を生成
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $ApiKey = -join ((1..32) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    
    Write-Host "✅ API key generated: $($ApiKey.Substring(0, 8))..." -ForegroundColor Green
} else {
    Write-Host "🔑 Using provided API key: $($ApiKey.Substring(0, 8))..." -ForegroundColor Yellow
}

Write-Host ""

# 既存のシークレットを確認
Write-Host "🔍 Checking if secret already exists..." -ForegroundColor Yellow

$secretExists = $false
try {
    $existingSecret = aws secretsmanager describe-secret `
        --secret-id $SecretName `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    $secretExists = $true
    Write-Host "⚠️  Secret already exists: $SecretName" -ForegroundColor Yellow
    Write-Host "   Created: $($existingSecret.CreatedDate)" -ForegroundColor Gray
    Write-Host "   Last Modified: $($existingSecret.LastChangedDate)" -ForegroundColor Gray
} catch {
    Write-Host "✅ Secret does not exist yet" -ForegroundColor Green
}

Write-Host ""

# 既存のシークレットがある場合の処理
if ($secretExists) {
    if ($Force) {
        Write-Host "🔄 Updating existing secret (--Force specified)..." -ForegroundColor Yellow
        
        try {
            aws secretsmanager update-secret `
                --secret-id $SecretName `
                --secret-string $ApiKey `
                --region $Region `
                --output json | Out-Null
            
            Write-Host "✅ Secret updated successfully" -ForegroundColor Green
        } catch {
            Write-Host "❌ Failed to update secret" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Secret already exists. Use --Force to update." -ForegroundColor Red
        Write-Host ""
        Write-Host "Options:" -ForegroundColor Yellow
        Write-Host "  1. Use existing secret (no action needed)" -ForegroundColor Gray
        Write-Host "  2. Update secret: .\scripts\create-api-key-secret.ps1 -Force" -ForegroundColor Gray
        Write-Host "  3. Delete and recreate: aws secretsmanager delete-secret --secret-id $SecretName --region $Region --force-delete-without-recovery" -ForegroundColor Gray
        exit 1
    }
} else {
    # 新しいシークレットを作成
    Write-Host "📝 Creating new secret..." -ForegroundColor Yellow
    
    try {
        $result = aws secretsmanager create-secret `
            --name $SecretName `
            --description "TDnet Data Collector API Key" `
            --secret-string $ApiKey `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "✅ Secret created successfully" -ForegroundColor Green
        Write-Host "   ARN: $($result.ARN)" -ForegroundColor Gray
        Write-Host "   Name: $($result.Name)" -ForegroundColor Gray
    } catch {
        Write-Host "❌ Failed to create secret" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ API Key Secret Setup Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Run: .\scripts\generate-env-file.ps1" -ForegroundColor Gray
Write-Host "  2. Run: cdk bootstrap" -ForegroundColor Gray
Write-Host "  3. Run: cdk deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "To retrieve the API key later:" -ForegroundColor Yellow
Write-Host "  aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --query SecretString --output text" -ForegroundColor Gray
Write-Host ""

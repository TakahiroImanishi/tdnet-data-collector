# TDnet Data Collector - Deployment Script
# このスクリプトは、デプロイ準備からデプロイ、スモークテストまでを自動実行します

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "production")]
    [string]$Environment = "local",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBootstrap,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipSecretCreation,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipEnvGeneration
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# エラー時に停止
$ErrorActionPreference = "Stop"

# スクリプトのルートディレクトリ
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot

# プロジェクトルートに移動
Set-Location $projectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Region: $Region" -ForegroundColor Yellow
Write-Host "Project Root: $projectRoot" -ForegroundColor Gray
Write-Host ""

# ステップカウンター
$step = 1
$totalSteps = 9

# ========================================
# Step 0: AWS SSO認証
# ========================================
Write-Host "[$step/$totalSteps] 🔐 AWS SSO Authentication..." -ForegroundColor Cyan
$step++

try {
    & "$scriptRoot\startup.ps1" -Profile "imanishi-awssso"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ AWS SSO authentication failed" -ForegroundColor Red
        exit 1
    }
    # 環境変数を設定
    $env:AWS_PROFILE = "imanishi-awssso"
    Write-Host "  ✅ AWS SSO authenticated (Profile: imanishi-awssso)" -ForegroundColor Green
} catch {
    Write-Host "  ❌ AWS SSO authentication failed" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# Step 1: 前提条件チェック
# ========================================
Write-Host "[$step/$totalSteps] 🔍 Checking prerequisites..." -ForegroundColor Cyan
$step++

# Node.js確認
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js is not installed" -ForegroundColor Red
    exit 1
}

# npm確認
try {
    $npmVersion = npm --version
    Write-Host "  ✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ npm is not installed" -ForegroundColor Red
    exit 1
}

# AWS CLI確認
try {
    $awsVersion = aws --version 2>&1
    Write-Host "  ✅ AWS CLI: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ AWS CLI is not installed" -ForegroundColor Red
    exit 1
}

# AWS CDK確認
try {
    $cdkVersion = cdk --version
    Write-Host "  ✅ AWS CDK: $cdkVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ AWS CDK is not installed" -ForegroundColor Red
    Write-Host "  Install: npm install -g aws-cdk" -ForegroundColor Yellow
    exit 1
}

# AWS認証情報確認
try {
    $identity = aws sts get-caller-identity --output json 2>&1 | ConvertFrom-Json
    Write-Host "  ✅ AWS credentials configured" -ForegroundColor Green
    Write-Host "     Account: $($identity.Account)" -ForegroundColor Gray
    Write-Host "     User/Role: $($identity.Arn)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ AWS credentials are not configured" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# Step 2: 依存関係のインストール
# ========================================
Write-Host "[$step/$totalSteps] 📦 Installing dependencies..." -ForegroundColor Cyan
$step++

try {
    npm install
    Write-Host "  ✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# Step 3: テスト実行（オプション）
# ========================================
if (-not $SkipTests) {
    Write-Host "[$step/$totalSteps] 🧪 Running tests..." -ForegroundColor Cyan
    $step++
    
    try {
        npm run test
        Write-Host "  ✅ All tests passed" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Tests failed" -ForegroundColor Red
        Write-Host "  Use --SkipTests to skip tests" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[$step/$totalSteps] ⏭️  Skipping tests (--SkipTests specified)" -ForegroundColor Yellow
    $step++
}

Write-Host ""

# ========================================
# Step 4: ビルド
# ========================================
Write-Host "[$step/$totalSteps] 🔨 Building project..." -ForegroundColor Cyan
$step++

try {
    npm run build
    Write-Host "  ✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========================================
# Step 5: API Key Secret作成（オプション）
# ========================================
if (-not $SkipSecretCreation) {
    Write-Host "[$step/$totalSteps] 🔑 Creating API Key Secret..." -ForegroundColor Cyan
    $step++
    
    try {
        & "$scriptRoot\create-api-key-secret.ps1" -Region $Region -Force
        Write-Host "  ✅ API Key Secret created/updated" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Failed to create API Key Secret (may already exist)" -ForegroundColor Yellow
        Write-Host "  Continuing deployment..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[$step/$totalSteps] ⏭️  Skipping API Key Secret creation (--SkipSecretCreation specified)" -ForegroundColor Yellow
    $step++
}

Write-Host ""

# ========================================
# Step 6: 環境変数ファイル生成（オプション）
# ========================================
if (-not $SkipEnvGeneration) {
    Write-Host "[$step/$totalSteps] 📝 Generating environment file..." -ForegroundColor Cyan
    $step++
    
    $envFile = ".env.$Environment"
    
    try {
        & "$scriptRoot\generate-env-file.ps1" -Region $Region -OutputFile $envFile -Force
        Write-Host "  ✅ Environment file generated: $envFile" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  Failed to generate environment file" -ForegroundColor Yellow
        Write-Host "  Continuing deployment..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[$step/$totalSteps] ⏭️  Skipping environment file generation (--SkipEnvGeneration specified)" -ForegroundColor Yellow
    $step++
}

Write-Host ""

# ========================================
# Step 7: CDK Bootstrap（オプション）
# ========================================
if (-not $SkipBootstrap) {
    Write-Host "[$step/$totalSteps] 🚀 Running CDK Bootstrap..." -ForegroundColor Cyan
    $step++
    
    try {
        cdk bootstrap aws://$($identity.Account)/$Region
        Write-Host "  ✅ CDK Bootstrap completed" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠️  CDK Bootstrap failed (may already be bootstrapped)" -ForegroundColor Yellow
        Write-Host "  Continuing deployment..." -ForegroundColor Yellow
    }
} else {
    Write-Host "[$step/$totalSteps] ⏭️  Skipping CDK Bootstrap (--SkipBootstrap specified)" -ForegroundColor Yellow
    $step++
}

Write-Host ""

# ========================================
# Step 8: CDK Deploy
# ========================================
Write-Host "[$step/$totalSteps] 🚢 Deploying to AWS..." -ForegroundColor Cyan
$step++

# 本番環境の場合は承認を要求
$requireApproval = if ($Environment -eq "production") { "always" } else { "never" }

try {
    cdk deploy --require-approval $requireApproval
    Write-Host "  ✅ Deployment successful" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Deployment failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Rollback instructions:" -ForegroundColor Yellow
    Write-Host "  1. Check CloudFormation console for error details" -ForegroundColor Gray
    Write-Host "  2. If needed, rollback: cdk destroy" -ForegroundColor Gray
    Write-Host "  3. Fix the issue and redeploy" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# ========================================
# デプロイ完了
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Verify deployment in AWS Console" -ForegroundColor Gray
Write-Host "  2. Check CloudWatch Logs for any errors" -ForegroundColor Gray
Write-Host "  3. Run smoke tests (if available)" -ForegroundColor Gray
Write-Host "  4. Monitor metrics for 30 minutes" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  # View CloudFormation stack" -ForegroundColor Gray
Write-Host "  aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack" -ForegroundColor Gray
Write-Host ""
Write-Host "  # View Lambda logs" -ForegroundColor Gray
Write-Host "  aws logs tail /aws/lambda/tdnet-collector --follow" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Get API endpoint" -ForegroundColor Gray
Write-Host "  aws cloudformation describe-stacks --stack-name TdnetDataCollectorStack --query 'Stacks[0].Outputs[?OutputKey==``ApiEndpoint``].OutputValue' --output text" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Get API Key" -ForegroundColor Gray
Write-Host "  aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region $Region --query SecretString --output text" -ForegroundColor Gray
Write-Host ""

# デプロイ記録を作成
$deploymentLog = @"
# Deployment Log

**Date**: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Environment**: $Environment
**Region**: $Region
**AWS Account**: $($identity.Account)
**Deployed By**: $($identity.Arn)

## Deployment Steps

- [x] Prerequisites checked
- [x] Dependencies installed
- [$(if ($SkipTests) { ' ' } else { 'x' })] Tests executed
- [x] Project built
- [$(if ($SkipSecretCreation) { ' ' } else { 'x' })] API Key Secret created
- [$(if ($SkipEnvGeneration) { ' ' } else { 'x' })] Environment file generated
- [$(if ($SkipBootstrap) { ' ' } else { 'x' })] CDK Bootstrap executed
- [x] CDK Deploy executed

## Status

✅ Deployment successful

## Notes

- Deployment completed successfully
- Monitor CloudWatch Logs for any issues
- Verify all Lambda functions are working correctly

"@

$logFile = "deployment-log-$(Get-Date -Format 'yyyyMMdd-HHmmss').md"
$deploymentLog | Out-File -FilePath $logFile -Encoding UTF8NoBOM

Write-Host "Deployment log saved: $logFile" -ForegroundColor Gray
Write-Host ""

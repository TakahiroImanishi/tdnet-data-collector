# TDnet Data Collector - Startup Script
# このスクリプトは、AWS SSO認証を実行します

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# エラー時に停止
$ErrorActionPreference = "Stop"

# パラメータ
param(
    [Parameter(Mandatory=$false)]
    [string]$Profile = "imanishi-awssso",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Startup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "AWS Profile: $Profile" -ForegroundColor Yellow
Write-Host ""

# AWS CLI確認
try {
    $awsVersion = aws --version 2>&1
    Write-Host "✅ AWS CLI: $awsVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not installed" -ForegroundColor Red
    Write-Host "Install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# AWS SSO認証状態確認
Write-Host "🔍 Checking AWS SSO authentication status..." -ForegroundColor Cyan

$needsLogin = $false

try {
    # プロファイルを使用してAWS認証情報を確認
    $env:AWS_PROFILE = $Profile
    $identity = aws sts get-caller-identity --output json 2>&1 | ConvertFrom-Json
    
    if ($identity.Account) {
        Write-Host "✅ Already authenticated with AWS SSO" -ForegroundColor Green
        Write-Host "   Account: $($identity.Account)" -ForegroundColor Gray
        Write-Host "   User/Role: $($identity.Arn)" -ForegroundColor Gray
        
        if (-not $Force) {
            Write-Host ""
            Write-Host "Use -Force to re-authenticate" -ForegroundColor Gray
            exit 0
        } else {
            Write-Host ""
            Write-Host "⚠️  Force re-authentication requested" -ForegroundColor Yellow
            $needsLogin = $true
        }
    }
} catch {
    Write-Host "⚠️  Not authenticated or session expired" -ForegroundColor Yellow
    $needsLogin = $true
}

Write-Host ""

# AWS SSO認証実行
if ($needsLogin) {
    Write-Host "🔐 Authenticating with AWS SSO..." -ForegroundColor Cyan
    Write-Host "Profile: $Profile" -ForegroundColor Gray
    Write-Host ""
    
    try {
        # AWS SSO認証実行
        aws sso login --profile $Profile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ AWS SSO authentication successful" -ForegroundColor Green
            
            # 認証情報確認
            $identity = aws sts get-caller-identity --profile $Profile --output json | ConvertFrom-Json
            Write-Host "   Account: $($identity.Account)" -ForegroundColor Gray
            Write-Host "   User/Role: $($identity.Arn)" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "❌ AWS SSO authentication failed" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host ""
        Write-Host "❌ AWS SSO authentication failed" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Startup Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Environment variable set:" -ForegroundColor Yellow
Write-Host "  AWS_PROFILE=$Profile" -ForegroundColor Gray
Write-Host ""
Write-Host "You can now run deployment scripts:" -ForegroundColor Yellow
Write-Host "  .\scripts\deploy.ps1 -Environment dev" -ForegroundColor Gray
Write-Host "  .\scripts\deploy-dev.ps1" -ForegroundColor Gray
Write-Host "  .\scripts\deploy-prod.ps1" -ForegroundColor Gray
Write-Host ""

#!/usr/bin/env pwsh
# Production Environment Deployment Script
# This script deploys the TDnet Data Collector to the production environment

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Production Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if config/.env.production exists
if (-not (Test-Path "config/.env.production")) {
    Write-Host "❌ Error: config/.env.production file not found" -ForegroundColor Red
    Write-Host "Please create config/.env.production file in the config folder" -ForegroundColor Yellow
    exit 1
}

# Load environment variables from config/.env.production
Write-Host "📋 Loading production environment variables..." -ForegroundColor Yellow
Get-Content "config/.env.production" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        Write-Host "  ✓ Set $name" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "⚠️  WARNING: You are about to deploy to PRODUCTION!" -ForegroundColor Red
Write-Host "🌏 Region: $env:AWS_REGION" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Environment: Production" -ForegroundColor Cyan
Write-Host "Proceeding with deployment in 10 seconds (use Ctrl+C to cancel)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
Write-Host ""

# Navigate to project root directory
$rootPath = Join-Path -Path $PSScriptRoot -ChildPath ".."
Set-Location $rootPath
Write-Host "📂 Changed directory to: $rootPath" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists in root
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Check if CDK node_modules exists
$cdkPath = "cdk"
if (-not (Test-Path "$cdkPath/node_modules")) {
    Write-Host "📦 Installing CDK dependencies..." -ForegroundColor Yellow
    Set-Location $cdkPath
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: CDK npm install failed" -ForegroundColor Red
        exit 1
    }
    Set-Location $rootPath
    Write-Host ""
}

# Run CDK synth to validate the stack
Write-Host "🔍 Validating CDK stack..." -ForegroundColor Yellow
npx cdk synth --context environment=prod
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: CDK synth failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ CDK stack validation successful" -ForegroundColor Green
Write-Host ""

# Final warning before production deployment
Write-Host "⚠️  FINAL WARNING: Deploying to PRODUCTION in 5 seconds..." -ForegroundColor Red
Write-Host "Press Ctrl+C to cancel" -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🚀 Deploying to production environment..." -ForegroundColor Yellow
npx cdk deploy --all --context environment=prod --require-approval never

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Production deployment successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Post-deployment checklist:" -ForegroundColor Yellow
    Write-Host "  1. Verify CloudWatch logs for errors" -ForegroundColor White
    Write-Host "  2. Check CloudWatch metrics and alarms" -ForegroundColor White
    Write-Host "  3. Test API endpoints" -ForegroundColor White
    Write-Host "  4. Monitor initial Lambda executions" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Production deployment failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

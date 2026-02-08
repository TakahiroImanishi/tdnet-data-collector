#!/usr/bin/env pwsh
# Development Environment Deployment Script
# This script deploys the TDnet Data Collector to the development environment

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Development Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.development exists
if (-not (Test-Path ".env.development")) {
    Write-Host "❌ Error: .env.development file not found" -ForegroundColor Red
    Write-Host "Please create .env.development file in the project root" -ForegroundColor Yellow
    exit 1
}

# Load environment variables from .env.development
Write-Host "📋 Loading development environment variables..." -ForegroundColor Yellow
Get-Content ".env.development" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        Write-Host "  ✓ Set $name" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🔧 Environment: Development" -ForegroundColor Cyan
Write-Host "🌏 Region: $env:AWS_REGION" -ForegroundColor Cyan
Write-Host ""

# Navigate to CDK directory
$cdkPath = Join-Path $PSScriptRoot ".." "cdk"
if (-not (Test-Path $cdkPath)) {
    Write-Host "❌ Error: CDK directory not found at $cdkPath" -ForegroundColor Red
    exit 1
}

Set-Location $cdkPath
Write-Host "📂 Changed directory to: $cdkPath" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing CDK dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Run CDK synth to validate the stack
Write-Host "🔍 Validating CDK stack..." -ForegroundColor Yellow
npx cdk synth --context environment=dev
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: CDK synth failed" -ForegroundColor Red
    exit 1
}
Write-Host "✓ CDK stack validation successful" -ForegroundColor Green
Write-Host ""

# Deploy to development environment
Write-Host "🚀 Deploying to development environment..." -ForegroundColor Yellow
npx cdk deploy --context environment=dev --require-approval never

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Development deployment successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Development deployment failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

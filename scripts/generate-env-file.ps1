# TDnet Data Collector - Environment File Generation Script
# このスクリプトは、.env.developmentファイルを自動生成します

param(
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputFile = "config/.env.development",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Environment File Generation" -ForegroundColor Cyan
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
    Write-Host "   Region: $Region" -ForegroundColor Gray
} catch {
    Write-Host "❌ AWS credentials are not configured" -ForegroundColor Red
    Write-Host "Please run: aws configure" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# AWS Account IDを取得
$accountId = $identity.Account
Write-Host "📋 AWS Account ID: $accountId" -ForegroundColor Yellow

Write-Host ""

# 既存のファイルを確認
if (Test-Path $OutputFile) {
    if ($Force) {
        Write-Host "⚠️  Backing up existing file..." -ForegroundColor Yellow
        $backupFile = "$OutputFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $OutputFile $backupFile
        Write-Host "✅ Backup created: $backupFile" -ForegroundColor Green
    } else {
        Write-Host "❌ File already exists: $OutputFile" -ForegroundColor Red
        Write-Host "Use --Force to overwrite (existing file will be backed up)" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# .env.developmentファイルを生成
Write-Host "📝 Generating $OutputFile..." -ForegroundColor Yellow

$envContent = @"
# TDnet Data Collector - Development Environment Variables
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

# AWS Configuration
AWS_ACCOUNT_ID=$accountId
AWS_REGION=$Region

# DynamoDB Tables
DYNAMODB_TABLE_NAME=tdnet_disclosures
DYNAMODB_EXECUTIONS_TABLE=tdnet_executions
EXPORT_STATUS_TABLE_NAME=tdnet_export_status

# S3 Buckets
S3_BUCKET_NAME=tdnet-data-collector-pdfs-$accountId
EXPORT_BUCKET_NAME=tdnet-data-collector-exports-$accountId
DASHBOARD_BUCKET_NAME=tdnet-dashboard-$accountId
CLOUDTRAIL_LOGS_BUCKET_NAME=tdnet-cloudtrail-logs-$accountId

# Lambda Configuration
COLLECTOR_FUNCTION_NAME=tdnet-collector
QUERY_FUNCTION_NAME=tdnet-query
EXPORT_FUNCTION_NAME=tdnet-export
COLLECT_FUNCTION_NAME=tdnet-collect
COLLECT_STATUS_FUNCTION_NAME=tdnet-collect-status

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
NODE_OPTIONS=--enable-source-maps

# Scraping Configuration
SCRAPING_RATE_LIMIT=2
SCRAPING_MAX_RETRIES=3
SCRAPING_TIMEOUT=30000
SCRAPING_USER_AGENT=TDnet-Data-Collector/1.0
SCRAPING_CONCURRENCY=2

# Batch Processing
BATCH_SIZE=100
BATCH_DATE_RANGE_DAYS=7

# Cache Configuration
CACHE_ENABLED=true
CACHE_TTL=3600

# Error Handling
ERROR_THRESHOLD=10
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# API Configuration (Note: API_KEY is stored in Secrets Manager)
# To retrieve: aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region $Region --query SecretString --output text
"@

try {
    $envContent | Out-File -FilePath $OutputFile -Encoding UTF8NoBOM
    Write-Host "✅ Environment file generated successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to generate environment file" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Environment File Generation Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated file: $OutputFile" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review the generated file: $OutputFile" -ForegroundColor Gray
Write-Host "  2. Customize values if needed" -ForegroundColor Gray
Write-Host "  3. Run: cdk bootstrap" -ForegroundColor Gray
Write-Host "  4. Run: cdk deploy" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: API Key is stored in AWS Secrets Manager (/tdnet/api-key)" -ForegroundColor Yellow
Write-Host "To retrieve: aws secretsmanager get-secret-value --secret-id /tdnet/api-key --region $Region --query SecretString --output text" -ForegroundColor Gray
Write-Host ""

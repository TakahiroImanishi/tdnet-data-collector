# TDnet Data Collector - LocalStack Setup Script
# Purpose: Automatically create DynamoDB tables and S3 buckets in LocalStack
# Created: 2026-02-08

# ==========================================
# Configuration
# ==========================================
$ENDPOINT = "http://localhost:4566"
$REGION = "ap-northeast-1"

# ==========================================
# Color output functions
# ==========================================
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# ==========================================
# Check LocalStack availability
# ==========================================
Write-Info "Checking LocalStack availability..."

try {
    $response = Invoke-WebRequest -Uri "$ENDPOINT/_localstack/health" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Success "LocalStack is running"
} catch {
    Write-Error-Custom "LocalStack is not running. Please start it with: docker-compose up -d"
    exit 1
}

# ==========================================
# Create DynamoDB Tables
# ==========================================
Write-Info "Creating DynamoDB tables..."

# Table 1: tdnet_disclosures
Write-Info "Creating table: tdnet_disclosures"
try {
    # Delete existing table if it exists
    Write-Info "Checking if table 'tdnet_disclosures' exists..."
    $tableExists = $false
    try {
        aws --endpoint-url=$ENDPOINT `
            --region=$REGION `
            dynamodb describe-table `
            --table-name tdnet_disclosures `
            --no-cli-pager `
            2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $tableExists = $true
            Write-Warning-Custom "Table 'tdnet_disclosures' already exists. Deleting..."
            aws --endpoint-url=$ENDPOINT `
                --region=$REGION `
                dynamodb delete-table `
                --table-name tdnet_disclosures `
                --no-cli-pager `
                2>&1 | Out-Null
            
            Write-Info "Waiting for table deletion..."
            Start-Sleep -Seconds 3
            Write-Success "Table 'tdnet_disclosures' deleted"
        }
    } catch {
        # Table doesn't exist, continue
    }
    
    # Create table using JSON file
    Write-Info "Creating table 'tdnet_disclosures' with GSI..."
    $jsonPath = "scripts/dynamodb-tables/tdnet_disclosures.json"
    
    if (Test-Path $jsonPath) {
        aws --endpoint-url=$ENDPOINT `
            --region=$REGION `
            dynamodb create-table `
            --cli-input-json "file://$jsonPath" `
            --no-cli-pager `
            2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Table 'tdnet_disclosures' created successfully with GSI_CompanyCode_DiscloseDate and GSI_DatePartition"
        } else {
            Write-Error-Custom "Failed to create table 'tdnet_disclosures'"
        }
    } else {
        Write-Error-Custom "Table definition file not found: $jsonPath"
    }
} catch {
    Write-Warning-Custom "Failed to create table 'tdnet_disclosures': $_"
}

# Table 2: tdnet_executions
Write-Info "Creating table: tdnet_executions"
try {
    aws --endpoint-url=$ENDPOINT `
        --region=$REGION `
        dynamodb create-table `
        --table-name tdnet_executions `
        --attribute-definitions `
            AttributeName=execution_id,AttributeType=S `
            AttributeName=started_at,AttributeType=S `
        --key-schema `
            AttributeName=execution_id,KeyType=HASH `
        --global-secondary-indexes `
            '[{"IndexName":"StartedAtIndex","KeySchema":[{"AttributeName":"started_at","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' `
        --provisioned-throughput `
            ReadCapacityUnits=5,WriteCapacityUnits=5 `
        --no-cli-pager `
        2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Table 'tdnet_executions' created successfully"
    } else {
        Write-Warning-Custom "Table 'tdnet_executions' may already exist or creation failed"
    }
} catch {
    Write-Warning-Custom "Failed to create table 'tdnet_executions': $_"
}

# Table 3: tdnet-export-status
Write-Info "Creating table: tdnet-export-status"
try {
    aws --endpoint-url=$ENDPOINT `
        --region=$REGION `
        dynamodb create-table `
        --table-name tdnet-export-status `
        --attribute-definitions `
            AttributeName=export_id,AttributeType=S `
        --key-schema `
            AttributeName=export_id,KeyType=HASH `
        --provisioned-throughput `
            ReadCapacityUnits=5,WriteCapacityUnits=5 `
        --no-cli-pager `
        2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Table 'tdnet-export-status' created successfully"
    } else {
        Write-Warning-Custom "Table 'tdnet-export-status' may already exist or creation failed"
    }
} catch {
    Write-Warning-Custom "Failed to create table 'tdnet-export-status': $_"
}
Write-Info "Waiting for tables to be active..."
Start-Sleep -Seconds 2

# Verify tables
Write-Info "Verifying tables..."
try {
    $tables = aws --endpoint-url=$ENDPOINT --region=$REGION dynamodb list-tables --output json --no-cli-pager | ConvertFrom-Json
    $tableNames = $tables.TableNames
    
    if ($tableNames -contains "tdnet_disclosures") {
        Write-Success "Table 'tdnet_disclosures' verified"
    } else {
        Write-Error-Custom "Table 'tdnet_disclosures' not found"
    }
    
    if ($tableNames -contains "tdnet_executions") {
        Write-Success "Table 'tdnet_executions' verified"
    } else {
        Write-Error-Custom "Table 'tdnet_executions' not found"
    }
    
    if ($tableNames -contains "tdnet-export-status") {
        Write-Success "Table 'tdnet-export-status' verified"
    } else {
        Write-Error-Custom "Table 'tdnet-export-status' not found"
    }
} catch {
    Write-Error-Custom "Failed to verify tables: $_"
}

# ==========================================
# Create S3 Buckets
# ==========================================
Write-Info "Creating S3 buckets..."

# Bucket 1: tdnet-data-collector-pdfs-local
Write-Info "Creating bucket: tdnet-data-collector-pdfs-local"
try {
    aws --endpoint-url=$ENDPOINT `
        --region=$REGION `
        s3 mb s3://tdnet-data-collector-pdfs-local `
        --no-cli-pager `
        2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Bucket 'tdnet-data-collector-pdfs-local' created successfully"
    } else {
        Write-Warning-Custom "Bucket 'tdnet-data-collector-pdfs-local' may already exist or creation failed"
    }
} catch {
    Write-Warning-Custom "Failed to create bucket 'tdnet-data-collector-pdfs-local': $_"
}

# Bucket 2: tdnet-data-collector-exports-local
Write-Info "Creating bucket: tdnet-data-collector-exports-local"
try {
    aws --endpoint-url=$ENDPOINT `
        --region=$REGION `
        s3 mb s3://tdnet-data-collector-exports-local `
        --no-cli-pager `
        2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Bucket 'tdnet-data-collector-exports-local' created successfully"
    } else {
        Write-Warning-Custom "Bucket 'tdnet-data-collector-exports-local' may already exist or creation failed"
    }
} catch {
    Write-Warning-Custom "Failed to create bucket 'tdnet-data-collector-exports-local': $_"
}

# Verify buckets
Write-Info "Verifying buckets..."
try {
    $buckets = aws --endpoint-url=$ENDPOINT --region=$REGION s3 ls --no-cli-pager
    
    if ($buckets -match "tdnet-data-collector-pdfs-local") {
        Write-Success "Bucket 'tdnet-data-collector-pdfs-local' verified"
    } else {
        Write-Error-Custom "Bucket 'tdnet-data-collector-pdfs-local' not found"
    }
    
    if ($buckets -match "tdnet-data-collector-exports-local") {
        Write-Success "Bucket 'tdnet-data-collector-exports-local' verified"
    } else {
        Write-Error-Custom "Bucket 'tdnet-data-collector-exports-local' not found"
    }
} catch {
    Write-Error-Custom "Failed to verify buckets: $_"
}

# ==========================================
# Summary
# ==========================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LocalStack Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "DynamoDB Tables:"
Write-Host "  - tdnet_disclosures (with GSI_CompanyCode_DiscloseDate and GSI_DatePartition)"
Write-Host "  - tdnet_executions (with StartedAtIndex GSI)"
Write-Host "  - tdnet-export-status"
Write-Host ""
Write-Info "S3 Buckets:"
Write-Host "  - tdnet-data-collector-pdfs-local"
Write-Host "  - tdnet-data-collector-exports-local"
Write-Host ""
Write-Info "Next Steps:"
Write-Host "  1. Copy .env.local.example to .env.local"
Write-Host "  2. Run tests: npm run test:e2e"
Write-Host "  3. Check LocalStack logs: docker-compose logs -f localstack"
Write-Host ""

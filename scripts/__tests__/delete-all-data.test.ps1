# delete-all-data.ps1のテスト

$ErrorActionPreference = "Stop"

function Write-TestInfo {
    param([string]$Message)
    Write-Host "`n[TEST] $Message" -ForegroundColor Cyan
}

function Write-TestSuccess {
    param([string]$Message)
    Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Write-TestError {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

Write-Host "========================================"
Write-Host "delete-all-data.ps1 Test"
Write-Host "========================================"

# Test environment
$testEnv = "test"
$scriptPath = Join-Path -Path $PSScriptRoot -ChildPath "..\delete-all-data.ps1"

# Check script exists
Write-TestInfo "Script file check"
if (Test-Path $scriptPath) {
    Write-TestSuccess "Script exists: $scriptPath"
} else {
    Write-TestError "Script not found: $scriptPath"
    exit 1
}

# Check AWS CLI
Write-TestInfo "AWS CLI check"
try {
    $awsVersion = aws --version 2>&1
    Write-TestSuccess "AWS CLI: $awsVersion"
} catch {
    Write-TestError "AWS CLI not installed"
    exit 1
}

# Get AWS account ID
Write-TestInfo "Get AWS account ID"
try {
    $accountId = aws sts get-caller-identity --query Account --output text 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-TestSuccess "AWS Account ID: $accountId"
    } else {
        Write-TestError "Failed to get AWS account ID"
        exit 1
    }
} catch {
    Write-TestError "AWS auth error: $_"
    exit 1
}

# Test data setup
Write-TestInfo "Test data setup"
$testTable = "tdnet_disclosures_$testEnv"
$testBucket = "tdnet-data-collector-pdfs-$accountId"

# Check DynamoDB table
Write-TestInfo "Check DynamoDB table: $testTable"
$tableExists = $false
try {
    aws dynamodb describe-table --table-name $testTable 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $tableExists = $true
        Write-TestSuccess "Table exists"
    } else {
        Write-Host "[INFO] Table does not exist (skip creation)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[INFO] Table does not exist (skip creation)" -ForegroundColor Yellow
}

# Insert test data (if table exists)
if ($tableExists) {
    Write-TestInfo "Insert test data"
    $testItems = @(
        @{
            disclosure_id = @{ S = "TEST001" }
            date_partition = @{ S = "2024-01" }
            disclosed_at = @{ S = "2024-01-15T10:00:00Z" }
        },
        @{
            disclosure_id = @{ S = "TEST002" }
            date_partition = @{ S = "2024-01" }
            disclosed_at = @{ S = "2024-01-16T10:00:00Z" }
        }
    )
    
    foreach ($item in $testItems) {
        $itemJson = @{ $testTable = @( @{ PutRequest = @{ Item = $item } } ) } | ConvertTo-Json -Depth 10 -Compress
        $tempFile = [System.IO.Path]::GetTempFileName()
        [System.IO.File]::WriteAllText($tempFile, $itemJson, (New-Object System.Text.UTF8Encoding $false))
        
        aws dynamodb batch-write-item --request-items file://$tempFile 2>&1 | Out-Null
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -eq 0) {
            Write-TestSuccess "Test data inserted: $($item.disclosure_id.S)"
        } else {
            Write-TestError "Failed to insert test data: $($item.disclosure_id.S)"
        }
    }
}

# Check S3 bucket
Write-TestInfo "Check S3 bucket: $testBucket"
$bucketExists = $false
try {
    aws s3api head-bucket --bucket $testBucket 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $bucketExists = $true
        Write-TestSuccess "Bucket exists"
    } else {
        Write-Host "[INFO] Bucket does not exist (skip creation)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[INFO] Bucket does not exist (skip creation)" -ForegroundColor Yellow
}

# Insert test object (if bucket exists)
if ($bucketExists) {
    Write-TestInfo "Insert test object"
    $testContent = "Test PDF content"
    $testKey = "test/test-file.pdf"
    
    $tempFile = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempFile, $testContent, (New-Object System.Text.UTF8Encoding $false))
    
    aws s3 cp $tempFile "s3://$testBucket/$testKey" 2>&1 | Out-Null
    Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    
    if ($LASTEXITCODE -eq 0) {
        Write-TestSuccess "Test object inserted: $testKey"
    } else {
        Write-TestError "Failed to insert test object"
    }
}

# Run delete script
Write-TestInfo "Run delete script"
Write-Host "[INFO] Running delete script with -Force option" -ForegroundColor Yellow

try {
    & $scriptPath -Environment $testEnv -Force
    
    if ($LASTEXITCODE -eq 0) {
        Write-TestSuccess "Delete script completed successfully"
    } else {
        Write-TestError "Delete script failed (exit code: $LASTEXITCODE)"
        exit 1
    }
} catch {
    Write-TestError "Error running delete script: $_"
    exit 1
}

# Verify deletion (DynamoDB)
if ($tableExists) {
    Write-TestInfo "Verify DynamoDB deletion"
    $scanOutput = aws dynamodb scan --table-name $testTable --select COUNT --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $scanData = $scanOutput | ConvertFrom-Json
        $remainingCount = $scanData.Count
        
        if ($remainingCount -eq 0) {
            Write-TestSuccess "DynamoDB data deleted correctly (remaining: 0)"
        } else {
            Write-TestError "DynamoDB data remains (remaining: $remainingCount)"
        }
    } else {
        Write-TestError "DynamoDB scan failed"
    }
}

# Verify deletion (S3)
if ($bucketExists) {
    Write-TestInfo "Verify S3 deletion"
    $listOutput = aws s3api list-objects-v2 --bucket $testBucket --query "Contents[].Key" --output json 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $objects = $listOutput | ConvertFrom-Json
        
        if (-not $objects -or $objects.Count -eq 0) {
            Write-TestSuccess "S3 objects deleted correctly (remaining: 0)"
        } else {
            Write-TestError "S3 objects remain (remaining: $($objects.Count))"
        }
    } else {
        Write-TestError "S3 list failed"
    }
}

Write-Host "`n========================================"
Write-TestSuccess "All tests completed"
Write-Host "========================================"
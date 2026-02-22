# Data deletion script
# Deletes all data from DynamoDB and S3

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

if (-not $Force) {
    Write-Warning-Custom "WARNING: This script will delete all data from:"
    Write-Warning-Custom "  - DynamoDB table: tdnet_disclosures_$Environment"
    Write-Warning-Custom "  - DynamoDB table: tdnet_executions_$Environment"
    Write-Warning-Custom "  - DynamoDB table: tdnet_export_status_$Environment"
    Write-Warning-Custom "  - S3 bucket: tdnet-data-collector-pdfs-* (all objects)"
    Write-Warning-Custom "  - S3 bucket: tdnet-data-collector-exports-* (all objects)"
    Write-Host ""
    $confirmation = Read-Host "Are you sure you want to delete? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Success "Deletion cancelled."
        exit 0
    }
}

Write-Info "Starting data deletion..."

Write-Info "Getting AWS account ID..."
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Error: Failed to get AWS account ID."
    exit 1
}
Write-Success "AWS Account ID: $accountId"

$disclosuresTable = "tdnet_disclosures_$Environment"
$executionsTable = "tdnet_executions_$Environment"
$exportStatusTable = "tdnet_export_status_$Environment"
$pdfsBucket = "tdnet-data-collector-pdfs-$accountId"
$exportsBucket = "tdnet-data-collector-exports-$accountId"

Write-Host ""
Write-Info "========================================"
Write-Info "DynamoDB Table Data Deletion"
Write-Info "========================================"

function Remove-DynamoDBItems {
    param(
        [string]$TableName,
        [string]$KeyName
    )
    
    Write-Host ""
    Write-Info "Table: $TableName"
    Write-Info "Scanning data..."
    
    $tableCheck = aws dynamodb describe-table --table-name $TableName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning-Custom "Warning: Table $TableName not found. Skipping."
        return
    }
    
    $scanOutput = aws dynamodb scan --table-name $TableName --projection-expression $KeyName --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Error: Failed to scan table $TableName."
        return
    }
    
    $scanData = $scanOutput | ConvertFrom-Json
    $items = $scanData.Items
    
    if (-not $items -or $items.Count -eq 0) {
        Write-Success "No data to delete."
        return
    }
    
    $itemCount = $items.Count
    Write-Info "Items to delete: $itemCount"
    Write-Info "Deleting data..."
    
    $deletedCount = 0
    $failedCount = 0
    
    for ($i = 0; $i -lt $items.Count; $i += 25) {
        $batchSize = [Math]::Min(25, $items.Count - $i)
        $endIndex = $i + $batchSize - 1
        $batch = $items[$i..$endIndex]
        
        $deleteRequests = @()
        foreach ($item in $batch) {
            $keyValue = $item.$KeyName.S
            $deleteRequests += @{
                DeleteRequest = @{
                    Key = @{
                        $KeyName = @{ S = $keyValue }
                    }
                }
            }
        }
        
        $requestItems = @{
            $TableName = $deleteRequests
        }
        
        # Save to temp JSON file (UTF-8 without BOM)
        $tempFile = [System.IO.Path]::GetTempFileName()
        $requestJson = $requestItems | ConvertTo-Json -Depth 10 -Compress
        [System.IO.File]::WriteAllText($tempFile, $requestJson, (New-Object System.Text.UTF8Encoding $false))
        
        $batchResult = aws dynamodb batch-write-item --request-items file://$tempFile 2>&1
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount += $batchSize
            Write-Host "  Deleted: $deletedCount / $itemCount items"
        } else {
            $failedCount += $batchSize
            Write-Warning-Custom "  Warning: Batch deletion failed ($batchSize items)"
        }
        
        Start-Sleep -Milliseconds 100
    }
    
    Write-Success "Deletion complete: $deletedCount succeeded, $failedCount failed"
}

Remove-DynamoDBItems -TableName $disclosuresTable -KeyName "disclosure_id"
Remove-DynamoDBItems -TableName $executionsTable -KeyName "execution_id"
Remove-DynamoDBItems -TableName $exportStatusTable -KeyName "export_id"

Write-Host ""
Write-Info "========================================"
Write-Info "S3 Bucket Data Deletion"
Write-Info "========================================"

function Remove-S3Objects {
    param(
        [string]$BucketName
    )
    
    Write-Host ""
    Write-Info "Bucket: $BucketName"
    
    $bucketCheck = aws s3api head-bucket --bucket $BucketName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning-Custom "Warning: Bucket $BucketName not found. Skipping."
        return
    }
    
    Write-Info "Listing objects..."
    
    $listOutput = aws s3api list-objects-v2 --bucket $BucketName --query "Contents[].Key" --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Error: Failed to list bucket $BucketName."
        return
    }
    
    $objects = $listOutput | ConvertFrom-Json
    
    if (-not $objects -or $objects.Count -eq 0) {
        Write-Success "No objects to delete."
        return
    }
    
    $objectCount = $objects.Count
    Write-Info "Objects to delete: $objectCount"
    Write-Info "Deleting objects..."
    
    aws s3 rm "s3://$BucketName" --recursive 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Deletion complete: $objectCount objects"
    } else {
        Write-Warning-Custom "Warning: Some objects failed to delete."
    }
}

Remove-S3Objects -BucketName $pdfsBucket
Remove-S3Objects -BucketName $exportsBucket

Write-Host ""
Write-Info "========================================"
Write-Success "Data deletion completed!"
Write-Info "========================================"
Write-Host ""
Write-Info "Deleted resources:"
Write-Host "  - DynamoDB table: $disclosuresTable"
Write-Host "  - DynamoDB table: $executionsTable"
Write-Host "  - DynamoDB table: $exportStatusTable"
Write-Host "  - S3 bucket: $pdfsBucket"
Write-Host "  - S3 bucket: $exportsBucket"
Write-Host ""

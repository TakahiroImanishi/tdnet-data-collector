# DynamoDBとS3の整合性確認スクリプト
# DynamoDBのレコード数とS3のオブジェクト数を比較します

param(
    [Parameter(Mandatory=$false)]
    [string]$TableName = "tdnet_disclosures_prod",
    
    [Parameter(Mandatory=$false)]
    [string]$BucketName = "tdnet-pdfs-prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Profile = "default",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1"
)

Write-Host "=== DynamoDB and S3 Consistency Check ===" -ForegroundColor Cyan
Write-Host "DynamoDB Table: $TableName"
Write-Host "S3 Bucket: $BucketName"
Write-Host "Profile: $Profile"
Write-Host "Region: $Region"
Write-Host ""

# 1. Count DynamoDB records
Write-Host "=== 1. Count DynamoDB records ===" -ForegroundColor Yellow
Write-Host "Scanning (this may take a while)..."

$dynamoCount = 0
$lastEvaluatedKey = $null

do {
    if ($lastEvaluatedKey) {
        $scanResult = aws dynamodb scan `
            --table-name $TableName `
            --select COUNT `
            --exclusive-start-key $lastEvaluatedKey `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
    } else {
        $scanResult = aws dynamodb scan `
            --table-name $TableName `
            --select COUNT `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
    }
    
    $dynamoCount += $scanResult.Count
    $lastEvaluatedKey = $scanResult.LastEvaluatedKey
    
    Write-Host "現在のカウント: $dynamoCount" -NoNewline
    Write-Host "`r" -NoNewline
} while ($lastEvaluatedKey)

Write-Host ""
Write-Host "DynamoDB record count: $dynamoCount" -ForegroundColor Green
Write-Host ""

# 2. Count records with pdf_s3_key set
Write-Host "=== 2. Count records with pdf_s3_key set ===" -ForegroundColor Yellow
Write-Host "Scanning (this may take a while)..."

$dynamoWithS3KeyCount = 0
$dynamoWithoutS3KeyCount = 0
$lastEvaluatedKey = $null
$missingS3Keys = @()

do {
    if ($lastEvaluatedKey) {
        $scanResult = aws dynamodb scan `
            --table-name $TableName `
            --projection-expression "disclosure_id,pdf_s3_key" `
            --exclusive-start-key $lastEvaluatedKey `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
    } else {
        $scanResult = aws dynamodb scan `
            --table-name $TableName `
            --projection-expression "disclosure_id,pdf_s3_key" `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
    }
    
    foreach ($item in $scanResult.Items) {
        if ($item.pdf_s3_key -and $item.pdf_s3_key.S) {
            $dynamoWithS3KeyCount++
        } else {
            $dynamoWithoutS3KeyCount++
            if ($missingS3Keys.Count -lt 10) {
                $missingS3Keys += $item.disclosure_id.S
            }
        }
    }
    
    $lastEvaluatedKey = $scanResult.LastEvaluatedKey
    
    Write-Host "pdf_s3_key設定済み: $dynamoWithS3KeyCount, 未設定: $dynamoWithoutS3KeyCount" -NoNewline
    Write-Host "`r" -NoNewline
} while ($lastEvaluatedKey)

Write-Host ""
Write-Host "Records with pdf_s3_key: $dynamoWithS3KeyCount" -ForegroundColor Green
Write-Host "Records without pdf_s3_key: $dynamoWithoutS3KeyCount" -ForegroundColor $(if ($dynamoWithoutS3KeyCount -gt 0) { "Red" } else { "Green" })

if ($missingS3Keys.Count -gt 0) {
    Write-Host ""
    Write-Host "disclosure_id without pdf_s3_key (first 10):" -ForegroundColor Yellow
    $missingS3Keys | ForEach-Object {
        Write-Host "  - $_"
    }
}

Write-Host ""

# 3. Count S3 objects
Write-Host "=== 3. Count S3 objects ===" -ForegroundColor Yellow
Write-Host "Listing objects (this may take a while)..."

$s3Count = 0
$continuationToken = $null

do {
    if ($continuationToken) {
        $listResult = aws s3api list-objects-v2 `
            --bucket $BucketName `
            --continuation-token $continuationToken `
            --profile $Profile `
            --output json | ConvertFrom-Json
    } else {
        $listResult = aws s3api list-objects-v2 `
            --bucket $BucketName `
            --profile $Profile `
            --output json | ConvertFrom-Json
    }
    
    if ($listResult.Contents) {
        $s3Count += $listResult.Contents.Count
    }
    
    $continuationToken = $listResult.NextContinuationToken
    
    Write-Host "現在のカウント: $s3Count" -NoNewline
    Write-Host "`r" -NoNewline
} while ($continuationToken)

Write-Host ""
Write-Host "S3 object count: $s3Count" -ForegroundColor Green
Write-Host ""

# 4. Consistency check results
Write-Host "=== 4. Consistency check results ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "DynamoDB record count: $dynamoCount"
Write-Host "Records with pdf_s3_key: $dynamoWithS3KeyCount"
Write-Host "Records without pdf_s3_key: $dynamoWithoutS3KeyCount"
Write-Host "S3 object count: $s3Count"
Write-Host ""

$discrepancy = $dynamoWithS3KeyCount - $s3Count

if ($discrepancy -eq 0) {
    Write-Host "OK: DynamoDB records with pdf_s3_key match S3 object count." -ForegroundColor Green
} elseif ($discrepancy -gt 0) {
    Write-Host "INCONSISTENT: ${discrepancy} records have pdf_s3_key in DynamoDB but PDF file does not exist in S3." -ForegroundColor Red
} else {
    Write-Host "INCONSISTENT: $([Math]::Abs($discrepancy)) PDF files exist in S3 but pdf_s3_key is not set in DynamoDB." -ForegroundColor Red
}

Write-Host ""

if ($dynamoWithoutS3KeyCount -gt 0) {
    Write-Host "WARNING: ${dynamoWithoutS3KeyCount} records in DynamoDB do not have pdf_s3_key set." -ForegroundColor Yellow
    Write-Host "These records may have metadata only without PDF files." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Analysis complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Check CloudWatch Logs: scripts/analyze-cloudwatch-logs.ps1"
Write-Host "2. List inconsistent records: scripts/list-inconsistent-records.ps1"
Write-Host ""

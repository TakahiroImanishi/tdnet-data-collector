# Data Range Fetch Script
# Fetch data for a specific date range

param(
    [Parameter(Mandatory=$true)]
    [string]$Date,
    
    [Parameter(Mandatory=$false)]
    [int]$Offset = 0,
    
    [Parameter(Mandatory=$false)]
    [int]$Limit = 100
)

# UTF-8エンコーディング設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['Out-File:Encoding'] = 'UTF8NoBOM'

$ApiEndpoint = "https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod"
$Region = "ap-northeast-1"
$SecretName = "/tdnet/api-key-prod"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Data Range Fetch" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Secrets ManagerからAPIキーを取得
Write-Host "[0/2] Retrieving API key..." -ForegroundColor Green
try {
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Secrets Manager connection failed: $secretJson"
    }
    
    $secret = $secretJson | ConvertFrom-Json
    $ApiKey = $secret.api_key
    Write-Host "✅ API key retrieved successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to retrieve API key: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "" -ForegroundColor Yellow
    Write-Host "Solution:" -ForegroundColor Yellow
    Write-Host "1. Check if $SecretName is registered in Secrets Manager" -ForegroundColor White
    Write-Host "2. If not registered, run:" -ForegroundColor White
    Write-Host "   .\scripts\register-api-key.ps1 -Environment prod" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

Write-Host "Target Date: $Date" -ForegroundColor Yellow
Write-Host "Range: $($Offset + 1) to $($Offset + $Limit)" -ForegroundColor Yellow
Write-Host ""

Write-Host "[1/2] Fetching data..." -ForegroundColor Green

$headers = @{
    "x-api-key" = $ApiKey
    "Content-Type" = "application/json"
}

try {
    $queryParams = @(
        "start_date=$Date",
        "end_date=$Date",
        "offset=$Offset",
        "limit=$Limit"
    )
    $queryString = $queryParams -join '&'
    $uri = "$ApiEndpoint/disclosures?$queryString"
    
    Write-Host "Request URI: $uri" -ForegroundColor Gray
    Write-Host ""
    
    $response = Invoke-RestMethod `
        -Uri $uri `
        -Method Get `
        -Headers $headers `
        -ErrorAction Stop
    
    $totalCount = $response.total_count
    $items = $response.items
    $actualCount = $items.Count
    
    Write-Host "OK Data fetched successfully" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total count: $totalCount" -ForegroundColor White
    Write-Host "Fetched count: $actualCount" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[2/2] Data list" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($actualCount -eq 0) {
        Write-Host "No data found" -ForegroundColor Yellow
    } else {
        $index = $Offset + 1
        foreach ($item in $items) {
            $disclosedAt = [DateTime]::Parse($item.disclosed_at).ToString("HH:mm:ss")
            Write-Host "$index. [$($item.company_code)] $($item.company_name)" -ForegroundColor White
            Write-Host "   Type: $($item.disclosure_type)" -ForegroundColor Gray
            Write-Host "   Title: $($item.title)" -ForegroundColor Gray
            Write-Host "   Disclosed at: $disclosedAt" -ForegroundColor Gray
            Write-Host ""
            $index++
        }
    }
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    $outputFile = "data-$Date-offset$Offset-limit$Limit.json"
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8NoBOM
    
    Write-Host "OK Saved to: $outputFile" -ForegroundColor Green
    Write-Host ""
    
    exit 0
    
} catch {
    Write-Host "NG Data fetch failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status code: $statusCode" -ForegroundColor Red
    }
    
    exit 1
}

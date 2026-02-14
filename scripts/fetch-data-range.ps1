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

$ApiEndpoint = "https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod"
$ApiKey = "l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Data Range Fetch" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
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
    $response | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputFile -Encoding UTF8
    
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

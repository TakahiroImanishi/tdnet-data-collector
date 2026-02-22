# Simple CloudWatch Logs check script
param(
    [Parameter(Mandatory=$false)]
    [string]$LogGroupName = "/aws/lambda/TdnetDataCollectorStack-prod-LambdaCollector",
    
    [Parameter(Mandatory=$false)]
    [int]$Hours = 48,
    
    [Parameter(Mandatory=$false)]
    [string]$Profile = "imanishi-awssso",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1"
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "=== CloudWatch Logs Check ===" -ForegroundColor Cyan
Write-Host "Log Group: $LogGroupName"
Write-Host "Hours: $Hours"
Write-Host "Profile: $Profile"
Write-Host ""

# Get recent log streams
Write-Host "Getting recent log streams..." -ForegroundColor Yellow
$streams = aws logs describe-log-streams `
    --log-group-name $LogGroupName `
    --order-by LastEventTime `
    --descending `
    --max-items 5 `
    --profile $Profile `
    --region $Region `
    --output json | ConvertFrom-Json

if ($streams.logStreams) {
    Write-Host "Found $($streams.logStreams.Count) recent log streams" -ForegroundColor Green
    Write-Host ""
    
    foreach ($stream in $streams.logStreams) {
        Write-Host "Stream: $($stream.logStreamName)" -ForegroundColor Cyan
        Write-Host "Last Event: $([DateTimeOffset]::FromUnixTimeMilliseconds($stream.lastEventTimestamp).ToString('yyyy-MM-dd HH:mm:ss'))"
        
        # Get log events
        $events = aws logs get-log-events `
            --log-group-name $LogGroupName `
            --log-stream-name $stream.logStreamName `
            --limit 100 `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        if ($events.events) {
            Write-Host "Events: $($events.events.Count)"
            
            # Search for errors
            $errors = $events.events | Where-Object { $_.message -match "Failed|Error|error" }
            if ($errors) {
                Write-Host "Errors found: $($errors.Count)" -ForegroundColor Red
                $errors | Select-Object -First 3 | ForEach-Object {
                    Write-Host "  - $($_.message.Substring(0, [Math]::Min(200, $_.message.Length)))"
                }
            } else {
                Write-Host "No errors found" -ForegroundColor Green
            }
            
            # Search for success messages
            $success = $events.events | Where-Object { $_.message -match "Successfully processed disclosure" }
            if ($success) {
                Write-Host "Success messages: $($success.Count)" -ForegroundColor Green
            }
            
            # Search for Lambda Collector completed
            $completed = $events.events | Where-Object { $_.message -match "Lambda Collector completed" }
            if ($completed) {
                Write-Host "Completed messages: $($completed.Count)" -ForegroundColor Green
                $completed | ForEach-Object {
                    if ($_.message -match '"collected_count":(\d+)') {
                        $collectedCount = $matches[1]
                        Write-Host "  Collected: $collectedCount"
                    }
                    if ($_.message -match '"failed_count":(\d+)') {
                        $failedCount = $matches[1]
                        Write-Host "  Failed: $failedCount"
                    }
                }
            }
        }
        
        Write-Host ""
    }
} else {
    Write-Host "No log streams found" -ForegroundColor Yellow
}

Write-Host "=== Check complete ===" -ForegroundColor Cyan

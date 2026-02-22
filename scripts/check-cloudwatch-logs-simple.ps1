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
    Write-Host "❌ ログストリームが見つかりませんでした" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. ログループ名を確認: aws logs describe-log-groups --log-group-name-prefix $LogGroupName" -ForegroundColor White
    Write-Host "2. Lambda関数が実行されているか確認: aws lambda list-functions --query 'Functions[?contains(FunctionName, ``collector``)]'" -ForegroundColor White
    Write-Host "3. 時間範囲（-Hours）を拡大してください" -ForegroundColor White
    Write-Host "4. AWS認証情報とCloudWatch Logs権限を確認してください" -ForegroundColor White
    Write-Host ""
}

Write-Host "=== Check complete ===" -ForegroundColor Cyan

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

try {
    $streams = aws logs describe-log-streams `
        --log-group-name $LogGroupName `
        --order-by LastEventTime `
        --descending `
        --max-items 5 `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLI command failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "❌ [ERR-CWL-004] ログストリームの取得に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. ログループが存在することを確認:" -ForegroundColor White
    Write-Host "   aws logs describe-log-groups --log-group-name-prefix $LogGroupName --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. AWS認証情報を確認:" -ForegroundColor White
    Write-Host "   aws sts get-caller-identity --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. CloudWatch Logs権限を確認（必要な権限: logs:DescribeLogStreams）:" -ForegroundColor White
    Write-Host "   scripts/check-iam-permissions.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. CloudWatch Logsコンソールで確認:" -ForegroundColor White
    Write-Host "   https://console.aws.amazon.com/cloudwatch/home?region=$Region#logsV2:log-groups/log-group/$([uri]::EscapeDataString($LogGroupName))" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "詳細: .kiro/steering/infrastructure/monitoring-alerts.md" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

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
    Write-Host "❌ [ERR-CWL-003] ログストリームが見つかりませんでした" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. ログループ名を確認:" -ForegroundColor White
    Write-Host "   aws logs describe-log-groups --log-group-name-prefix $LogGroupName --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Lambda関数が実行されているか確認:" -ForegroundColor White
    Write-Host "   aws lambda list-functions --query 'Functions[?contains(FunctionName, ``Collector``)]' --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. 時間範囲を拡大してください:" -ForegroundColor White
    Write-Host "   .\scripts\check-cloudwatch-logs-simple.ps1 -Hours 72 -Profile $Profile -Region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. AWS認証情報を確認:" -ForegroundColor White
    Write-Host "   aws sts get-caller-identity --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. CloudWatch Logs権限を確認（必要な権限: logs:DescribeLogStreams, logs:GetLogEvents）:" -ForegroundColor White
    Write-Host "   scripts/check-iam-permissions.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "6. CloudWatch Logsコンソールで確認:" -ForegroundColor White
    Write-Host "   https://console.aws.amazon.com/cloudwatch/home?region=$Region#logsV2:log-groups/log-group/$([uri]::EscapeDataString($LogGroupName))" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "詳細: .kiro/steering/infrastructure/monitoring-alerts.md" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=== Check complete ===" -ForegroundColor Cyan

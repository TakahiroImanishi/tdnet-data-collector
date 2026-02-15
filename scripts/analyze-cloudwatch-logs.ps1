# CloudWatch Logs分析スクリプト
# Lambda Collectorのログを分析し、PDF保存失敗の原因を特定します

param(
    [Parameter(Mandatory=$false)]
    [string]$LogGroupName = "/aws/lambda/TdnetDataCollectorStack-prod-LambdaCollector",
    
    [Parameter(Mandatory=$false)]
    [int]$Hours = 24,
    
    [Parameter(Mandatory=$false)]
    [string]$Profile = "default",
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-northeast-1"
)

Write-Host "=== CloudWatch Logs Analysis ===" -ForegroundColor Cyan
Write-Host "Log Group: $LogGroupName"
Write-Host "Time Range: Last $Hours hours"
Write-Host "Profile: $Profile"
Write-Host "Region: $Region"
Write-Host ""

# Calculate start and end time (Unix timestamp in milliseconds)
$endTime = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$startTime = $endTime - ($Hours * 60 * 60 * 1000)

Write-Host "Start Time: $([DateTimeOffset]::FromUnixTimeMilliseconds($startTime).ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "End Time: $([DateTimeOffset]::FromUnixTimeMilliseconds($endTime).ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ""

# 1. Search for PDF save errors
Write-Host "=== 1. Search for PDF save errors ===" -ForegroundColor Yellow
$pdfErrorQuery = @"
fields @timestamp, @message
| filter @message like /Failed to download PDF/ or @message like /Failed to save metadata/ or @message like /Failed to process disclosure/
| sort @timestamp desc
| limit 100
"@

Write-Host "Executing query..."
$pdfErrorResult = aws logs start-query `
    --log-group-name $LogGroupName `
    --start-time $startTime `
    --end-time $endTime `
    --query-string $pdfErrorQuery `
    --profile $Profile `
    --region $Region `
    --output json | ConvertFrom-Json

if ($pdfErrorResult.queryId) {
    Write-Host "クエリID: $($pdfErrorResult.queryId)"
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $pdfErrorResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            
            if ($status.results.Count -gt 0) {
                Write-Host ""
                Write-Host "=== PDF保存失敗のエラー（最新10件） ===" -ForegroundColor Red
                $status.results | Select-Object -First 10 | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    Write-Host "[$timestamp] $message"
                }
                
                # エラータイプを集計
                Write-Host ""
                Write-Host "=== エラータイプ集計 ===" -ForegroundColor Yellow
                $errorTypes = @{}
                $status.results | ForEach-Object {
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    if ($message -match '"error_type":"([^"]+)"') {
                        $errorType = $matches[1]
                        if ($errorTypes.ContainsKey($errorType)) {
                            $errorTypes[$errorType]++
                        } else {
                            $errorTypes[$errorType] = 1
                        }
                    }
                }
                
                $errorTypes.GetEnumerator() | Sort-Object -Property Value -Descending | ForEach-Object {
                    Write-Host "$($_.Key): $($_.Value)件"
                }
            } else {
                Write-Host "PDF保存失敗のエラーは見つかりませんでした。" -ForegroundColor Green
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした。" -ForegroundColor Red
            break
        }
    } while ($true)
} else {
    Write-Host "クエリの開始に失敗しました。" -ForegroundColor Red
}

Write-Host ""

# 2. 収集成功件数と失敗件数を確認
Write-Host "=== 2. 収集成功件数と失敗件数を確認 ===" -ForegroundColor Yellow
$summaryQuery = @"
fields @timestamp, @message
| filter @message like /Lambda Collector completed/
| parse @message '"collected_count":*,' as collected_count
| parse @message '"failed_count":*,' as failed_count
| sort @timestamp desc
| limit 10
"@

Write-Host "クエリ実行中..."
$summaryResult = aws logs start-query `
    --log-group-name $LogGroupName `
    --start-time $startTime `
    --end-time $endTime `
    --query-string $summaryQuery `
    --profile $Profile `
    --region $Region `
    --output json | ConvertFrom-Json

if ($summaryResult.queryId) {
    Write-Host "クエリID: $($summaryResult.queryId)"
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $summaryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            
            if ($status.results.Count -gt 0) {
                Write-Host ""
                Write-Host "=== 収集結果サマリー（最新10件） ===" -ForegroundColor Cyan
                $status.results | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $collectedCount = ($_.field | Where-Object { $_.field -eq "collected_count" }).value
                    $failedCount = ($_.field | Where-Object { $_.field -eq "failed_count" }).value
                    Write-Host "[$timestamp] 成功: $collectedCount件, 失敗: $failedCount件"
                }
            } else {
                Write-Host "収集結果が見つかりませんでした。" -ForegroundColor Yellow
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした。" -ForegroundColor Red
            break
        }
    } while ($true)
} else {
    Write-Host "クエリの開始に失敗しました。" -ForegroundColor Red
}

Write-Host ""

# 3. S3 PutObject エラーを検索
Write-Host "=== 3. S3 PutObject エラーを検索 ===" -ForegroundColor Yellow
$s3ErrorQuery = @"
fields @timestamp, @message
| filter @message like /PutObjectCommand/ or @message like /AccessDenied/ or @message like /NoSuchBucket/
| sort @timestamp desc
| limit 50
"@

Write-Host "クエリ実行中..."
$s3ErrorResult = aws logs start-query `
    --log-group-name $LogGroupName `
    --start-time $startTime `
    --end-time $endTime `
    --query-string $s3ErrorQuery `
    --profile $Profile `
    --region $Region `
    --output json | ConvertFrom-Json

if ($s3ErrorResult.queryId) {
    Write-Host "クエリID: $($s3ErrorResult.queryId)"
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $s3ErrorResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            
            if ($status.results.Count -gt 0) {
                Write-Host ""
                Write-Host "=== S3 PutObject エラー（最新10件） ===" -ForegroundColor Red
                $status.results | Select-Object -First 10 | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    Write-Host "[$timestamp] $message"
                }
            } else {
                Write-Host "S3 PutObject エラーは見つかりませんでした。" -ForegroundColor Green
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした。" -ForegroundColor Red
            break
        }
    } while ($true)
} else {
    Write-Host "クエリの開始に失敗しました。" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 分析完了 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:"
Write-Host "1. DynamoDBとS3の整合性を確認: scripts/check-dynamodb-s3-consistency.ps1"
Write-Host "2. IAM権限を確認: scripts/check-iam-permissions.ps1"
Write-Host ""

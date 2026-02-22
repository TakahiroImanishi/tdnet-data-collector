# Lambda 998件制限問題の根本原因特定スクリプト
# 特定の実行IDのCloudWatch Logsを詳細に確認

param(
    [Parameter(Mandatory=$false)]
    [string]$ExecutionId = "b6c62399-9e75-4bc4-9b43-51786ffc440f",
    
    [Parameter(Mandatory=$false)]
    [string]$LogGroupName = "/aws/lambda/tdnet-collector-prod",
    
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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Lambda 998件制限問題 - 根本原因特定" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "実行ID: $ExecutionId" -ForegroundColor Yellow
Write-Host "ログループ: $LogGroupName" -ForegroundColor Yellow
Write-Host "プロファイル: $Profile" -ForegroundColor Yellow
Write-Host "リージョン: $Region" -ForegroundColor Yellow
Write-Host ""

# 実行時刻範囲（2026-02-22 05:58:00 - 06:20:00 JST = 2026-02-21 20:58:00 - 21:20:00 UTC）
$startTime = [DateTimeOffset]::Parse("2026-02-21T20:58:00Z").ToUnixTimeMilliseconds()
$endTime = [DateTimeOffset]::Parse("2026-02-21T21:20:00Z").ToUnixTimeMilliseconds()

Write-Host "時間範囲:" -ForegroundColor Yellow
Write-Host "  開始: $([DateTimeOffset]::FromUnixTimeMilliseconds($startTime).ToString('yyyy-MM-dd HH:mm:ss')) UTC"
Write-Host "  終了: $([DateTimeOffset]::FromUnixTimeMilliseconds($endTime).ToString('yyyy-MM-dd HH:mm:ss')) UTC"
Write-Host ""

# 1. Lambda関数の最終ログを確認
Write-Host "=== 1. Lambda関数の最終ログを確認 ===" -ForegroundColor Cyan
Write-Host ""

$finalLogsQuery = @"
fields @timestamp, @message
| filter @message like /$ExecutionId/
| sort @timestamp desc
| limit 100
"@

Write-Host "クエリ実行中..." -ForegroundColor Yellow
try {
    $queryResult = aws logs start-query `
        --log-group-name $LogGroupName `
        --start-time $startTime `
        --end-time $endTime `
        --query-string $finalLogsQuery `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0 -or -not $queryResult.queryId) {
        throw "クエリの開始に失敗しました"
    }
    
    Write-Host "クエリID: $($queryResult.queryId)" -ForegroundColor Green
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $queryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            Write-Host ""
            
            if ($status.results.Count -gt 0) {
                # 最終ログを表示
                Write-Host "=== 最終ログ（最新20件） ===" -ForegroundColor Yellow
                $status.results | Select-Object -First 20 | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    Write-Host "[$timestamp]" -ForegroundColor Gray
                    Write-Host "$message" -ForegroundColor White
                    Write-Host ""
                }
                
                # REPORTメッセージを検索（Lambda実行サマリー）
                Write-Host "=== Lambda実行サマリー（REPORT） ===" -ForegroundColor Yellow
                $reportMessages = $status.results | Where-Object {
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    $message -match "^REPORT"
                }
                
                if ($reportMessages) {
                    $reportMessages | ForEach-Object {
                        $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                        Write-Host "$message" -ForegroundColor Cyan
                        
                        # メモリ使用量を抽出
                        if ($message -match "Memory Size: (\d+) MB") {
                            $memorySize = $matches[1]
                            Write-Host "  メモリサイズ: $memorySize MB" -ForegroundColor White
                        }
                        if ($message -match "Max Memory Used: (\d+) MB") {
                            $maxMemoryUsed = $matches[1]
                            Write-Host "  最大メモリ使用量: $maxMemoryUsed MB" -ForegroundColor White
                            
                            # メモリ使用率を計算
                            if ($memorySize) {
                                $memoryUsagePercent = [math]::Round(($maxMemoryUsed / $memorySize) * 100, 2)
                                Write-Host "  メモリ使用率: $memoryUsagePercent%" -ForegroundColor $(if ($memoryUsagePercent -gt 90) { "Red" } elseif ($memoryUsagePercent -gt 70) { "Yellow" } else { "Green" })
                            }
                        }
                        if ($message -match "Duration: ([\d.]+) ms") {
                            $duration = $matches[1]
                            Write-Host "  実行時間: $duration ms" -ForegroundColor White
                        }
                        if ($message -match "Billed Duration: (\d+) ms") {
                            $billedDuration = $matches[1]
                            Write-Host "  課金時間: $billedDuration ms" -ForegroundColor White
                        }
                    }
                } else {
                    Write-Host "REPORTメッセージが見つかりませんでした" -ForegroundColor Yellow
                    Write-Host "Lambda関数がタイムアウトまたは異常終了した可能性があります" -ForegroundColor Red
                }
            } else {
                Write-Host "指定された実行IDのログが見つかりませんでした" -ForegroundColor Yellow
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした（${maxWaitSeconds}秒経過）" -ForegroundColor Red
            break
        }
    } while ($true)
} catch {
    Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. AWS認証情報を確認:" -ForegroundColor White
    Write-Host "   aws sts get-caller-identity --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. ログループが存在することを確認:" -ForegroundColor White
    Write-Host "   aws logs describe-log-groups --log-group-name-prefix $LogGroupName --profile $Profile --region $Region" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host ""

# 2. タイムアウトエラーの確認
Write-Host "=== 2. タイムアウトエラーの確認 ===" -ForegroundColor Cyan
Write-Host ""

$timeoutQuery = @"
fields @timestamp, @message
| filter @message like /$ExecutionId/ and (@message like /Task timed out/ or @message like /timeout/ or @message like /TIMEOUT/)
| sort @timestamp desc
| limit 50
"@

Write-Host "クエリ実行中..." -ForegroundColor Yellow
try {
    $queryResult = aws logs start-query `
        --log-group-name $LogGroupName `
        --start-time $startTime `
        --end-time $endTime `
        --query-string $timeoutQuery `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0 -or -not $queryResult.queryId) {
        throw "クエリの開始に失敗しました"
    }
    
    Write-Host "クエリID: $($queryResult.queryId)" -ForegroundColor Green
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $queryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            Write-Host ""
            
            if ($status.results.Count -gt 0) {
                Write-Host "⚠️ タイムアウトエラーが検出されました" -ForegroundColor Red
                Write-Host ""
                $status.results | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    Write-Host "[$timestamp]" -ForegroundColor Gray
                    Write-Host "$message" -ForegroundColor Red
                    Write-Host ""
                }
            } else {
                Write-Host "✅ タイムアウトエラーは検出されませんでした" -ForegroundColor Green
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした（${maxWaitSeconds}秒経過）" -ForegroundColor Red
            break
        }
    } while ($true)
} catch {
    Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 3. メモリ不足の警告確認
Write-Host "=== 3. メモリ不足の警告確認 ===" -ForegroundColor Cyan
Write-Host ""

$memoryQuery = @"
fields @timestamp, @message
| filter @message like /$ExecutionId/ and (@message like /out of memory/ or @message like /OOM/ or @message like /memory/)
| sort @timestamp desc
| limit 50
"@

Write-Host "クエリ実行中..." -ForegroundColor Yellow
try {
    $queryResult = aws logs start-query `
        --log-group-name $LogGroupName `
        --start-time $startTime `
        --end-time $endTime `
        --query-string $memoryQuery `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0 -or -not $queryResult.queryId) {
        throw "クエリの開始に失敗しました"
    }
    
    Write-Host "クエリID: $($queryResult.queryId)" -ForegroundColor Green
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $queryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            Write-Host ""
            
            if ($status.results.Count -gt 0) {
                Write-Host "⚠️ メモリ関連のログが検出されました" -ForegroundColor Yellow
                Write-Host ""
                $status.results | Select-Object -First 10 | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    Write-Host "[$timestamp]" -ForegroundColor Gray
                    Write-Host "$message" -ForegroundColor Yellow
                    Write-Host ""
                }
            } else {
                Write-Host "✅ メモリ不足の警告は検出されませんでした" -ForegroundColor Green
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした（${maxWaitSeconds}秒経過）" -ForegroundColor Red
            break
        }
    } while ($true)
} catch {
    Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 4. DynamoDBエラーの確認
Write-Host "=== 4. DynamoDBエラーの確認 ===" -ForegroundColor Cyan
Write-Host ""

$dynamodbQuery = @"
fields @timestamp, @message
| filter @message like /$ExecutionId/ and (@message like /ThrottlingException/ or @message like /ProvisionedThroughputExceededException/ or @message like /DynamoDB/ or @message like /BatchWrite/)
| sort @timestamp desc
| limit 50
"@

Write-Host "クエリ実行中..." -ForegroundColor Yellow
try {
    $queryResult = aws logs start-query `
        --log-group-name $LogGroupName `
        --start-time $startTime `
        --end-time $endTime `
        --query-string $dynamodbQuery `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0 -or -not $queryResult.queryId) {
        throw "クエリの開始に失敗しました"
    }
    
    Write-Host "クエリID: $($queryResult.queryId)" -ForegroundColor Green
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $queryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            Write-Host ""
            
            if ($status.results.Count -gt 0) {
                Write-Host "⚠️ DynamoDB関連のログが検出されました" -ForegroundColor Yellow
                Write-Host ""
                
                # エラーメッセージを分類
                $throttlingErrors = @()
                $batchWriteErrors = @()
                $otherErrors = @()
                
                $status.results | ForEach-Object {
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    
                    if ($message -match "ThrottlingException") {
                        $throttlingErrors += $_
                    } elseif ($message -match "BatchWrite") {
                        $batchWriteErrors += $_
                    } else {
                        $otherErrors += $_
                    }
                }
                
                if ($throttlingErrors.Count -gt 0) {
                    Write-Host "🔴 ThrottlingException: $($throttlingErrors.Count)件" -ForegroundColor Red
                    $throttlingErrors | Select-Object -First 5 | ForEach-Object {
                        $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                        $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                        Write-Host "[$timestamp]" -ForegroundColor Gray
                        Write-Host "$message" -ForegroundColor Red
                        Write-Host ""
                    }
                }
                
                if ($batchWriteErrors.Count -gt 0) {
                    Write-Host "🟡 BatchWrite関連: $($batchWriteErrors.Count)件" -ForegroundColor Yellow
                    $batchWriteErrors | Select-Object -First 5 | ForEach-Object {
                        $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                        $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                        Write-Host "[$timestamp]" -ForegroundColor Gray
                        Write-Host "$message" -ForegroundColor Yellow
                        Write-Host ""
                    }
                }
                
                if ($otherErrors.Count -gt 0) {
                    Write-Host "🟢 その他DynamoDB関連: $($otherErrors.Count)件" -ForegroundColor Green
                    $otherErrors | Select-Object -First 5 | ForEach-Object {
                        $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                        $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                        Write-Host "[$timestamp]" -ForegroundColor Gray
                        Write-Host "$message" -ForegroundColor White
                        Write-Host ""
                    }
                }
            } else {
                Write-Host "✅ DynamoDBエラーは検出されませんでした" -ForegroundColor Green
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした（${maxWaitSeconds}秒経過）" -ForegroundColor Red
            break
        }
    } while ($true)
} catch {
    Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# 5. 998件付近のログを確認
Write-Host "=== 5. 998件付近のログを確認 ===" -ForegroundColor Cyan
Write-Host ""

$count998Query = @"
fields @timestamp, @message
| filter @message like /$ExecutionId/ and (@message like /998/ or @message like /Successfully processed disclosure/ or @message like /Failed to process disclosure/)
| sort @timestamp asc
| limit 100
"@

Write-Host "クエリ実行中..." -ForegroundColor Yellow
try {
    $queryResult = aws logs start-query `
        --log-group-name $LogGroupName `
        --start-time $startTime `
        --end-time $endTime `
        --query-string $count998Query `
        --profile $Profile `
        --region $Region `
        --output json 2>&1 | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0 -or -not $queryResult.queryId) {
        throw "クエリの開始に失敗しました"
    }
    
    Write-Host "クエリID: $($queryResult.queryId)" -ForegroundColor Green
    
    # クエリ完了を待つ
    $maxWaitSeconds = 60
    $waitedSeconds = 0
    do {
        Start-Sleep -Seconds 2
        $waitedSeconds += 2
        
        $status = aws logs get-query-results `
            --query-id $queryResult.queryId `
            --profile $Profile `
            --region $Region `
            --output json | ConvertFrom-Json
        
        Write-Host "ステータス: $($status.status) (待機時間: ${waitedSeconds}秒)" -NoNewline
        Write-Host "`r" -NoNewline
        
        if ($status.status -eq "Complete") {
            Write-Host ""
            Write-Host "クエリ完了！結果: $($status.results.Count)件" -ForegroundColor Green
            Write-Host ""
            
            if ($status.results.Count -gt 0) {
                # 成功・失敗をカウント
                $successCount = 0
                $failureCount = 0
                
                $status.results | ForEach-Object {
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    
                    if ($message -match "Successfully processed disclosure") {
                        $successCount++
                    } elseif ($message -match "Failed to process disclosure") {
                        $failureCount++
                    }
                }
                
                Write-Host "処理結果:" -ForegroundColor Yellow
                Write-Host "  成功: $successCount 件" -ForegroundColor Green
                Write-Host "  失敗: $failureCount 件" -ForegroundColor Red
                Write-Host ""
                
                # 最後の10件を表示
                Write-Host "最後の処理ログ（10件）:" -ForegroundColor Yellow
                $status.results | Select-Object -Last 10 | ForEach-Object {
                    $timestamp = ($_.field | Where-Object { $_.field -eq "@timestamp" }).value
                    $message = ($_.field | Where-Object { $_.field -eq "@message" }).value
                    
                    $color = if ($message -match "Successfully") { "Green" } elseif ($message -match "Failed") { "Red" } else { "White" }
                    
                    Write-Host "[$timestamp]" -ForegroundColor Gray
                    Write-Host "$message" -ForegroundColor $color
                    Write-Host ""
                }
            } else {
                Write-Host "998件付近のログが見つかりませんでした" -ForegroundColor Yellow
            }
            
            break
        }
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host ""
            Write-Host "タイムアウト: クエリが完了しませんでした（${maxWaitSeconds}秒経過）" -ForegroundColor Red
            break
        }
    } while ($true)
} catch {
    Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "分析完了" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "次のステップ:" -ForegroundColor Yellow
Write-Host "1. 作業記録を更新: .kiro/specs/tdnet-data-collector/work-logs/work-log-20260222-151515-lambda-998-limit-root-cause.md"
Write-Host "2. 根本原因に基づいて修正方針を決定"
Write-Host "3. タスク1.1を完了としてマーク"
Write-Host ""


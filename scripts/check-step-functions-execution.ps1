# Step Functions実行状態確認スクリプト
# タスク5.3: 運用スクリプト更新

param(
    [Parameter(Mandatory=$false)]
    [string]$ExecutionArn,
    
    [Parameter(Mandatory=$false)]
    [string]$ExecutionId,
    
    [Parameter(Mandatory=$false)]
    [switch]$Json,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# ヘルプメッセージ
if ($Help) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step Functions実行状態確認スクリプト" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -ExecutionId <実行ID>" -ForegroundColor White
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -ExecutionArn <実行ARN>" -ForegroundColor White
    Write-Host ""
    Write-Host "パラメータ:" -ForegroundColor Yellow
    Write-Host "  -ExecutionId   : 実行ID（例: exec_1234567890_abc123_12345678）" -ForegroundColor White
    Write-Host "  -ExecutionArn  : 実行ARN（例: arn:aws:states:...）" -ForegroundColor White
    Write-Host "  -Json          : JSON形式で出力" -ForegroundColor White
    Write-Host "  -Help          : このヘルプメッセージを表示" -ForegroundColor White
    Write-Host ""
    Write-Host "例:" -ForegroundColor Yellow
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123" -ForegroundColor Gray
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -ExecutionArn arn:aws:states:... -Json" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# パラメータ検証
if (-not $ExecutionArn -and -not $ExecutionId) {
    Write-Host "❌ エラー: ExecutionArn または ExecutionId のいずれかを指定してください" -ForegroundColor Red
    Write-Host ""
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -ExecutionId <実行ID>" -ForegroundColor White
    Write-Host "  .\scripts\check-step-functions-execution.ps1 -Help" -ForegroundColor White
    exit 1
}

# 本番環境設定
$ApiEndpoint = "https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod"
$Region = "ap-northeast-1"
$SecretName = "/tdnet/api-key-prod"

# APIキー取得関数（リトライ機能付き）
function Get-ApiKeyWithRetry {
    param(
        [string]$SecretName,
        [string]$Region,
        [int]$MaxRetries = 3
    )
    
    $retryCount = 0
    $delay = 2
    
    while ($retryCount -lt $MaxRetries) {
        try {
            $secretJson = aws secretsmanager get-secret-value `
                --secret-id $SecretName `
                --region $Region `
                --query SecretString `
                --output text 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                $secret = $secretJson | ConvertFrom-Json
                return $secret.api_key
            }
            
            # エラー分類
            if ($secretJson -match "ResourceNotFoundException") {
                throw [System.Exception]::new("SECRET_NOT_FOUND")
            } elseif ($secretJson -match "AccessDeniedException") {
                throw [System.Exception]::new("ACCESS_DENIED")
            } else {
                throw [System.Exception]::new("NETWORK_ERROR")
            }
            
        } catch {
            $errorType = $_.Exception.Message
            
            if ($errorType -eq "NETWORK_ERROR" -and $retryCount -lt ($MaxRetries - 1)) {
                $retryCount++
                Write-Host "⚠️ ネットワークエラー。$delay 秒後にリトライします... ($retryCount/$MaxRetries)" -ForegroundColor Yellow
                Start-Sleep -Seconds $delay
                $delay *= 2
                continue
            }
            
            # リトライ不可能なエラー、または最大リトライ回数到達
            throw $_
        }
    }
}

if (-not $Json) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step Functions実行状態確認" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

# APIキー取得
$envApiKey = $env:TDNET_API_KEY

if ($envApiKey) {
    $ApiKey = $envApiKey
} else {
    try {
        $ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region
    } catch {
        Write-Host "❌ APIキーの取得に失敗しました" -ForegroundColor Red
        Write-Host "詳細: 環境変数 TDNET_API_KEY を設定するか、Secrets Managerにシークレットを登録してください" -ForegroundColor Yellow
        exit 1
    }
}

# ExecutionIdからAPIエンドポイントを構築
if ($ExecutionId) {
    $uri = "$ApiEndpoint/collect/$ExecutionId"
} else {
    # ExecutionArnから実行IDを抽出
    # ARN形式: arn:aws:states:ap-northeast-1:123456789012:execution:tdnet-collector-prod:exec_123
    if ($ExecutionArn -match ":execution:[^:]+:(.+)$") {
        $ExecutionId = $Matches[1]
        $uri = "$ApiEndpoint/collect/$ExecutionId"
    } else {
        Write-Host "❌ エラー: 無効なExecutionArn形式です" -ForegroundColor Red
        exit 1
    }
}

# 実行状態を取得
try {
    $response = Invoke-RestMethod `
        -Uri $uri `
        -Method Get `
        -Headers @{ "x-api-key" = $ApiKey } `
        -ErrorAction Stop
    
    $data = $response.data
    
    if ($Json) {
        # JSON形式で出力
        $data | ConvertTo-Json -Depth 10
    } else {
        # 人間が読みやすい形式で出力
        Write-Host "実行ID: $($data.execution_id)" -ForegroundColor White
        Write-Host "状態: $($data.status)" -ForegroundColor $(
            switch ($data.status) {
                "pending" { "Yellow" }
                "running" { "Cyan" }
                "completed" { "Green" }
                "failed" { "Red" }
                default { "White" }
            }
        )
        Write-Host "進捗: $($data.progress)%" -ForegroundColor White
        Write-Host "収集件数: $($data.collected_count) 件" -ForegroundColor White
        Write-Host "失敗件数: $($data.failed_count) 件" -ForegroundColor White
        Write-Host "開始時刻: $($data.started_at)" -ForegroundColor White
        Write-Host "更新時刻: $($data.updated_at)" -ForegroundColor White
        
        if ($data.completed_at) {
            Write-Host "完了時刻: $($data.completed_at)" -ForegroundColor White
        }
        
        if ($data.error_message) {
            Write-Host "エラー: $($data.error_message)" -ForegroundColor Red
        }
        
        Write-Host ""
    }
    
    exit 0
    
} catch {
    if ($Json) {
        @{
            error = $true
            message = $_.Exception.Message
        } | ConvertTo-Json
    } else {
        Write-Host "❌ 実行状態の取得に失敗しました" -ForegroundColor Red
        Write-Host "エラー: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    exit 1
}

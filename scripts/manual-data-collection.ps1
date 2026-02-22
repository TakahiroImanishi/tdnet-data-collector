# 手動データ収集スクリプト
# タスク31.6: 初回データ収集の実行

param(
    [Parameter(Mandatory=$false)]
    [string]$StartDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd"),
    
    [Parameter(Mandatory=$false)]
    [string]$EndDate = (Get-Date).ToString("yyyy-MM-dd"),
    
    [Parameter(Mandatory=$false)]
    [int]$MaxItems = 10
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
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

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - 手動データ収集" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Secrets ManagerからAPIキーを取得（環境変数フォールバック付き）
Write-Host "[0/4] APIキーを取得中..." -ForegroundColor Green

# 環境変数からAPIキーを取得
$envApiKey = $env:TDNET_API_KEY

if ($envApiKey) {
    Write-Host "ℹ️ 環境変数からAPIキーを使用します" -ForegroundColor Cyan
    $ApiKey = $envApiKey
    Write-Host "✅ APIキーを取得しました" -ForegroundColor Green
} else {
    # Secrets Managerから取得
    try {
        $ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region
        Write-Host "✅ Secrets ManagerからAPIキーを取得しました" -ForegroundColor Green
    } catch {
        $errorType = $_.Exception.Message
        
        Write-Host "❌ APIキーの取得に失敗しました" -ForegroundColor Red
        Write-Host ""
        
        switch ($errorType) {
            "SECRET_NOT_FOUND" {
                Write-Host "原因: Secrets Managerにシークレットが登録されていません" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. 以下のコマンドでシークレットを登録してください:" -ForegroundColor White
                Write-Host "   .\scripts\create-api-key-secret.ps1" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            "ACCESS_DENIED" {
                Write-Host "原因: Secrets Managerへのアクセス権限がありません" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. IAMポリシーを確認してください:" -ForegroundColor White
                Write-Host "   - secretsmanager:GetSecretValue" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            "NETWORK_ERROR" {
                Write-Host "原因: ネットワークエラー（最大リトライ回数に到達）" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. ネットワーク接続を確認してください" -ForegroundColor White
                Write-Host "2. AWS CLIの設定を確認してください:" -ForegroundColor White
                Write-Host "   aws configure list" -ForegroundColor Gray
                Write-Host ""
                Write-Host "3. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            default {
                Write-Host "原因: 不明なエラー" -ForegroundColor Yellow
                Write-Host "エラー詳細: $errorType" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host "詳細: .kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md" -ForegroundColor Gray
        exit 1
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "収集期間: $StartDate 〜 $EndDate" -ForegroundColor Yellow
Write-Host "最大件数: $MaxItems 件" -ForegroundColor Yellow
Write-Host ""

# 1. データ収集リクエスト送信
Write-Host "[1/4] データ収集リクエストを送信中..." -ForegroundColor Green

$collectBody = @{
    start_date = $StartDate
    end_date = $EndDate
    max_items = $MaxItems
} | ConvertTo-Json

$headers = @{
    "x-api-key" = $ApiKey
    "Content-Type" = "application/json"
}

try {
    $collectResponse = Invoke-RestMethod `
        -Uri "$ApiEndpoint/collect" `
        -Method Post `
        -Headers $headers `
        -Body $collectBody `
        -ErrorAction Stop
    
    # レスポンス構造: { status: "success", data: { execution_id: "..." } }
    $executionId = $collectResponse.data.execution_id
    Write-Host "✅ データ収集開始: execution_id = $executionId" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ データ収集リクエスト失敗: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. 実行状態をポーリング
Write-Host "[2/4] 実行状態を確認中..." -ForegroundColor Green

$maxRetries = 60  # 最大5分間（5秒間隔）
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    Start-Sleep -Seconds 5
    
    try {
        $statusResponse = Invoke-RestMethod `
            -Uri "$ApiEndpoint/collect/$executionId" `
            -Method Get `
            -Headers @{ "x-api-key" = $ApiKey } `
            -ErrorAction Stop
        
        # レスポンス構造: { status: "success", data: { status: "...", progress: ..., ... } }
        $data = $statusResponse.data
        $status = $data.status
        $progress = $data.progress
        $collected = $data.collected_count
        $failed = $data.failed_count
        
        Write-Host "  進捗: $progress% | 収集: $collected 件 | 失敗: $failed 件 | 状態: $status" -ForegroundColor Cyan
        
        if ($status -eq "completed") {
            Write-Host "✅ データ収集完了" -ForegroundColor Green
            Write-Host ""
            break
        } elseif ($status -eq "failed") {
            Write-Host "❌ データ収集失敗" -ForegroundColor Red
            Write-Host "エラー: $($data.error_message)" -ForegroundColor Red
            exit 1
        }
        
        $retryCount++
    } catch {
        Write-Host "⚠️ 実行状態取得エラー: $($_.Exception.Message)" -ForegroundColor Yellow
        $retryCount++
    }
}

if ($retryCount -ge $maxRetries) {
    Write-Host "⚠️ タイムアウト: 実行状態の確認に失敗しました" -ForegroundColor Yellow
}

# 3. 収集結果を確認
Write-Host "[3/4] 収集結果を確認中..." -ForegroundColor Green

try {
    $queryParams = @(
        "limit=10",
        "start_date=$StartDate",
        "end_date=$EndDate"
    )
    $queryString = $queryParams -join '&'
    $uri = "$ApiEndpoint/disclosures?$queryString"
    
    $disclosuresResponse = Invoke-RestMethod `
        -Uri $uri `
        -Method Get `
        -Headers @{ "x-api-key" = $ApiKey } `
        -ErrorAction Stop
    
    # レスポンス構造: { status: "success", data: { total_count: ..., items: [...] } }
    $data = $disclosuresResponse.data
    $totalCount = $data.total_count
    $items = $data.items
    
    Write-Host "✅ 収集データ確認: 合計 $totalCount 件" -ForegroundColor Green
    Write-Host ""
    
    if ($items.Count -gt 0) {
        Write-Host "最新の開示情報（最大10件）:" -ForegroundColor Yellow
        foreach ($item in $items) {
            Write-Host "  - [$($item.company_code)] $($item.company_name): $($item.title)" -ForegroundColor White
        }
        Write-Host ""
    }
} catch {
    Write-Host "⚠️ 収集結果確認エラー: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 4. 最終結果サマリー
Write-Host "[4/4] 最終結果" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "実行ID: $executionId" -ForegroundColor White
Write-Host "収集期間: $StartDate 〜 $EndDate" -ForegroundColor White
Write-Host "収集件数: $collected 件" -ForegroundColor White
Write-Host "失敗件数: $failed 件" -ForegroundColor White
Write-Host "状態: $status" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($status -eq "completed" -and $collected -gt 0) {
    Write-Host "✅ データ収集が正常に完了しました" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️ データ収集に問題がありました" -ForegroundColor Yellow
    exit 1
}

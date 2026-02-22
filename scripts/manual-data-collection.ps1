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
# PowerShell 5.1では明示的にUTF8エンコーディングオブジェクトを使用
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# 本番環境設定
$ApiEndpoint = "https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod"
$Region = "ap-northeast-1"
$SecretName = "/tdnet/api-key-prod"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - 手動データ収集" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Secrets ManagerからAPIキーを取得
Write-Host "[0/4] APIキーを取得中..." -ForegroundColor Green
try {
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Secrets Manager接続失敗: $secretJson"
    }
    
    $secret = $secretJson | ConvertFrom-Json
    $ApiKey = $secret.api_key
    Write-Host "✅ APIキーを取得しました" -ForegroundColor Green
} catch {
    Write-Host "❌ APIキー取得失敗: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "" -ForegroundColor Yellow
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. Secrets Managerに $SecretName が登録されているか確認" -ForegroundColor White
    Write-Host "2. 登録されていない場合は、以下のコマンドで登録:" -ForegroundColor White
    Write-Host "   .\scripts\register-api-key.ps1 -Environment prod" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Yellow
    exit 1
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

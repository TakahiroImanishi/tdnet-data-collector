# Data Range Fetch Script
# Fetch data for a specific date range
# タスク8.1.2: 運用スクリプトの改善（環境情報自動取得）

param(
    [Parameter(Mandatory=$true)]
    [string]$Date,
    
    [Parameter(Mandatory=$false)]
    [int]$Offset = 0,
    
    [Parameter(Mandatory=$false)]
    [int]$Limit = 100,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Profile
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# 共通関数の読み込み
. "$PSScriptRoot/lib/get-stack-outputs.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet Data Collector - Data Range Fetch" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 環境情報を取得
try {
    Write-Host "環境情報を取得中..." -ForegroundColor Cyan
    $stackOutputs = Get-StackOutputs -Environment $Environment -Profile $Profile
    $ApiEndpoint = $stackOutputs.ApiEndpoint
    $Region = $stackOutputs.Region
    $SecretName = $stackOutputs.ApiKeySecretName
    Write-Host "✅ 環境情報を取得しました（環境: $Environment）" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "詳細: .kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md" -ForegroundColor Gray
    exit 1
}

# タスク1: エラー分類とリトライ機能
function Get-ApiKeyWithRetry {
    param(
        [string]$SecretName,
        [string]$Region,
        [string]$Profile,
        [int]$MaxRetries = 3
    )
    
    $retryCount = 0
    $delay = 2
    
    while ($retryCount -lt $MaxRetries) {
        try {
            # AWS CLIコマンド構築
            $awsCmd = "aws secretsmanager get-secret-value --secret-id `"$SecretName`" --region $Region"
            if ($Profile) {
                $awsCmd += " --profile $Profile"
            }
            $awsCmd += " --query SecretString --output text"
            
            # エラー出力を変数にキャプチャ
            $ErrorActionPreference = 'Continue'
            $secretJson = Invoke-Expression $awsCmd 2>&1
            $exitCode = $LASTEXITCODE
            $ErrorActionPreference = 'Stop'
            
            # 成功時
            if ($exitCode -eq 0 -and $secretJson -is [string]) {
                try {
                    $secret = $secretJson | ConvertFrom-Json
                    if ($secret.api_key) {
                        return $secret.api_key
                    } else {
                        throw [System.Exception]::new("INVALID_SECRET_FORMAT")
                    }
                } catch {
                    throw [System.Exception]::new("INVALID_SECRET_FORMAT")
                }
            }
            
            # エラー分類
            $errorMessage = $secretJson | Out-String
            if ($errorMessage -match "ResourceNotFoundException") {
                throw [System.Exception]::new("SECRET_NOT_FOUND")
            } elseif ($errorMessage -match "AccessDeniedException") {
                throw [System.Exception]::new("ACCESS_DENIED")
            } elseif ($errorMessage -match "ExpiredToken|InvalidClientTokenId") {
                throw [System.Exception]::new("AUTH_EXPIRED")
            } elseif ($errorMessage -match "Could not connect|Network|Timeout|Connection") {
                throw [System.Exception]::new("NETWORK_ERROR")
            } else {
                throw [System.Exception]::new("UNKNOWN_ERROR:$errorMessage")
            }
            
        } catch {
            $errorType = $_.Exception.Message
            
            # ネットワークエラーのみリトライ
            if ($errorType -eq "NETWORK_ERROR" -and $retryCount -lt ($MaxRetries - 1)) {
                $retryCount++
                Write-Host "⚠️ ネットワークエラー。$delay 秒後にリトライします... ($retryCount/$MaxRetries)" -ForegroundColor Yellow
                Start-Sleep -Seconds $delay
                $delay *= 2  # 指数バックオフ
                continue
            }
            
            # リトライ不可能なエラー、または最大リトライ回数到達
            throw $_
        }
    }
    
    # 最大リトライ回数到達
    throw [System.Exception]::new("NETWORK_ERROR")
}

# APIキー取得（タスク2: 環境変数フォールバック）
Write-Host "[0/2] APIキーを取得中..." -ForegroundColor Green

$ApiKey = $null

# まず環境変数をチェック
$envApiKey = $env:TDNET_API_KEY

if ($envApiKey) {
    Write-Host "ℹ️ 環境変数からAPIキーを使用します" -ForegroundColor Cyan
    $ApiKey = $envApiKey
} else {
    # Secrets Managerから取得
    try {
        $ApiKey = Get-ApiKeyWithRetry -SecretName $SecretName -Region $Region -Profile $Profile
        Write-Host "✅ Secrets ManagerからAPIキーを取得しました" -ForegroundColor Green
    } catch {
        $errorType = $_.Exception.Message
        
        # タスク3: エラーメッセージの改善
        Write-Host "❌ APIキーの取得に失敗しました" -ForegroundColor Red
        Write-Host ""
        
        switch -Regex ($errorType) {
            "^SECRET_NOT_FOUND" {
                Write-Host "原因: Secrets Managerにシークレットが登録されていません" -ForegroundColor Yellow
                Write-Host "シークレット名: $SecretName" -ForegroundColor Gray
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. 以下のコマンドでシークレットを登録してください:" -ForegroundColor White
                Write-Host "   .\scripts\create-api-key-secret.ps1 -Environment $Environment" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            "^ACCESS_DENIED" {
                Write-Host "原因: Secrets Managerへのアクセス権限がありません" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. IAMポリシーを確認してください:" -ForegroundColor White
                Write-Host "   - secretsmanager:GetSecretValue" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            "^AUTH_EXPIRED" {
                Write-Host "原因: AWS認証が期限切れです" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. AWS SSOで再ログインしてください:" -ForegroundColor White
                Write-Host "   aws sso login --profile $Profile" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. 認証状態を確認してください:" -ForegroundColor White
                Write-Host "   aws sts get-caller-identity --profile $Profile" -ForegroundColor Gray
            }
            "^NETWORK_ERROR" {
                Write-Host "原因: ネットワークエラー（最大リトライ回数に到達）" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. ネットワーク接続を確認してください:" -ForegroundColor White
                Write-Host "   ping aws.amazon.com" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. AWS CLIの設定を確認してください:" -ForegroundColor White
                Write-Host "   aws configure list --profile $Profile" -ForegroundColor Gray
                Write-Host ""
                Write-Host "3. または、環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
            "^INVALID_SECRET_FORMAT" {
                Write-Host "原因: シークレットの形式が不正です" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "1. シークレットの内容を確認してください:" -ForegroundColor White
                Write-Host "   aws secretsmanager get-secret-value --secret-id $SecretName --region $Region --profile $Profile" -ForegroundColor Gray
                Write-Host ""
                Write-Host "2. シークレットは以下の形式である必要があります:" -ForegroundColor White
                Write-Host '   {"api_key": "your-api-key"}' -ForegroundColor Gray
            }
            default {
                Write-Host "原因: 不明なエラー" -ForegroundColor Yellow
                Write-Host "エラー詳細: $errorType" -ForegroundColor Gray
                Write-Host ""
                Write-Host "解決方法:" -ForegroundColor Cyan
                Write-Host "環境変数を設定してください:" -ForegroundColor White
                Write-Host "   `$env:TDNET_API_KEY = 'your-api-key'" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host "詳細: .kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md" -ForegroundColor Gray
        exit 1
    }
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

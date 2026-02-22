# Secrets ManagerにAPIキーを登録するスクリプト
# タスク1.1: APIキー登録の自動化

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$ApiKeyValue = ""
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TDnet APIキー登録スクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "環境: $Environment" -ForegroundColor Yellow
Write-Host ""

# リージョン設定
$Region = "ap-northeast-1"
$SecretName = "/tdnet/api-key-$Environment"

# APIキーの取得
if (-not $ApiKeyValue) {
    Write-Host "APIキーを入力してください: " -NoNewline -ForegroundColor Yellow
    $ApiKeyValue = Read-Host
}

if (-not $ApiKeyValue) {
    Write-Host "❌ APIキーが入力されていません" -ForegroundColor Red
    exit 1
}

Write-Host ""

# シークレット値の準備
$secretValue = @{
    api_key = $ApiKeyValue
    created_at = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    environment = $Environment
} | ConvertTo-Json -Compress

# Secrets Managerに登録
Write-Host "Secrets Managerに登録中..." -ForegroundColor Green

try {
    # 既存のシークレットを確認
    $existingSecret = aws secretsmanager describe-secret `
        --secret-id $SecretName `
        --region $Region `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        # 既存のシークレットを更新
        $result = aws secretsmanager put-secret-value `
            --secret-id $SecretName `
            --secret-string $secretValue `
            --region $Region `
            --output json
        
        Write-Host "✅ シークレットを更新しました" -ForegroundColor Green
    } else {
        # 新しいシークレットを作成
        $result = aws secretsmanager create-secret `
            --name $SecretName `
            --description "TDnet Data Collector API Key ($Environment)" `
            --secret-string $secretValue `
            --region $Region `
            --output json
        
        Write-Host "✅ シークレットを作成しました" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ APIキーの登録が完了しました" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host "❌ Secrets Manager登録失敗: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

exit 0

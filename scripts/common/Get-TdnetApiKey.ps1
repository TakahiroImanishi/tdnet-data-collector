# Get-TdnetApiKey.ps1
# Secrets ManagerからTDnet APIキーを取得する共通関数

<#
.SYNOPSIS
    Secrets ManagerからTDnet APIキーを取得します。

.DESCRIPTION
    このスクリプトは、AWS Secrets ManagerからTDnet APIキーを安全に取得します。
    キャッシュ機能により、同一スクリプト実行中の複数回呼び出しでもAPIコールを最小化します。
    環境変数TDNET_API_KEYが設定されている場合は、それを優先使用します。

.PARAMETER Environment
    環境名（prod/dev）。デフォルトは"prod"。
    Secrets Managerのシークレット名は "/tdnet/api-key-{Environment}" となります。

.PARAMETER NoCache
    キャッシュを使用せず、常にSecrets Managerから取得します。

.PARAMETER Verbose
    詳細なログ出力を有効にします。

.EXAMPLE
    # 本番環境のAPIキーを取得（キャッシュ有効）
    $apiKey = .\scripts\common\Get-TdnetApiKey.ps1

.EXAMPLE
    # 開発環境のAPIキーを取得
    $apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Environment dev

.EXAMPLE
    # キャッシュを使用せずに取得
    $apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -NoCache

.EXAMPLE
    # 詳細ログ付きで取得
    $apiKey = .\scripts\common\Get-TdnetApiKey.ps1 -Verbose

.NOTES
    作成日: 2026-02-22
    タスク: タスク2.3 - 共通関数の作成
    
    前提条件:
    - AWS CLIがインストールされていること
    - Secrets Managerへのアクセス権限（secretsmanager:GetSecretValue）
    - Secrets Managerにシークレットが登録されていること
    
    フォールバック順序:
    1. 環境変数 TDNET_API_KEY（設定されている場合）
    2. キャッシュ（NoCache未指定かつキャッシュ存在時）
    3. Secrets Manager（上記が利用できない場合）
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("prod", "dev")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoCache,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# グローバルキャッシュ変数（スクリプトスコープ）
if (-not $script:ApiKeyCache) {
    $script:ApiKeyCache = @{}
}

# 詳細ログ出力関数
function Write-VerboseLog {
    param([string]$Message)
    if ($Verbose) {
        Write-Host "[VERBOSE] $Message" -ForegroundColor Gray
    }
}

# エラーメッセージ出力関数
function Write-ErrorMessage {
    param(
        [string]$Message,
        [string]$Solution
    )
    Write-Host "❌ $Message" -ForegroundColor Red
    if ($Solution) {
        Write-Host "" -ForegroundColor Yellow
        Write-Host "対処方法:" -ForegroundColor Yellow
        Write-Host $Solution -ForegroundColor White
    }
}

try {
    Write-VerboseLog "APIキー取得開始: Environment=$Environment, NoCache=$NoCache"
    
    # 1. 環境変数からの取得を試行
    $envApiKey = $env:TDNET_API_KEY
    if ($envApiKey) {
        Write-VerboseLog "環境変数 TDNET_API_KEY からAPIキーを取得しました"
        Write-Host "✅ APIキーを取得しました（環境変数）" -ForegroundColor Green
        return $envApiKey
    }
    
    Write-VerboseLog "環境変数 TDNET_API_KEY は設定されていません"
    
    # 2. キャッシュからの取得を試行
    $cacheKey = "api-key-$Environment"
    if (-not $NoCache -and $script:ApiKeyCache.ContainsKey($cacheKey)) {
        Write-VerboseLog "キャッシュからAPIキーを取得しました"
        Write-Host "✅ APIキーを取得しました（キャッシュ）" -ForegroundColor Green
        return $script:ApiKeyCache[$cacheKey]
    }
    
    Write-VerboseLog "キャッシュにAPIキーが存在しません。Secrets Managerから取得します"
    
    # 3. Secrets Managerから取得
    $secretName = "/tdnet/api-key-$Environment"
    $region = "ap-northeast-1"
    
    Write-VerboseLog "Secrets Manager取得: SecretName=$secretName, Region=$region"
    
    # AWS CLIでSecrets Managerから取得
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $secretName `
        --region $region `
        --query SecretString `
        --output text 2>&1
    
    # AWS CLIのエラーチェック
    if ($LASTEXITCODE -ne 0) {
        $errorMessage = $secretJson -join "`n"
        
        # エラーの種類に応じたメッセージ
        if ($errorMessage -match "ResourceNotFoundException") {
            Write-ErrorMessage `
                -Message "Secrets Managerにシークレットが見つかりません: $secretName" `
                -Solution @"
1. Secrets Managerに $secretName が登録されているか確認してください
2. 登録されていない場合は、以下のコマンドで登録してください:
   .\scripts\register-api-key.ps1 -Environment $Environment
"@
        } elseif ($errorMessage -match "AccessDeniedException") {
            Write-ErrorMessage `
                -Message "Secrets Managerへのアクセス権限がありません" `
                -Solution @"
1. IAMユーザー/ロールに secretsmanager:GetSecretValue 権限があるか確認してください
2. AWS CLIの認証情報が正しく設定されているか確認してください:
   aws sts get-caller-identity
"@
        } else {
            Write-ErrorMessage `
                -Message "Secrets Manager接続失敗" `
                -Solution "エラー詳細: $errorMessage"
        }
        
        throw "Secrets Manager接続失敗: $errorMessage"
    }
    
    Write-VerboseLog "Secrets Managerからのレスポンスを取得しました"
    
    # JSONパース
    try {
        $secret = $secretJson | ConvertFrom-Json
    } catch {
        Write-ErrorMessage `
            -Message "Secrets ManagerのレスポンスをJSONとしてパースできませんでした" `
            -Solution "Secrets Managerのシークレット形式が正しいか確認してください（JSON形式で api_key フィールドが必要）"
        throw "JSONパース失敗: $($_.Exception.Message)"
    }
    
    # api_keyフィールドの存在確認
    if (-not $secret.api_key) {
        Write-ErrorMessage `
            -Message "Secrets Managerのシークレットに api_key フィールドが存在しません" `
            -Solution @"
Secrets Managerのシークレット形式を確認してください。
期待される形式:
{
  "api_key": "your-api-key-here",
  "created_at": "2026-02-22T10:00:00Z",
  "environment": "$Environment"
}
"@
        throw "api_keyフィールドが存在しません"
    }
    
    $apiKey = $secret.api_key
    Write-VerboseLog "APIキーを正常に取得しました（長さ: $($apiKey.Length)文字）"
    
    # キャッシュに保存
    $script:ApiKeyCache[$cacheKey] = $apiKey
    Write-VerboseLog "APIキーをキャッシュに保存しました"
    
    Write-Host "✅ APIキーを取得しました（Secrets Manager）" -ForegroundColor Green
    return $apiKey
    
} catch {
    Write-VerboseLog "エラーが発生しました: $($_.Exception.Message)"
    
    # エラーメッセージが既に出力されていない場合のみ出力
    if (-not ($_.Exception.Message -match "Secrets Manager接続失敗|JSONパース失敗|api_keyフィールドが存在しません")) {
        Write-ErrorMessage `
            -Message "APIキー取得失敗: $($_.Exception.Message)" `
            -Solution ""
    }
    
    # エラーを再スロー（呼び出し元でキャッチ可能にする）
    throw
}

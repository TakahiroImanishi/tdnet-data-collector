# Get-TdnetApiKey.ps1
# Secrets ManagerからTDnet APIキーを取得する共通関数

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("prod", "dev")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoCache,
    
    [Parameter(Mandatory=$false)]
    [switch]$VerboseLog
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# グローバルキャッシュ変数
if (-not $script:ApiKeyCache) {
    $script:ApiKeyCache = @{}
}

function Write-VerboseLog {
    param([string]$Message)
    if ($VerboseLog) {
        Write-Host "[VERBOSE] $Message" -ForegroundColor Gray
    }
}

function Write-ErrorMessage {
    param([string]$Message, [string]$Solution)
    Write-Host "Error: $Message" -ForegroundColor Red
    if ($Solution) {
        Write-Host "" -ForegroundColor Yellow
        Write-Host "Solution:" -ForegroundColor Yellow
        Write-Host $Solution -ForegroundColor White
    }
}

try {
    Write-VerboseLog "API key retrieval started: Environment=$Environment, NoCache=$NoCache"
    
    # 1. Try environment variable
    $envApiKey = $env:TDNET_API_KEY
    if ($envApiKey) {
        Write-VerboseLog "API key retrieved from environment variable TDNET_API_KEY"
        Write-Host "OK API key retrieved (environment variable)" -ForegroundColor Green
        return $envApiKey
    }
    
    Write-VerboseLog "Environment variable TDNET_API_KEY not set"
    
    # 2. Try cache
    $cacheKey = "api-key-$Environment"
    if (-not $NoCache -and $script:ApiKeyCache.ContainsKey($cacheKey)) {
        Write-VerboseLog "API key retrieved from cache"
        Write-Host "OK API key retrieved (cache)" -ForegroundColor Green
        return $script:ApiKeyCache[$cacheKey]
    }
    
    Write-VerboseLog "Cache miss. Retrieving from Secrets Manager"
    
    # 3. Retrieve from Secrets Manager
    $secretName = "/tdnet/api-key-$Environment"
    $region = "ap-northeast-1"
    
    Write-VerboseLog "Secrets Manager retrieval: SecretName=$secretName, Region=$region"
    
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $secretName `
        --region $region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        $errorMessage = $secretJson -join "`n"
        
        if ($errorMessage -match "ResourceNotFoundException") {
            Write-ErrorMessage `
                -Message "Secret not found in Secrets Manager: $secretName" `
                -Solution "1. Check if $secretName is registered in Secrets Manager`n2. If not registered, run: .\scripts\register-api-key.ps1 -Environment $Environment"
        } elseif ($errorMessage -match "AccessDeniedException") {
            Write-ErrorMessage `
                -Message "Access denied to Secrets Manager" `
                -Solution "1. Check if IAM user/role has secretsmanager:GetSecretValue permission`n2. Verify AWS CLI credentials: aws sts get-caller-identity"
        } else {
            Write-ErrorMessage `
                -Message "Secrets Manager connection failed" `
                -Solution "Error details: $errorMessage"
        }
        
        throw "Secrets Manager connection failed: $errorMessage"
    }
    
    Write-VerboseLog "Response received from Secrets Manager"
    
    try {
        $secret = $secretJson | ConvertFrom-Json
    } catch {
        Write-ErrorMessage `
            -Message "Failed to parse Secrets Manager response as JSON" `
            -Solution "Check if secret format is correct (JSON format with api_key field required)"
        throw "JSON parse failed: $($_.Exception.Message)"
    }
    
    if (-not $secret.api_key) {
        Write-ErrorMessage `
            -Message "api_key field not found in Secrets Manager secret" `
            -Solution "Check secret format. Expected format:`n{`n  `"api_key`": `"your-api-key-here`",`n  `"created_at`": `"2026-02-22T10:00:00Z`",`n  `"environment`": `"$Environment`"`n}"
        throw "api_key field not found"
    }
    
    $apiKey = $secret.api_key
    Write-VerboseLog "API key retrieved successfully (length: $($apiKey.Length) characters)"
    
    # Save to cache
    $script:ApiKeyCache[$cacheKey] = $apiKey
    Write-VerboseLog "API key saved to cache"
    
    Write-Host "OK API key retrieved (Secrets Manager)" -ForegroundColor Green
    return $apiKey
    
} catch {
    Write-VerboseLog "Error occurred: $($_.Exception.Message)"
    
    if (-not ($_.Exception.Message -match "Secrets Manager connection failed|JSON parse failed|api_key field not found")) {
        Write-ErrorMessage `
            -Message "API key retrieval failed: $($_.Exception.Message)" `
            -Solution ""
    }
    
    throw
}
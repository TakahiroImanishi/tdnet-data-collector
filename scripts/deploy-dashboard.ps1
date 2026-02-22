param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "dev",
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "AWS Account IDを取得中..." "Cyan"
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: AWS認証情報が設定されていません" "Red"
    exit 1
}
Write-ColorOutput "Account ID: $accountId" "Green"

$bucketName = "tdnet-dashboard-$Environment-$accountId"
$dashboardDir = Join-Path $PSScriptRoot ".." "dashboard"
$buildDir = Join-Path $dashboardDir "build"
$envFile = Join-Path $dashboardDir ".env.production"

# Secrets Managerから環境変数を取得して.env.productionを生成
if ($Environment -eq "prod") {
    Write-ColorOutput "`nSecrets Managerから環境変数を取得中..." "Cyan"
    
    try {
        # API URLをCDK Outputsから取得
        $apiUrl = aws cloudformation describe-stacks --stack-name "TdnetDataCollectorApiStack-$Environment" --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text 2>$null
        
        # API KeyをSecrets Managerから取得
        $secretName = "tdnet-api-key-$Environment"
        $apiKeyJson = aws secretsmanager get-secret-value --secret-id $secretName --query SecretString --output text 2>$null
        
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($apiKeyJson)) {
            $apiKeyObj = $apiKeyJson | ConvertFrom-Json
            $apiKey = $apiKeyObj.apiKey
            
            # .env.productionファイルを生成
            $envContent = @"
# API Gateway URL (本番環境)
REACT_APP_API_URL=$apiUrl

# API Key (本番環境用)
REACT_APP_API_KEY=$apiKey

# その他の設定
REACT_APP_ENV=production
"@
            
            # UTF-8 BOMなしで書き込み
            [System.IO.File]::WriteAllText($envFile, $envContent, (New-Object System.Text.UTF8Encoding $false))
            Write-ColorOutput "環境変数ファイルを生成しました: $envFile" "Green"
        }
        else {
            Write-ColorOutput "警告: Secrets Managerからシークレットを取得できませんでした" "Yellow"
            Write-ColorOutput "手動で.env.productionファイルを作成してください" "Yellow"
        }
    }
    catch {
        Write-ColorOutput "警告: 環境変数の取得に失敗しました: $_" "Yellow"
        Write-ColorOutput "手動で.env.productionファイルを作成してください" "Yellow"
    }
}

if (-not $SkipBuild) {
    Write-ColorOutput "`nダッシュボードをビルド中..." "Cyan"
    Push-Location $dashboardDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "ビルドに失敗しました"
        }
        Write-ColorOutput "ビルド完了" "Green"
    }
    catch {
        Write-ColorOutput "エラー: $_" "Red"
        Pop-Location
        exit 1
    }
    finally {
        Pop-Location
    }
}
else {
    Write-ColorOutput "`nビルドをスキップします" "Yellow"
}

if (-not (Test-Path $buildDir)) {
    Write-ColorOutput "エラー: ビルドディレクトリが見つかりません: $buildDir" "Red"
    exit 1
}

Write-ColorOutput "`nS3バケットの存在確認中..." "Cyan"
try {
    $null = aws s3 ls "s3://$bucketName" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Bucket not found"
    }
    Write-ColorOutput "S3バケット確認完了" "Green"
}
catch {
    Write-ColorOutput "警告: S3バケット '$bucketName' が見つかりません" "Yellow"
    Write-ColorOutput "CDKスタックをデプロイしてバケットを作成してください" "Yellow"
    exit 1
}

Write-ColorOutput "`nS3へファイルをアップロード中..." "Cyan"
aws s3 sync $buildDir "s3://$bucketName/" --delete --cache-control "public, max-age=31536000" --exclude "index.html" --exclude "*.map"
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: S3アップロードに失敗しました" "Red"
    exit 1
}

Write-ColorOutput "index.htmlをアップロード中..." "Cyan"
$indexPath = Join-Path $buildDir "index.html"
aws s3 cp $indexPath "s3://$bucketName/index.html" --cache-control "public, max-age=60"
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: index.htmlのアップロードに失敗しました" "Red"
    exit 1
}
Write-ColorOutput "S3アップロード完了" "Green"

Write-ColorOutput "`nCloudFront Distribution IDを取得中..." "Cyan"
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName==``$bucketName.s3.amazonaws.com``]].Id | [0]" --output text

if ([string]::IsNullOrWhiteSpace($distributionId) -or $distributionId -eq "None") {
    Write-ColorOutput "警告: CloudFront Distributionが見つかりません" "Yellow"
    Write-ColorOutput "CDKスタックをデプロイしてCloudFrontを作成してください" "Yellow"
    Write-ColorOutput "`nデプロイ完了（CloudFront Invalidationなし）" "Green"
    exit 0
}

Write-ColorOutput "Distribution ID: $distributionId" "Green"

Write-ColorOutput "`nCloudFront Invalidationを実行中..." "Cyan"
$invalidationId = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --query "Invalidation.Id" --output text
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: CloudFront Invalidationに失敗しました" "Red"
    exit 1
}

Write-ColorOutput "Invalidation ID: $invalidationId" "Green"
Write-ColorOutput "`nデプロイ完了!" "Green"
Write-ColorOutput "CloudFront URLでダッシュボードにアクセスできます" "Cyan"

$distributionDomain = aws cloudfront get-distribution --id $distributionId --query "Distribution.DomainName" --output text
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "`nダッシュボードURL: https://$distributionDomain" "Cyan"
}

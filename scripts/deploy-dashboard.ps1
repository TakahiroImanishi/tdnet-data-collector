# TDnet Dashboard デプロイスクリプト
# S3へのビルド成果物アップロードとCloudFront Invalidationを実行

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "dev",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# カラー出力用関数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# AWS Account IDを取得
Write-ColorOutput "AWS Account IDを取得中..." "Cyan"
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: AWS認証情報が設定されていません" "Red"
    exit 1
}
Write-ColorOutput "Account ID: $accountId" "Green"

# 変数設定
$bucketName = "tdnet-dashboard-$accountId"
$dashboardDir = Join-Path $PSScriptRoot ".." "dashboard"
$buildDir = Join-Path $dashboardDir "build"

# ビルド実行
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
    finally {
        Pop-Location
    }
} else {
    Write-ColorOutput "`nビルドをスキップします" "Yellow"
}

# ビルドディレクトリの存在確認
if (-not (Test-Path $buildDir)) {
    Write-ColorOutput "エラー: ビルドディレクトリが見つかりません: $buildDir" "Red"
    exit 1
}

# S3バケットの存在確認
Write-ColorOutput "`nS3バケットの存在確認中..." "Cyan"
$bucketExists = aws s3 ls "s3://$bucketName" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "警告: S3バケット '$bucketName' が見つかりません" "Yellow"
    Write-ColorOutput "CDKスタックをデプロイしてバケットを作成してください" "Yellow"
    exit 1
}
Write-ColorOutput "S3バケット確認完了" "Green"

# S3へアップロード
Write-ColorOutput "`nS3へファイルをアップロード中..." "Cyan"
aws s3 sync $buildDir "s3://$bucketName/" --delete --cache-control "public, max-age=31536000" --exclude "index.html" --exclude "*.map"
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: S3アップロードに失敗しました" "Red"
    exit 1
}

# index.htmlは短いキャッシュ時間で個別にアップロード
Write-ColorOutput "index.htmlをアップロード中..." "Cyan"
aws s3 cp (Join-Path $buildDir "index.html") "s3://$bucketName/index.html" --cache-control "public, max-age=60"
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: index.htmlのアップロードに失敗しました" "Red"
    exit 1
}
Write-ColorOutput "S3アップロード完了" "Green"

# CloudFront Distribution IDを取得
Write-ColorOutput "`nCloudFront Distribution IDを取得中..." "Cyan"
$distributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?DomainName=='$bucketName.s3.amazonaws.com']].Id | [0]" --output text

if ([string]::IsNullOrWhiteSpace($distributionId) -or $distributionId -eq "None") {
    Write-ColorOutput "警告: CloudFront Distributionが見つかりません" "Yellow"
    Write-ColorOutput "CDKスタックをデプロイしてCloudFrontを作成してください" "Yellow"
    Write-ColorOutput "`nデプロイ完了（CloudFront Invalidationなし）" "Green"
    exit 0
}

Write-ColorOutput "Distribution ID: $distributionId" "Green"

# CloudFront Invalidation実行
Write-ColorOutput "`nCloudFront Invalidationを実行中..." "Cyan"
$invalidationId = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --query "Invalidation.Id" --output text
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "エラー: CloudFront Invalidationに失敗しました" "Red"
    exit 1
}

Write-ColorOutput "Invalidation ID: $invalidationId" "Green"
Write-ColorOutput "`nデプロイ完了！" "Green"
Write-ColorOutput "CloudFront URLでダッシュボードにアクセスできます" "Cyan"

# CloudFront URLを表示
$distributionDomain = aws cloudfront get-distribution --id $distributionId --query "Distribution.DomainName" --output text
if ($LASTEXITCODE -eq 0) {
    Write-ColorOutput "`nダッシュボードURL: https://$distributionDomain" "Cyan"
}

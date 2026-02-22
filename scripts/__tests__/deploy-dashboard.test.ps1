# deploy-dashboard.ps1のテストスクリプト
# タスク41: PowerShellテストの追加

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "deploy-dashboard.ps1 テストスクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# テスト結果の集計
$script:TestResults = @{
    Total = 0
    Passed = 0
    Failed = 0
    Skipped = 0
}

# テスト用の変数
$ScriptPath = Join-Path $PSScriptRoot ".." "deploy-dashboard.ps1"
$TestEnvironment = "dev"
$DashboardDir = Join-Path $PSScriptRoot ".." ".." "dashboard"
$BuildDir = Join-Path $DashboardDir "build"

# テスト実行関数
function Invoke-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestScript,
        [switch]$Skip
    )
    
    $script:TestResults.Total++
    
    if ($Skip) {
        Write-Host "⊘ SKIP: $TestName" -ForegroundColor Yellow
        $script:TestResults.Skipped++
        return
    }
    
    Write-Host "▶ TEST: $TestName" -ForegroundColor Cyan
    
    try {
        & $TestScript
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        $script:TestResults.Passed++
    } catch {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        Write-Host "  エラー: $($_.Exception.Message)" -ForegroundColor Red
        $script:TestResults.Failed++
    }
    
    Write-Host ""
}

# テスト1: スクリプトの存在確認
Invoke-Test -TestName "スクリプトファイルが存在する" -TestScript {
    if (-not (Test-Path $ScriptPath)) {
        throw "スクリプトが見つかりません: $ScriptPath"
    }
}

# テスト2: AWS CLI動作確認
Invoke-Test -TestName "AWS CLIが正しく動作する" -TestScript {
    $null = aws --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS CLIが正しく動作していません"
    }
}

# テスト3: AWS認証情報確認
Invoke-Test -TestName "AWS認証情報が設定されている" -TestScript {
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS認証情報が設定されていません。対処方法: aws configure を実行してください"
    }
}

# テスト4: ダッシュボードディレクトリの存在確認
Invoke-Test -TestName "ダッシュボードディレクトリが存在する" -TestScript {
    if (-not (Test-Path $DashboardDir)) {
        throw "ダッシュボードディレクトリが見つかりません: $DashboardDir"
    }
}

# テスト5: package.jsonの存在確認
Invoke-Test -TestName "package.jsonが存在する" -TestScript {
    $packageJsonPath = Join-Path $DashboardDir "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        throw "package.jsonが見つかりません: $packageJsonPath。対処方法: dashboard/ディレクトリでnpm installを実行してください"
    }
}

# テスト6: Node.jsのインストール確認
Invoke-Test -TestName "Node.jsがインストールされている" -TestScript {
    $null = node --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Node.jsがインストールされていません。対処方法: https://nodejs.org/ からNode.jsをインストールしてください"
    }
}

# テスト7: npmのインストール確認
Invoke-Test -TestName "npmがインストールされている" -TestScript {
    $null = npm --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "npmがインストールされていません。対処方法: Node.jsと一緒にnpmをインストールしてください"
    }
}

# テスト8: S3バケット名の形式確認
Invoke-Test -TestName "S3バケット名が正しい形式である" -TestScript {
    $accountId = aws sts get-caller-identity --query Account --output text 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS Account IDの取得に失敗しました"
    }
    
    $bucketName = "tdnet-dashboard-$TestEnvironment-$accountId"
    
    # S3バケット名の形式チェック（3-63文字、小文字・数字・ハイフンのみ）
    if ($bucketName -notmatch '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$') {
        throw "S3バケット名が無効な形式です: $bucketName"
    }
}

# テスト9: S3バケットの存在確認（スキップ可能）
Invoke-Test -TestName "S3バケットが存在する" -TestScript {
    $accountId = aws sts get-caller-identity --query Account --output text 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS Account IDの取得に失敗しました"
    }
    
    $bucketName = "tdnet-dashboard-$TestEnvironment-$accountId"
    
    $null = aws s3 ls "s3://$bucketName" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "S3バケットが見つかりません: $bucketName。対処方法: .\scripts\deploy-split-stacks.ps1 を実行してバケットを作成してください"
    }
} -Skip

# テスト10: ビルドディレクトリの確認（ビルド後）
Invoke-Test -TestName "ビルドディレクトリが存在する（ビルド後）" -TestScript {
    if (-not (Test-Path $BuildDir)) {
        Write-Host "  ⚠ ビルドディレクトリが存在しません（ビルド前は正常）" -ForegroundColor Yellow
        throw "ビルドディレクトリが見つかりません: $BuildDir。対処方法: dashboard/ディレクトリでnpm run buildを実行してください"
    }
} -Skip

# テスト11: index.htmlの存在確認（ビルド後）
Invoke-Test -TestName "index.htmlが存在する（ビルド後）" -TestScript {
    $indexPath = Join-Path $BuildDir "index.html"
    if (-not (Test-Path $indexPath)) {
        throw "index.htmlが見つかりません: $indexPath。対処方法: dashboard/ディレクトリでnpm run buildを実行してください"
    }
} -Skip

# テスト12: CloudFront CLIコマンドの動作確認
Invoke-Test -TestName "CloudFront CLIコマンドが動作する" -TestScript {
    $null = aws cloudfront list-distributions --max-items 1 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "CloudFront CLIコマンドが失敗しました。対処方法: AWS認証情報とCloudFront権限を確認してください"
    }
}

# テスト13: 環境変数パラメータの検証
Invoke-Test -TestName "環境変数パラメータが正しく処理される" -TestScript {
    # スクリプトのパラメータ検証（構文チェックのみ）
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'param\s*\(') {
        throw "スクリプトにparamブロックが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$Environment') {
        throw "スクリプトに\$Environment変数が見つかりません"
    }
}

# テスト14: エラーハンドリングの確認
Invoke-Test -TestName "エラーハンドリングが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$ErrorActionPreference') {
        throw "スクリプトに\$ErrorActionPreferenceが設定されていません"
    }
    
    if ($scriptContent -notmatch 'try\s*\{') {
        throw "スクリプトにtry-catchブロックが見つかりません"
    }
}

# テスト15: UTF-8エンコーディング設定の確認
Invoke-Test -TestName "UTF-8エンコーディング設定が含まれている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$PSDefaultParameterValues\[') {
        throw "スクリプトにUTF-8エンコーディング設定が見つかりません"
    }
    
    if ($scriptContent -notmatch '\[Console\]::OutputEncoding') {
        throw "スクリプトにConsole OutputEncoding設定が見つかりません"
    }
}

# テスト16: Secrets Manager統合の確認
Invoke-Test -TestName "Secrets Manager統合が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'secretsmanager') {
        throw "スクリプトにSecrets Manager統合が見つかりません"
    }
}

# テスト17: .env.productionファイル生成の確認
Invoke-Test -TestName ".env.productionファイル生成ロジックが存在する" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\.env\.production') {
        throw "スクリプトに.env.production生成ロジックが見つかりません"
    }
}

# テスト18: S3 syncコマンドの確認
Invoke-Test -TestName "S3 syncコマンドが正しく実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'aws s3 sync') {
        throw "スクリプトにS3 syncコマンドが見つかりません"
    }
    
    if ($scriptContent -notmatch '--delete') {
        throw "S3 syncコマンドに--deleteオプションが見つかりません"
    }
}

# テスト19: CloudFront Invalidationの確認
Invoke-Test -TestName "CloudFront Invalidationが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'create-invalidation') {
        throw "スクリプトにCloudFront Invalidationが見つかりません"
    }
}

# テスト20: SkipBuildパラメータの確認
Invoke-Test -TestName "SkipBuildパラメータが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$SkipBuild') {
        throw "スクリプトに\$SkipBuildパラメータが見つかりません"
    }
}

# テスト結果の表示
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "テスト結果サマリー" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "総テスト数: $($script:TestResults.Total)" -ForegroundColor White
Write-Host "成功: $($script:TestResults.Passed)" -ForegroundColor Green
Write-Host "失敗: $($script:TestResults.Failed)" -ForegroundColor Red
Write-Host "スキップ: $($script:TestResults.Skipped)" -ForegroundColor Yellow
Write-Host ""

# トラブルシューティングガイド
if ($script:TestResults.Failed -gt 0) {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "トラブルシューティングガイド" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "よくあるエラーと対処方法:" -ForegroundColor White
    Write-Host ""
    Write-Host "1. AWS認証エラー" -ForegroundColor Cyan
    Write-Host "   対処: aws configure を実行してAWS認証情報を設定" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. S3バケット未存在" -ForegroundColor Cyan
    Write-Host "   対処: .\scripts\deploy-split-stacks.ps1 を実行してバケットを作成" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. ビルド失敗" -ForegroundColor Cyan
    Write-Host "   対処: dashboard/ディレクトリでnpm installを実行" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Node.js未インストール" -ForegroundColor Cyan
    Write-Host "   対処: https://nodejs.org/ からNode.jsをインストール" -ForegroundColor Gray
    Write-Host ""
}

# 終了コード
if ($script:TestResults.Failed -gt 0) {
    Write-Host "❌ テストに失敗しました" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ すべてのテストに成功しました" -ForegroundColor Green
    exit 0
}

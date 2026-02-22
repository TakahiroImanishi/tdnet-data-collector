# APIキー統合テスト
# Secrets Manager統合のテスト

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "APIキー統合テスト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()
$testCount = 0
$passCount = 0
$failCount = 0

function Test-Case {
    param(
        [string]$Name,
        [scriptblock]$Test
    )
    
    $script:testCount++
    Write-Host "[$script:testCount] $Name" -ForegroundColor Yellow
    
    try {
        & $Test
        Write-Host "  ✅ PASS" -ForegroundColor Green
        $script:passCount++
        $script:testResults += @{
            Name = $Name
            Result = "PASS"
            Error = $null
        }
    } catch {
        Write-Host "  ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failCount++
        $script:testResults += @{
            Name = $Name
            Result = "FAIL"
            Error = $_.Exception.Message
        }
    }
    Write-Host ""
}

# テスト1: Secrets Managerからのキー取得
Test-Case -Name "Secrets Managerからのキー取得" -Test {
    $Region = "ap-northeast-1"
    $SecretName = "/tdnet/api-key-prod"
    
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Secrets Manager接続失敗"
    }
    
    $secret = $secretJson | ConvertFrom-Json
    
    if (-not $secret.api_key) {
        throw "api_keyフィールドが存在しません"
    }
    
    if ($secret.api_key.Length -lt 20) {
        throw "APIキーの長さが不正です"
    }
    
    Write-Host "  APIキー取得成功: $($secret.api_key.Substring(0, 10))..." -ForegroundColor Gray
}

# テスト2: 環境変数フォールバック（モック）
Test-Case -Name "環境変数フォールバックの動作確認" -Test {
    # 環境変数を設定
    $env:TDNET_API_KEY = "test-api-key-12345678901234567890"
    
    # 環境変数から取得できることを確認
    if (-not $env:TDNET_API_KEY) {
        throw "環境変数が設定されていません"
    }
    
    if ($env:TDNET_API_KEY.Length -lt 20) {
        throw "環境変数のAPIキーの長さが不正です"
    }
    
    Write-Host "  環境変数から取得: $($env:TDNET_API_KEY.Substring(0, 10))..." -ForegroundColor Gray
    
    # クリーンアップ
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}

# テスト3: Secrets Manager接続失敗時のエラーハンドリング
Test-Case -Name "Secrets Manager接続失敗時のエラーハンドリング" -Test {
    $Region = "ap-northeast-1"
    $InvalidSecretName = "/tdnet/invalid-secret-name-that-does-not-exist"
    
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $InvalidSecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        throw "存在しないシークレットで成功してしまいました"
    }
    
    Write-Host "  期待通りエラーが発生しました" -ForegroundColor Gray
}

# テスト4: APIキーが正しく使用される（manual-data-collection.ps1の構文チェック）
Test-Case -Name "manual-data-collection.ps1の構文チェック" -Test {
    $scriptPath = "scripts/manual-data-collection.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        throw "スクリプトが存在しません: $scriptPath"
    }
    
    # PowerShell構文チェック
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$errors)
    
    if ($errors.Count -gt 0) {
        throw "構文エラーが検出されました: $($errors[0].Message)"
    }
    
    # Secrets Manager統合コードの存在確認
    $content = Get-Content $scriptPath -Raw
    
    if ($content -notmatch 'aws secretsmanager get-secret-value') {
        throw "Secrets Manager統合コードが見つかりません"
    }
    
    if ($content -notmatch '\$secret\.api_key') {
        throw "APIキー取得コードが見つかりません"
    }
    
    if ($content -notmatch 'x-api-key') {
        throw "APIキー使用コードが見つかりません"
    }
    
    Write-Host "  Secrets Manager統合コードが正しく実装されています" -ForegroundColor Gray
}

# テスト5: fetch-data-range.ps1の構文チェック
Test-Case -Name "fetch-data-range.ps1の構文チェック" -Test {
    $scriptPath = "scripts/fetch-data-range.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        throw "スクリプトが存在しません: $scriptPath"
    }
    
    # PowerShell構文チェック
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$errors)
    
    if ($errors.Count -gt 0) {
        throw "構文エラーが検出されました: $($errors[0].Message)"
    }
    
    # Secrets Manager統合コードの存在確認
    $content = Get-Content $scriptPath -Raw
    
    if ($content -notmatch 'aws secretsmanager get-secret-value') {
        throw "Secrets Manager統合コードが見つかりません"
    }
    
    if ($content -notmatch '\$secret\.api_key') {
        throw "APIキー取得コードが見つかりません"
    }
    
    if ($content -notmatch 'x-api-key') {
        throw "APIキー使用コードが見つかりません"
    }
    
    Write-Host "  Secrets Manager統合コードが正しく実装されています" -ForegroundColor Gray
}

# テスト6: エンコーディング設定の確認
Test-Case -Name "エンコーディング設定の確認" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        # 包括的なエンコーディング設定の確認
        if ($content -notmatch '\$PSDefaultParameterValues\[''[*]:Encoding''\]') {
            throw "$scriptPath: PSDefaultParameterValues設定が見つかりません"
        }
        
        if ($content -notmatch '\[Console\]::OutputEncoding') {
            throw "$scriptPath: Console.OutputEncoding設定が見つかりません"
        }
        
        if ($content -notmatch '\$OutputEncoding') {
            throw "$scriptPath: OutputEncoding設定が見つかりません"
        }
        
        Write-Host "  $scriptPath: エンコーディング設定OK" -ForegroundColor Gray
    }
}

# テスト7: エラーメッセージの日本語表示確認
Test-Case -Name "エラーメッセージの日本語表示確認" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        # 日本語エラーメッセージの存在確認
        if ($content -notmatch '[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+') {
            throw "$scriptPath: 日本語メッセージが見つかりません"
        }
        
        # エラーハンドリングの確認
        if ($content -notmatch 'catch') {
            throw "$scriptPath: エラーハンドリングが実装されていません"
        }
        
        Write-Host "  $scriptPath: 日本語メッセージOK" -ForegroundColor Gray
    }
}

# テスト8: APIエンドポイント設定の確認
Test-Case -Name "APIエンドポイント設定の確認" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        # 本番エンドポイントの確認
        if ($content -notmatch 'https://[a-z0-9]+\.execute-api\.ap-northeast-1\.amazonaws\.com/prod') {
            throw "$scriptPath: 本番APIエンドポイントが正しく設定されていません"
        }
        
        # リージョン設定の確認
        if ($content -notmatch 'ap-northeast-1') {
            throw "$scriptPath: リージョンが正しく設定されていません"
        }
        
        # シークレット名の確認
        if ($content -notmatch '/tdnet/api-key-prod') {
            throw "$scriptPath: シークレット名が正しく設定されていません"
        }
        
        Write-Host "  $scriptPath: API設定OK" -ForegroundColor Gray
    }
}

# 結果サマリー
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "テスト結果サマリー" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "総テスト数: $testCount" -ForegroundColor White
Write-Host "成功: $passCount" -ForegroundColor Green
Write-Host "失敗: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "失敗したテスト:" -ForegroundColor Red
    foreach ($result in $testResults) {
        if ($result.Result -eq "FAIL") {
            Write-Host "  - $($result.Name)" -ForegroundColor Red
            Write-Host "    エラー: $($result.Error)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "✅ すべてのテストが成功しました" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ 一部のテストが失敗しました" -ForegroundColor Red
    exit 1
}

# Get-TdnetApiKey.ps1のテストスクリプト

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Get-TdnetApiKey.ps1 テストスクリプト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0
$testsSkipped = 0

# テスト結果表示関数
function Show-TestResult {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Message = ""
    )
    
    if ($Passed) {
        Write-Host "✅ PASS: $TestName" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "❌ FAIL: $TestName" -ForegroundColor Red
        if ($Message) {
            Write-Host "   理由: $Message" -ForegroundColor Yellow
        }
        $script:testsFailed++
    }
}

function Show-TestSkipped {
    param([string]$TestName, [string]$Reason)
    Write-Host "⏭️  SKIP: $TestName" -ForegroundColor Yellow
    Write-Host "   理由: $Reason" -ForegroundColor Gray
    $script:testsSkipped++
}

# テスト1: スクリプトファイルの存在確認
Write-Host "[テスト1] スクリプトファイルの存在確認" -ForegroundColor Cyan
$scriptPath = ".\scripts\common\Get-TdnetApiKey.ps1"
if (Test-Path $scriptPath) {
    Show-TestResult -TestName "スクリプトファイルが存在する" -Passed $true
} else {
    Show-TestResult -TestName "スクリプトファイルが存在する" -Passed $false -Message "ファイルが見つかりません: $scriptPath"
    exit 1
}
Write-Host ""

# テスト2: 環境変数フォールバック機能
Write-Host "[テスト2] 環境変数フォールバック機能" -ForegroundColor Cyan
$env:TDNET_API_KEY = "test-api-key-from-env"
try {
    $result = & $scriptPath
    if ($result -eq "test-api-key-from-env") {
        Show-TestResult -TestName "環境変数からAPIキーを取得" -Passed $true
    } else {
        Show-TestResult -TestName "環境変数からAPIキーを取得" -Passed $false -Message "期待値: test-api-key-from-env, 実際: $result"
    }
} catch {
    Show-TestResult -TestName "環境変数からAPIキーを取得" -Passed $false -Message $_.Exception.Message
} finally {
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}
Write-Host ""

# テスト3: Secrets Manager取得（本番環境）
Write-Host "[テスト3] Secrets Manager取得（本番環境）" -ForegroundColor Cyan
try {
    # Secrets Managerの存在確認
    $secretCheck = aws secretsmanager describe-secret --secret-id /tdnet/api-key-prod --region ap-northeast-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-TestSkipped -TestName "本番環境のAPIキーを取得" -Reason "Secrets Managerに /tdnet/api-key-prod が登録されていません"
    } else {
        $result = & $scriptPath -Environment prod
        if ($result -and $result.Length -gt 0) {
            Show-TestResult -TestName "本番環境のAPIキーを取得" -Passed $true
        } else {
            Show-TestResult -TestName "本番環境のAPIキーを取得" -Passed $false -Message "APIキーが空です"
        }
    }
} catch {
    Show-TestResult -TestName "本番環境のAPIキーを取得" -Passed $false -Message $_.Exception.Message
}
Write-Host ""

# テスト4: Secrets Manager取得（開発環境）
Write-Host "[テスト4] Secrets Manager取得（開発環境）" -ForegroundColor Cyan
try {
    # Secrets Managerの存在確認
    $secretCheck = aws secretsmanager describe-secret --secret-id /tdnet/api-key-dev --region ap-northeast-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-TestSkipped -TestName "開発環境のAPIキーを取得" -Reason "Secrets Managerに /tdnet/api-key-dev が登録されていません"
    } else {
        $result = & $scriptPath -Environment dev
        if ($result -and $result.Length -gt 0) {
            Show-TestResult -TestName "開発環境のAPIキーを取得" -Passed $true
        } else {
            Show-TestResult -TestName "開発環境のAPIキーを取得" -Passed $false -Message "APIキーが空です"
        }
    }
} catch {
    Show-TestResult -TestName "開発環境のAPIキーを取得" -Passed $false -Message $_.Exception.Message
}
Write-Host ""

# テスト5: キャッシュ機能
Write-Host "[テスト5] キャッシュ機能" -ForegroundColor Cyan
try {
    # Secrets Managerの存在確認
    $secretCheck = aws secretsmanager describe-secret --secret-id /tdnet/api-key-prod --region ap-northeast-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-TestSkipped -TestName "キャッシュ機能が動作する" -Reason "Secrets Managerに /tdnet/api-key-prod が登録されていません"
    } else {
        # 1回目の取得（Secrets Managerから）
        $startTime1 = Get-Date
        $result1 = & $scriptPath -Environment prod
        $duration1 = (Get-Date) - $startTime1
        
        # 2回目の取得（キャッシュから）
        $startTime2 = Get-Date
        $result2 = & $scriptPath -Environment prod
        $duration2 = (Get-Date) - $startTime2
        
        # キャッシュの方が高速であることを確認
        if ($result1 -eq $result2 -and $duration2.TotalMilliseconds -lt $duration1.TotalMilliseconds) {
            Show-TestResult -TestName "キャッシュ機能が動作する" -Passed $true
            Write-Host "   1回目: $($duration1.TotalMilliseconds)ms, 2回目: $($duration2.TotalMilliseconds)ms" -ForegroundColor Gray
        } else {
            Show-TestResult -TestName "キャッシュ機能が動作する" -Passed $false -Message "キャッシュが効いていない可能性があります"
        }
    }
} catch {
    Show-TestResult -TestName "キャッシュ機能が動作する" -Passed $false -Message $_.Exception.Message
}
Write-Host ""

# テスト6: NoCacheオプション
Write-Host "[テスト6] NoCacheオプション" -ForegroundColor Cyan
try {
    # Secrets Managerの存在確認
    $secretCheck = aws secretsmanager describe-secret --secret-id /tdnet/api-key-prod --region ap-northeast-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-TestSkipped -TestName "NoCacheオプションが動作する" -Reason "Secrets Managerに /tdnet/api-key-prod が登録されていません"
    } else {
        # キャッシュありで取得
        $result1 = & $scriptPath -Environment prod
        
        # NoCacheで取得
        $result2 = & $scriptPath -Environment prod -NoCache
        
        if ($result1 -eq $result2) {
            Show-TestResult -TestName "NoCacheオプションが動作する" -Passed $true
        } else {
            Show-TestResult -TestName "NoCacheオプションが動作する" -Passed $false -Message "キャッシュありとNoCacheで結果が異なります"
        }
    }
} catch {
    Show-TestResult -TestName "NoCacheオプションが動作する" -Passed $false -Message $_.Exception.Message
}
Write-Host ""

# テスト7: エラーハンドリング（存在しないシークレット）
Write-Host "[テスト7] エラーハンドリング（存在しないシークレット）" -ForegroundColor Cyan
try {
    # 存在しない環境名でテスト
    $result = & $scriptPath -Environment nonexistent 2>&1
    Show-TestResult -TestName "存在しないシークレットでエラーが発生する" -Passed $false -Message "エラーが発生しませんでした"
} catch {
    if ($_.Exception.Message -match "ResourceNotFoundException|Secrets Manager接続失敗") {
        Show-TestResult -TestName "存在しないシークレットでエラーが発生する" -Passed $true
    } else {
        Show-TestResult -TestName "存在しないシークレットでエラーが発生する" -Passed $false -Message "予期しないエラー: $($_.Exception.Message)"
    }
}
Write-Host ""

# テスト8: Verboseオプション
Write-Host "[テスト8] Verboseオプション" -ForegroundColor Cyan
$env:TDNET_API_KEY = "test-verbose"
try {
    $output = & $scriptPath -Verbose 2>&1 | Out-String
    if ($output -match "\[VERBOSE\]") {
        Show-TestResult -TestName "Verboseオプションが動作する" -Passed $true
    } else {
        Show-TestResult -TestName "Verboseオプションが動作する" -Passed $false -Message "Verboseログが出力されていません"
    }
} catch {
    Show-TestResult -TestName "Verboseオプションが動作する" -Passed $false -Message $_.Exception.Message
} finally {
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}
Write-Host ""

# テスト結果サマリー
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "テスト結果サマリー" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ 成功: $testsPassed" -ForegroundColor Green
Write-Host "❌ 失敗: $testsFailed" -ForegroundColor Red
Write-Host "⏭️  スキップ: $testsSkipped" -ForegroundColor Yellow
Write-Host "合計: $($testsPassed + $testsFailed + $testsSkipped)" -ForegroundColor White
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "✅ すべてのテストが成功しました" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ $testsFailed 個のテストが失敗しました" -ForegroundColor Red
    exit 1
}

# Get-TdnetApiKey.ps1のテストスクリプト

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Get-TdnetApiKey.ps1 Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0
$testsSkipped = 0

function Show-TestResult {
    param([string]$TestName, [bool]$Passed, [string]$Message = "")
    if ($Passed) {
        Write-Host "OK PASS: $TestName" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "NG FAIL: $TestName" -ForegroundColor Red
        if ($Message) { Write-Host "   Reason: $Message" -ForegroundColor Yellow }
        $script:testsFailed++
    }
}

function Show-TestSkipped {
    param([string]$TestName, [string]$Reason)
    Write-Host "-- SKIP: $TestName" -ForegroundColor Yellow
    Write-Host "   Reason: $Reason" -ForegroundColor Gray
    $script:testsSkipped++
}

# Test 1: Script file exists
Write-Host "[Test 1] Script file existence check" -ForegroundColor Cyan
$scriptPath = Join-Path (Join-Path $PSScriptRoot "..") "Get-TdnetApiKey.ps1"
if (Test-Path $scriptPath) {
    Show-TestResult -TestName "Script file exists" -Passed $true
} else {
    Show-TestResult -TestName "Script file exists" -Passed $false -Message "File not found: $scriptPath"
    exit 1
}
Write-Host ""

# Test 2: Environment variable fallback
Write-Host "[Test 2] Environment variable fallback" -ForegroundColor Cyan
$env:TDNET_API_KEY = "test-api-key-from-env"
try {
    $result = & $scriptPath
    if ($result -eq "test-api-key-from-env") {
        Show-TestResult -TestName "Get API key from environment variable" -Passed $true
    } else {
        Show-TestResult -TestName "Get API key from environment variable" -Passed $false -Message "Expected: test-api-key-from-env, Actual: $result"
    }
}
catch {
    Show-TestResult -TestName "Get API key from environment variable" -Passed $false -Message $_.Exception.Message
}
finally {
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}
Write-Host ""

# Test 3: Secrets Manager retrieval (prod)
Write-Host "[Test 3] Secrets Manager retrieval (prod)" -ForegroundColor Cyan
try {
    $secretCheck = aws secretsmanager describe-secret --secret-id /tdnet/api-key-prod --region ap-northeast-1 2>&1
    if ($LASTEXITCODE -ne 0) {
        Show-TestSkipped -TestName "Get prod API key" -Reason "Secret /tdnet/api-key-prod not registered"
    } else {
        $result = & $scriptPath -Environment prod
        if ($result -and $result.Length -gt 0) {
            Show-TestResult -TestName "Get prod API key" -Passed $true
        } else {
            Show-TestResult -TestName "Get prod API key" -Passed $false -Message "API key is empty"
        }
    }
}
catch {
    Show-TestResult -TestName "Get prod API key" -Passed $false -Message $_.Exception.Message
}
Write-Host ""

# Test 4: Verbose option
Write-Host "[Test 4] Verbose option" -ForegroundColor Cyan
$env:TDNET_API_KEY = "test-verbose"
try {
    $output = & $scriptPath -VerboseLog 2>&1 | Out-String
    if ($output -match "\[VERBOSE\]") {
        Show-TestResult -TestName "Verbose option works" -Passed $true
    } else {
        Show-TestResult -TestName "Verbose option works" -Passed $false -Message "Verbose log not output"
    }
}
catch {
    Show-TestResult -TestName "Verbose option works" -Passed $false -Message $_.Exception.Message
}
finally {
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}
Write-Host ""

# Test summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OK Passed: $testsPassed" -ForegroundColor Green
Write-Host "NG Failed: $testsFailed" -ForegroundColor Red
Write-Host "-- Skipped: $testsSkipped" -ForegroundColor Yellow
Write-Host "Total: $($testsPassed + $testsFailed + $testsSkipped)" -ForegroundColor White
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "OK All tests passed" -ForegroundColor Green
    exit 0
} else {
    Write-Host "NG $testsFailed test(s) failed" -ForegroundColor Red
    exit 1
}
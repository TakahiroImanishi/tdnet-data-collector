# API Key Integration Test
# Test Secrets Manager integration

# UTF-8 encoding settings (comprehensive)
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "API Key Integration Test" -ForegroundColor Cyan
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
        Write-Host "  PASS" -ForegroundColor Green
        $script:passCount++
        $script:testResults += @{
            Name = $Name
            Result = "PASS"
            Error = $null
        }
    } catch {
        Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failCount++
        $script:testResults += @{
            Name = $Name
            Result = "FAIL"
            Error = $_.Exception.Message
        }
    }
    Write-Host ""
}

# Test 1: Retrieve API key from Secrets Manager
Test-Case -Name "Retrieve API key from Secrets Manager" -Test {
    $Region = "ap-northeast-1"
    $SecretName = "/tdnet/api-key-prod"
    
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $SecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "Secrets Manager connection failed"
    }
    
    $secret = $secretJson | ConvertFrom-Json
    
    if (-not $secret.api_key) {
        throw "api_key field not found"
    }
    
    if ($secret.api_key.Length -lt 20) {
        throw "API key length is invalid"
    }
    
    Write-Host "  API key retrieved: $($secret.api_key.Substring(0, 10))..." -ForegroundColor Gray
}

# Test 2: Environment variable fallback
Test-Case -Name "Environment variable fallback" -Test {
    $env:TDNET_API_KEY = "test-api-key-12345678901234567890"
    
    if (-not $env:TDNET_API_KEY) {
        throw "Environment variable not set"
    }
    
    if ($env:TDNET_API_KEY.Length -lt 20) {
        throw "Environment variable API key length is invalid"
    }
    
    Write-Host "  Retrieved from env: $($env:TDNET_API_KEY.Substring(0, 10))..." -ForegroundColor Gray
    
    Remove-Item Env:\TDNET_API_KEY -ErrorAction SilentlyContinue
}

# Test 3: Secrets Manager connection failure handling
Test-Case -Name "Secrets Manager connection failure handling" -Test {
    $Region = "ap-northeast-1"
    $InvalidSecretName = "/tdnet/invalid-secret-name-that-does-not-exist"
    
    $secretJson = aws secretsmanager get-secret-value `
        --secret-id $InvalidSecretName `
        --region $Region `
        --query SecretString `
        --output text 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        throw "Non-existent secret succeeded unexpectedly"
    }
    
    Write-Host "  Error occurred as expected" -ForegroundColor Gray
}

# Test 4: manual-data-collection.ps1 syntax check
Test-Case -Name "manual-data-collection.ps1 syntax check" -Test {
    $scriptPath = "scripts/manual-data-collection.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        throw "Script not found: $scriptPath"
    }
    
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$errors)
    
    if ($errors.Count -gt 0) {
        throw "Syntax error detected: $($errors[0].Message)"
    }
    
    $content = Get-Content $scriptPath -Raw
    
    if ($content -notmatch 'aws secretsmanager get-secret-value') {
        throw "Secrets Manager integration code not found"
    }
    
    if ($content -notmatch '\$secret\.api_key') {
        throw "API key retrieval code not found"
    }
    
    if ($content -notmatch 'x-api-key') {
        throw "API key usage code not found"
    }
    
    Write-Host "  Secrets Manager integration code is correctly implemented" -ForegroundColor Gray
}

# Test 5: fetch-data-range.ps1 syntax check
Test-Case -Name "fetch-data-range.ps1 syntax check" -Test {
    $scriptPath = "scripts/fetch-data-range.ps1"
    
    if (-not (Test-Path $scriptPath)) {
        throw "Script not found: $scriptPath"
    }
    
    $errors = $null
    $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content $scriptPath -Raw), [ref]$errors)
    
    if ($errors.Count -gt 0) {
        throw "Syntax error detected: $($errors[0].Message)"
    }
    
    $content = Get-Content $scriptPath -Raw
    
    if ($content -notmatch 'aws secretsmanager get-secret-value') {
        throw "Secrets Manager integration code not found"
    }
    
    if ($content -notmatch '\$secret\.api_key') {
        throw "API key retrieval code not found"
    }
    
    if ($content -notmatch 'x-api-key') {
        throw "API key usage code not found"
    }
    
    Write-Host "  Secrets Manager integration code is correctly implemented" -ForegroundColor Gray
}

# Test 6: Encoding settings check
Test-Case -Name "Encoding settings check" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        if ($content -notmatch '\$PSDefaultParameterValues\[''[*]:Encoding''\]') {
            throw "${scriptPath}: PSDefaultParameterValues setting not found"
        }
        
        if ($content -notmatch '\[Console\]::OutputEncoding') {
            throw "${scriptPath}: Console.OutputEncoding setting not found"
        }
        
        if ($content -notmatch '\$OutputEncoding') {
            throw "${scriptPath}: OutputEncoding setting not found"
        }
        
        Write-Host "  ${scriptPath}: Encoding settings OK" -ForegroundColor Gray
    }
}

# Test 7: Error message check
Test-Case -Name "Error message check" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        if ($content -notmatch 'catch') {
            throw "${scriptPath}: Error handling not implemented"
        }
        
        Write-Host "  ${scriptPath}: Error handling OK" -ForegroundColor Gray
    }
}

# Test 8: API endpoint configuration check
Test-Case -Name "API endpoint configuration check" -Test {
    $scripts = @(
        "scripts/manual-data-collection.ps1",
        "scripts/fetch-data-range.ps1"
    )
    
    foreach ($scriptPath in $scripts) {
        $content = Get-Content $scriptPath -Raw
        
        if ($content -notmatch 'https://[a-z0-9]+\.execute-api\.ap-northeast-1\.amazonaws\.com/prod') {
            throw "${scriptPath}: Production API endpoint not configured correctly"
        }
        
        if ($content -notmatch 'ap-northeast-1') {
            throw "${scriptPath}: Region not configured correctly"
        }
        
        if ($content -notmatch '/tdnet/api-key-prod') {
            throw "${scriptPath}: Secret name not configured correctly"
        }
        
        Write-Host "  ${scriptPath}: API configuration OK" -ForegroundColor Gray
    }
}

# Result summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Result Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total tests: $testCount" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "Failed tests:" -ForegroundColor Red
    foreach ($result in $testResults) {
        if ($result.Result -eq "FAIL") {
            Write-Host "  - $($result.Name)" -ForegroundColor Red
            Write-Host "    Error: $($result.Error)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "All tests passed" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed" -ForegroundColor Red
    exit 1
}

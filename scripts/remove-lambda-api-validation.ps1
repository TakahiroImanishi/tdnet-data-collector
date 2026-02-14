# Lambda関数からAPIキー検証コードを削除するスクリプト

$files = @(
    "src/lambda/export/handler.ts",
    "src/lambda/collect/handler.ts",
    "src/lambda/api/pdf-download/handler.ts",
    "src/lambda/api/export-status/handler.ts",
    "src/lambda/get-disclosure/handler.ts",
    "src/lambda/stats/handler.ts"
)

foreach ($file in $files) {
    Write-Host "Processing $file..." -ForegroundColor Yellow
    
    $content = Get-Content $file -Raw -Encoding UTF8
    
    # Remove getApiKey function (pattern varies by file)
    $content = $content -replace '(?s)/\*\*\s*\*\s*Secrets Manager.*?async function getApiKey\(\):.*?\n}\s*\n', ''
    
    # Remove validateApiKey function
    $content = $content -replace '(?s)/\*\*\s*\*\s*API.*?認証.*?async function validateApiKey\(.*?\):.*?\n}\s*\n', ''
    
    # Remove Secrets Manager imports
    $content = $content -replace "import \{ SecretsManagerClient, GetSecretValueCommand \} from '@aws-sdk/client-secrets-manager';\s*\n", ''
    
    # Remove secrets client initialization
    $content = $content -replace '(?s)// Secrets Manager.*?\n.*?const secretsClient.*?\n', ''
    
    # Remove API key cache variables
    $content = $content -replace '(?s)// API.*?キャッシュ.*?\nlet cachedApiKey.*?\nlet cacheExpiry.*?\n', ''
    
    # Save with UTF-8 no BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
    
    Write-Host "Completed $file" -ForegroundColor Green
}

Write-Host ""
Write-Host "All files processed. Running build..." -ForegroundColor Cyan
npm run build

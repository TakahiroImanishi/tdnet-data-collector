# テストファイルのフィールド名一括更新スクリプト（PowerShell版）
# s3_key → pdf_s3_key
# collected_at → downloaded_at

Write-Host "=== Updating test files ===" -ForegroundColor Green

# テストファイルを取得
$testFiles = Get-ChildItem -Path "src" -Filter "*.test.ts" -Recurse -File

$totalFiles = $testFiles.Count
$updatedFiles = 0

foreach ($file in $testFiles) {
    $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
    $originalContent = $content
    
    # s3_key → pdf_s3_key
    $content = $content -replace 's3_key:', 'pdf_s3_key:'
    $content = $content -replace "'s3_key'", "'pdf_s3_key'"
    $content = $content -replace '"s3_key"', '"pdf_s3_key"'
    $content = $content -replace '`s3_key`', '`pdf_s3_key`'
    
    # collected_at → downloaded_at
    $content = $content -replace 'collected_at:', 'downloaded_at:'
    $content = $content -replace "'collected_at'", "'downloaded_at'"
    $content = $content -replace '"collected_at"', '"downloaded_at"'
    $content = $content -replace '`collected_at`', '`downloaded_at`'
    
    # 変更があった場合のみ保存
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $updatedFiles++
        Write-Host "Updated: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Update complete ===" -ForegroundColor Green
Write-Host "Total files: $totalFiles" -ForegroundColor Cyan
Write-Host "Updated files: $updatedFiles" -ForegroundColor Cyan

# check-iam-permissions.ps1のテストスクリプト
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
Write-Host "check-iam-permissions.ps1 テストスクリプト" -ForegroundColor Cyan
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
$ScriptPath = Join-Path $PSScriptRoot ".." "check-iam-permissions.ps1"
$TestEnvironment = "dev"
$TestRegion = "ap-northeast-1"
$TestFunctionName = "tdnet-collector-$TestEnvironment"

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
        throw "AWS CLIが正しく動作していません。対処方法: AWS CLIをインストールしてください"
    }
}

# テスト3: AWS認証情報確認
Invoke-Test -TestName "AWS認証情報が設定されている" -TestScript {
    $identity = aws sts get-caller-identity 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "AWS認証情報が設定されていません。対処方法: aws configure を実行してください"
    }
}

# テスト4: Lambda関数の存在確認（スキップ可能）
Invoke-Test -TestName "Lambda関数が存在する" -TestScript {
    $functionInfo = aws lambda get-function --function-name $TestFunctionName --region $TestRegion 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Lambda関数が見つかりません: $TestFunctionName。対処方法: .\scripts\deploy-split-stacks.ps1 -Environment $TestEnvironment を実行してください"
    }
} -Skip

# テスト5: IAM CLIコマンドの動作確認
Invoke-Test -TestName "IAM CLIコマンドが動作する" -TestScript {
    $null = aws iam list-roles --max-items 1 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "IAM CLIコマンドが失敗しました。対処方法: AWS認証情報とIAM権限を確認してください"
    }
}

# テスト6: パラメータの検証
Invoke-Test -TestName "パラメータが正しく定義されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'param\s*\(') {
        throw "スクリプトにparamブロックが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$Environment') {
        throw "スクリプトに\$Environmentパラメータが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$Region') {
        throw "スクリプトに\$Regionパラメータが見つかりません"
    }
}

# テスト7: Lambda関数名の形式確認
Invoke-Test -TestName "Lambda関数名が正しい形式である" -TestScript {
    $functionName = "tdnet-collector-$TestEnvironment"
    
    # Lambda関数名の形式チェック（1-64文字、英数字・ハイフン・アンダースコアのみ）
    if ($functionName -notmatch '^[a-zA-Z0-9-_]{1,64}$') {
        throw "Lambda関数名が無効な形式です: $functionName"
    }
}

# テスト8: エラーハンドリングの確認
Invoke-Test -TestName "エラーハンドリングが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'try\s*\{') {
        throw "スクリプトにtry-catchブロックが見つかりません"
    }
    
    if ($scriptContent -notmatch 'catch\s*\{') {
        throw "スクリプトにcatchブロックが見つかりません"
    }
}

# テスト9: UTF-8エンコーディング設定の確認
Invoke-Test -TestName "UTF-8エンコーディング設定が含まれている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$PSDefaultParameterValues\[') {
        throw "スクリプトにUTF-8エンコーディング設定が見つかりません"
    }
    
    if ($scriptContent -notmatch '\[Console\]::OutputEncoding') {
        throw "スクリプトにConsole OutputEncoding設定が見つかりません"
    }
}

# テスト10: Lambda get-functionコマンドの確認
Invoke-Test -TestName "Lambda get-functionコマンドが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'aws lambda get-function') {
        throw "スクリプトにLambda get-functionコマンドが見つかりません"
    }
}

# テスト11: IAMロール名取得ロジックの確認
Invoke-Test -TestName "IAMロール名取得ロジックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$RoleName') {
        throw "スクリプトに\$RoleName変数が見つかりません"
    }
    
    if ($scriptContent -notmatch '\.Role') {
        throw "スクリプトにRole取得ロジックが見つかりません"
    }
}

# テスト12: インラインポリシー確認ロジックの確認
Invoke-Test -TestName "インラインポリシー確認ロジックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'list-role-policies') {
        throw "スクリプトにlist-role-policiesコマンドが見つかりません"
    }
    
    if ($scriptContent -notmatch 'get-role-policy') {
        throw "スクリプトにget-role-policyコマンドが見つかりません"
    }
}

# テスト13: アタッチポリシー確認ロジックの確認
Invoke-Test -TestName "アタッチポリシー確認ロジックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'list-attached-role-policies') {
        throw "スクリプトにlist-attached-role-policiesコマンドが見つかりません"
    }
    
    if ($scriptContent -notmatch 'get-policy-version') {
        throw "スクリプトにget-policy-versionコマンドが見つかりません"
    }
}

# テスト14: PutMetricData権限チェックの確認
Invoke-Test -TestName "PutMetricData権限チェックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'cloudwatch:PutMetricData') {
        throw "スクリプトにPutMetricData権限チェックが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$HasPutMetricDataPermission') {
        throw "スクリプトに\$HasPutMetricDataPermission変数が見つかりません"
    }
}

# テスト15: 結果表示ロジックの確認
Invoke-Test -TestName "結果表示ロジックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'Result') {
        throw "スクリプトに結果表示セクションが見つかりません"
    }
    
    if ($scriptContent -notmatch 'if\s*\(\s*\$HasPutMetricDataPermission\s*\)') {
        throw "スクリプトに権限チェック結果の条件分岐が見つかりません"
    }
}

# テスト16: 対処方法の表示確認
Invoke-Test -TestName "対処方法が表示される" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'Action:') {
        throw "スクリプトに対処方法の表示が見つかりません"
    }
    
    if ($scriptContent -notmatch 'deploy-split-stacks\.ps1') {
        throw "スクリプトに再デプロイコマンドの案内が見つかりません"
    }
}

# テスト17: カラー出力の確認
Invoke-Test -TestName "カラー出力が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '-ForegroundColor') {
        throw "スクリプトにカラー出力が見つかりません"
    }
}

# テスト18: JSON解析の確認
Invoke-Test -TestName "JSON解析が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'ConvertFrom-Json') {
        throw "スクリプトにJSON解析が見つかりません"
    }
}

# テスト19: ポリシードキュメント表示の確認
Invoke-Test -TestName "ポリシードキュメント表示が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'Policy details:') {
        throw "スクリプトにポリシー詳細表示が見つかりません"
    }
}

# テスト20: 複数ポリシーの処理確認
Invoke-Test -TestName "複数ポリシーの処理が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'foreach') {
        throw "スクリプトにforeachループが見つかりません"
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
    Write-Host "2. Lambda関数未存在" -ForegroundColor Cyan
    Write-Host "   対処: .\scripts\deploy-split-stacks.ps1 -Environment {env} を実行" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. IAM権限不足" -ForegroundColor Cyan
    Write-Host "   対処: AWS認証情報にIAM読み取り権限があることを確認" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. PutMetricData権限未設定" -ForegroundColor Cyan
    Write-Host "   対処: CDK再デプロイ（MonitoredLambda Construct使用）" -ForegroundColor Gray
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

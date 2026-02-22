# manual-data-collection.ps1のテストスクリプト
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
Write-Host "manual-data-collection.ps1 テストスクリプト" -ForegroundColor Cyan
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
$ScriptPath = Join-Path $PSScriptRoot ".." "manual-data-collection.ps1"
$TestStartDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$TestEndDate = (Get-Date).ToString("yyyy-MM-dd")
$TestRegion = "ap-northeast-1"
$TestSecretName = "/tdnet/api-key-prod"

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

# テスト4: パラメータの検証
Invoke-Test -TestName "パラメータが正しく定義されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'param\s*\(') {
        throw "スクリプトにparamブロックが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$StartDate') {
        throw "スクリプトに\$StartDateパラメータが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$EndDate') {
        throw "スクリプトに\$EndDateパラメータが見つかりません"
    }
    
    if ($scriptContent -notmatch '\$MaxItems') {
        throw "スクリプトに\$MaxItemsパラメータが見つかりません"
    }
}

# テスト5: デフォルト値の確認
Invoke-Test -TestName "デフォルト値が設定されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'AddDays\(-1\)') {
        throw "スクリプトにStartDateのデフォルト値が見つかりません"
    }
}

# テスト6: UTF-8エンコーディング設定の確認
Invoke-Test -TestName "UTF-8エンコーディング設定が含まれている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$PSDefaultParameterValues\[') {
        throw "スクリプトにUTF-8エンコーディング設定が見つかりません"
    }
    
    if ($scriptContent -notmatch '\[Console\]::OutputEncoding') {
        throw "スクリプトにConsole OutputEncoding設定が見つかりません"
    }
}

# テスト7: Secrets Manager統合の確認
Invoke-Test -TestName "Secrets Manager統合が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'secretsmanager') {
        throw "スクリプトにSecrets Manager統合が見つかりません"
    }
    
    if ($scriptContent -notmatch 'get-secret-value') {
        throw "スクリプトにget-secret-valueコマンドが見つかりません"
    }
}

# テスト8: APIエンドポイントの確認
Invoke-Test -TestName "APIエンドポイントが定義されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$ApiEndpoint') {
        throw "スクリプトに\$ApiEndpoint変数が見つかりません"
    }
    
    if ($scriptContent -notmatch 'https://') {
        throw "スクリプトにHTTPS URLが見つかりません"
    }
}

# テスト9: エラーハンドリングの確認
Invoke-Test -TestName "エラーハンドリングが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'try\s*\{') {
        throw "スクリプトにtry-catchブロックが見つかりません"
    }
    
    if ($scriptContent -notmatch 'catch\s*\{') {
        throw "スクリプトにcatchブロックが見つかりません"
    }
}

# テスト10: /collect APIエンドポイントの確認
Invoke-Test -TestName "/collect APIエンドポイントが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '/collect') {
        throw "スクリプトに/collect APIエンドポイントが見つかりません"
    }
}

# テスト11: POSTリクエストの確認
Invoke-Test -TestName "POSTリクエストが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'Invoke-RestMethod') {
        throw "スクリプトにInvoke-RestMethodが見つかりません"
    }
    
    if ($scriptContent -notmatch '-Method Post') {
        throw "スクリプトにPOSTメソッドが見つかりません"
    }
}

# テスト12: リクエストボディの確認
Invoke-Test -TestName "リクエストボディが構築されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'ConvertTo-Json') {
        throw "スクリプトにJSON変換が見つかりません"
    }
    
    if ($scriptContent -notmatch 'start_date') {
        throw "スクリプトにstart_dateフィールドが見つかりません"
    }
    
    if ($scriptContent -notmatch 'end_date') {
        throw "スクリプトにend_dateフィールドが見つかりません"
    }
    
    if ($scriptContent -notmatch 'max_items') {
        throw "スクリプトにmax_itemsフィールドが見つかりません"
    }
}

# テスト13: HTTPヘッダーの確認
Invoke-Test -TestName "HTTPヘッダーが設定されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$headers') {
        throw "スクリプトに\$headers変数が見つかりません"
    }
    
    if ($scriptContent -notmatch 'x-api-key') {
        throw "スクリプトにx-api-keyヘッダーが見つかりません"
    }
    
    if ($scriptContent -notmatch 'Content-Type') {
        throw "スクリプトにContent-Typeヘッダーが見つかりません"
    }
}

# テスト14: execution_idの取得確認
Invoke-Test -TestName "execution_idの取得が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\$executionId') {
        throw "スクリプトに\$executionId変数が見つかりません"
    }
    
    if ($scriptContent -notmatch 'execution_id') {
        throw "スクリプトにexecution_idフィールドが見つかりません"
    }
}

# テスト15: ポーリングロジックの確認
Invoke-Test -TestName "ポーリングロジックが実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'Start-Sleep') {
        throw "スクリプトにStart-Sleepが見つかりません（ポーリング待機）"
    }
}

# テスト16: カラー出力の確認
Invoke-Test -TestName "カラー出力が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '-ForegroundColor') {
        throw "スクリプトにカラー出力が見つかりません"
    }
}

# テスト17: 進捗表示の確認
Invoke-Test -TestName "進捗表示が実装されている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '\[\d+/\d+\]') {
        throw "スクリプトに進捗表示が見つかりません"
    }
}

# テスト18: エラーメッセージの確認
Invoke-Test -TestName "エラーメッセージに対処方法が含まれている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch '対処方法:') {
        throw "スクリプトにエラー対処方法の案内が見つかりません"
    }
}

# テスト19: Secrets Manager未登録時の案内確認
Invoke-Test -TestName "Secrets Manager未登録時の案内が含まれている" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    if ($scriptContent -notmatch 'register-api-key\.ps1') {
        throw "スクリプトにregister-api-key.ps1の案内が見つかりません"
    }
}

# テスト20: CloudWatch Logs監視の案内確認
Invoke-Test -TestName "CloudWatch Logs監視の案内が含まれている（推奨）" -TestScript {
    $scriptContent = Get-Content $ScriptPath -Raw
    
    # CloudWatch Logsの案内は必須ではないが、推奨される
    if ($scriptContent -notmatch 'CloudWatch') {
        Write-Host "  ⚠ CloudWatch Logs監視の案内が見つかりません（推奨）" -ForegroundColor Yellow
    }
} -Skip

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
    Write-Host "2. Secrets Manager未登録" -ForegroundColor Cyan
    Write-Host "   対処: .\scripts\register-api-key.ps1 -Environment prod を実行" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. API接続エラー" -ForegroundColor Cyan
    Write-Host "   対処: APIエンドポイントとネットワーク接続を確認" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. データ収集タイムアウト" -ForegroundColor Cyan
    Write-Host "   対処: CloudWatch Logsで実行状況を確認" -ForegroundColor Gray
    Write-Host ""
    Write-Host "本番実行チェックリスト:" -ForegroundColor Yellow
    Write-Host "  □ バックアップ確認" -ForegroundColor White
    Write-Host "  □ APIキー・エンドポイント確認" -ForegroundColor White
    Write-Host "  □ 実行時刻記録" -ForegroundColor White
    Write-Host "  □ CloudWatch Logs監視" -ForegroundColor White
    Write-Host "  □ 低トラフィック時間帯実行" -ForegroundColor White
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

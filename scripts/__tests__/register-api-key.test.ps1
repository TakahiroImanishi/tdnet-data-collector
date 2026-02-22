# register-api-key.ps1のテストスクリプト
# タスク1.3: 登録スクリプトのテスト

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "register-api-key.ps1 テストスクリプト" -ForegroundColor Cyan
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
$ScriptPath = Join-Path $PSScriptRoot ".." "register-api-key.ps1"
$TestEnvironment = "dev"
$TestApiKey = "test-api-key-$(Get-Random -Minimum 1000 -Maximum 9999)"
$TestSecretName = "/tdnet/api-key-$TestEnvironment"
$Region = "ap-northeast-1"

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

# テスト前の準備
function Initialize-TestEnvironment {
    Write-Host "テスト環境の準備中..." -ForegroundColor Yellow
    
    # スクリプトの存在確認
    if (-not (Test-Path $ScriptPath)) {
        throw "スクリプトが見つかりません: $ScriptPath"
    }
    
    # AWS CLIの確認
    try {
        $null = aws --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "AWS CLIが正しく動作していません"
        }
    } catch {
        throw "AWS CLIがインストールされていません"
    }
    
    # AWS認証情報の確認
    try {
        $identity = aws sts get-caller-identity 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "AWS認証情報が設定されていません"
        }
    } catch {
        throw "AWS認証に失敗しました"
    }
    
    Write-Host "✅ テスト環境の準備完了" -ForegroundColor Green
    Write-Host ""
}

# テスト後のクリーンアップ
function Clear-TestEnvironment {
    Write-Host "テスト環境のクリーンアップ中..." -ForegroundColor Yellow
    
    try {
        # テスト用シークレットの削除
        $existingSecret = aws secretsmanager describe-secret `
            --secret-id $TestSecretName `
            --region $Region `
            2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  テスト用シークレットを削除中: $TestSecretName" -ForegroundColor Yellow
            
            # 即座に削除（復旧期間なし）
            aws secretsmanager delete-secret `
                --secret-id $TestSecretName `
                --force-delete-without-recovery `
                --region $Region `
                --output json | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  ✅ テスト用シークレットを削除しました" -ForegroundColor Green
            } else {
                Write-Host "  ⚠ テスト用シークレットの削除に失敗しました" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  ⚠ クリーンアップ中にエラーが発生しました: $($_.Exception.Message)" -ForegroundColor Yellow
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
        throw "AWS認証情報が設定されていません"
    }
}

# テスト4: 新規シークレット作成
Invoke-Test -TestName "新規シークレットを作成できる" -TestScript {
    # 既存のシークレットを削除（存在する場合）
    $existingSecret = aws secretsmanager describe-secret `
        --secret-id $TestSecretName `
        --region $Region `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        aws secretsmanager delete-secret `
            --secret-id $TestSecretName `
            --force-delete-without-recovery `
            --region $Region `
            --output json | Out-Null
    }
    
    # スクリプト実行
    $output = & $ScriptPath -Environment $TestEnvironment -ApiKeyValue $TestApiKey 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "スクリプトの実行に失敗しました: $output"
    }
    
    # シークレットが作成されたか確認
    $secret = aws secretsmanager describe-secret `
        --secret-id $TestSecretName `
        --region $Region `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "シークレットが作成されていません"
    }
}

# テスト5: 既存シークレット更新
Invoke-Test -TestName "既存シークレットを更新できる" -TestScript {
    # 新しいAPIキー
    $newApiKey = "updated-api-key-$(Get-Random -Minimum 1000 -Maximum 9999)"
    
    # スクリプト実行（更新）
    $output = & $ScriptPath -Environment $TestEnvironment -ApiKeyValue $newApiKey 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "スクリプトの実行に失敗しました: $output"
    }
    
    # シークレットの値を取得
    $secretValue = aws secretsmanager get-secret-value `
        --secret-id $TestSecretName `
        --region $Region `
        --output json | ConvertFrom-Json
    
    $secretData = $secretValue.SecretString | ConvertFrom-Json
    
    if ($secretData.api_key -ne $newApiKey) {
        throw "シークレットが更新されていません。期待値: $newApiKey, 実際: $($secretData.api_key)"
    }
}

# テスト6: シークレットのデータ構造確認
Invoke-Test -TestName "シークレットのデータ構造が正しい" -TestScript {
    # シークレットの値を取得
    $secretValue = aws secretsmanager get-secret-value `
        --secret-id $TestSecretName `
        --region $Region `
        --output json | ConvertFrom-Json
    
    $secretData = $secretValue.SecretString | ConvertFrom-Json
    
    # 必須フィールドの確認
    if (-not $secretData.api_key) {
        throw "api_keyフィールドが存在しません"
    }
    
    if (-not $secretData.created_at) {
        throw "created_atフィールドが存在しません"
    }
    
    if (-not $secretData.environment) {
        throw "environmentフィールドが存在しません"
    }
    
    if ($secretData.environment -ne $TestEnvironment) {
        throw "environmentフィールドが正しくありません。期待値: $TestEnvironment, 実際: $($secretData.environment)"
    }
}

# テスト7: 空のAPIキーでエラー
Invoke-Test -TestName "空のAPIキーでエラーになる" -TestScript {
    # 空のAPIキーでスクリプト実行
    $output = & $ScriptPath -Environment $TestEnvironment -ApiKeyValue "" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        throw "空のAPIキーでエラーにならなかった"
    }
}

# テスト8: 無効な環境名でエラー
Invoke-Test -TestName "無効な環境名でエラーになる" -TestScript {
    try {
        # 無効な環境名でスクリプト実行
        $output = & $ScriptPath -Environment "invalid" -ApiKeyValue $TestApiKey 2>&1
        throw "無効な環境名でエラーにならなかった"
    } catch {
        # パラメータバリデーションエラーが期待される
        if ($_.Exception.Message -notmatch "Cannot validate argument") {
            throw "期待されるバリデーションエラーが発生しませんでした"
        }
    }
}

# テスト9: IAM権限確認（スキップ可能）
Invoke-Test -TestName "必要なIAM権限がある" -TestScript {
    # CreateSecret権限の確認（既にテスト4で確認済み）
    # DescribeSecret権限の確認
    $secret = aws secretsmanager describe-secret `
        --secret-id $TestSecretName `
        --region $Region `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        throw "DescribeSecret権限がありません"
    }
    
    # PutSecretValue権限の確認（既にテスト5で確認済み）
}

# テスト10: ロールバック機能確認
Invoke-Test -TestName "エラー時にロールバックされる" -TestScript {
    # 現在のシークレット値を取得
    $beforeValue = aws secretsmanager get-secret-value `
        --secret-id $TestSecretName `
        --region $Region `
        --output json | ConvertFrom-Json
    
    $beforeData = $beforeValue.SecretString | ConvertFrom-Json
    $beforeApiKey = $beforeData.api_key
    
    # 注: 現在のスクリプトにはロールバック機能が実装されていないため、
    # このテストは実装の改善提案として記録
    Write-Host "  ⚠ ロールバック機能は未実装です（改善提案）" -ForegroundColor Yellow
    
    # テストをスキップ
    throw "ロールバック機能は未実装"
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

# クリーンアップ
Clear-TestEnvironment

# 終了コード
if ($script:TestResults.Failed -gt 0) {
    Write-Host "❌ テストに失敗しました" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ すべてのテストに成功しました" -ForegroundColor Green
    exit 0
}

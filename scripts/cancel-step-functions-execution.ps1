# Step Functions実行キャンセルスクリプト
# タスク5.3: 運用スクリプト更新
# タスク8.1.2: 運用スクリプトの改善（環境情報自動取得）

param(
    [Parameter(Mandatory=$false)]
    [string]$ExecutionArn,
    
    [Parameter(Mandatory=$false)]
    [string]$ExecutionId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("dev", "prod")]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [string]$Profile,
    
    [Parameter(Mandatory=$false)]
    [string]$Reason,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# ヘルプメッセージ
if ($Help) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Step Functions実行キャンセルスクリプト" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID>" -ForegroundColor White
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionArn <実行ARN>" -ForegroundColor White
    Write-Host ""
    Write-Host "パラメータ:" -ForegroundColor Yellow
    Write-Host "  -ExecutionId   : 実行ID（例: exec_1234567890_abc123_12345678）" -ForegroundColor White
    Write-Host "  -ExecutionArn  : 実行ARN（例: arn:aws:states:...）" -ForegroundColor White
    Write-Host "  -Environment   : 環境名（dev または prod、デフォルト: prod）" -ForegroundColor White
    Write-Host "  -Profile       : AWS CLIプロファイル名（オプション）" -ForegroundColor White
    Write-Host "  -Reason        : キャンセル理由（オプション）" -ForegroundColor White
    Write-Host "  -Force         : 確認プロンプトをスキップ" -ForegroundColor White
    Write-Host "  -Help          : このヘルプメッセージを表示" -ForegroundColor White
    Write-Host ""
    Write-Host "例:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123" -ForegroundColor Gray
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionArn arn:aws:states:... -Force" -ForegroundColor Gray
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Reason '誤実行のため'" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# 共通関数の読み込み
. "$PSScriptRoot/lib/get-stack-outputs.ps1"

# パラメータ検証
if (-not $ExecutionArn -and -not $ExecutionId) {
    Write-Host "❌ エラー: ExecutionArn または ExecutionId のいずれかを指定してください" -ForegroundColor Red
    Write-Host ""
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -ExecutionId <実行ID>" -ForegroundColor White
    Write-Host "  .\scripts\cancel-step-functions-execution.ps1 -Help" -ForegroundColor White
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step Functions実行キャンセル" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 環境情報を取得
try {
    Write-Host "環境情報を取得中..." -ForegroundColor Cyan
    $stackOutputs = Get-StackOutputs -Environment $Environment -Profile $Profile
    $Region = $stackOutputs.Region
    
    # StateMachineArnが存在する場合は取得（Step Functions有効時のみ）
    if ($stackOutputs.ContainsKey("StateMachineArn")) {
        $stateMachineArn = $stackOutputs.StateMachineArn
        # StateMachine名を抽出
        if ($stateMachineArn -match ":stateMachine:(.+)$") {
            $StateMachineName = $Matches[1]
        }
    } else {
        # フォールバック: 環境名から推測
        $StateMachineName = "tdnet-collector-$Environment"
    }
    
    Write-Host "✅ 環境情報を取得しました（環境: $Environment）" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "詳細: .kiro/specs/tdnet-data-collector/docs/03-operations/troubleshooting.md" -ForegroundColor Gray
    exit 1
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ExecutionArnの構築
if ($ExecutionArn) {
    # ExecutionArnから実行IDを抽出
    if ($ExecutionArn -match ":execution:[^:]+:(.+)$") {
        $ExecutionId = $Matches[1]
    } else {
        Write-Host "❌ エラー: 無効なExecutionArn形式です" -ForegroundColor Red
        exit 1
    }
} else {
    # ExecutionIdからExecutionArnを構築
    # ARN形式: arn:aws:states:ap-northeast-1:123456789012:execution:tdnet-collector-prod:exec_123
    # アカウントIDを取得
    try {
        $accountId = aws sts get-caller-identity --query Account --output text 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to get account ID"
        }
        $ExecutionArn = "arn:aws:states:${Region}:${accountId}:execution:${StateMachineName}:${ExecutionId}"
    } catch {
        Write-Host "❌ エラー: アカウントIDの取得に失敗しました" -ForegroundColor Red
        Write-Host "詳細: AWS CLIの設定を確認してください" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "実行ID: $ExecutionId" -ForegroundColor White
Write-Host "実行ARN: $ExecutionArn" -ForegroundColor White
Write-Host ""

# 確認プロンプト
if (-not $Force) {
    Write-Host "⚠️ この実行をキャンセルしますか？" -ForegroundColor Yellow
    Write-Host "この操作は取り消せません。" -ForegroundColor Yellow
    Write-Host ""
    
    $confirmation = Read-Host "続行するには 'yes' を入力してください"
    
    if ($confirmation -ne "yes") {
        Write-Host "キャンセルを中止しました" -ForegroundColor Cyan
        exit 0
    }
    
    Write-Host ""
}

# キャンセル理由の入力（未指定の場合）
if (-not $Reason) {
    Write-Host "キャンセル理由を入力してください（オプション、Enterでスキップ）:" -ForegroundColor Cyan
    $Reason = Read-Host
    Write-Host ""
}

# デフォルトのキャンセル理由
if (-not $Reason) {
    $Reason = "Manual cancellation"
}

# Step Functions実行をキャンセル
try {
    Write-Host "Step Functions実行をキャンセル中..." -ForegroundColor Green
    
    $result = aws stepfunctions stop-execution `
        --execution-arn $ExecutionArn `
        --region $Region `
        --cause $Reason `
        --error "USER_CANCELLED" `
        2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Step Functions実行をキャンセルしました" -ForegroundColor Green
        Write-Host ""
        Write-Host "実行ID: $ExecutionId" -ForegroundColor White
        Write-Host "キャンセル理由: $Reason" -ForegroundColor White
        Write-Host ""
        exit 0
    } else {
        # エラー分類
        if ($result -match "ExecutionDoesNotExist") {
            Write-Host "❌ エラー: 実行が見つかりません" -ForegroundColor Red
            Write-Host "実行ID: $ExecutionId" -ForegroundColor Yellow
        } elseif ($result -match "ExecutionAlreadyStopped") {
            Write-Host "⚠️ 警告: 実行は既に停止しています" -ForegroundColor Yellow
            Write-Host "実行ID: $ExecutionId" -ForegroundColor White
        } elseif ($result -match "AccessDeniedException") {
            Write-Host "❌ エラー: アクセス権限がありません" -ForegroundColor Red
            Write-Host "詳細: states:StopExecution 権限を確認してください" -ForegroundColor Yellow
        } else {
            Write-Host "❌ エラー: Step Functions実行のキャンセルに失敗しました" -ForegroundColor Red
            Write-Host "詳細: $result" -ForegroundColor Yellow
        }
        exit 1
    }
    
} catch {
    Write-Host "❌ エラー: Step Functions実行のキャンセルに失敗しました" -ForegroundColor Red
    Write-Host "詳細: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

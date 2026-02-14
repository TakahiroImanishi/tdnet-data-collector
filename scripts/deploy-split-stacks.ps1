# スタック分割デプロイスクリプト
# 使用方法: .\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet('deploy', 'destroy', 'diff', 'synth')]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('foundation', 'compute', 'api', 'monitoring', 'all')]
    [string]$Stack = 'all'
)

# エラー時に停止
$ErrorActionPreference = "Stop"

# カラー出力関数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# スタック名を取得
function Get-StackNames {
    param([string]$Env, [string]$StackFilter)
    
    $stacks = @{
        'foundation' = "TdnetFoundation-$Env"
        'compute' = "TdnetCompute-$Env"
        'api' = "TdnetApi-$Env"
        'monitoring' = "TdnetMonitoring-$Env"
    }
    
    if ($StackFilter -eq 'all') {
        return $stacks.Values
    } else {
        return @($stacks[$StackFilter])
    }
}

# デプロイ順序（依存関係順）
$deployOrder = @('foundation', 'compute', 'api', 'monitoring')

# 削除順序（依存関係の逆順）
$destroyOrder = @('monitoring', 'api', 'compute', 'foundation')

Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "TDnet Data Collector - スタック分割デプロイ" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

Write-ColorOutput "環境: $Environment" "Yellow"
Write-ColorOutput "アクション: $Action" "Yellow"
Write-ColorOutput "対象スタック: $Stack`n" "Yellow"

# ビルド実行
Write-ColorOutput "`nLambda関数をビルド中..." "Green"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "`nビルドに失敗しました" "Red"
    Write-ColorOutput "エラー: TypeScriptのコンパイルエラーを確認してください" "Red"
    exit 1
}

# ビルド結果の確認
Write-ColorOutput "`nビルド結果を確認中..." "Green"
$criticalFiles = @(
    "dist/src/lambda/dlq-processor/index.js",
    "dist/src/lambda/collector/index.js",
    "dist/src/lambda/query/index.js"
)

$missingFiles = @()
foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-ColorOutput "`nエラー: 以下のビルドファイルが見つかりません:" "Red"
    foreach ($file in $missingFiles) {
        Write-ColorOutput "  - $file" "Red"
    }
    Write-ColorOutput "`n'npm run build' を実行してビルドファイルを生成してください" "Yellow"
    exit 1
}

Write-ColorOutput "ビルド結果の確認完了" "Green"

# CDKアプリケーションを指定
$cdkApp = "cdk/bin/tdnet-data-collector-split.ts"

# アクション実行
switch ($Action) {
    'synth' {
        Write-ColorOutput "`nCloudFormationテンプレートを生成中..." "Green"
        npx cdk synth --app "npx ts-node $cdkApp" -c environment=$Environment
    }
    
    'diff' {
        Write-ColorOutput "`n変更差分を確認中..." "Green"
        $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
        foreach ($stackName in $stackNames) {
            Write-ColorOutput "`n--- $stackName の差分 ---" "Cyan"
            npx cdk diff $stackName --app "npx ts-node $cdkApp" -c environment=$Environment
        }
    }
    
    'deploy' {
        if ($Stack -eq 'all') {
            # 全スタックを依存関係順にデプロイ
            foreach ($stackType in $deployOrder) {
                $stackName = "TdnetFoundation-$Environment"
                if ($stackType -eq 'compute') { $stackName = "TdnetCompute-$Environment" }
                elseif ($stackType -eq 'api') { $stackName = "TdnetApi-$Environment" }
                elseif ($stackType -eq 'monitoring') { $stackName = "TdnetMonitoring-$Environment" }
                
                Write-ColorOutput "`n========================================" "Cyan"
                Write-ColorOutput "デプロイ中: $stackName" "Green"
                Write-ColorOutput "========================================`n" "Cyan"
                
                npx cdk deploy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --require-approval never
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "`n$stackName のデプロイに失敗しました" "Red"
                    exit 1
                }
                
                Write-ColorOutput "`n$stackName のデプロイが完了しました`n" "Green"
            }
            
            Write-ColorOutput "`n========================================" "Cyan"
            Write-ColorOutput "全スタックのデプロイが完了しました！" "Green"
            Write-ColorOutput "========================================`n" "Cyan"
        } else {
            # 単一スタックをデプロイ
            $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
            foreach ($stackName in $stackNames) {
                Write-ColorOutput "`nデプロイ中: $stackName" "Green"
                npx cdk deploy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --require-approval never
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "$stackName のデプロイに失敗しました" "Red"
                    exit 1
                }
            }
        }
    }
    
    'destroy' {
        Write-ColorOutput "`n警告: スタックを削除します。この操作は取り消せません。" "Red"
        $confirmation = Read-Host "続行しますか？ (yes/no)"
        
        if ($confirmation -ne 'yes') {
            Write-ColorOutput "削除をキャンセルしました" "Yellow"
            exit 0
        }
        
        if ($Stack -eq 'all') {
            # 全スタックを依存関係の逆順に削除
            foreach ($stackType in $destroyOrder) {
                $stackName = "TdnetMonitoring-$Environment"
                if ($stackType -eq 'api') { $stackName = "TdnetApi-$Environment" }
                elseif ($stackType -eq 'compute') { $stackName = "TdnetCompute-$Environment" }
                elseif ($stackType -eq 'foundation') { $stackName = "TdnetFoundation-$Environment" }
                
                Write-ColorOutput "`n削除中: $stackName" "Yellow"
                npx cdk destroy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --force
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "$stackName の削除に失敗しました" "Red"
                    exit 1
                }
            }
        } else {
            # 単一スタックを削除
            $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
            foreach ($stackName in $stackNames) {
                Write-ColorOutput "`n削除中: $stackName" "Yellow"
                npx cdk destroy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --force
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "$stackName の削除に失敗しました" "Red"
                    exit 1
                }
            }
        }
    }
}

Write-ColorOutput "`n処理が完了しました`n" "Green"

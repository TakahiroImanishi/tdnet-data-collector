# CDK Stack Outputs取得共通関数
# タスク8.1.2: 運用スクリプトの改善

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# PowerShell 5.1互換性のため
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# キャッシュ（同一セッション内での再利用）
$script:StackOutputsCache = @{}

<#
.SYNOPSIS
CDK Stackから環境情報を取得

.DESCRIPTION
CDK Stackの出力から環境情報を取得します。
同一セッション内ではキャッシュを使用して高速化します。

.PARAMETER Environment
環境名（dev または prod）

.PARAMETER Profile
AWS CLIプロファイル名（オプション）

.PARAMETER Region
AWSリージョン（オプション、デフォルト: ap-northeast-1）

.PARAMETER NoCache
キャッシュを使用せず、常に最新の情報を取得

.EXAMPLE
$outputs = Get-StackOutputs -Environment prod
$apiEndpoint = $outputs.ApiEndpoint
$apiKeySecretName = $outputs.ApiKeySecretName

.EXAMPLE
$outputs = Get-StackOutputs -Environment dev -Profile manishi-awssso -NoCache
#>
function Get-StackOutputs {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet("dev", "prod")]
        [string]$Environment,
        
        [Parameter(Mandatory=$false)]
        [string]$Profile,
        
        [Parameter(Mandatory=$false)]
        [string]$Region = "ap-northeast-1",
        
        [Parameter(Mandatory=$false)]
        [switch]$NoCache
    )
    
    # キャッシュキー
    $cacheKey = "$Environment-$Region"
    
    # キャッシュチェック
    if (-not $NoCache -and $script:StackOutputsCache.ContainsKey($cacheKey)) {
        return $script:StackOutputsCache[$cacheKey]
    }
    
    # スタック名（CDKで生成される実際の名前）
    $apiStackName = "TdnetApi-$Environment"
    $computeStackName = "TdnetCompute-$Environment"
    
    # AWS CLIコマンドのベース
    $awsCliBase = "aws cloudformation describe-stacks --region $Region"
    if ($Profile) {
        $awsCliBase += " --profile $Profile"
    }
    
    try {
        # API Stackの出力を取得
        $apiStackJson = Invoke-Expression "$awsCliBase --stack-name $apiStackName --query 'Stacks[0].Outputs' --output json 2>&1"
        
        if ($LASTEXITCODE -ne 0) {
            if ($apiStackJson -match "does not exist") {
                throw [System.Exception]::new("STACK_NOT_FOUND:$apiStackName")
            } elseif ($apiStackJson -match "ExpiredToken|InvalidClientTokenId") {
                throw [System.Exception]::new("AUTH_EXPIRED")
            } elseif ($apiStackJson -match "AccessDenied") {
                throw [System.Exception]::new("ACCESS_DENIED")
            } else {
                throw [System.Exception]::new("AWS_CLI_ERROR:$apiStackJson")
            }
        }
        
        $apiOutputs = $apiStackJson | ConvertFrom-Json
        
        # Compute Stackの出力を取得
        $computeStackJson = Invoke-Expression "$awsCliBase --stack-name $computeStackName --query 'Stacks[0].Outputs' --output json 2>&1"
        
        if ($LASTEXITCODE -ne 0) {
            if ($computeStackJson -match "does not exist") {
                throw [System.Exception]::new("STACK_NOT_FOUND:$computeStackName")
            } else {
                throw [System.Exception]::new("AWS_CLI_ERROR:$computeStackJson")
            }
        }
        
        $computeOutputs = $computeStackJson | ConvertFrom-Json
        
        # 出力を整形
        $outputs = @{
            Environment = $Environment
            Region = $Region
        }
        
        # API Stack出力を追加
        foreach ($output in $apiOutputs) {
            $outputs[$output.OutputKey] = $output.OutputValue
        }
        
        # Compute Stack出力を追加
        foreach ($output in $computeOutputs) {
            $outputs[$output.OutputKey] = $output.OutputValue
        }
        
        # 必須フィールドの検証
        $requiredFields = @("ApiEndpoint", "ApiKeySecretName", "Region")
        foreach ($field in $requiredFields) {
            if (-not $outputs.ContainsKey($field)) {
                throw [System.Exception]::new("MISSING_OUTPUT:$field")
            }
        }
        
        # キャッシュに保存
        $script:StackOutputsCache[$cacheKey] = $outputs
        
        return $outputs
        
    } catch {
        $errorType = $_.Exception.Message
        
        # エラー分類とメッセージ
        if ($errorType -match "^STACK_NOT_FOUND:(.+)$") {
            $stackName = $Matches[1]
            Write-Host "❌ エラー: スタックが見つかりません" -ForegroundColor Red
            Write-Host "スタック名: $stackName" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "1. スタックがデプロイされているか確認してください:" -ForegroundColor White
            Write-Host "   aws cloudformation list-stacks --region $Region --query 'StackSummaries[?StackStatus!=``DELETE_COMPLETE``].StackName'" -ForegroundColor Gray
            Write-Host ""
            Write-Host "2. 環境名が正しいか確認してください（dev または prod）" -ForegroundColor White
            Write-Host ""
            Write-Host "3. スタックをデプロイしてください:" -ForegroundColor White
            Write-Host "   .\scripts\deploy-all.ps1 -Environment $Environment" -ForegroundColor Gray
        } elseif ($errorType -eq "AUTH_EXPIRED") {
            Write-Host "❌ エラー: AWS認証が期限切れです" -ForegroundColor Red
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "1. AWS SSOで再ログインしてください:" -ForegroundColor White
            Write-Host "   aws sso login --profile $Profile" -ForegroundColor Gray
            Write-Host ""
            Write-Host "2. または、AWS認証情報を更新してください:" -ForegroundColor White
            Write-Host "   aws configure" -ForegroundColor Gray
        } elseif ($errorType -eq "ACCESS_DENIED") {
            Write-Host "❌ エラー: CloudFormationへのアクセス権限がありません" -ForegroundColor Red
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "1. IAMポリシーを確認してください:" -ForegroundColor White
            Write-Host "   - cloudformation:DescribeStacks" -ForegroundColor Gray
            Write-Host ""
            Write-Host "2. 正しいAWSプロファイルを使用しているか確認してください" -ForegroundColor White
        } elseif ($errorType -match "^MISSING_OUTPUT:(.+)$") {
            $field = $Matches[1]
            Write-Host "❌ エラー: 必須の出力が見つかりません" -ForegroundColor Red
            Write-Host "出力名: $field" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "1. スタックを最新バージョンに更新してください:" -ForegroundColor White
            Write-Host "   .\scripts\deploy-all.ps1 -Environment $Environment" -ForegroundColor Gray
            Write-Host ""
            Write-Host "2. CDK定義を確認してください（タスク8.1.1の実装が必要）" -ForegroundColor White
        } else {
            Write-Host "❌ エラー: Stack Outputsの取得に失敗しました" -ForegroundColor Red
            Write-Host "詳細: $errorType" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "解決方法:" -ForegroundColor Cyan
            Write-Host "1. AWS CLIが正しくインストールされているか確認してください:" -ForegroundColor White
            Write-Host "   aws --version" -ForegroundColor Gray
            Write-Host ""
            Write-Host "2. ネットワーク接続を確認してください" -ForegroundColor White
        }
        
        throw $_
    }
}

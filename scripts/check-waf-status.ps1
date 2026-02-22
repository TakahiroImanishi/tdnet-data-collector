# WAF WebACL Status Check Script
# Check existing WAF WebACL and API Gateway associations

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'prod'
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WAF WebACL Status Check - $Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Region setting
$Region = 'ap-northeast-1'

try {
    # 1. Get WAF WebACL list
    Write-Host "1. Getting WAF WebACL list..." -ForegroundColor Yellow
    
    try {
        $webAcls = aws wafv2 list-web-acls --scope REGIONAL --region $Region 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -ne 0) {
            throw "WAF list-web-acls command failed"
        }
    } catch {
        Write-Host ""
        Write-Host "❌ [ERR-WAF-001] WAF WebACLリストの取得に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "対処方法:" -ForegroundColor Yellow
        Write-Host "1. AWS認証情報を確認:" -ForegroundColor White
        Write-Host "   aws sts get-caller-identity --region $Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. WAF権限を確認（必要な権限: wafv2:ListWebACLs）:" -ForegroundColor White
        Write-Host "   scripts/check-iam-permissions.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. リージョンが正しいか確認（WAFv2はREGIONALスコープ）:" -ForegroundColor White
        Write-Host "   現在のリージョン: $Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "4. WAFコンソールで確認:" -ForegroundColor White
        Write-Host "   https://console.aws.amazon.com/wafv2/homev2/web-acls?region=$Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "詳細: .kiro/steering/security/security-best-practices.md" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    
    if ($webAcls.WebACLs.Count -eq 0) {
        Write-Host "   No WAF WebACL found" -ForegroundColor Green
    } else {
        Write-Host "   Found WAF WebACL: $($webAcls.WebACLs.Count)" -ForegroundColor Yellow
        foreach ($acl in $webAcls.WebACLs) {
            Write-Host "   - Name: $($acl.Name)" -ForegroundColor White
            Write-Host "     ARN: $($acl.ARN)" -ForegroundColor Gray
            Write-Host "     ID: $($acl.Id)" -ForegroundColor Gray
            
            # Check associated resources
            try {
                $resources = aws wafv2 list-resources-for-web-acl --web-acl-arn $acl.ARN --region $Region 2>&1 | ConvertFrom-Json
                if ($resources.ResourceArns.Count -gt 0) {
                    Write-Host "     Associated resources:" -ForegroundColor Cyan
                    foreach ($resource in $resources.ResourceArns) {
                        Write-Host "       - $resource" -ForegroundColor White
                    }
                } else {
                    Write-Host "     Associated resources: None" -ForegroundColor Green
                }
            } catch {
                Write-Host "     ⚠️ Associated resources取得失敗: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host "     必要な権限: wafv2:ListResourcesForWebACL" -ForegroundColor Gray
            }
            Write-Host ""
        }
    }
    
    # 2. Get API Gateway list
    Write-Host "2. Getting API Gateway list..." -ForegroundColor Yellow
    
    try {
        $apis = aws apigateway get-rest-apis --region $Region 2>&1 | ConvertFrom-Json
        
        if ($LASTEXITCODE -ne 0) {
            throw "API Gateway get-rest-apis command failed"
        }
    } catch {
        Write-Host ""
        Write-Host "❌ [ERR-WAF-002] API Gatewayリストの取得に失敗しました: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "対処方法:" -ForegroundColor Yellow
        Write-Host "1. AWS認証情報を確認:" -ForegroundColor White
        Write-Host "   aws sts get-caller-identity --region $Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "2. API Gateway権限を確認（必要な権限: apigateway:GET）:" -ForegroundColor White
        Write-Host "   scripts/check-iam-permissions.ps1" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "3. API Gatewayコンソールで確認:" -ForegroundColor White
        Write-Host "   https://console.aws.amazon.com/apigateway/main/apis?region=$Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "詳細: .kiro/steering/api/api-design-guidelines.md" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
    
    $targetApi = $apis.items | Where-Object { $_.name -like "*tdnet-data-collector-api-$Environment*" }
    
    if ($targetApi) {
        Write-Host "   Target API Gateway: $($targetApi.name)" -ForegroundColor White
        Write-Host "   API ID: $($targetApi.id)" -ForegroundColor Gray
        
        # Get stages
        try {
            $stages = aws apigateway get-stages --rest-api-id $targetApi.id --region $Region 2>&1 | ConvertFrom-Json
            foreach ($stage in $stages.item) {
                Write-Host "   Stage: $($stage.stageName)" -ForegroundColor White
                $stageArn = "arn:aws:apigateway:${Region}::/restapis/$($targetApi.id)/stages/$($stage.stageName)"
                Write-Host "   Stage ARN: $stageArn" -ForegroundColor Gray
            }
        } catch {
            Write-Host "   ⚠️ Stageリスト取得失敗: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "   必要な権限: apigateway:GET" -ForegroundColor Gray
        }
    } else {
        Write-Host ""
        Write-Host "   ❌ [ERR-WAF-003] 対象のAPI Gatewayが見つかりませんでした" -ForegroundColor Red
        Write-Host ""
        Write-Host "   対処方法:" -ForegroundColor Yellow
        Write-Host "   1. API Gateway名を確認:" -ForegroundColor White
        Write-Host "      aws apigateway get-rest-apis --query 'items[].name' --region $Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   2. 環境（$Environment）が正しいか確認してください" -ForegroundColor White
        Write-Host ""
        Write-Host "   3. CDKスタックがデプロイされているか確認:" -ForegroundColor White
        Write-Host "      aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, ``TdnetDataCollectorApiStack``)]' --region $Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   4. CloudFormationコンソールで確認:" -ForegroundColor White
        Write-Host "      https://console.aws.amazon.com/cloudformation/home?region=$Region" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "   5. スタックをデプロイ:" -ForegroundColor White
        Write-Host "      scripts/deploy-all.ps1 -Environment $Environment" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Check Complete" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ [ERR-WAF-999] 予期しないエラーが発生しました: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. AWS認証情報を確認:" -ForegroundColor White
    Write-Host "   aws sts get-caller-identity --region $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. 必要なIAM権限を確認:" -ForegroundColor White
    Write-Host "   - wafv2:ListWebACLs" -ForegroundColor Gray
    Write-Host "   - wafv2:ListResourcesForWebACL" -ForegroundColor Gray
    Write-Host "   - apigateway:GET" -ForegroundColor Gray
    Write-Host "   scripts/check-iam-permissions.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. リージョンが正しいか確認:" -ForegroundColor White
    Write-Host "   現在のリージョン: $Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. AWSコンソールで手動確認:" -ForegroundColor White
    Write-Host "   WAF: https://console.aws.amazon.com/wafv2/homev2/web-acls?region=$Region" -ForegroundColor Cyan
    Write-Host "   API Gateway: https://console.aws.amazon.com/apigateway/main/apis?region=$Region" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "5. エラーの詳細をログに記録:" -ForegroundColor White
    Write-Host "   `$Error[0] | Format-List * -Force" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "詳細: .kiro/steering/infrastructure/monitoring-alerts.md" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

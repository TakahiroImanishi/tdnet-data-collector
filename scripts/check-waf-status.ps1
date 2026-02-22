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
    $webAcls = aws wafv2 list-web-acls --scope REGIONAL --region $Region | ConvertFrom-Json
    
    if ($LASTEXITCODE -ne 0) {
        throw "WAF list-web-acls command failed"
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
            $resources = aws wafv2 list-resources-for-web-acl --web-acl-arn $acl.ARN --region $Region | ConvertFrom-Json
            if ($resources.ResourceArns.Count -gt 0) {
                Write-Host "     Associated resources:" -ForegroundColor Cyan
                foreach ($resource in $resources.ResourceArns) {
                    Write-Host "       - $resource" -ForegroundColor White
                }
            } else {
                Write-Host "     Associated resources: None" -ForegroundColor Green
            }
            Write-Host ""
        }
    }
    
    # 2. Get API Gateway list
    Write-Host "2. Getting API Gateway list..." -ForegroundColor Yellow
    $apis = aws apigateway get-rest-apis --region $Region | ConvertFrom-Json
    
    $targetApi = $apis.items | Where-Object { $_.name -like "*tdnet-data-collector-api-$Environment*" }
    
    if ($targetApi) {
        Write-Host "   Target API Gateway: $($targetApi.name)" -ForegroundColor White
        Write-Host "   API ID: $($targetApi.id)" -ForegroundColor Gray
        
        # Get stages
        $stages = aws apigateway get-stages --rest-api-id $targetApi.id --region $Region | ConvertFrom-Json
        foreach ($stage in $stages.item) {
            Write-Host "   Stage: $($stage.stageName)" -ForegroundColor White
            $stageArn = "arn:aws:apigateway:${Region}::/restapis/$($targetApi.id)/stages/$($stage.stageName)"
            Write-Host "   Stage ARN: $stageArn" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ❌ Target API Gateway not found" -ForegroundColor Red
        Write-Host ""
        Write-Host "   対処方法:" -ForegroundColor Yellow
        Write-Host "   1. API Gateway名を確認: aws apigateway get-rest-apis --query 'items[].name'" -ForegroundColor White
        Write-Host "   2. 環境（$Environment）が正しいか確認してください" -ForegroundColor White
        Write-Host "   3. CDKスタックがデプロイされているか確認: aws cloudformation list-stacks --query 'StackSummaries[?contains(StackName, ``TdnetDataCollectorApiStack``)]'" -ForegroundColor White
        Write-Host ""
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Check Complete" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error occurred: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "対処方法:" -ForegroundColor Yellow
    Write-Host "1. AWS認証情報を確認: aws sts get-caller-identity" -ForegroundColor White
    Write-Host "2. WAF権限を確認: wafv2:ListWebACLs, wafv2:ListResourcesForWebACL" -ForegroundColor White
    Write-Host "3. API Gateway権限を確認: apigateway:GET" -ForegroundColor White
    Write-Host "4. リージョンが正しいか確認: $Region" -ForegroundColor White
    Write-Host ""
    exit 1
}

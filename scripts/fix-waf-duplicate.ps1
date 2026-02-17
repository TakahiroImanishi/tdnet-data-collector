# WAF WebACL Duplicate Error Fix Script
# Remove existing WAF WebACL and redeploy

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'prod',
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WAF WebACL Duplicate Error Fix - $Environment" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "(DRY RUN mode - no actual deletion)" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Region setting
$Region = 'ap-northeast-1'

try {
    # 1. Check current WAF WebACL
    Write-Host "Step 1: Checking current WAF WebACL..." -ForegroundColor Yellow
    $webAcls = aws wafv2 list-web-acls --scope REGIONAL --region $Region | ConvertFrom-Json
    
    $targetAcl = $webAcls.WebACLs | Where-Object { $_.Name -eq "tdnet-web-acl-$Environment" }
    
    if (-not $targetAcl) {
        Write-Host "   Target WAF WebACL (tdnet-web-acl-$Environment) not found" -ForegroundColor Green
        Write-Host "   You can deploy the stack directly" -ForegroundColor Green
        exit 0
    }
    
    Write-Host "   Target WAF WebACL: $($targetAcl.Name)" -ForegroundColor White
    Write-Host "   ARN: $($targetAcl.ARN)" -ForegroundColor Gray
    Write-Host "   ID: $($targetAcl.Id)" -ForegroundColor Gray
    Write-Host ""
    
    # 2. Check associated resources
    Write-Host "Step 2: Checking associated resources..." -ForegroundColor Yellow
    $resources = aws wafv2 list-resources-for-web-acl --web-acl-arn $targetAcl.ARN --region $Region | ConvertFrom-Json
    
    if ($resources.ResourceArns.Count -gt 0) {
        Write-Host "   Associated resources: $($resources.ResourceArns.Count)" -ForegroundColor Yellow
        foreach ($resource in $resources.ResourceArns) {
            Write-Host "   - $resource" -ForegroundColor White
        }
        Write-Host ""
        
        # 3. Disassociate resources
        Write-Host "Step 3: Disassociating resources..." -ForegroundColor Yellow
        foreach ($resource in $resources.ResourceArns) {
            if ($DryRun) {
                Write-Host "   [DRY RUN] Disassociate: $resource" -ForegroundColor Cyan
            } else {
                Write-Host "   Disassociating: $resource" -ForegroundColor White
                aws wafv2 disassociate-web-acl --resource-arn $resource --region $Region
                Write-Host "   Done" -ForegroundColor Green
            }
        }
        Write-Host ""
    } else {
        Write-Host "   Associated resources: None" -ForegroundColor Green
        Write-Host ""
    }
    
    # 4. Delete WAF WebACL
    Write-Host "Step 4: Deleting WAF WebACL..." -ForegroundColor Yellow
    
    # Get Lock Token
    $aclDetails = aws wafv2 get-web-acl --scope REGIONAL --id $targetAcl.Id --name $targetAcl.Name --region $Region | ConvertFrom-Json
    $lockToken = $aclDetails.LockToken
    
    if ($DryRun) {
        Write-Host "   [DRY RUN] Delete WAF WebACL: $($targetAcl.Name)" -ForegroundColor Cyan
        Write-Host "   Lock Token: $lockToken" -ForegroundColor Gray
    } else {
        Write-Host "   Deleting WAF WebACL: $($targetAcl.Name)" -ForegroundColor White
        aws wafv2 delete-web-acl --scope REGIONAL --id $targetAcl.Id --name $targetAcl.Name --lock-token $lockToken --region $Region
        Write-Host "   Done" -ForegroundColor Green
    }
    Write-Host ""
    
    # 5. Show next steps
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Fix Complete" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Redeploy API Stack:" -ForegroundColor White
    Write-Host "   cdk deploy TdnetApi-$Environment" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or redeploy all stacks:" -ForegroundColor White
    Write-Host "   .\scripts\deploy-split-stacks.ps1 -Environment $Environment" -ForegroundColor Cyan
    Write-Host ""
    
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check AWS CLI configuration" -ForegroundColor White
    Write-Host "2. Check IAM permissions (wafv2:*, apigateway:*)" -ForegroundColor White
    Write-Host "3. Check region (ap-northeast-1)" -ForegroundColor White
    exit 1
}

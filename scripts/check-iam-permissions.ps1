# IAM Role Permission Check Script
# Task 31.2.6.4: Check if Collector Lambda IAM role has CloudWatch PutMetricData permission

param(
    [string]$Environment = "prod",
    [string]$Region = "ap-northeast-1"
)

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IAM Role Permission Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Lambda function name
$FunctionName = "tdnet-collector-$Environment"

Write-Host "1. Checking Lambda function: $FunctionName" -ForegroundColor Yellow
Write-Host ""

# Get Lambda function information
try {
    $FunctionInfo = aws lambda get-function --function-name $FunctionName --region $Region --output json | ConvertFrom-Json
    
    $RoleName = $FunctionInfo.Configuration.Role.Split('/')[-1]
    Write-Host "[OK] Lambda function found" -ForegroundColor Green
    Write-Host "  Function: $FunctionName" -ForegroundColor Gray
    Write-Host "  IAM Role: $RoleName" -ForegroundColor Gray
    Write-Host "  Role ARN: $($FunctionInfo.Configuration.Role)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[ERROR] Lambda function not found: $FunctionName" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host "2. Checking IAM role policies" -ForegroundColor Yellow
Write-Host ""

$HasPutMetricDataPermission = $false

# Check inline policies
try {
    $InlinePolicies = aws iam list-role-policies --role-name $RoleName --output json | ConvertFrom-Json
    
    Write-Host "Inline policies: $($InlinePolicies.PolicyNames.Count)" -ForegroundColor Gray
    Write-Host ""
    
    foreach ($PolicyName in $InlinePolicies.PolicyNames) {
        Write-Host "  Policy: $PolicyName" -ForegroundColor Cyan
        
        $PolicyDocument = aws iam get-role-policy --role-name $RoleName --policy-name $PolicyName --output json | ConvertFrom-Json
        $PolicyJson = $PolicyDocument.PolicyDocument | ConvertTo-Json -Depth 10
        
        if ($PolicyJson -match "cloudwatch:PutMetricData") {
            Write-Host "    [OK] cloudwatch:PutMetricData permission found" -ForegroundColor Green
            $HasPutMetricDataPermission = $true
            Write-Host ""
            Write-Host "    Policy details:" -ForegroundColor Gray
            Write-Host $PolicyJson -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "    [-] No cloudwatch:PutMetricData permission" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
} catch {
    Write-Host "[ERROR] Failed to get inline policies" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

# Check attached policies
try {
    $AttachedPolicies = aws iam list-attached-role-policies --role-name $RoleName --output json | ConvertFrom-Json
    
    Write-Host "Attached policies: $($AttachedPolicies.AttachedPolicies.Count)" -ForegroundColor Gray
    Write-Host ""
    
    foreach ($Policy in $AttachedPolicies.AttachedPolicies) {
        Write-Host "  Policy: $($Policy.PolicyName)" -ForegroundColor Cyan
        Write-Host "    ARN: $($Policy.PolicyArn)" -ForegroundColor Gray
        
        $PolicyVersion = aws iam get-policy --policy-arn $Policy.PolicyArn --output json | ConvertFrom-Json
        $PolicyDocument = aws iam get-policy-version --policy-arn $Policy.PolicyArn --version-id $PolicyVersion.Policy.DefaultVersionId --output json | ConvertFrom-Json
        
        $PolicyJson = $PolicyDocument.PolicyVersion.Document | ConvertTo-Json -Depth 10
        
        if ($PolicyJson -match "cloudwatch:PutMetricData") {
            Write-Host "    [OK] cloudwatch:PutMetricData permission found" -ForegroundColor Green
            $HasPutMetricDataPermission = $true
            Write-Host ""
            Write-Host "    Policy details:" -ForegroundColor Gray
            Write-Host $PolicyJson -ForegroundColor Gray
            Write-Host ""
        } else {
            Write-Host "    [-] No cloudwatch:PutMetricData permission" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
} catch {
    Write-Host "[ERROR] Failed to get attached policies" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Result" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($HasPutMetricDataPermission) {
    Write-Host "[OK] cloudwatch:PutMetricData permission is configured" -ForegroundColor Green
    Write-Host ""
    Write-Host "Conclusion: Task 31.2.6.4 is already completed." -ForegroundColor Green
} else {
    Write-Host "[ERROR] cloudwatch:PutMetricData permission is NOT configured" -ForegroundColor Red
    Write-Host ""
    Write-Host "Action: Redeploy to production environment is required." -ForegroundColor Yellow
    Write-Host "  Command: .\scripts\deploy-split-stacks.ps1 -Environment prod" -ForegroundColor Gray
}

Write-Host ""

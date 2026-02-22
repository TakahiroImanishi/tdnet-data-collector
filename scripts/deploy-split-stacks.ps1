# Stack Split Deploy Script
# Usage: .\scripts\deploy-split-stacks.ps1 -Environment dev -Action deploy

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

# UTF-8エンコーディング設定（包括的）
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
if ($PSVersionTable.PSVersion.Major -le 5) {
    $PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
}

# Stop on error
$ErrorActionPreference = "Stop"

# Color output function
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Get stack names
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

# Deploy order (dependency order)
$deployOrder = @('foundation', 'compute', 'api', 'monitoring')

# Destroy order (reverse dependency order)
$destroyOrder = @('monitoring', 'api', 'compute', 'foundation')

Write-ColorOutput "`n========================================" "Cyan"
Write-ColorOutput "TDnet Data Collector - Stack Split Deploy" "Cyan"
Write-ColorOutput "========================================`n" "Cyan"

Write-ColorOutput "Environment: $Environment" "Yellow"
Write-ColorOutput "Action: $Action" "Yellow"
Write-ColorOutput "Target Stack: $Stack`n" "Yellow"

# Build Lambda functions
Write-ColorOutput "`nBuilding Lambda functions..." "Green"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "`nBuild failed" "Red"
    Write-ColorOutput "Error: Check TypeScript compilation errors" "Red"
    exit 1
}

# Verify build results
Write-ColorOutput "`nVerifying build results..." "Green"
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
    Write-ColorOutput "`nError: The following build files are missing:" "Red"
    foreach ($file in $missingFiles) {
        Write-ColorOutput "  - $file" "Red"
    }
    Write-ColorOutput "`nPlease run 'npm run build' to generate build files" "Yellow"
    exit 1
}

Write-ColorOutput "Build verification completed" "Green"

# Specify CDK application
$cdkApp = "cdk/bin/tdnet-data-collector-split.ts"

# Execute action
switch ($Action) {
    'synth' {
        Write-ColorOutput "`nGenerating CloudFormation templates..." "Green"
        npx cdk synth --app "npx ts-node $cdkApp" -c environment=$Environment
    }
    
    'diff' {
        Write-ColorOutput "`nChecking differences..." "Green"
        $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
        foreach ($stackName in $stackNames) {
            Write-ColorOutput "`n--- Diff for $stackName ---" "Cyan"
            npx cdk diff $stackName --app "npx ts-node $cdkApp" -c environment=$Environment
        }
    }
    
    'deploy' {
        if ($Stack -eq 'all') {
            # Deploy all stacks in dependency order
            foreach ($stackType in $deployOrder) {
                $stackName = "TdnetFoundation-$Environment"
                if ($stackType -eq 'compute') { $stackName = "TdnetCompute-$Environment" }
                elseif ($stackType -eq 'api') { $stackName = "TdnetApi-$Environment" }
                elseif ($stackType -eq 'monitoring') { $stackName = "TdnetMonitoring-$Environment" }
                
                Write-ColorOutput "`n========================================" "Cyan"
                Write-ColorOutput "Deploying: $stackName" "Green"
                Write-ColorOutput "========================================`n" "Cyan"
                
                npx cdk deploy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --require-approval never
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "`nDeployment failed for $stackName" "Red"
                    exit 1
                }
                
                Write-ColorOutput "`nDeployment completed for $stackName`n" "Green"
            }
            
            Write-ColorOutput "`n========================================" "Cyan"
            Write-ColorOutput "All stacks deployed successfully!" "Green"
            Write-ColorOutput "========================================`n" "Cyan"
        } else {
            # Deploy single stack
            $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
            foreach ($stackName in $stackNames) {
                Write-ColorOutput "`nDeploying: $stackName" "Green"
                npx cdk deploy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --require-approval never
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "Deployment failed for $stackName" "Red"
                    exit 1
                }
            }
        }
    }
    
    'destroy' {
        Write-ColorOutput "`nWarning: This will delete the stacks. This operation cannot be undone." "Red"
        Write-ColorOutput "Proceeding with deletion (use Ctrl+C to cancel within 5 seconds)..." "Yellow"
        Start-Sleep -Seconds 5
        
        if ($Stack -eq 'all') {
            # Delete all stacks in reverse dependency order
            foreach ($stackType in $destroyOrder) {
                $stackName = "TdnetMonitoring-$Environment"
                if ($stackType -eq 'api') { $stackName = "TdnetApi-$Environment" }
                elseif ($stackType -eq 'compute') { $stackName = "TdnetCompute-$Environment" }
                elseif ($stackType -eq 'foundation') { $stackName = "TdnetFoundation-$Environment" }
                
                Write-ColorOutput "`nDeleting: $stackName" "Yellow"
                npx cdk destroy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --force
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "Deletion failed for $stackName" "Red"
                    exit 1
                }
            }
        } else {
            # Delete single stack
            $stackNames = Get-StackNames -Env $Environment -StackFilter $Stack
            foreach ($stackName in $stackNames) {
                Write-ColorOutput "`nDeleting: $stackName" "Yellow"
                npx cdk destroy $stackName --app "npx ts-node $cdkApp" -c environment=$Environment --force
                
                if ($LASTEXITCODE -ne 0) {
                    Write-ColorOutput "Deletion failed for $stackName" "Red"
                    exit 1
                }
            }
        }
    }
}

Write-ColorOutput "`nProcess completed`n" "Green"

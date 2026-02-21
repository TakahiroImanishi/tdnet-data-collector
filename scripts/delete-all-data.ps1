# データ削除スクリプト
# DynamoDBとS3のすべてのデータを削除します

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

if (-not $Force) {
    Write-Warning-Custom "警告: このスクリプトは以下のデータをすべて削除します:"
    Write-Warning-Custom "  - DynamoDBテーブル: tdnet_disclosures_$Environment"
    Write-Warning-Custom "  - DynamoDBテーブル: tdnet_executions_$Environment"
    Write-Warning-Custom "  - DynamoDBテーブル: tdnet_export_status_$Environment"
    Write-Warning-Custom "  - S3バケット: tdnet-data-collector-pdfs-* (すべてのオブジェクト)"
    Write-Warning-Custom "  - S3バケット: tdnet-data-collector-exports-* (すべてのオブジェクト)"
    Write-Host ""
    $confirmation = Read-Host "本当に削除しますか？ (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Success "削除をキャンセルしました。"
        exit 0
    }
}

Write-Info "データ削除を開始します..."

Write-Info "AWSアカウントIDを取得中..."
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "エラー: AWSアカウントIDの取得に失敗しました。"
    exit 1
}
Write-Success "AWSアカウントID: $accountId"

$disclosuresTable = "tdnet_disclosures_$Environment"
$executionsTable = "tdnet_executions_$Environment"
$exportStatusTable = "tdnet_export_status_$Environment"
$pdfsBucket = "tdnet-data-collector-pdfs-$accountId"
$exportsBucket = "tdnet-data-collector-exports-$accountId"

Write-Host ""
Write-Info "========================================"
Write-Info "DynamoDBテーブルのデータ削除"
Write-Info "========================================"

function Remove-DynamoDBItems {
    param(
        [string]$TableName,
        [string]$KeyName
    )
    
    Write-Host ""
    Write-Info "テーブル: $TableName"
    Write-Info "データをスキャン中..."
    
    $tableCheck = aws dynamodb describe-table --table-name $TableName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning-Custom "警告: テーブル $TableName が見つかりません。スキップします。"
        return
    }
    
    $scanOutput = aws dynamodb scan --table-name $TableName --projection-expression $KeyName --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "エラー: テーブル $TableName のスキャンに失敗しました。"
        return
    }
    
    $scanData = $scanOutput | ConvertFrom-Json
    $items = $scanData.Items
    
    if (-not $items -or $items.Count -eq 0) {
        Write-Success "削除対象のデータはありません。"
        return
    }
    
    $itemCount = $items.Count
    Write-Info "削除対象: $itemCount 件"
    Write-Info "データを削除中..."
    
    $deletedCount = 0
    $failedCount = 0
    
    for ($i = 0; $i -lt $items.Count; $i += 25) {
        $batchSize = [Math]::Min(25, $items.Count - $i)
        $endIndex = $i + $batchSize - 1
        $batch = $items[$i..$endIndex]
        
        $deleteRequests = @()
        foreach ($item in $batch) {
            $keyValue = $item.$KeyName.S
            $deleteRequests += @{
                DeleteRequest = @{
                    Key = @{
                        $KeyName = @{ S = $keyValue }
                    }
                }
            }
        }
        
        $requestItems = @{
            $TableName = $deleteRequests
        }
        $requestJson = $requestItems | ConvertTo-Json -Depth 10 -Compress
        
        $batchResult = aws dynamodb batch-write-item --request-items $requestJson 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount += $batchSize
            Write-Host "  削除済み: $deletedCount / $itemCount 件"
        } else {
            $failedCount += $batchSize
            Write-Warning-Custom "  警告: バッチ削除に失敗しました ($batchSize 件)"
        }
        
        Start-Sleep -Milliseconds 100
    }
    
    Write-Success "削除完了: $deletedCount 件成功, $failedCount 件失敗"
}

Remove-DynamoDBItems -TableName $disclosuresTable -KeyName "disclosure_id"
Remove-DynamoDBItems -TableName $executionsTable -KeyName "execution_id"
Remove-DynamoDBItems -TableName $exportStatusTable -KeyName "export_id"

Write-Host ""
Write-Info "========================================"
Write-Info "S3バケットのデータ削除"
Write-Info "========================================"

function Remove-S3Objects {
    param(
        [string]$BucketName
    )
    
    Write-Host ""
    Write-Info "バケット: $BucketName"
    
    $bucketCheck = aws s3api head-bucket --bucket $BucketName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Warning-Custom "警告: バケット $BucketName が見つかりません。スキップします。"
        return
    }
    
    Write-Info "オブジェクトをリスト中..."
    
    $listOutput = aws s3api list-objects-v2 --bucket $BucketName --query "Contents[].Key" --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "エラー: バケット $BucketName のリストに失敗しました。"
        return
    }
    
    $objects = $listOutput | ConvertFrom-Json
    
    if (-not $objects -or $objects.Count -eq 0) {
        Write-Success "削除対象のオブジェクトはありません。"
        return
    }
    
    $objectCount = $objects.Count
    Write-Info "削除対象: $objectCount 件"
    Write-Info "オブジェクトを削除中..."
    
    aws s3 rm "s3://$BucketName" --recursive 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "削除完了: $objectCount 件"
    } else {
        Write-Warning-Custom "警告: 一部のオブジェクトの削除に失敗しました。"
    }
}

Remove-S3Objects -BucketName $pdfsBucket
Remove-S3Objects -BucketName $exportsBucket

Write-Host ""
Write-Info "========================================"
Write-Success "データ削除が完了しました！"
Write-Info "========================================"
Write-Host ""
Write-Info "削除されたリソース:"
Write-Host "  - DynamoDBテーブル: $disclosuresTable"
Write-Host "  - DynamoDBテーブル: $executionsTable"
Write-Host "  - DynamoDBテーブル: $exportStatusTable"
Write-Host "  - S3バケット: $pdfsBucket"
Write-Host "  - S3バケット: $exportsBucket"
Write-Host ""

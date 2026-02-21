# データ削除スクリプト
# DynamoDBとS3のすべてのデータを削除します

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "prod",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# エラー時に停止
$ErrorActionPreference = "Stop"

# 確認プロンプト
if (-not $Force) {
    Write-Host "警告: このスクリプトは以下のデータをすべて削除します:" -ForegroundColor Red
    Write-Host "  - DynamoDBテーブル: tdnet_disclosures_$Environment" -ForegroundColor Yellow
    Write-Host "  - DynamoDBテーブル: tdnet_executions_$Environment" -ForegroundColor Yellow
    Write-Host "  - DynamoDBテーブル: tdnet_export_status_$Environment" -ForegroundColor Yellow
    Write-Host "  - S3バケット: tdnet-data-collector-pdfs-* (すべてのオブジェクト)" -ForegroundColor Yellow
    Write-Host "  - S3バケット: tdnet-data-collector-exports-* (すべてのオブジェクト)" -ForegroundColor Yellow
    Write-Host ""
    $confirmation = Read-Host "本当に削除しますか？ (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Host "削除をキャンセルしました。" -ForegroundColor Green
        exit 0
    }
}

Write-Host "データ削除を開始します..." -ForegroundColor Cyan

# AWSアカウントIDを取得
Write-Host "AWSアカウントIDを取得中..." -ForegroundColor Cyan
$accountId = aws sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: AWSアカウントIDの取得に失敗しました。" -ForegroundColor Red
    exit 1
}
Write-Host "AWSアカウントID: $accountId" -ForegroundColor Green

# DynamoDBテーブル名
$disclosuresTable = "tdnet_disclosures_$Environment"
$executionsTable = "tdnet_executions_$Environment"
$exportStatusTable = "tdnet_export_status_$Environment"

# S3バケット名
$pdfsBucket = "tdnet-data-collector-pdfs-$accountId"
$exportsBucket = "tdnet-data-collector-exports-$accountId"

# ========================================
# DynamoDBテーブルのデータ削除
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DynamoDBテーブルのデータ削除" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# DynamoDB削除関数（バッチ処理対応）
function Remove-DynamoDBItems {
    param(
        [string]$TableName,
        [string]$KeyName
    )
    
    Write-Host ""
    Write-Host "テーブル: $TableName" -ForegroundColor Yellow
    Write-Host "データをスキャン中..." -ForegroundColor Cyan
    
    # テーブル存在確認
    $tableExists = aws dynamodb describe-table --table-name $TableName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告: テーブル $TableName が見つかりません。スキップします。" -ForegroundColor Yellow
        return
    }
    
    # スキャン実行
    $scanResult = aws dynamodb scan `
        --table-name $TableName `
        --projection-expression $KeyName `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "エラー: テーブル $TableName のスキャンに失敗しました。" -ForegroundColor Red
        Write-Host $scanResult -ForegroundColor Red
        return
    }
    
    $items = ($scanResult | ConvertFrom-Json).Items
    
    if (-not $items -or $items.Count -eq 0) {
        Write-Host "削除対象のデータはありません。" -ForegroundColor Green
        return
    }
    
    $itemCount = $items.Count
    Write-Host "削除対象: $itemCount 件" -ForegroundColor Yellow
    Write-Host "データを削除中..." -ForegroundColor Cyan
    
    $deletedCount = 0
    $failedCount = 0
    
    # バッチ削除（25件ずつ）
    for ($i = 0; $i -lt $items.Count; $i += 25) {
        $batchSize = [Math]::Min(25, $items.Count - $i)
        $batch = $items[$i..($i + $batchSize - 1)]
        
        # BatchWriteItem用のリクエスト構築
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
        } | ConvertTo-Json -Depth 10 -Compress
        
        # バッチ削除実行
        $result = aws dynamodb batch-write-item --request-items $requestItems 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount += $batchSize
            Write-Host "  削除済み: $deletedCount / $itemCount 件" -ForegroundColor Gray
        } else {
            $failedCount += $batchSize
            Write-Host "  警告: バッチ削除に失敗しました（$batchSize 件）" -ForegroundColor Yellow
        }
        
        # レート制限対策
        Start-Sleep -Milliseconds 100
    }
    
    Write-Host "削除完了: $deletedCount 件成功, $failedCount 件失敗" -ForegroundColor Green
}

# 1. tdnet_disclosures テーブル
Remove-DynamoDBItems -TableName $disclosuresTable -KeyName "disclosure_id"

# 2. tdnet_executions テーブル
Remove-DynamoDBItems -TableName $executionsTable -KeyName "execution_id"

# 3. tdnet_export_status テーブル
Remove-DynamoDBItems -TableName $exportStatusTable -KeyName "export_id"

# ========================================
# S3バケットのデータ削除
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "S3バケットのデータ削除" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# S3削除関数
function Remove-S3Objects {
    param(
        [string]$BucketName
    )
    
    Write-Host ""
    Write-Host "バケット: $BucketName" -ForegroundColor Yellow
    
    # バケット存在確認
    $bucketExists = aws s3api head-bucket --bucket $BucketName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告: バケット $BucketName が見つかりません。スキップします。" -ForegroundColor Yellow
        return
    }
    
    Write-Host "オブジェクトをリスト中..." -ForegroundColor Cyan
    
    $listResult = aws s3api list-objects-v2 `
        --bucket $BucketName `
        --query "Contents[].Key" `
        --output json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "エラー: バケット $BucketName のリストに失敗しました。" -ForegroundColor Red
        Write-Host $listResult -ForegroundColor Red
        return
    }
    
    $objects = $listResult | ConvertFrom-Json
    
    if (-not $objects -or $objects.Count -eq 0) {
        Write-Host "削除対象のオブジェクトはありません。" -ForegroundColor Green
        return
    }
    
    $objectCount = $objects.Count
    Write-Host "削除対象: $objectCount 件" -ForegroundColor Yellow
    Write-Host "オブジェクトを削除中..." -ForegroundColor Cyan
    
    # 再帰的削除実行
    $deleteResult = aws s3 rm "s3://$BucketName" --recursive 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "削除完了: $objectCount 件" -ForegroundColor Green
    } else {
        Write-Host "警告: 一部のオブジェクトの削除に失敗しました。" -ForegroundColor Yellow
        Write-Host $deleteResult -ForegroundColor Yellow
    }
}

# 1. PDFバケット
Remove-S3Objects -BucketName $pdfsBucket

# 2. Exportバケット
Remove-S3Objects -BucketName $exportsBucket

# ========================================
# 完了
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "データ削除が完了しました！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "削除されたリソース:" -ForegroundColor Cyan
Write-Host "  - DynamoDBテーブル: $disclosuresTable" -ForegroundColor Gray
Write-Host "  - DynamoDBテーブル: $executionsTable" -ForegroundColor Gray
Write-Host "  - DynamoDBテーブル: $exportStatusTable" -ForegroundColor Gray
Write-Host "  - S3バケット: $pdfsBucket" -ForegroundColor Gray
Write-Host "  - S3バケット: $exportsBucket" -ForegroundColor Gray
Write-Host ""

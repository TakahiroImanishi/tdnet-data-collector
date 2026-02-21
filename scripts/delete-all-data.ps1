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

# 1. tdnet_disclosures テーブル
Write-Host ""
Write-Host "テーブル: $disclosuresTable" -ForegroundColor Yellow
Write-Host "データをスキャン中..." -ForegroundColor Cyan

$items = aws dynamodb scan `
    --table-name $disclosuresTable `
    --projection-expression "disclosure_id" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: テーブル $disclosuresTable のスキャンに失敗しました。" -ForegroundColor Red
    exit 1
}

$itemCount = $items.Items.Count
Write-Host "削除対象: $itemCount 件" -ForegroundColor Yellow

if ($itemCount -gt 0) {
    Write-Host "データを削除中..." -ForegroundColor Cyan
    $deletedCount = 0
    foreach ($item in $items.Items) {
        $disclosureId = $item.disclosure_id.S
        aws dynamodb delete-item `
            --table-name $disclosuresTable `
            --key "{`"disclosure_id`": {`"S`": `"$disclosureId`"}}" `
            --output json | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount++
            if ($deletedCount % 100 -eq 0) {
                Write-Host "  削除済み: $deletedCount / $itemCount 件" -ForegroundColor Gray
            }
        } else {
            Write-Host "警告: disclosure_id=$disclosureId の削除に失敗しました。" -ForegroundColor Yellow
        }
    }
    Write-Host "削除完了: $deletedCount / $itemCount 件" -ForegroundColor Green
} else {
    Write-Host "削除対象のデータはありません。" -ForegroundColor Green
}

# 2. tdnet_executions テーブル
Write-Host ""
Write-Host "テーブル: $executionsTable" -ForegroundColor Yellow
Write-Host "データをスキャン中..." -ForegroundColor Cyan

$items = aws dynamodb scan `
    --table-name $executionsTable `
    --projection-expression "execution_id" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: テーブル $executionsTable のスキャンに失敗しました。" -ForegroundColor Red
    exit 1
}

$itemCount = $items.Items.Count
Write-Host "削除対象: $itemCount 件" -ForegroundColor Yellow

if ($itemCount -gt 0) {
    Write-Host "データを削除中..." -ForegroundColor Cyan
    $deletedCount = 0
    foreach ($item in $items.Items) {
        $executionId = $item.execution_id.S
        aws dynamodb delete-item `
            --table-name $executionsTable `
            --key "{`"execution_id`": {`"S`": `"$executionId`"}}" `
            --output json | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount++
            if ($deletedCount % 100 -eq 0) {
                Write-Host "  削除済み: $deletedCount / $itemCount 件" -ForegroundColor Gray
            }
        } else {
            Write-Host "警告: execution_id=$executionId の削除に失敗しました。" -ForegroundColor Yellow
        }
    }
    Write-Host "削除完了: $deletedCount / $itemCount 件" -ForegroundColor Green
} else {
    Write-Host "削除対象のデータはありません。" -ForegroundColor Green
}

# 3. tdnet_export_status テーブル
Write-Host ""
Write-Host "テーブル: $exportStatusTable" -ForegroundColor Yellow
Write-Host "データをスキャン中..." -ForegroundColor Cyan

$items = aws dynamodb scan `
    --table-name $exportStatusTable `
    --projection-expression "export_id" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: テーブル $exportStatusTable のスキャンに失敗しました。" -ForegroundColor Red
    exit 1
}

$itemCount = $items.Items.Count
Write-Host "削除対象: $itemCount 件" -ForegroundColor Yellow

if ($itemCount -gt 0) {
    Write-Host "データを削除中..." -ForegroundColor Cyan
    $deletedCount = 0
    foreach ($item in $items.Items) {
        $exportId = $item.export_id.S
        aws dynamodb delete-item `
            --table-name $exportStatusTable `
            --key "{`"export_id`": {`"S`": `"$exportId`"}}" `
            --output json | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            $deletedCount++
            if ($deletedCount % 100 -eq 0) {
                Write-Host "  削除済み: $deletedCount / $itemCount 件" -ForegroundColor Gray
            }
        } else {
            Write-Host "警告: export_id=$exportId の削除に失敗しました。" -ForegroundColor Yellow
        }
    }
    Write-Host "削除完了: $deletedCount / $itemCount 件" -ForegroundColor Green
} else {
    Write-Host "削除対象のデータはありません。" -ForegroundColor Green
}

# ========================================
# S3バケットのデータ削除
# ========================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "S3バケットのデータ削除" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. PDFバケット
Write-Host ""
Write-Host "バケット: $pdfsBucket" -ForegroundColor Yellow
Write-Host "オブジェクトをリスト中..." -ForegroundColor Cyan

$objects = aws s3api list-objects-v2 `
    --bucket $pdfsBucket `
    --query "Contents[].Key" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: バケット $pdfsBucket のリストに失敗しました。" -ForegroundColor Red
    exit 1
}

if ($objects) {
    $objectCount = $objects.Count
    Write-Host "削除対象: $objectCount 件" -ForegroundColor Yellow
    Write-Host "オブジェクトを削除中..." -ForegroundColor Cyan
    
    aws s3 rm "s3://$pdfsBucket" --recursive --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "削除完了: $objectCount 件" -ForegroundColor Green
    } else {
        Write-Host "警告: 一部のオブジェクトの削除に失敗しました。" -ForegroundColor Yellow
    }
} else {
    Write-Host "削除対象のオブジェクトはありません。" -ForegroundColor Green
}

# 2. Exportバケット
Write-Host ""
Write-Host "バケット: $exportsBucket" -ForegroundColor Yellow
Write-Host "オブジェクトをリスト中..." -ForegroundColor Cyan

$objects = aws s3api list-objects-v2 `
    --bucket $exportsBucket `
    --query "Contents[].Key" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "エラー: バケット $exportsBucket のリストに失敗しました。" -ForegroundColor Red
    exit 1
}

if ($objects) {
    $objectCount = $objects.Count
    Write-Host "削除対象: $objectCount 件" -ForegroundColor Yellow
    Write-Host "オブジェクトを削除中..." -ForegroundColor Cyan
    
    aws s3 rm "s3://$exportsBucket" --recursive --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "削除完了: $objectCount 件" -ForegroundColor Green
    } else {
        Write-Host "警告: 一部のオブジェクトの削除に失敗しました。" -ForegroundColor Yellow
    }
} else {
    Write-Host "削除対象のオブジェクトはありません。" -ForegroundColor Green
}

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

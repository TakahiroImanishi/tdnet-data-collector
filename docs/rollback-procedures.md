# ロールバック手順書

**作成日**: 2026-02-14  
**目的**: CDKスタックとデータベースのロールバック手順を文書化し、緊急時の迅速な対応を可能にする

---

## 目次

1. [概要](#概要)
2. [CDKスタックのロールバック](#cdkスタックのロールバック)
3. [データベースのロールバック](#データベースのロールバック)
4. [緊急時の対応手順](#緊急時の対応手順)
5. [ロールバック後の確認](#ロールバック後の確認)
6. [予防措置](#予防措置)

---

## 概要

### ロールバックが必要な状況

- ✅ デプロイ後にLambda関数が正常に動作しない
- ✅ データ整合性の問題が発生
- ✅ パフォーマンスが著しく低下
- ✅ セキュリティ上の問題が発見された
- ✅ 予期しないコスト増加

### ロールバックの種類

| 種類 | 対象 | 所要時間 | データ損失 |
|------|------|---------|-----------|
| **CDKスタックロールバック** | インフラストラクチャ | 5-15分 | なし |
| **DynamoDB PITR復元** | DynamoDBデータ | 30-60分 | 最大35日前まで |
| **S3バージョン復元** | S3オブジェクト | 数分 | なし（バージョニング有効時） |
| **完全ロールバック** | すべて | 1-2時間 | 最小限 |

---

## CDKスタックのロールバック

### 方法1: CloudFormationの自動ロールバック（推奨）

CloudFormationは、デプロイ失敗時に自動的にロールバックします。

#### 自動ロールバックの確認

```powershell
# スタックの状態を確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --query "Stacks[0].StackStatus"

# ロールバック中の場合: UPDATE_ROLLBACK_IN_PROGRESS
# ロールバック完了: ROLLBACK_COMPLETE または UPDATE_ROLLBACK_COMPLETE
```

#### 自動ロールバックの監視

```powershell
# スタックイベントをリアルタイムで監視
aws cloudformation describe-stack-events `
    --stack-name TdnetDataCollectorStack-prod `
    --max-items 20 `
    --query "StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]" `
    --output table
```

### 方法2: 手動ロールバック（Gitタグ使用）

特定のバージョンに戻す場合に使用します。

#### ステップ1: 前のバージョンを確認

```powershell
# Gitタグ一覧を表示
git tag --sort=-v:refname

# 例: v1.2.3, v1.2.2, v1.2.1
```

#### ステップ2: 前のバージョンにチェックアウト

```powershell
# 前のバージョンにチェックアウト
git checkout v1.2.2

# または、特定のコミットにチェックアウト
git checkout <commit-hash>
```

#### ステップ3: 依存関係の再インストール

```powershell
# 依存関係を再インストール
npm ci

# ビルド
npm run build
```

#### ステップ4: CDKデプロイ

```powershell
# 開発環境
cdk deploy --context environment=dev --require-approval never

# 本番環境（慎重に）
cdk deploy --context environment=prod --require-approval always
```

#### ステップ5: デプロイ完了を確認

```powershell
# スタックの状態を確認
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --query "Stacks[0].StackStatus"

# 期待される結果: UPDATE_COMPLETE
```

### 方法3: CloudFormation CLIでのロールバック

デプロイが失敗し、スタックが `UPDATE_ROLLBACK_FAILED` 状態の場合に使用します。

#### ステップ1: スタックの状態を確認

```powershell
aws cloudformation describe-stacks `
    --stack-name TdnetDataCollectorStack-prod `
    --query "Stacks[0].StackStatus"
```

#### ステップ2: 続行ロールバック

```powershell
# ロールバックを続行
aws cloudformation continue-update-rollback `
    --stack-name TdnetDataCollectorStack-prod

# 特定のリソースをスキップする場合
aws cloudformation continue-update-rollback `
    --stack-name TdnetDataCollectorStack-prod `
    --resources-to-skip <ResourceLogicalId>
```

#### ステップ3: ロールバック完了を待機

```powershell
# ロールバック完了を待機
aws cloudformation wait stack-update-rollback-complete `
    --stack-name TdnetDataCollectorStack-prod
```

### 環境別のロールバック手順

#### 開発環境（dev）

```powershell
# 1. 前のバージョンにチェックアウト
git checkout v1.2.2

# 2. 依存関係を再インストール
npm ci && npm run build

# 3. デプロイ
cdk deploy --context environment=dev --require-approval never

# 4. スモークテスト実行
.\scripts\smoke-test.ps1 -Environment dev
```

#### 本番環境（prod）

```powershell
# 1. 前のバージョンにチェックアウト
git checkout v1.2.2

# 2. 依存関係を再インストール
npm ci && npm run build

# 3. 差分を確認（必須）
cdk diff --context environment=prod

# 4. デプロイ（承認プロンプト表示）
cdk deploy --context environment=prod --require-approval always

# 5. スモークテスト実行
.\scripts\smoke-test.ps1 -Environment prod

# 6. 監視ダッシュボードで確認
# CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/
```

---

## データベースのロールバック

### DynamoDB Point-in-Time Recovery (PITR)

#### 前提条件の確認

すべてのDynamoDBテーブルでPITRが有効化されています：

```typescript
// cdk/lib/tdnet-data-collector-stack.ts
pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
```

#### PITRの設定確認

```powershell
# PITRの状態を確認
aws dynamodb describe-continuous-backups `
    --table-name tdnet_disclosures_prod `
    --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription"

# 期待される結果:
# {
#     "PointInTimeRecoveryStatus": "ENABLED",
#     "EarliestRestorableDateTime": "2024-01-01T00:00:00+00:00",
#     "LatestRestorableDateTime": "2024-02-14T13:00:00+00:00"
# }
```

#### ステップ1: 復元ポイントの決定

```powershell
# 復元可能な最も古い日時を確認
aws dynamodb describe-continuous-backups `
    --table-name tdnet_disclosures_prod `
    --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.EarliestRestorableDateTime"

# 復元可能な最新の日時を確認
aws dynamodb describe-continuous-backups `
    --table-name tdnet_disclosures_prod `
    --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.LatestRestorableDateTime"
```

#### ステップ2: テーブルの復元

```powershell
# 特定の日時に復元（新しいテーブルとして作成）
aws dynamodb restore-table-to-point-in-time `
    --source-table-name tdnet_disclosures_prod `
    --target-table-name tdnet_disclosures_prod_restored `
    --restore-date-time "2024-02-14T12:00:00+00:00"

# 復元の進行状況を確認
aws dynamodb describe-table `
    --table-name tdnet_disclosures_prod_restored `
    --query "Table.TableStatus"

# 期待される結果: CREATING → ACTIVE
```

#### ステップ3: データの検証

```powershell
# 復元されたテーブルのアイテム数を確認
aws dynamodb scan `
    --table-name tdnet_disclosures_prod_restored `
    --select COUNT

# 元のテーブルと比較
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --select COUNT
```

#### ステップ4: テーブルの切り替え

```powershell
# 1. 元のテーブルをバックアップ（念のため）
aws dynamodb create-backup `
    --table-name tdnet_disclosures_prod `
    --backup-name tdnet_disclosures_prod_backup_$(Get-Date -Format "yyyyMMddHHmmss")

# 2. 元のテーブルを削除
aws dynamodb delete-table --table-name tdnet_disclosures_prod

# 3. 削除完了を待機
aws dynamodb wait table-not-exists --table-name tdnet_disclosures_prod

# 4. 復元されたテーブルの名前を変更（CDKで再デプロイ）
# 注: DynamoDBはテーブル名の変更をサポートしていないため、
# CDKスタックを更新して新しいテーブルを参照する必要があります
```

#### 全テーブルの復元スクリプト

```powershell
# 全テーブルを復元するスクリプト
$tables = @(
    "tdnet_disclosures_prod",
    "tdnet_executions_prod",
    "tdnet_export_status_prod"
)

$restoreDateTime = "2024-02-14T12:00:00+00:00"

foreach ($table in $tables) {
    Write-Host "Restoring $table..."
    
    aws dynamodb restore-table-to-point-in-time `
        --source-table-name $table `
        --target-table-name "${table}_restored" `
        --restore-date-time $restoreDateTime
    
    # 復元完了を待機
    aws dynamodb wait table-exists --table-name "${table}_restored"
    
    Write-Host "✅ $table restored successfully"
}
```

### S3バージョニングによる復元

#### 前提条件の確認

すべてのS3バケットでバージョニングが有効化されています：

```typescript
// cdk/lib/tdnet-data-collector-stack.ts
versioned: true, // バージョニング有効化
```

#### バージョニングの設定確認

```powershell
# バージョニングの状態を確認
aws s3api get-bucket-versioning `
    --bucket tdnet-data-collector-pdfs-prod-123456789012

# 期待される結果:
# {
#     "Status": "Enabled"
# }
```

#### ステップ1: オブジェクトのバージョン一覧を取得

```powershell
# 特定のオブジェクトのバージョン一覧を取得
aws s3api list-object-versions `
    --bucket tdnet-data-collector-pdfs-prod-123456789012 `
    --prefix "2024/01/15/TD20240115001.pdf" `
    --query "Versions[*].[VersionId,LastModified,IsLatest]" `
    --output table
```

#### ステップ2: 前のバージョンを復元

```powershell
# 前のバージョンをコピーして最新版として復元
aws s3api copy-object `
    --bucket tdnet-data-collector-pdfs-prod-123456789012 `
    --copy-source "tdnet-data-collector-pdfs-prod-123456789012/2024/01/15/TD20240115001.pdf?versionId=<version-id>" `
    --key "2024/01/15/TD20240115001.pdf"
```

#### ステップ3: 削除されたオブジェクトの復元

```powershell
# 削除マーカーを削除して復元
aws s3api delete-object `
    --bucket tdnet-data-collector-pdfs-prod-123456789012 `
    --key "2024/01/15/TD20240115001.pdf" `
    --version-id <delete-marker-version-id>
```

#### バッチ復元スクリプト

```powershell
# 特定の日付のすべてのPDFを復元
$bucket = "tdnet-data-collector-pdfs-prod-123456789012"
$prefix = "2024/01/15/"

# 削除マーカーを取得
$deleteMarkers = aws s3api list-object-versions `
    --bucket $bucket `
    --prefix $prefix `
    --query "DeleteMarkers[*].[Key,VersionId]" `
    --output json | ConvertFrom-Json

# 削除マーカーを削除して復元
foreach ($marker in $deleteMarkers) {
    $key = $marker[0]
    $versionId = $marker[1]
    
    Write-Host "Restoring $key..."
    
    aws s3api delete-object `
        --bucket $bucket `
        --key $key `
        --version-id $versionId
    
    Write-Host "✅ $key restored"
}
```

---

## 緊急時の対応手順

### シナリオ1: デプロイ直後にLambda関数がエラー

#### 症状
- Lambda関数の実行でエラーが多発
- CloudWatch Logsにエラーログが大量に出力

#### 対応手順

```powershell
# 1. 即座にアラームを確認
aws cloudwatch describe-alarms `
    --alarm-names "tdnet-collector-prod-errors" `
    --query "MetricAlarms[*].[AlarmName,StateValue,StateReason]"

# 2. Lambda関数のエラーログを確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow

# 3. 前のバージョンにロールバック
git checkout v1.2.2
npm ci && npm run build
cdk deploy --context environment=prod --require-approval always

# 4. ロールバック完了を確認
aws cloudformation wait stack-update-complete `
    --stack-name TdnetDataCollectorStack-prod

# 5. スモークテスト実行
.\scripts\smoke-test.ps1 -Environment prod
```

### シナリオ2: データ整合性の問題

#### 症状
- DynamoDBに不正なデータが保存されている
- データの欠損や重複が発生

#### 対応手順

```powershell
# 1. 問題の範囲を特定
aws dynamodb scan `
    --table-name tdnet_disclosures_prod `
    --filter-expression "attribute_not_exists(disclosure_id)" `
    --select COUNT

# 2. 問題が発生した時刻を特定
# CloudWatch Logsで最初のエラーログの時刻を確認

# 3. その時刻の直前にDynamoDBを復元
$restoreDateTime = "2024-02-14T11:55:00+00:00"  # エラー発生の5分前

aws dynamodb restore-table-to-point-in-time `
    --source-table-name tdnet_disclosures_prod `
    --target-table-name tdnet_disclosures_prod_restored `
    --restore-date-time $restoreDateTime

# 4. 復元完了を待機
aws dynamodb wait table-exists --table-name tdnet_disclosures_prod_restored

# 5. データを検証
aws dynamodb scan `
    --table-name tdnet_disclosures_prod_restored `
    --select COUNT
```

### シナリオ3: パフォーマンス低下

#### 症状
- Lambda関数の実行時間が著しく増加
- タイムアウトエラーが多発

#### 対応手順

```powershell
# 1. Lambda関数のメトリクスを確認
aws cloudwatch get-metric-statistics `
    --namespace AWS/Lambda `
    --metric-name Duration `
    --dimensions Name=FunctionName,Value=tdnet-collector-prod `
    --start-time (Get-Date).AddHours(-2).ToString("yyyy-MM-ddTHH:mm:ss") `
    --end-time (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss") `
    --period 300 `
    --statistics Average,Maximum

# 2. 前のバージョンと比較
# 前のバージョンのメトリクスを確認

# 3. パフォーマンスが悪化している場合、ロールバック
git checkout v1.2.2
npm ci && npm run build
cdk deploy --context environment=prod --require-approval always
```

---

## ロールバック後の確認

### チェックリスト

#### CDKスタック

- [ ] CloudFormationスタックの状態が `UPDATE_COMPLETE`
- [ ] すべてのLambda関数が正常に動作
- [ ] DynamoDBテーブルが正常にアクセス可能
- [ ] S3バケットが正常にアクセス可能
- [ ] API Gatewayエンドポイントが正常に応答

#### データ整合性

- [ ] DynamoDBのアイテム数が期待通り
- [ ] S3のオブジェクト数が期待通り
- [ ] データの欠損や重複がない
- [ ] date_partitionが正しく生成されている

#### パフォーマンス

- [ ] Lambda関数の実行時間が正常範囲内（< 5分）
- [ ] メモリ使用率が正常範囲内（< 80%）
- [ ] エラー率が正常範囲内（< 5%）
- [ ] DynamoDBの読み書きスループットが正常

#### 監視

- [ ] CloudWatch Alarmsが正常に動作
- [ ] CloudWatch Logsにエラーがない
- [ ] CloudWatch Metricsが正常に記録されている
- [ ] CloudWatch Dashboardが正常に表示

### 確認スクリプト

```powershell
# ロールバック後の確認スクリプト
function Test-RollbackSuccess {
    param(
        [string]$Environment = "prod"
    )
    
    Write-Host "=== ロールバック後の確認 ===" -ForegroundColor Cyan
    
    # 1. CloudFormationスタックの状態
    Write-Host "`n1. CloudFormationスタックの状態を確認中..." -ForegroundColor Yellow
    $stackStatus = aws cloudformation describe-stacks `
        --stack-name "TdnetDataCollectorStack-$Environment" `
        --query "Stacks[0].StackStatus" `
        --output text
    
    if ($stackStatus -eq "UPDATE_COMPLETE") {
        Write-Host "✅ スタックの状態: $stackStatus" -ForegroundColor Green
    } else {
        Write-Host "❌ スタックの状態: $stackStatus" -ForegroundColor Red
        return $false
    }
    
    # 2. Lambda関数の実行テスト
    Write-Host "`n2. Lambda関数の実行テスト中..." -ForegroundColor Yellow
    $testEvent = @{
        mode = "on-demand"
        start_date = (Get-Date).ToString("yyyy-MM-dd")
        end_date = (Get-Date).ToString("yyyy-MM-dd")
    } | ConvertTo-Json
    
    $response = aws lambda invoke `
        --function-name "tdnet-collector-$Environment" `
        --payload $testEvent `
        --cli-binary-format raw-in-base64-out `
        response.json
    
    $result = Get-Content response.json | ConvertFrom-Json
    
    if ($result.status -eq "success") {
        Write-Host "✅ Lambda関数が正常に実行されました" -ForegroundColor Green
    } else {
        Write-Host "❌ Lambda関数の実行に失敗しました" -ForegroundColor Red
        return $false
    }
    
    # 3. DynamoDBのアイテム数確認
    Write-Host "`n3. DynamoDBのアイテム数を確認中..." -ForegroundColor Yellow
    $itemCount = aws dynamodb scan `
        --table-name "tdnet_disclosures_$Environment" `
        --select COUNT `
        --query "Count" `
        --output text
    
    Write-Host "✅ DynamoDBアイテム数: $itemCount" -ForegroundColor Green
    
    # 4. CloudWatch Alarmsの状態確認
    Write-Host "`n4. CloudWatch Alarmsの状態を確認中..." -ForegroundColor Yellow
    $alarms = aws cloudwatch describe-alarms `
        --alarm-name-prefix "tdnet-" `
        --state-value ALARM `
        --query "MetricAlarms[*].AlarmName" `
        --output json | ConvertFrom-Json
    
    if ($alarms.Count -eq 0) {
        Write-Host "✅ アラームは発火していません" -ForegroundColor Green
    } else {
        Write-Host "❌ 以下のアラームが発火しています:" -ForegroundColor Red
        $alarms | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        return $false
    }
    
    Write-Host "`n=== ロールバック成功 ===" -ForegroundColor Green
    return $true
}

# 実行
Test-RollbackSuccess -Environment prod
```

---

## 予防措置

### デプロイ前の対策

#### 1. 十分なテストの実施

```powershell
# すべてのテストを実行
npm test

# カバレッジを確認（80%以上）
npm run test:coverage

# E2Eテストを実行
npm run test:e2e
```

#### 2. CDK Diffの確認

```powershell
# 差分を確認
cdk diff --context environment=prod

# 破壊的変更がないか確認
# - リソースの削除（[-]）
# - リソースの置き換え（[~]）
```

#### 3. 段階的デプロイ

```powershell
# 1. 開発環境にデプロイ
cdk deploy --context environment=dev

# 2. スモークテスト実行
.\scripts\smoke-test.ps1 -Environment dev

# 3. 問題がなければ本番環境にデプロイ
cdk deploy --context environment=prod
```

### デプロイ後の対策

#### 1. 監視の強化

```powershell
# CloudWatch Dashboardを確認
# https://console.aws.amazon.com/cloudwatch/

# アラームの状態を確認
aws cloudwatch describe-alarms `
    --alarm-name-prefix "tdnet-" `
    --query "MetricAlarms[*].[AlarmName,StateValue]" `
    --output table
```

#### 2. ログの監視

```powershell
# Lambda関数のログをリアルタイムで監視
aws logs tail /aws/lambda/tdnet-collector-prod --follow

# エラーログをフィルタリング
aws logs filter-log-events `
    --log-group-name /aws/lambda/tdnet-collector-prod `
    --filter-pattern "ERROR" `
    --start-time (Get-Date).AddMinutes(-30).ToUniversalTime().ToString("o")
```

#### 3. バックアップの確認

```powershell
# DynamoDB PITRの状態を確認
aws dynamodb describe-continuous-backups `
    --table-name tdnet_disclosures_prod `
    --query "ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus"

# S3バージョニングの状態を確認
aws s3api get-bucket-versioning `
    --bucket tdnet-data-collector-pdfs-prod-123456789012
```

### CloudTrailログの保存期間

CloudTrailログは7年間保存されます（コンプライアンス要件）：

```typescript
// cdk/lib/tdnet-data-collector-stack.ts
lifecycleRules: [
  {
    id: 'ArchiveAndDelete',
    enabled: true,
    transitions: [
      {
        storageClass: s3.StorageClass.GLACIER,
        transitionAfter: cdk.Duration.days(90), // 90日後にGlacierに移行
      },
    ],
    expiration: cdk.Duration.days(2555), // 7年後に自動削除
  },
]
```

---

## 参考リンク

- [AWS CloudFormation ロールバック](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/using-cfn-rollback-triggers.html)
- [DynamoDB Point-in-Time Recovery](https://docs.aws.amazon.com/ja_jp/amazondynamodb/latest/developerguide/PointInTimeRecovery.html)
- [S3 バージョニング](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/Versioning.html)
- [CloudTrail ログの保存](https://docs.aws.amazon.com/ja_jp/awscloudtrail/latest/userguide/cloudtrail-log-file-examples.html)
- [デプロイチェックリスト](.kiro/steering/infrastructure/deployment-checklist.md)
- [デプロイスモークテスト](.kiro/specs/tdnet-data-collector/docs/deployment-smoke-test.md)

---

## 変更履歴

- 2026-02-14: 初版作成 - CDKスタックとデータベースのロールバック手順を文書化

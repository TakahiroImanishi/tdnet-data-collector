# TDnet Data Collector - 運用マニュアル

## 📋 目次

1. [概要](#概要)
2. [デプロイ手順](#デプロイ手順)
3. [日常運用タスク](#日常運用タスク)
4. [ログ確認方法](#ログ確認方法)
5. [アラート対応手順](#アラート対応手順)
6. [トラブルシューティング](#トラブルシューティング)
7. [緊急時対応](#緊急時対応)
8. [メンテナンス](#メンテナンス)
9. [セキュリティ運用](#セキュリティ運用)
10. [コスト管理](#コスト管理)

---

## 概要

このマニュアルは、TDnet Data Collectorシステムの運用担当者向けに、デプロイ手順、日常運用タスク、トラブルシューティング、緊急時対応などを説明します。

### システム概要

- **目的**: TDnetから上場企業の開示情報を自動収集
- **実行頻度**: EventBridgeスケジュール（Phase 5で実装予定）
- **データ保存先**: DynamoDB（メタデータ）、S3（PDFファイル）
- **監視**: CloudWatch Logs、CloudWatch Alarms、SNS通知

### 運用体制

| 役割 | 責任範囲 |
|------|---------|
| **システム管理者** | デプロイ、インフラ管理、セキュリティ |
| **運用担当者** | 日常監視、アラート対応、データ確認 |
| **開発者** | バグ修正、機能追加、コードレビュー |

---

## デプロイ手順

### 前提条件

- AWS CLIが設定済み（`aws configure`）
- Node.js 20.x以上がインストール済み
- AWS CDK CLIがインストール済み（`npm install -g aws-cdk`）
- 適切なIAM権限（CloudFormation、Lambda、DynamoDB、S3など）

### 4スタック構成でのデプロイ

本番環境では以下の4つのスタックに分割されています:

1. **Foundation Stack**: DynamoDB、S3、CloudTrail
2. **Compute Stack**: Lambda関数、EventBridge（Phase 5で実装予定）
3. **API Stack**: API Gateway、WAF
4. **Monitoring Stack**: CloudWatch Alarms、SNS

詳細は [デプロイガイド](../04-deployment/deployment-guide.md) を参照してください。

### 開発環境へのデプロイ

#### 1. リポジトリのクローンと依存関係のインストール

```bash
# リポジトリをクローン
git clone https://github.com/your-org/tdnet-data-collector.git
cd tdnet-data-collector

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```


#### 2. 環境変数の設定

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
# 必須環境変数:
# - S3_BUCKET_NAME: PDFファイル保存先S3バケット名
# - DYNAMODB_TABLE_NAME: 開示情報メタデータテーブル名
# - DYNAMODB_EXECUTIONS_TABLE: 実行状態管理テーブル名
# - LOG_LEVEL: ログレベル（info/debug/warn/error）
```

#### 3. テストの実行

```bash
# すべてのテストを実行
npm test

# カバレッジレポート生成（80%以上必須）
npm test -- --coverage

# カバレッジが80%未満の場合はデプロイしない
```

#### 4. CDK Bootstrap（初回のみ）

```bash
# CDK環境の初期化
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1

# 成功メッセージを確認
# ✅ Environment aws://ACCOUNT-ID/ap-northeast-1 bootstrapped
```

#### 5. CDK Diff（変更内容の確認）

```bash
# 変更差分を確認
npm run cdk:diff

# 出力例:
# Stack TdnetDataCollectorStack-dev
# Resources
# [+] AWS::Lambda::Function Collector
# [~] AWS::DynamoDB::Table DisclosuresTable
```

#### 6. CDK Deploy（デプロイ実行）

```bash
# 開発環境にデプロイ
npm run cdk:deploy

# デプロイ確認プロンプトで "y" を入力
# Do you wish to deploy these changes (y/n)? y

# デプロイ完了メッセージを確認
# ✅ TdnetDataCollectorStack-dev

# 出力されたAPI URLやリソース名をメモ
```

#### 7. デプロイ後の確認

```bash
# Lambda関数が作成されたことを確認
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'tdnet')]"

# DynamoDBテーブルが作成されたことを確認
aws dynamodb list-tables --query "TableNames[?starts_with(@, 'tdnet')]"

# S3バケットが作成されたことを確認
aws s3 ls | grep tdnet
```

### 本番環境へのデプロイ

#### 1. GitHub Actionsによる自動デプロイ（推奨）

```bash
# mainブランチにマージすると自動デプロイ
git checkout main
git merge develop
git push origin main

# GitHub Actionsのワークフローを確認
# https://github.com/your-org/tdnet-data-collector/actions
```

#### 2. 手動デプロイ（緊急時のみ）

```bash
# 本番環境用の環境変数を設定
export CDK_DEPLOY_ENVIRONMENT=prod

# 本番環境にデプロイ
npm run cdk:deploy -- --context environment=prod

# デプロイ確認プロンプトで "y" を入力
```

#### 3. デプロイ後のスモークテスト

```bash
# Lambda関数を手動実行
aws lambda invoke \
  --function-name tdnet-collector-prod \
  --payload '{"mode":"batch"}' \
  response.json

# 実行結果を確認
cat response.json

# 期待される出力:
# {
#   "statusCode": 200,
#   "body": {
#     "execution_id": "exec_...",
#     "status": "completed",
#     "collected_count": 50,
#     "failed_count": 0
#   }
# }
```

### デプロイチェックリスト

デプロイ前に以下を確認してください：

- [ ] すべてのテストが成功している（`npm test`）
- [ ] カバレッジが80%以上（`npm test -- --coverage`）
- [ ] コードレビューが完了している
- [ ] 環境変数が正しく設定されている
- [ ] IAMロールと権限が適切に設定されている
- [ ] CloudWatchアラームが設定されている
- [ ] セキュリティ監査が完了している（`npm audit`）
- [ ] デプロイ記録を作成する（日時、担当者、変更内容）

詳細は [デプロイチェックリスト](.kiro/steering/infrastructure/deployment-checklist.md) を参照してください。

---

## 日常運用タスク

### 毎日の確認事項

#### 1. データ収集の確認（午前10時頃）

```bash
# 最新の実行状態を確認
aws dynamodb scan \
  --table-name tdnet_executions_prod \
  --filter-expression "begins_with(execution_id, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"exec_"}}' \
  --limit 1 \
  --output table

# 期待される出力:
# status: "completed"
# collected_count: 50前後
# failed_count: 0または少数
```

#### 2. エラーログの確認

```bash
# 過去24時間のエラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "ERROR" \
  --start-time $(date -d '24 hours ago' +%s)000 \
  --end-time $(date +%s)000

# エラーがある場合は内容を確認し、必要に応じて対応
```

#### 3. CloudWatchメトリクスの確認

AWS Consoleで以下のメトリクスを確認：

- **Lambda実行時間**: 平均2分以内
- **Lambda エラー率**: 5%以下
- **DynamoDB スロットリング**: 0件
- **S3 アップロード失敗**: 0件

#### 4. アラート通知の確認

SNS通知（メール/Slack）を確認：

- エラー率が10%を超えた場合
- Lambda実行が失敗した場合
- DLQにメッセージが蓄積された場合

### 週次の確認事項

#### 1. データ整合性の確認

```bash
# 過去7日間の収集件数を確認
aws dynamodb query \
  --table-name tdnet_disclosures_prod \
  --index-name GSI_DatePartition \
  --key-condition-expression "date_partition = :partition" \
  --expression-attribute-values '{":partition":{"S":"2024-01"}}' \
  --select COUNT

# 期待される件数: 約350件（50件/日 × 7日）
```

#### 2. S3ストレージ使用量の確認

```bash
# S3バケットのサイズを確認
aws s3 ls s3://tdnet-pdfs-prod/ --recursive --summarize | grep "Total Size"

# 期待される増加量: 約350MB/週（1MB/PDF × 50件/日 × 7日）
```

#### 3. コスト確認

AWS Cost Explorerで以下を確認：

- 月間コストが予算内（約$11/月）
- 主要コスト要因（WAF、CloudWatch、Secrets Manager）
- 異常なコスト増加がないか

### 月次の確認事項

#### 1. セキュリティ監査

```bash
# 依存関係の脆弱性チェック
npm audit --audit-level=high

# 脆弱性がある場合は更新
npm audit fix
```

#### 2. CloudTrailログの確認

AWS Consoleで以下を確認：

- 不審なAPI呼び出しがないか
- IAMロールの使用状況
- リソースへのアクセスログ

#### 3. バックアップの確認

- DynamoDBのポイントインタイムリカバリが有効
- S3バケットのバージョニングが有効
- CloudTrailログが保存されている

---

## ログ確認方法

### CloudWatch Logsの確認

#### 1. AWS Consoleでの確認

1. AWS Console → CloudWatch → ログ → ログ グループ
2. `/aws/lambda/tdnet-collector-prod` を選択
3. 最新のログストリームを選択
4. ログを確認

#### 2. AWS CLIでの確認

```bash
# リアルタイムでログを確認（tail -f相当）
aws logs tail /aws/lambda/tdnet-collector-prod --follow

# 特定の期間のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --end-time $(date +%s)000

# エラーログのみを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "ERROR"

# 特定の開示IDに関するログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "TD202401151234001"
```

### ログの構造

Lambda関数のログは以下の構造で出力されます：

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "info",
  "message": "Processing disclosure",
  "context": {
    "execution_id": "exec_1705315800000_abc123_12345678",
    "disclosure_id": "TD202401151234001",
    "company_code": "1234",
    "company_name": "株式会社サンプル"
  }
}
```

### ログレベル

| レベル | 説明 | 使用例 |
|--------|------|--------|
| **ERROR** | エラー発生時 | ネットワークエラー、バリデーションエラー |
| **WARN** | 警告（処理は継続） | 部分的失敗、リトライ実行 |
| **INFO** | 通常の処理情報 | 処理開始、処理完了、進捗状況 |
| **DEBUG** | デバッグ情報 | 詳細なデータ、内部状態 |

### ログ検索のヒント

```bash
# 特定の日付のログを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "2024-01-15"

# 特定の企業コードのログを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "company_code: 1234"

# タイムアウトエラーを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Task timed out"

# メモリ不足エラーを検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Runtime exited with error"
```

---

## アラート対応手順

### CloudWatch Alarmsの設定

システムでは以下のアラームが設定されています：

| アラーム名 | 条件 | 重要度 | 対応時間 |
|-----------|------|--------|---------|
| **Lambda Error Rate** | エラー率 > 10% | 高 | 30分以内 |
| **Lambda Execution Failed** | 実行失敗 | 高 | 30分以内 |
| **DLQ Messages** | DLQメッセージ数 > 10 | 中 | 2時間以内 |
| **DynamoDB Throttling** | スロットリング発生 | 中 | 2時間以内 |
| **S3 Upload Failed** | アップロード失敗 > 5 | 中 | 2時間以内 |

### アラート通知の受信

SNS経由でメール/Slackに通知が届きます：

```
件名: ALARM: "Lambda-Error-Rate-Alarm" in Asia Pacific (Tokyo)
本文:
Alarm Details:
- Name: Lambda-Error-Rate-Alarm
- Description: Lambda error rate exceeded 10%
- State Change: OK -> ALARM
- Reason: Threshold Crossed: 1 datapoint [15.0 (12/02/24 10:30:00)] was greater than the threshold (10.0)
```

### アラート対応フロー

#### 1. Lambda Error Rate Alarm（エラー率 > 10%）

**原因の特定**:

```bash
# エラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000

# エラーの種類を集計
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "error_type" \
  | jq -r '.events[].message' \
  | grep -o '"error_type":"[^"]*"' \
  | sort | uniq -c
```

**対応手順**:

1. **ネットワークエラー（ECONNRESET, ETIMEDOUT）**
   - TDnetサイトの状態を確認
   - 一時的な問題の場合は自動再試行で解決
   - 継続する場合はレート制限を緩和

2. **バリデーションエラー（ValidationError）**
   - TDnetサイトのHTML構造変更を確認
   - `src/scraper/html-parser.ts` のセレクタを更新
   - 緊急デプロイを実施

3. **AWS サービスエラー（ThrottlingException）**
   - DynamoDB/S3のスロットリングを確認
   - 必要に応じてキャパシティを増加

#### 2. Lambda Execution Failed Alarm（実行失敗）

**原因の特定**:

```bash
# 失敗した実行のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Task timed out" \
  --start-time $(date -d '1 hour ago' +%s)000
```

**対応手順**:

1. **タイムアウト**
   - Lambda関数のタイムアウトを延長（15分 → 20分）
   - 並列度を削減（5 → 3）

2. **メモリ不足**
   - Lambda関数のメモリを増加（512MB → 1024MB）

3. **設定エラー**
   - 環境変数を確認
   - IAMロールの権限を確認

#### 3. DLQ Messages Alarm（DLQメッセージ蓄積）

**原因の特定**:

```bash
# DLQメッセージを確認
aws sqs receive-message \
  --queue-url https://sqs.ap-northeast-1.amazonaws.com/ACCOUNT-ID/tdnet-collector-dlq \
  --max-number-of-messages 10

# DLQプロセッサーのログを確認
aws logs tail /aws/lambda/tdnet-dlq-processor-prod --follow
```

**対応手順**:

1. **メッセージ内容を確認**
   - エラーの種類を特定
   - 共通の原因があるか確認

2. **手動再処理**
   - DLQプロセッサーLambdaを手動実行
   - または、メッセージを元のキューに戻す

3. **根本原因の修正**
   - コードを修正してデプロイ
   - 再発防止策を実装

#### 4. DynamoDB Throttling Alarm（スロットリング発生）

**対応手順**:

```bash
# スロットリングメトリクスを確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=tdnet_disclosures_prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Sum
```

**解決策**:

1. **一時的な対応**
   - バッチサイズを削減
   - 書き込み間隔を延長

2. **恒久的な対応**
   - オンデマンドモードを確認（既に設定済み）
   - バッチ書き込みを使用（`batchWriteItem`）

#### 5. S3 Upload Failed Alarm（アップロード失敗）

**対応手順**:

```bash
# S3エラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "S3" \
  --filter-pattern "ERROR"
```

**解決策**:

1. **権限エラー**
   - Lambda実行ロールのS3権限を確認
   - バケットポリシーを確認

2. **ネットワークエラー**
   - 自動再試行で解決（AWS SDK）
   - 継続する場合はAWSサポートに連絡

---

## トラブルシューティング

### よくある問題と解決策

#### 1. データ収集が実行されない

**症状**: 毎日午前9時にデータ収集が実行されない

**確認事項**:

```bash
# EventBridgeルールを確認
aws events describe-rule --name tdnet-daily-collector-prod

# ルールが有効か確認（State: ENABLED）
# スケジュール式を確認（cron(0 0 * * ? *)）

# Lambda関数のトリガーを確認
aws lambda get-policy --function-name tdnet-collector-prod
```

**解決策**:

1. EventBridgeルールが無効化されている場合:
   ```bash
   aws events enable-rule --name tdnet-daily-collector-prod
   ```

2. Lambda関数のトリガーが削除されている場合:
   - CDKで再デプロイ

#### 2. PDFダウンロードが失敗する

**症状**: メタデータは保存されるがPDFがS3にない

**確認事項**:

```bash
# エラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "downloadPdf" \
  --filter-pattern "ERROR"

# S3バケットの存在を確認
aws s3 ls s3://tdnet-pdfs-prod/
```

**解決策**:

1. **ネットワークタイムアウト**
   - タイムアウト時間を延長（30秒 → 60秒）
   - リトライ回数を増加（3回 → 5回）

2. **S3権限エラー**
   - Lambda実行ロールに `s3:PutObject` 権限を追加

3. **PDFファイルが大きすぎる**
   - Lambda関数のメモリを増加
   - ストリーム処理を使用

#### 3. DynamoDB書き込みエラー

**症状**: `ConditionalCheckFailedException` エラーが頻発

**確認事項**:

```bash
# 重複エラーを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "ConditionalCheckFailedException"
```

**解決策**:

1. **正常な重複チェック**
   - 既存データの上書きを防ぐための正常な動作
   - ログレベルをWARNに変更

2. **異常な重複**
   - `disclosure_id` 生成ロジックを確認
   - シーケンス番号の重複を調査

#### 4. メモリ不足エラー

**症状**: `Runtime exited with error: signal: killed`

**確認事項**:

```bash
# メモリ使用量を確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Memory Size" \
  | grep "Max Memory Used"
```

**解決策**:

```bash
# Lambda関数のメモリを増加
aws lambda update-function-configuration \
  --function-name tdnet-collector-prod \
  --memory-size 1024
```

#### 5. タイムアウトエラー

**症状**: `Task timed out after 900.00 seconds`

**確認事項**:

```bash
# 実行時間を確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --filter-pattern "Duration" \
  | grep "Duration:"
```

**解決策**:

1. **タイムアウトを延長**:
   ```bash
   aws lambda update-function-configuration \
     --function-name tdnet-collector-prod \
     --timeout 1200  # 20分
   ```

2. **並列度を削減**:
   - 環境変数 `CONCURRENCY` を 5 → 3 に変更

3. **日付範囲を分割**:
   - 1ヶ月分を1週間ずつに分割して実行

#### 6. TDnetサイトのHTML構造変更

**症状**: `Failed to parse HTML: selector not found`

**確認事項**:

1. TDnetサイトにアクセスして構造を確認
2. ブラウザの開発者ツールでセレクタを確認

**解決策**:

1. `src/scraper/html-parser.ts` を更新:
   ```typescript
   // 旧セレクタ
   const rows = $('table.tdnet-table tr');
   
   // 新セレクタ（例）
   const rows = $('table.disclosure-list tr');
   ```

2. テストを実行:
   ```bash
   npm test -- src/scraper/__tests__/html-parser.test.ts
   ```

3. 緊急デプロイ:
   ```bash
   npm run cdk:deploy
   ```

---

## 緊急時対応

### ロールバック手順

#### 1. Lambda関数のロールバック

```bash
# 以前のバージョンを確認
aws lambda list-versions-by-function \
  --function-name tdnet-collector-prod

# 特定のバージョンにロールバック
aws lambda update-alias \
  --function-name tdnet-collector-prod \
  --name prod \
  --function-version 3  # 安定版のバージョン番号
```

#### 2. CDKスタックのロールバック

```bash
# CloudFormationスタックの変更セットを確認
aws cloudformation describe-stack-events \
  --stack-name TdnetDataCollectorStack-prod \
  --max-items 20

# 前回のスタックにロールバック
# 注意: CDKではロールバックは推奨されません
# 代わりに、前回のコミットをデプロイしてください

git checkout <前回の安定版コミット>
npm run cdk:deploy
```

### データ再収集手順

#### 1. 特定日のデータ再収集

```bash
# Lambda関数を手動実行（オンデマンドモード）
aws lambda invoke \
  --function-name tdnet-collector-prod \
  --payload '{
    "mode": "on-demand",
    "start_date": "2024-01-15",
    "end_date": "2024-01-15"
  }' \
  response.json

# 実行結果を確認
cat response.json
```

#### 2. 期間指定でのデータ再収集

```bash
# 1週間分のデータを再収集
aws lambda invoke \
  --function-name tdnet-collector-prod \
  --payload '{
    "mode": "on-demand",
    "start_date": "2024-01-15",
    "end_date": "2024-01-21"
  }' \
  response.json
```

#### 3. 既存データの削除（再収集前）

```bash
# DynamoDBから特定日のデータを削除
aws dynamodb query \
  --table-name tdnet_disclosures_prod \
  --index-name GSI_DatePartition \
  --key-condition-expression "date_partition = :partition" \
  --expression-attribute-values '{":partition":{"S":"2024-01"}}' \
  | jq -r '.Items[].disclosure_id.S' \
  | xargs -I {} aws dynamodb delete-item \
      --table-name tdnet_disclosures_prod \
      --key '{"disclosure_id":{"S":"{}"}}'

# S3から特定月のPDFを削除
aws s3 rm s3://tdnet-pdfs-prod/pdfs/2024/01/ --recursive
```

### システム停止手順

#### 1. 緊急停止（データ収集を停止）

```bash
# EventBridgeルールを無効化
aws events disable-rule --name tdnet-daily-collector-prod

# 確認
aws events describe-rule --name tdnet-daily-collector-prod
# State: DISABLED
```

#### 2. Lambda関数の無効化

```bash
# Lambda関数の同時実行数を0に設定
aws lambda put-function-concurrency \
  --function-name tdnet-collector-prod \
  --reserved-concurrent-executions 0
```

#### 3. システム再開

```bash
# EventBridgeルールを有効化
aws events enable-rule --name tdnet-daily-collector-prod

# Lambda関数の同時実行数制限を解除
aws lambda delete-function-concurrency \
  --function-name tdnet-collector-prod
```

### エスカレーション

以下の場合はAWSサポートに連絡してください：

1. **AWS サービスの障害**
   - Lambda、DynamoDB、S3などのサービスが利用できない
   - リージョン全体の障害

2. **セキュリティインシデント**
   - 不正アクセスの疑い
   - データ漏洩の可能性

3. **解決できない技術的問題**
   - 上記のトラブルシューティングで解決しない
   - AWS側の設定や制限に関する問題

**AWSサポート連絡先**:
- サポートケースを作成: https://console.aws.amazon.com/support/
- 電話: 0120-921-377（日本）

---

## メンテナンス

### 定期メンテナンスタスク

#### 月次メンテナンス

**1. 依存関係の更新**

```bash
# セキュリティ監査
npm audit --audit-level=high

# 脆弱性がある場合は更新
npm audit fix

# すべての依存関係を更新
npm update

# テストを実行
npm test

# デプロイ
npm run cdk:deploy
```

**2. ログの確認とクリーンアップ**

```bash
# 古いログストリームを削除（90日以上前）
aws logs describe-log-streams \
  --log-group-name /aws/lambda/tdnet-collector-prod \
  --order-by LastEventTime \
  --descending \
  | jq -r '.logStreams[] | select(.lastEventTimestamp < (now - 7776000) * 1000) | .logStreamName' \
  | xargs -I {} aws logs delete-log-stream \
      --log-group-name /aws/lambda/tdnet-collector-prod \
      --log-stream-name {}
```

**3. DynamoDBのバックアップ確認**

```bash
# ポイントインタイムリカバリが有効か確認
aws dynamodb describe-continuous-backups \
  --table-name tdnet_disclosures_prod

# 期待される出力:
# PointInTimeRecoveryStatus: ENABLED
```

**4. S3ライフサイクルポリシーの確認**

```bash
# ライフサイクルポリシーを確認
aws s3api get-bucket-lifecycle-configuration \
  --bucket tdnet-pdfs-prod

# 期待される設定:
# - 90日後にStandard-IAに移行
# - 365日後にGlacierに移行
```

#### 四半期メンテナンス

**1. コスト分析**

AWS Cost Explorerで以下を確認：

- 月間コストの推移
- サービス別コスト内訳
- 予算との比較
- コスト最適化の機会

**2. パフォーマンス分析**

CloudWatch Insightsで以下を分析：

```sql
-- Lambda実行時間の推移
fields @timestamp, @duration
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)

-- エラー率の推移
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() as error_count by bin(1h)

-- メモリ使用量の推移
fields @timestamp, @maxMemoryUsed, @memorySize
| filter @type = "REPORT"
| stats avg(@maxMemoryUsed), max(@maxMemoryUsed) by bin(1h)
```

**3. セキュリティレビュー**

- IAMロールの権限を最小権限に見直し
- 未使用のリソースを削除
- CloudTrailログを確認
- セキュリティグループを見直し

#### 年次メンテナンス

**1. アーキテクチャレビュー**

- システム全体の設計を見直し
- 新しいAWSサービスの活用を検討
- パフォーマンス改善の機会を特定

**2. ディザスタリカバリテスト**

- バックアップからのリストア手順を確認
- ロールバック手順を実行
- データ再収集手順を実行

**3. ドキュメント更新**

- 運用マニュアルを更新
- アーキテクチャドキュメントを更新
- トラブルシューティングガイドを更新

### データ保持ポリシー

| データ種別 | 保持期間 | 削除方法 |
|-----------|---------|---------|
| **DynamoDB（開示情報）** | 無期限 | 手動削除のみ |
| **DynamoDB（実行状態）** | 30日 | TTLで自動削除 |
| **S3（PDFファイル）** | 90日（Standard）<br>365日（Standard-IA）<br>以降（Glacier） | ライフサイクルポリシー |
| **CloudWatch Logs** | 90日 | 自動削除 |
| **CloudTrail Logs** | 365日 | ライフサイクルポリシー |

### バックアップとリストア

#### DynamoDBのバックアップ

**オンデマンドバックアップ**:

```bash
# バックアップを作成
aws dynamodb create-backup \
  --table-name tdnet_disclosures_prod \
  --backup-name tdnet-disclosures-backup-$(date +%Y%m%d)

# バックアップ一覧を確認
aws dynamodb list-backups \
  --table-name tdnet_disclosures_prod
```

**ポイントインタイムリカバリ**:

```bash
# 特定の時点にリストア
aws dynamodb restore-table-to-point-in-time \
  --source-table-name tdnet_disclosures_prod \
  --target-table-name tdnet_disclosures_restored \
  --restore-date-time 2024-01-15T10:00:00Z
```

#### S3のバックアップ

S3バケットはバージョニングが有効化されているため、削除されたファイルも復元可能です：

```bash
# 削除されたファイルを確認
aws s3api list-object-versions \
  --bucket tdnet-pdfs-prod \
  --prefix pdfs/2024/01/

# 特定のバージョンを復元
aws s3api copy-object \
  --bucket tdnet-pdfs-prod \
  --copy-source tdnet-pdfs-prod/pdfs/2024/01/TD202401151234001.pdf?versionId=VERSION_ID \
  --key pdfs/2024/01/TD202401151234001.pdf
```

---

## セキュリティ運用

### アクセス管理

#### IAMユーザーとロールの管理

**最小権限の原則**:

- 各ユーザー/ロールに必要最小限の権限のみを付与
- 定期的に権限を見直し
- 未使用の権限を削除

**推奨されるIAMポリシー**:

| 役割 | 必要な権限 |
|------|-----------|
| **システム管理者** | CloudFormation、Lambda、DynamoDB、S3、IAM（フルアクセス） |
| **運用担当者** | CloudWatch（読み取り）、Lambda（実行）、DynamoDB（読み取り） |
| **開発者** | Lambda（読み取り/更新）、CloudWatch（読み取り）、DynamoDB（読み取り） |
| **監査担当者** | CloudTrail（読み取り）、CloudWatch（読み取り） |

#### MFA（多要素認証）の有効化

すべてのIAMユーザーでMFAを有効化してください：

```bash
# MFAデバイスを確認
aws iam list-mfa-devices --user-name <ユーザー名>

# MFAが有効でない場合は設定
# AWS Console → IAM → ユーザー → セキュリティ認証情報 → MFAデバイスの割り当て
```

### 監査ログの確認

#### CloudTrailログの確認

```bash
# 過去24時間のAPI呼び出しを確認
aws cloudtrail lookup-events \
  --start-time $(date -d '24 hours ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --max-results 50

# 特定のユーザーのアクションを確認
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=admin \
  --max-results 50

# 失敗したAPI呼び出しを確認
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteTable \
  --max-results 50
```

#### 不審なアクティビティの検出

以下のアクティビティに注意してください：

- 深夜の不審なAPI呼び出し
- 未知のIPアドレスからのアクセス
- 大量のデータダウンロード
- IAMロールの変更
- セキュリティグループの変更

### インシデント対応

#### セキュリティインシデント発生時の対応フロー

1. **検知**
   - CloudWatch Alarms
   - CloudTrail異常検知
   - AWS GuardDuty（有効化している場合）

2. **初動対応**
   - 影響範囲の特定
   - 被害の拡大防止（アクセス制限、リソース停止）
   - 証拠の保全（ログの保存）

3. **調査**
   - CloudTrailログの分析
   - アクセスログの分析
   - 影響を受けたリソースの特定

4. **復旧**
   - 脆弱性の修正
   - 侵害されたリソースの削除/再作成
   - パスワード/APIキーの変更

5. **事後対応**
   - インシデントレポートの作成
   - 再発防止策の実施
   - セキュリティポリシーの見直し

#### 緊急連絡先

| 役割 | 連絡先 | 対応時間 |
|------|--------|---------|
| **システム管理者** | admin@example.com | 24時間 |
| **セキュリティ担当者** | security@example.com | 24時間 |
| **AWSサポート** | 0120-921-377 | 24時間 |

---

## コスト管理

### 月間コスト見積もり

詳細は [コスト見積もりドキュメント](cost-estimation.md) を参照してください。

**概算（本番環境）**:

| サービス | 月間コスト | 割合 |
|---------|-----------|------|
| AWS WAF | $8.00 | 72% |
| CloudWatch カスタムメトリクス | $2.70 | 24% |
| Secrets Manager | $0.40 | 4% |
| Lambda | $0.00 | 0%（無料枠内） |
| DynamoDB | $0.00 | 0%（無料枠内） |
| S3 | $0.02 | 0% |
| **合計** | **$11.12** | **100%** |

### コスト最適化のヒント

#### 1. WAFの最適化

開発環境ではWAFを無効化してコストを削減：

```typescript
// cdk/lib/tdnet-data-collector-stack.ts
const envConfig = getEnvironmentConfig(this.deploymentEnvironment);

if (envConfig.enableWaf) {
  // WAFを作成（本番環境のみ）
  this.webAcl = new wafv2.CfnWebACL(/* ... */);
}
```

#### 2. CloudWatchメトリクスの削減

重要なメトリクスのみに絞る（10個以内で無料枠内）：

- Lambda実行時間
- Lambda エラー率
- DynamoDB スロットリング
- S3 アップロード失敗

#### 3. Secrets Managerの代替

Systems Manager Parameter Storeに移行してコストを削減：

```bash
# Secrets Managerから取得（$0.40/月）
aws secretsmanager get-secret-value --secret-id tdnet-api-key

# Parameter Storeから取得（無料）
aws ssm get-parameter --name /tdnet/api-key --with-decryption
```

#### 4. S3ライフサイクルポリシーの活用

古いPDFファイルを低コストのストレージクラスに移行：

- 90日後: Standard → Standard-IA（50%削減）
- 365日後: Standard-IA → Glacier（80%削減）

### コスト監視

#### AWS Budgetsの設定

```bash
# 月間予算を設定（$15）
aws budgets create-budget \
  --account-id ACCOUNT-ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**budget.json**:
```json
{
  "BudgetName": "TDnet-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "15",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

#### コストアラートの設定

予算の80%、100%、120%でアラートを設定：

- 80%（$12）: 警告メール
- 100%（$15）: 緊急メール + Slack通知
- 120%（$18）: システム管理者に連絡

---

## 付録

### 関連ドキュメント

| ドキュメント | 説明 |
|------------|------|
| [README.md](../README.md) | プロジェクト概要、セットアップ手順 |
| [CI/CDパイプライン](ci-cd-pipeline.md) | GitHub Actions、テストカバレッジ |
| [コスト見積もり](cost-estimation.md) | 詳細なコスト分析 |
| [Lambda Collectorアーキテクチャ](architecture/lambda-collector.md) | システムアーキテクチャ |
| [デプロイチェックリスト](../.kiro/steering/infrastructure/deployment-checklist.md) | デプロイ前後の確認事項 |
| [監視とアラート](../.kiro/steering/infrastructure/monitoring-alerts.md) | CloudWatch設定 |
| [セキュリティベストプラクティス](../.kiro/steering/security/security-best-practices.md) | セキュリティガイドライン |

### 用語集

| 用語 | 説明 |
|------|------|
| **TDnet** | 適時開示情報閲覧サービス（Timely Disclosure network） |
| **開示情報** | 上場企業が公開する決算短信、IR情報など |
| **disclosure_id** | 開示情報の一意識別子（例: TD202401151234001） |
| **date_partition** | 月単位のパーティションキー（YYYY-MM形式、JST基準） |
| **DLQ** | Dead Letter Queue（処理失敗メッセージの保存先） |
| **GSI** | Global Secondary Index（DynamoDBのセカンダリインデックス） |
| **TTL** | Time To Live（データの自動削除機能） |
| **WAF** | Web Application Firewall（Webアプリケーションファイアウォール） |

### AWS CLIコマンドリファレンス

#### Lambda

```bash
# 関数一覧
aws lambda list-functions

# 関数の詳細
aws lambda get-function --function-name tdnet-collector-prod

# 関数の実行
aws lambda invoke --function-name tdnet-collector-prod --payload '{}' response.json

# 環境変数の更新
aws lambda update-function-configuration \
  --function-name tdnet-collector-prod \
  --environment Variables={KEY=VALUE}
```

#### DynamoDB

```bash
# テーブル一覧
aws dynamodb list-tables

# テーブルの詳細
aws dynamodb describe-table --table-name tdnet_disclosures_prod

# アイテムの取得
aws dynamodb get-item \
  --table-name tdnet_disclosures_prod \
  --key '{"disclosure_id":{"S":"TD202401151234001"}}'

# クエリ
aws dynamodb query \
  --table-name tdnet_disclosures_prod \
  --index-name GSI_DatePartition \
  --key-condition-expression "date_partition = :partition" \
  --expression-attribute-values '{":partition":{"S":"2024-01"}}'
```

#### S3

```bash
# バケット一覧
aws s3 ls

# ファイル一覧
aws s3 ls s3://tdnet-pdfs-prod/ --recursive

# ファイルのダウンロード
aws s3 cp s3://tdnet-pdfs-prod/pdfs/2024/01/TD202401151234001.pdf ./

# ファイルの削除
aws s3 rm s3://tdnet-pdfs-prod/pdfs/2024/01/TD202401151234001.pdf
```

#### CloudWatch

```bash
# ログストリーム一覧
aws logs describe-log-streams --log-group-name /aws/lambda/tdnet-collector-prod

# ログの確認
aws logs tail /aws/lambda/tdnet-collector-prod --follow

# メトリクスの取得
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=tdnet-collector-prod \
  --start-time $(date -d '1 hour ago' --iso-8601) \
  --end-time $(date --iso-8601) \
  --period 300 \
  --statistics Average
```

### 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|-----------|---------|--------|
| 2026-02-12 | 1.0.0 | 初版作成 | Kiro AI Assistant |

---

## サポート

### 質問・問い合わせ

- **技術的な質問**: GitHub Issues
- **緊急の問題**: システム管理者に連絡
- **セキュリティ問題**: security@example.com

### フィードバック

このマニュアルに関するフィードバックや改善提案は、GitHub Issuesまたはプルリクエストでお願いします。

---

**最終更新**: 2026-02-12  
**バージョン**: 1.0.0  
**作成者**: Kiro AI Assistant

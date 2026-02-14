# TDnet Data Collector - バックアップ戦略

**最終更新**: 2026-02-14  
**バージョン**: 1.0

## 概要

TDnet Data Collectorのバックアップ戦略は、データの再収集可能性と監査ログの長期保存を基本方針としています。

## バックアップ方針

### 1. データ再収集による復旧

#### 1.1 基本方針

TDnetから収集するデータは公開情報であり、データソース（TDnet）から再収集可能です。そのため、従来の定期バックアップではなく、**データ再収集による復旧**を基本戦略とします。

#### 1.2 再収集の実装

- **Lambda Collector**: 日付範囲を指定してデータ収集可能
- **オンデマンド収集**: POST /collect エンドポイントで任意の期間を指定
- **バッチ収集**: EventBridgeスケジュールで日次自動収集（Phase 5で実装予定）

#### 1.3 再収集の制約

- **レート制限**: 1リクエスト/秒（TDnetへの負荷を考慮）
- **収集時間**: 大量データの再収集には時間がかかる
  - 例: 1年分 = 約365日 × 平均50件/日 = 約18,250件 → 約5時間
- **コスト**: Lambda実行時間とDynamoDB書き込みコストが発生

### 2. DynamoDBポイントインタイムリカバリ

#### 2.1 設定状況

すべてのDynamoDBテーブルでポイントインタイムリカバリ（PITR）が有効化されています:

- **tdnet_disclosures**: 開示情報メタデータ
- **tdnet_executions**: 実行状態
- **tdnet_export_status**: エクスポート状態

#### 2.2 復元可能期間

- **過去35日間**: 任意の時点に復元可能
- **復元方法**: AWS Management Console または AWS CLI

#### 2.3 復元手順

```bash
# DynamoDBテーブルを特定の時点に復元
aws dynamodb restore-table-to-point-in-time \
  --source-table-name tdnet_disclosures_prod \
  --target-table-name tdnet_disclosures_prod_restored \
  --restore-date-time 2026-02-13T10:00:00Z
```

### 3. S3バージョニング

#### 3.1 設定状況

すべてのS3バケットでバージョニングが有効化されています:

- **tdnet-data-collector-pdfs**: PDFファイル
- **tdnet-data-collector-exports**: エクスポートファイル
- **tdnet-dashboard**: Webダッシュボード
- **tdnet-cloudtrail-logs**: CloudTrailログ

#### 3.2 復元方法

```bash
# 削除されたオブジェクトを復元
aws s3api list-object-versions \
  --bucket tdnet-data-collector-pdfs-prod-${account-id} \
  --prefix "2024/01/15/"

aws s3api copy-object \
  --bucket tdnet-data-collector-pdfs-prod-${account-id} \
  --copy-source tdnet-data-collector-pdfs-prod-${account-id}/2024/01/15/file.pdf?versionId=xxx \
  --key 2024/01/15/file.pdf
```

### 4. CloudTrail監査ログ

#### 4.1 記録対象

- **管理イベント**: すべてのAPI呼び出し
- **S3データイベント**: PDFバケットの読み取り・書き込み
- **DynamoDBデータイベント**: すべてのテーブルの読み取り・書き込み

#### 4.2 保存期間

- **CloudWatch Logs**: 1年間
- **S3バケット**: 
  - 90日後: Glacierストレージクラスに移行
  - 7年後: 自動削除（コンプライアンス要件）

#### 4.3 ログ確認方法

```bash
# S3バケット直接確認
aws s3 ls s3://tdnet-cloudtrail-logs-${account-id}/ --recursive

# CloudWatch Logs確認
aws logs tail /aws/cloudtrail/tdnet-audit-trail-prod --follow

# CloudTrail Event History（AWS Management Console）
# 過去90日間のイベントを検索可能
```

## 災害復旧手順

### シナリオ1: DynamoDBテーブル全損

1. **ポイントインタイムリカバリで復元**（過去35日以内の場合）
   ```bash
   aws dynamodb restore-table-to-point-in-time \
     --source-table-name tdnet_disclosures_prod \
     --target-table-name tdnet_disclosures_prod_restored \
     --restore-date-time <復元したい時点>
   ```

2. **データ再収集**（35日以前の場合）
   ```bash
   # POST /collect エンドポイントで期間指定
   curl -X POST https://api.tdnet-collector.example.com/collect \
     -H "x-api-key: ${API_KEY}" \
     -H "Content-Type: application/json" \
     -d '{"start_date": "2024-01-01", "end_date": "2024-12-31"}'
   ```

### シナリオ2: S3バケット全損

1. **S3バージョニングで復元**（削除から復元可能期間内の場合）
   - AWS Management Console → S3 → バケット → バージョン表示 → 復元

2. **データ再収集**（PDFファイルの場合）
   - Lambda Collectorで再収集（メタデータとPDFを同時取得）

### シナリオ3: リージョン全体の障害

1. **別リージョンへのデプロイ**
   ```bash
   # 別リージョンにCDKスタックをデプロイ
   cdk deploy --profile prod --region us-west-2
   ```

2. **データ再収集**
   - 新しいリージョンのLambda Collectorで全データを再収集

## バックアップ戦略の評価

### 長所

- ✅ データソースが公開情報であり、いつでも再収集可能
- ✅ DynamoDBポイントインタイムリカバリで過去35日間の復元が可能
- ✅ S3バージョニングで誤削除からの復元が可能
- ✅ CloudTrailログで7年間の監査証跡を保持
- ✅ 定期バックアップのコストが不要

### 短所

- ⚠️ 大量データの再収集には時間がかかる（レート制限: 1req/秒）
- ⚠️ TDnetが利用不可の場合、再収集できない
- ⚠️ 35日以前のデータはポイントインタイムリカバリで復元不可

### 推奨事項

1. **定期的な動作確認**
   - 月次でCloudTrailログが正常に記録されているか確認
   - 四半期ごとにポイントインタイムリカバリのテスト実施

2. **災害復旧手順の文書化**
   - 各シナリオの復旧手順を詳細に文書化
   - 復旧に必要な期間とコストを見積もり

3. **重要データの複数保存**
   - DynamoDBメタデータ + S3 PDFファイルの両方を保持
   - CloudTrailログで操作履歴を記録

4. **マルチリージョン対応（オプション）**
   - 本番運用後、必要に応じて別リージョンへのレプリケーションを検討
   - DynamoDB Global Tables、S3 Cross-Region Replicationの活用

## 関連ドキュメント

- [運用マニュアル](./operations-manual.md) - トラブルシューティング手順
- [デプロイガイド](./production-deployment-guide.md) - 本番環境デプロイ手順
- [コスト見積もり](./cost-estimation.md) - バックアップコストの詳細

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-14 | 1.0 | 初版作成 |

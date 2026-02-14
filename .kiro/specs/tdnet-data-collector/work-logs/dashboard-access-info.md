# TDnet Data Collector - ダッシュボードアクセス情報

**作成日時**: 2026-02-15 00:05

## Webダッシュボード（本番環境）

### アクセスURL

**CloudFront URL**: https://d1vjw7l2clz6ji.cloudfront.net

このURLをブラウザで開くと、TDnet Data CollectorのWebダッシュボードが表示されます。

### ダッシュボードの機能

1. **データ収集管理**
   - データ収集の開始（日付範囲指定）
   - 実行状態のリアルタイム確認
   - 進捗バー表示（0-100%）
   - 収集統計情報（成功件数、失敗件数）

2. **開示情報検索**
   - 企業コード、日付範囲、開示種類でフィルタリング
   - 検索結果の一覧表示
   - PDFダウンロード（署名付きURL）

3. **データエクスポート**
   - JSON/CSV形式でエクスポート
   - エクスポート状態の確認
   - ダウンロードリンク生成

4. **統計情報**
   - 総開示情報数
   - 最新収集日時
   - システムステータス

### ダッシュボードの技術仕様

- **フロントエンド**: React + TypeScript
- **UIライブラリ**: Material-UI
- **ホスティング**: S3 + CloudFront
- **認証**: API Key（x-api-key ヘッダー）
- **レスポンシブデザイン**: モバイル対応

### API設定

ダッシュボードは以下のAPIエンドポイントを使用します：

- **API Endpoint**: https://g7fy393l2j.execute-api.ap-northeast-1.amazonaws.com/prod
- **API Key**: l2yePlH5s01Ax2y6whl796IaG5TYjuhD39vXRYzL

### アクセス方法

#### 方法1: ブラウザで直接開く

```powershell
Start-Process "https://d1vjw7l2clz6ji.cloudfront.net"
```

#### 方法2: URLをコピーしてブラウザに貼り付け

```
https://d1vjw7l2clz6ji.cloudfront.net
```

## CloudWatch Dashboard（監視用）

### アクセスURL

**CloudWatch Console**: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=tdnet-collector-prod

### CloudWatch Dashboardの機能

1. **Lambda実行メトリクス**
   - Invocations（呼び出し回数）
   - Errors（エラー数）
   - Duration（実行時間）
   - Throttles（スロットリング）

2. **DynamoDBメトリクス**
   - 読み書きキャパシティユニット
   - スロットリングイベント
   - レイテンシー

3. **S3メトリクス**
   - バケットサイズ
   - オブジェクト数
   - リクエスト数

4. **カスタムメトリクス**
   - TDnet/Collector namespace
   - CollectionSuccess（収集成功数）
   - CollectionError（収集エラー数）
   - ExecutionTime（実行時間）

5. **アラーム状態**
   - エラー率アラーム
   - 実行時間アラーム
   - 収集成功率アラーム

### アクセス方法

#### 方法1: AWS Management Consoleから

1. AWS Management Consoleにログイン
2. CloudWatchサービスを開く
3. 左メニューから「ダッシュボード」を選択
4. `tdnet-collector-prod` を選択

#### 方法2: 直接URLを開く

```powershell
Start-Process "https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#dashboards:name=tdnet-collector-prod"
```

## その他の管理画面

### 1. DynamoDB Tables

- **tdnet_disclosures_prod**: https://ap-northeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-northeast-1#table?name=tdnet_disclosures_prod
- **tdnet_executions_prod**: https://ap-northeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-northeast-1#table?name=tdnet_executions_prod
- **tdnet_export_status_prod**: https://ap-northeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-northeast-1#table?name=tdnet_export_status_prod

### 2. S3 Buckets

- **PDFファイル**: https://s3.console.aws.amazon.com/s3/buckets/tdnet-data-collector-pdfs-prod-803879841964?region=ap-northeast-1&tab=objects
- **エクスポートファイル**: https://s3.console.aws.amazon.com/s3/buckets/tdnet-data-collector-exports-prod-803879841964?region=ap-northeast-1&tab=objects
- **ダッシュボード**: https://s3.console.aws.amazon.com/s3/buckets/tdnet-dashboard-prod-803879841964?region=ap-northeast-1&tab=objects

### 3. Lambda Functions

- **Collector**: https://ap-northeast-1.console.aws.amazon.com/lambda/home?region=ap-northeast-1#/functions/tdnet-collector-prod
- **Collect**: https://ap-northeast-1.console.aws.amazon.com/lambda/home?region=ap-northeast-1#/functions/tdnet-collect-prod
- **Query**: https://ap-northeast-1.console.aws.amazon.com/lambda/home?region=ap-northeast-1#/functions/tdnet-query-prod
- **Export**: https://ap-northeast-1.console.aws.amazon.com/lambda/home?region=ap-northeast-1#/functions/tdnet-export-prod

### 4. API Gateway

- **API**: https://ap-northeast-1.console.aws.amazon.com/apigateway/main/apis?region=ap-northeast-1

### 5. CloudWatch Logs

- **Collector Logs**: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftdnet-collector-prod
- **Collect Logs**: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftdnet-collect-prod
- **Query Logs**: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftdnet-query-prod
- **Export Logs**: https://ap-northeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Ftdnet-export-prod

## トラブルシューティング

### ダッシュボードが表示されない場合

1. **CloudFront Distribution確認**
   ```powershell
   aws cloudfront get-distribution --id E3XXXXXXXXXX --profile imanishi-awssso
   ```

2. **S3バケット確認**
   ```powershell
   aws s3 ls s3://tdnet-dashboard-prod-803879841964/ --profile imanishi-awssso
   ```

3. **ブラウザのキャッシュクリア**
   - Ctrl + Shift + Delete でキャッシュをクリア

### API接続エラーの場合

1. **API Key確認**
   - ダッシュボードの設定でAPI Keyが正しく設定されているか確認

2. **CORS設定確認**
   - API GatewayのCORS設定を確認

3. **ネットワーク確認**
   - ブラウザの開発者ツール（F12）でネットワークタブを確認

## 参考資料

- **タスク定義**: `.kiro/specs/tdnet-data-collector/tasks.md` (Task 17, 18)
- **ダッシュボード実装ガイド**: `dashboard/INTEGRATION-GUIDE.md`
- **デプロイガイド**: `docs/production-deployment-guide.md`
- **スモークテストガイド**: `docs/smoke-test-guide.md`

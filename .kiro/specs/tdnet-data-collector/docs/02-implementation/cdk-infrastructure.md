# CDKインフラストラクチャドキュメント

TDnet Data CollectorのAWS CDKインフラストラクチャ構成の完全ガイド。

## 目次

1. [概要](#概要)
2. [スタック構成](#スタック構成)
3. [環境設定](#環境設定)
4. [各スタックの詳細](#各スタックの詳細)
5. [Constructsリファレンス](#constructsリファレンス)
6. [デプロイフロー](#デプロイフロー)
7. [トラブルシューティング](#トラブルシューティング)

---

## 概要

### アーキテクチャ原則

- **4層スタック構成**: 関心の分離と変更頻度による分割
- **環境パラメータ化**: dev/prod環境の完全分離
- **依存関係管理**: スタック間の明示的な依存関係定義
- **コスト最適化**: AWS無料枠内での運用を前提とした設計

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| IaC | AWS CDK (TypeScript) |
| Runtime | Node.js 20.x |
| Database | DynamoDB (オンデマンド) |
| Storage | S3 (ライフサイクル管理) |
| Compute | Lambda (128-512MB) |
| API | API Gateway (REST API) |
| Security | WAF, Secrets Manager, CloudTrail |
| Monitoring | CloudWatch (Logs, Metrics, Alarms, Dashboard) |

---

## スタック構成

### 4層スタック構成

```
TdnetFoundation (基盤層)
  ↓ 依存
TdnetCompute (コンピュート層)
  ↓ 依存
TdnetApi (API層)
  ↓ 依存
TdnetMonitoring (監視層)
```


### スタック分割の理由

| スタック | 変更頻度 | 理由 |
|---------|---------|------|
| Foundation | 低（月1回以下） | データベーススキーマ、ストレージ構成は安定 |
| Compute | 高（週数回） | Lambda関数のコード変更が頻繁 |
| API | 中（月数回） | エンドポイント追加、WAF設定変更 |
| Monitoring | 低（月1回以下） | アラーム閾値、ダッシュボード設定は安定 |

### スタック間の依存関係

```typescript
// Foundation Stack (独立)
const foundationStack = new TdnetFoundationStack(app, `TdnetFoundation-${env}`);

// Compute Stack (Foundation に依存)
const computeStack = new TdnetComputeStack(app, `TdnetCompute-${env}`, {
  disclosuresTable: foundationStack.disclosuresTable,
  executionsTable: foundationStack.executionsTable,
  // ...
});
computeStack.addDependency(foundationStack);

// API Stack (Compute に依存)
const apiStack = new TdnetApiStack(app, `TdnetApi-${env}`, {
  queryFunction: computeStack.queryFunction,
  exportFunction: computeStack.exportFunction,
  // ...
});
apiStack.addDependency(computeStack);

// Monitoring Stack (API に依存)
const monitoringStack = new TdnetMonitoringStack(app, `TdnetMonitoring-${env}`, {
  lambdaFunctions: { ... },
  dynamodbTables: { ... },
  // ...
});
monitoringStack.addDependency(apiStack);
```

---

## 環境設定

### 環境タイプ

- **dev**: 開発環境（短いタイムアウト、DEBUGログ、低コスト）
- **prod**: 本番環境（長いタイムアウト、INFOログ、高可用性）


### Lambda環境設定比較

| Lambda関数 | dev timeout | prod timeout | dev memory | prod memory | dev log | prod log |
|-----------|-------------|--------------|------------|-------------|---------|----------|
| Collector | 5分 | 15分 | 256MB | 512MB | DEBUG | DEBUG |
| Query | 10秒 | 30秒 | 128MB | 256MB | DEBUG | DEBUG |
| Export | 2分 | 5分 | 256MB | 512MB | DEBUG | DEBUG |
| Collect | 30秒 | 30秒 | 256MB | 256MB | DEBUG | DEBUG |
| CollectStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | DEBUG |
| ExportStatus | 30秒 | 30秒 | 256MB | 256MB | DEBUG | DEBUG |
| PdfDownload | 30秒 | 30秒 | 256MB | 256MB | DEBUG | DEBUG |
| Health | 10秒 | 10秒 | 128MB | 128MB | DEBUG | DEBUG |
| Stats | 30秒 | 30秒 | 256MB | 256MB | DEBUG | DEBUG |

### 環境変数の設定

環境設定は `cdk/lib/config/environment-config.ts` で一元管理されています。

```typescript
import { getEnvironmentConfig } from '../config/environment-config';

const envConfig = getEnvironmentConfig(env); // 'dev' or 'prod'

// Lambda関数作成時に使用
new NodejsFunction(this, 'CollectorFunction', {
  timeout: cdk.Duration.seconds(envConfig.collector.timeout),
  memorySize: envConfig.collector.memorySize,
  environment: {
    LOG_LEVEL: envConfig.collector.logLevel,
    ENVIRONMENT: env,
  },
});
```

---

## 各スタックの詳細

### 1. Foundation Stack (基盤層)

**ファイル**: `cdk/lib/stacks/foundation-stack.ts`

**役割**: データベース、ストレージ、シークレット管理などの基盤リソース

**含まれるリソース**:

#### DynamoDBテーブル (3つ)

1. **tdnet_disclosures** - 開示情報メインテーブル
   - PK: `disclosure_id`
   - GSI1: `company_code` + `disclosed_at`
   - GSI2: `date_partition` + `disclosed_at`
   - 暗号化: AWS管理キー
   - PITR: 有効
   - 削除保護: RETAIN


2. **tdnet_executions** - 収集実行履歴テーブル
   - PK: `execution_id`
   - GSI: `status` + `started_at`
   - TTL: 有効 (自動削除)
   - 暗号化: AWS管理キー
   - PITR: 有効

3. **tdnet_export_status** - エクスポート状態管理テーブル
   - PK: `export_id`
   - GSI: `status` + `requested_at`
   - TTL: 有効 (自動削除)
   - 暗号化: AWS管理キー
   - PITR: 有効

#### S3バケット (4つ)

1. **tdnet-data-collector-pdfs-{account-id}** - PDFファイル保存
   - 暗号化: S3管理キー
   - バージョニング: 有効
   - パブリックアクセス: ブロック
   - ライフサイクル:
     - 90日後 → Standard-IA
     - 365日後 → Glacier

2. **tdnet-data-collector-exports-{account-id}** - エクスポートファイル保存
   - 暗号化: S3管理キー
   - バージョニング: 有効
   - ライフサイクル: 7日後に自動削除

3. **tdnet-dashboard-{account-id}** - Webダッシュボード
   - 暗号化: S3管理キー
   - バージョニング: 有効
   - CloudFront経由で配信

4. **tdnet-cloudtrail-logs-{account-id}** - 監査ログ
   - 暗号化: S3管理キー
   - バージョニング: 有効
   - ライフサイクル:
     - 90日後 → Glacier
     - 2555日後 → 削除

#### Secrets Manager

- **シークレット名**: `/tdnet/api-key`
- **用途**: TDnet APIキーの安全な保管
- **ローテーション**: Phase 4で実装予定
- **既存シークレット参照**: `useExistingSecret: true`

#### CloudFront Distribution

- **オリジン**: tdnet-dashboard-{account-id} S3バケット
- **OAI**: Origin Access Identity設定
- **HTTPS**: 強制リダイレクト
- **キャッシュ**: デフォルトポリシー


**CloudFormation Outputs**:
- DisclosuresTableName
- ExecutionsTableName
- ExportStatusTableName
- PdfsBucketName
- ExportsBucketName
- DashboardBucketName
- CloudTrailLogsBucketName
- ApiKeySecretArn

---

### 2. Compute Stack (コンピュート層)

**ファイル**: `cdk/lib/stacks/compute-stack.ts`

**役割**: Lambda関数とDLQの定義

**含まれるリソース**:

#### Lambda関数 (9つ)

1. **tdnet-collector-{env}** - データ収集メイン処理
   - エントリーポイント: `src/lambda/collector/handler.ts`
   - DLQ: 有効
   - 再試行: 2回
   - 権限: DynamoDB R/W, S3 R/W, CloudWatch Metrics

2. **tdnet-query-{env}** - 開示情報検索API
   - エントリーポイント: `src/lambda/query/handler.ts`
   - 権限: DynamoDB Read, S3 Read, CloudWatch Metrics

3. **tdnet-export-{env}** - データエクスポート処理
   - エントリーポイント: `src/lambda/export/handler.ts`
   - 権限: DynamoDB Read, S3 R/W, CloudWatch Metrics

4. **tdnet-collect-{env}** - 収集開始API
   - エントリーポイント: `src/lambda/collect/handler.ts`
   - 権限: Lambda Invoke (Collector), CloudWatch Metrics

5. **tdnet-collect-status-{env}** - 収集状態確認API
   - エントリーポイント: `src/lambda/collect-status/handler.ts`
   - 権限: DynamoDB Read (Executions), CloudWatch Metrics

6. **tdnet-export-status-{env}** - エクスポート状態確認API
   - エントリーポイント: `src/lambda/api/export-status/handler.ts`
   - 権限: DynamoDB Read (ExportStatus), CloudWatch Metrics

7. **tdnet-pdf-download-{env}** - PDF署名付きURL生成API
   - エントリーポイント: `src/lambda/api/pdf-download/handler.ts`
   - 権限: DynamoDB Read, S3 Read, CloudWatch Metrics

8. **tdnet-health-{env}** - ヘルスチェックAPI
   - エントリーポイント: `src/lambda/health/handler.ts`
   - 権限: DynamoDB DescribeTable, S3 HeadBucket, CloudWatch Metrics

9. **tdnet-stats-{env}** - 統計情報API
   - エントリーポイント: `src/lambda/stats/handler.ts`
   - 権限: DynamoDB Read, CloudWatch Metrics


#### DLQ (Dead Letter Queue)

- **キュー名**: `tdnet-collector-dlq-{env}`
- **保持期間**: 14日
- **プロセッサー**: `tdnet-dlq-processor-{env}` Lambda
- **アラーム**: メッセージ数 > 0 で SNS 通知

**Lambda共通設定**:
- Runtime: Node.js 20.x
- Bundling: minify有効, sourceMap有効
- 外部モジュール: `@aws-sdk/*` (Lambda標準搭載)
- 環境変数: `NODE_OPTIONS: --enable-source-maps`

**CloudFormation Outputs**:
- CollectorFunctionArn
- QueryFunctionArn
- ExportFunctionArn
- CollectFunctionArn
- CollectStatusFunctionArn
- ExportStatusFunctionArn
- PdfDownloadFunctionArn
- HealthFunctionArn
- StatsFunctionArn

---

### 3. API Stack (API層)

**ファイル**: `cdk/lib/stacks/api-stack.ts`

**役割**: API Gateway、WAF、APIキー管理

**含まれるリソース**:

#### API Gateway REST API

- **API名**: `tdnet-data-collector-api-{env}`
- **ステージ**: `prod`
- **スロットリング**: 100リクエスト/秒、バースト200
- **ログ**: INFO レベル、データトレース有効
- **CORS**: 全オリジン許可（開発用）

#### エンドポイント一覧

| メソッド | パス | Lambda関数 | APIキー | 説明 |
|---------|------|-----------|---------|------|
| GET | /disclosures | Query | 必要 | 開示情報検索 |
| POST | /exports | Export | 必要 | エクスポート開始 |
| GET | /exports/{export_id} | ExportStatus | 必要 | エクスポート状態確認 |
| POST | /collect | Collect | 必要 | 収集開始 |
| GET | /collect/{execution_id} | CollectStatus | 必要 | 収集状態確認 |
| GET | /disclosures/{disclosure_id}/pdf | PdfDownload | 必要 | PDF署名付きURL取得 |
| GET | /health | Health | 不要 | ヘルスチェック |
| GET | /stats | Stats | 必要 | 統計情報取得 |


#### APIキーと使用量プラン

- **APIキー名**: `tdnet-api-key-{env}`
- **使用量プラン**: `tdnet-usage-plan-{env}`
- **スロットリング**: 100リクエスト/秒、バースト200
- **クォータ**: 10,000リクエスト/月

#### WAF Web ACL

- **Web ACL名**: `tdnet-web-acl-{env}`
- **スコープ**: REGIONAL
- **ルール**:
  1. レート制限: 500リクエスト/5分 (IP単位)
  2. AWS Managed Rules - Common Rule Set
  3. AWS Managed Rules - Known Bad Inputs
- **カスタムレスポンス**: 429 Too Many Requests

**CloudFormation Outputs**:
- ApiEndpoint
- ApiKeyId
- WebAclArn

---

### 4. Monitoring Stack (監視層)

**ファイル**: `cdk/lib/stacks/monitoring-stack.ts`

**役割**: CloudWatch監視、アラーム、CloudTrail

**含まれるリソース**:

#### CloudWatch Log Groups

| Lambda関数 | ログ保持期間 (dev) | ログ保持期間 (prod) |
|-----------|------------------|-------------------|
| Collector | 1週間 | 3ヶ月 |
| その他 | 1週間 | 1ヶ月 |

#### CloudWatch Alarms (7種類)

1. **Lambda Error Rate** (Critical)
   - 閾値: 10%
   - 評価期間: 5分
   - 対象: 全Lambda関数

2. **Lambda Duration Warning**
   - 閾値: 10分 (600秒)
   - 評価期間: 5分×2回
   - 対象: 全Lambda関数

3. **Lambda Duration Critical**
   - 閾値: 13分 (780秒)
   - 評価期間: 5分×1回
   - 対象: 全Lambda関数

4. **Lambda Throttles** (Critical)
   - 閾値: 1回以上
   - 評価期間: 5分
   - 対象: 全Lambda関数


5. **Collection Success Rate** (Warning)
   - 閾値: 95%未満
   - 評価期間: 1時間
   - メトリクス: `TDnet/Collector/CollectionSuccessRate`

6. **No Data Collected** (Critical)
   - 閾値: 1件未満
   - 評価期間: 24時間
   - メトリクス: `TDnet/Collector/DisclosuresCollected`

7. **Collection Failures** (Warning)
   - 閾値: 10件以上
   - 評価期間: 24時間
   - メトリクス: `TDnet/Collector/DisclosuresFailed`

#### CloudWatch Dashboard

- **ダッシュボード名**: `TdnetDataCollector-{env}`
- **ウィジェット**:
  - Lambda関数メトリクス (Invocations, Errors, Duration)
  - DynamoDBメトリクス (Read/Write Capacity, Throttles)
  - S3メトリクス (Bucket Size, Number of Objects)
  - API Gatewayメトリクス (Count, Latency, 4xx/5xx Errors)
  - カスタムメトリクス (Collection Success Rate, Disclosures Collected)

#### CloudTrail

- **証跡名**: `tdnet-audit-trail-{env}`
- **ログ保存先**: `tdnet-cloudtrail-logs-{account-id}`
- **監視対象**:
  - DynamoDB: PutItem, UpdateItem, DeleteItem
  - S3: PutObject, DeleteObject
  - Lambda: Invoke
  - Secrets Manager: GetSecretValue

**CloudFormation Outputs**:
- CloudWatchAlarmsCount
- DashboardName

---

## Constructsリファレンス

### LambdaDLQ Construct

**ファイル**: `cdk/lib/constructs/lambda-dlq.ts`

**用途**: Lambda関数のDLQとプロセッサーを一括作成

**プロパティ**:
```typescript
interface LambdaDLQProps {
  environment: Environment;
  alertTopic: sns.ITopic;
  queueNamePrefix?: string;
}
```

**作成されるリソース**:
- SQS Queue (DLQ)
- Lambda Function (DLQプロセッサー)
- CloudWatch Alarm (DLQメッセージ数)


**使用例**:
```typescript
const dlq = new LambdaDLQ(this, 'LambdaDLQ', {
  environment: 'dev',
  alertTopic: alertTopic,
  queueNamePrefix: 'tdnet',
});

// Lambda関数にDLQを設定
new NodejsFunction(this, 'CollectorFunction', {
  deadLetterQueue: dlq.queue,
  deadLetterQueueEnabled: true,
  retryAttempts: 2,
});
```

---

### SecretsManager Construct

**ファイル**: `cdk/lib/constructs/secrets-manager.ts`

**用途**: APIキーの安全な管理

**プロパティ**:
```typescript
interface SecretsManagerConstructProps {
  environment: string;
  enableRotation?: boolean;
  rotationDays?: number;
  useExistingSecret?: boolean;
}
```

**作成されるリソース**:
- Secrets Manager Secret (`/tdnet/api-key`)
- Lambda Function (ローテーション用、Phase 4実装予定)

**使用例**:
```typescript
const secretsManager = new SecretsManagerConstruct(this, 'SecretsManager', {
  environment: 'dev',
  enableRotation: false,
  useExistingSecret: true, // 既存シークレットを参照
});

// Lambda関数に読み取り権限を付与
secretsManager.grantRead(queryFunction);
```

---

### WAF Construct

**ファイル**: `cdk/lib/constructs/waf.ts`

**用途**: API Gatewayの保護

**プロパティ**:
```typescript
interface WafConstructProps {
  environment: Environment;
  api: apigateway.IRestApi;
  rateLimitPerFiveMinutes?: number;
}
```

**作成されるリソース**:
- WAF Web ACL
- WAF Association (API Gatewayとの関連付け)


**使用例**:
```typescript
const wafConstruct = new WafConstruct(this, 'Waf', {
  environment: 'dev',
  api: api,
  rateLimitPerFiveMinutes: 500, // 100リクエスト/分相当
});
```

---

### CloudWatchAlarms Construct

**ファイル**: `cdk/lib/constructs/cloudwatch-alarms.ts`

**用途**: Lambda関数とシステム全体の監視アラーム設定

**プロパティ**:
```typescript
interface CloudWatchAlarmsProps {
  lambdaFunctions: lambda.IFunction[];
  environment: string;
  existingAlertTopic?: sns.ITopic;
  alertEmail?: string;
  errorRateThreshold?: number;
  durationThreshold?: number;
  collectionSuccessRateThreshold?: number;
  dlqQueue?: sqs.IQueue;
}
```

**作成されるアラーム**:
- Lambda Error Rate (各関数)
- Lambda Duration Warning/Critical (各関数)
- Lambda Throttles (各関数)
- Collection Success Rate
- No Data Collected
- Collection Failures
- DLQ Messages (オプション)

**使用例**:
```typescript
const alarms = new CloudWatchAlarms(this, 'CloudWatchAlarms', {
  lambdaFunctions: [collectorFunction, queryFunction, exportFunction],
  environment: 'dev',
  existingAlertTopic: alertTopic,
  errorRateThreshold: 10,
  durationThreshold: 840,
  collectionSuccessRateThreshold: 95,
});
```

---

### CloudWatchDashboard Construct

**ファイル**: `cdk/lib/constructs/cloudwatch-dashboard.ts`

**用途**: システム全体の可視化ダッシュボード

**プロパティ**:
```typescript
interface CloudWatchDashboardProps {
  environment: Environment;
  lambdaFunctions: {
    collector: lambda.IFunction;
    query: lambda.IFunction;
    export: lambda.IFunction;
    // ...
  };
  dynamodbTables: {
    disclosures: dynamodb.ITable;
    executions: dynamodb.ITable;
    exportStatus: dynamodb.ITable;
  };
  s3Buckets: {
    pdfs: s3.IBucket;
    exports: s3.IBucket;
  };
  apiGateway: apigateway.IRestApi;
}
```


**ダッシュボードウィジェット**:
- Lambda Invocations/Errors/Duration
- DynamoDB Read/Write Capacity
- S3 Bucket Size/Object Count
- API Gateway Request Count/Latency/Errors
- Custom Metrics (Collection Success Rate, Disclosures Collected)

---

### CloudTrail Construct

**ファイル**: `cdk/lib/constructs/cloudtrail.ts`

**用途**: API操作の監査ログ記録

**プロパティ**:
```typescript
interface CloudTrailConstructProps {
  logsBucket: s3.IBucket;
  environment: Environment;
  pdfsBucket: s3.IBucket;
  dynamodbTables: dynamodb.ITable[];
}
```

**監視対象イベント**:
- DynamoDB: PutItem, UpdateItem, DeleteItem
- S3: PutObject, DeleteObject
- Lambda: Invoke
- Secrets Manager: GetSecretValue

---

### その他のConstructs

以下のConstructsも実装されています:

- **CloudFront Construct** (`cloudfront.ts`): ダッシュボード配信
- **CloudWatch Logs Construct** (`cloudwatch-logs.ts`): ログ保持期間管理
- **Lambda Collector Construct** (`lambda-collector.ts`): Collector Lambda専用設定
- **Lambda Query Construct** (`lambda-query.ts`): Query Lambda専用設定
- **Lambda Export Construct** (`lambda-export.ts`): Export Lambda専用設定

---

## デプロイフロー

### 初回デプロイ手順

1. **前提条件確認**
   ```powershell
   # AWS CLI設定確認
   aws sts get-caller-identity
   
   # Node.js/npm確認
   node --version  # v20.x以上
   npm --version   # v10.x以上
   
   # CDK CLI確認
   cdk --version   # v2.x以上
   ```

2. **環境変数設定**
   ```powershell
   # .env.developmentまたは.env.productionを作成
   cp config/.env.production.template config/.env.production
   # {account-id}を実際のAWSアカウントIDに置き換え
   ```

3. **CDK Bootstrap**
   ```powershell
   # 初回のみ実行（リージョンごとに1回）
   cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
   ```


4. **Secrets Manager設定**
   ```powershell
   # APIキーシークレット作成
   .\scripts\create-api-key-secret.ps1
   ```

5. **CDK Synth（テンプレート生成）**
   ```powershell
   # dev環境
   cdk synth --context environment=dev
   
   # prod環境
   cdk synth --context environment=prod
   ```

6. **CDK Diff（変更差分確認）**
   ```powershell
   # dev環境
   cdk diff --context environment=dev --all
   
   # prod環境
   cdk diff --context environment=prod --all
   ```

7. **CDK Deploy（デプロイ実行）**
   ```powershell
   # dev環境（全スタック）
   cdk deploy --context environment=dev --all
   
   # prod環境（全スタック）
   cdk deploy --context environment=prod --all
   ```

### スタック別デプロイ

特定のスタックのみデプロイする場合:

```powershell
# Foundation Stackのみ
cdk deploy TdnetFoundation-dev --context environment=dev

# Compute Stackのみ
cdk deploy TdnetCompute-dev --context environment=dev

# API Stackのみ
cdk deploy TdnetApi-dev --context environment=dev

# Monitoring Stackのみ
cdk deploy TdnetMonitoring-dev --context environment=dev
```

### デプロイ順序

スタック間の依存関係により、以下の順序でデプロイされます:

1. **TdnetFoundation-{env}** (基盤層)
2. **TdnetCompute-{env}** (コンピュート層)
3. **TdnetApi-{env}** (API層)
4. **TdnetMonitoring-{env}** (監視層)

`--all` オプションを使用すると、CDKが自動的に依存関係を解決してデプロイします。

### デプロイ後の確認

```powershell
# スタック一覧確認
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# API Endpoint確認
aws cloudformation describe-stacks --stack-name TdnetApi-dev --query "Stacks[0].Outputs"

# Lambda関数確認
aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'tdnet-')]"
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. CDK Bootstrap未実行エラー

**エラーメッセージ**:
```
This stack uses assets, so the toolkit stack must be deployed to the environment
```

**解決方法**:
```powershell
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-1
```


#### 2. Secrets Manager シークレット未作成エラー

**エラーメッセージ**:
```
Secrets Manager can't find the specified secret: /tdnet/api-key
```

**解決方法**:
```powershell
.\scripts\create-api-key-secret.ps1
```

#### 3. Lambda関数のビルドエラー

**エラーメッセージ**:
```
Failed to bundle asset TdnetComputeStack/CollectorFunction/Code
```

**解決方法**:
```powershell
# node_modulesを削除して再インストール
Remove-Item -Recurse -Force node_modules
npm install

# TypeScriptコンパイル確認
npm run build
```

#### 4. スタック削除時のエラー

**エラーメッセージ**:
```
Resource cannot be deleted: S3 bucket is not empty
```

**解決方法**:
```powershell
# S3バケットを空にする
aws s3 rm s3://tdnet-data-collector-pdfs-ACCOUNT-ID --recursive
aws s3 rm s3://tdnet-data-collector-exports-ACCOUNT-ID --recursive

# スタック削除
cdk destroy --context environment=dev --all
```

#### 5. API Gateway WAF関連付けエラー

**エラーメッセージ**:
```
WAFv2 WebACL association failed
```

**解決方法**:
- API Gatewayのデプロイが完了してからWAFを関連付ける
- API Stackを先にデプロイし、その後Monitoring Stackをデプロイ

#### 6. CloudWatch Alarms作成エラー

**エラーメッセージ**:
```
Invalid metric expression
```

**解決方法**:
- Lambda関数が存在することを確認
- メトリクス名が正しいことを確認
- Compute Stackが正常にデプロイされていることを確認

---

## ベストプラクティス

### 1. 環境分離

- dev環境とprod環境は完全に分離
- 環境ごとに異なるAWSアカウントを使用することを推奨
- 環境変数で設定を切り替え

### 2. コスト管理

- 開発環境は使用しない時間帯にスタックを削除
- CloudWatch Logsの保持期間を適切に設定
- S3ライフサイクルポリシーを活用

### 3. セキュリティ

- Secrets Managerでシークレットを管理
- IAMロールは最小権限の原則に従う
- CloudTrailで監査ログを記録
- WAFでAPI Gatewayを保護


### 4. 監視とアラート

- CloudWatch Alarmsで異常を早期検知
- SNS Topicでアラート通知
- CloudWatch Dashboardで可視化
- DLQで失敗メッセージを追跡

### 5. デプロイ戦略

- 本番環境デプロイ前に必ずdev環境でテスト
- `cdk diff` で変更内容を確認
- スタック別デプロイで影響範囲を限定
- ロールバック手順を事前に確認

---

## 参考資料

### CDK関連ドキュメント

- [AWS CDK公式ドキュメント](https://docs.aws.amazon.com/cdk/)
- [AWS CDK TypeScript API Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
- [CDK Best Practices](https://docs.aws.amazon.com/cdk/latest/guide/best-practices.html)

### プロジェクト内ドキュメント

- **環境構築**: `docs/04-deployment/environment-setup.md`
- **CDK Bootstrap**: `docs/04-deployment/cdk-bootstrap-guide.md`
- **デプロイガイド**: `docs/04-deployment/deployment-guide.md`
- **CI/CD設定**: `docs/04-deployment/ci-cd-setup.md`
- **監視ガイド**: `docs/05-operations/monitoring-guide.md`
- **トラブルシューティング**: `docs/05-operations/troubleshooting.md`

### Steeringファイル

- **デプロイチェックリスト**: `.kiro/steering/infrastructure/deployment-checklist.md`
- **環境変数管理**: `.kiro/steering/infrastructure/environment-variables.md`
- **パフォーマンス最適化**: `.kiro/steering/infrastructure/performance-optimization.md`
- **監視とアラート**: `.kiro/steering/infrastructure/monitoring-alerts.md`
- **セキュリティベストプラクティス**: `.kiro/steering/security/security-best-practices.md`

---

## まとめ

TDnet Data CollectorのCDKインフラストラクチャは、以下の特徴を持っています:

- **4層スタック構成**: 関心の分離と変更頻度による最適化
- **環境パラメータ化**: dev/prod環境の完全分離
- **コスト最適化**: AWS無料枠内での運用を前提
- **セキュリティ**: WAF、Secrets Manager、CloudTrailによる多層防御
- **監視**: CloudWatch Alarms、Dashboard、DLQによる包括的な監視
- **スケーラビリティ**: サーバーレスアーキテクチャによる自動スケーリング

このドキュメントを参考に、安全かつ効率的にインフラストラクチャをデプロイ・運用してください。

---

**最終更新**: 2026年2月15日
**バージョン**: 1.0.0

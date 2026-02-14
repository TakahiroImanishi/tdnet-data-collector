# 作業記録: Lambda関数とCDK構成の整合性チェック

**作業日時**: 2026-02-15 00:08:59  
**作業者**: Subagent B  
**作業概要**: Lambda関数とCDK構成の整合性チェック

## 作業目的

設計書（design.md）とCDKスタック定義、Lambda関数実装の整合性を確認し、不整合を特定する。

## 確認対象ファイル

### 設計書
- `.kiro/specs/tdnet-data-collector/docs/design.md`

### CDKスタック
- `cdk/lib/stacks/foundation-stack.ts` - 基盤リソース（DynamoDB, S3, Secrets Manager）
- `cdk/lib/stacks/compute-stack.ts` - Lambda関数とDLQ
- `cdk/lib/stacks/api-stack.ts` - API Gateway, WAF
- `cdk/lib/stacks/monitoring-stack.ts` - CloudWatch Alarms, Dashboard, CloudTrail
- `cdk/lib/config/environment-config.ts` - 環境設定

### Lambda関数実装
1. `src/lambda/collector/handler.ts` - Collector Lambda
2. `src/lambda/query/handler.ts` - Query Lambda
3. `src/lambda/export/handler.ts` - Export Lambda
4. `src/lambda/collect/handler.ts` - Collect Lambda
5. `src/lambda/collect-status/handler.ts` - Collect Status Lambda
6. `src/lambda/api/export-status/handler.ts` - Export Status Lambda
7. `src/lambda/api/pdf-download/handler.ts` - PDF Download Lambda
8. `src/lambda/health/handler.ts` - Health Lambda
9. `src/lambda/stats/handler.ts` - Stats Lambda

## チェック項目

### 1. Lambda関数リスト

#### 設計書（design.md）記載のLambda関数
設計書のアーキテクチャ図（Mermaid）に記載されている関数：
1. ✅ Lambda: Collector（データ収集、15分, 512MB）
2. ✅ Lambda: Query（データクエリ、30秒, 256MB）
3. ✅ Lambda: Export（データエクスポート、5分, 512MB）
4. ✅ Lambda: Collect（収集トリガー、30秒, 256MB）
5. ✅ Lambda: Collect Status（収集状態取得、30秒, 256MB）
6. ✅ Lambda: Export Status（エクスポート状態取得、30秒, 256MB）
7. ✅ Lambda: PDF Download（PDF署名付きURL生成、30秒, 256MB）
8. ✅ Lambda: Health（ヘルスチェック、30秒, 256MB）
9. ✅ Lambda: Stats（統計情報、30秒, 256MB）

#### CDK実装（compute-stack.ts）
1. ✅ collectorFunction
2. ✅ queryFunction
3. ✅ exportFunction
4. ✅ collectFunction
5. ✅ collectStatusFunction
6. ✅ exportStatusFunction
7. ✅ pdfDownloadFunction
8. ✅ healthFunction
9. ✅ statsFunction

#### Lambda関数実装ファイル
1. ✅ `src/lambda/collector/handler.ts`
2. ✅ `src/lambda/query/handler.ts`
3. ✅ `src/lambda/export/handler.ts`
4. ✅ `src/lambda/collect/handler.ts`
5. ✅ `src/lambda/collect-status/handler.ts`
6. ✅ `src/lambda/api/export-status/handler.ts`
7. ✅ `src/lambda/api/pdf-download/handler.ts`
8. ✅ `src/lambda/health/handler.ts`
9. ✅ `src/lambda/stats/handler.ts`

**結果**: ✅ Lambda関数リストは完全に一致（9個）

### 2. Lambda関数のメモリ・タイムアウト設定

#### 環境設定（environment-config.ts）

**開発環境（dev）:**
| Lambda関数 | メモリ | タイムアウト | 設計書 | 一致 |
|-----------|--------|------------|--------|------|
| Collector | 256MB | 300秒（5分） | 256MB, 5分 | ✅ |
| Query | 128MB | 10秒 | 128MB, 10秒 | ✅ |
| Export | 256MB | 120秒（2分） | 256MB, 2分 | ✅ |
| Collect | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| CollectStatus | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| ExportStatus | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| PdfDownload | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| Health | 128MB | 10秒 | 128MB, 10秒 | ✅ |
| Stats | 256MB | 30秒 | 256MB, 30秒 | ✅ |

**本番環境（prod）:**
| Lambda関数 | メモリ | タイムアウト | 設計書 | 一致 |
|-----------|--------|------------|--------|------|
| Collector | 512MB | 900秒（15分） | 512MB, 15分 | ✅ |
| Query | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| Export | 512MB | 300秒（5分） | 512MB, 5分 | ✅ |
| Collect | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| CollectStatus | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| ExportStatus | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| PdfDownload | 256MB | 30秒 | 256MB, 30秒 | ✅ |
| Health | 128MB | 10秒 | 128MB, 10秒 | ✅ |
| Stats | 256MB | 30秒 | 256MB, 30秒 | ✅ |

**結果**: ✅ メモリ・タイムアウト設定は設計書と完全に一致

### 3. 環境変数設定

#### Collector Lambda
**CDK設定（compute-stack.ts）:**
```typescript
environment: {
  DYNAMODB_TABLE: props.disclosuresTable.tableName,
  DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
  S3_BUCKET: props.pdfsBucket.bucketName,
  TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
  LOG_LEVEL: envConfig.collector.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（collector/handler.ts）:**
- ✅ `DYNAMODB_TABLE` - 使用されている（updateExecutionStatus内）
- ✅ `DYNAMODB_EXECUTIONS_TABLE` - 使用されている（updateExecutionStatus内）
- ✅ `S3_BUCKET` - 使用されている（downloadPdf内）
- ✅ `TDNET_BASE_URL` - 使用されている（scrapeTdnetList内）
- ✅ `LOG_LEVEL` - 使用されている（logger設定）
- ✅ `ENVIRONMENT` - 使用されている（logger設定）

#### Query Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
  S3_BUCKET_NAME: props.pdfsBucket.bucketName,
  API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
  LOG_LEVEL: envConfig.query.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（query/handler.ts）:**
- ✅ `DYNAMODB_TABLE_NAME` - 使用されている（queryDisclosures内）
- ✅ `S3_BUCKET_NAME` - 使用されている（generatePresignedUrl内）
- 🟠 `API_KEY_SECRET_ARN` - CDKで設定されているが、実装では使用されていない（API Gateway認証のみ）

#### Export Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
  EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
  EXPORT_BUCKET_NAME: props.exportsBucket.bucketName,
  API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
  LOG_LEVEL: envConfig.export.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（export/handler.ts）:**
- ✅ `DYNAMODB_TABLE_NAME` - 使用されている（queryDisclosures内）
- ✅ `EXPORT_STATUS_TABLE_NAME` - 使用されている（createExportJob内）
- ✅ `EXPORT_BUCKET_NAME` - 使用されている（exportToS3内）
- 🟠 `API_KEY_SECRET_ARN` - CDKで設定されているが、実装では使用されていない（API Gateway認証のみ）

#### Collect Lambda
**CDK設定:**
```typescript
environment: {
  COLLECTOR_FUNCTION_NAME: this.collectorFunction.functionName,
  API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
  LOG_LEVEL: envConfig.collect.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（collect/handler.ts）:**
- ✅ `COLLECTOR_FUNCTION_NAME` - 使用されている（invokeCollector内）
- 🟠 `API_KEY_SECRET_ARN` - CDKで設定されているが、実装では使用されていない（API Gateway認証のみ）

#### Collect Status Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
  S3_BUCKET: props.pdfsBucket.bucketName,
  LOG_LEVEL: envConfig.collectStatus.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（collect-status/handler.ts）:**
- ✅ `DYNAMODB_EXECUTIONS_TABLE` - 使用されている（getExecutionStatus内）
- 🟡 `S3_BUCKET` - CDKで設定されているが、実装では使用されていない（将来的な拡張用？）

#### Export Status Lambda
**CDK設定:**
```typescript
environment: {
  EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
  API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
  LOG_LEVEL: envConfig.exportStatus.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（api/export-status/handler.ts）:**
- ✅ `EXPORT_STATUS_TABLE_NAME` - 使用されている（getExportStatus内）
- 🟠 `API_KEY_SECRET_ARN` - CDKで設定されているが、実装では使用されていない（API Gateway認証のみ）

#### PDF Download Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
  S3_BUCKET_NAME: props.pdfsBucket.bucketName,
  API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
  LOG_LEVEL: envConfig.pdfDownload.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（api/pdf-download/handler.ts）:**
- ✅ `DYNAMODB_TABLE_NAME` - 使用されている（getDisclosure内）
- ✅ `S3_BUCKET_NAME` - 使用されている（generateSignedUrl内）
- 🟠 `API_KEY_SECRET_ARN` - CDKで設定されているが、実装では使用されていない（API Gateway認証のみ）

#### Health Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
  S3_BUCKET_NAME: props.pdfsBucket.bucketName,
  LOG_LEVEL: envConfig.health.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（health/handler.ts）:**
- ✅ `DYNAMODB_TABLE_NAME` - 使用されている（checkDynamoDB内）
- ✅ `S3_BUCKET_NAME` - 使用されている（checkS3内）

#### Stats Lambda
**CDK設定:**
```typescript
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
  LOG_LEVEL: envConfig.stats.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**実装での使用（stats/handler.ts）:**
- ✅ `DYNAMODB_TABLE_NAME` - 使用されている（getTotalDisclosures, getLast30DaysCount, getTopCompanies内）

**結果**: 
- ✅ 必須環境変数は正しく設定・使用されている
- 🟠 `API_KEY_SECRET_ARN` が5個のLambda関数で設定されているが、実装では使用されていない（API Gateway認証のみ使用）
- 🟡 `S3_BUCKET` がCollect Status Lambdaで設定されているが、実装では使用されていない

### 4. IAMロール設定（最小権限の原則）

#### Collector Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadWriteData` (disclosuresTable, executionsTable)
- ✅ S3: `grantPut`, `grantRead` (pdfsBucket)
- ✅ CloudWatch: `PutMetricData` (TDnet/Collector namespace)

**評価**: ✅ 最小権限の原則に従っている

#### Query Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (disclosuresTable) - 読み取りのみ
- ✅ S3: `grantRead` (pdfsBucket) - 読み取りのみ
- 🟠 Secrets Manager: `grantRead` (apiKeySecret) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/Query namespace)

**評価**: 🟠 Secrets Manager権限が不要（API Gateway認証のみ）

#### Export Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (disclosuresTable), `grantReadWriteData` (exportStatusTable)
- ✅ S3: `grantPut`, `grantRead` (exportsBucket)
- 🟠 Secrets Manager: `grantRead` (apiKeySecret) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/Export namespace)

**評価**: 🟠 Secrets Manager権限が不要（API Gateway認証のみ）

#### Collect Lambda
**CDK設定:**
- ✅ Lambda: `grantInvoke` (collectorFunction)
- 🟠 Secrets Manager: `grantRead` (apiKeySecret) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/Collect namespace)

**評価**: 🟠 Secrets Manager権限が不要（API Gateway認証のみ）

#### Collect Status Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (executionsTable) - 読み取りのみ
- 🟡 S3: `grantRead` (pdfsBucket) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/CollectStatus namespace)

**評価**: 🟡 S3権限が不要（実装で使用されていない）

#### Export Status Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (exportStatusTable) - 読み取りのみ
- 🟠 Secrets Manager: `grantRead` (apiKeySecret) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/ExportStatus namespace)

**評価**: 🟠 Secrets Manager権限が不要（API Gateway認証のみ）

#### PDF Download Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (disclosuresTable) - 読み取りのみ
- ✅ S3: `grantRead` (pdfsBucket) - 読み取りのみ
- 🟠 Secrets Manager: `grantRead` (apiKeySecret) - 使用されていない
- ✅ CloudWatch: `PutMetricData` (TDnet/PdfDownload namespace)

**評価**: 🟠 Secrets Manager権限が不要（API Gateway認証のみ）

#### Health Lambda
**CDK設定:**
- ✅ DynamoDB: `DescribeTable` (disclosuresTable) - 最小権限
- ✅ S3: `HeadBucket` (pdfsBucket) - 最小権限
- ✅ CloudWatch: `PutMetricData` (TDnet/Health namespace)

**評価**: ✅ 最小権限の原則に従っている

#### Stats Lambda
**CDK設定:**
- ✅ DynamoDB: `grantReadData` (disclosuresTable) - 読み取りのみ
- ✅ CloudWatch: `PutMetricData` (TDnet/Stats namespace)

**評価**: ✅ 最小権限の原則に従っている

**結果**: 
- ✅ 基本的に最小権限の原則に従っている
- 🟠 5個のLambda関数でSecrets Manager権限が不要（API Gateway認証のみ使用）
- 🟡 Collect Status LambdaでS3権限が不要（実装で使用されていない）

### 5. DLQ設定

#### CDK設定（compute-stack.ts）
**DLQ Construct:**
```typescript
this.dlq = new LambdaDLQ(this, 'LambdaDLQ', {
  environment: env,
  alertTopic: props.alertTopic,
  queueNamePrefix: 'tdnet',
});
```

**Collector Lambda:**
```typescript
deadLetterQueue: this.dlq.queue,
deadLetterQueueEnabled: true,
retryAttempts: 2,
```

**その他のLambda関数:**
- Query, Export, Collect, CollectStatus, ExportStatus, PdfDownload, Health, Stats: DLQ設定なし

**設計書記載:**
設計書には「DLQ設定（SQS/Lambda）」が必須実装として記載されているが、具体的にどのLambda関数にDLQを設定するかは明記されていない。

**評価**: 
- ✅ Collector LambdaにDLQが設定されている（バッチ処理のため適切）
- 🟡 その他のAPI Lambda関数にはDLQが設定されていない（API Gateway統合のため、DLQは不要かもしれない）

**結果**: 🟡 Collector LambdaのみDLQ設定あり（設計書の意図と一致するか要確認）

### 6. CloudWatch Logs設定

#### CDK設定
**compute-stack.ts:**
- Lambda関数作成時に自動的にCloudWatch Logsロググループが作成される
- ログ保持期間の明示的な設定なし

**設計書記載（design.md）:**
```typescript
const collectorLogGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
    logGroupName: `/aws/lambda/${collectorFn.functionName}`,
    retention: props.environment === 'prod' 
        ? logs.RetentionDays.THREE_MONTHS 
        : logs.RetentionDays.ONE_WEEK,
    removalPolicy: props.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
});
```

**評価**: 🔴 ログ保持期間が設定されていない（設計書と不一致）

**結果**: 🔴 CloudWatch Logsの保持期間設定が実装されていない

## 発見された不整合のリスト

### 🔴 Critical（重大な不整合）

**1. CloudWatch Logsの保持期間設定が実装されていない**
- **ファイル**: `cdk/lib/stacks/compute-stack.ts`
- **問題**: Lambda関数のログ保持期間が設定されていない
- **設計書**: 本番環境3ヶ月、開発環境1週間
- **実装**: 設定なし（デフォルトは無期限）
- **影響**: コスト増加、ログの無期限保存
- **修正提案**: `monitoring-stack.ts`または`compute-stack.ts`でLogGroupを明示的に作成し、保持期間を設定

### 🟠 High（高優先度の不整合）

**2. API_KEY_SECRET_ARN環境変数が5個のLambda関数で不要**
- **ファイル**: `cdk/lib/stacks/compute-stack.ts`
- **問題**: Query, Export, Collect, ExportStatus, PdfDownload LambdaでAPI_KEY_SECRET_ARNが設定されているが、実装では使用されていない
- **理由**: 2026-02-14にLambda関数でのSecrets Manager APIキー検証を削除（API Gateway認証のみ使用）
- **影響**: 
  - 不要な環境変数設定
  - 不要なSecrets Manager権限付与（セキュリティリスク）
  - コスト増加（Secrets Manager API呼び出しは削減済みだが、権限は残存）
- **修正提案**: 
  1. CDKから`API_KEY_SECRET_ARN`環境変数を削除
  2. `grantRead(apiKeySecret)`権限を削除

**3. Secrets Manager権限が5個のLambda関数で不要**
- **ファイル**: `cdk/lib/stacks/compute-stack.ts`
- **問題**: Query, Export, Collect, ExportStatus, PdfDownload LambdaにSecrets Manager読み取り権限が付与されているが、実装では使用されていない
- **理由**: 2026-02-14にLambda関数でのSecrets Manager APIキー検証を削除
- **影響**: 最小権限の原則に違反、セキュリティリスク
- **修正提案**: `props.apiKeySecret.grantRead()`を削除

### 🟡 Medium（中優先度の不整合）

**4. Collect Status LambdaでS3_BUCKET環境変数が不要**
- **ファイル**: `cdk/lib/stacks/compute-stack.ts`
- **問題**: Collect Status LambdaでS3_BUCKET環境変数が設定されているが、実装では使用されていない
- **影響**: 不要な環境変数設定、不要なS3権限付与
- **修正提案**: 
  1. CDKから`S3_BUCKET`環境変数を削除
  2. `grantRead(pdfsBucket)`権限を削除

**5. DLQ設定がCollector Lambdaのみ**
- **ファイル**: `cdk/lib/stacks/compute-stack.ts`
- **問題**: Collector LambdaのみDLQが設定されている
- **設計書**: 「DLQ設定（SQS/Lambda）」が必須実装として記載
- **評価**: API Lambda関数はAPI Gateway統合のため、DLQは不要かもしれない（要確認）
- **修正提案**: 設計書の意図を明確化し、必要に応じて他のLambda関数にもDLQを設定

### 🟢 Low（低優先度の不整合）

なし

## 修正提案の詳細

### 修正1: CloudWatch Logsの保持期間設定

**ファイル**: `cdk/lib/stacks/monitoring-stack.ts`または`cdk/lib/stacks/compute-stack.ts`

**修正内容**:
```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

// 各Lambda関数のログ保持期間を設定
const collectorLogGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
  logGroupName: `/aws/lambda/${props.lambdaFunctions.collector.functionName}`,
  retention: props.environment === 'prod' 
    ? logs.RetentionDays.THREE_MONTHS 
    : logs.RetentionDays.ONE_WEEK,
  removalPolicy: props.environment === 'prod'
    ? cdk.RemovalPolicy.RETAIN
    : cdk.RemovalPolicy.DESTROY,
});

const queryLogGroup = new logs.LogGroup(this, 'QueryLogGroup', {
  logGroupName: `/aws/lambda/${props.lambdaFunctions.query.functionName}`,
  retention: props.environment === 'prod' 
    ? logs.RetentionDays.ONE_MONTH 
    : logs.RetentionDays.ONE_WEEK,
  removalPolicy: props.environment === 'prod'
    ? cdk.RemovalPolicy.RETAIN
    : cdk.RemovalPolicy.DESTROY,
});

// 他のLambda関数も同様に設定
```

### 修正2: API_KEY_SECRET_ARN環境変数の削除

**ファイル**: `cdk/lib/stacks/compute-stack.ts`

**修正内容**:
```typescript
// Query Lambda
this.queryFunction = new NodejsFunction(this, 'QueryFunction', {
  // ...
  environment: {
    DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
    S3_BUCKET_NAME: props.pdfsBucket.bucketName,
    // API_KEY_SECRET_ARN: props.apiKeySecret.secretArn, // 削除
    LOG_LEVEL: envConfig.query.logLevel,
    ENVIRONMENT: env,
    NODE_OPTIONS: '--enable-source-maps',
  },
  // ...
});

props.disclosuresTable.grantReadData(this.queryFunction);
props.pdfsBucket.grantRead(this.queryFunction);
// props.apiKeySecret.grantRead(this.queryFunction); // 削除

// Export, Collect, ExportStatus, PdfDownload Lambdaも同様に修正
```

### 修正3: Collect Status LambdaのS3_BUCKET環境変数の削除

**ファイル**: `cdk/lib/stacks/compute-stack.ts`

**修正内容**:
```typescript
this.collectStatusFunction = new NodejsFunction(this, 'CollectStatusFunction', {
  // ...
  environment: {
    DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
    // S3_BUCKET: props.pdfsBucket.bucketName, // 削除
    LOG_LEVEL: envConfig.collectStatus.logLevel,
    ENVIRONMENT: env,
    NODE_OPTIONS: '--enable-source-maps',
  },
  // ...
});

props.executionsTable.grantReadData(this.collectStatusFunction);
// props.pdfsBucket.grantRead(this.collectStatusFunction); // 削除
```

## 申し送り事項

1. **CloudWatch Logsの保持期間設定**: 最優先で実装すべき（コスト削減）
2. **Secrets Manager関連の削除**: セキュリティリスク軽減のため早急に実施
3. **DLQ設定の方針確認**: 設計書の意図を明確化し、必要に応じて他のLambda関数にもDLQを設定
4. **環境変数の整理**: 不要な環境変数と権限を削除し、最小権限の原則を徹底

## 成果物

- ✅ Lambda関数とCDK構成の整合性チェック完了
- ✅ 不整合のリスト作成（優先度付き）
- ✅ 修正提案の詳細作成

## 次のステップ

1. メインエージェントに報告
2. 修正提案の承認
3. CDKスタックの修正実装
4. デプロイとテスト

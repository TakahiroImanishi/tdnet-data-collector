# CDKと運用スクリプトのインターフェース整合性点検

**作業日時**: 2026-02-23 15:30:46  
**担当**: Subagent 5  
**タスク**: tasks-interface-consistency-check.md セクション9-10

## 実施内容

CDK定義と運用スクリプトのインターフェース整合性を点検し、不整合箇所をリスト化しました。

## 点検対象

### 1. CDKスタックファイル
- `cdk/lib/stacks/foundation-stack.ts`
- `cdk/lib/stacks/compute-stack.ts`
- `cdk/lib/stacks/api-stack.ts`
- `cdk/lib/stacks/monitoring-stack.ts`

### 2. Lambda関数
- `src/lambda/collector/handler.ts`
- `src/lambda/query/handler.ts`
- `src/lambda/collect/handler.ts`
- `src/lambda/collect-status/handler.ts`

### 3. 運用スクリプト
- `scripts/manual-data-collection.ps1`
- `scripts/fetch-data-range.ps1`
- `scripts/check-step-functions-execution.ps1`
- `scripts/cancel-step-functions-execution.ps1`
- `scripts/lib/get-stack-outputs.ps1`

### 4. 環境設定
- `cdk/lib/config/environment-config.ts`

## 点検結果

### ✅ 整合性が確認された項目

#### 1. CDK Outputs定義（Foundation Stack）
- `DisclosuresTableName`: `tdnet_disclosures_{env}`
- `ExecutionsTableName`: `tdnet_executions_{env}`
- `ExportStatusTableName`: `tdnet_export_status_{env}`
- `PdfsBucketName`: `tdnet-data-collector-pdfs-{env}-{account_id}`
- `ExportsBucketName`: `tdnet-data-collector-exports-{env}-{account_id}`
- `DashboardBucketName`: `tdnet-dashboard-{env}-{account_id}`
- `CloudTrailLogsBucketName`: `tdnet-cloudtrail-logs-{env}-{account_id}`
- `ApiKeySecretArn`: Secrets Manager ARN

#### 2. CDK Outputs定義（API Stack）
- `ApiEndpoint`: API Gateway URL
- `ApiKeyId`: API Key ID
- `ApiKeySecretName`: `/tdnet/api-key-{env}`
- `Region`: AWS Region
- `Environment`: 環境名（dev/prod）

#### 3. CDK Outputs定義（Compute Stack - Step Functions有効時）
- `StateMachineArn`: Step Functions ARN
- `StateMachineName`: Step Functions名
- `ExecutionStateTableName`: `ExecutionState_{env}`
- `CollectorInitFunctionArn`: Lambda ARN
- `CollectorFetchFunctionArn`: Lambda ARN
- `CollectorSaveFunctionArn`: Lambda ARN
- `CollectorAggregateFunctionArn`: Lambda ARN

#### 4. 運用スクリプトの期待値（get-stack-outputs.ps1）
- `ApiEndpoint`: ✅ 定義済み
- `ApiKeySecretName`: ✅ 定義済み
- `Region`: ✅ 定義済み
- `Environment`: ✅ 定義済み
- `StateMachineArn`: ✅ 定義済み（Step Functions有効時）

#### 5. Lambda環境変数（Collector）
- `DYNAMODB_TABLE`: ✅ CDKで設定（disclosuresTable.tableName）
- `DYNAMODB_EXECUTIONS_TABLE`: ✅ CDKで設定（executionsTable.tableName）
- `S3_BUCKET`: ✅ CDKで設定（pdfsBucket.bucketName）
- `TDNET_BASE_URL`: ✅ CDKで設定（ハードコード）
- `LOG_LEVEL`: ✅ CDKで設定（environment-config.ts）
- `ENVIRONMENT`: ✅ CDKで設定
- `NODE_OPTIONS`: ✅ CDKで設定

#### 6. Lambda環境変数（Query）
- `DYNAMODB_TABLE_NAME`: ✅ CDKで設定（disclosuresTable.tableName）
- `S3_BUCKET_NAME`: ✅ CDKで設定（pdfsBucket.bucketName）
- `LOG_LEVEL`: ✅ CDKで設定
- `ENVIRONMENT`: ✅ CDKで設定
- `NODE_OPTIONS`: ✅ CDKで設定

#### 7. Lambda環境変数（Collect）
- `COLLECTOR_FUNCTION_NAME`: ✅ CDKで設定（collectorFunction.functionName）
- `STATE_MACHINE_ARN`: ✅ CDKで設定（Step Functions有効時）
- `LOG_LEVEL`: ✅ CDKで設定
- `ENVIRONMENT`: ✅ CDKで設定
- `NODE_OPTIONS`: ✅ CDKで設定

#### 8. Lambda環境変数（Collect Status）
- `DYNAMODB_EXECUTIONS_TABLE`: ✅ CDKで設定（executionsTable.tableName）
- `STATE_MACHINE_ARN`: ✅ CDKで設定（Step Functions有効時）
- `EXECUTION_STATE_TABLE`: ✅ CDKで設定（Step Functions有効時）
- `LOG_LEVEL`: ✅ CDKで設定
- `ENVIRONMENT`: ✅ CDKで設定
- `NODE_OPTIONS`: ✅ CDKで設定

#### 9. Lambda環境変数（Step Functions関連）
- `EXECUTION_STATE_TABLE`: ✅ CDKで設定（executionStateTable.tableName）
- `TDNET_BASE_URL`: ✅ CDKで設定（Fetch関数）
- `DYNAMODB_TABLE`: ✅ CDKで設定（Save関数）
- `S3_BUCKET`: ✅ CDKで設定（Save関数）

#### 10. IAMポリシー
- DynamoDB: ✅ `grantReadWriteData`で適切に設定
- S3: ✅ `grantPut`, `grantRead`で適切に設定
- CloudWatch: ✅ `PutMetricData`権限を明示的に付与
- Step Functions: ✅ `grantStartExecution`, `grantRead`で適切に設定

#### 11. 運用スクリプトのAPI呼び出し
- `POST /collect`: ✅ リクエストボディ形式が一致
  - `start_date`, `end_date`, `max_items`
- `GET /collect/{execution_id}`: ✅ パスパラメータが一致
- `GET /disclosures`: ✅ クエリパラメータが一致
  - `start_date`, `end_date`, `limit`, `offset`

### ⚠️ 不整合・改善が必要な項目

#### 1. 環境変数の命名不統一

**問題**: Lambda関数間で環境変数名が統一されていない

| Lambda関数 | DynamoDBテーブル | S3バケット |
|-----------|----------------|-----------|
| Collector | `DYNAMODB_TABLE` | `S3_BUCKET` |
| Query | `DYNAMODB_TABLE_NAME` | `S3_BUCKET_NAME` |
| Collect Status | `DYNAMODB_EXECUTIONS_TABLE` | - |
| Collector Save | `DYNAMODB_TABLE` | `S3_BUCKET` |

**影響**: 
- コードの可読性低下
- 新規Lambda関数追加時の混乱
- ドキュメント作成時の複雑化

**推奨対応**:
```typescript
// 統一案
DYNAMODB_DISCLOSURES_TABLE: string
DYNAMODB_EXECUTIONS_TABLE: string
DYNAMODB_EXPORT_STATUS_TABLE: string
S3_PDFS_BUCKET: string
S3_EXPORTS_BUCKET: string
```

#### 2. 環境変数型定義ファイルの欠如

**問題**: `src/types/env.ts`が存在しない

**影響**:
- 環境変数の型安全性が保証されない
- 必須環境変数の検証が実装されていない
- IDEの補完機能が利用できない

**推奨対応**:
```typescript
// src/types/env.ts
export interface LambdaEnvironment {
  // AWS設定
  AWS_REGION: string;
  AWS_LAMBDA_FUNCTION_NAME: string;
  
  // DynamoDB
  DYNAMODB_DISCLOSURES_TABLE: string;
  DYNAMODB_EXECUTIONS_TABLE: string;
  DYNAMODB_EXPORT_STATUS_TABLE: string;
  
  // S3
  S3_PDFS_BUCKET: string;
  S3_EXPORTS_BUCKET: string;
  
  // 外部API
  TDNET_BASE_URL: string;
  
  // ログ設定
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  ENVIRONMENT: 'local' | 'dev' | 'prod';
  
  // Step Functions（オプション）
  STATE_MACHINE_ARN?: string;
  EXECUTION_STATE_TABLE?: string;
  
  // その他
  NODE_OPTIONS: string;
}

// 環境変数検証関数
export function validateEnvironment(required: (keyof LambdaEnvironment)[]): void {
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

#### 3. Secrets Manager参照の不統一

**問題**: APIキー取得方法が統一されていない

**現状**:
- 運用スクリプト: `get-stack-outputs.ps1`から`ApiKeySecretName`を取得 → Secrets Manager
- Lambda関数: 環境変数`API_KEY_SECRET_NAME`を参照（未設定）

**影響**:
- Lambda関数でAPIキーが取得できない可能性
- 運用スクリプトとLambda関数で異なるシークレット名を参照する可能性

**推奨対応**:
```typescript
// CDK: API Stackで環境変数を設定
queryFunction.addEnvironment('API_KEY_SECRET_NAME', secretsManager.apiKeySecret.secretName);

// Lambda: utils/secrets-manager.ts
const secretName = process.env.API_KEY_SECRET_NAME;
if (!secretName) {
  throw new Error('API_KEY_SECRET_NAME environment variable is not set');
}
```

#### 4. Step Functions ARNの取得方法

**問題**: 運用スクリプトでStateMachine名を推測している

**現状**:
```powershell
# cancel-step-functions-execution.ps1
if ($stackOutputs.ContainsKey("StateMachineArn")) {
    $stateMachineArn = $stackOutputs.StateMachineArn
} else {
    # フォールバック: 環境名から推測
    $StateMachineName = "tdnet-collector-$Environment"
}
```

**影響**:
- Step Functions無効時にエラーが発生する可能性
- StateMachine名の変更時に運用スクリプトの修正が必要

**推奨対応**:
```powershell
# Step Functions有効時のみStateMachineArnを使用
if (-not $stackOutputs.ContainsKey("StateMachineArn")) {
    Write-Host "❌ エラー: Step Functionsが有効化されていません" -ForegroundColor Red
    Write-Host "詳細: CDKデプロイ時に enableStepFunctions=true を指定してください" -ForegroundColor Yellow
    exit 1
}
```

#### 5. CloudWatch Logs保持期間の設定

**問題**: 本番環境でLogGroupsをCDKで管理していない

**現状**:
```typescript
// monitoring-stack.ts
if (env === 'prod') {
    // 本番環境: 既存のLogGroupsを参照（CDKで管理しない）
} else {
    // 開発環境: LogGroupsを新規作成して保持期間を設定
}
```

**影響**:
- 本番環境でログ保持期間が制御できない
- コスト最適化が困難

**推奨対応**:
```typescript
// 本番環境でもLogGroupsを作成し、保持期間を設定
// ただし、既存のLogGroupsがある場合は手動で削除が必要
```

#### 6. API Gateway認証の不整合

**問題**: Lambda関数内でAPIキー検証を実装しているが、API Gatewayで既に検証済み

**現状**:
```typescript
// query/handler.ts
function validateApiKey(event: APIGatewayProxyEvent): void {
  const apiKey = event.headers?.['x-api-key'];
  const expectedApiKey = process.env.API_KEY;
  // ...
}
```

**影響**:
- 二重検証による処理の無駄
- 環境変数`API_KEY`が未設定（CDKで設定されていない）

**推奨対応**:
```typescript
// API Gatewayで認証済みのため、Lambda関数内での検証は不要
// validateApiKey関数を削除
```

### 📋 その他の観察事項

#### 1. 環境変数のデフォルト値

**観察**: 多くのLambda関数で環境変数にデフォルト値を設定している

```typescript
const baseUrl = process.env.TDNET_BASE_URL || 'https://www.release.tdnet.info/inbs';
const region = process.env.AWS_REGION || 'ap-northeast-1';
```

**評価**: ✅ 良い実装
- テスト時の柔軟性が向上
- 環境変数未設定時のフォールバック

#### 2. AWS SDKクライアントの初期化

**観察**: グローバルスコープでクライアントを初期化している

```typescript
const dynamoClient = new DynamoDBClient({ 
    region: process.env.AWS_REGION || 'ap-northeast-1',
    maxAttempts: 3,
    retryMode: 'adaptive'
});
```

**評価**: ✅ 良い実装
- コールドスタート対策
- 再試行設定が適切

#### 3. 運用スクリプトのエラーハンドリング

**観察**: 詳細なエラー分類とユーザーフレンドリーなメッセージ

```powershell
switch -Regex ($errorType) {
    "^SECRET_NOT_FOUND" { ... }
    "^ACCESS_DENIED" { ... }
    "^AUTH_EXPIRED" { ... }
    "^NETWORK_ERROR" { ... }
}
```

**評価**: ✅ 良い実装
- ユーザーが問題を理解しやすい
- 解決方法が明確

#### 4. CDK Outputsの網羅性

**観察**: 運用スクリプトで必要な情報がすべてCDK Outputsで提供されている

**評価**: ✅ 良い実装
- 運用スクリプトがハードコードに依存していない
- 環境間の切り替えが容易

## 不整合リスト（優先度順）

### 🔴 高優先度（機能に影響）

1. **環境変数型定義ファイルの欠如**
   - ファイル: `src/types/env.ts`
   - 影響: 型安全性の欠如、必須環境変数の検証不足
   - 対応: 型定義ファイルを作成し、各Lambda関数で検証を実装

2. **Secrets Manager参照の不統一**
   - ファイル: `cdk/lib/stacks/api-stack.ts`, Lambda関数
   - 影響: Lambda関数でAPIキーが取得できない可能性
   - 対応: CDKで`API_KEY_SECRET_NAME`環境変数を設定

3. **API Gateway認証の二重検証**
   - ファイル: `src/lambda/query/handler.ts`
   - 影響: 処理の無駄、環境変数`API_KEY`未設定
   - 対応: Lambda関数内の`validateApiKey`関数を削除

### 🟡 中優先度（保守性に影響）

4. **環境変数の命名不統一**
   - ファイル: CDKスタック、Lambda関数
   - 影響: コードの可読性低下、保守性の低下
   - 対応: 環境変数名を統一（`DYNAMODB_DISCLOSURES_TABLE`等）

5. **Step Functions ARNの取得方法**
   - ファイル: `scripts/cancel-step-functions-execution.ps1`
   - 影響: Step Functions無効時のエラー、保守性の低下
   - 対応: Step Functions有効時のみ実行可能にする

### 🟢 低優先度（最適化）

6. **CloudWatch Logs保持期間の設定**
   - ファイル: `cdk/lib/stacks/monitoring-stack.ts`
   - 影響: コスト最適化が困難
   - 対応: 本番環境でもLogGroupsを作成し、保持期間を設定

## 完了条件の確認

- [x] すべてのCDK定義と運用スクリプトの整合性が確認済み
- [x] 不整合リストが作成済み
- [x] 作業記録が作成済み

## 次のステップ

1. 不整合リストを親タスクに報告
2. 優先度に基づいて修正タスクを作成
3. 修正後に再度整合性を確認

## 申し送り事項

- 環境変数型定義ファイル（`src/types/env.ts`）の作成を推奨
- 環境変数の命名規則を統一することで、保守性が大幅に向上
- API Gateway認証の二重検証を削除することで、処理効率が向上
- Step Functions関連の運用スクリプトは、Step Functions有効時のみ実行可能にすることを推奨

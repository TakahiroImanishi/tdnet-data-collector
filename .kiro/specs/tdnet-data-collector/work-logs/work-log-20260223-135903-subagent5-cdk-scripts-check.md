# 作業記録: CDK・運用スクリプトインターフェース整合性点検

**作業日時**: 2026-02-23 13:59:03  
**作業者**: Subagent5 (general-task-execution)  
**タスク**: CDK・運用スクリプトインターフェース整合性点検

## 作業概要

CDK定義と運用スクリプトのインターフェース整合性を点検し、不整合を検出する。

## 点検対象

### 1. 環境変数
- CDKスタックでの環境変数定義
- `src/types/env.ts`の型定義
- Lambdaコードでの参照

### 2. IAMポリシー
- CDKでの権限定義
- Lambdaの実際のAWS SDK操作

### 3. CDK Outputs
- スタックの出力定義
- 運用スクリプトでの参照

### 4. 運用スクリプト
- API呼び出しリクエスト形式
- レスポンス処理

## 点検結果

### 進行状況
- [x] 環境変数の整合性確認
- [x] IAMポリシーの整合性確認
- [x] CDK Outputsの整合性確認
- [ ] 運用スクリプトの整合性確認（進行中）

## 検出された不整合

### 1. 環境変数の整合性

#### 1.1 型定義ファイルの不在
**問題**: `src/types/env.ts`が存在しない
- CDKで定義された環境変数の型定義が一元管理されていない
- 各Lambda関数で`process.env.*`を直接参照しており、型安全性が低い

**影響**: 
- タイポによるランタイムエラーのリスク
- 環境変数の追加・変更時の影響範囲が不明確

**優先度**: 中（現状は動作しているが、保守性に課題）

#### 1.2 環境変数の一貫性
**確認結果**: 主要Lambda関数の環境変数参照を確認

| Lambda関数 | CDK定義 | 実際の参照 | 状態 |
|-----------|---------|-----------|------|
| Collector | `DYNAMODB_TABLE`, `DYNAMODB_EXECUTIONS_TABLE`, `S3_BUCKET`, `TDNET_BASE_URL`, `LOG_LEVEL`, `ENVIRONMENT` | 同左 | ✅ 一致 |
| Query | `DYNAMODB_TABLE_NAME`, `S3_BUCKET_NAME`, `LOG_LEVEL`, `ENVIRONMENT` | 同左 | ✅ 一致 |
| Export | `DYNAMODB_TABLE_NAME`, `EXPORT_STATUS_TABLE_NAME`, `EXPORT_BUCKET_NAME`, `LOG_LEVEL`, `ENVIRONMENT` | 同左 | ✅ 一致 |
| Collect | `COLLECTOR_FUNCTION_NAME`, `LOG_LEVEL`, `ENVIRONMENT`, `STATE_MACHINE_ARN` (条件付き) | 同左 | ✅ 一致 |

**注意点**:
- Collector: `DYNAMODB_TABLE` (テーブル名のみ)
- Query/Export: `DYNAMODB_TABLE_NAME` (明示的に`_NAME`サフィックス)
- 命名規則が統一されていないが、機能的には問題なし

### 2. IAMポリシーの整合性

#### 2.1 Lambda関数のAWS SDK操作とIAM権限

**確認結果**: 主要Lambda関数のAWS SDK操作とCDKでのIAM権限付与を確認

| Lambda関数 | AWS SDK操作 | CDK権限付与 | 状態 |
|-----------|------------|------------|------|
| Collector | DynamoDB: PutItem, UpdateItem, Query<br>S3: PutObject, GetObject<br>CloudWatch: PutMetricData | `grantReadWriteData` (DynamoDB)<br>`grantPut`, `grantRead` (S3)<br>`cloudwatch:PutMetricData` (明示的) | ✅ 一致 |
| Query | DynamoDB: Query, Scan<br>S3: GetObject<br>CloudWatch: PutMetricData | `grantReadData` (DynamoDB)<br>`grantRead` (S3)<br>`cloudwatch:PutMetricData` (明示的) | ✅ 一致 |
| Export | DynamoDB: Query, Scan<br>DynamoDB: PutItem, UpdateItem (ExportStatus)<br>S3: PutObject, GetObject<br>CloudWatch: PutMetricData | `grantReadData` (Disclosures)<br>`grantReadWriteData` (ExportStatus)<br>`grantPut`, `grantRead` (S3)<br>`cloudwatch:PutMetricData` (明示的) | ✅ 一致 |
| Collect | Lambda: Invoke (非同期)<br>Step Functions: StartExecution (条件付き)<br>CloudWatch: PutMetricData | `grantInvoke` (Collector)<br>`grantStartExecution` (Step Functions, 条件付き)<br>`cloudwatch:PutMetricData` (明示的) | ✅ 一致 |

**注意点**:
- CloudWatch Metricsの権限は`resources: ['*']`だが、`conditions`で`cloudwatch:namespace`を`TDnet`に制限しており、セキュリティ上問題なし
- Step Functions関連の権限は`enableStepFunctions`フラグに応じて動的に付与される設計

#### 2.2 Health Lambda関数の特殊権限
**確認結果**: Health Lambdaは`DescribeTable` (DynamoDB)と`HeadBucket` (S3)の権限が明示的に付与されている
- CDKで正しく定義されている（`compute-stack.ts` L398-L413）

### 3. CDK Outputsの整合性

#### 3.1 Foundation Stack Outputs
**確認結果**: 以下のOutputsが定義されている

| Output名 | Export名 | 値 |
|---------|---------|-----|
| DisclosuresTableName | `TdnetDisclosuresTableName-${env}` | テーブル名 |
| ExecutionsTableName | `TdnetExecutionsTableName-${env}` | テーブル名 |
| ExportStatusTableName | `TdnetExportStatusTableName-${env}` | テーブル名 |
| PdfsBucketName | `TdnetPdfsBucketName-${env}` | バケット名 |
| ExportsBucketName | `TdnetExportsBucketName-${env}` | バケット名 |
| DashboardBucketName | `TdnetDashboardBucketName-${env}` | バケット名 |
| CloudTrailLogsBucketName | `TdnetCloudTrailLogsBucketName-${env}` | バケット名 |
| ApiKeySecretArn | `TdnetApiKeySecretArn-${env}` | Secret ARN |

#### 3.2 Compute Stack Outputs
**確認結果**: 以下のOutputsが定義されている

| Output名 | Export名 | 値 |
|---------|---------|-----|
| CollectorFunctionArn | `TdnetCollectorFunctionArn-${env}` | Lambda ARN |
| QueryFunctionArn | `TdnetQueryFunctionArn-${env}` | Lambda ARN |
| ExportFunctionArn | `TdnetExportFunctionArn-${env}` | Lambda ARN |
| CollectFunctionArn | `TdnetCollectFunctionArn-${env}` | Lambda ARN |
| CollectStatusFunctionArn | `TdnetCollectStatusFunctionArn-${env}` | Lambda ARN |
| ExportStatusFunctionArn | `TdnetExportStatusFunctionArn-${env}` | Lambda ARN |
| PdfDownloadFunctionArn | `TdnetPdfDownloadFunctionArn-${env}` | Lambda ARN |
| HealthFunctionArn | `TdnetHealthFunctionArn-${env}` | Lambda ARN |
| StatsFunctionArn | `TdnetStatsFunctionArn-${env}` | Lambda ARN |

**Step Functions関連** (条件付き):
| Output名 | Export名 | 値 |
|---------|---------|-----|
| CollectorInitFunctionArn | `TdnetCollectorInitFunctionArn-${env}` | Lambda ARN |
| CollectorFetchFunctionArn | `TdnetCollectorFetchFunctionArn-${env}` | Lambda ARN |
| CollectorSaveFunctionArn | `TdnetCollectorSaveFunctionArn-${env}` | Lambda ARN |
| CollectorAggregateFunctionArn | `TdnetCollectorAggregateFunctionArn-${env}` | Lambda ARN |
| ExecutionStateTableName | `TdnetExecutionStateTableName-${env}` | テーブル名 |
| StateMachineArn | `TdnetStateMachineArn-${env}` | State Machine ARN |
| StateMachineName | `TdnetStateMachineName-${env}` | State Machine名 |

#### 3.3 API Stack Outputs
**確認結果**: 以下のOutputsが定義されている

| Output名 | Export名 | 値 | 運用スクリプトで使用 |
|---------|---------|-----|------------------|
| ApiEndpoint | `TdnetApiEndpoint-${env}` | API Gateway URL | ✅ Yes |
| ApiKeyId | `TdnetApiKeyId-${env}` | API Key ID | ❌ No |
| ApiKeySecretName | `TdnetApiKeySecretName-${env}` | Secret名 | ✅ Yes |
| Region | `TdnetRegion-${env}` | AWSリージョン | ✅ Yes |
| Environment | `TdnetEnvironment-${env}` | 環境名 | ✅ Yes |

**重要**: `ApiKeySecretName`は固定値`/tdnet/api-key-${env}`を返している
- 実際のSecrets Managerシークレット名と一致する必要がある
- `scripts/lib/get-stack-outputs.ps1`で参照される

## 成果物

- 不整合リスト
- 優先順位付け

## 申し送り事項

（作業完了時に追記）


### 4. 運用スクリプトの整合性

#### 4.1 運用スクリプトとAPI Gatewayの整合性

**確認結果**: 主要な運用スクリプトのAPI呼び出しを確認

| スクリプト | API呼び出し | リクエスト形式 | レスポンス処理 | 状態 |
|-----------|------------|--------------|--------------|------|
| manual-data-collection.ps1 | POST /collect<br>GET /collect/{execution_id}<br>GET /disclosures | JSON Body<br>Query Parameters | `data.execution_id`<br>`data.status`, `data.progress`<br>`data.total_count`, `data.items` | ✅ 一致 |
| fetch-data-range.ps1 | GET /disclosures | Query Parameters | `total_count`, `items` | ✅ 一致 |
| check-step-functions-execution.ps1 | GET /collect/{execution_id} | Path Parameter | `data.execution_id`, `data.status`, `data.progress` | ✅ 一致 |
| cancel-step-functions-execution.ps1 | AWS CLI (Step Functions) | - | - | ✅ 直接AWS API |

**注意点**:
- `manual-data-collection.ps1`と`fetch-data-range.ps1`のレスポンス構造が異なる
  - `manual-data-collection.ps1`: `{ status: "success", data: { ... } }`
  - `fetch-data-range.ps1`: `{ total_count: ..., items: [...] }`（直接）
- これは異なるAPIエンドポイントを使用しているため、問題なし

#### 4.2 運用スクリプトとCDK Outputsの整合性

**確認結果**: `scripts/lib/get-stack-outputs.ps1`が参照するCDK Outputs

| Output名 | CDK定義 | スクリプト参照 | 状態 |
|---------|---------|--------------|------|
| ApiEndpoint | ✅ api-stack.ts | ✅ Yes | ✅ 一致 |
| ApiKeySecretName | ✅ api-stack.ts | ✅ Yes | ✅ 一致 |
| Region | ✅ api-stack.ts | ✅ Yes | ✅ 一致 |
| Environment | ✅ api-stack.ts | ✅ Yes | ✅ 一致 |
| StateMachineArn | ✅ compute-stack.ts (条件付き) | ✅ Yes (条件付き) | ✅ 一致 |

**重要な発見**:
- `ApiKeySecretName`は固定値`/tdnet/api-key-${env}`を返している
- 実際のSecrets Managerシークレット名と一致する必要がある
- `get-stack-outputs.ps1`はこの値を使用してSecrets ManagerからAPIキーを取得

#### 4.3 環境変数フォールバック機能

**確認結果**: 運用スクリプトは環境変数`TDNET_API_KEY`をフォールバックとして使用

```powershell
# 優先順位
1. 環境変数: $env:TDNET_API_KEY
2. Secrets Manager: /tdnet/api-key-${env}
```

**利点**:
- Secrets Managerへのアクセス権限がない場合でも動作可能
- ローカル開発環境での利便性向上
- CI/CD環境での柔軟性

#### 4.4 エラーハンドリングとリトライ機能

**確認結果**: 運用スクリプトは包括的なエラーハンドリングを実装

| エラー種別 | 検出方法 | リトライ | ユーザーガイダンス |
|-----------|---------|---------|------------------|
| SECRET_NOT_FOUND | ResourceNotFoundException | ❌ No | ✅ 詳細な解決方法 |
| ACCESS_DENIED | AccessDeniedException | ❌ No | ✅ 詳細な解決方法 |
| AUTH_EXPIRED | ExpiredToken/InvalidClientTokenId | ❌ No | ✅ 詳細な解決方法 |
| NETWORK_ERROR | Connection/Timeout | ✅ Yes (3回) | ✅ 詳細な解決方法 |
| INVALID_SECRET_FORMAT | JSON Parse Error | ❌ No | ✅ 詳細な解決方法 |

**実装品質**:
- エラー分類が明確
- リトライ可能なエラー（NETWORK_ERROR）のみリトライ
- 指数バックオフ実装（2秒 → 4秒 → 8秒）
- ユーザーフレンドリーなエラーメッセージ

## 総合評価

### 整合性の状態

| カテゴリ | 状態 | 詳細 |
|---------|------|------|
| 環境変数 | ✅ 良好 | 型定義ファイルは不在だが、CDK定義とLambda参照は一致 |
| IAMポリシー | ✅ 良好 | AWS SDK操作とCDK権限付与が完全に一致 |
| CDK Outputs | ✅ 良好 | すべての必要なOutputsが定義され、運用スクリプトで参照可能 |
| 運用スクリプト | ✅ 良好 | API呼び出しとレスポンス処理が正確 |

### 検出された課題

#### 1. 型定義ファイルの不在（優先度: 中）
**問題**: `src/types/env.ts`が存在しない
**影響**: 環境変数の型安全性が低い、保守性に課題
**推奨対応**: 
- `src/types/env.ts`を作成し、すべての環境変数の型定義を一元管理
- 各Lambda関数で型定義をインポートして使用

#### 2. 環境変数命名規則の不統一（優先度: 低）
**問題**: 
- Collector: `DYNAMODB_TABLE`
- Query/Export: `DYNAMODB_TABLE_NAME`
**影響**: 軽微（機能的には問題なし）
**推奨対応**: 
- 新規Lambda関数では`_NAME`サフィックスを統一
- 既存Lambda関数は動作しているため、変更不要

### 優先順位付け

| 順位 | 課題 | 優先度 | 理由 |
|------|------|--------|------|
| 1 | 型定義ファイルの作成 | 中 | 保守性向上、タイポ防止 |
| 2 | 環境変数命名規則の統一 | 低 | 機能的には問題なし |

## 成果物

1. **不整合リスト**: 上記「検出された課題」セクション
2. **優先順位付け**: 上記「優先順位付け」セクション
3. **整合性確認結果**: すべてのカテゴリで整合性を確認

## 申し送り事項

### 点検完了

CDK・運用スクリプトのインターフェース整合性点検を完了しました。

**主な発見**:
1. 環境変数、IAMポリシー、CDK Outputs、運用スクリプトの整合性は良好
2. 型定義ファイル（`src/types/env.ts`）が不在（優先度: 中）
3. 環境変数命名規則が一部不統一（優先度: 低、機能的には問題なし）

**推奨アクション**:
1. `src/types/env.ts`を作成して環境変数の型定義を一元管理
2. 新規Lambda関数では環境変数命名規則を統一（`_NAME`サフィックス）

**特記事項**:
- 運用スクリプトのエラーハンドリングは非常に充実している
- 環境変数フォールバック機能により、柔軟な運用が可能
- CDK Outputsは運用スクリプトで適切に参照されている

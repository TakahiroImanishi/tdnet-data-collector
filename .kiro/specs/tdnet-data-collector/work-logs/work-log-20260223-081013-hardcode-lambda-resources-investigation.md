# 作業記録: Lambda設定値とリソース名のハードコード調査

**作業日時**: 2026-02-23 08:10:13  
**作業者**: Kiro AI Assistant  
**作業概要**: Lambda設定値（メモリ、タイムアウト等）とDynamoDB/S3リソース名のハードコード箇所を調査し、環境別設定への移行方針を提案

## 作業内容

### 1. 調査対象

- Lambda設定値（メモリサイズ、タイムアウト、ランタイム、環境変数デフォルト値）
- DynamoDB/S3リソース名（テーブル名、バケット名、フォールバック値）
- CDKコード、Lambda関数、テストコード、運用スクリプト

### 2. 調査実施

#### 2.1 Lambda設定値の調査


**検索完了**: Lambda設定値（メモリサイズ、タイムアウト、ランタイム）

#### 2.2 リソース名の調査

**検索完了**: DynamoDB/S3リソース名、環境変数デフォルト値

#### 2.3 環境設定ファイルの確認

**確認完了**: `cdk/lib/config/environment-config.ts`, `cdk.json`

---

## 3. 調査結果サマリー

### 3.1 Lambda設定値

| カテゴリ | 箇所数 | 管理方法 | 状態 |
|---------|--------|---------|------|
| **メモリサイズ** | 9関数 | `environment-config.ts`で環境別管理 | ✅ 適切 |
| **タイムアウト** | 9関数 | `environment-config.ts`で環境別管理 | ✅ 適切 |
| **ランタイム** | 全Lambda | `lambda.Runtime.NODEJS_20_X`でハードコード | ⚠️ 要検討 |
| **Step Functions Lambda** | 4関数 | ハードコード（30, 60, 120秒） | ⚠️ 要改善 |

### 3.2 リソース名

| カテゴリ | 箇所数 | 管理方法 | 状態 |
|---------|--------|---------|------|
| **Lambda関数名** | 全関数 | `tdnet-{purpose}-${env}`パターン | ✅ 適切 |
| **DynamoDBテーブル名** | 3テーブル | CDK Outputsで取得 | ✅ 適切 |
| **S3バケット名** | 4バケット | CDK Outputsで取得 | ✅ 適切 |
| **環境変数デフォルト値** | 多数 | フォールバック値としてハードコード | ⚠️ 要改善 |

### 3.3 環境依存性

| 設定項目 | dev環境 | prod環境 | 共通 |
|---------|---------|----------|------|
| **Collector Lambda** | 300秒/256MB | 900秒/512MB | - |
| **Query Lambda** | 10秒/128MB | 30秒/256MB | - |
| **Export Lambda** | 120秒/256MB | 300秒/512MB | - |
| **API Lambda群** | 30秒/256MB | 30秒/256MB | - |
| **Health Lambda** | 10秒/128MB | 10秒/128MB | - |
| **ランタイム** | - | - | nodejs20.x |
| **ログレベル** | DEBUG | DEBUG | - |

---

## 4. 詳細リスト

### 4.1 Lambda設定値（環境別管理済み）

| ファイルパス | 設定項目 | 現在の値 | 環境依存性 | 優先度 |
|-------------|---------|---------|-----------|--------|
| `cdk/lib/config/environment-config.ts` | Collector timeout | local: 300秒, prod: 900秒 | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Collector memorySize | local: 256MB, prod: 512MB | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Query timeout | local: 10秒, prod: 30秒 | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Query memorySize | local: 128MB, prod: 256MB | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Export timeout | local: 120秒, prod: 300秒 | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Export memorySize | local: 256MB, prod: 512MB | 環境別 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Collect timeout | 30秒 | 共通 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | CollectStatus timeout | 30秒 | 共通 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | ExportStatus timeout | 30秒 | 共通 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | PdfDownload timeout | 30秒 | 共通 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Health timeout | 10秒 | 共通 | **低** ✅ |
| `cdk/lib/config/environment-config.ts` | Stats timeout | 30秒 | 共通 | **低** ✅ |

**評価**: ✅ 既に`environment-config.ts`で環境別に適切に管理されている。現状維持でOK。

### 4.2 Lambda設定値（ハードコード - 要改善）

| ファイルパス | 設定項目 | 現在の値 | 環境依存性 | 優先度 |
|-------------|---------|---------|-----------|--------|
| `cdk/lib/stacks/compute-stack.ts` | 全Lambda runtime | `lambda.Runtime.NODEJS_20_X` | 共通 | **中** ⚠️ |
| `cdk/lib/stacks/compute-stack.ts` | CollectorInit timeout | 30秒 | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorInit memorySize | 256MB | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorFetch timeout | 60秒 | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorFetch memorySize | 256MB | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorSave timeout | 120秒 | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorSave memorySize | 512MB | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorAggregate timeout | 30秒 | 共通 | **高** 🔴 |
| `cdk/lib/stacks/compute-stack.ts` | CollectorAggregate memorySize | 256MB | 共通 | **高** 🔴 |
| `cdk/lib/constructs/lambda-dlq.ts` | DLQ Processor timeout | 30秒 | 共通 | **中** ⚠️ |
| `cdk/lib/constructs/lambda-dlq.ts` | DLQ Processor memorySize | 256MB | 共通 | **中** ⚠️ |
| `cdk/lib/constructs/secrets-manager.ts` | API Key Rotation timeout | 30秒 | 共通 | **中** ⚠️ |
| `cdk/lib/constructs/secrets-manager.ts` | API Key Rotation memorySize | 128MB | 共通 | **中** ⚠️ |

**評価**: 
- 🔴 **高優先度**: Step Functions用Lambda（Init, Fetch, Save, Aggregate）は環境別設定が必要
- ⚠️ **中優先度**: ランタイムバージョン、DLQ Processor、API Key Rotationは共通設定でも可

### 4.3 環境変数デフォルト値（ハードコード - 要改善）

| ファイルパス | 設定項目 | デフォルト値 | 環境依存性 | 優先度 |
|-------------|---------|------------|-----------|--------|
| `src/lambda/query/generate-presigned-url.ts` | S3_BUCKET_NAME | `tdnet-data-collector-pdfs` | 環境別 | **高** 🔴 |
| `src/lambda/query/query-disclosures.ts` | DYNAMODB_TABLE_NAME | `tdnet_disclosures` | 環境別 | **高** 🔴 |
| `src/lambda/export/query-disclosures.ts` | DYNAMODB_TABLE_NAME | `tdnet-disclosures` | 環境別 | **高** 🔴 |
| `src/lambda/export/update-export-status.ts` | EXPORT_STATUS_TABLE_NAME | `tdnet-export-status` | 環境別 | **高** 🔴 |
| `src/lambda/export/generate-signed-url.ts` | EXPORT_BUCKET_NAME | `tdnet-exports` | 環境別 | **高** 🔴 |
| `src/lambda/export/export-to-s3.ts` | EXPORT_BUCKET_NAME | `tdnet-exports` | 環境別 | **高** 🔴 |
| `src/lambda/export/create-export-job.ts` | EXPORT_STATUS_TABLE_NAME | `tdnet-export-status` | 環境別 | **高** 🔴 |
| `src/utils/secrets-manager.ts` | AWS_REGION | `ap-northeast-1` | 共通 | **低** ✅ |
| `src/utils/logger.ts` | NODE_ENV | `production` | 環境別 | **低** ✅ |
| `src/utils/batch-write.ts` | AWS_REGION | `ap-northeast-1` | 共通 | **低** ✅ |
| `src/__tests__/load/load-test.test.ts` | COLLECTOR_FUNCTION_NAME | `tdnet-collector-dev` | テスト用 | **低** ✅ |
| `src/__tests__/load/load-test.test.ts` | DISCLOSURES_TABLE_NAME | `tdnet-disclosures-dev` | テスト用 | **低** ✅ |
| `src/__tests__/e2e/step-functions-collector.e2e.test.ts` | STATE_MACHINE_ARN | LocalStack用ARN | テスト用 | **低** ✅ |
| `src/__tests__/e2e/step-functions-collector.e2e.test.ts` | EXECUTION_STATE_TABLE | `ExecutionState_prod` | テスト用 | **低** ✅ |
| `src/__tests__/e2e/step-functions-collector.e2e.test.ts` | DYNAMODB_TABLE_NAME | `tdnet_disclosures` | テスト用 | **低** ✅ |
| `src/__tests__/e2e/step-functions-collector.e2e.test.ts` | S3_BUCKET_NAME | `tdnet-data-collector-pdfs-local` | テスト用 | **低** ✅ |

**評価**:
- 🔴 **高優先度**: Lambda関数内のリソース名デフォルト値は削除すべき（環境変数必須化）
- ✅ **低優先度**: テスト用デフォルト値、リージョン設定は現状維持でOK

### 4.4 PowerShellスクリプト（ハードコード - 現状維持）

| ファイルパス | 設定項目 | 現在の値 | 環境依存性 | 優先度 |
|-------------|---------|---------|-----------|--------|
| `scripts/localstack-setup.ps1` | DynamoDBテーブル名 | `tdnet-export-status` | LocalStack用 | **低** ✅ |
| `scripts/localstack-setup.ps1` | S3バケット名 | `tdnet-data-collector-pdfs-local` | LocalStack用 | **低** ✅ |
| `scripts/localstack-setup.ps1` | S3バケット名 | `tdnet-data-collector-exports-local` | LocalStack用 | **低** ✅ |
| `scripts/generate-env-file.ps1` | S3バケット名パターン | `tdnet-data-collector-pdfs-$accountId` | 環境別 | **低** ✅ |

**評価**: ✅ LocalStack用スクリプトは固定値でOK。`generate-env-file.ps1`は既にCDK Outputsから取得。

### 4.5 Step Functions State Machine（ハードコード - 現状維持）

| ファイルパス | 設定項目 | 現在の値 | 環境依存性 | 優先度 |
|-------------|---------|---------|-----------|--------|
| `scripts/step-functions/state-machine-definition.json` | Lambda関数名 | `tdnet-collector-init` | LocalStack用 | **低** ✅ |
| `scripts/step-functions/state-machine-definition.json` | Lambda関数名 | `tdnet-collector-fetch` | LocalStack用 | **低** ✅ |
| `scripts/step-functions/state-machine-definition.json` | Lambda関数名 | `tdnet-collector-save` | LocalStack用 | **低** ✅ |
| `scripts/step-functions/state-machine-definition.json` | Lambda関数名 | `tdnet-collector-aggregate` | LocalStack用 | **低** ✅ |
| `scripts/step-functions/state-machine-definition.json` | MaxConcurrency | 5 | 共通 | **低** ✅ |
| `scripts/step-functions/state-machine-definition.json` | Retry設定 | IntervalSeconds: 1-2, MaxAttempts: 3-5 | 共通 | **低** ✅ |

**評価**: ✅ LocalStack用State Machine定義は固定値でOK。本番環境はCDKで生成。

---

## 5. 対応方針の提案

### 5.1 CDK Contextで管理すべき設定（優先度: 低）

**対象**: なし

**理由**: 既に`environment-config.ts`で環境別管理が実装されており、CDK Contextへの移行は不要。

### 5.2 環境変数化すべき設定（優先度: 高 🔴）

#### 5.2.1 Step Functions用Lambda設定

**対象**:
- `cdk/lib/stacks/compute-stack.ts`の以下4関数:
  - CollectorInit: timeout 30秒, memorySize 256MB
  - CollectorFetch: timeout 60秒, memorySize 256MB
  - CollectorSave: timeout 120秒, memorySize 512MB
  - CollectorAggregate: timeout 30秒, memorySize 256MB

**提案**: `environment-config.ts`に以下を追加

```typescript
export interface EnvironmentConfig {
  // ... 既存設定 ...
  
  // Step Functions用Lambda設定
  collectorInit: LambdaEnvironmentConfig;
  collectorFetch: LambdaEnvironmentConfig;
  collectorSave: LambdaEnvironmentConfig;
  collectorAggregate: LambdaEnvironmentConfig;
}

// localConfig
collectorInit: { timeout: 30, memorySize: 256, logLevel: 'DEBUG' },
collectorFetch: { timeout: 60, memorySize: 256, logLevel: 'DEBUG' },
collectorSave: { timeout: 120, memorySize: 512, logLevel: 'DEBUG' },
collectorAggregate: { timeout: 30, memorySize: 256, logLevel: 'DEBUG' },

// prodConfig
collectorInit: { timeout: 30, memorySize: 256, logLevel: 'DEBUG' },
collectorFetch: { timeout: 60, memorySize: 256, logLevel: 'DEBUG' },
collectorSave: { timeout: 120, memorySize: 512, logLevel: 'DEBUG' },
collectorAggregate: { timeout: 30, memorySize: 256, logLevel: 'DEBUG' },
```

**メリット**:
- 環境別にタイムアウト・メモリサイズを調整可能
- 他のLambda関数と統一された管理方法
- テスト環境での設定変更が容易

#### 5.2.2 Lambda関数内のリソース名デフォルト値削除

**対象**:
- `src/lambda/query/generate-presigned-url.ts`: `S3_BUCKET_NAME`
- `src/lambda/query/query-disclosures.ts`: `DYNAMODB_TABLE_NAME`
- `src/lambda/export/*.ts`: `DYNAMODB_TABLE_NAME`, `EXPORT_STATUS_TABLE_NAME`, `EXPORT_BUCKET_NAME`

**提案**: デフォルト値を削除し、環境変数必須化

```typescript
// 修正前
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs';

// 修正後
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error('S3_BUCKET_NAME environment variable is required');
}
```

**メリット**:
- 環境変数未設定時に即座にエラー検出
- 誤った環境へのデプロイを防止
- デバッグが容易

**影響範囲**:
- Lambda関数: 7ファイル
- テストコード: 環境変数モックの追加が必要

### 5.3 設定ファイル化すべき設定（優先度: 中 ⚠️）

#### 5.3.1 Lambdaランタイムバージョン

**対象**: 全Lambda関数の`lambda.Runtime.NODEJS_20_X`

**提案**: `environment-config.ts`に追加

```typescript
export interface EnvironmentConfig {
  // ... 既存設定 ...
  
  /**
   * Lambda runtime version
   */
  runtime: lambda.Runtime;
}

// localConfig & prodConfig
runtime: lambda.Runtime.NODEJS_20_X,
```

**メリット**:
- ランタイムバージョンアップ時に一箇所修正で対応可能
- 環境別にランタイムバージョンを変更可能（テスト環境で新バージョン検証等）

**デメリット**:
- 現状でも全Lambda関数で統一されており、緊急性は低い

#### 5.3.2 DLQ Processor / API Key Rotation設定

**対象**:
- `cdk/lib/constructs/lambda-dlq.ts`: timeout 30秒, memorySize 256MB
- `cdk/lib/constructs/secrets-manager.ts`: timeout 30秒, memorySize 128MB

**提案**: `environment-config.ts`に追加（必要に応じて）

**評価**: 現状の固定値で問題なし。環境別調整が必要になった時点で対応。

### 5.4 現状維持でよい設定（優先度: 低 ✅）

#### 5.4.1 既に適切に管理されている設定

- ✅ Lambda関数名: `tdnet-{purpose}-${env}`パターンで環境別に自動生成
- ✅ DynamoDB/S3リソース名: CDK Outputsで取得、`get-stack-outputs.ps1`で自動取得
- ✅ メインLambda関数の設定: `environment-config.ts`で環境別管理済み
- ✅ リージョン設定: `ap-northeast-1`で統一、変更の必要性なし
- ✅ テスト用デフォルト値: LocalStack/E2Eテスト用、現状維持でOK
- ✅ LocalStackスクリプト: 固定値で問題なし

#### 5.4.2 変更不要な理由

1. **Lambda関数名**: CDKで環境変数を使用して動的生成されており、ハードコードではない
2. **リソース名取得**: `get-stack-outputs.ps1`で既に自動化されている
3. **テスト用設定**: テスト環境固有の設定であり、本番環境に影響しない
4. **リージョン設定**: 東京リージョン固定で運用方針が確立している

---

## 6. 実装優先順位

### 優先度: 高 🔴（即座に対応）

1. **Step Functions用Lambda設定の環境変数化**
   - ファイル: `cdk/lib/config/environment-config.ts`, `cdk/lib/stacks/compute-stack.ts`
   - 作業量: 中（設定追加 + 4関数修正）
   - 影響範囲: Step Functions関連のみ
   - メリット: 環境別最適化、テスト容易性向上

2. **Lambda関数内リソース名デフォルト値削除**
   - ファイル: `src/lambda/query/*.ts`, `src/lambda/export/*.ts`
   - 作業量: 中（7ファイル修正 + テスト更新）
   - 影響範囲: Query/Export Lambda関数
   - メリット: 環境変数未設定エラーの早期検出、デバッグ容易性向上

### 優先度: 中 ⚠️（計画的に対応）

3. **Lambdaランタイムバージョンの設定ファイル化**
   - ファイル: `cdk/lib/config/environment-config.ts`, 全Lambda Construct
   - 作業量: 大（全Lambda関数修正）
   - 影響範囲: 全Lambda関数
   - メリット: ランタイムバージョンアップ時の一括変更

### 優先度: 低 ✅（現状維持）

4. **DLQ Processor / API Key Rotation設定**
   - 現状の固定値で問題なし
   - 必要に応じて将来対応

5. **その他の設定**
   - 既に適切に管理されているため対応不要

---

## 7. 成果物

### 7.1 調査レポート

本作業記録ファイル: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-081013-hardcode-lambda-resources-investigation.md`

### 7.2 調査結果サマリー

- **Lambda設定値**: 9関数は`environment-config.ts`で適切に管理済み。Step Functions用4関数は要改善。
- **リソース名**: CDK Outputsで適切に管理済み。Lambda関数内のデフォルト値は削除推奨。
- **環境変数デフォルト値**: 7ファイルで削除推奨。テスト用は現状維持。
- **優先度**: 高2件、中1件、低多数

---

## 8. 申し送り事項

### 8.1 次のタスク候補

1. **Step Functions用Lambda設定の環境変数化** (優先度: 高 🔴)
   - `environment-config.ts`に設定追加
   - `compute-stack.ts`で設定値を参照するように修正
   - テストコード更新

2. **Lambda関数内リソース名デフォルト値削除** (優先度: 高 🔴)
   - Query/Export Lambda関数のデフォルト値削除
   - 環境変数必須化エラーハンドリング追加
   - テストコード更新（環境変数モック追加）

3. **Lambdaランタイムバージョンの設定ファイル化** (優先度: 中 ⚠️)
   - `environment-config.ts`にruntime設定追加
   - 全Lambda Constructで設定値を参照するように修正

### 8.2 注意事項

- **既に適切に管理されている設定**: Lambda関数名、DynamoDB/S3リソース名、メインLambda関数の設定は変更不要
- **テスト用設定**: LocalStack/E2Eテスト用のデフォルト値は現状維持でOK
- **環境変数必須化**: デフォルト値削除時は、エラーメッセージを明確にすること

### 8.3 関連ドキュメント

- `cdk/lib/config/environment-config.ts` - 環境別Lambda設定
- `scripts/lib/get-stack-outputs.ps1` - CDK Outputs自動取得
- `.kiro/steering/infrastructure/cdk-implementation.md` - CDK実装ガイド
- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-hardcoded-values-improvement.md` - タスク管理

---

## 9. 作業完了

**完了日時**: 2026-02-23 08:10:13  
**作業時間**: 約30分  
**成果物**: Lambda設定値とリソース名のハードコード調査レポート（本ファイル）


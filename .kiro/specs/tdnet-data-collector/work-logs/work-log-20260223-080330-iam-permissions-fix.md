# 作業記録: IAM権限の修正

**作業日時**: 2026-02-23 08:03:30
**作業者**: Kiro AI Assistant
**タスク**: タスク6.2.1 - IAM権限の修正
**関連タスク**: `.kiro/specs/tdnet-data-collector/03-tasks/tasks-step-functions-migration.md`

## 作業概要

Step Functions実行時に発生したIAM権限不足エラーを修正。collector Lambda関数にExecutionStateテーブルへの適切な権限を付与する。

## 問題の詳細

### エラー内容

```
AccessDeniedException: User: arn:aws:sts::803879841964:assumed-role/TdnetCompute-prod-CollectorInitFunctionServiceRoleD-qvi2BLQ0PBAL/tdnet-collector-init-prod is not authorized to perform: dynamodb:PutItem on resource: arn:aws:dynamodb:ap-northeast-1:803879841964:table/tdnet_executions
```

### 根本原因

`collector-init` Lambda関数がExecutionStateテーブル（`tdnet_executions`）への書き込み権限を持っていない。

### 影響範囲

- collector-init: PutItem権限が必要（実行状態の初期化）
- collector-aggregate: UpdateItem権限が必要（実行状態の更新）
- collector-fetch, collector-save: 権限確認が必要

## 実施内容

### 1. 現状確認


`cdk/lib/stacks/compute-stack.ts`でExecutionStateテーブルへの`grantReadWriteData`を既に実施済み。

### 2. 根本原因の特定

Lambda関数のコードを確認した結果、以下の不一致を発見:

**環境変数名の不一致**:
- CDK設定: `EXECUTION_STATE_TABLE`
- Lambda実装: `DYNAMODB_EXECUTIONS_TABLE`（`src/lambda/collector/update-execution-status.ts`）

**テーブル名の不一致**:
- CDK定義: `ExecutionState_${environment}`（例: `ExecutionState_prod`）
- Lambda実装のデフォルト値: `tdnet_executions`

この不一致により、Lambda関数が誤ったテーブル名（`tdnet_executions`）にアクセスしようとし、IAM権限エラーが発生していました。

### 3. 修正方針

以下の2つのアプローチを検討:

**Option A**: Lambda実装を修正（環境変数名を`EXECUTION_STATE_TABLE`に統一）
- メリット: CDK設定との一貫性、他のLambda関数も同じ環境変数名を使用
- デメリット: Lambda実装の変更が必要

**Option B**: CDK設定を修正（環境変数名を`DYNAMODB_EXECUTIONS_TABLE`に変更）
- メリット: Lambda実装の変更不要
- デメリット: 他のLambda関数との一貫性が失われる

**決定**: Option Aを採用（Lambda実装を修正）

理由:
- CDK設定では既に`EXECUTION_STATE_TABLE`を使用している
- collector-fetch, collector-save, collector-aggregateも同じ環境変数名を使用
- 一貫性を保つことで将来的なメンテナンスが容易

## 修正内容

### 1. Lambda実装の修正

`src/lambda/collector/update-execution-status.ts`の環境変数名を修正:


- 変更前: `DYNAMODB_EXECUTIONS_TABLE`
- 変更後: `EXECUTION_STATE_TABLE`
- デフォルト値変更: `tdnet_executions` → `ExecutionState_prod`

### 2. テストファイルの修正

以下のテストファイルで環境変数名を統一:

- `src/lambda/collector/__tests__/update-execution-status.test.ts` ✓
- `src/lambda/collector/__tests__/execution-status.monotonicity.test.ts` ✓
- `src/lambda/collect-status/__tests__/handler.test.ts` ✓
- `src/lambda/collect-status/__tests__/handler-step-functions.test.ts` ✓
- `src/__tests__/e2e/step-functions-collector.e2e.test.ts` ✓
- `src/__tests__/integration/performance-benchmark.test.ts` ✓
- `src/lambda/collector-aggregate/__tests__/integration.test.ts` ✓
- `src/lambda/collector/__tests__/handler.e2e.test.ts` ✓
- `src/lambda/collect-status/__tests__/handler.e2e.test.ts` ✓
- `cdk/lib/stacks/__tests__/compute-stack.test.ts` ✓

## テスト結果

### 成功したテスト

- `src/lambda/collector/__tests__/update-execution-status.test.ts`: 10/10テスト成功 ✓
- `src/lambda/collector-init/__tests__/handler.test.ts`: 15/15テスト成功 ✓

### 失敗したテスト

- `src/lambda/collect-status/__tests__/handler.test.ts`: 3/22テスト失敗

**失敗理由**: Step Functions統合によるレスポンス形式の変更
- DynamoDB実行状態とStep Functions実行状態のレスポンス形式が異なる
- テストが旧形式を期待している

**対応方針**: 別タスクとして対応（タスク6.3参照）

## 成果物

### 修正ファイル

1. `src/lambda/collector/update-execution-status.ts` - 環境変数名を`EXECUTION_STATE_TABLE`に統一
2. 10個のテストファイル - 環境変数名とデフォルト値を修正

### 確認事項

- ✅ 環境変数名の統一（`EXECUTION_STATE_TABLE`）
- ✅ デフォルトテーブル名の修正（`ExecutionState_prod`）
- ✅ 主要テストの成功確認
- ⚠️ collect-statusテストは別タスクで対応

## 次のステップ

1. CDKデプロイ（本番環境）
2. Step Functions実行テスト（タスク6.2の続き）
3. collect-statusテストの修正（タスク6.3）

## 申し送り事項

### IAM権限について

Compute Stackでは既に`grantReadWriteData`を使用してIAM権限を付与済み。今回の問題は環境変数名の不一致が原因であり、IAM権限自体は正しく設定されていた。

### 環境変数の統一

今後、新規Lambda関数を追加する際は、ExecutionStateテーブルへのアクセスに`EXECUTION_STATE_TABLE`環境変数を使用すること。

### テーブル名の命名規則

- ExecutionStateテーブル: `ExecutionState_${environment}`
- Disclosuresテーブル: `Disclosures_${environment}`

この命名規則に従うことで、環境ごとのテーブル分離が明確になる。


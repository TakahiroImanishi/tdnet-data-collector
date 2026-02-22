# 作業記録: collect-status API 500エラーの調査と修正

**作成日時**: 2026-02-23 08:39:22
**タスク**: タスク8.1.6 - collect-status API 500エラーの調査と修正
**担当**: Kiro AI Assistant

## 目的

Step Functions実行状態確認時の500エラーを解決し、運用スクリプトを安定化する。

## 背景

マニュアルデータ収集スクリプトでStep Functions実行テストを実施した際、以下の問題が発生：

1. ✅ APIキー取得は成功（Secrets Manager統合の改善が効果あり）
2. ✅ データ収集リクエストは成功（execution_idを取得）
3. ❌ 実行状態の確認（`GET /collect/{executionId}`）で500エラーが発生

**エラー詳細**:
```
実行状態を確認中...
❌ 実行状態の確認に失敗しました
ステータスコード: 500
エラー: {"message":"Internal server error"}
```

## 調査手順

### 1. CloudWatch Logsの確認

まず、`collect-status` Lambda関数のCloudWatch Logsを確認してエラーの詳細を取得する。

### 2. IAM権限の確認

`collect-status` Lambda関数が以下の権限を持っているか確認：
- `states:DescribeExecution`: Step Functions実行状態の取得
- `dynamodb:GetItem`: ExecutionStateテーブルからの読み取り

### 3. 環境変数の確認

以下の環境変数が正しく設定されているか確認：
- `STATE_MACHINE_ARN`: Step Functions ARN
- `EXECUTION_STATE_TABLE`: ExecutionStateテーブル名

### 4. コードレビュー

`src/lambda/collect-status/handler.ts`のStep Functions統合部分をレビュー。

## 作業内容


### CloudWatch Logs分析結果

**エラーメッセージ**:
```
ERROR: Execution not found: 4a332cf7-8337-4619-9519-f7438b135de6
```

**ログ詳細**:
```
INFO: Getting execution status from DynamoDB
execution_id: 4a332cf7-8337-4619-9519-f7438b135de6
tableName: tdnet_executions_prod
```

**根本原因**:
`collect-status` Lambda関数が`STATE_MACHINE_ARN`環境変数が設定されていないため、Step Functions統合ではなくレガシーのDynamoDBテーブル（`tdnet_executions_prod`）から実行状態を取得しようとしています。

**コード分析**:
```typescript
// handler.ts Line 101
const executionStatus = STATE_MACHINE_ARN
  ? await getStepFunctionsExecutionStatus(execution_id)
  : await getExecutionStatus(execution_id);
```

`STATE_MACHINE_ARN`が未設定のため、`getExecutionStatus()`（レガシーDynamoDB）が呼び出されています。しかし、Step Functionsで開始された実行は`tdnet_executions_prod`テーブルに記録されないため、「Execution not found」エラーが発生します。

## 修正方針

### 1. 環境変数の確認

`collect-status` Lambda関数に`STATE_MACHINE_ARN`環境変数が設定されているか確認します。


### 環境変数確認結果

**現在の設定**:
```json
{
  "ENVIRONMENT": "prod",
  "NODE_OPTIONS": "--enable-source-maps",
  "DYNAMODB_EXECUTIONS_TABLE": "tdnet_executions_prod",
  "LOG_LEVEL": "DEBUG"
}
```

**問題**: `STATE_MACHINE_ARN`環境変数が設定されていない

**CDK設定確認**:
- `collectFunction`には`STATE_MACHINE_ARN`が追加されている（Line 663-666）
- `collectStatusFunction`には追加されていない

## 修正内容

### 1. CDK修正

`cdk/lib/stacks/compute-stack.ts`を修正して、Step Functions有効時に`collectStatusFunction`にも環境変数とIAM権限を追加します。

**追加箇所**: Line 668の後（`collectFunction`への権限付与の後）

**追加内容**:
1. `collectStatusFunction`に`STATE_MACHINE_ARN`環境変数を追加
2. `collectStatusFunction`に`EXECUTION_STATE_TABLE`環境変数を追加
3. `collectStatusFunction`にStep Functions `DescribeExecution`権限を付与
4. `collectStatusFunction`にExecutionStateテーブルの読み取り権限を付与


### CDK修正実施

**修正内容**:
1. `cdk/lib/stacks/compute-stack.ts` (Line 670-683)
   - `collectStatusFunction`に`STATE_MACHINE_ARN`環境変数を追加
   - `collectStatusFunction`に`EXECUTION_STATE_TABLE`環境変数を追加
   - `collectStatusFunction`にStep Functions `DescribeExecution`権限を付与
   - `collectStatusFunction`にExecutionStateテーブルの読み取り権限を付与

2. `cdk/lib/stacks/__tests__/compute-stack.test.ts`
   - Step Functions統合テストに新しいテストケースを追加
   - `collectStatusFunction`の環境変数設定を検証

**テスト結果**: 34/35テスト成功（1件の既存テスト失敗は本修正と無関係）

## 次のステップ

### 1. CDKデプロイ

本番環境に修正をデプロイします。

```powershell
cd cdk
cdk deploy TdnetDataCollectorComputeStack-prod --profile imanishi-awssso
```

### 2. 動作確認

デプロイ後、マニュアルデータ収集スクリプトを再実行して、実行状態確認が成功することを確認します。

```powershell
.\scripts\manual-data-collection.ps1 -StartDate "2026-02-20" -EndDate "2026-02-20"
```

### 3. 環境変数確認

デプロイ後、Lambda関数の環境変数が正しく設定されていることを確認します。

```powershell
aws lambda get-function-configuration --profile imanishi-awssso --function-name tdnet-collect-status-prod --query "Environment.Variables"
```

## 成果物

- `cdk/lib/stacks/compute-stack.ts` (更新)
- `cdk/lib/stacks/__tests__/compute-stack.test.ts` (更新)
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-083922-collect-status-500-error-investigation.md` (作業記録)

## 申し送り事項

1. **CDKデプロイが必要**: 本番環境に修正をデプロイする必要があります
2. **動作確認が必要**: デプロイ後、マニュアルデータ収集スクリプトで実行状態確認が成功することを確認してください
3. **既存テスト失敗**: `Collector Functionの環境変数が設定されている`テストが失敗していますが、本修正とは無関係です（別途調査が必要）


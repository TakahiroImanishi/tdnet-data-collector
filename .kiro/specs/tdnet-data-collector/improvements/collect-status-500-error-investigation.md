# 改善記録: collect-status API 500エラーの調査と修正

**作成日時**: 2026-02-23 08:39:22
**完了日時**: 2026-02-23 09:00:00
**カテゴリ**: バグ修正
**優先度**: 高

## 問題の概要

マニュアルデータ収集スクリプトでStep Functions実行テストを実施した際、実行状態確認（`GET /collect/{executionId}`）で500エラーが発生しました。

**エラーメッセージ**:
```
実行状態を確認中...
❌ 実行状態の確認に失敗しました
ステータスコード: 500
エラー: {"message":"Internal server error"}
```

## 根本原因

`collect-status` Lambda関数が`STATE_MACHINE_ARN`環境変数が設定されていないため、Step Functions統合ではなくレガシーのDynamoDBテーブル（`tdnet_executions_prod`）から実行状態を取得しようとしていました。しかし、Step Functionsで開始された実行はこのテーブルに記録されないため、「Execution not found」エラーが発生していました。

**CloudWatch Logs分析**:
```
INFO: Getting execution status from DynamoDB
execution_id: 4a332cf7-8337-4619-9519-f7438b135de6
tableName: tdnet_executions_prod
ERROR: Execution not found: 4a332cf7-8337-4619-9519-f7438b135de6
```

**コード分析**:
```typescript
// handler.ts Line 101
const executionStatus = STATE_MACHINE_ARN
  ? await getStepFunctionsExecutionStatus(execution_id)
  : await getExecutionStatus(execution_id);
```

`STATE_MACHINE_ARN`が未設定のため、`getExecutionStatus()`（レガシーDynamoDB）が呼び出されていました。

## 修正内容

### 1. CDK修正（`cdk/lib/stacks/compute-stack.ts`）

Step Functions有効時に`collectStatusFunction`に以下を追加：

1. **環境変数の追加**:
   - `STATE_MACHINE_ARN`: Step Functions ARN
   - `EXECUTION_STATE_TABLE`: ExecutionStateテーブル名

2. **IAM権限の追加**:
   - Step Functions `DescribeExecution`権限（`grantRead`）
   - ExecutionStateテーブルの読み取り権限（`grantReadData`）

**修正箇所**: Line 670-683

```typescript
// Collect Status Functionの環境変数を更新（Step Functions統合）
this.collectStatusFunction.addEnvironment(
  'STATE_MACHINE_ARN',
  stepFunctionsCollectorConstruct.stateMachine.stateMachineArn
);
this.collectStatusFunction.addEnvironment(
  'EXECUTION_STATE_TABLE',
  this.executionStateTable.tableName
);

// Collect Status FunctionにStep Functions DescribeExecution権限を付与
stepFunctionsCollectorConstruct.stateMachine.grantRead(this.collectStatusFunction);

// Collect Status FunctionにExecutionStateテーブルの読み取り権限を付与
this.executionStateTable.grantReadData(this.collectStatusFunction);
```

### 2. ユニットテスト更新（`cdk/lib/stacks/__tests__/compute-stack.test.ts`）

Step Functions統合テストに新しいテストケースを追加：

```typescript
it('Collect Status FunctionにSTATE_MACHINE_ARN環境変数が設定される', () => {
  stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
    FunctionName: 'tdnet-collect-status-prod',
    Environment: {
      Variables: Match.objectLike({
        STATE_MACHINE_ARN: Match.anyValue(),
        EXECUTION_STATE_TABLE: Match.anyValue(),
      }),
    },
  });
});
```

**テスト結果**: 34/35テスト成功

## 影響範囲

- `collect-status` Lambda関数: Step Functions統合対応
- Compute Stack: 環境変数とIAM権限の追加
- ユニットテスト: 新しいテストケースの追加

## 次のステップ

1. **CDKデプロイ**: 本番環境に修正をデプロイ
2. **動作確認**: マニュアルデータ収集スクリプトで実行状態確認が成功することを確認
3. **環境変数確認**: デプロイ後、Lambda関数の環境変数が正しく設定されていることを確認

## 成果物

- `cdk/lib/stacks/compute-stack.ts` (更新)
- `cdk/lib/stacks/__tests__/compute-stack.test.ts` (更新)
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-083922-collect-status-500-error-investigation.md` (作業記録)
- `.kiro/specs/tdnet-data-collector/improvements/collect-status-500-error-investigation.md` (改善記録)

## 教訓

1. **環境変数の一貫性**: 新機能追加時は、関連するすべてのLambda関数に必要な環境変数を設定する
2. **IAM権限の確認**: 環境変数だけでなく、IAM権限も忘れずに付与する
3. **統合テストの重要性**: ユニットテストだけでなく、実際の環境での統合テストが重要
4. **CloudWatch Logsの活用**: エラー発生時はCloudWatch Logsを確認して根本原因を特定する

## 関連ドキュメント

- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-step-functions-migration.md` - タスク8.1.6
- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリング基本原則
- `.kiro/steering/infrastructure/cdk-implementation.md` - CDK実装ガイド

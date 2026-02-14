# 作業記録: CDK Constructsの条件分岐テスト追加

**作業日時**: 2026-02-14 09:11:03  
**タスク**: Task 27.2 - テストカバレッジ向上（CDK Constructs）  
**目標**: Branchesカバレッジを78.75%→80%以上に向上

## 1. タスク分析

### 目標
- CDK Constructsの条件分岐をテストでカバー
- Branchesカバレッジを80%以上に向上

### 対象ファイル
1. `cdk/lib/constructs/cloudfront.ts` (95-96行目)
2. `cdk/lib/constructs/lambda-function.ts`
3. `cdk/lib/constructs/monitoring.ts`

## 2. 現状調査

### カバレッジ確認


### カバレッジ結果
```
Branches: 78.75% (608/772)
```

### 未カバーの条件分岐を特定

1. **cloudtrail.ts** - 75% (8 branches, 6 covered)
   - Line 76-78: `if (props.pdfsBucket)` - PDFバケットが未定義の場合
   - Line 88-115: `if (props.dynamodbTables && props.dynamodbTables.length > 0)` - DynamoDBテーブルが空配列の場合

2. **secrets-manager.ts** - 66.66% (3 branches, 2 covered)
   - Line 78-103: `if (enableRotation)` - ローテーション無効の場合

3. **cloudwatch-logs.ts** - 85.71% (7 branches, 6 covered)
   - Line 110: `default` case in `getRetentionDaysAsNumber()` - 予期しない値の場合

## 3. テスト追加

### 対象ファイル
- `cdk/__tests__/cloudtrail.test.ts` - オプショナルプロパティのテスト追加
- `cdk/__tests__/secrets-manager.test.ts` - 新規作成
- `cdk/__tests__/cloudwatch-logs.test.ts` - 新規作成


## 4. テスト実行結果

### secrets-manager.test.ts
- ❌ 3件のテスト失敗
- 原因: RotationScheduleのプロパティが`AutomaticallyAfterDays`ではなく`ScheduleExpression: "rate(90 days)"`を使用
- 修正: テストのアサーションを`ScheduleExpression`に変更

### 問題点
CDKのRotationScheduleは、`automaticallyAfter`を指定すると、CloudFormationでは`ScheduleExpression`として出力される。

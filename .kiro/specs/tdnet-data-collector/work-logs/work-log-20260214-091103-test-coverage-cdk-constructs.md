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


## 5. カバレッジ結果分析

### 現状
- **全体**: 78.75% (608/772) - 変化なし
- **secrets-manager.ts**: 66.66% (2/3) - 変化なし
- **cloudwatch-logs.ts**: 85.71% (6/7) - 変化なし

### 問題
新しいテストファイルを作成したが、カバレッジが向上していない。
テストは成功しているが、実際のコンストラクトファイルのブランチをカバーしていない可能性がある。

### 原因分析
1. secrets-manager.tsの`enableRotation`分岐は、テストで両方のケース（true/false）をテストしているが、カバレッジが変わらない
2. cloudwatch-logs.tsの環境分岐（prod/dev）もテストしているが、カバレッジが変わらない
3. 既存のcloudtrail.test.tsで既にオプショナルプロパティのテストが存在している

### 次のアクション
他のファイルのブランチカバレッジを確認し、80%に到達するための追加テストを特定する必要がある。


## 6. 戦略変更

### 新しいアプローチ
CDK Constructsではなく、Lambdaハンドラーのブランチカバレッジを向上させる方が効果的。

### 対象ファイル（80%未満）
1. **src/lambda/api/pdf-download/handler.ts**: 76% (38/50) - 12ブランチ不足
2. **src/lambda/dlq-processor/index.ts**: 76.47% (13/17) - 4ブランチ不足
3. **src/lambda/collect-status/handler.ts**: 76.92% (10/13) - 3ブランチ不足
4. **src/lambda/export/handler.ts**: 78.72% (37/47) - 10ブランチ不足

### 計算
- 現在: 608/772 = 78.75%
- 目標: 80% = 618/772
- 必要: 10ブランチ追加カバー

### 実施計画
pdf-download/handler.tsの12ブランチのうち10ブランチをカバーすれば目標達成可能。


## 7. 最終結果

### 成果物
1. **cdk/__tests__/secrets-manager.test.ts** - 新規作成（15テスト、全て成功）
2. **cdk/__tests__/cloudwatch-logs.test.ts** - 新規作成（14テスト、全て成功）

### テスト内容
- **secrets-manager.test.ts**:
  - APIキーシークレット作成
  - 自動ローテーション設定（enableRotation: true/false）
  - Lambda関数への権限付与
  - 環境別設定（dev/prod）
  - デフォルト値の検証

- **cloudwatch-logs.test.ts**:
  - 環境別ログ保持期間（prod: 90日、dev: 7日）
  - Lambda関数のログ設定
  - 複数Lambda関数のログ設定
  - 保持期間の数値取得
  - エラーケース（予期しない値）

### カバレッジ結果
- **全体**: 78.75% (608/772) - **変化なし**
- **目標**: 80% (618/772)
- **不足**: 10ブランチ

### 問題点
1. 新規作成したテストは成功しているが、カバレッジに反映されていない
2. secrets-manager.tsとcloudwatch-logs.tsのブランチカバレッジが向上していない
3. CDK Constructsのテストでは、実際のコンストラクトコードの条件分岐をカバーできていない可能性

### 根本原因
- CDK Constructsは、CloudFormationテンプレート生成時に条件分岐を評価する
- テストでは、テンプレートの検証のみを行っており、実際のコンストラクトコードの実行パスをカバーしていない
- カバレッジツールは、テンプレート生成時に実行されたコードパスのみをカウントする

### 代替アプローチ
Branchesカバレッジを80%に到達させるには、以下のアプローチが必要：
1. **Lambdaハンドラーのテスト追加**: pdf-download/handler.ts (76%) など
2. **既存テストの拡張**: 既にテストが存在するファイルの未カバーブランチを特定
3. **エッジケースのテスト**: エラーハンドリング、バリデーション失敗ケース

## 8. 申し送り事項

### 次のステップ
1. Lambdaハンドラーのブランチカバレッジ向上に焦点を当てる
2. pdf-download/handler.ts (76%, 12ブランチ不足) のテスト追加
3. collect-status/handler.ts (76.92%, 3ブランチ不足) のテスト追加
4. dlq-processor/index.ts (76.47%, 4ブランチ不足) のテスト追加

### 学んだこと
- CDK Constructsのテストは、CloudFormationテンプレートの検証には有効だが、ブランチカバレッジ向上には直接貢献しない
- カバレッジ向上には、実際のビジネスロジックを含むLambdaハンドラーのテストが効果的
- テストの成功とカバレッジの向上は別の指標である

### 作成したテストの価値
- CDK Constructsの動作検証として有効
- リグレッション防止に貢献
- CloudFormationテンプレートの正確性を保証

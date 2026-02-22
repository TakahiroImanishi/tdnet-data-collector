# 作業記録: LogGroup管理の統一

**作業日時**: 2026-02-22 14:53:30
**タスク番号**: 6（元タスク48）
**作業者**: AI Assistant
**作業概要**: Health/Stats FunctionのLogGroupをCDK管理下に追加

## 作業内容

### 1. 現状確認

#### MonitoringStackの確認結果
- **既存のLogGroup管理**: 開発環境で7つのLambda関数のLogGroupを管理
  - Collector, Query, Export, Collect, CollectStatus, ExportStatus, PdfDownload
- **未管理**: Health, Stats FunctionのLogGroup
- **本番環境**: 既存LogGroupを参照（CDK管理外）

#### 既存パターン
```typescript
// 開発環境のみLogGroup作成
if (env === 'prod') {
  // 本番環境: 既存LogGroupを参照
} else {
  // 開発環境: LogGroup作成
  new logs.LogGroup(this, 'FunctionNameLogGroup', {
    logGroupName: `/aws/lambda/${props.lambdaFunctions.functionName.functionName}`,
    retention: logRetentionConfig.other,
    removalPolicy,
  });
}
```

### 2. 実装内容

#### 追加するLogGroup
1. **Health Function LogGroup**
   - ID: `HealthLogGroup`
   - LogGroupName: `/aws/lambda/${props.lambdaFunctions.health.functionName}`
   - Retention: `logRetentionConfig.other`（開発: 1週間、本番: 1ヶ月）
   - RemovalPolicy: 開発環境では`DESTROY`

2. **Stats Function LogGroup**
   - ID: `StatsLogGroup`
   - LogGroupName: `/aws/lambda/${props.lambdaFunctions.stats.functionName}`
   - Retention: `logRetentionConfig.other`（開発: 1週間、本番: 1ヶ月）
   - RemovalPolicy: 開発環境では`DESTROY`

### 3. 実装


#### 変更内容
`cdk/lib/stacks/monitoring-stack.ts`に以下を追加:

```typescript
// Health Lambda
new logs.LogGroup(this, 'HealthLogGroup', {
  logGroupName: `/aws/lambda/${props.lambdaFunctions.health.functionName}`,
  retention: logRetentionConfig.other,
  removalPolicy,
});

// Stats Lambda
new logs.LogGroup(this, 'StatsLogGroup', {
  logGroupName: `/aws/lambda/${props.lambdaFunctions.stats.functionName}`,
  retention: logRetentionConfig.other,
  removalPolicy,
});
```

### 4. 検証

#### TypeScriptビルド
```powershell
cd cdk && npm run build
```
**結果**: ✅ 成功（構文エラーなし）

#### CDK Synth
```powershell
npx cdk synth --quiet
```
**結果**: ⚠️ 既存の問題（DLQ Processorアセットパス）が検出されたが、今回の変更には影響なし

### 5. 問題と解決策

#### 問題1: CDK Synthエラー
- **エラー内容**: `Cannot find asset at C:\Users\ti198\dist\src\lambda\dlq-processor`
- **原因**: DLQ Processor Lambdaのビルド成果物が存在しない（既存の問題）
- **影響**: 今回のLogGroup追加には影響なし（TypeScriptビルドは成功）
- **対応**: 別タスクで対応が必要

## 成果物

### 変更ファイル
- `cdk/lib/stacks/monitoring-stack.ts`: Health/Stats FunctionのLogGroup定義を追加

### 追加されたLogGroup
1. **HealthLogGroup**
   - LogGroupName: `/aws/lambda/${health.functionName}`
   - Retention: 開発環境1週間、本番環境1ヶ月
   - RemovalPolicy: 開発環境DESTROY、本番環境RETAIN

2. **StatsLogGroup**
   - LogGroupName: `/aws/lambda/${stats.functionName}`
   - Retention: 開発環境1週間、本番環境1ヶ月
   - RemovalPolicy: 開発環境DESTROY、本番環境RETAIN

### 統一されたLogGroup管理
開発環境で管理されるLogGroup（9個）:
1. Collector
2. Query
3. Export
4. Collect
5. CollectStatus
6. ExportStatus
7. PdfDownload
8. **Health** ← 新規追加
9. **Stats** ← 新規追加

## 申し送り事項

### 完了事項
- ✅ Health/Stats FunctionのLogGroupをCDK管理下に追加
- ✅ 既存パターンに従った実装
- ✅ TypeScript構文エラーなし

### 未対応事項
- ⚠️ DLQ Processor Lambdaのアセットパス問題（別タスクで対応必要）

### 次のステップ
1. tasks.mdのタスク6を完了にマーク
2. Git commit: `[improve] LogGroup管理の統一`
3. 必要に応じてDLQ Processorのビルド問題を調査

## 作業時間
- 開始: 2026-02-22 14:53:30
- 完了: 2026-02-22 14:55:00
- 所要時間: 約2分

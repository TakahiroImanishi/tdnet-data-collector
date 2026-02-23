# 作業記録: タスク4 - ComputeStack修正（Step Functions Lambda）

**作成日時**: 2026-02-23 14:06:03  
**タスク**: タスク4 - ComputeStack修正（Step Functions Lambda）  
**担当**: Kiro AI Assistant

## 作業概要

`cdk/lib/stacks/compute-stack.ts`のStep Functions用Lambda 4関数の設定を`envConfig`から取得するように修正する。

## 実装内容

### 修正対象関数
1. CollectorInit関数
2. CollectorFetch関数
3. CollectorSave関数
4. CollectorAggregate関数

### 修正内容
各関数の`timeout`と`memorySize`を`envConfig`から取得するように変更:
```typescript
timeout: cdk.Duration.seconds(envConfig.collectorInit.timeout),
memorySize: envConfig.collectorInit.memorySize,
```

## 作業ログ

### 1. 現状確認


環境設定ファイルにStep Functions用Lambda関数の設定項目が存在しないことを確認。

### 2. 環境設定ファイル修正

`cdk/lib/config/environment-config.ts`に以下の設定を追加:

#### インターフェース追加
```typescript
/**
 * Collector Init Lambda configuration (Step Functions)
 */
collectorInit: LambdaEnvironmentConfig;

/**
 * Collector Fetch Lambda configuration (Step Functions)
 */
collectorFetch: LambdaEnvironmentConfig;

/**
 * Collector Save Lambda configuration (Step Functions)
 */
collectorSave: LambdaEnvironmentConfig;

/**
 * Collector Aggregate Lambda configuration (Step Functions)
 */
collectorAggregate: LambdaEnvironmentConfig;
```

#### Local環境設定
```typescript
collectorInit: {
  timeout: 30, // 30 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG',
},
collectorFetch: {
  timeout: 60, // 60 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG',
},
collectorSave: {
  timeout: 120, // 2 minutes
  memorySize: 512, // 512 MB
  logLevel: 'DEBUG',
},
collectorAggregate: {
  timeout: 30, // 30 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG',
},
```

#### Production環境設定
```typescript
collectorInit: {
  timeout: 30, // 30 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG', // デバッグログを有効化（調査用）
},
collectorFetch: {
  timeout: 60, // 60 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG', // デバッグログを有効化（調査用）
},
collectorSave: {
  timeout: 120, // 2 minutes
  memorySize: 512, // 512 MB
  logLevel: 'DEBUG', // デバッグログを有効化（調査用）
},
collectorAggregate: {
  timeout: 30, // 30 seconds
  memorySize: 256, // 256 MB
  logLevel: 'DEBUG', // デバッグログを有効化（調査用）
},
```

### 3. ComputeStack修正

`cdk/lib/stacks/compute-stack.ts`の4つのLambda関数を修正:

#### CollectorInit関数
```typescript
timeout: cdk.Duration.seconds(envConfig.collectorInit.timeout),
memorySize: envConfig.collectorInit.memorySize,
environment: {
  LOG_LEVEL: envConfig.collectorInit.logLevel,
  // ...
}
```

#### CollectorFetch関数
```typescript
timeout: cdk.Duration.seconds(envConfig.collectorFetch.timeout),
memorySize: envConfig.collectorFetch.memorySize,
environment: {
  LOG_LEVEL: envConfig.collectorFetch.logLevel,
  // ...
}
```

#### CollectorSave関数
```typescript
timeout: cdk.Duration.seconds(envConfig.collectorSave.timeout),
memorySize: envConfig.collectorSave.memorySize,
environment: {
  LOG_LEVEL: envConfig.collectorSave.logLevel,
  // ...
}
```

#### CollectorAggregate関数
```typescript
timeout: cdk.Duration.seconds(envConfig.collectorAggregate.timeout),
memorySize: envConfig.collectorAggregate.memorySize,
environment: {
  LOG_LEVEL: envConfig.collectorAggregate.logLevel,
  // ...
}
```

### 4. テスト修正

`cdk/lib/stacks/__tests__/compute-stack.test.ts`を修正:

**問題**: Collector Functionの環境変数テストが`EXECUTION_STATE_TABLE`を期待していたが、これはStep Functions用Lambda関数にのみ存在する。

**修正**: `EXECUTION_STATE_TABLE`を`DYNAMODB_EXECUTIONS_TABLE`に変更。

### 5. テスト実行

#### ユニットテスト
```bash
npm test -- cdk/lib/stacks/__tests__/compute-stack.test.ts
```

**結果**: ✅ 36テストすべて成功

#### CDK Synth
```bash
npx cdk synth --profile imanishi-awssso --output cdk.out.test
```

**結果**: ✅ 成功（警告のみ、エラーなし）

## 成果物

### 修正ファイル
1. `cdk/lib/config/environment-config.ts` - Step Functions用Lambda設定追加
2. `cdk/lib/stacks/compute-stack.ts` - 4関数の設定を`envConfig`から取得
3. `cdk/lib/stacks/__tests__/compute-stack.test.ts` - テスト修正

### 削除されたハードコード値
- CollectorInit: `timeout: 30`, `memorySize: 256`
- CollectorFetch: `timeout: 60`, `memorySize: 256`
- CollectorSave: `timeout: 120`, `memorySize: 512`
- CollectorAggregate: `timeout: 30`, `memorySize: 256`

## 完了条件確認

- [x] 4関数すべての設定が`envConfig`から取得されている
- [x] ハードコード値が削除されている
- [x] ユニットテストが成功する（36/36テスト成功）
- [x] CDK synthが成功する

## 申し送り事項

### 次のタスク
タスク5: FoundationStack修正（DynamoDBテーブル設定）を実行してください。

### 注意事項
- 環境設定ファイルに追加した設定値は、現在のハードコード値と同じ値を使用
- Local環境とProduction環境で同じ設定値を使用（必要に応じて調整可能）
- LOG_LEVELは各関数専用の設定を使用（`collectorInit.logLevel`等）

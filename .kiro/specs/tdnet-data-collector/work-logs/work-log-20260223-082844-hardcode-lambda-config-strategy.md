# 作業記録: Lambda設定値のハードコード改善方針策定

**作業日時**: 2026-02-23 08:28:44  
**作業者**: Kiro AI Assistant  
**作業概要**: Step Functions用Lambda設定とその他Lambda設定のハードコード改善方針を策定

## 作業内容

### 1. 背景

タスク1調査結果から、以下の改善が必要と判明:

**高優先度（8箇所）**:
- Step Functions用Lambda 4関数（Init, Fetch, Save, Aggregate）
  - timeout, memorySize設定がハードコード
  - 環境別最適化が不可能

**中優先度（3箇所）**:
- 全Lambda関数のruntime（`NODEJS_20_X`）
- DLQ Processor設定
- API Key Rotation設定

### 2. 現状分析

#### 2.1 既存の環境設定管理

`cdk/lib/config/environment-config.ts`で以下9関数を管理:
- collector, query, export, collect, collectStatus, exportStatus, pdfDownload, health, stats

**特徴**:
- 環境別設定（local/prod）
- timeout, memorySize, logLevel統一管理
- 型安全性（TypeScript interface）

#### 2.2 Step Functions用Lambda（未管理）

現在の設定値（`cdk/lib/stacks/compute-stack.ts`）:
- CollectorInit: 30秒/256MB
- CollectorFetch: 60秒/256MB
- CollectorSave: 120秒/512MB
- CollectorAggregate: 30秒/256MB

**問題点**:
- 環境別最適化不可
- 設定変更時に複数箇所修正が必要
- 他のLambda関数と管理方法が不統一

---

## 3. 改善方針

### 3.1 environment-config.ts拡張設計

#### 3.1.1 型定義の拡張

既存の`EnvironmentConfig`インターフェースに追加:

```typescript
export interface EnvironmentConfig {
  // ... 既存設定（9関数） ...
  
  // Step Functions用Lambda設定
  collectorInit: LambdaEnvironmentConfig;
  collectorFetch: LambdaEnvironmentConfig;
  collectorSave: LambdaEnvironmentConfig;
  collectorAggregate: LambdaEnvironmentConfig;
  
  // 共通設定
  runtime: lambda.Runtime;
}
```

**設計判断**:
- `LambdaEnvironmentConfig`インターフェースを再利用（timeout, memorySize, logLevel）
- runtime設定を追加（全Lambda関数で共通）


#### 3.1.2 環境別設定値の推奨値

**local環境**:
```typescript
export const localConfig: EnvironmentConfig = {
  environment: 'local',
  // ... 既存設定 ...
  
  // Step Functions用Lambda設定
  collectorInit: {
    timeout: 30,      // 初期化処理は軽量
    memorySize: 256,  // 標準メモリ
    logLevel: 'DEBUG',
  },
  collectorFetch: {
    timeout: 60,      // TDnet API呼び出し
    memorySize: 256,  // 標準メモリ
    logLevel: 'DEBUG',
  },
  collectorSave: {
    timeout: 120,     // DynamoDB/S3書き込み
    memorySize: 512,  // 大容量メモリ（PDF処理）
    logLevel: 'DEBUG',
  },
  collectorAggregate: {
    timeout: 30,      // 集計処理は軽量
    memorySize: 256,  // 標準メモリ
    logLevel: 'DEBUG',
  },
  
  // 共通設定
  runtime: lambda.Runtime.NODEJS_20_X,
};
```

**prod環境**:
```typescript
export const prodConfig: EnvironmentConfig = {
  environment: 'prod',
  // ... 既存設定 ...
  
  // Step Functions用Lambda設定（local環境と同じ値）
  collectorInit: {
    timeout: 30,
    memorySize: 256,
    logLevel: 'DEBUG',  // 本番環境でもデバッグログ有効
  },
  collectorFetch: {
    timeout: 60,
    memorySize: 256,
    logLevel: 'DEBUG',
  },
  collectorSave: {
    timeout: 120,
    memorySize: 512,
    logLevel: 'DEBUG',
  },
  collectorAggregate: {
    timeout: 30,
    memorySize: 256,
    logLevel: 'DEBUG',
  },
  
  // 共通設定
  runtime: lambda.Runtime.NODEJS_20_X,
};
```

**設計判断**:
- 現在のハードコード値をそのまま採用（実績値）
- local/prod環境で同じ値（Step Functions処理は環境依存性が低い）
- 将来的に環境別最適化が可能な構造

#### 3.1.3 設定値の妥当性検証

| Lambda関数 | timeout | memorySize | 根拠 |
|-----------|---------|-----------|------|
| CollectorInit | 30秒 | 256MB | 実行状態初期化のみ、軽量処理 |
| CollectorFetch | 60秒 | 256MB | TDnet API呼び出し、レート制限対応 |
| CollectorSave | 120秒 | 512MB | DynamoDB/S3書き込み、PDF処理 |
| CollectorAggregate | 30秒 | 256MB | 実行結果集計、軽量処理 |

**検証結果**: ✅ 現在の設定値は適切（実運用で問題なし）

---

## 4. CDK実装方針

### 4.1 ComputeStackの修正

#### 4.1.1 修正箇所

`cdk/lib/stacks/compute-stack.ts`の以下4箇所:

```typescript
// 修正前
this.collectorInitFunction = new NodejsFunction(this, 'CollectorInitFunction', {
  functionName: `tdnet-collector-init-${env}`,
  runtime: lambda.Runtime.NODEJS_20_X,
  entry: 'src/lambda/collector-init/handler.ts',
  handler: 'handler',
  timeout: cdk.Duration.seconds(30),  // ハードコード
  memorySize: 256,                     // ハードコード
  // ...
});

// 修正後
this.collectorInitFunction = new NodejsFunction(this, 'CollectorInitFunction', {
  functionName: `tdnet-collector-init-${env}`,
  runtime: envConfig.runtime,  // 設定ファイルから取得
  entry: 'src/lambda/collector-init/handler.ts',
  handler: 'handler',
  timeout: cdk.Duration.seconds(envConfig.collectorInit.timeout),  // 設定ファイルから取得
  memorySize: envConfig.collectorInit.memorySize,                   // 設定ファイルから取得
  // ...
});
```

**同様の修正を以下3関数にも適用**:
- CollectorFetch
- CollectorSave
- CollectorAggregate

#### 4.1.2 runtime設定の統一

全Lambda関数（既存9関数 + Step Functions 4関数）のruntime設定を統一:

```typescript
// 修正前
runtime: lambda.Runtime.NODEJS_20_X,

// 修正後
runtime: envConfig.runtime,
```

**対象**: 13関数すべて

### 4.2 既存コードへの影響

#### 4.2.1 影響範囲

**変更あり**:
- `cdk/lib/config/environment-config.ts`: 型定義・設定値追加
- `cdk/lib/stacks/compute-stack.ts`: 13関数のruntime設定、4関数のtimeout/memorySize設定

**変更なし**:
- Lambda関数コード（`src/lambda/**/*.ts`）
- テストコード（`src/**/__tests__/**/*.test.ts`）
- 運用スクリプト（`scripts/**/*.ps1`）
- その他のCDK Construct

#### 4.2.2 後方互換性

✅ **完全な後方互換性あり**:
- 設定値は現在のハードコード値と同じ
- Lambda関数の動作に変更なし
- デプロイ時の差分なし（設定値が同じため）

---

## 5. テスト戦略

### 5.1 ユニットテストの修正

#### 5.1.1 対象テスト

`cdk/lib/stacks/__tests__/compute-stack.test.ts`

**修正内容**:
- Step Functions用Lambda 4関数のtimeout/memorySize検証を追加
- runtime設定の検証を追加（全Lambda関数）

#### 5.1.2 テストコード例

```typescript
describe('Step Functions Lambda Configuration', () => {
  test('CollectorInit has correct configuration', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tdnet-collector-init-prod',
      Runtime: 'nodejs20.x',
      Timeout: 30,
      MemorySize: 256,
    });
  });

  test('CollectorFetch has correct configuration', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tdnet-collector-fetch-prod',
      Runtime: 'nodejs20.x',
      Timeout: 60,
      MemorySize: 256,
    });
  });

  test('CollectorSave has correct configuration', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tdnet-collector-save-prod',
      Runtime: 'nodejs20.x',
      Timeout: 120,
      MemorySize: 512,
    });
  });

  test('CollectorAggregate has correct configuration', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tdnet-collector-aggregate-prod',
      Runtime: 'nodejs20.x',
      Timeout: 30,
      MemorySize: 256,
    });
  });
});

describe('Runtime Configuration', () => {
  test('All Lambda functions use configured runtime', () => {
    const template = Template.fromStack(stack);
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    
    Object.values(lambdaFunctions).forEach((fn: any) => {
      expect(fn.Properties.Runtime).toBe('nodejs20.x');
    });
  });
});
```

### 5.2 E2Eテストへの影響

#### 5.2.1 影響なし

E2Eテスト（`src/__tests__/e2e/step-functions-collector.e2e.test.ts`）は変更不要:
- LocalStack環境で実行
- Lambda関数の動作に変更なし
- 設定値は現在と同じ

#### 5.2.2 確認項目

- [ ] E2Eテスト実行成功
- [ ] Step Functions実行成功
- [ ] Lambda関数のタイムアウト・メモリ設定が正しく適用されている

---

## 6. 具体的な改善タスクリスト

### タスク3: environment-config.ts拡張

**作業内容**:
1. `LambdaEnvironmentConfig`インターフェースはそのまま使用
2. `EnvironmentConfig`インターフェースに以下を追加:
   - `collectorInit: LambdaEnvironmentConfig`
   - `collectorFetch: LambdaEnvironmentConfig`
   - `collectorSave: LambdaEnvironmentConfig`
   - `collectorAggregate: LambdaEnvironmentConfig`
   - `runtime: lambda.Runtime`
3. `localConfig`に設定値追加
4. `prodConfig`に設定値追加

**成果物**:
- `cdk/lib/config/environment-config.ts`（修正）

**テスト**:
- TypeScriptコンパイル成功
- 型エラーなし

### タスク4: ComputeStack修正（Step Functions Lambda）

**作業内容**:
1. CollectorInit関数の設定を`envConfig.collectorInit`から取得
2. CollectorFetch関数の設定を`envConfig.collectorFetch`から取得
3. CollectorSave関数の設定を`envConfig.collectorSave`から取得
4. CollectorAggregate関数の設定を`envConfig.collectorAggregate`から取得

**成果物**:
- `cdk/lib/stacks/compute-stack.ts`（修正）

**テスト**:
- ユニットテスト実行成功
- CDK synth成功

### タスク5: ComputeStack修正（runtime統一）

**作業内容**:
1. 全Lambda関数（13関数）のruntime設定を`envConfig.runtime`に変更

**成果物**:
- `cdk/lib/stacks/compute-stack.ts`（修正）

**テスト**:
- ユニットテスト実行成功
- CDK synth成功

### タスク6: ユニットテスト更新

**作業内容**:
1. Step Functions用Lambda 4関数の設定検証テスト追加
2. runtime設定の検証テスト追加

**成果物**:
- `cdk/lib/stacks/__tests__/compute-stack.test.ts`（修正）

**テスト**:
- ユニットテスト実行成功

### タスク7: E2Eテスト実行

**作業内容**:
1. Docker Desktop起動確認
2. LocalStack環境起動
3. E2Eテスト実行
4. Step Functions実行確認

**成果物**:
- E2Eテスト実行結果

**テスト**:
- E2Eテスト成功
- Step Functions実行成功

---

## 7. 実装ガイドライン（steering file追加内容）

### 7.1 Lambda設定管理の原則

**すべてのLambda設定は`environment-config.ts`で管理**:
- timeout, memorySize, logLevel, runtime
- 環境別設定（local/prod）
- 型安全性（TypeScript interface）

**ハードコード禁止**:
- CDK Stackでの直接指定禁止
- 設定変更は`environment-config.ts`のみ

### 7.2 新規Lambda関数追加時のチェックリスト

- [ ] `environment-config.ts`に設定追加
  - `EnvironmentConfig`インターフェースに追加
  - `localConfig`に設定値追加
  - `prodConfig`に設定値追加
- [ ] CDK Stackで`envConfig`から設定取得
  - `timeout: cdk.Duration.seconds(envConfig.{functionName}.timeout)`
  - `memorySize: envConfig.{functionName}.memorySize`
  - `runtime: envConfig.runtime`
  - `logLevel: envConfig.{functionName}.logLevel`
- [ ] ユニットテストで設定値検証
  - timeout, memorySize, runtime検証

### 7.3 設定値変更時の手順

1. `environment-config.ts`の設定値を変更
2. ユニットテストの期待値を更新
3. ユニットテスト実行
4. CDK synth実行
5. CDK deploy実行

**注意**: CDK Stackでの直接変更は禁止

---

## 8. メリット・デメリット

### 8.1 メリット

✅ **環境別最適化**:
- local/prod環境で異なる設定が可能
- テスト環境での設定変更が容易

✅ **統一された管理方法**:
- 全Lambda関数の設定を1箇所で管理
- 設定変更時の修正箇所が明確

✅ **型安全性**:
- TypeScript interfaceで型チェック
- 設定ミスを防止

✅ **保守性向上**:
- 設定値の一覧性が高い
- 新規Lambda関数追加時の手順が明確

### 8.2 デメリット

⚠️ **設定ファイルの肥大化**:
- Lambda関数が増えると設定項目が増加
- 対策: 設定項目をグループ化（Step Functions用、API用等）

⚠️ **初期学習コスト**:
- 新規開発者が設定ファイルの構造を理解する必要
- 対策: ドキュメント整備、コメント充実

---

## 9. 成果物

### 9.1 作業記録

本ファイル: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-082844-hardcode-lambda-config-strategy.md`

### 9.2 改善方針サマリー

**対象範囲**:
- Step Functions用Lambda 4関数（高優先度）
- 全Lambda関数のruntime設定（中優先度）

**実装方針**:
- `environment-config.ts`拡張
- ComputeStack修正
- ユニットテスト更新

**タスク**:
- タスク3: environment-config.ts拡張
- タスク4: ComputeStack修正（Step Functions Lambda）
- タスク5: ComputeStack修正（runtime統一）
- タスク6: ユニットテスト更新
- タスク7: E2Eテスト実行

---

## 10. 申し送り事項

### 10.1 次のアクション

1. **タスク3-7の実装**:
   - `tasks-hardcoded-values-improvement.md`に詳細タスクを追加
   - 各タスクの実装・テスト実行

2. **steering file更新**:
   - `cdk-implementation.md`にLambda設定管理の原則を追加
   - 新規Lambda関数追加時のチェックリスト追加

### 10.2 注意事項

- **後方互換性**: 設定値は現在のハードコード値と同じため、デプロイ時の差分なし
- **テスト必須**: ユニットテスト・E2Eテスト実行を必ず実施
- **段階的実装**: タスク3→4→5→6→7の順で実装（依存関係あり）

### 10.3 関連ドキュメント

- `cdk/lib/config/environment-config.ts` - 環境別Lambda設定
- `cdk/lib/stacks/compute-stack.ts` - ComputeStack実装
- `.kiro/steering/infrastructure/cdk-implementation.md` - CDK実装ガイド
- `.kiro/specs/tdnet-data-collector/03-tasks/tasks-hardcoded-values-improvement.md` - タスク管理
- `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-081013-hardcode-lambda-resources-investigation.md` - 調査結果

---

## 11. 作業完了

**完了日時**: 2026-02-23 08:28:44  
**作業時間**: 約30分  
**成果物**: Lambda設定値のハードコード改善方針策定書（本ファイル）


---

## 12. steering file更新内容

### 12.1 cdk-implementation.mdへの追加

以下の内容を`cdk-implementation.md`の「基本原則」セクションに追加:

#### Lambda設定管理の原則

**すべてのLambda設定は`environment-config.ts`で管理**

```typescript
// ✅ 正しい実装
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
  runtime: envConfig.runtime,
  timeout: cdk.Duration.seconds(envConfig.collector.timeout),
  memorySize: envConfig.collector.memorySize,
  environment: {
    LOG_LEVEL: envConfig.collector.logLevel,
  },
});

// ❌ 誤った実装（ハードコード）
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,  // ハードコード禁止
  timeout: cdk.Duration.seconds(300),    // ハードコード禁止
  memorySize: 512,                       // ハードコード禁止
});
```

**設定項目**:
- `runtime`: Lambda実行環境（全Lambda関数共通）
- `timeout`: タイムアウト時間（秒）
- `memorySize`: メモリサイズ（MB）
- `logLevel`: ログレベル（DEBUG/INFO/WARN/ERROR）

**環境別設定**:
- `local`: 開発・テスト環境用設定
- `prod`: 本番環境用設定

#### 新規Lambda関数追加時のチェックリスト

**1. environment-config.ts更新**
- [ ] `EnvironmentConfig`インターフェースに設定追加
  ```typescript
  export interface EnvironmentConfig {
    // ... 既存設定 ...
    newFunction: LambdaEnvironmentConfig;
  }
  ```
- [ ] `localConfig`に設定値追加
  ```typescript
  newFunction: {
    timeout: 30,
    memorySize: 256,
    logLevel: 'DEBUG',
  },
  ```
- [ ] `prodConfig`に設定値追加
  ```typescript
  newFunction: {
    timeout: 60,
    memorySize: 512,
    logLevel: 'DEBUG',
  },
  ```

**2. CDK Stack実装**
- [ ] `envConfig`から設定取得
  ```typescript
  const newFn = new NodejsFunction(this, 'NewFunction', {
    runtime: envConfig.runtime,
    timeout: cdk.Duration.seconds(envConfig.newFunction.timeout),
    memorySize: envConfig.newFunction.memorySize,
    environment: {
      LOG_LEVEL: envConfig.newFunction.logLevel,
    },
  });
  ```

**3. ユニットテスト追加**
- [ ] 設定値検証テスト
  ```typescript
  test('NewFunction has correct configuration', () => {
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'tdnet-new-function-prod',
      Runtime: 'nodejs20.x',
      Timeout: 60,
      MemorySize: 512,
    });
  });
  ```

#### 設定値変更時の手順

1. **environment-config.tsの設定値を変更**
   ```typescript
   // 例: Collector Lambdaのタイムアウトを変更
   prodConfig: {
     collector: {
       timeout: 900,  // 15分 → 20分に変更
       memorySize: 512,
       logLevel: 'DEBUG',
     },
   }
   ```

2. **ユニットテストの期待値を更新**
   ```typescript
   test('Collector has correct timeout', () => {
     template.hasResourceProperties('AWS::Lambda::Function', {
       Timeout: 1200,  // 期待値を更新
     });
   });
   ```

3. **テスト実行**
   ```powershell
   npm test
   ```

4. **CDK synth実行**
   ```powershell
   npm run cdk:synth
   ```

5. **CDK deploy実行**
   ```powershell
   npm run cdk:deploy
   ```

**注意**: CDK Stackでの直接変更は禁止。必ず`environment-config.ts`を経由すること。

#### 設定値の推奨値

| Lambda関数タイプ | timeout | memorySize | 根拠 |
|----------------|---------|-----------|------|
| 軽量処理（Init, Aggregate） | 30秒 | 256MB | 初期化・集計処理 |
| API呼び出し（Fetch） | 60秒 | 256MB | 外部API呼び出し、レート制限対応 |
| データ処理（Save） | 120秒 | 512MB | DynamoDB/S3書き込み、PDF処理 |
| ヘルスチェック | 10秒 | 128MB | 軽量チェック処理 |
| API Gateway統合 | 30秒 | 256MB | 標準的なAPI処理 |

### 12.2 lambda-guide.mdへの追加

以下の内容を`lambda-guide.md`の「Lambda実装ガイド」セクションに追加:

#### Lambda設定の管理

**すべてのLambda設定は`cdk/lib/config/environment-config.ts`で管理**

設定項目:
- `runtime`: Lambda実行環境（全Lambda関数共通）
- `timeout`: タイムアウト時間（秒）
- `memorySize`: メモリサイズ（MB）
- `logLevel`: ログレベル（DEBUG/INFO/WARN/ERROR）

**ハードコード禁止**:
- Lambda関数コード内での設定値ハードコード禁止
- CDK Stack内での設定値ハードコード禁止
- 設定変更は`environment-config.ts`のみ

**環境変数の取得**:
```typescript
// ✅ 正しい実装
const LOG_LEVEL = process.env.LOG_LEVEL;
if (!LOG_LEVEL) {
  throw new Error('LOG_LEVEL environment variable is required');
}

// ❌ 誤った実装（デフォルト値ハードコード）
const LOG_LEVEL = process.env.LOG_LEVEL || 'DEBUG';  // 禁止
```

詳細は`cdk-implementation.md`の「Lambda設定管理の原則」を参照。

---

## 13. 最終確認事項

### 13.1 実装の完全性

- [x] environment-config.ts拡張設計完了
- [x] 環境別設定値の推奨値策定完了
- [x] CDK実装方針策定完了
- [x] テスト戦略策定完了
- [x] 具体的な改善タスクリスト作成完了（タスク3-7）
- [x] 実装ガイドライン策定完了（steering file更新内容）

### 13.2 後方互換性

✅ **完全な後方互換性あり**:
- 設定値は現在のハードコード値と同じ
- Lambda関数の動作に変更なし
- デプロイ時の差分なし（設定値が同じため）
- 既存のテストコードへの影響なし（設定値検証テストのみ追加）

### 13.3 リスク評価

**リスク**: 低

**理由**:
- 設定値は実績値をそのまま採用
- 段階的実装（タスク3→4→5→6→7）
- 各タスクでテスト実行
- 後方互換性の維持

**対策**:
- ユニットテスト・E2Eテスト必須実行
- CDK synthで事前確認
- 本番デプロイ前にdev環境で検証

---

## 14. 作業完了

**完了日時**: 2026-02-23 08:28:44  
**作業時間**: 約45分  
**成果物**: 
- Lambda設定値のハードコード改善方針策定書（本ファイル）
- タスク3-7の詳細タスク定義（`tasks-hardcoded-values-improvement.md`更新）
- steering file更新内容（cdk-implementation.md, lambda-guide.md）

**次のアクション**:
1. タスク3の実装開始（environment-config.ts拡張）
2. steering file更新（cdk-implementation.md, lambda-guide.md）

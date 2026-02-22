# 作業記録: AWSリージョン・プロファイルのハードコード改善方針策定

**作業日時**: 2026-02-23 08:28:38  
**作業者**: Kiro AI Assistant  
**関連タスク**: tasks-hardcoded-values-improvement.md タスク2

## 作業概要

タスク1の調査結果を基に、AWSリージョン（15箇所）とAWSプロファイル（30箇所）のハードコード改善方針を策定しました。設定ファイル化、環境変数化、CDK実装、運用スクリプト改善の4つの観点から具体的な実装方針を提示します。

## 改善方針サマリー

### 優先順位

| 優先度 | 対象 | 箇所数 | 影響範囲 | 実装タスク |
|-------|------|--------|---------|-----------|
| **高** | Lambda関数のリージョン指定 | 15箇所 | 本番環境 | タスク3 |
| **中** | 運用スクリプトのプロファイル指定 | 30箇所 | 運用効率 | タスク4 |
| **低** | テストコードのリージョン指定 | 70箇所以上 | テスト環境のみ | タスク5（オプション） |

### 基本方針

1. **Lambda関数**: 環境変数`AWS_REGION`を必須化、CDKで自動設定
2. **運用スクリプト**: 環境変数`AWS_PROFILE`を優先使用、デフォルト値は`default`に変更
3. **テストコード**: 現状維持（変更不要）


---

## 1. 設定ファイル化の設計

### 1.1 設定ファイル構造

**ファイル**: `config/aws-config.ts`

```typescript
/**
 * AWS設定
 * 
 * AWSリージョンとプロファイルの設定を一元管理します。
 * 環境変数を優先し、未設定時はエラーとします。
 * 
 * 関連ドキュメント:
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/infrastructure/environment-variables.md
 */

/**
 * AWSリージョン
 * 
 * 環境変数AWS_REGIONから取得します。
 * 未設定時はエラーとします（デフォルト値なし）。
 * 
 * @throws Error AWS_REGION環境変数が未設定の場合
 */
export const AWS_REGION = getRequiredEnv('AWS_REGION');

/**
 * AWSプロファイル（運用スクリプト用）
 * 
 * 環境変数AWS_PROFILEから取得します。
 * 未設定時は'default'を使用します。
 */
export const AWS_PROFILE = process.env.AWS_PROFILE || 'default';

/**
 * 必須環境変数を取得
 * 
 * @param name 環境変数名
 * @returns 環境変数の値
 * @throws Error 環境変数が未設定の場合
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。` +
      `CDKデプロイ時に自動設定されます。ローカル実行時は .env ファイルで設定してください。`
    );
  }
  return value;
}

/**
 * オプション環境変数を取得
 * 
 * @param name 環境変数名
 * @param defaultValue デフォルト値
 * @returns 環境変数の値またはデフォルト値
 */
function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}
```

### 1.2 型定義

```typescript
/**
 * AWS設定型定義
 */
export interface AwsConfig {
  /** AWSリージョン（例: ap-northeast-1） */
  region: string;
  
  /** AWSプロファイル（例: default, imanishi-awssso） */
  profile: string;
}

/**
 * AWS設定を取得
 * 
 * @returns AWS設定
 */
export function getAwsConfig(): AwsConfig {
  return {
    region: AWS_REGION,
    profile: AWS_PROFILE,
  };
}
```

### 1.3 使用例

```typescript
// Lambda関数内
import { AWS_REGION } from '../../config/aws-config';

const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});

// 運用スクリプト内（TypeScript）
import { AWS_PROFILE } from './config/aws-config';

const profile = AWS_PROFILE;
console.log(`Using AWS profile: ${profile}`);
```


---

## 2. 環境変数化の設計

### 2.1 環境変数一覧

| 環境変数 | 必須/オプション | デフォルト値 | 設定場所 | 用途 |
|---------|---------------|-------------|---------|------|
| `AWS_REGION` | **必須** | なし | CDK（Lambda環境変数） | Lambda関数のリージョン指定 |
| `AWS_PROFILE` | オプション | `default` | ユーザー環境変数 | 運用スクリプトのプロファイル指定 |

### 2.2 環境変数設定方法

#### Lambda関数（CDKで自動設定）

CDKスタックで`AWS_REGION`環境変数を自動設定します。

```typescript
// cdk/lib/stacks/compute-stack.ts
const lambdaFunction = new NodejsFunction(this, 'Function', {
  // ...
  environment: {
    AWS_REGION: Stack.of(this).region, // CDKスタックのリージョンを自動設定
    DYNAMODB_TABLE: props.disclosuresTable.tableName,
    S3_BUCKET: props.pdfsBucket.bucketName,
    // ...
  },
});
```

#### 運用スクリプト（ユーザー環境変数）

PowerShellで環境変数を設定します。

```powershell
# 一時的に設定（現在のセッションのみ）
$env:AWS_PROFILE = "imanishi-awssso"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("AWS_PROFILE", "imanishi-awssso", "User")

# 確認
echo $env:AWS_PROFILE
```

### 2.3 .env.exampleの更新

```env
# AWS設定
# Lambda関数: CDKで自動設定されるため、ローカル実行時のみ必要
AWS_REGION=ap-northeast-1

# 運用スクリプト: オプション（未設定時は'default'を使用）
AWS_PROFILE=imanishi-awssso

# TDnet API設定
TDNET_BASE_URL=https://www.release.tdnet.info/inbs

# ログレベル
LOG_LEVEL=info

# 環境名
ENVIRONMENT=dev
```

### 2.4 環境変数検証

Lambda関数起動時に環境変数を検証します。

```typescript
// src/utils/env-validator.ts
/**
 * 必須環境変数を検証
 * 
 * @param requiredEnvVars 必須環境変数のリスト
 * @throws Error 環境変数が未設定の場合
 */
export function validateRequiredEnvVars(requiredEnvVars: string[]): void {
  const missing: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `必須環境変数が設定されていません: ${missing.join(', ')}\n` +
      `CDKデプロイ時に自動設定されます。ローカル実行時は .env ファイルで設定してください。`
    );
  }
}

// Lambda関数内で使用
import { validateRequiredEnvVars } from '../../utils/env-validator';

// ハンドラーの先頭で検証
validateRequiredEnvVars(['AWS_REGION', 'DYNAMODB_TABLE', 'S3_BUCKET']);
```


---

## 3. CDK実装方針

### 3.1 Lambda関数への環境変数設定

**現状**: 環境変数`AWS_REGION`が未設定のため、Lambda関数内でフォールバック値`'ap-northeast-1'`を使用

**問題点**:
- 他のリージョンでデプロイする場合、コード変更が必要
- マルチリージョン展開時に柔軟性がない
- 環境変数が未設定でもエラーにならない

**改善方針**:
1. CDKスタックで`AWS_REGION`環境変数を自動設定
2. Lambda関数内のフォールバック値を削除
3. 環境変数未設定時はエラーとする

### 3.2 CDK実装例

#### 既存のCompute Stack修正

```typescript
// cdk/lib/stacks/compute-stack.ts
export class TdnetComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TdnetComputeStackProps) {
    super(scope, id, props);

    // 共通環境変数を定義
    const commonEnvironment = {
      AWS_REGION: this.region, // CDKスタックのリージョンを自動設定
      ENVIRONMENT: props.environment,
      LOG_LEVEL: envConfig.collector.logLevel,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // Collector Function
    this.collectorFunction = new NodejsFunction(this, 'CollectorFunction', {
      functionName: `tdnet-collector-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/collector/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.collector.timeout),
      memorySize: envConfig.collector.memorySize,
      environment: {
        ...commonEnvironment, // 共通環境変数を展開
        DYNAMODB_TABLE: props.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        S3_BUCKET: props.pdfsBucket.bucketName,
        TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
      },
      // ...
    });

    // Query Function
    this.queryFunction = new NodejsFunction(this, 'QueryFunction', {
      functionName: `tdnet-query-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/query/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.query.timeout),
      memorySize: envConfig.query.memorySize,
      environment: {
        ...commonEnvironment, // 共通環境変数を展開
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
      },
      // ...
    });

    // 他のLambda関数も同様に修正
  }
}
```

### 3.3 環境変数検証ロジック

Lambda関数内で環境変数を検証します。

```typescript
// src/utils/env-validator.ts
/**
 * 必須環境変数を検証
 * 
 * Lambda関数起動時に呼び出し、必須環境変数が設定されているか確認します。
 * 未設定の場合はエラーをスローし、Lambda関数を起動しません。
 * 
 * @param requiredEnvVars 必須環境変数のリスト
 * @throws Error 環境変数が未設定の場合
 * 
 * @example
 * ```typescript
 * // Lambda関数のハンドラー先頭で呼び出し
 * validateRequiredEnvVars(['AWS_REGION', 'DYNAMODB_TABLE', 'S3_BUCKET']);
 * ```
 */
export function validateRequiredEnvVars(requiredEnvVars: string[]): void {
  const missing: string[] = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `必須環境変数が設定されていません: ${missing.join(', ')}\n` +
      `CDKデプロイ時に自動設定されます。ローカル実行時は .env ファイルで設定してください。`
    );
  }
}
```

### 3.4 Lambda関数内の修正例

#### 修正前（フォールバック値あり）

```typescript
// src/utils/secrets-manager.ts
const secretsManagerClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-northeast-1', // フォールバック値
  maxAttempts: 3,
  retryMode: 'adaptive',
});
```

#### 修正後（環境変数必須化）

```typescript
// src/utils/secrets-manager.ts
import { AWS_REGION } from '../../config/aws-config';

const secretsManagerClient = new SecretsManagerClient({
  region: AWS_REGION, // 環境変数から取得（未設定時はエラー）
  maxAttempts: 3,
  retryMode: 'adaptive',
});
```

### 3.5 デフォルト値削除の影響分析

| ファイル | 現状 | 修正後 | 影響 |
|---------|------|--------|------|
| `src/utils/secrets-manager.ts` | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | `AWS_REGION` | CDKで環境変数設定済みのため影響なし |
| `src/utils/batch-write.ts` | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | `AWS_REGION` | CDKで環境変数設定済みのため影響なし |
| `src/lambda/*/handler.ts` | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | `AWS_REGION` | CDKで環境変数設定済みのため影響なし |

**結論**: CDKで環境変数を設定するため、デフォルト値削除による影響はありません。


---

## 4. 運用スクリプト改善方針

### 4.1 現状分析

**現状**: 運用スクリプトのデフォルトプロファイルが`"imanishi-awssso"`にハードコード

**問題点**:
- 他のユーザーや環境で使用する場合、スクリプト修正が必要
- プロファイル名変更時に複数ファイルの修正が必要
- 汎用性が低い

**対象スクリプト**:
- `scripts/startup.ps1`
- `scripts/manual-data-collection.ps1`
- `scripts/check-lambda-998-limit.ps1`
- `scripts/deploy.ps1`
- `scripts/deploy-prod.ps1`
- `scripts/lib/get-stack-outputs.ps1`
- `scripts/check-step-functions-execution.ps1`
- `scripts/fetch-data-range.ps1`

### 4.2 改善方針

1. **環境変数`AWS_PROFILE`を優先使用**
2. **デフォルト値を`"default"`に変更**（汎用性向上）
3. **`get-stack-outputs.ps1`の拡張**（環境変数取得機能追加）

### 4.3 実装例

#### 修正前（ハードコード）

```powershell
# scripts/manual-data-collection.ps1
param(
    [Parameter(Mandatory=$false)]
    [string]$Profile = "imanishi-awssso" # ハードコード
)
```

#### 修正後（環境変数優先）

```powershell
# scripts/manual-data-collection.ps1
param(
    [Parameter(Mandatory=$false)]
    [string]$Profile = $env:AWS_PROFILE ?? "default" # 環境変数を優先、未設定時はdefault
)

# スクリプト先頭で使用プロファイルを表示
Write-Host "使用するAWSプロファイル: $Profile" -ForegroundColor Cyan
```

### 4.4 get-stack-outputs.ps1の拡張

既存の`get-stack-outputs.ps1`は環境変数取得機能を持っていないため、拡張します。

```powershell
# scripts/lib/get-stack-outputs.ps1

<#
.SYNOPSIS
CDK Stackから環境情報を取得

.PARAMETER Environment
環境名（dev または prod）

.PARAMETER Profile
AWS CLIプロファイル名（オプション、環境変数AWS_PROFILEを優先）

.PARAMETER Region
AWSリージョン（オプション、デフォルト: ap-northeast-1）

.EXAMPLE
$outputs = Get-StackOutputs -Environment prod
$apiEndpoint = $outputs.ApiEndpoint
#>
function Get-StackOutputs {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet("dev", "prod")]
        [string]$Environment,
        
        [Parameter(Mandatory=$false)]
        [string]$Profile = $env:AWS_PROFILE ?? "default", # 環境変数を優先
        
        [Parameter(Mandatory=$false)]
        [string]$Region = "ap-northeast-1",
        
        [Parameter(Mandatory=$false)]
        [switch]$NoCache
    )
    
    # プロファイル情報をログ出力
    Write-Verbose "使用するAWSプロファイル: $Profile"
    
    # 既存の実装...
}
```

### 4.5 既存スクリプトへの影響

| スクリプト | 修正内容 | 影響 |
|-----------|---------|------|
| `scripts/startup.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/manual-data-collection.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/check-lambda-998-limit.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/deploy.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/deploy-prod.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/lib/get-stack-outputs.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/check-step-functions-execution.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |
| `scripts/fetch-data-range.ps1` | デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更 | 環境変数未設定時は`default`を使用 |

**後方互換性**: 環境変数`AWS_PROFILE`を設定することで、既存の動作を維持できます。

```powershell
# 既存の動作を維持（環境変数設定）
$env:AWS_PROFILE = "imanishi-awssso"

# または、スクリプト実行時に明示的に指定
.\scripts\manual-data-collection.ps1 -Profile "imanishi-awssso"
```

### 4.6 ドキュメント更新

#### README.md更新内容

```markdown
## AWS認証設定

### プロファイル設定

運用スクリプトは環境変数`AWS_PROFILE`を優先的に使用します。

```powershell
# 一時的に設定（現在のセッションのみ）
$env:AWS_PROFILE = "imanishi-awssso"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("AWS_PROFILE", "imanishi-awssso", "User")

# 確認
echo $env:AWS_PROFILE
```

環境変数が未設定の場合、デフォルトプロファイル`default`を使用します。

### スクリプト実行時の指定

```powershell
# 環境変数を使用
$env:AWS_PROFILE = "imanishi-awssso"
.\scripts\manual-data-collection.ps1

# または、パラメータで明示的に指定
.\scripts\manual-data-collection.ps1 -Profile "imanishi-awssso"
```
```


---

## 5. 具体的な改善タスクリスト

### タスク3: Lambda関数のリージョン指定を環境変数化（高優先度）

#### タスク3.1: 設定ファイル作成

- [ ] `config/aws-config.ts`を作成
  - `AWS_REGION`の取得と検証
  - `getRequiredEnv`関数の実装
  - 型定義（`AwsConfig`）
  - JSDocコメント追加

#### タスク3.2: 環境変数検証ユーティリティ作成

- [ ] `src/utils/env-validator.ts`を作成
  - `validateRequiredEnvVars`関数の実装
  - エラーメッセージの日本語化
  - ユニットテスト作成

#### タスク3.3: CDKスタックの修正

- [ ] `cdk/lib/stacks/compute-stack.ts`を修正
  - 共通環境変数`commonEnvironment`の定義
  - すべてのLambda関数に`AWS_REGION`環境変数を設定
  - 既存の環境変数設定を`commonEnvironment`に統合

#### タスク3.4: Lambda関数内のフォールバック値削除

- [ ] `src/utils/secrets-manager.ts`を修正
  - `process.env.AWS_REGION || 'ap-northeast-1'` → `AWS_REGION`
  - `config/aws-config.ts`をインポート
- [ ] `src/utils/batch-write.ts`を修正
  - `process.env.AWS_REGION || 'ap-northeast-1'` → `AWS_REGION`
  - `config/aws-config.ts`をインポート
- [ ] `src/lambda/query/query-disclosures.ts`を修正
- [ ] `src/lambda/query/generate-presigned-url.ts`を修正
- [ ] `src/lambda/stats/handler.ts`を修正
- [ ] `src/lambda/health/handler.ts`を修正
- [ ] `src/lambda/get-disclosure/handler.ts`を修正
- [ ] `src/lambda/export/create-export-job.ts`を修正
- [ ] `src/lambda/export/update-export-status.ts`を修正
- [ ] `src/lambda/dlq-processor/index.ts`を修正

#### タスク3.5: ユニットテスト修正

- [ ] `src/utils/__tests__/secrets-manager.test.ts`を修正
  - 環境変数`AWS_REGION`のモック設定
  - 環境変数未設定時のエラーテスト追加
- [ ] `src/utils/__tests__/batch-write.test.ts`を修正（存在する場合）

#### タスク3.6: .env.exampleの更新

- [ ] `.env.example`を更新
  - `AWS_REGION`の説明追加
  - `AWS_PROFILE`の説明追加

#### タスク3.7: テスト実行

- [ ] ユニットテスト実行: `npm run test`
- [ ] E2Eテスト実行: `npm run test:e2e`
- [ ] CDKデプロイテスト: `npm run deploy:dev`
- [ ] Lambda関数の動作確認

---

### タスク4: 運用スクリプトのプロファイル指定を環境変数化（中優先度）

#### タスク4.1: get-stack-outputs.ps1の拡張

- [ ] `scripts/lib/get-stack-outputs.ps1`を修正
  - デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更
  - プロファイル情報のログ出力追加
  - コメント更新

#### タスク4.2: 運用スクリプトの修正

- [ ] `scripts/startup.ps1`を修正
  - デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更
- [ ] `scripts/manual-data-collection.ps1`を修正
  - デフォルト値を`$env:AWS_PROFILE ?? "default"`に変更
  - 使用プロファイルの表示追加
- [ ] `scripts/check-lambda-998-limit.ps1`を修正
- [ ] `scripts/deploy.ps1`を修正
- [ ] `scripts/deploy-prod.ps1`を修正
- [ ] `scripts/check-step-functions-execution.ps1`を修正
- [ ] `scripts/fetch-data-range.ps1`を修正

#### タスク4.3: ドキュメント更新

- [ ] `README.md`を更新
  - AWS認証設定セクションの追加
  - プロファイル設定方法の説明
  - 環境変数設定例の追加
- [ ] `.kiro/steering/core/tdnet-implementation-rules.md`を更新
  - プロファイル設定方法の更新
  - 環境変数優先の説明追加
- [ ] `.kiro/steering/development/scripts-guide.md`を更新
  - 環境変数設定方法の追加

#### タスク4.4: テスト実行

- [ ] 環境変数未設定時の動作確認（デフォルト`default`を使用）
- [ ] 環境変数設定時の動作確認（指定プロファイルを使用）
- [ ] パラメータ指定時の動作確認（パラメータ優先）

---

### タスク5: テストコードのリージョン指定を環境変数化（低優先度、オプション）

**注意**: テストコードは固定値で問題ないため、このタスクはオプションです。

#### タスク5.1: E2Eテストの修正

- [ ] `src/__tests__/e2e/step-functions-collector.e2e.test.ts`を修正
  - `'ap-northeast-1'` → `process.env.AWS_REGION || 'ap-northeast-1'`

#### タスク5.2: ロードテストの修正

- [ ] `src/__tests__/load/load-test.test.ts`を修正
  - `process.env.AWS_REGION || 'us-east-1'` → `process.env.AWS_REGION || 'ap-northeast-1'`

---

### タスク6: ドキュメント整備（低優先度）

#### タスク6.1: Steering File更新

- [ ] `.kiro/steering/core/tdnet-implementation-rules.md`を更新
  - 環境変数設定方法の追加
  - プロファイル設定方法の更新
- [ ] `.kiro/steering/infrastructure/environment-variables.md`を更新
  - `AWS_REGION`の説明追加
  - `AWS_PROFILE`の説明追加

#### タスク6.2: 作業記録の整理

- [ ] 本作業記録を完成させる
- [ ] タスク1の調査結果と統合
- [ ] 改善記録の作成（必要に応じて）


---

## 6. 実装ガイドライン（Steering File追加内容）

### 6.1 AWS設定管理ガイドライン

**ファイル**: `.kiro/steering/infrastructure/aws-config-management.md`（新規作成）

```markdown
# AWS設定管理ガイドライン

## 基本原則

1. **環境変数必須化**: AWSリージョンは環境変数`AWS_REGION`から取得し、未設定時はエラー
2. **ハードコード禁止**: リージョンやプロファイルをコード内にハードコードしない
3. **CDK自動設定**: Lambda関数の環境変数はCDKで自動設定
4. **環境変数優先**: 運用スクリプトは環境変数`AWS_PROFILE`を優先使用

## Lambda関数

### 環境変数取得

```typescript
// config/aws-config.ts
export const AWS_REGION = getRequiredEnv('AWS_REGION');

// Lambda関数内
import { AWS_REGION } from '../../config/aws-config';

const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});
```

### CDK設定

```typescript
// cdk/lib/stacks/compute-stack.ts
const commonEnvironment = {
  AWS_REGION: this.region, // CDKスタックのリージョンを自動設定
  ENVIRONMENT: props.environment,
  LOG_LEVEL: envConfig.collector.logLevel,
  NODE_OPTIONS: '--enable-source-maps',
};

const lambdaFunction = new NodejsFunction(this, 'Function', {
  environment: {
    ...commonEnvironment,
    DYNAMODB_TABLE: props.disclosuresTable.tableName,
    // ...
  },
});
```

## 運用スクリプト

### プロファイル取得

```powershell
# scripts/manual-data-collection.ps1
param(
    [Parameter(Mandatory=$false)]
    [string]$Profile = $env:AWS_PROFILE ?? "default"
)

Write-Host "使用するAWSプロファイル: $Profile" -ForegroundColor Cyan
```

### 環境変数設定

```powershell
# 一時的に設定（現在のセッションのみ）
$env:AWS_PROFILE = "imanishi-awssso"

# 永続的に設定（ユーザー環境変数）
[System.Environment]::SetEnvironmentVariable("AWS_PROFILE", "imanishi-awssso", "User")
```

## テストコード

### ユニットテスト

```typescript
// __tests__/handler.test.ts
beforeEach(() => {
  process.env.AWS_REGION = 'ap-northeast-1';
  process.env.DYNAMODB_TABLE = 'test-table';
});

afterEach(() => {
  delete process.env.AWS_REGION;
  delete process.env.DYNAMODB_TABLE;
});
```

### E2Eテスト

```typescript
// __tests__/e2e/test.e2e.test.ts
const region = process.env.AWS_REGION || 'ap-northeast-1';
```

## エラーハンドリング

### 環境変数未設定時

```typescript
// config/aws-config.ts
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。` +
      `CDKデプロイ時に自動設定されます。ローカル実行時は .env ファイルで設定してください。`
    );
  }
  return value;
}
```

## チェックリスト

### Lambda関数実装時

- [ ] `config/aws-config.ts`から`AWS_REGION`をインポート
- [ ] フォールバック値を使用しない
- [ ] 環境変数検証を実装

### CDK実装時

- [ ] 共通環境変数`commonEnvironment`を定義
- [ ] すべてのLambda関数に`AWS_REGION`を設定
- [ ] `this.region`を使用してリージョンを自動設定

### 運用スクリプト実装時

- [ ] 環境変数`AWS_PROFILE`を優先使用
- [ ] デフォルト値は`"default"`
- [ ] 使用プロファイルをログ出力

## 関連ドキュメント

- `tdnet-implementation-rules.md` - 実装ルール
- `environment-variables.md` - 環境変数管理
- `cdk-implementation.md` - CDK実装ガイド
- `scripts-guide.md` - スクリプト実装ガイド
```

### 6.2 環境変数管理ガイドライン更新

**ファイル**: `.kiro/steering/infrastructure/environment-variables.md`（既存ファイル更新）

追加内容:

```markdown
## AWS設定環境変数

### AWS_REGION（必須）

**用途**: Lambda関数のAWSリージョン指定

**設定場所**: CDK（Lambda環境変数）

**デフォルト値**: なし（必須）

**設定方法**:
- CDKスタックで自動設定: `AWS_REGION: this.region`
- ローカル実行時: `.env`ファイルで設定

**例**:
```env
AWS_REGION=ap-northeast-1
```

### AWS_PROFILE（オプション）

**用途**: 運用スクリプトのAWSプロファイル指定

**設定場所**: ユーザー環境変数

**デフォルト値**: `default`

**設定方法**:
```powershell
# 一時的に設定
$env:AWS_PROFILE = "imanishi-awssso"

# 永続的に設定
[System.Environment]::SetEnvironmentVariable("AWS_PROFILE", "imanishi-awssso", "User")
```

**例**:
```env
AWS_PROFILE=imanishi-awssso
```
```


---

## 7. 実装時の注意事項

### 7.1 後方互換性の維持

#### Lambda関数

**影響**: なし

**理由**: CDKで環境変数`AWS_REGION`を設定するため、既存のデプロイ済みLambda関数は影響を受けません。

**移行手順**:
1. CDKスタックを修正（環境変数追加）
2. CDKデプロイ実行
3. Lambda関数コードを修正（フォールバック値削除）
4. 再デプロイ

#### 運用スクリプト

**影響**: 環境変数`AWS_PROFILE`未設定時、デフォルトプロファイルが`"imanishi-awssso"`から`"default"`に変更

**対策**: 環境変数`AWS_PROFILE`を設定することで既存の動作を維持

```powershell
# 既存の動作を維持
$env:AWS_PROFILE = "imanishi-awssso"
```

### 7.2 エラーハンドリング

#### 環境変数未設定時のエラーメッセージ

```typescript
// config/aws-config.ts
throw new Error(
  `環境変数 AWS_REGION が設定されていません。\n` +
  `CDKデプロイ時に自動設定されます。ローカル実行時は .env ファイルで設定してください。`
);
```

**ポイント**:
- エラーメッセージは日本語で記述
- 解決方法を明示（CDKデプロイ、.envファイル設定）
- 改行を使用して読みやすく

#### 運用スクリプトのエラーハンドリング

既存の`get-stack-outputs.ps1`のエラーハンドリングを活用します。

```powershell
# scripts/lib/get-stack-outputs.ps1
if ($errorType -eq "AUTH_EXPIRED") {
    Write-Host "❌ エラー: AWS認証が期限切れです" -ForegroundColor Red
    Write-Host ""
    Write-Host "解決方法:" -ForegroundColor Cyan
    Write-Host "1. AWS SSOで再ログインしてください:" -ForegroundColor White
    Write-Host "   aws sso login --profile $Profile" -ForegroundColor Gray
}
```

### 7.3 テスト戦略

#### ユニットテスト

```typescript
// src/utils/__tests__/secrets-manager.test.ts
describe('getSecret', () => {
  beforeEach(() => {
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.AWS_REGION;
  });

  it('should use AWS_REGION from environment variable', async () => {
    // テスト実装
  });

  it('should throw error when AWS_REGION is not set', async () => {
    delete process.env.AWS_REGION;
    
    expect(() => {
      // AWS_REGIONを使用するコードを実行
    }).toThrow('環境変数 AWS_REGION が設定されていません');
  });
});
```

#### E2Eテスト

```typescript
// src/__tests__/e2e/step-functions-collector.e2e.test.ts
const region = process.env.AWS_REGION || 'ap-northeast-1';

const sfnClient = new SFNClient({
  endpoint: 'http://localhost:4566',
  region,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});
```

#### 運用スクリプトテスト

```powershell
# テスト1: 環境変数未設定時（デフォルト値使用）
Remove-Item Env:\AWS_PROFILE -ErrorAction SilentlyContinue
.\scripts\manual-data-collection.ps1
# 期待: デフォルトプロファイル"default"を使用

# テスト2: 環境変数設定時
$env:AWS_PROFILE = "imanishi-awssso"
.\scripts\manual-data-collection.ps1
# 期待: プロファイル"imanishi-awssso"を使用

# テスト3: パラメータ指定時
.\scripts\manual-data-collection.ps1 -Profile "custom-profile"
# 期待: プロファイル"custom-profile"を使用
```

### 7.4 ドキュメント更新チェックリスト

- [ ] `README.md` - AWS認証設定セクション追加
- [ ] `.env.example` - `AWS_REGION`, `AWS_PROFILE`追加
- [ ] `.kiro/steering/core/tdnet-implementation-rules.md` - プロファイル設定方法更新
- [ ] `.kiro/steering/infrastructure/environment-variables.md` - 環境変数説明追加
- [ ] `.kiro/steering/infrastructure/aws-config-management.md` - 新規作成
- [ ] `.kiro/steering/development/scripts-guide.md` - 環境変数設定方法追加

### 7.5 Git Commit戦略

```bash
# タスク3: Lambda関数のリージョン指定を環境変数化
git commit -m "[refactor] Lambda関数のAWS_REGION環境変数必須化

- config/aws-config.ts作成（AWS_REGION取得）
- src/utils/env-validator.ts作成（環境変数検証）
- CDKスタックでAWS_REGION環境変数を自動設定
- Lambda関数内のフォールバック値削除（15箇所）
- ユニットテスト修正
- .env.example更新

関連タスク: tasks-hardcoded-values-improvement.md タスク3"

# タスク4: 運用スクリプトのプロファイル指定を環境変数化
git commit -m "[refactor] 運用スクリプトのAWS_PROFILE環境変数優先化

- scripts/lib/get-stack-outputs.ps1拡張
- 運用スクリプトのデフォルト値を'default'に変更（8箇所）
- 環境変数AWS_PROFILEを優先使用
- README.md更新（AWS認証設定セクション追加）
- Steering File更新

関連タスク: tasks-hardcoded-values-improvement.md タスク4"
```


---

## 8. 成果物サマリー

### 8.1 設計ドキュメント

| ドキュメント | 内容 |
|------------|------|
| **設定ファイル設計** | `config/aws-config.ts`の構造、型定義、使用例 |
| **環境変数設計** | `AWS_REGION`, `AWS_PROFILE`の必須/オプション、デフォルト値、設定方法 |
| **CDK実装方針** | Lambda関数への環境変数設定、共通環境変数の定義、検証ロジック |
| **運用スクリプト改善方針** | 環境変数優先、デフォルト値変更、`get-stack-outputs.ps1`拡張 |

### 8.2 実装タスクリスト

| タスク | 優先度 | 箇所数 | 影響範囲 |
|-------|--------|--------|---------|
| **タスク3: Lambda関数のリージョン指定を環境変数化** | 高 | 15箇所 | 本番環境 |
| **タスク4: 運用スクリプトのプロファイル指定を環境変数化** | 中 | 30箇所 | 運用効率 |
| **タスク5: テストコードのリージョン指定を環境変数化** | 低 | 70箇所以上 | テスト環境のみ（オプション） |
| **タスク6: ドキュメント整備** | 低 | - | ドキュメント |

### 8.3 実装ガイドライン

| ガイドライン | ファイル | 内容 |
|------------|---------|------|
| **AWS設定管理ガイドライン** | `.kiro/steering/infrastructure/aws-config-management.md`（新規） | Lambda関数、運用スクリプト、テストコードの実装方法 |
| **環境変数管理ガイドライン** | `.kiro/steering/infrastructure/environment-variables.md`（更新） | `AWS_REGION`, `AWS_PROFILE`の説明追加 |

### 8.4 主要な設計決定

| 項目 | 決定内容 | 理由 |
|------|---------|------|
| **Lambda関数のリージョン** | 環境変数`AWS_REGION`必須化、フォールバック値削除 | マルチリージョン展開の柔軟性向上 |
| **CDK環境変数設定** | `this.region`を使用して自動設定 | デプロイ時のリージョンを自動反映 |
| **運用スクリプトのプロファイル** | 環境変数`AWS_PROFILE`優先、デフォルト`"default"` | 汎用性向上、他ユーザーでも使用可能 |
| **テストコードのリージョン** | 現状維持（変更不要） | テスト環境は固定値で問題なし |

### 8.5 期待される効果

| 効果 | 説明 |
|------|------|
| **マルチリージョン対応** | リージョン変更時にコード修正不要 |
| **汎用性向上** | 他のユーザーや環境でも使用可能 |
| **保守性向上** | 設定変更時の修正箇所が最小化 |
| **エラー検出の早期化** | 環境変数未設定時に即座にエラー |
| **ドキュメント整備** | 設定方法が明確化 |

---

## 9. 申し送り事項

### 9.1 次のステップ

1. **タスク3の実装**: Lambda関数のリージョン指定を環境変数化（高優先度）
   - `config/aws-config.ts`作成
   - `src/utils/env-validator.ts`作成
   - CDKスタック修正
   - Lambda関数内のフォールバック値削除（15箇所）
   - ユニットテスト修正

2. **タスク4の実装**: 運用スクリプトのプロファイル指定を環境変数化（中優先度）
   - `scripts/lib/get-stack-outputs.ps1`拡張
   - 運用スクリプト修正（8箇所）
   - ドキュメント更新

3. **テスト実行**: ユニットテスト、E2Eテスト、CDKデプロイテスト

4. **ドキュメント整備**: README.md、Steering File更新

### 9.2 注意事項

- **後方互換性**: 環境変数`AWS_PROFILE`を設定することで既存の動作を維持
- **エラーメッセージ**: 日本語で記述し、解決方法を明示
- **テスト戦略**: 環境変数未設定時のエラーテストを追加
- **Git Commit**: タスクごとに分割してコミット

### 9.3 リスク

| リスク | 影響 | 対策 |
|-------|------|------|
| **環境変数未設定** | Lambda関数起動失敗 | CDKで自動設定、エラーメッセージで解決方法を明示 |
| **プロファイル変更** | 運用スクリプト実行失敗 | 環境変数設定方法をドキュメント化 |
| **テスト失敗** | CI/CDパイプライン停止 | ユニットテスト修正、環境変数モック設定 |

---

## 10. 関連ドキュメント

- `tasks-hardcoded-values-improvement.md` - ハードコード改善タスク
- `work-log-20260223-081005-hardcode-aws-config-investigation.md` - タスク1調査結果
- `.kiro/steering/core/tdnet-implementation-rules.md` - 実装ルール
- `.kiro/steering/infrastructure/environment-variables.md` - 環境変数管理
- `.kiro/steering/infrastructure/cdk-implementation.md` - CDK実装ガイド
- `.kiro/steering/development/scripts-guide.md` - スクリプト実装ガイド

---

**作業完了日時**: 2026-02-23 08:28:38  
**作業者**: Kiro AI Assistant  
**ステータス**: 完了


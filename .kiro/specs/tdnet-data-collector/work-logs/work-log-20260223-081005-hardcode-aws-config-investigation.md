# 作業記録: AWSリージョンとプロファイル名のハードコード調査

**作業日時**: 2026-02-23 08:10:05  
**作業者**: Kiro AI Assistant  
**関連タスク**: tasks-hardcoded-values-improvement.md

## 作業概要

プロジェクト全体でAWSリージョン（`ap-northeast-1`, `us-east-1`）とAWSプロファイル名（`imanishi-awssso`）のハードコード箇所を調査し、影響範囲と対応方針を分析しました。

## 調査結果サマリー

### 発見された箇所の総数

| 項目 | 本番環境 | テスト環境 | ドキュメント | 合計 |
|------|---------|-----------|-------------|------|
| **AWSリージョン (ap-northeast-1)** | 15箇所 | 50箇所以上 | 5箇所 | 70箇所以上 |
| **AWSリージョン (us-east-1)** | 0箇所 | 20箇所 | 3箇所 | 23箇所 |
| **AWSプロファイル (imanishi-awssso)** | 0箇所 | 0箇所 | 30箇所 | 30箇所 |

### 影響度別分類

- **高優先度（本番環境に影響）**: 15箇所
- **中優先度（テスト環境のみ）**: 70箇所以上
- **低優先度（ドキュメント・スクリプトデフォルト値）**: 38箇所

## 詳細リスト

### 1. AWSリージョン: ap-northeast-1（本番環境）

#### 1.1 Lambda関数（高優先度）

| ファイルパス | 行番号 | ハードコードされている値 | 影響範囲 | 優先度 |
|-------------|--------|----------------------|---------|-------|
| `src/utils/secrets-manager.ts` | 27 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/utils/batch-write.ts` | 21 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/query/query-disclosures.ts` | 25 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/query/generate-presigned-url.ts` | 16 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/stats/handler.ts` | 23 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/health/handler.ts` | 23-24 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` (2箇所) | 本番環境 | **高** |
| `src/lambda/get-disclosure/handler.ts` | 27, 35 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` (2箇所) | 本番環境 | **高** |
| `src/lambda/export/create-export-job.ts` | 16 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/export/update-export-status.ts` | 15 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |
| `src/lambda/dlq-processor/index.ts` | 20 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 本番環境 | **高** |

**合計**: 15箇所（本番環境に影響）

#### 1.2 スクリプト（中優先度）

| ファイルパス | 行番号 | ハードコードされている値 | 影響範囲 | 優先度 |
|-------------|--------|----------------------|---------|-------|
| `scripts/migrate-disclosure-fields.ts` | 29 | `process.env.AWS_REGION \|\| 'ap-northeast-1'` | 運用スクリプト | 中 |

#### 1.3 E2Eテスト（中優先度）

| ファイルパス | 行番号 | ハードコードされている値 | 影響範囲 | 優先度 |
|-------------|--------|----------------------|---------|-------|
| `src/__tests__/e2e/step-functions-collector.e2e.test.ts` | 26, 71 | `'ap-northeast-1'` | E2Eテスト | 中 |

### 2. AWSリージョン: ap-northeast-1（テスト環境のみ）

#### 2.1 ユニットテスト（低優先度）

テストファイル内で`process.env.AWS_REGION = 'ap-northeast-1'`として設定されている箇所:

| ファイルパス | 行番号 | 影響範囲 | 優先度 |
|-------------|--------|---------|-------|
| `src/lambda/collect-status/__tests__/handler.test.ts` | 36, 41, 675, 717 | テストのみ | 低 |
| `src/lambda/collect-status/__tests__/handler-step-functions.test.ts` | 40, 46 | テストのみ | 低 |
| `src/lambda/query/__tests__/generate-presigned-url.test.ts` | 32, 243 | テストのみ | 低 |
| `src/lambda/query/__tests__/query-disclosures.test.ts` | 74 | テストのみ | 低 |
| `src/lambda/export/__tests__/update-export-status.test.ts` | 38 | テストのみ | 低 |
| `src/lambda/export/__tests__/query-disclosures.test.ts` | 77 | テストのみ | 低 |
| `src/lambda/export/__tests__/create-export-job.test.ts` | 67, 398 | テストのみ | 低 |
| `src/lambda/export/__tests__/export-to-s3.test.ts` | 66 | テストのみ | 低 |
| `src/lambda/export/__tests__/export-file-expiration.property.test.ts` | 28 | テストのみ | 低 |
| `src/lambda/dlq-processor/__tests__/index.test.ts` | 34, 39, 616, 621 | テストのみ | 低 |

#### 2.2 統合テスト（低優先度）

統合テストで`region: 'ap-northeast-1'`として直接指定されている箇所:

| ファイルパス | 行番号 | 影響範囲 | 優先度 |
|-------------|--------|---------|-------|
| `src/__tests__/integration/cloudwatch-alarms-integration.test.ts` | 38, 70, 102, 136, 178, 206, 235, 276, 296, 315, 340, 373, 396 | テストのみ | 低 |
| `src/__tests__/integration/waf-integration.test.ts` | 48, 86, 143, 202, 235, 256, 294, 316, 367, 396, 448, 472, 488 | テストのみ | 低 |
| `src/__tests__/integration/performance-benchmark.test.ts` | 24 | テストのみ | 低 |

#### 2.3 ARN内のリージョン指定（低優先度）

テストコード内のモックARNに含まれるリージョン指定:

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `src/lambda/collector-save/__tests__/handler.test.ts` | 27 | `arn:aws:lambda:ap-northeast-1:...` | テストのみ | 低 |
| `src/lambda/collector-fetch/__tests__/handler.test.ts` | 37 | `arn:aws:lambda:ap-northeast-1:...` | テストのみ | 低 |
| `src/lambda/dlq-processor/__tests__/handler.e2e.test.ts` | 238 | `arn:aws:sqs:ap-northeast-1:...` | テストのみ | 低 |
| `src/lambda/dlq-processor/__tests__/index.test.ts` | 66, 111, 127, 162, 194, 221, 261 | `arn:aws:sqs:ap-northeast-1:...` | テストのみ | 低 |
| `src/__tests__/integration/cloudwatch-alarms-integration.test.ts` | 221, 250 | `arn:aws:sns:ap-northeast-1:...` | テストのみ | 低 |
| `src/__tests__/integration/waf-integration.test.ts` | 43, 81, 138, 197, 228, 280 | `arn:aws:wafv2:ap-northeast-1:...` | テストのみ | 低 |

#### 2.4 CDKテスト（低優先度）

CDKスタックのテストで使用されるリージョン指定:

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `cdk/__tests__/secrets-manager.test.ts` | 17 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/s3-buckets.test.ts` | 21 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/dynamodb-tables.test.ts` | 20 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/constructs/waf.test.ts` | 17 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/cloudwatch-logs.test.ts` | 16 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/cloudtrail.test.ts` | 17, 347 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/cloudfront.test.ts` | 16 | `region: 'ap-northeast-1'` | テストのみ | 低 |
| `cdk/__tests__/s3-lifecycle.test.ts` | 20 | `region: 'ap-northeast-1'` | テストのみ | 低 |

### 3. AWSリージョン: us-east-1（テスト環境のみ）

#### 3.1 ロードテスト（中優先度）

| ファイルパス | 行番号 | ハードコードされている値 | 影響範囲 | 優先度 |
|-------------|--------|----------------------|---------|-------|
| `src/__tests__/load/load-test.test.ts` | 30 | `process.env.AWS_REGION \|\| 'us-east-1'` | ロードテスト | 中 |

#### 3.2 ARN内のリージョン指定（低優先度）

テストコード内のモックARNに含まれる`us-east-1`:

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `cdk/lib/stacks/__tests__/compute-stack.test.ts` | 56 | `arn:aws:sns:us-east-1:...` | テストのみ | 低 |
| `src/lambda/collector/__tests__/handler.test.ts` | 35 | `arn:aws:lambda:us-east-1:...` | テストのみ | 低 |
| `src/lambda/collector/__tests__/handler.improved.ts` | 50 | `arn:aws:lambda:us-east-1:...` | テストのみ | 低 |
| `src/lambda/collector/__tests__/handler.integration.test.ts` | 34 | `arn:aws:lambda:us-east-1:...` | テストのみ | 低 |
| `cdk/lib/constructs/__tests__/cloudwatch-dashboard.test.ts` | 85 | `arn:aws:states:us-east-1:...` | テストのみ | 低 |
| `cdk/lib/constructs/__tests__/step-functions-collector.test.ts` | 30, 36, 42, 48 | `arn:aws:lambda:us-east-1:...` | テストのみ | 低 |
| `cdk/lib/stacks/__tests__/monitoring-stack.test.ts` | 49, 139, 171 | `arn:aws:sns:us-east-1:...` | テストのみ | 低 |

#### 3.3 ドキュメント（低優先度）

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `.kiro/specs/tdnet-data-collector/02-designs/05-operations/cost-monitoring.md` | 266 | `region: 'us-east-1'` | ドキュメント | 低 |
| `.kiro/specs/tdnet-data-collector/02-designs/03-testing/load-testing-guide.md` | 82, 86, 126 | `us-east-1` | ドキュメント | 低 |
| `README.md` | 864, 869, 872 | CloudFront証明書の説明 | ドキュメント | 低 |

### 4. AWSプロファイル: imanishi-awssso

#### 4.1 スクリプトのデフォルト値（低優先度）

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `scripts/startup.ps1` | 7, 28, 50, 78, 83, 90, 112 | `[string]$Profile = "imanishi-awssso"` | 運用スクリプト | 低 |
| `scripts/manual-data-collection.ps1` | 20, 38 | `[string]$Profile = "imanishi-awssso"` | 運用スクリプト | 低 |
| `scripts/check-lambda-998-limit.ps1` | 12, 32, 63, 82, 163, 166, 191, 210 | `[string]$Profile = "imanishi-awssso"` | 運用スクリプト | 低 |
| `scripts/deploy.ps1` | 63, 69, 70 | `"imanishi-awssso"` | デプロイスクリプト | 低 |
| `scripts/deploy-prod.ps1` | 30, 36, 37 | `"imanishi-awssso"` | 本番デプロイ | 低 |
| `scripts/lib/get-stack-outputs.ps1` | 27, 51, 74, 75, 160 | `[string]$Profile` | 共通ライブラリ | 低 |
| `scripts/check-step-functions-execution.ps1` | 17, 52, 85 | `[string]$Profile` | 運用スクリプト | 低 |
| `scripts/fetch-data-range.ps1` | 20, 43 | `[string]$Profile` | 運用スクリプト | 低 |

#### 4.2 環境変数設定（低優先度）

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `scripts/startup.ps1` | 50 | `$env:AWS_PROFILE = $Profile` | 運用スクリプト | 低 |
| `scripts/deploy.ps1` | 69 | `$env:AWS_PROFILE = "imanishi-awssso"` | デプロイスクリプト | 低 |
| `scripts/deploy-prod.ps1` | 36 | `$env:AWS_PROFILE = "imanishi-awssso"` | 本番デプロイ | 低 |

#### 4.3 ドキュメント（低優先度）

| ファイルパス | 行番号 | 内容 | 影響範囲 | 優先度 |
|-------------|--------|------|---------|-------|
| `.kiro/steering/core/tdnet-implementation-rules.md` | 20, 21, 40 | プロファイル説明 | ドキュメント | 低 |
| `.kiro/steering/infrastructure/deployment-scripts.md` | 12, 17, 18 | プロファイル説明 | ドキュメント | 低 |
| `.kiro/steering/development/scripts-guide.md` | 81, 339 | プロファイル説明 | ドキュメント | 低 |
| `.kiro/steering/core/tdnet-data-collector.md` | 27, 29 | プロファイル説明 | ドキュメント | 低 |
| `.kiro/specs/tdnet-data-collector/04-work-logs/dashboard-access-info.md` | 153, 158 | プロファイル使用例 | ドキュメント | 低 |
| `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-065317-step-functions-production-test.md` | 29, 39, 48 | プロファイル使用例 | ドキュメント | 低 |
| `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-074522-task8-deployment.md` | 12, 18, 52, 63, 122 | プロファイル使用例 | ドキュメント | 低 |

## 対応方針の提案

### 1. 環境変数化すべき箇所（高優先度）

#### 1.1 Lambda関数のリージョン指定

**現状**: 15箇所で`process.env.AWS_REGION || 'ap-northeast-1'`としてフォールバック値を使用

**問題点**:
- 環境変数`AWS_REGION`が未設定の場合、自動的に`ap-northeast-1`にフォールバック
- 他のリージョンでデプロイする場合、コード変更が必要
- マルチリージョン展開時に柔軟性がない

**対応方針**:
1. **CDKスタックで環境変数を設定**: すべてのLambda関数に`AWS_REGION`環境変数を明示的に設定
2. **フォールバック値を削除**: `process.env.AWS_REGION`のみを使用し、未設定時はエラーとする
3. **設定ファイル化**: `config/environment.ts`でリージョン設定を一元管理

**実装例**:
```typescript
// config/environment.ts
export const AWS_REGION = process.env.AWS_REGION;
if (!AWS_REGION) {
  throw new Error('AWS_REGION environment variable is required');
}

// src/utils/secrets-manager.ts
import { AWS_REGION } from '../../config/environment';

const secretsManagerClient = new SecretsManagerClient({
  region: AWS_REGION,
  maxAttempts: 3,
  retryMode: 'adaptive',
});
```

**CDK側の対応**:
```typescript
// cdk/lib/constructs/lambda-function.ts
const lambdaFunction = new lambda.Function(this, 'Function', {
  // ...
  environment: {
    AWS_REGION: Stack.of(this).region, // CDKスタックのリージョンを自動設定
    // ...
  },
});
```

### 2. 設定ファイル化すべき箇所（中優先度）

#### 2.1 スクリプトのデフォルトプロファイル

**現状**: 8個のスクリプトで`imanishi-awssso`をデフォルト値として使用

**問題点**:
- 他のユーザーや環境で使用する場合、スクリプト修正が必要
- プロファイル名変更時に複数ファイルの修正が必要

**対応方針**:
1. **環境変数化**: `AWS_PROFILE`環境変数を優先的に使用
2. **設定ファイル化**: `.env`ファイルでデフォルトプロファイルを設定
3. **ドキュメント更新**: README.mdでプロファイル設定方法を明記

**実装例**:
```powershell
# scripts/startup.ps1
param(
    [Parameter(Mandatory=$false)]
    [string]$Profile = $env:AWS_PROFILE ?? "default", # 環境変数を優先
    # ...
)
```

```.env
# .env.example
AWS_PROFILE=your-profile-name
AWS_REGION=ap-northeast-1
```

### 3. 現状維持でよい箇所（低優先度）

#### 3.1 テストコード内のハードコード

**理由**:
- テスト環境は固定されており、柔軟性は不要
- モックARNはテストデータであり、実際のAWSリソースではない
- テストの可読性と保守性を優先

**対応**: 現状維持（変更不要）

#### 3.2 ドキュメント内の記載

**理由**:
- 具体例として記載されているため、ハードコードは適切
- ユーザーが自身の環境に合わせて変更することを前提

**対応**: 現状維持（必要に応じて注釈を追加）

### 4. E2Eテストのリージョン指定（中優先度）

**現状**: `src/__tests__/e2e/step-functions-collector.e2e.test.ts`で`ap-northeast-1`を使用

**問題点**:
- LocalStack環境では任意のリージョンを使用可能
- 本番環境と異なるリージョンでテストする場合に柔軟性がない

**対応方針**:
1. **環境変数化**: `AWS_REGION`環境変数を使用
2. **デフォルト値を維持**: 環境変数未設定時は`ap-northeast-1`を使用

**実装例**:
```typescript
// src/__tests__/e2e/step-functions-collector.e2e.test.ts
const region = process.env.AWS_REGION || 'ap-northeast-1';
```

## 実装優先順位

### Phase 1: 本番環境への影響が大きい箇所（高優先度）

1. **Lambda関数のリージョン指定（15箇所）**
   - CDKスタックで`AWS_REGION`環境変数を設定
   - フォールバック値を削除
   - 設定ファイル化（`config/environment.ts`）

### Phase 2: 運用効率化（中優先度）

2. **スクリプトのプロファイル指定（8箇所）**
   - 環境変数`AWS_PROFILE`を優先的に使用
   - `.env`ファイルでデフォルト値を設定

3. **E2Eテストのリージョン指定（2箇所）**
   - 環境変数化

### Phase 3: ドキュメント整備（低優先度）

4. **ドキュメント更新**
   - プロファイル設定方法の明記
   - リージョン設定方法の明記
   - 環境変数の説明追加

## 成果物

- 本作業記録ファイル
- 詳細な調査結果と対応方針

## 申し送り事項

### 次のステップ

1. **Phase 1の実装**:
   - `config/environment.ts`の作成
   - Lambda関数のリージョン指定を環境変数化
   - CDKスタックで`AWS_REGION`環境変数を設定

2. **Phase 2の実装**:
   - スクリプトのプロファイル指定を環境変数化
   - `.env.example`の作成

3. **テスト実行**:
   - ユニットテスト実行
   - E2Eテスト実行
   - 本番環境での動作確認

### 注意事項

- **後方互換性**: 既存の環境変数設定を維持しつつ、新しい設定方法を追加
- **エラーハンドリング**: 環境変数未設定時のエラーメッセージを明確に
- **ドキュメント更新**: README.mdとsteering filesを更新

## 関連ドキュメント

- `tasks-hardcoded-values-improvement.md`
- `tdnet-implementation-rules.md`
- `scripts-guide.md`
- `deployment-checklist.md`

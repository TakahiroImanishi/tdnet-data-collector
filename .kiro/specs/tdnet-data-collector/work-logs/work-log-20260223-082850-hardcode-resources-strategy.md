# 作業記録: DynamoDB/S3リソース名のハードコード改善方針策定

**作業日時**: 2026-02-23 08:28:50  
**作業者**: Kiro AI Assistant  
**作業概要**: 環境変数デフォルト値の削除と環境変数必須化の改善方針を策定

---

## 作業内容

### 1. 背景

タスク1調査結果（`work-log-20260223-081013-hardcode-lambda-resources-investigation.md`）から、以下7箇所の環境変数デフォルト値が高優先度改善対象として特定されました:

| ファイル | 環境変数 | デフォルト値 | 影響範囲 |
|---------|---------|------------|---------|
| `src/lambda/query/generate-presigned-url.ts` | `S3_BUCKET_NAME` | `tdnet-data-collector-pdfs` | Query Lambda |
| `src/lambda/query/query-disclosures.ts` | `DYNAMODB_TABLE_NAME` | `tdnet_disclosures` | Query Lambda |
| `src/lambda/export/query-disclosures.ts` | `DYNAMODB_TABLE_NAME` | `tdnet-disclosures` | Export Lambda |
| `src/lambda/export/update-export-status.ts` | `EXPORT_STATUS_TABLE_NAME` | `tdnet-export-status` | Export Lambda |
| `src/lambda/export/generate-signed-url.ts` | `EXPORT_BUCKET_NAME` | `tdnet-exports` | Export Lambda |
| `src/lambda/export/export-to-s3.ts` | `EXPORT_BUCKET_NAME` | `tdnet-exports` | Export Lambda |
| `src/lambda/export/create-export-job.ts` | `EXPORT_STATUS_TABLE_NAME` | `tdnet-export-status` | Export Lambda |

### 2. 現状分析

#### 2.1 CDK実装の現状

**環境変数設定状況**（`cdk/lib/stacks/compute-stack.ts`）:

```typescript
// Query Function
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,  // ✅ 設定済み
  S3_BUCKET_NAME: props.pdfsBucket.bucketName,            // ✅ 設定済み
  LOG_LEVEL: envConfig.query.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}

// Export Function
environment: {
  DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,       // ✅ 設定済み
  EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName, // ✅ 設定済み
  EXPORT_BUCKET_NAME: props.exportsBucket.bucketName,          // ✅ 設定済み
  LOG_LEVEL: envConfig.export.logLevel,
  ENVIRONMENT: env,
  NODE_OPTIONS: '--enable-source-maps',
}
```

**結論**: CDKでは既に全ての環境変数が正しく設定されています。

#### 2.2 Lambda関数内のデフォルト値

**問題点**:
- Lambda関数内でデフォルト値を設定しているため、環境変数未設定時にエラーが検出されない
- 誤った環境へのデプロイや設定ミスが実行時まで発見されない
- デバッグが困難（どの環境変数が使用されているか不明確）

**例**（`src/lambda/query/generate-presigned-url.ts`）:
```typescript
// 現状（問題あり）
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs';

// 改善後（推奨）
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error('S3_BUCKET_NAME environment variable is required');
}
```

#### 2.3 テスト環境への影響

**LocalStack/E2Eテスト**:
- テスト用の環境変数は`jest.config.js`や`docker-compose.yml`で設定
- デフォルト値削除後も、テスト環境では環境変数を明示的に設定すれば問題なし

**例**（`src/__tests__/e2e/step-functions-collector.e2e.test.ts`）:
```typescript
const executionsTableName = process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod';
const disclosuresTableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';
const s3BucketName = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs-local';
```

**対応方針**: テストコード内のデフォルト値は現状維持（テスト環境固有の設定）

---

## 3. 改善方針

### 3.1 環境変数必須化の設計

#### 3.1.1 検証ロジック

**実装場所**: Lambda関数のグローバルスコープ（コールドスタート時に1回実行）

**実装パターン**:

```typescript
// パターン1: 個別検証（推奨）
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new Error('S3_BUCKET_NAME environment variable is required');
}

// パターン2: 一括検証（複数の環境変数がある場合）
const requiredEnvVars = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`環境変数 ${envVar} が設定されていません`);
  }
}
```

**メリット**:
- コールドスタート時に即座にエラー検出
- 実行前に設定ミスを発見
- CloudWatch Logsで明確なエラーメッセージ

#### 3.1.2 エラーハンドリング

**エラー種別**: `ConfigurationError`（新規カスタムエラークラス）

**実装**（`src/errors/index.ts`に追加）:

```typescript
/**
 * 設定エラー
 * 環境変数未設定、設定値不正等の設定関連エラー
 */
export class ConfigurationError extends Error {
  constructor(message: string, public details?: Record<string, any>) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**ログ出力**:

```typescript
import { logger } from '../../utils/logger';

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  logger.error('Required environment variable is missing', {
    error_type: 'ConfigurationError',
    error_message: 'S3_BUCKET_NAME environment variable is required',
    environment: process.env.ENVIRONMENT || 'unknown',
  });
  throw new ConfigurationError('S3_BUCKET_NAME environment variable is required');
}
```

#### 3.1.3 起動時検証の実装

**実装場所**: Lambda関数のグローバルスコープ

**実装例**（`src/lambda/query/handler.ts`）:

```typescript
// グローバルスコープ（コールドスタート時のみ実行）
import { logger } from '../../utils/logger';
import { ConfigurationError } from '../../errors';

// 環境変数検証
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

if (!DYNAMODB_TABLE_NAME) {
  logger.error('Required environment variable is missing', {
    error_type: 'ConfigurationError',
    error_message: 'DYNAMODB_TABLE_NAME environment variable is required',
  });
  throw new ConfigurationError('DYNAMODB_TABLE_NAME environment variable is required');
}

if (!S3_BUCKET_NAME) {
  logger.error('Required environment variable is missing', {
    error_type: 'ConfigurationError',
    error_message: 'S3_BUCKET_NAME environment variable is required',
  });
  throw new ConfigurationError('S3_BUCKET_NAME environment variable is required');
}

// ハンドラー（リクエストごとに実行）
export async function handler(event: QueryEvent, context: Context): Promise<APIGatewayProxyResult> {
  // DYNAMODB_TABLE_NAME, S3_BUCKET_NAMEを使用
}
```

### 3.2 CDK実装方針

#### 3.2.1 環境変数設定の確認

**現状**: 既に全ての環境変数が正しく設定されている

**対応**: CDK側の変更は不要

#### 3.2.2 環境変数の検証ロジック（オプション）

**CDK側での検証**（将来的な改善案）:

```typescript
// cdk/lib/constructs/validated-lambda.ts（新規作成案）
export interface ValidatedLambdaProps extends NodejsFunctionProps {
  requiredEnvVars: string[];
}

export class ValidatedLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: ValidatedLambdaProps) {
    super(scope, id, props);

    // 環境変数が設定されているか検証
    for (const envVar of props.requiredEnvVars) {
      if (!props.environment || !props.environment[envVar]) {
        throw new Error(`Required environment variable ${envVar} is not set for Lambda ${id}`);
      }
    }
  }
}
```

**評価**: 現時点では不要（Lambda関数側の検証で十分）

### 3.3 運用への影響分析

#### 3.3.1 既存デプロイへの影響

**影響範囲**: なし

**理由**:
- CDKで既に環境変数が設定されている
- Lambda関数のコード変更のみ（デフォルト値削除）
- 既存の環境変数設定に影響なし

#### 3.3.2 ロールバック戦略

**ロールバック方法**:
1. Gitで前のコミットに戻す
2. Lambda関数を再デプロイ

**ロールバック時間**: 約5分（Lambda関数のデプロイのみ）

**リスク**: 低（環境変数は既に設定済みのため）

#### 3.3.3 移行手順

**Phase 1: コード修正**
1. Lambda関数内のデフォルト値削除
2. 環境変数検証ロジック追加
3. `ConfigurationError`クラス追加

**Phase 2: テスト**
1. ユニットテスト修正（環境変数モック追加）
2. LocalStack/E2Eテスト実行
3. 環境変数未設定時のエラーテスト追加

**Phase 3: デプロイ**
1. 開発環境（dev）にデプロイ
2. 動作確認（CloudWatch Logsでエラーがないか確認）
3. 本番環境（prod）にデプロイ

**Phase 4: 監視**
1. CloudWatch Logsで`ConfigurationError`が発生していないか監視
2. Lambda関数のエラー率を監視

### 3.4 テスト戦略

#### 3.4.1 環境変数未設定時のテスト

**新規テストケース**（`src/lambda/query/__tests__/handler.test.ts`）:

```typescript
describe('環境変数検証', () => {
  it('DYNAMODB_TABLE_NAMEが未設定の場合、ConfigurationErrorが発生する', () => {
    // Arrange
    delete process.env.DYNAMODB_TABLE_NAME;

    // Act & Assert
    expect(() => {
      // handler.tsを再読み込み（グローバルスコープの検証を実行）
      jest.resetModules();
      require('../handler');
    }).toThrow(ConfigurationError);
  });

  it('S3_BUCKET_NAMEが未設定の場合、ConfigurationErrorが発生する', () => {
    // Arrange
    delete process.env.S3_BUCKET_NAME;

    // Act & Assert
    expect(() => {
      jest.resetModules();
      require('../handler');
    }).toThrow(ConfigurationError);
  });
});
```

#### 3.4.2 LocalStack/E2Eテストへの影響

**対応**: テストコード内のデフォルト値は現状維持

**理由**:
- テスト環境固有の設定
- 本番環境のLambda関数とは独立
- テストの可読性・保守性を維持

**例**（`src/__tests__/e2e/step-functions-collector.e2e.test.ts`）:
```typescript
// テストコード内のデフォルト値は現状維持
const executionsTableName = process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod';
const disclosuresTableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';
const s3BucketName = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs-local';
```

#### 3.4.3 ユニットテストの修正

**修正内容**: 環境変数モックの追加

**例**（`src/lambda/query/__tests__/handler.test.ts`）:

```typescript
describe('Lambda Query Handler', () => {
  beforeEach(() => {
    // 環境変数をモック
    process.env.DYNAMODB_TABLE_NAME = 'test-table';
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.API_KEY = 'test-api-key';
  });

  afterEach(() => {
    // 環境変数をクリア
    delete process.env.DYNAMODB_TABLE_NAME;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.API_KEY;
  });

  it('should process query successfully', async () => {
    // テストコード
  });
});
```

---

## 4. 具体的な改善タスクリスト

### タスク3: Lambda関数内のデフォルト値削除と環境変数必須化

#### 3.1 ConfigurationErrorクラス追加
- [ ] `src/errors/index.ts`に`ConfigurationError`クラスを追加
- [ ] エラークラスのエクスポート追加
- [ ] JSDocコメント追加

#### 3.2 Query Lambda関数の修正
- [ ] `src/lambda/query/generate-presigned-url.ts`: `S3_BUCKET_NAME`デフォルト値削除、検証ロジック追加
- [ ] `src/lambda/query/query-disclosures.ts`: `DYNAMODB_TABLE_NAME`デフォルト値削除、検証ロジック追加
- [ ] ユニットテスト修正: 環境変数モック追加
- [ ] 環境変数未設定時のテスト追加

#### 3.3 Export Lambda関数の修正
- [ ] `src/lambda/export/query-disclosures.ts`: `DYNAMODB_TABLE_NAME`デフォルト値削除、検証ロジック追加
- [ ] `src/lambda/export/update-export-status.ts`: `EXPORT_STATUS_TABLE_NAME`デフォルト値削除、検証ロジック追加
- [ ] `src/lambda/export/generate-signed-url.ts`: `EXPORT_BUCKET_NAME`デフォルト値削除、検証ロジック追加
- [ ] `src/lambda/export/export-to-s3.ts`: `EXPORT_BUCKET_NAME`デフォルト値削除、検証ロジック追加
- [ ] `src/lambda/export/create-export-job.ts`: `EXPORT_STATUS_TABLE_NAME`デフォルト値削除、検証ロジック追加
- [ ] ユニットテスト修正: 環境変数モック追加
- [ ] 環境変数未設定時のテスト追加

#### 3.4 テスト実行
- [ ] ユニットテスト実行: `npm run test`
- [ ] LocalStack環境起動: `docker compose up -d`
- [ ] E2Eテスト実行: `npm run test:e2e`

#### 3.5 デプロイと動作確認
- [ ] 開発環境（dev）にデプロイ: `npm run deploy:dev`
- [ ] CloudWatch Logsで`ConfigurationError`が発生していないか確認
- [ ] 本番環境（prod）にデプロイ: `npm run deploy:prod`
- [ ] CloudWatch Logsで`ConfigurationError`が発生していないか確認

### タスク4: 実装ガイドライン更新

#### 4.1 Lambda実装ガイドライン更新
- [ ] `.kiro/steering/development/lambda-guide.md`に環境変数必須化のセクション追加
- [ ] 環境変数検証ロジックの実装例追加
- [ ] `ConfigurationError`の使用方法追加

#### 4.2 エラーハンドリングガイドライン更新
- [ ] `.kiro/steering/core/error-handling-patterns.md`に`ConfigurationError`追加
- [ ] 環境変数未設定時のエラーハンドリング例追加

---

## 5. 実装ガイドライン（steering fileに追加する内容）

### 5.1 Lambda実装ガイドライン（`lambda-guide.md`）

**追加セクション**: 「環境変数必須化」

```markdown
### 環境変数必須化

Lambda関数内で環境変数を使用する場合、デフォルト値を設定せず、必須化してください。

**実装パターン**:

```typescript
// グローバルスコープ（コールドスタート時のみ実行）
import { logger } from '../../utils/logger';
import { ConfigurationError } from '../../errors';

// 環境変数検証
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
if (!DYNAMODB_TABLE_NAME) {
  logger.error('Required environment variable is missing', {
    error_type: 'ConfigurationError',
    error_message: 'DYNAMODB_TABLE_NAME environment variable is required',
  });
  throw new ConfigurationError('DYNAMODB_TABLE_NAME environment variable is required');
}

// ハンドラー（リクエストごとに実行）
export async function handler(event: any, context: Context) {
  // DYNAMODB_TABLE_NAMEを使用
}
```

**メリット**:
- コールドスタート時に即座にエラー検出
- 実行前に設定ミスを発見
- CloudWatch Logsで明確なエラーメッセージ

**テスト用デフォルト値**:
- テストコード内のデフォルト値は現状維持（テスト環境固有の設定）
- 本番環境のLambda関数とは独立
```

### 5.2 エラーハンドリングガイドライン（`error-handling-patterns.md`）

**追加セクション**: 「ConfigurationError」

```markdown
## ConfigurationError

環境変数未設定、設定値不正等の設定関連エラー。

**使用例**:

```typescript
import { ConfigurationError } from '../../errors';

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) {
  throw new ConfigurationError('S3_BUCKET_NAME environment variable is required');
}
```

**エラー分類**: Non-Retryable（再試行不可）

**対応**: Lambda関数の起動を停止し、CloudWatch Logsでエラーを確認
```

---

## 6. 成果物

### 6.1 改善方針ドキュメント

本作業記録ファイル: `.kiro/specs/tdnet-data-collector/work-logs/work-log-20260223-082850-hardcode-resources-strategy.md`

### 6.2 改善方針サマリー

- **環境変数必須化**: Lambda関数内のデフォルト値を削除し、環境変数を必須化
- **検証ロジック**: グローバルスコープで環境変数を検証し、未設定時は`ConfigurationError`をスロー
- **CDK実装**: 変更不要（既に環境変数が正しく設定されている）
- **テスト戦略**: ユニットテストに環境変数モックを追加、環境変数未設定時のテスト追加
- **移行手順**: Phase 1（コード修正）→ Phase 2（テスト）→ Phase 3（デプロイ）→ Phase 4（監視）
- **ロールバック戦略**: Gitで前のコミットに戻し、Lambda関数を再デプロイ（約5分）

---

## 7. 申し送り事項

### 7.1 次のタスク

1. **タスク3: Lambda関数内のデフォルト値削除と環境変数必須化**
   - `ConfigurationError`クラス追加
   - Query/Export Lambda関数の修正
   - ユニットテスト修正
   - E2Eテスト実行

2. **タスク4: 実装ガイドライン更新**
   - `lambda-guide.md`に環境変数必須化のセクション追加
   - `error-handling-patterns.md`に`ConfigurationError`追加

### 7.2 注意事項

- **CDK側の変更は不要**: 既に環境変数が正しく設定されている
- **テストコード内のデフォルト値は現状維持**: テスト環境固有の設定
- **環境変数未設定時のエラーテスト追加**: `ConfigurationError`が正しくスローされるか確認
- **CloudWatch Logsで監視**: デプロイ後、`ConfigurationError`が発生していないか確認

### 7.3 関連ドキュメント

- `work-log-20260223-081013-hardcode-lambda-resources-investigation.md` - 調査結果
- `tasks-hardcoded-values-improvement.md` - タスク管理
- `.kiro/steering/development/lambda-guide.md` - Lambda実装ガイド
- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリングパターン
- `.kiro/steering/infrastructure/cdk-implementation.md` - CDK実装ガイド

---

## 8. 作業完了

**完了日時**: 2026-02-23 08:28:50  
**作業時間**: 約30分  
**成果物**: DynamoDB/S3リソース名のハードコード改善方針ドキュメント（本ファイル）

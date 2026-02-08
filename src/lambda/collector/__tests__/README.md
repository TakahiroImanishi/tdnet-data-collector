# Lambda Collector Tests - テスト環境ガイド

このディレクトリには、Lambda Collector関数のテストが含まれています。

## テスト環境の改善（Task 9.4）

Phase 1で発見されたテスト環境の課題を解決するため、以下の改善を実施しました：

### 1. 依存関係の注入（DI）パターン

**目的**: AWS SDKクライアントをモック可能にする

**実装ファイル**:
- `../dependencies.ts` - DI実装
- `test-helpers.ts` - テストヘルパー

**使用方法**:

```typescript
import { setupTestDependencies, cleanupTestDependencies } from './test-helpers';

describe('My Test Suite', () => {
  beforeEach(() => {
    // テスト用依存関係をセットアップ
    setupTestDependencies();
  });

  afterEach(() => {
    // テスト後クリーンアップ
    cleanupTestDependencies();
  });

  it('should work with mocked dependencies', async () => {
    // テストコード
  });
});
```

### 2. aws-sdk-client-mock の活用

**目的**: AWS SDKのモック設定を簡素化

**使用方法**:

```typescript
import { dynamoMock, s3Mock, mockPutDisclosure, mockPutPdf } from './test-helpers';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

it('should save to DynamoDB', async () => {
  // モック設定
  mockPutDisclosure(true);
  mockPutPdf(true);

  // テスト実行
  await handler(event, context);

  // 検証
  const putCalls = dynamoMock.commandCalls(PutCommand);
  expect(putCalls.length).toBeGreaterThan(0);
  expect(putCalls[0].args[0].input.TableName).toBe('test-table');
});
```

### 3. Jest設定の最適化

**改善内容**:
- ESモジュール対応の強化
- タイムアウト設定の最適化
- テスト実行の並列化（maxWorkers: 50%）
- キャッシュの有効化
- 型チェックのスキップ（isolatedModules: true）

## テストファイル一覧

### 既存テスト
- `handler.test.ts` - Lambda Collectorハンドラーのユニットテスト
- `handler.integration.test.ts` - Lambda Collectorの統合テスト
- `partial-failure.test.ts` - 部分的失敗のテスト

### 改善版テスト（参考実装）
- `handler.test.improved.ts` - DI + aws-sdk-client-mock を使用した改善版テスト

### テストヘルパー
- `test-helpers.ts` - テスト用ヘルパー関数とモック設定

## テストヘルパー関数

### セットアップ・クリーンアップ

```typescript
setupTestDependencies(): CollectorDependencies
```
- テスト用の依存関係をセットアップ
- AWS SDKモックを初期化
- beforeEach()で呼び出す

```typescript
cleanupTestDependencies(): void
```
- テスト後のクリーンアップ
- モックをリセット
- afterEach()で呼び出す

### モック設定ヘルパー

```typescript
mockPutDisclosure(success: boolean = true): void
```
- DynamoDB PutItemのモック設定

```typescript
mockUpdateExecutionStatus(success: boolean = true): void
```
- DynamoDB UpdateItemのモック設定

```typescript
mockPutPdf(success: boolean = true): void
```
- S3 PutObjectのモック設定

```typescript
mockGetPdf(content: Buffer = Buffer.from('mock pdf content')): void
```
- S3 GetObjectのモック設定

```typescript
mockPutMetrics(success: boolean = true): void
```
- CloudWatch PutMetricDataのモック設定

### モッククライアント

```typescript
dynamoMock: AwsClientStub<DynamoDBDocumentClient>
```
- DynamoDBモッククライアント
- `dynamoMock.commandCalls(PutCommand)` で呼び出し履歴を取得

```typescript
s3Mock: AwsClientStub<S3Client>
```
- S3モッククライアント
- `s3Mock.commandCalls(PutObjectCommand)` で呼び出し履歴を取得

```typescript
cloudWatchMock: AwsClientStub<CloudWatchClient>
```
- CloudWatchモッククライアント
- `cloudWatchMock.commandCalls(PutMetricDataCommand)` で呼び出し履歴を取得

## テスト実行

### すべてのテストを実行
```bash
npm test
```

### 特定のテストファイルを実行
```bash
npm test -- src/lambda/collector/__tests__/handler.test.ts
```

### カバレッジ付きで実行
```bash
npm run test:coverage
```

### ウォッチモードで実行
```bash
npm run test:watch
```

## トラブルシューティング

### 問題1: AWS SDK動的インポートエラー

**症状**:
```
Cannot find module '@aws-sdk/client-dynamodb' from 'src/lambda/collector/handler.ts'
```

**解決策**:
1. `setupTestDependencies()` を `beforeEach()` で呼び出す
2. `cleanupTestDependencies()` を `afterEach()` で呼び出す
3. 環境変数を設定する（`process.env.DYNAMODB_TABLE` など）

### 問題2: RateLimiterのモックが効かない

**症状**:
```
Test timeout after 30000ms
```

**解決策**:
`setupTestDependencies()` を使用すると、`MockRateLimiter`（遅延なし）が自動的に注入されます。

### 問題3: テストが遅い

**解決策**:
1. Jest設定で `isolatedModules: true` を有効化（型チェックをスキップ）
2. `maxWorkers: '50%'` で並列実行を制限
3. 不要なテストを `.skip` でスキップ

## ベストプラクティス

### 1. テストの独立性を保つ

```typescript
beforeEach(() => {
  setupTestDependencies(); // 毎回クリーンな状態から開始
});

afterEach(() => {
  cleanupTestDependencies(); // テスト後は必ずクリーンアップ
});
```

### 2. モックの検証を明示的に行う

```typescript
it('should save to DynamoDB', async () => {
  mockPutDisclosure(true);
  
  await handler(event, context);
  
  // 呼び出し回数を検証
  const putCalls = dynamoMock.commandCalls(PutCommand);
  expect(putCalls.length).toBe(1);
  
  // 呼び出しパラメータを検証
  expect(putCalls[0].args[0].input.TableName).toBe('test-table');
  expect(putCalls[0].args[0].input.Item.disclosure_id).toBeDefined();
});
```

### 3. 環境変数を明示的に設定

```typescript
beforeEach(() => {
  setupTestDependencies();
  
  // 環境変数を設定
  process.env.DYNAMODB_TABLE = 'test-disclosures-table';
  process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
  process.env.S3_BUCKET = 'test-pdfs-bucket';
  process.env.LOG_LEVEL = 'error'; // テスト時はエラーログのみ
});
```

### 4. 部分的失敗のテスト

```typescript
it('should handle partial failures', async () => {
  // 1回目は成功、2回目は失敗
  mockScrapeTdnetList
    .mockResolvedValueOnce([/* success data */])
    .mockRejectedValueOnce(new Error('Network error'));
  
  const response = await handler(event, context);
  
  expect(response.status).toBe('partial_success');
  expect(response.collected_count).toBeGreaterThan(0);
  expect(response.failed_count).toBeGreaterThan(0);
});
```

## 参考資料

- **DI実装**: `../dependencies.ts`
- **テストヘルパー**: `test-helpers.ts`
- **改善版テスト例**: `handler.test.improved.ts`
- **Jest設定**: `../../../../jest.config.js`
- **改善記録**: `.kiro/specs/tdnet-data-collector/improvements/task-9.1-improvement-2-20260208-082635.md`

## 次のステップ

1. **既存テストの更新**: `handler.test.ts` を `handler.test.improved.ts` のパターンに更新
2. **統合テストの実装**: Property 1-2の統合テストを実装
3. **LocalStack導入**: ローカルAWS環境でのE2Eテスト

---

**作成日時**: 2026-02-08  
**タスク**: Task 9.4 - テスト環境の整備

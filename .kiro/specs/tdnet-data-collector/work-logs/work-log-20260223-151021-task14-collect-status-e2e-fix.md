# 作業記録: タスク14 - collect-status E2Eテスト失敗の調査と修正

**作成日時**: 2026-02-23 15:10:21
**タスク**: tasks-hardcoded-values-improvement.md - タスク14
**作業概要**: collect-status Lambda関数の4テスト失敗を調査・修正

## 作業内容

### 目的
タスク7のE2Eテスト実行で発見されたcollect-status Lambda関数の4テスト失敗を調査し、修正する。

### 問題の詳細

**失敗テスト**:
- `pending状態の実行状態を取得できる`
- `running状態の実行状態を取得できる`
- `completed状態の実行状態を取得できる`
- `failed状態の実行状態を取得できる`

**エラー**: `Expected: 200, Received: 404`

**現象**:
- テストデータは正常にDynamoDBに挿入されている（ログで確認済み）
- Lambda関数がDynamoDBからデータを取得できていない（404エラー）

## 調査手順

### 1. 環境変数の確認

Lambda関数とテストコードの環境変数設定を確認します。



#### 調査結果

**問題1: 環境変数名の不一致**
- テストコード: `DYNAMODB_TABLE_EXECUTIONS`
- Lambda関数: `EXECUTION_STATE_TABLE` または `DYNAMODB_EXECUTIONS_TABLE`
- 修正: テストコードを`EXECUTION_STATE_TABLE`に統一

**問題2: LocalStackエンドポイント設定の欠如**
- Lambda関数のDynamoDBクライアントがLocalStackエンドポイントを使用していない
- 修正: `AWS_ENDPOINT_URL`環境変数を使用してLocalStackエンドポイントを設定

**問題3: 環境変数設定のタイミング**
- Lambda関数のグローバルスコープでクライアントが初期化される前に環境変数を設定する必要がある
- 修正: テストファイルの先頭（インポート前）で環境変数を設定

**問題4: レスポンス形式の不一致**
- テストコードが古いレスポンス形式を期待していた
- Lambda関数は新しい形式（Step Functions対応）を返している
- 修正: テストコードを新しいレスポンス形式に合わせて修正

**問題5: status変換後のprogress判定**
- `pending` → `running`に変換後、元の`status`で`progress`を判定していた
- 修正: 変換後の`status`で`progress`を判定するようにロジックを修正

## 修正内容

### 1. テストコード修正（handler.e2e.test.ts）

#### 環境変数名の統一
```typescript
// 修正前
const executionsTableName = process.env.DYNAMODB_TABLE_EXECUTIONS || 'tdnet_executions';

// 修正後
const executionsTableName = process.env.EXECUTION_STATE_TABLE || 'tdnet_executions';
```

#### 環境変数設定のタイミング修正
```typescript
// ファイル先頭（インポート前）に追加
process.env.EXECUTION_STATE_TABLE = process.env.EXECUTION_STATE_TABLE || 'tdnet_executions';
delete process.env.STATE_MACHINE_ARN;
```

#### レスポンス形式の修正
- `progress`, `collected_count`, `failed_count` → `progress: { collected_count, failed_count }`
- `started_at`, `completed_at` → `start_time`, `end_time`
- `status: 'pending'` → `status: 'running'`（変換後）
- `status: 'completed'` → `status: 'succeeded'`（変換後）

### 2. Lambda関数修正（handler.ts）

#### LocalStackエンドポイント設定
```typescript
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  ...(process.env.AWS_ENDPOINT_URL && {
    endpoint: process.env.AWS_ENDPOINT_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
    },
  }),
});
```

#### デバッグログの追加
```typescript
logger.info('Getting execution status from DynamoDB', {
  execution_id,
  tableName: EXECUTIONS_TABLE_NAME,
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_REGION,
});

logger.info('DynamoDB GetItem result', {
  execution_id,
  hasItem: !!result.Item,
  itemKeys: result.Item ? Object.keys(result.Item) : [],
});
```

#### status変換後のprogress判定修正
```typescript
// 修正前
progress: item.status === 'running' ? { ... } : undefined,

// 修正後
const status = item.status === 'completed' ? 'succeeded' : item.status === 'pending' ? 'running' : item.status;
const executionStatus: ExecutionStatus = {
  execution_id,
  status,
  start_time: item.started_at,
  end_time: item.completed_at,
  progress: (status === 'running') ? {
    collected_count: item.collected_count || 0,
    failed_count: item.failed_count || 0,
  } : undefined,
  error_message: item.error_message,
};
```

## テスト結果

**最終結果**: ✅ 9/9テスト成功（100%成功率）

### 成功したテスト

1. **実行状態取得** (4テスト)
   - ✅ pending状態の実行状態を取得できる
   - ✅ running状態の実行状態を取得できる
   - ✅ completed状態の実行状態を取得できる
   - ✅ failed状態の実行状態を取得できる

2. **エラーハンドリング** (3テスト)
   - ✅ 存在しないexecution_idの場合は404を返す
   - ✅ pathParametersが未定義の場合は400を返す
   - ✅ execution_idが空の場合は400を返す

3. **レスポンス形式** (2テスト)
   - ✅ 正しいCORSヘッダーを返す
   - ✅ Content-Typeヘッダーがapplication/jsonである

## 成果物

- ✅ Lambda関数修正（1ファイル）: `src/lambda/collect-status/handler.ts`
- ✅ テストコード修正（1ファイル）: `src/lambda/collect-status/__tests__/handler.e2e.test.ts`
- ✅ E2Eテスト成功（9/9テスト、100%成功率）

## 完了条件の確認

- ✅ collect-statusの4テストがすべて成功する
- ✅ Lambda関数がDynamoDBからデータを正しく取得できる
- ✅ 環境変数の設定が統一されている
- ✅ デバッグログが適切に出力される

## 申し送り事項

1. **タスク14完了**: collect-status E2Eテストの4テスト失敗を修正し、すべてのテスト（9/9）が成功しました
2. **主な修正内容**:
   - 環境変数名の統一（`EXECUTION_STATE_TABLE`）
   - LocalStackエンドポイント設定の追加
   - 環境変数設定タイミングの修正
   - レスポンス形式の統一（Step Functions対応形式）
   - status変換後のprogress判定ロジックの修正
3. **次のステップ**: タスク15（Step Functions E2Eテスト失敗の対応）に進むか、本番環境での動作確認を優先することを推奨

## タスク14の評価

**達成度**: 100%（9/9テスト成功）

タスク14（collect-status E2Eテスト失敗の調査と修正）を完了しました。

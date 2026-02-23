# 作業記録: タスク14 - collect-status E2Eテスト失敗の調査と修正

**作業日時**: 2026-02-23 15:15:40  
**作業者**: AI Assistant (Subagent)  
**関連タスク**: タスク14 - collect-status E2Eテスト失敗の調査と修正

## 作業概要

collect-status Lambda関数のE2Eテストで4テストが失敗していた問題を調査し、修正しました。

## 問題の詳細

### 失敗していたテスト

- `pending状態の実行状態を取得できる`
- `running状態の実行状態を取得できる`
- `completed状態の実行状態を取得できる`
- `failed状態の実行状態を取得できる`

### エラー内容

- **エラー**: `Expected: 200, Received: 404`
- **現象**: Lambda関数がDynamoDBからデータを取得できず、404エラーを返していた
- **原因**: テストデータは正常にDynamoDBに挿入されていたが、Lambda関数が正しいテーブル名を使用していなかった

## 調査結果

### 1. 環境変数の読み込みタイミング問題

**問題点**:
```typescript
// handler.ts（修正前）
const EXECUTIONS_TABLE_NAME = process.env.EXECUTION_STATE_TABLE || process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
```

Lambda関数の`handler.ts`では、グローバルスコープで環境変数を読み込んでいました。しかし、E2Eテストファイルでは以下の順序で処理が実行されます：

1. テストファイルの先頭で環境変数を設定
2. `import { handler } from '../handler'` でLambda関数をインポート
3. **インポート時にLambda関数のグローバルスコープが初期化される**

この時点で、テストファイルで設定した環境変数が反映される前に、Lambda関数のグローバルスコープが初期化されてしまい、環境変数が正しく読み込まれていませんでした。

### 2. DynamoDBクライアントの設定

DynamoDBクライアント自体は正しくLocalStackエンドポイントを使用していましたが、テーブル名の取得が問題でした。

### 3. テストデータの挿入

テストデータは正常にDynamoDBに挿入されていました（ログで確認済み）。

## 修正内容

### 環境変数の遅延評価

グローバルスコープでの環境変数読み込みを、関数による遅延評価に変更しました。

**修正前**:
```typescript
const EXECUTIONS_TABLE_NAME = process.env.EXECUTION_STATE_TABLE || process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;
```

**修正後**:
```typescript
// 環境変数を取得する関数（遅延評価）
function getExecutionsTableName(): string {
  return process.env.EXECUTION_STATE_TABLE || process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';
}

function getStateMachineArn(): string | undefined {
  return process.env.STATE_MACHINE_ARN;
}
```

### 関数内での環境変数取得

すべての関数で、環境変数を直接参照するのではなく、遅延評価関数を使用するように変更しました。

**修正箇所**:
1. `handler()` 関数内
2. `getStepFunctionsExecutionStatus()` 関数内
3. `getExecutionStatus()` 関数内

**修正例**:
```typescript
// 修正前
const executionStatus = STATE_MACHINE_ARN
  ? await getStepFunctionsExecutionStatus(execution_id)
  : await getExecutionStatus(execution_id);

// 修正後
const stateMachineArn = getStateMachineArn();
const executionStatus = stateMachineArn
  ? await getStepFunctionsExecutionStatus(execution_id)
  : await getExecutionStatus(execution_id);
```

## E2Eテスト実行結果

### テスト実行コマンド

```powershell
npm run test:e2e -- src/lambda/collect-status/__tests__/handler.e2e.test.ts
```

### 結果

**すべてのテストが成功しました！**

```
PASS  src/lambda/collect-status/__tests__/handler.e2e.test.ts (9.106 s)
  Lambda Collect Status Handler E2E Tests
    実行状態取得
      ✓ pending状態の実行状態を取得できる (30 ms)
      ✓ running状態の実行状態を取得できる (13 ms)
      ✓ completed状態の実行状態を取得できる (13 ms)
      ✓ failed状態の実行状態を取得できる (13 ms)
    エラーハンドリング
      ✓ 存在しないexecution_idの場合は404を返す (62 ms)
      ✓ pathParametersが未定義の場合は400を返す (21 ms)
      ✓ execution_idが空の場合は400を返す (15 ms)
    レスポンス形式
      ✓ 正しいCORSヘッダーを返す (13 ms)
      ✓ Content-Typeヘッダーがapplication/jsonである (12 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
```

### テスト詳細

| テストケース | 結果 | 実行時間 |
|------------|------|---------|
| pending状態の実行状態を取得できる | ✓ | 30 ms |
| running状態の実行状態を取得できる | ✓ | 13 ms |
| completed状態の実行状態を取得できる | ✓ | 13 ms |
| failed状態の実行状態を取得できる | ✓ | 13 ms |
| 存在しないexecution_idの場合は404を返す | ✓ | 62 ms |
| pathParametersが未定義の場合は400を返す | ✓ | 21 ms |
| execution_idが空の場合は400を返す | ✓ | 15 ms |
| 正しいCORSヘッダーを返す | ✓ | 13 ms |
| Content-Typeヘッダーがapplication/jsonである | ✓ | 12 ms |

## 技術的な学び

### 1. Lambda関数のグローバルスコープ初期化タイミング

Lambda関数のグローバルスコープは、関数がインポートされた時点で初期化されます。E2Eテストでは、テストファイルで環境変数を設定する前にLambda関数がインポートされるため、環境変数が反映されない問題が発生します。

**解決策**: 環境変数の読み込みを遅延評価（関数化）することで、実行時に最新の環境変数を取得できます。

### 2. テストでの環境変数設定

E2Eテストでは、以下の順序で環境変数を設定する必要があります：

1. **テストファイルの先頭**で環境変数を設定
2. Lambda関数をインポート
3. テスト実行

ただし、Lambda関数のグローバルスコープで環境変数を読み込む場合、この方法では不十分です。遅延評価を使用することで、この問題を回避できます。

### 3. LocalStack環境でのDynamoDB統合

LocalStack環境では、以下の設定が必要です：

- `AWS_ENDPOINT_URL`: LocalStackエンドポイント（`http://localhost:4566`）
- `AWS_REGION`: リージョン（`ap-northeast-1`）
- `AWS_ACCESS_KEY_ID`: テスト用アクセスキー（`test`）
- `AWS_SECRET_ACCESS_KEY`: テスト用シークレットキー（`test`）

これらの設定は、`jest.setup.e2e.js`で自動的に設定されます。

## 成果物

### 修正ファイル

- `src/lambda/collect-status/handler.ts`: 環境変数の遅延評価に変更

### テスト結果

- すべてのE2Eテスト（9テスト）が成功

## 完了条件の確認

- [x] collect-statusの4テストがすべて成功する
- [x] Lambda関数がDynamoDBからデータを正しく取得できる
- [x] 環境変数の設定が統一されている
- [x] デバッグログが適切に出力される（既存のログで十分）
- [x] 作業記録が作成されている

## 結論

**修正成功**

環境変数の読み込みを遅延評価に変更することで、E2Eテストでの環境変数設定が正しく反映されるようになりました。すべてのテストが成功し、Lambda関数がDynamoDBからデータを正しく取得できることを確認しました。

## 申し送り事項

### 今後の実装での注意点

1. **Lambda関数のグローバルスコープでの環境変数読み込みは避ける**
   - 環境変数は関数による遅延評価を使用する
   - テスト時の環境変数設定が反映されるようにする

2. **E2Eテストでの環境変数設定**
   - テストファイルの先頭で環境変数を設定する
   - Lambda関数のインポート前に設定する
   - ただし、Lambda関数側で遅延評価を使用することが推奨される

3. **他のLambda関数への適用**
   - 同様の問題が発生する可能性がある他のLambda関数でも、環境変数の遅延評価を検討する
   - 特にE2Eテストを実装する際は、この問題に注意する

### 関連タスク

- タスク7: E2Eテスト実装（完了）
- タスク35: collect-status Lambda関数実装（完了）

## 参考資料

- `.kiro/steering/core/error-handling-patterns.md` - エラーハンドリングパターン
- `.kiro/steering/development/lambda-guide.md` - Lambda実装ガイド
- `.kiro/steering/development/testing-strategy.md` - テスト戦略

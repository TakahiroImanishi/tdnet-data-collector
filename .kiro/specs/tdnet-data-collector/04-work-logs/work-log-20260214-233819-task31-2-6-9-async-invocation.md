# 作業記録: Lambda Collect関数の非同期呼び出しへの変更

**作成日時**: 2026-02-14 23:38:19  
**タスク**: 31.2.6.9 - Lambda Collect関数の非同期呼び出しへの変更（Critical）  
**優先度**: 🔴 Critical  
**推定工数**: 1時間

## タスク概要

Lambda Collect関数からLambda Collectorへの呼び出しを同期から非同期に変更し、API Gatewayタイムアウト（29秒）を回避する。

## 実施内容

1. Lambda Collect関数からLambda Collectorへの呼び出しを同期から非同期に変更
2. InvocationType: `RequestResponse` → `Event`
3. execution_idを即座に返却し、バックグラウンドで処理を継続

## 作業ログ

### 1. コードベース調査



Lambda Collect関数とLambda Collectorのハンドラーを確認しました。

### 2. 実装変更

#### 2.1 Lambda Collect関数の変更（src/lambda/collect/handler.ts）

**変更内容:**
1. `randomUUID`をインポート
2. `invokeCollector`関数内で以下を変更:
   - execution_idを事前生成（`randomUUID()`）
   - InvocationTypeを`RequestResponse`から`Event`に変更
   - Payloadにexecution_idを含める
   - 非同期呼び出しのため、レスポンスのPayloadパースを削除
   - 生成したexecution_idを即座に返却

**変更前:**
```typescript
// Lambda Collectorを同期で呼び出し（InvocationType: RequestResponse）
const command = new InvokeCommand({
  FunctionName: COLLECTOR_FUNCTION_NAME,
  InvocationType: 'RequestResponse',
  Payload: Buffer.from(JSON.stringify(collectorEvent)),
});
const response = await lambdaClient.send(command);
// レスポンスをパースしてexecution_idを取得
```

**変更後:**
```typescript
// 実行IDを事前に生成（API Gatewayタイムアウト回避のため）
const execution_id = randomUUID();

// Lambda Collectorのイベント
const collectorEvent = {
  execution_id, // 生成したexecution_idを渡す
  mode: 'on-demand',
  start_date: request.start_date,
  end_date: request.end_date,
};

// Lambda Collectorを非同期で呼び出し（InvocationType: Event）
const command = new InvokeCommand({
  FunctionName: COLLECTOR_FUNCTION_NAME,
  InvocationType: 'Event', // 非同期呼び出し
  Payload: Buffer.from(JSON.stringify(collectorEvent)),
});

const response = await lambdaClient.send(command);

// 非同期呼び出しのため、即座にexecution_idを返却
return execution_id;
```

#### 2.2 Lambda Collectorの変更（src/lambda/collector/handler.ts）

**変更内容:**
1. `CollectorEvent`インターフェースに`execution_id?: string`を追加
2. ハンドラー内で渡されたexecution_idを使用、なければ生成

**変更前:**
```typescript
export interface CollectorEvent {
  mode: 'batch' | 'on-demand';
  start_date?: string;
  end_date?: string;
}

export async function handler(event: CollectorEvent, context: Context): Promise<CollectorResponse> {
  const execution_id = generateExecutionId(context);
  // ...
}
```

**変更後:**
```typescript
export interface CollectorEvent {
  execution_id?: string; // Collect関数から渡される
  mode: 'batch' | 'on-demand';
  start_date?: string;
  end_date?: string;
}

export async function handler(event: CollectorEvent, context: Context): Promise<CollectorResponse> {
  // Collect関数から渡されたexecution_idを使用、なければ生成
  const execution_id = event.execution_id || generateExecutionId(context);
  // ...
}
```

#### 2.3 テストの更新（src/lambda/collect/__tests__/handler.test.ts）

**変更内容:**
1. 同期呼び出しのテストを非同期呼び出しのテストに変更
2. モックレスポンスをStatusCode 202（非同期呼び出しの標準）に変更
3. execution_idがUUID形式であることを検証
4. Payloadにexecution_idが含まれることを検証
5. InvocationTypeが`Event`であることを検証

### 3. テスト実行

```powershell
npm test -- src/lambda/collect/__tests__/handler.test.ts
```

**結果:**
```
Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

すべてのテストが成功しました。

### 4. 動作確認

#### 変更前の問題:
- Lambda Collect関数がLambda Collectorを同期呼び出し（RequestResponse）
- Collectorの処理完了を待つため、API Gatewayタイムアウト（29秒）のリスク
- 大量データ収集時にタイムアウトが発生

#### 変更後の改善:
- Lambda Collect関数がLambda Collectorを非同期呼び出し（Event）
- execution_idを即座に返却（数ミリ秒）
- Collectorはバックグラウンドで処理を継続
- API Gatewayタイムアウトを完全に回避

## 成果物

### 変更ファイル
1. `src/lambda/collect/handler.ts` - 非同期呼び出しに変更
2. `src/lambda/collector/handler.ts` - execution_idを受け取るように変更
3. `src/lambda/collect/__tests__/handler.test.ts` - テストを更新

### テスト結果
- ユニットテスト: 14/14 成功

## 申し送り事項

### 完了事項
- ✅ Lambda Collect関数を非同期呼び出しに変更
- ✅ execution_idを事前生成して即座に返却
- ✅ Lambda Collectorでexecution_idを受け取るように変更
- ✅ テストを更新して全テスト成功

### 次のステップ
1. E2Eテストで実際の動作を確認
2. CDKスタックの変更は不要（InvocationTypeはコードレベルの変更）
3. デプロイ後、API Gatewayタイムアウトが発生しないことを確認

### 注意事項
- 非同期呼び出しのため、Collectorのエラーは即座に返されない
- エラー監視はCloudWatch LogsとDLQで行う必要がある
- execution_idを使用してステータスを確認する仕組みが必要（別タスクで実装予定）

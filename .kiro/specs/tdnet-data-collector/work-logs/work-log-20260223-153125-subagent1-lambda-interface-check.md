# Lambda関数間のインターフェース整合性点検

**作業日時**: 2026-02-23 15:31:25  
**担当**: Subagent 1  
**タスク**: tasks-interface-consistency-check.md セクション1（Lambda関数間のインターフェース）

## 実施内容

Lambda関数間の入出力型定義を点検し、インターフェース整合性を検証しました。

### 点検対象

1. **Step Functions関連Lambda（4関数）**
   - collector-init
   - collector-fetch
   - collector-aggregate
   - collector-save

2. **API Gateway統合Lambda（6関数）**
   - query
   - export
   - get-disclosure
   - collect-status
   - stats
   - health

3. **非同期Lambda（2関数）**
   - dlq-processor
   - api-key-rotation

4. **State Machine定義**
   - `scripts/step-functions/state-machine-definition.json`

## 点検結果

### 1. Step Functions関連Lambda（セクション1.1）

#### 1.1.1 collector-init → collector-fetch

**collector-init出力**:
```typescript
interface InitResponse {
  execution_id: string;
  dates: string[];
  total_days: number;
  total_count: number;
  pages: string[];  // ← Step Functions Map用
  max_items?: number;
  estimated_total: number;
  parameters: {
    start_date: string;
    end_date: string;
    max_items?: number;
  };
}
```

**collector-fetch入力**:
```typescript
interface FetchEvent {
  execution_id: string;
  page_number: string;  // ← 日付文字列（YYYY-MM-DD形式）
  start_date: string;
  end_date: string;
  max_items?: number;
}
```

**State Machine定義**:
```json
"ProcessPages": {
  "Type": "Map",
  "ItemsPath": "$.initResult.Payload.pages",
  "Iterator": {
    "StartAt": "FetchPageData",
    "States": {
      "FetchPageData": {
        "Parameters": {
          "FunctionName": "tdnet-collector-fetch",
          "Payload": {
            "page_number.$": "$.page_number",
            "start_date.$": "$.start_date",
            "end_date.$": "$.end_date",
            "max_items.$": "$.max_items",
            "execution_id.$": "$.execution_id"
          }
        }
      }
    }
  }
}
```

**不整合**: ❌ **Critical**
- **問題**: State MachineのMap状態が`pages`配列を反復処理するが、各要素は文字列（日付）のみ
- **影響**: `start_date`, `end_date`, `max_items`, `execution_id`がMap Iteratorに渡されない
- **原因**: Map状態の各要素は単なる文字列だが、FetchEventは複数のフィールドを要求
- **修正案**: 
  1. InitResponseの`pages`を文字列配列からオブジェクト配列に変更
  2. または、State Machine定義でContext変数を使用して親スコープから値を参照

#### 1.1.2 collector-fetch → collector-save

**collector-fetch出力**:
```typescript
interface FetchResponse {
  execution_id: string;
  page_number: string;
  items: DisclosureMetadata[];
  count: number;
}
```

**collector-save入力**:
```typescript
interface SaveEvent {
  execution_id: string;
  page_number: string;
  items: DisclosureMetadata[];
}
```

**State Machine定義**:
```json
"SavePageData": {
  "Parameters": {
    "FunctionName": "tdnet-collector-save",
    "Payload": {
      "items.$": "$.fetchResult.Payload.items",
      "page_number.$": "$.fetchResult.Payload.page_number",
      "execution_id.$": "$.execution_id"
    }
  }
}
```

**整合性**: ✅ **OK**
- FetchResponseの`items`, `page_number`が正しくSaveEventに渡される
- `execution_id`はMap Iteratorのコンテキストから取得（要確認）

#### 1.1.3 collector-save → collector-aggregate

**collector-save出力**:
```typescript
interface SaveResponse {
  execution_id: string;
  page_number: string;
  saved_count: number;
  failed_count: number;
  failed_items: Array<{
    disclosure_id: string;
    error: string;
  }>;
}
```

**collector-aggregate入力**:
```typescript
interface AggregateEvent {
  execution_id: string;
  results: Array<{
    saveResult?: {
      page_number: string;
      saved_count: number;
      failed_count: number;
    };
  }>;
}
```

**State Machine定義**:
```json
"AggregateResults": {
  "Parameters": {
    "FunctionName": "tdnet-collector-aggregate",
    "Payload": {
      "execution_id.$": "$.initResult.Payload.execution_id",
      "map_results.$": "$.mapResult"
    }
  }
}
```

**不整合**: ⚠️ **High**
- **問題1**: State Machineが`map_results`を渡すが、AggregateEventは`results`を期待
- **問題2**: AggregateEventの`results`配列の要素は`saveResult`プロパティを持つオブジェクトだが、State MachineのMap結果形式が不明確
- **問題3**: SaveResponseの`failed_items`がAggregateEventに含まれていない（集約時に失敗詳細が失われる）
- **修正案**: 
  1. AggregateEventのフィールド名を`map_results`に統一
  2. Map結果の構造を明確化（Step FunctionsのMap状態は`$.saveResult.Payload`を返す）
  3. `failed_items`を集約処理に含めるか検討

#### 1.1.4 State Machine定義との整合性

**不整合**: ❌ **Critical**

1. **CollectorInit呼び出し**:
```json
"Parameters": {
  "FunctionName": "tdnet-collector-init",
  "Payload": {
    "start_date.$": "$.start_date",
    "end_date.$": "$.end_date"
  }
}
```
- **問題**: `execution_id`が渡されていない
- **影響**: InitEventは`execution_id`を必須としているが、State Machineから渡されない
- **修正案**: State Machineの実行IDを`$$.Execution.Name`で取得して渡す

2. **Map Iterator変数スコープ**:
- **問題**: Map Iteratorの各要素は文字列（日付）のみだが、FetchEventは`execution_id`, `start_date`, `end_date`, `max_items`を要求
- **影響**: FetchEventに必要な値が渡されない
- **修正案**: Context変数（`$$.Map.Item.Value`）と親スコープ変数（`$.initResult.Payload.*`）を組み合わせる

### 2. API Gateway統合Lambda（セクション1.2）

#### 2.1 共通インターフェース

すべてのAPI Gateway統合Lambda関数は以下の型を使用:

**入力**: `APIGatewayProxyEvent`
**出力**: `APIGatewayProxyResult`

**整合性**: ✅ **OK**
- すべての関数が標準的なAPI Gateway統合型を使用
- `event.queryStringParameters`, `event.pathParameters`, `event.body`を適切に使用

#### 2.2 個別関数の点検

| 関数 | 入力型 | 出力型 | 整合性 |
|------|--------|--------|--------|
| query | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |
| export | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |
| get-disclosure | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |
| collect-status | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |
| stats | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |
| health | APIGatewayProxyEvent | APIGatewayProxyResult | ✅ OK |

**注意点**:
- `query`関数: `QueryEvent extends APIGatewayProxyEvent`で型を拡張（問題なし）
- `export`関数: `ExportEvent`型を独自定義（`types.ts`に定義されていない可能性）
- `collect-status`関数: Step Functions統合時は`DescribeExecutionCommand`を使用（環境変数`STATE_MACHINE_ARN`で切り替え）

### 3. 非同期Lambda（セクション1.3）

#### 3.1 dlq-processor

**入力**: `SQSEvent`
**出力**: `void` (Promise<void>)

**整合性**: ✅ **OK**
- 標準的なSQSイベント処理
- DLQメッセージを処理してSNS通知を送信

#### 3.2 api-key-rotation

**入力**: Secrets Manager Rotation Event
```typescript
{
  SecretId: string;
  Token: string;
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
}
```

**出力**: `void` (Promise<void>)

**整合性**: ✅ **OK**
- Secrets Managerの標準的なローテーションイベント
- 4ステップのローテーション処理を実装

### 4. 型定義ファイルとの整合性

#### 4.1 `src/types/index.ts`との比較

**不整合**: ⚠️ **Medium**

1. **ExecutionStatus型の不一致**:
   - `types/index.ts`: `status: 'pending' | 'running' | 'completed' | 'failed'`
   - `collect-status/handler.ts`: `status: 'running' | 'succeeded' | 'failed' | 'timed_out' | 'aborted' | 'pending' | 'completed'`
   - **影響**: Step Functions統合時に`succeeded`, `timed_out`, `aborted`が追加される
   - **修正案**: `types/index.ts`の`ExecutionStatus`型を更新

2. **ExportEvent型の欠落**:
   - `export/handler.ts`で`ExportEvent`型を使用しているが、`types/index.ts`に定義されていない
   - **影響**: 型定義の一貫性が欠如
   - **修正案**: `types/index.ts`に`ExportEvent`型を追加

3. **DisclosureMetadata型の重複**:
   - `scraper/html-parser.ts`で`DisclosureMetadata`を定義
   - `types/index.ts`の`Disclosure`型と類似だが、フィールドが異なる
   - **影響**: 型の使い分けが不明確
   - **修正案**: 
     - `DisclosureMetadata`: スクレイピング結果（PDF未ダウンロード）
     - `Disclosure`: DynamoDB保存用（PDF S3キー含む）
     - 用途を明確化してドキュメント化

#### 4.2 `src/scraper/html-parser.ts`との整合性

**DisclosureMetadata型**:
```typescript
interface DisclosureMetadata {
  company_code: string;
  company_name: string;
  disclosure_type: string;
  title: string;
  disclosed_at: string; // ISO 8601形式（UTC）
  pdf_url: string;
}
```

**使用箇所**:
- `collector-fetch/handler.ts`: FetchResponseの`items`
- `collector-save/handler.ts`: SaveEventの`items`

**整合性**: ✅ **OK**
- Step Functions関連Lambda間で一貫して使用されている

## 不整合リスト（優先度順）

### Critical（即座に修正が必要）

1. **[C-1] State Machine Map Iterator変数スコープ問題**
   - **箇所**: `scripts/step-functions/state-machine-definition.json` - ProcessPages Map状態
   - **問題**: Map Iteratorの各要素は文字列（日付）のみだが、FetchEventは複数フィールドを要求
   - **影響**: collector-fetchが必要なパラメータを受け取れず、実行時エラーが発生
   - **修正方法**: 
     - Option 1: InitResponseの`pages`をオブジェクト配列に変更
     - Option 2: State Machine定義でContext変数を使用

2. **[C-2] CollectorInit実行ID欠落**
   - **箇所**: `scripts/step-functions/state-machine-definition.json` - CollectorInit呼び出し
   - **問題**: `execution_id`が渡されていない
   - **影響**: InitEventのバリデーションエラーが発生
   - **修正方法**: `"execution_id.$": "$$.Execution.Name"`を追加

### High（早急に修正が推奨）

3. **[H-1] AggregateEventフィールド名不一致**
   - **箇所**: `collector-aggregate/handler.ts` - AggregateEvent型
   - **問題**: State Machineが`map_results`を渡すが、AggregateEventは`results`を期待
   - **影響**: 実行時にフィールドが見つからずエラー
   - **修正方法**: AggregateEventのフィールド名を`map_results`に統一

4. **[H-2] SaveResponse失敗詳細の欠落**
   - **箇所**: `collector-aggregate/handler.ts` - AggregateEvent型
   - **問題**: SaveResponseの`failed_items`がAggregateEventに含まれていない
   - **影響**: 失敗した開示情報の詳細が集約時に失われる
   - **修正方法**: AggregateEventに`failed_items`を追加、または別途ログ記録

### Medium（修正が望ましい）

5. **[M-1] ExecutionStatus型の不一致**
   - **箇所**: `types/index.ts` vs `collect-status/handler.ts`
   - **問題**: Step Functions統合時に`succeeded`, `timed_out`, `aborted`が追加される
   - **影響**: 型定義の一貫性が欠如
   - **修正方法**: `types/index.ts`の`ExecutionStatus`型を更新

6. **[M-2] ExportEvent型の欠落**
   - **箇所**: `types/index.ts`
   - **問題**: `export/handler.ts`で使用されているが定義されていない
   - **影響**: 型定義の一貫性が欠如
   - **修正方法**: `types/index.ts`に`ExportEvent`型を追加

### Low（ドキュメント化で対応可能）

7. **[L-1] DisclosureMetadata vs Disclosure型の使い分け**
   - **箇所**: `scraper/html-parser.ts` vs `types/index.ts`
   - **問題**: 類似した型が2つ存在し、用途が不明確
   - **影響**: 開発者が混乱する可能性
   - **修正方法**: 用途をドキュメント化（DisclosureMetadata: スクレイピング結果、Disclosure: DynamoDB保存用）

## 推奨修正順序

1. **[C-1] State Machine Map Iterator変数スコープ問題** - 最優先
2. **[C-2] CollectorInit実行ID欠落** - 最優先
3. **[H-1] AggregateEventフィールド名不一致** - 高優先度
4. **[H-2] SaveResponse失敗詳細の欠落** - 高優先度
5. **[M-1] ExecutionStatus型の不一致** - 中優先度
6. **[M-2] ExportEvent型の欠落** - 中優先度
7. **[L-1] DisclosureMetadata vs Disclosure型の使い分け** - 低優先度（ドキュメント化）

## 申し送り事項

### 次のタスクへの影響

- **[C-1], [C-2]**: Step Functions E2Eテストが失敗する可能性が高い
- **[H-1]**: collector-aggregateの統合テストが失敗する
- **[M-1], [M-2]**: 型チェック（`npm run type-check`）でエラーが発生する可能性

### 修正時の注意点

1. **State Machine定義の修正**:
   - LocalStack環境とAWS本番環境の両方で動作確認が必要
   - Map状態のContext変数の使用方法を確認（AWS Step Functions公式ドキュメント参照）

2. **型定義の修正**:
   - `types/index.ts`を修正した場合、すべてのLambda関数で型チェックを実行
   - 既存のテストコードへの影響を確認

3. **後方互換性**:
   - ExecutionStatus型の変更は既存のDynamoDBデータに影響する可能性
   - マイグレーション戦略を検討

## 成果物

- ✅ Lambda関数間のインターフェース整合性点検完了
- ✅ 不整合リスト作成（7件: Critical 2件、High 2件、Medium 2件、Low 1件）
- ✅ 優先度付けと修正順序の提案
- ✅ 作業記録作成

## 参考資料

- `src/lambda/collector-init/handler.ts`
- `src/lambda/collector-fetch/handler.ts`
- `src/lambda/collector-aggregate/handler.ts`
- `src/lambda/collector-save/handler.ts`
- `src/lambda/query/handler.ts`
- `src/lambda/export/handler.ts`
- `src/lambda/get-disclosure/handler.ts`
- `src/lambda/collect-status/handler.ts`
- `src/lambda/stats/handler.ts`
- `src/lambda/health/handler.ts`
- `src/lambda/dlq-processor/index.ts`
- `src/lambda/api-key-rotation/index.ts`
- `scripts/step-functions/state-machine-definition.json`
- `src/types/index.ts`
- `src/scraper/html-parser.ts`

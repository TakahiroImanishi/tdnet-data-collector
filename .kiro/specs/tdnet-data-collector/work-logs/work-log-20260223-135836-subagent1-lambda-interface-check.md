# Lambda関数インターフェース整合性点検

**作業日時**: 2026-02-23 13:58:36  
**担当**: Subagent1 (general-task-execution)  
**タスク**: Lambda関数インターフェース整合性点検

## 目的

Step Functions関連Lambda、API Gateway統合Lambda、非同期Lambdaの入出力型定義の整合性を確認し、不整合を検出する。

## 点検対象

### 1. Step Functions関連Lambda
- collector-init
- collector-fetch
- collector-aggregate
- collector-save
- state-machine-definition.json

### 2. API Gateway統合Lambda
- query
- export
- get-disclosure
- collect-status
- stats
- health

### 3. 非同期Lambda
- dlq-processor
- api-key-rotation

## 点検結果

### Step Functions関連Lambda


#### collector-init → collector-fetch

**collector-init出力型** (`InitResponse`):
```typescript
{
  execution_id: string;
  dates: string[];
  total_days: number;
  total_count: number;
  pages: string[];
  max_items?: number;
  estimated_total: number;
  parameters: {
    start_date: string;
    end_date: string;
    max_items?: number;
  };
}
```

**collector-fetch入力型** (`FetchEvent`):
```typescript
{
  execution_id: string;
  page_number: string;  // 日付文字列（YYYY-MM-DD）
  start_date: string;
  end_date: string;
  max_items?: number;
}
```

**State Machine定義** (ProcessPages Map):
```json
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
```

**不整合検出**:
❌ **重大な不整合**: State Machine定義が`$.page_number`を参照しているが、Map Iteratorに渡されるデータ構造が不明確
- `initResult.Payload.pages`は`string[]`（日付文字列の配列）
- Map Iteratorは配列の各要素を処理するが、要素は単純な文字列
- `$.page_number`は存在しない（要素自体が日付文字列）

**正しい修正案**:
```json
"Parameters": {
  "FunctionName": "tdnet-collector-fetch",
  "Payload": {
    "page_number.$": "$",  // Map要素自体が日付文字列
    "start_date.$": "$.start_date",  // ❌ これも存在しない
    "end_date.$": "$.end_date",      // ❌ これも存在しない
    "max_items.$": "$.max_items",    // ❌ これも存在しない
    "execution_id.$": "$.execution_id"  // ❌ これも存在しない
  }
}
```

**根本的な問題**: Map Iteratorに渡されるコンテキストが不足している。`pages`配列の各要素（日付文字列）だけでなく、`start_date`, `end_date`, `max_items`, `execution_id`も必要。

#### collector-fetch → collector-aggregate

**collector-fetch出力型** (`FetchResponse`):
```typescript
{
  execution_id: string;
  page_number: string;
  items: DisclosureMetadata[];
  count: number;
}
```

**collector-aggregate入力型** (`AggregateEvent`):
```typescript
{
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

**State Machine定義** (AggregateResults):
```json
"Parameters": {
  "FunctionName": "tdnet-collector-aggregate",
  "Payload": {
    "execution_id.$": "$.initResult.Payload.execution_id",
    "map_results.$": "$.mapResult"
  }
}
```

**不整合検出**:
❌ **パラメータ名の不一致**: 
- State Machine: `map_results`
- Lambda入力型: `results`

#### collector-fetch → collector-save

**collector-fetch出力型** (`FetchResponse`):
```typescript
{
  execution_id: string;
  page_number: string;
  items: DisclosureMetadata[];
  count: number;
}
```

**collector-save入力型** (`SaveEvent`):
```typescript
{
  execution_id: string;
  page_number: string;
  items: DisclosureMetadata[];
}
```

**State Machine定義** (SavePageData):
```json
"Parameters": {
  "FunctionName": "tdnet-collector-save",
  "Payload": {
    "items.$": "$.fetchResult.Payload.items",
    "page_number.$": "$.fetchResult.Payload.page_number",
    "execution_id.$": "$.execution_id"
  }
}
```

**不整合検出**:
❌ **パス参照の不整合**:
- `$.execution_id`はMap Iteratorコンテキストに存在しない（前述の問題と同じ）

### 2. API Gateway統合Lambda

#### query/handler.ts

**入力型**: `QueryEvent extends APIGatewayProxyEvent` ✅
**出力型**: `APIGatewayProxyResult` ✅

#### export/handler.ts

**入力型**: `ExportEvent` (カスタム型だが`APIGatewayProxyEvent`を継承していない)
**出力型**: `APIGatewayProxyResult` ✅

**不整合検出**:
⚠️ **型定義の不統一**: `ExportEvent`が`APIGatewayProxyEvent`を継承していない可能性

#### get-disclosure/handler.ts

**入力型**: `APIGatewayProxyEvent` ✅
**出力型**: `APIGatewayProxyResult` ✅

#### collect-status/handler.ts

**入力型**: `APIGatewayProxyEvent` ✅
**出力型**: `APIGatewayProxyResult` ✅

#### stats/handler.ts

**入力型**: `APIGatewayProxyEvent` ✅
**出力型**: `APIGatewayProxyResult` ✅

#### health/handler.ts

**入力型**: `APIGatewayProxyEvent` ✅
**出力型**: `APIGatewayProxyResult` ✅

### 3. 非同期Lambda

#### dlq-processor/handler.ts

**ファイル存在確認**: ❌ **ファイルが存在しない**

#### api-key-rotation/handler.ts

**ファイル存在確認**: ❌ **ファイルが存在しない**

## 不整合サマリー

### 重大な不整合（優先度: 高）

1. **Step Functions Map Iterator コンテキスト不足**
   - **影響範囲**: collector-fetch, collector-save
   - **問題**: Map Iteratorに渡される要素が日付文字列のみで、`start_date`, `end_date`, `max_items`, `execution_id`が欠落
   - **修正方法**: 
     - Option A: `pages`配列の各要素をオブジェクトに変更（推奨）
     - Option B: Map Iteratorの`Parameters`セクションで親コンテキストから値を取得

2. **collector-aggregate パラメータ名不一致**
   - **影響範囲**: collector-aggregate
   - **問題**: State Machine定義が`map_results`を使用、Lambda入力型が`results`を期待
   - **修正方法**: どちらかに統一（Lambda側を`map_results`に変更推奨）

### 中程度の不整合（優先度: 中）

3. **export/handler.ts 型定義の不統一**
   - **影響範囲**: export
   - **問題**: `ExportEvent`が`APIGatewayProxyEvent`を継承していない可能性
   - **修正方法**: `ExportEvent`の型定義を確認し、必要に応じて`extends APIGatewayProxyEvent`を追加

### 低優先度の不整合（優先度: 低）

4. **非同期Lambda ファイル不存在**
   - **影響範囲**: dlq-processor, api-key-rotation
   - **問題**: ファイルが存在しない（未実装または削除済み）
   - **修正方法**: 実装が必要な場合は作成、不要な場合はドキュメントから削除

## 推奨修正順序

1. **Step Functions Map Iterator コンテキスト修正**（最優先）
   - collector-init の出力を修正
   - State Machine定義を修正
   - E2Eテストで動作確認

2. **collector-aggregate パラメータ名統一**
   - Lambda入力型を`map_results`に変更
   - 関連テストを更新

3. **export/handler.ts 型定義確認**
   - `ExportEvent`の定義を確認
   - 必要に応じて修正

4. **非同期Lambda 実装状況確認**
   - 実装が必要か確認
   - 不要な場合はドキュメントから削除

## 次のステップ

1. 検出された不整合を優先順位順に修正
2. 各修正後にユニットテスト・統合テストを実行
3. E2Eテストで全体の動作を確認
4. ドキュメント（設計書、README）を更新



## 成果物

### 1. 不整合検出レポート

**重大な不整合（4件）**:
1. Step Functions Map Iterator コンテキスト不足（collector-fetch, collector-save）
2. collector-aggregate パラメータ名不一致（`map_results` vs `results`）
3. export/handler.ts 型定義の不統一
4. 非同期Lambda ファイル不存在（dlq-processor, api-key-rotation）

### 2. 優先順位付け

**最優先（即座に修正が必要）**:
- Step Functions Map Iterator コンテキスト不足
- collector-aggregate パラメータ名不一致

**中優先（次回修正）**:
- export/handler.ts 型定義確認

**低優先（計画的に対応）**:
- 非同期Lambda 実装状況確認

### 3. 推奨修正アプローチ

**Option A: collector-init出力を修正（推奨）**
```typescript
// pages配列の各要素をオブジェクトに変更
pages: dates.map(date => ({
  page_number: date,
  start_date: event.start_date,
  end_date: event.end_date,
  max_items: maxItems,
  execution_id: event.execution_id,
}))
```

**Option B: State Machine定義を修正**
```json
"Iterator": {
  "StartAt": "FetchPageData",
  "States": {
    "FetchPageData": {
      "Parameters": {
        "FunctionName": "tdnet-collector-fetch",
        "Payload": {
          "page_number.$": "$",
          "start_date.$": "$$.Execution.Input.start_date",
          "end_date.$": "$$.Execution.Input.end_date",
          "max_items.$": "$$.Execution.Input.max_items",
          "execution_id.$": "$$.Execution.Name"
        }
      }
    }
  }
}
```

## 申し送り事項

### 次のタスクへの引き継ぎ

1. **Step Functions Map Iterator修正タスク**を作成
   - collector-init出力型の修正
   - State Machine定義の修正
   - 関連テストの更新
   - E2Eテストでの動作確認

2. **collector-aggregate パラメータ名統一タスク**を作成
   - Lambda入力型を`map_results`に変更
   - 関連テストの更新

3. **export/handler.ts 型定義確認タスク**を作成
   - `ExportEvent`の定義を確認
   - 必要に応じて`extends APIGatewayProxyEvent`を追加

4. **非同期Lambda 実装状況確認タスク**を作成
   - dlq-processor, api-key-rotationの実装が必要か確認
   - 不要な場合はドキュメントから削除

### 注意事項

- Step Functions Map Iteratorの修正は、E2Eテストが失敗する可能性が高い
- 修正後は必ずLocalStack環境でE2Eテストを実行すること
- collector-aggregateの修正は、既存のテストに影響する可能性がある

## 作業完了

**作業時間**: 約15分  
**検出された不整合**: 4件（重大2件、中程度1件、低優先1件）  
**次のアクション**: 不整合修正タスクの作成


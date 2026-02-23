# Step Functionsワークフロー図

**作成日**: 2026-02-22
**バージョン**: 1.0
**関連タスク**: tasks-step-functions-migration.md タスク1.1

## 概要

TDnetデータ収集処理をAWS Step Functionsでオーケストレーションするためのワークフロー設計。Standard Workflowsを使用し、長時間実行、可視性、エラーハンドリング、並列処理の最適化を実現。

## 1. 状態遷移図（全体フロー）

```mermaid
stateDiagram-v2
    [*] --> Initialize: 実行開始
    
    Initialize: 初期化
    Initialize: - パラメータ検証
    Initialize: - 実行状態作成(pending)
    Initialize: - 日付範囲生成
    
    Initialize --> FetchMetadata: 成功
    Initialize --> HandleError: 検証エラー
    
    FetchMetadata: メタデータ取得
    FetchMetadata: - TDnetリストスクレイピング
    FetchMetadata: - 総件数・ページ数取得
    FetchMetadata: - 実行状態更新(running)
    
    FetchMetadata --> CheckEmpty: 成功
    FetchMetadata --> RetryFetch: 一時的エラー
    FetchMetadata --> HandleError: 致命的エラー
    
    RetryFetch: リトライ
    RetryFetch: - 指数バックオフ
    RetryFetch: - 最大3回
    RetryFetch --> FetchMetadata: 再試行
    RetryFetch --> HandleError: リトライ上限
    
    CheckEmpty: 件数チェック
    CheckEmpty --> ProcessDisclosures: 件数 > 0
    CheckEmpty --> Aggregate: 件数 = 0
    
    ProcessDisclosures: 並列処理(Map状態)
    ProcessDisclosures: - 並列度: 5
    ProcessDisclosures: - PDFダウンロード
    ProcessDisclosures: - DynamoDB/S3保存
    
    ProcessDisclosures --> Aggregate: 完了
    ProcessDisclosures --> HandleError: 全件失敗
    
    Aggregate: 結果集約
    Aggregate: - 成功/失敗件数集計
    Aggregate: - 統計情報計算
    Aggregate: - 実行状態更新(completed)
    
    Aggregate --> Success: 成功
    Aggregate --> PartialSuccess: 部分的成功
    
    Success: 完了(success)
    PartialSuccess: 完了(partial_success)
    HandleError: エラー処理
    HandleError: - 実行状態更新(failed)
    HandleError: - エラーログ記録
    HandleError: - CloudWatchアラーム
    
    Success --> [*]
    PartialSuccess --> [*]
    HandleError --> [*]
```

## 2. シーケンス図（Lambda関数間の連携）

```mermaid
sequenceDiagram
    participant API as API Gateway
    participant SF as Step Functions
    participant Init as collector-init
    participant Fetch as collector-fetch
    participant Save as collector-save
    participant Agg as collector-aggregate
    participant DDB as DynamoDB
    participant S3 as S3
    participant TDnet as TDnet API
    
    API->>SF: StartExecution
    Note over SF: execution_id生成
    SF->>API: execution_id返却
    
    SF->>Init: Invoke
    Init->>DDB: PutItem(execution_state)
    Note over DDB: status: pending
    Init->>Init: パラメータ検証
    Init->>Init: 日付範囲生成
    Init->>DDB: UpdateItem(status: running)
    Init-->>SF: {dates, execution_id}
    
    loop 各日付
        SF->>Fetch: Invoke(date)
        Fetch->>TDnet: GET /list?date=YYYY-MM-DD
        Note over Fetch: レート制限: 1req/sec
        TDnet-->>Fetch: HTML(開示リスト)
        Fetch->>Fetch: HTMLパース
        Fetch-->>SF: {disclosures[]}
        
        Note over SF: Map状態開始
        par 並列処理(最大5並列)
            SF->>Save: Invoke(disclosure_1)
            Save->>TDnet: GET /pdf/xxx.pdf
            TDnet-->>Save: PDF
            Save->>S3: PutObject(PDF)
            Save->>DDB: PutItem(metadata)
            Save-->>SF: {success: true}
        and
            SF->>Save: Invoke(disclosure_2)
            Save->>TDnet: GET /pdf/yyy.pdf
            TDnet-->>Save: PDF
            Save->>S3: PutObject(PDF)
            Save->>DDB: PutItem(metadata)
            Save-->>SF: {success: true}
        and
            SF->>Save: Invoke(disclosure_N)
            Note over Save: 最大5並列
        end
        Note over SF: Map状態完了
    end
    
    SF->>Agg: Invoke(results)
    Agg->>Agg: 成功/失敗件数集計
    Agg->>Agg: 統計情報計算
    Agg->>DDB: UpdateItem(status: completed)
    Agg-->>SF: {collected_count, failed_count}
    
    SF-->>API: ExecutionSucceeded
```


## 3. 並列処理図（Map状態の詳細）

```mermaid
stateDiagram-v2
    [*] --> MapState: 開示リスト入力
    
    state MapState {
        [*] --> Distribute: 配分
        
        Distribute: アイテム配分
        Distribute: - MaxConcurrency: 5
        Distribute: - ItemsPath: $.disclosures
        
        state fork_state <<fork>>
        Distribute --> fork_state
        
        fork_state --> Worker1: disclosure_1
        fork_state --> Worker2: disclosure_2
        fork_state --> Worker3: disclosure_3
        fork_state --> Worker4: disclosure_4
        fork_state --> Worker5: disclosure_5
        
        state Worker1 {
            [*] --> Download1: PDFダウンロード
            Download1 --> Validate1: 成功
            Download1 --> Retry1: 一時的エラー
            Retry1 --> Download1: 再試行
            Retry1 --> Error1: リトライ上限
            Validate1 --> Save1: 検証OK
            Validate1 --> Error1: 検証NG
            Save1 --> [*]: 完了
            Error1 --> [*]: 失敗
        }
        
        state Worker2 {
            [*] --> Download2
            Download2 --> Save2
            Save2 --> [*]
        }
        
        state Worker3 {
            [*] --> Download3
            Download3 --> Save3
            Save3 --> [*]
        }
        
        state Worker4 {
            [*] --> Download4
            Download4 --> Save4
            Save4 --> [*]
        }
        
        state Worker5 {
            [*] --> Download5
            Download5 --> Save5
            Save5 --> [*]
        }
        
        state join_state <<join>>
        Worker1 --> join_state
        Worker2 --> join_state
        Worker3 --> join_state
        Worker4 --> join_state
        Worker5 --> join_state
        
        join_state --> Collect: 結果収集
        Collect --> [*]
    }
    
    MapState --> [*]: 結果配列出力
```

## 4. エラーハンドリングフロー

```mermaid
stateDiagram-v2
    [*] --> Operation: Lambda実行
    
    Operation --> CheckError: エラー発生
    Operation --> Success: 成功
    
    CheckError: エラー種別判定
    
    state CheckError {
        [*] --> Classify
        
        Classify: エラー分類
        Classify --> Retryable: ネットワークエラー
        Classify --> Retryable: タイムアウト
        Classify --> Retryable: ThrottlingException
        Classify --> Retryable: 5xx
        Classify --> NonRetryable: 認証エラー(401/403)
        Classify --> NonRetryable: NotFound(404)
        Classify --> NonRetryable: BadRequest(400)
        Classify --> NonRetryable: ValidationError
        
        Retryable --> [*]: Retry設定適用
        NonRetryable --> [*]: Catch設定適用
    }
    
    CheckError --> Retry: Retryable
    CheckError --> Catch: NonRetryable
    
    Retry: リトライ処理
    Retry: - IntervalSeconds: 2
    Retry: - MaxAttempts: 3
    Retry: - BackoffRate: 2.0
    
    Retry --> Operation: 再試行
    Retry --> Catch: リトライ上限
    
    Catch: エラーハンドリング
    Catch: - エラーログ記録
    Catch: - DLQへ送信
    Catch: - CloudWatchアラーム
    Catch: - 実行状態更新(failed)
    
    Success --> [*]
    Catch --> [*]
```

## 5. 状態定義（Amazon States Language）

### 5.1 Initialize State

```json
{
  "Initialize": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:collector-init",
    "TimeoutSeconds": 60,
    "Retry": [
      {
        "ErrorEquals": ["States.TaskFailed"],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2.0
      }
    ],
    "Catch": [
      {
        "ErrorEquals": ["ValidationError"],
        "ResultPath": "$.error",
        "Next": "HandleValidationError"
      },
      {
        "ErrorEquals": ["States.ALL"],
        "ResultPath": "$.error",
        "Next": "HandleError"
      }
    ],
    "Next": "FetchMetadata"
  }
}
```

### 5.2 FetchMetadata State

```json
{
  "FetchMetadata": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:collector-fetch",
    "TimeoutSeconds": 300,
    "Retry": [
      {
        "ErrorEquals": ["NetworkError", "TimeoutError"],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2.0
      }
    ],
    "Catch": [
      {
        "ErrorEquals": ["States.ALL"],
        "ResultPath": "$.error",
        "Next": "HandleError"
      }
    ],
    "Next": "CheckEmpty"
  }
}
```

### 5.3 ProcessDisclosures State (Map)

```json
{
  "ProcessDisclosures": {
    "Type": "Map",
    "ItemsPath": "$.disclosures",
    "MaxConcurrency": 5,
    "Iterator": {
      "StartAt": "SaveDisclosure",
      "States": {
        "SaveDisclosure": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:collector-save",
          "TimeoutSeconds": 120,
          "Retry": [
            {
              "ErrorEquals": ["NetworkError", "S3Error"],
              "IntervalSeconds": 2,
              "MaxAttempts": 3,
              "BackoffRate": 2.0
            }
          ],
          "Catch": [
            {
              "ErrorEquals": ["States.ALL"],
              "ResultPath": "$.error",
              "Next": "LogError"
            }
          ],
          "End": true
        },
        "LogError": {
          "Type": "Pass",
          "Result": {"success": false},
          "End": true
        }
      }
    },
    "ResultPath": "$.results",
    "Next": "Aggregate"
  }
}
```

### 5.4 Aggregate State

```json
{
  "Aggregate": {
    "Type": "Task",
    "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:collector-aggregate",
    "TimeoutSeconds": 60,
    "Retry": [
      {
        "ErrorEquals": ["States.TaskFailed"],
        "IntervalSeconds": 2,
        "MaxAttempts": 3,
        "BackoffRate": 2.0
      }
    ],
    "Next": "CheckStatus"
  }
}
```

## 6. タイムアウト設定

| State | タイムアウト | 理由 |
|-------|------------|------|
| Initialize | 60秒 | パラメータ検証、DynamoDB書き込み |
| FetchMetadata | 300秒 | TDnet APIスクレイピング（最大5分） |
| SaveDisclosure | 120秒 | PDFダウンロード、S3/DynamoDB書き込み |
| Aggregate | 60秒 | 結果集約、統計計算 |
| 全体 | 1時間 | 大量データ収集時の余裕を持たせる |

## 7. 並列実行制御

### 7.1 Map状態のMaxConcurrency

- **設定値**: 5
- **理由**:
  - TDnet APIのレート制限（1リクエスト/秒）を考慮
  - Lambda同時実行数の制限（アカウント全体で1000）
  - コスト最適化（無料枠内での運用）

### 7.2 レート制限の実装

```typescript
// collector-save Lambda内でレート制限を実装
import { RateLimiter } from '../../utils/rate-limiter';

const rateLimiter = new RateLimiter(1, 1000); // 1リクエスト/秒

export async function handler(event: SaveEvent) {
  await rateLimiter.acquire();
  // PDFダウンロード処理
}
```

## 8. 進捗追跡

### 8.1 DynamoDB実行状態テーブル

```typescript
interface ExecutionState {
  execution_id: string;           // PK
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time: string;             // ISO 8601
  end_time?: string;              // ISO 8601
  progress: number;               // 0-100
  collected_count: number;
  failed_count: number;
  total_count: number;
  error_message?: string;
  ttl: number;                    // 30日後削除
}
```

### 8.2 進捗更新タイミング

1. **Initialize**: status = 'pending', progress = 0
2. **FetchMetadata**: status = 'running', total_count設定
3. **Map状態（各バッチ完了時）**: progress更新、collected_count/failed_count更新
4. **Aggregate**: status = 'completed'/'failed', progress = 100

## 9. コスト試算

### 9.1 Step Functions料金

- **Standard Workflows**: $25/100万状態遷移
- **1回の実行**: 約10-20状態遷移
  - Initialize: 1
  - FetchMetadata: 1-5（日付数）
  - Map状態: 1
  - SaveDisclosure: N（開示件数、ただしMap内部なので課金対象外）
  - Aggregate: 1
  - エラーハンドリング: 0-3
- **月間200回実行**: 2,000-4,000状態遷移 = **無料枠内（4,000/月）**

### 9.2 Lambda料金

- **collector-init**: 128MB, 5秒, 200回/月 = 無料枠内
- **collector-fetch**: 256MB, 30秒, 1,000回/月 = 無料枠内
- **collector-save**: 512MB, 10秒, 100,000回/月 = 無料枠内
- **collector-aggregate**: 128MB, 5秒, 200回/月 = 無料枠内

**合計**: 無料枠内で運用可能

## 10. 実装優先順位

### フェーズ1: 基本フロー（高優先度）
1. Initialize State
2. FetchMetadata State
3. Map State (SaveDisclosure)
4. Aggregate State

### フェーズ2: エラーハンドリング（高優先度）
1. Retry設定
2. Catch設定
3. DLQ連携
4. CloudWatchアラーム

### フェーズ3: 最適化（中優先度）
1. 並列度調整
2. タイムアウト調整
3. 進捗追跡の詳細化

## 11. 関連ドキュメント

- `tasks-step-functions-migration.md` - 移行タスク一覧
- `step-functions-architecture.md` - アーキテクチャ設計（作成予定）
- `step-functions-cost-analysis.md` - コスト分析（作成予定）
- `../../core/tdnet-implementation-rules.md` - 実装ルール
- `../../core/error-handling-patterns.md` - エラーハンドリング

## 12. 次のステップ

1. Lambda関数の分割設計（タスク1.1）
2. DynamoDB実行状態管理設計（タスク1.1）
3. ステートマシン定義の詳細化（タスク1.2）
4. Lambda関数の実装（フェーズ2）

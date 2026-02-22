---
inclusion: fileMatch
fileMatchPattern: '**/step-functions/**/*.ts|**/state-machines/**/*.json|**/lambda/collector-*/**/*.ts|scripts/{check-step-functions-execution,cancel-step-functions-execution}.ps1'
---

# Step Functions実装・運用ガイド

Step Functionsを使用したデータ収集ワークフローの実装・運用ガイドライン。

## Step Functions設計原則

### 1. ステートマシン設計

**基本構造**:
- **Init**: 収集対象日付の初期化、実行状態の作成
- **Fetch**: TDnetからデータ取得（並列実行）
- **Aggregate**: 取得データの集約
- **Save**: DynamoDB/S3への保存

**並列実行**:
- Map State使用（最大同時実行数: 5）
- 各日付を独立して処理
- 部分的失敗を許容

### 2. エラーハンドリング

**Retry設定**:
```json
{
  "Retry": [
    {
      "ErrorEquals": ["States.TaskFailed", "Lambda.ServiceException"],
      "IntervalSeconds": 2,
      "MaxAttempts": 3,
      "BackoffRate": 2.0
    }
  ]
}
```

**Catch設定**:
```json
{
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "ResultPath": "$.error",
      "Next": "HandleError"
    }
  ]
}
```

### 3. タイムアウト設定

| ステート | タイムアウト | 理由 |
|---------|------------|------|
| Init | 30秒 | 軽量な初期化処理 |
| Fetch | 15分 | スクレイピング処理 |
| Aggregate | 5分 | データ集約処理 |
| Save | 5分 | DynamoDB/S3書き込み |
| 全体 | 30分 | 最大処理時間 |

---

## State Machine定義

### state-machine-definition.json

```json
{
  "Comment": "TDnet Data Collection Workflow",
  "StartAt": "Init",
  "States": {
    "Init": {
      "Type": "Task",
      "Resource": "${CollectorInitFunctionArn}",
      "TimeoutSeconds": 30,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Next": "Fetch"
    },
    "Fetch": {
      "Type": "Map",
      "ItemsPath": "$.dates",
      "MaxConcurrency": 5,
      "Iterator": {
        "StartAt": "FetchDate",
        "States": {
          "FetchDate": {
            "Type": "Task",
            "Resource": "${CollectorFetchFunctionArn}",
            "TimeoutSeconds": 900,
            "Retry": [
              {
                "ErrorEquals": ["States.TaskFailed"],
                "IntervalSeconds": 2,
                "MaxAttempts": 3,
                "BackoffRate": 2.0
              }
            ],
            "End": true
          }
        }
      },
      "ResultPath": "$.fetchResults",
      "Next": "Aggregate"
    },
    "Aggregate": {
      "Type": "Task",
      "Resource": "${CollectorAggregateFunctionArn}",
      "TimeoutSeconds": 300,
      "Next": "Save"
    },
    "Save": {
      "Type": "Task",
      "Resource": "${CollectorSaveFunctionArn}",
      "TimeoutSeconds": 300,
      "End": true
    }
  }
}
```

---

## Lambda統合パターン

### collector-init

**責務**: 収集対象日付の初期化、実行状態の作成

```typescript
export const handler = async (event: InitEvent): Promise<InitResult> => {
    const { startDate, endDate, maxItems } = event;
    
    // 日付範囲を生成
    const dates = generateDateRange(startDate, endDate);
    
    // 実行状態を作成
    const executionId = generateExecutionId();
    await createExecutionState(executionId, {
        status: 'running',
        totalDates: dates.length,
        processedDates: 0,
        collectedCount: 0,
        failedCount: 0
    });
    
    return {
        executionId,
        dates: dates.map(date => ({ date, maxItems })),
        startedAt: new Date().toISOString()
    };
};
```

### collector-fetch

**責務**: TDnetからデータ取得（1日分）

```typescript
export const handler = async (event: FetchEvent): Promise<FetchResult> => {
    const { date, maxItems, executionId } = event;
    
    try {
        // TDnetからデータ取得
        const disclosures = await fetchDisclosuresFromTDnet(date, maxItems);
        
        // 実行状態を更新
        await updateExecutionState(executionId, {
            processedDates: 1,
            collectedCount: disclosures.length
        });
        
        return {
            date,
            disclosures,
            count: disclosures.length,
            status: 'success'
        };
    } catch (error) {
        logger.error('Fetch failed', { date, error });
        
        // 実行状態を更新
        await updateExecutionState(executionId, {
            processedDates: 1,
            failedCount: 1
        });
        
        return {
            date,
            disclosures: [],
            count: 0,
            status: 'failed',
            error: error.message
        };
    }
};
```

### collector-aggregate

**責務**: 取得データの集約

```typescript
export const handler = async (event: AggregateEvent): Promise<AggregateResult> => {
    const { fetchResults, executionId } = event;
    
    // 成功・失敗を集計
    const successResults = fetchResults.filter(r => r.status === 'success');
    const failedResults = fetchResults.filter(r => r.status === 'failed');
    
    // すべての開示情報を集約
    const allDisclosures = successResults.flatMap(r => r.disclosures);
    
    return {
        executionId,
        totalCount: allDisclosures.length,
        successCount: successResults.length,
        failedCount: failedResults.length,
        disclosures: allDisclosures
    };
};
```

### collector-save

**責務**: DynamoDB/S3への保存

```typescript
export const handler = async (event: SaveEvent): Promise<SaveResult> => {
    const { executionId, disclosures } = event;
    
    try {
        // DynamoDBに保存
        await batchWriteDisclosures(disclosures);
        
        // S3にPDFを保存（非同期）
        await Promise.all(
            disclosures.map(d => uploadPdfToS3(d.pdfUrl, d.disclosure_id))
        );
        
        // 実行状態を完了に更新
        await updateExecutionState(executionId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        
        return {
            executionId,
            status: 'completed',
            savedCount: disclosures.length
        };
    } catch (error) {
        logger.error('Save failed', { executionId, error });
        
        // 実行状態を失敗に更新
        await updateExecutionState(executionId, {
            status: 'failed',
            error: error.message
        });
        
        throw error;
    }
};
```

---

## 実行状態管理

### DynamoDBテーブル設計

**テーブル名**: `tdnet-executions`

**スキーマ**:
```typescript
interface ExecutionState {
    execution_id: string;           // PK
    status: 'running' | 'completed' | 'failed';
    total_dates: number;
    processed_dates: number;
    collected_count: number;
    failed_count: number;
    started_at: string;             // ISO 8601
    updated_at: string;             // ISO 8601
    completed_at?: string;          // ISO 8601
    error?: string;
}
```

### 実行状態の更新

```typescript
// utils/execution-state.ts
export async function updateExecutionState(
    executionId: string, 
    updates: Partial<ExecutionState>
): Promise<void> {
    await docClient.update({
        TableName: process.env.EXECUTIONS_TABLE_NAME!,
        Key: { execution_id: executionId },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, ...',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updated_at',
            // ...
        },
        ExpressionAttributeValues: {
            ':status': updates.status,
            ':updatedAt': new Date().toISOString(),
            // ...
        }
    });
}
```

---

## 運用スクリプト

### check-step-functions-execution.ps1

実行状態の確認

```powershell
# 実行IDで確認
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123

# JSON形式で出力（スクリプト連携用）
.\scripts\check-step-functions-execution.ps1 -ExecutionId exec_123 -Json
```

**出力項目**:
- 実行ID、状態、進捗率
- 収集件数、失敗件数
- 開始時刻、更新時刻、完了時刻（完了時のみ）
- エラーメッセージ（失敗時のみ）

### cancel-step-functions-execution.ps1

実行のキャンセル

```powershell
# 確認プロンプト付きでキャンセル
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123

# 確認プロンプトをスキップ（自動化用）
.\scripts\cancel-step-functions-execution.ps1 -ExecutionId exec_123 -Force -Reason "自動キャンセル"
```

**安全機能**:
- デフォルトで確認プロンプトを表示
- キャンセル理由の記録
- エラー時の詳細なガイダンス

---

## テスト戦略

### E2Eテスト

```typescript
// __tests__/e2e/step-functions-collector.e2e.test.ts
describe('Step Functions Collector E2E', () => {
    it('should complete data collection workflow', async () => {
        // Step Functions実行を開始
        const execution = await startExecution({
            startDate: '2024-01-15',
            endDate: '2024-01-15',
            maxItems: 10
        });
        
        // 実行完了を待機
        await waitForExecution(execution.executionArn, 30000);
        
        // 実行状態を確認
        const state = await getExecutionState(execution.executionId);
        expect(state.status).toBe('completed');
        expect(state.collected_count).toBeGreaterThan(0);
    });
});
```

### ユニットテスト

各Lambda関数のユニットテストを実装

```typescript
// __tests__/lambda/collector-init/handler.test.ts
describe('collector-init', () => {
    it('should initialize execution state', async () => {
        const event = {
            startDate: '2024-01-15',
            endDate: '2024-01-16',
            maxItems: 10
        };
        
        const result = await handler(event);
        
        expect(result.executionId).toBeDefined();
        expect(result.dates).toHaveLength(2);
    });
});
```

**詳細**: `testing-strategy.md`

---

## トラブルシューティング

### タイムアウト時の対応

1. `check-step-functions-execution.ps1`で実行状態を確認
2. 実行が継続中の場合は待機
3. 必要に応じて`cancel-step-functions-execution.ps1`でキャンセル

### エラー時の対応

1. CloudWatch Logsで詳細なエラーログを確認
2. 実行状態がfailedの場合、error_messageを確認
3. 必要に応じて再実行

### 部分的失敗時の対応

1. 実行状態のfailed_countを確認
2. 失敗した日付を特定
3. 失敗した日付のみ再実行

---

## 実装チェックリスト

### State Machine作成時

- [ ] Retry設定（指数バックオフ）
- [ ] Catch設定（エラーハンドリング）
- [ ] タイムアウト設定
- [ ] 並列実行設定（MaxConcurrency）
- [ ] CloudWatch Logs統合

### Lambda関数作成時

- [ ] 実行状態の作成・更新
- [ ] エラーハンドリング実装
- [ ] 構造化ログ実装
- [ ] ユニットテスト実装
- [ ] E2Eテスト実装

### 運用スクリプト作成時

- [ ] エラーハンドリング実装
- [ ] ヘルプメッセージ実装
- [ ] 環境変数検証
- [ ] AWS認証確認

---

## 関連ドキュメント

- `lambda-guide.md` - Lambda実装ガイド
- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - エラーハンドリング詳細実装
- `testing-strategy.md` - テスト戦略
- `scripts-guide.md` - 運用スクリプトガイド
- `../infrastructure/cdk-implementation.md` - CDK実装ガイド

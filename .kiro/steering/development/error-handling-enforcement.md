---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts'
---

# Error Handling Enforcement - 強制化ガイドライン

TDnet Data Collectorプロジェクトにおけるエラーハンドリングの強制化方針。

## 目的

エラーハンドリングのベストプラクティスを**推奨**から**必須**に引き上げ、実装漏れを防ぐ。

## 役割分担

| ファイル | 役割 |
|---------|------|
| `core/error-handling-patterns.md` | エラー分類、再試行戦略の概要 |
| `development/error-handling-implementation.md` | 具体的なコード例、AWS SDK設定 |
| このファイル | DLQ必須化、Alarms自動設定、テスト検証 |
| `infrastructure/monitoring-alerts.md` | CloudWatch設定の詳細 |

---

## Lambda DLQ必須化方針

### 必須化ルール

**すべての非同期Lambda関数にDead Letter Queue (DLQ)を設定すること。**

### 対象Lambda関数

| トリガー | DLQ必須 | 理由 |
|---------|---------|------|
| EventBridge (スケジュール) | ✅ 必須 | 非同期実行、失敗時の再実行が必要 |
| SQS | ✅ 必須 | メッセージ処理失敗時の追跡が必要 |
| SNS | ✅ 必須 | 非同期実行、失敗通知が必要 |
| S3イベント | ✅ 必須 | イベント処理失敗時の追跡が必要 |
| DynamoDB Streams | ✅ 必須 | ストリーム処理失敗時の追跡が必要 |
| API Gateway (同期) | ❌ 不要 | 同期実行、エラーは即座に返却 |
| Lambda直接呼び出し (同期) | ❌ 不要 | 同期実行、エラーは呼び出し元で処理 |

### DLQ設定の標準仕様

```typescript
const dlqConfig = {
    retentionPeriod: cdk.Duration.days(14),  // 14日間保持
    visibilityTimeout: cdk.Duration.minutes(5),  // 5分
};

const lambdaConfig = {
    deadLetterQueueEnabled: true,  // DLQ有効化
    retryAttempts: 2,  // 2回再試行（合計3回実行）
};
```

### DLQプロセッサーの必須実装

DLQを設定したすべてのLambda関数に対して、DLQプロセッサーを実装すること。

**DLQプロセッサーの責務:**
1. DLQメッセージを受信
2. エラー内容をログに記録
3. アラート通知を送信（SNS経由）
4. 必要に応じて手動対応のためのメタデータを保存

---

## CloudWatch Alarms自動設定

### 必須化ルール

**すべてのLambda関数に対して、以下のCloudWatch Alarmsを自動設定すること。**

### 必須アラーム一覧

| アラーム種別 | 閾値 | 評価期間 | 説明 |
|------------|------|---------|------|
| **Errors** | > 5件 | 5分 | Lambda実行エラーが5件を超えた |
| **Duration** | > タイムアウトの80% | 5分 | 実行時間がタイムアウトの80%を超えた |
| **Throttles** | ≥ 1件 | 5分 | スロットリングが発生した |
| **DLQ Messages** | ≥ 1件 | 1分 | DLQにメッセージが送信された |

---

## MonitoredLambda Construct

### 概要

標準的な監視とアラームを自動設定するCDK Construct。

**ファイル配置:** `cdk/lib/constructs/monitored-lambda.ts`

### 機能

- DLQの自動設定（`enableDlq=true`の場合）
- DLQプロセッサーの自動作成
- CloudWatch Alarmsの自動設定（Errors, Duration, Throttles, DLQ）
- X-Rayトレーシングの有効化

### 使用例

```typescript
import { MonitoredLambda } from './constructs/monitored-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';

export class TdnetStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // アラート通知用SNSトピック
        const alertTopic = new sns.Topic(this, 'AlertTopic', {
            displayName: 'TDnet Alerts',
        });

        // 非同期Lambda関数（DLQ有効）
        const collectorLambda = new MonitoredLambda(this, 'Collector', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/collector'),
            timeout: cdk.Duration.minutes(15),
            alertTopic,
            enableDlq: true, // DLQ有効化
            alarmThresholds: {
                errorCount: 10, // カスタム閾値
                durationPercentage: 0.9,
            },
        });

        // 同期Lambda関数（DLQ不要）
        const apiLambda = new MonitoredLambda(this, 'ApiHandler', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/api'),
            timeout: cdk.Duration.seconds(30),
            alertTopic,
            enableDlq: false, // API Gatewayは同期実行のためDLQ不要
        });
    }
}
```

### インターフェース

```typescript
export interface MonitoredLambdaProps extends lambda.FunctionProps {
    alertTopic: sns.ITopic;           // アラート通知先のSNSトピック
    enableDlq?: boolean;              // DLQを有効化するか
    alarmThresholds?: {               // カスタムアラーム閾値
        errorCount?: number;
        durationPercentage?: number;
        throttleCount?: number;
    };
}
```

---

## エラーハンドリングテスト

### テストチェックリスト

すべてのLambda関数に対して、以下のテストを実装すること：

#### 必須テスト項目

- [ ] **再試行テスト**: ネットワークエラーで再試行が動作することを確認
- [ ] **構造化ログテスト**: エラーログが構造化フォーマットで出力されることを確認
- [ ] **部分的失敗テスト**: バッチ処理で一部失敗しても成功分は処理されることを確認
- [ ] **非再試行エラーテスト**: 再試行不可能なエラーは即座に失敗することを確認
- [ ] **メトリクステスト**: CloudWatchメトリクスが送信されることを確認

#### DynamoDB操作テスト

- [ ] **スロットリング再試行**: `ProvisionedThroughputExceededException`で再試行
- [ ] **重複エラー処理**: `ConditionalCheckFailedException`を適切に処理
- [ ] **条件式テスト**: `ConditionExpression`が設定されていることを確認

#### API Gatewayテスト

- [ ] **バリデーションエラー**: 400エラーを返すことを確認
- [ ] **Not Foundエラー**: 404エラーを返すことを確認
- [ ] **機密情報保護**: スタックトレースや内部パスが含まれないことを確認
- [ ] **CORSヘッダー**: エラーレスポンスにCORSヘッダーが含まれることを確認

### テスト実装例

**ファイル配置:** `lambda/*/handler.test.ts`

```typescript
describe('Error Handling Tests', () => {
    test('should handle network errors with retry', async () => {
        const mockFetch = jest.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockRejectedValueOnce(new Error('ETIMEDOUT'))
            .mockResolvedValueOnce({ data: 'success' });

        const result = await handler(mockEvent, mockContext);
        
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(result.statusCode).toBe(200);
    });

    test('should log errors with structured format', async () => {
        const mockLogger = jest.spyOn(console, 'error');
        
        await expect(handler(invalidEvent, mockContext)).rejects.toThrow();
        
        expect(mockLogger).toHaveBeenCalledWith(
            expect.stringContaining('Lambda execution failed'),
            expect.objectContaining({
                error_type: expect.any(String),
                error_message: expect.any(String),
                context: expect.any(Object),
                stack_trace: expect.any(String),
            })
        );
    });

    test('should handle partial failures gracefully', async () => {
        const items = [
            { id: '1', valid: true },
            { id: '2', valid: false },
            { id: '3', valid: true },
        ];

        const result = await handler({ items }, mockContext);
        
        expect(result.body).toContain('"success":2');
        expect(result.body).toContain('"failed":1');
    });

    test('should throw non-retryable errors immediately', async () => {
        const mockFetch = jest.fn()
            .mockRejectedValue(new Error('404 Not Found'));

        await expect(handler(mockEvent, mockContext)).rejects.toThrow();
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });
});
```

---

## 実装チェックリスト

### Lambda関数作成時

- [ ] DLQ設定（非同期の場合）
- [ ] DLQプロセッサー実装
- [ ] CloudWatch Alarms設定（Errors, Duration, Throttles, DLQ）
- [ ] X-Rayトレーシング有効化
- [ ] 構造化ログ実装
- [ ] エラーハンドリングテスト実装

### CDKスタック作成時

- [ ] `MonitoredLambda` Constructを使用
- [ ] アラート通知用SNSトピック設定
- [ ] カスタム閾値の検討（必要に応じて）

---

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本原則
- `error-handling-implementation.md` - 詳細な実装パターン
- `../infrastructure/monitoring-alerts.md` - CloudWatch設定の詳細

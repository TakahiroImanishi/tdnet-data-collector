---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/*.ts|**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/**/*.ts'
---

# Error Handling Enforcement - 強制化ガイドライン

このファイルは、TDnet Data Collectorプロジェクトにおけるエラーハンドリングの**強制化方針**をまとめたものです。

## 目的

エラーハンドリングのベストプラクティスを**推奨**から**必須**に引き上げ、実装漏れを防ぐための仕組みを提供します。

## 役割分担

| ファイル | 役割 | 内容 |
|---------|------|------|
| **core/error-handling-patterns.md** | 基本原則 | エラー分類、再試行戦略の概要 |
| **development/error-handling-implementation.md** | 詳細実装 | 具体的なコード例、AWS SDK設定 |
| **development/error-handling-enforcement.md** (このファイル) | 強制化 | DLQ必須化、Alarms自動設定、テスト検証 |
| **infrastructure/monitoring-alerts.md** | 監視設定 | CloudWatch設定の詳細 |

## 目次

1. [Lambda DLQ必須化方針](#lambda-dlq必須化方針)
2. [CloudWatch Alarms自動設定](#cloudwatch-alarms自動設定)
3. [エラーハンドリングチェックリストの強制](#エラーハンドリングチェックリストの強制)
4. [テストでの検証](#テストでの検証)
5. [CDK実装例](#cdk実装例)

---

## Lambda DLQ必須化方針

### 必須化ルール

**すべての非同期Lambda関数にDead Letter Queue (DLQ)を設定すること。**


#### 対象Lambda関数

| トリガー | DLQ必須 | 理由 |
|---------|---------|------|
| EventBridge (スケジュール) | ✅ 必須 | 非同期実行、失敗時の再実行が必要 |
| SQS | ✅ 必須 | メッセージ処理失敗時の追跡が必要 |
| SNS | ✅ 必須 | 非同期実行、失敗通知が必要 |
| S3イベント | ✅ 必須 | イベント処理失敗時の追跡が必要 |
| DynamoDB Streams | ✅ 必須 | ストリーム処理失敗時の追跡が必要 |
| API Gateway (同期) | ❌ 不要 | 同期実行、エラーは即座に返却 |
| Lambda直接呼び出し (同期) | ❌ 不要 | 同期実行、エラーは呼び出し元で処理 |

#### DLQ設定の標準仕様

```typescript
// すべての非同期Lambda関数に適用する標準設定
const dlqConfig = {
    retentionPeriod: cdk.Duration.days(14),  // 14日間保持
    visibilityTimeout: cdk.Duration.minutes(5),  // 5分
};

const lambdaConfig = {
    deadLetterQueueEnabled: true,  // DLQ有効化
    retryAttempts: 2,  // 2回再試行（合計3回実行）
};
```

#### DLQプロセッサーの必須実装

DLQを設定したすべてのLambda関数に対して、DLQプロセッサーを実装すること。

**DLQプロセッサーの責務:**
1. DLQメッセージを受信
2. エラー内容をログに記録
3. アラート通知を送信（SNS経由）
4. 必要に応じて手動対応のためのメタデータを保存

**実装例:** `.kiro/specs/tdnet-data-collector/templates/lambda-dlq-example.ts` を参照


---

## CloudWatch Alarms自動設定

### 必須化ルール

**すべてのLambda関数に対して、以下のCloudWatch Alarmsを自動設定すること。**

#### 必須アラーム一覧

| アラーム種別 | 閾値 | 評価期間 | 説明 |
|------------|------|---------|------|
| **Errors** | > 5件 | 5分 | Lambda実行エラーが5件を超えた |
| **Duration** | > タイムアウトの80% | 5分 | 実行時間がタイムアウトの80%を超えた |
| **Throttles** | ≥ 1件 | 5分 | スロットリングが発生した |
| **DLQ Messages** | ≥ 1件 | 1分 | DLQにメッセージが送信された |

#### CDK Constructによる自動設定

すべてのLambda関数に対して、標準的なアラームを自動設定するCDK Constructを使用します。

**ファイル配置:** `cdk/lib/constructs/monitored-lambda.ts`

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface MonitoredLambdaProps extends lambda.FunctionProps {
    /**
     * アラート通知先のSNSトピック
     */
    alertTopic: sns.ITopic;
    
    /**
     * DLQを有効化するか（非同期Lambda関数の場合はtrue）
     */
    enableDlq?: boolean;
    
    /**
     * カスタムアラーム閾値（オプション）
     */
    alarmThresholds?: {
        errorCount?: number;
        durationPercentage?: number;
        throttleCount?: number;
    };
}

/**
 * 標準的な監視とアラームを自動設定するLambda Construct
 * 
 * 機能:
 * - DLQの自動設定（enableDlq=trueの場合）
 * - DLQプロセッサーの自動作成
 * - CloudWatch Alarmsの自動設定（Errors, Duration, Throttles, DLQ）
 * - X-Rayトレーシングの有効化
 */
export class MonitoredLambda extends Construct {
    public readonly function: lambda.Function;
    public readonly dlq?: sqs.Queue;
    public readonly dlqProcessor?: lambda.Function;
    public readonly alarms: cloudwatch.Alarm[];

    constructor(scope: Construct, id: string, props: MonitoredLambdaProps) {
        super(scope, id);

        this.alarms = [];
        const thresholds = props.alarmThresholds || {};

        // DLQの作成（enableDlq=trueの場合）
        if (props.enableDlq) {
            this.dlq = new sqs.Queue(this, 'DLQ', {
                queueName: `${id}-dlq`,
                retentionPeriod: cdk.Duration.days(14),
                visibilityTimeout: cdk.Duration.minutes(5),
            });
        }

        // Lambda関数の作成
        this.function = new lambda.Function(this, 'Function', {
            ...props,
            deadLetterQueue: this.dlq,
            deadLetterQueueEnabled: !!this.dlq,
            retryAttempts: this.dlq ? 2 : undefined,
            tracing: lambda.Tracing.ACTIVE, // X-Ray有効化
        });

        // DLQプロセッサーの作成（DLQが有効な場合）
        if (this.dlq) {
            this.dlqProcessor = this.createDlqProcessor(props.alertTopic);
        }

        // CloudWatch Alarmsの自動設定
        this.createAlarms(props.alertTopic, thresholds);
    }

    private createDlqProcessor(alertTopic: sns.ITopic): lambda.Function {
        const processor = new lambda.Function(this, 'DLQProcessor', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
                const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
                const snsClient = new SNSClient({});

                exports.handler = async (event) => {
                    for (const record of event.Records) {
                        const failedMessage = JSON.parse(record.body);
                        
                        console.error('DLQ message received', {
                            messageId: record.messageId,
                            failedMessage,
                            attributes: record.attributes,
                        });
                        
                        await snsClient.send(new PublishCommand({
                            TopicArn: process.env.ALERT_TOPIC_ARN,
                            Subject: 'Lambda execution failed - DLQ message',
                            Message: JSON.stringify({
                                messageId: record.messageId,
                                failedMessage,
                                sentTimestamp: record.attributes.SentTimestamp,
                                approximateReceiveCount: record.attributes.ApproximateReceiveCount,
                                timestamp: new Date().toISOString(),
                            }, null, 2),
                        }));
                    }
                };
            `),
            environment: {
                ALERT_TOPIC_ARN: alertTopic.topicArn,
            },
        });

        // DLQをイベントソースとして設定
        processor.addEventSource(
            new lambda.EventSourceMapping(this, 'DLQEventSource', {
                target: processor,
                eventSourceArn: this.dlq!.queueArn,
                batchSize: 10,
            })
        );

        this.dlq!.grantConsumeMessages(processor);
        alertTopic.grantPublish(processor);

        return processor;
    }

    private createAlarms(
        alertTopic: sns.ITopic,
        thresholds: MonitoredLambdaProps['alarmThresholds']
    ): void {
        // 1. Errorsアラーム
        const errorAlarm = new cloudwatch.Alarm(this, 'ErrorAlarm', {
            metric: this.function.metricErrors({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: thresholds.errorCount || 5,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: `Lambda関数 ${this.function.functionName} のエラーが閾値を超えました`,
            alarmName: `${this.function.functionName}-errors`,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        errorAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
        this.alarms.push(errorAlarm);

        // 2. Durationアラーム（タイムアウトの80%）
        const timeoutMs = this.function.timeout?.toMilliseconds() || 3000;
        const durationThreshold = timeoutMs * (thresholds.durationPercentage || 0.8);
        
        const durationAlarm = new cloudwatch.Alarm(this, 'DurationAlarm', {
            metric: this.function.metricDuration({
                statistic: 'Average',
                period: cdk.Duration.minutes(5),
            }),
            threshold: durationThreshold,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarmDescription: `Lambda関数 ${this.function.functionName} の実行時間が長すぎます`,
            alarmName: `${this.function.functionName}-duration`,
        });
        durationAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
        this.alarms.push(durationAlarm);

        // 3. Throttlesアラーム
        const throttleAlarm = new cloudwatch.Alarm(this, 'ThrottleAlarm', {
            metric: this.function.metricThrottles({
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
            }),
            threshold: thresholds.throttleCount || 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            alarmDescription: `Lambda関数 ${this.function.functionName} でスロットリングが発生しました`,
            alarmName: `${this.function.functionName}-throttles`,
        });
        throttleAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
        this.alarms.push(throttleAlarm);

        // 4. DLQアラーム（DLQが有効な場合）
        if (this.dlq) {
            const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
                metric: this.dlq.metricApproximateNumberOfMessagesVisible({
                    statistic: 'Sum',
                    period: cdk.Duration.minutes(1),
                }),
                threshold: 1,
                evaluationPeriods: 1,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                alarmDescription: `Lambda関数 ${this.function.functionName} のDLQにメッセージが送信されました`,
                alarmName: `${this.function.functionName}-dlq-messages`,
            });
            dlqAlarm.addAlarmAction(new actions.SnsAction(alertTopic));
            this.alarms.push(dlqAlarm);
        }
    }
}
```


#### 使用例

```typescript
// cdk/lib/tdnet-stack.ts
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

---

## エラーハンドリングチェックリストの強制

### テストによる検証

エラーハンドリングの実装漏れを防ぐため、以下のテストを必須とします。

#### 1. Lambda関数のエラーハンドリングテスト

**ファイル配置:** `lambda/*/handler.test.ts`

```typescript
import { handler } from './index';
import { Context } from 'aws-lambda';

describe('Error Handling Tests', () => {
    let mockContext: Context;

    beforeEach(() => {
        mockContext = {
            requestId: 'test-request-id',
            functionName: 'test-function',
            // ... その他のContext属性
        } as Context;
    });

    test('should handle network errors with retry', async () => {
        // ネットワークエラーをシミュレート
        const mockFetch = jest.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockRejectedValueOnce(new Error('ETIMEDOUT'))
            .mockResolvedValueOnce({ data: 'success' });

        // 再試行ロジックが動作することを確認
        const result = await handler(mockEvent, mockContext);
        
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(result.statusCode).toBe(200);
    });

    test('should log errors with structured format', async () => {
        const mockLogger = jest.spyOn(console, 'error');
        
        // エラーを発生させる
        await expect(handler(invalidEvent, mockContext)).rejects.toThrow();
        
        // 構造化ログが出力されることを確認
        expect(mockLogger).toHaveBeenCalledWith(
            expect.stringContaining('Lambda execution failed'),
            expect.objectContaining({
                error_type: expect.any(String),
                error_message: expect.any(String),
                context: expect.objectContaining({
                    request_id: 'test-request-id',
                    function_name: 'test-function',
                }),
                stack_trace: expect.any(String),
            })
        );
    });

    test('should handle partial failures gracefully', async () => {
        const items = [
            { id: '1', valid: true },
            { id: '2', valid: false }, // これは失敗する
            { id: '3', valid: true },
        ];

        const result = await handler({ items }, mockContext);
        
        // 部分的失敗でも成功した項目は処理されることを確認
        expect(result.body).toContain('"success":2');
        expect(result.body).toContain('"failed":1');
    });

    test('should throw non-retryable errors immediately', async () => {
        const mockFetch = jest.fn()
            .mockRejectedValue(new Error('404 Not Found'));

        // 再試行せずに即座に失敗することを確認
        await expect(handler(mockEvent, mockContext)).rejects.toThrow();
        
        expect(mockFetch).toHaveBeenCalledTimes(1); // 再試行なし
    });

    test('should send custom metrics on error', async () => {
        const mockPutMetricData = jest.fn();
        
        // エラーを発生させる
        await expect(handler(invalidEvent, mockContext)).rejects.toThrow();
        
        // CloudWatchメトリクスが送信されることを確認
        expect(mockPutMetricData).toHaveBeenCalledWith(
            expect.objectContaining({
                MetricData: expect.arrayContaining([
                    expect.objectContaining({
                        MetricName: 'LambdaError',
                        Value: 1,
                    }),
                ]),
            })
        );
    });
});
```

#### 2. DynamoDB操作のエラーハンドリングテスト

```typescript
describe('DynamoDB Error Handling Tests', () => {
    test('should retry on ProvisionedThroughputExceededException', async () => {
        const mockSend = jest.fn()
            .mockRejectedValueOnce({ name: 'ProvisionedThroughputExceededException' })
            .mockRejectedValueOnce({ name: 'ProvisionedThroughputExceededException' })
            .mockResolvedValueOnce({ Item: { id: '1' } });

        const result = await saveToDynamoDB(mockItem);
        
        expect(mockSend).toHaveBeenCalledTimes(3);
        expect(result).toBeDefined();
    });

    test('should handle ConditionalCheckFailedException gracefully', async () => {
        const mockSend = jest.fn()
            .mockRejectedValue({ name: 'ConditionalCheckFailedException' });

        // 重複エラーは無視されることを確認
        await expect(saveToDynamoDB(mockItem)).resolves.not.toThrow();
        
        expect(mockSend).toHaveBeenCalledTimes(1); // 再試行なし
    });

    test('should use ConditionExpression for duplicate prevention', async () => {
        const mockSend = jest.fn();

        await saveToDynamoDB(mockItem);
        
        // ConditionExpressionが設定されていることを確認
        expect(mockSend).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    ConditionExpression: 'attribute_not_exists(disclosure_id)',
                }),
            })
        );
    });
});
```

#### 3. API Gatewayのエラーレスポンステスト

```typescript
describe('API Error Response Tests', () => {
    test('should return 400 for validation errors', async () => {
        const result = await handler(invalidRequestEvent, mockContext);
        
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body)).toMatchObject({
            error_code: 'VALIDATION_ERROR',
            message: expect.any(String),
        });
    });

    test('should return 404 for not found errors', async () => {
        const result = await handler(notFoundEvent, mockContext);
        
        expect(result.statusCode).toBe(404);
        expect(JSON.parse(result.body)).toMatchObject({
            error_code: 'NOT_FOUND',
            message: expect.any(String),
        });
    });

    test('should not expose sensitive information in error responses', async () => {
        const result = await handler(errorEvent, mockContext);
        
        const body = JSON.parse(result.body);
        
        // スタックトレースや内部パスが含まれていないことを確認
        expect(body).not.toHaveProperty('stack_trace');
        expect(body).not.toHaveProperty('stack');
        expect(JSON.stringify(body)).not.toMatch(/\/home\/|\/var\/|C:\\/);
    });

    test('should include CORS headers in error responses', async () => {
        const result = await handler(errorEvent, mockContext);
        
        expect(result.headers).toMatchObject({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': expect.any(String),
        });
    });
});
```


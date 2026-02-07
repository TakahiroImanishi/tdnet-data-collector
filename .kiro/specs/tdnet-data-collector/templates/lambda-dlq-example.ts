/**
 * Lambda Dead Letter Queue (DLQ) Implementation Example
 * 
 * このファイルは、Lambda関数のDLQ設定とDLQプロセッサーの実装例を提供します。
 * 
 * 関連ドキュメント:
 * - .kiro/steering/development/lambda-implementation.md
 * - .kiro/steering/core/error-handling-patterns.md
 */

// ============================================================================
// CDKでのDLQ設定
// ============================================================================

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';

/**
 * DLQを持つLambda関数のCDK設定例
 */
export class LambdaWithDLQConstruct extends cdk.Construct {
    public readonly collectorFunction: lambda.Function;
    public readonly dlq: sqs.Queue;
    public readonly dlqProcessor: lambda.Function;

    constructor(scope: cdk.Construct, id: string, props: {
        alertTopic: sns.Topic;
    }) {
        super(scope, id);

        // DLQの作成
        this.dlq = new sqs.Queue(this, 'CollectorDLQ', {
            queueName: 'tdnet-collector-dlq',
            retentionPeriod: cdk.Duration.days(14),
            visibilityTimeout: cdk.Duration.minutes(5),
        });

        // Lambda関数にDLQを設定
        this.collectorFunction = new lambda.Function(this, 'CollectorFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/collector'),
            timeout: cdk.Duration.minutes(15),
            deadLetterQueue: this.dlq,
            deadLetterQueueEnabled: true,
            retryAttempts: 2, // Lambda非同期呼び出しの再試行回数
        });

        // DLQプロセッサーLambda
        this.dlqProcessor = new lambda.Function(this, 'DLQProcessor', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/dlq-processor'),
            environment: {
                ALERT_TOPIC_ARN: props.alertTopic.topicArn,
            },
        });

        // DLQをイベントソースとして設定
        this.dlqProcessor.addEventSource(new lambdaEventSources.SqsEventSource(this.dlq, {
            batchSize: 10,
        }));

        // 権限の付与
        this.dlq.grantConsumeMessages(this.dlqProcessor);
        props.alertTopic.grantPublish(this.dlqProcessor);
    }
}

// ============================================================================
// DLQプロセッサーの実装
// ============================================================================

/**
 * ファイル配置: src/lambda/dlq-processor/index.ts
 * 
 * DLQに送信された失敗メッセージを処理し、アラートを送信します。
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

export const handler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        await processDLQMessage(record);
    }
};

async function processDLQMessage(record: SQSRecord): Promise<void> {
    try {
        const failedMessage = JSON.parse(record.body);
        
        logger.error('Processing DLQ message', {
            messageId: record.messageId,
            failedMessage,
            attributes: record.attributes,
        });
        
        // アラート送信
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
        
        logger.info('DLQ alert sent', { messageId: record.messageId });
    } catch (error) {
        logger.error('Failed to process DLQ message', {
            messageId: record.messageId,
            error,
        });
        // DLQプロセッサー自体の失敗は再スローしない
        // （無限ループを避けるため）
    }
}

// ============================================================================
// 使用例
// ============================================================================

/**
 * CDKスタックでの使用例
 */
/*
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { LambdaWithDLQConstruct } from './constructs/lambda-with-dlq';

export class TDnetStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // アラート用SNSトピック
        const alertTopic = new sns.Topic(this, 'AlertTopic', {
            displayName: 'TDnet Alerts',
        });

        // DLQを持つLambda関数を作成
        const lambdaWithDLQ = new LambdaWithDLQConstruct(this, 'CollectorWithDLQ', {
            alertTopic,
        });

        // 必要に応じて他のリソースと統合
        // ...
    }
}
*/

// ============================================================================
// ベストプラクティス
// ============================================================================

/**
 * DLQ設定のベストプラクティス:
 * 
 * 1. すべての非同期Lambda関数にDLQを設定
 *    - EventBridge、SQS、SNSトリガーのLambda関数
 *    - API Gatewayの同期呼び出しには不要
 * 
 * 2. DLQ保持期間は14日間
 *    - 十分な調査時間を確保
 *    - コスト削減のため長すぎない期間
 * 
 * 3. 再試行回数は2回
 *    - 一時的なエラーを吸収
 *    - 過度な再試行を避ける
 * 
 * 4. DLQプロセッサーでアラート送信
 *    - 失敗を即座に検知
 *    - 詳細なコンテキスト情報を含める
 * 
 * 5. DLQプロセッサー自体は失敗を再スローしない
 *    - 無限ループを避ける
 *    - ログに記録して継続
 * 
 * 6. バッチサイズは10
 *    - 効率的な処理
 *    - タイムアウトリスクの軽減
 */

// ============================================================================
// トラブルシューティング
// ============================================================================

/**
 * よくある問題と解決策:
 * 
 * 問題1: DLQにメッセージが溜まり続ける
 * 解決策: 
 * - DLQプロセッサーのログを確認
 * - アラートが正しく送信されているか確認
 * - 根本原因を特定して修正
 * 
 * 問題2: DLQプロセッサーがタイムアウトする
 * 解決策:
 * - バッチサイズを減らす（10 → 5）
 * - タイムアウトを延長（デフォルト3秒 → 30秒）
 * - 処理を並列化
 * 
 * 問題3: アラートが送信されない
 * 解決策:
 * - SNSトピックのARNが正しいか確認
 * - IAM権限を確認（sns:Publish）
 * - SNSトピックのサブスクリプションを確認
 * 
 * 問題4: DLQメッセージの内容が不明
 * 解決策:
 * - 元のLambda関数のログを確認
 * - CloudWatch Logsで失敗時のコンテキストを調査
 * - X-Rayトレースを有効化して詳細を確認
 */

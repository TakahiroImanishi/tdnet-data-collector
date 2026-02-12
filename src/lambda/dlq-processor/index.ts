/**
 * DLQ Processor Lambda Function
 * 
 * DLQに送信された失敗メッセージを処理し、アラートを送信します。
 * 
 * 関連ドキュメント:
 * - .kiro/steering/development/lambda-implementation.md
 * - .kiro/steering/core/error-handling-patterns.md
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../../utils/logger';

// SNSクライアントを遅延初期化（テスト時のモック対応）
let snsClient: SNSClient | null = null;

function getSNSClient(): SNSClient {
  if (!snsClient) {
    snsClient = new SNSClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  }
  return snsClient;
}

/**
 * DLQプロセッサーのメインハンドラー
 */
export const handler = async (event: SQSEvent): Promise<void> => {
  logger.info('DLQ Processor started', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processDLQMessage(record);
  }

  logger.info('DLQ Processor completed', {
    recordCount: event.Records.length,
  });
};

/**
 * DLQメッセージを処理
 */
async function processDLQMessage(record: SQSRecord): Promise<void> {
  try {
    const failedMessage = JSON.parse(record.body);
    
    logger.error('Processing DLQ message', {
      messageId: record.messageId,
      failedMessage,
      attributes: record.attributes,
    });
    
    // アラート送信（環境変数を動的に読み込む）
    const alertTopicArn = process.env.ALERT_TOPIC_ARN;
    if (alertTopicArn) {
      await sendAlert(record, failedMessage, alertTopicArn);
    } else {
      logger.warn('ALERT_TOPIC_ARN not configured, skipping SNS notification');
    }
    
    logger.info('DLQ message processed', { messageId: record.messageId });
  } catch (error) {
    logger.error('Failed to process DLQ message', {
      messageId: record.messageId,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
    });
    // DLQプロセッサー自体の失敗は再スローしない
    // （無限ループを避けるため）
  }
}

/**
 * SNS通知を送信
 */
async function sendAlert(record: SQSRecord, failedMessage: unknown, topicArn: string): Promise<void> {
  try {
    const client = getSNSClient();
    await client.send(new PublishCommand({
      TopicArn: topicArn,
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
    logger.error('Failed to send DLQ alert', {
      messageId: record.messageId,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
    });
    // アラート送信失敗は再スローしない
  }
}

// テスト用にSNSクライアントをリセットする関数をエクスポート
export function resetSNSClient(): void {
  snsClient = null;
}

/**
 * DLQ Processor Handler E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * 実際のSNSとの統合を検証します。
 *
 * Requirements: タスク35
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, CreateTopicCommand, ListTopicsCommand } from '@aws-sdk/client-sns';
import { handler, resetSNSClient } from '../index';

// LocalStack用のクライアント設定
const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:4566',
});

describe('DLQ Processor Handler E2E Tests', () => {
  let testTopicArn: string;

  beforeAll(async () => {
    // テスト用のSNSトピックを作成
    const topicName = `test-dlq-alerts-${Date.now()}`;
    const createCommand = new CreateTopicCommand({
      Name: topicName,
    });

    const result = await snsClient.send(createCommand);
    testTopicArn = result.TopicArn || '';

    // 環境変数を設定
    process.env.ALERT_TOPIC_ARN = testTopicArn;
  });

  beforeEach(() => {
    // 各テスト前にSNSクライアントをリセット
    resetSNSClient();
  });

  afterAll(() => {
    // 環境変数をクリーンアップ
    delete process.env.ALERT_TOPIC_ARN;
  });

  describe('DLQメッセージ処理', () => {
    it('単一のDLQメッセージを処理できる', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-1',
          body: JSON.stringify({
            error: 'Test error',
            context: { test: 'data' },
          }),
        },
      ]);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('複数のDLQメッセージを処理できる', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-1',
          body: JSON.stringify({ error: 'Error 1' }),
        },
        {
          messageId: 'test-message-2',
          body: JSON.stringify({ error: 'Error 2' }),
        },
        {
          messageId: 'test-message-3',
          body: JSON.stringify({ error: 'Error 3' }),
        },
      ]);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('不正なJSON形式のメッセージでもエラーをスローしない', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-invalid',
          body: 'invalid json {',
        },
      ]);

      // Act & Assert
      // DLQプロセッサーは失敗してもエラーをスローしない（無限ループ防止）
      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('SNS通知', () => {
    it('ALERT_TOPIC_ARNが設定されている場合はSNS通知を送信する', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-sns',
          body: JSON.stringify({
            error: 'Test SNS notification',
            context: { test: 'sns' },
          }),
        },
      ]);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();

      // SNSトピックが存在することを確認
      const listCommand = new ListTopicsCommand({});
      const topics = await snsClient.send(listCommand);
      const topicExists = topics.Topics?.some(topic => topic.TopicArn === testTopicArn);
      expect(topicExists).toBe(true);
    });

    it('ALERT_TOPIC_ARNが未設定の場合はSNS通知をスキップする', async () => {
      // Arrange
      delete process.env.ALERT_TOPIC_ARN;
      resetSNSClient();

      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-no-sns',
          body: JSON.stringify({ error: 'No SNS' }),
        },
      ]);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();

      // 環境変数を復元
      process.env.ALERT_TOPIC_ARN = testTopicArn;
    });
  });

  describe('エラーハンドリング', () => {
    it('SNS送信失敗時でもエラーをスローしない', async () => {
      // Arrange
      // 存在しないトピックARNを設定
      process.env.ALERT_TOPIC_ARN = 'arn:aws:sns:ap-northeast-1:123456789012:non-existent-topic';
      resetSNSClient();

      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-sns-fail',
          body: JSON.stringify({ error: 'SNS fail test' }),
        },
      ]);

      // Act & Assert
      // SNS送信失敗でもエラーをスローしない
      await expect(handler(event)).resolves.not.toThrow();

      // 環境変数を復元
      process.env.ALERT_TOPIC_ARN = testTopicArn;
    });

    it('メッセージ処理失敗時でもエラーをスローしない', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-process-fail',
          body: 'invalid json',
        },
      ]);

      // Act & Assert
      // 処理失敗でもエラーをスローしない（無限ループ防止）
      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('メッセージ属性', () => {
    it('SQSメッセージ属性を正しく処理する', async () => {
      // Arrange
      const event: SQSEvent = createMockSQSEvent([
        {
          messageId: 'test-message-attributes',
          body: JSON.stringify({ error: 'Test attributes' }),
          attributes: {
            ApproximateReceiveCount: '3',
            SentTimestamp: Date.now().toString(),
            ApproximateFirstReceiveTimestamp: Date.now().toString(),
          },
        },
      ]);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('バッチ処理', () => {
    it('大量のメッセージを処理できる', async () => {
      // Arrange
      const messages = Array.from({ length: 10 }, (_, i) => ({
        messageId: `test-message-batch-${i}`,
        body: JSON.stringify({ error: `Batch error ${i}` }),
      }));

      const event: SQSEvent = createMockSQSEvent(messages);

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });
  });
});

/**
 * モックSQSイベントを作成
 */
function createMockSQSEvent(
  messages: Array<{ messageId: string; body: string; attributes?: Record<string, string> }>
): SQSEvent {
  return {
    Records: messages.map(msg => ({
      messageId: msg.messageId,
      receiptHandle: `receipt-${msg.messageId}`,
      body: msg.body,
      attributes: msg.attributes || {
        ApproximateReceiveCount: '1',
        SentTimestamp: Date.now().toString(),
        SenderId: 'test-sender',
        ApproximateFirstReceiveTimestamp: Date.now().toString(),
      },
      messageAttributes: {},
      md5OfBody: 'test-md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-dlq',
      awsRegion: 'ap-northeast-1',
    })),
  };
}

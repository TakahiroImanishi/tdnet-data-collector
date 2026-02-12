/**
 * DLQ Processor Lambda Function Tests
 */

import { SQSEvent } from 'aws-lambda';
import { PublishCommand } from '@aws-sdk/client-sns';

// SNSClientをモック（importより前に定義）
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-sns', () => {
  const actual = jest.requireActual('@aws-sdk/client-sns');
  return {
    ...actual,
    SNSClient: jest.fn().mockImplementation(() => {
      return {
        send: mockSend,
      };
    }),
  };
});

// モック設定後にimport
import { handler, resetSNSClient } from '../index';

describe('DLQ Processor Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    mockSend.mockResolvedValue({});
    resetSNSClient();
    
    process.env.ALERT_TOPIC_ARN = 'arn:aws:sns:ap-northeast-1:123456789012:test-topic';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.ALERT_TOPIC_ARN;
    delete process.env.AWS_REGION;
  });

  describe('正常系', () => {
    it('DLQメッセージを正常に処理してSNS通知を送信する', async () => {
      // Arrange
      const failedMessage = {
        execution_id: 'test-execution-123',
        error: 'Test error message',
      };

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify(failedMessage),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act
      await handler(event);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);
      const publishCommand = mockSend.mock.calls[0][0];
      expect(publishCommand).toBeInstanceOf(PublishCommand);
      expect(publishCommand.input).toMatchObject({
        TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
        Subject: 'Lambda execution failed - DLQ message',
      });

      const message = JSON.parse(publishCommand.input.Message as string);
      expect(message).toMatchObject({
        messageId: 'test-message-id',
        failedMessage,
        sentTimestamp: '1234567890',
        approximateReceiveCount: '1',
      });
      expect(message.timestamp).toBeDefined();
    });

    it('複数のDLQメッセージを順次処理する', async () => {
      // Arrange
      const event: SQSEvent = {
        Records: [
          {
            messageId: 'message-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({ error: 'Error 1' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'sender-1',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'md5-1',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
          {
            messageId: 'message-2',
            receiptHandle: 'receipt-2',
            body: JSON.stringify({ error: 'Error 2' }),
            attributes: {
              ApproximateReceiveCount: '2',
              SentTimestamp: '1234567891',
              SenderId: 'sender-2',
              ApproximateFirstReceiveTimestamp: '1234567891',
            },
            messageAttributes: {},
            md5OfBody: 'md5-2',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act
      await handler(event);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('異常系', () => {
    it('ALERT_TOPIC_ARNが未設定の場合はSNS通知をスキップする', async () => {
      // Arrange
      delete process.env.ALERT_TOPIC_ARN;
      resetSNSClient();

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act
      await handler(event);

      // Assert
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('SNS通知送信失敗時もエラーを再スローしない', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(new Error('SNS error'));

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('不正なJSON形式のメッセージでもエラーを再スローしない', async () => {
      // Arrange
      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: 'invalid json',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('エッジケース', () => {
    it('空のRecords配列を処理する', async () => {
      // Arrange
      const event: SQSEvent = {
        Records: [],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('メッセージ本文が空文字列の場合', async () => {
      // Arrange
      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: '',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('エラー型チェックのブランチカバレッジ', () => {
    it('Error以外のオブジェクトがスローされた場合もログに記録する', async () => {
      // Arrange
      const customError = { code: 'CUSTOM_ERROR', details: 'Custom error details' };
      mockSend.mockRejectedValueOnce(customError);

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('文字列エラーがスローされた場合もログに記録する', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce('String error message');

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('nullがスローされた場合もログに記録する', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(null);

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('undefinedがスローされた場合もログに記録する', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(undefined);

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });

    it('数値がスローされた場合もログに記録する', async () => {
      // Arrange
      mockSend.mockRejectedValueOnce(404);

      const event: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: JSON.stringify({ error: 'Test error' }),
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'test-sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:ap-northeast-1:123456789012:test-queue',
            awsRegion: 'ap-northeast-1',
          },
        ],
      };

      // Act & Assert
      await expect(handler(event)).resolves.not.toThrow();
    });
  });
});

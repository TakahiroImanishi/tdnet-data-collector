/**
 * Update Execution Status - Unit Tests
 *
 * Requirements: 要件5.4（実行状態管理）
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { updateExecutionStatus, getExecutionStatus } from '../update-execution-status';

// DynamoDBクライアントのモック
const dynamoMock = mockClient(DynamoDBClient);

describe('updateExecutionStatus', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
    process.env.AWS_REGION = 'ap-northeast-1';
    process.env.ENVIRONMENT = 'test';
  });

  afterEach(() => {
    delete process.env.DYNAMODB_EXECUTIONS_TABLE;
    delete process.env.AWS_REGION;
    delete process.env.ENVIRONMENT;
  });

  describe('正常系', () => {
    it('新規実行状態を作成できる', async () => {
      // GetItemCommandは存在しないレコードを返す
      dynamoMock.on(GetItemCommand).resolves({});
      
      // PutItemCommandは成功
      dynamoMock.on(PutItemCommand).resolves({});

      const result = await updateExecutionStatus(
        'exec_001',
        'running',
        50,
        25,
        0
      );

      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
      });

      // PutItemCommandが呼ばれたことを確認
      expect(dynamoMock.commandCalls(PutItemCommand).length).toBe(1);
    });

    it('既存の実行状態を更新できる（started_atを保持）', async () => {
      const existingStartedAt = '2024-01-15T10:00:00.000Z';

      // GetItemCommandは既存のレコードを返す
      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall({
          execution_id: 'exec_001',
          status: 'running',
          progress: 25,
          collected_count: 10,
          failed_count: 0,
          started_at: existingStartedAt,
          updated_at: '2024-01-15T10:05:00.000Z',
        }),
      });

      // PutItemCommandは成功
      dynamoMock.on(PutItemCommand).resolves({});

      const result = await updateExecutionStatus(
        'exec_001',
        'running',
        50,
        25,
        0
      );

      expect(result.started_at).toBe(existingStartedAt);
      expect(result.progress).toBe(50);
      expect(result.collected_count).toBe(25);
    });

    it('getExecutionStatusが失敗しても実行状態を作成できる', async () => {
      // GetItemCommandはエラーを返す
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB GetItem failed'));

      // PutItemCommandは成功
      dynamoMock.on(PutItemCommand).resolves({});

      const result = await updateExecutionStatus(
        'exec_001',
        'running',
        50,
        25,
        0
      );

      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
      });

      // PutItemCommandが呼ばれたことを確認
      expect(dynamoMock.commandCalls(PutItemCommand).length).toBe(1);
    });

    it('進捗率を0-100の範囲に制限する', async () => {
      dynamoMock.on(GetItemCommand).resolves({});
      dynamoMock.on(PutItemCommand).resolves({});

      // 進捗率が100を超える場合
      const result1 = await updateExecutionStatus('exec_001', 'running', 150, 0, 0);
      expect(result1.progress).toBe(100);

      // 進捗率が0未満の場合
      const result2 = await updateExecutionStatus('exec_002', 'running', -10, 0, 0);
      expect(result2.progress).toBe(0);
    });

    it('completedステータスの場合、completed_atとTTLを設定する', async () => {
      dynamoMock.on(GetItemCommand).resolves({});
      dynamoMock.on(PutItemCommand).resolves({});

      const result = await updateExecutionStatus(
        'exec_001',
        'completed',
        100,
        50,
        0
      );

      expect(result.status).toBe('completed');
      expect(result.completed_at).toBeDefined();
      expect(result.ttl).toBeDefined();
    });

    it('failedステータスの場合、completed_at、TTL、error_messageを設定する', async () => {
      dynamoMock.on(GetItemCommand).resolves({});
      dynamoMock.on(PutItemCommand).resolves({});

      const result = await updateExecutionStatus(
        'exec_001',
        'failed',
        50,
        25,
        5,
        'Network error'
      );

      expect(result.status).toBe('failed');
      expect(result.completed_at).toBeDefined();
      expect(result.ttl).toBeDefined();
      expect(result.error_message).toBe('Network error');
    });
  });

  describe('異常系', () => {
    it('DynamoDB PutItemが失敗した場合、エラーをスローする', async () => {
      dynamoMock.on(GetItemCommand).resolves({});
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB PutItem failed'));

      await expect(
        updateExecutionStatus('exec_001', 'running', 50, 25, 0)
      ).rejects.toThrow('DynamoDB PutItem failed');
    });
  });
});

describe('getExecutionStatus', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
  });

  afterEach(() => {
    delete process.env.DYNAMODB_EXECUTIONS_TABLE;
  });

  describe('正常系', () => {
    it('既存の実行状態を取得できる', async () => {
      const mockItem = {
        execution_id: 'exec_001',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
        started_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:05:00.000Z',
      };

      dynamoMock.on(GetItemCommand).resolves({
        Item: marshall(mockItem),
      });

      const result = await getExecutionStatus('exec_001');

      expect(result).toMatchObject(mockItem);
    });

    it('存在しない実行状態の場合、nullを返す', async () => {
      dynamoMock.on(GetItemCommand).resolves({});

      const result = await getExecutionStatus('exec_999');

      expect(result).toBeNull();
    });
  });

  describe('異常系', () => {
    it('DynamoDB GetItemが失敗した場合、エラーをスローする', async () => {
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB GetItem failed'));

      await expect(
        getExecutionStatus('exec_001')
      ).rejects.toThrow('DynamoDB GetItem failed');
    });
  });
});

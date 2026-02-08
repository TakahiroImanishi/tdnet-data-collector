/**
 * updateExecutionStatus関数のユニットテスト
 *
 * Requirements: 要件5.4（実行状態管理）
 */

import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { updateExecutionStatus, getExecutionStatus } from '../update-execution-status';

const dynamoMock = mockClient(DynamoDBClient);

describe('updateExecutionStatus', () => {
  const originalEnv = process.env.DYNAMODB_EXECUTIONS_TABLE;

  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
  });

  afterEach(() => {
    process.env.DYNAMODB_EXECUTIONS_TABLE = originalEnv;
  });

  describe('正常系', () => {
    it('実行状態を作成できる（pending）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'pending', 0);

      // Assert
      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'pending',
        progress: 0,
        collected_count: 0,
        failed_count: 0,
      });
      expect(result.started_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
      expect(result.completed_at).toBeUndefined();
      expect(result.ttl).toBeUndefined();
      expect(dynamoMock.calls()).toHaveLength(1);
    });

    it('実行状態を更新できる（running）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'running', 50, 25, 0);

      // Assert
      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
      });
      expect(result.completed_at).toBeUndefined();
      expect(result.ttl).toBeUndefined();
    });

    it('実行状態を完了にできる（completed）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'completed', 100, 50, 0);

      // Assert
      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'completed',
        progress: 100,
        collected_count: 50,
        failed_count: 0,
      });
      expect(result.completed_at).toBeDefined();
      expect(result.ttl).toBeDefined();
      expect(result.error_message).toBeUndefined();
    });

    it('実行状態を失敗にできる（failed）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      const error_message = 'Network error occurred';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(
        execution_id,
        'failed',
        50,
        25,
        5,
        error_message
      );

      // Assert
      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'failed',
        progress: 50,
        collected_count: 25,
        failed_count: 5,
        error_message: 'Network error occurred',
      });
      expect(result.completed_at).toBeDefined();
      expect(result.ttl).toBeDefined();
    });

    it('進捗率を0-100の範囲に制限する（負の値）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'running', -10);

      // Assert
      expect(result.progress).toBe(0);
    });

    it('進捗率を0-100の範囲に制限する（100超過）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'running', 150);

      // Assert
      expect(result.progress).toBe(100);
    });

    it('TTLが30日後に設定される（completed）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});
      const beforeTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // Act
      const result = await updateExecutionStatus(execution_id, 'completed', 100);

      const afterTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // Assert
      expect(result.ttl).toBeDefined();
      expect(result.ttl!).toBeGreaterThanOrEqual(beforeTime - 1);
      expect(result.ttl!).toBeLessThanOrEqual(afterTime + 1);
    });

    it('TTLが30日後に設定される（failed）', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});
      const beforeTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // Act
      const result = await updateExecutionStatus(execution_id, 'failed', 50, 0, 0, 'Error');

      const afterTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      // Assert
      expect(result.ttl).toBeDefined();
      expect(result.ttl!).toBeGreaterThanOrEqual(beforeTime - 1);
      expect(result.ttl!).toBeLessThanOrEqual(afterTime + 1);
    });

    it('環境変数が未設定の場合、デフォルト値を使用する', async () => {
      // Arrange
      delete process.env.DYNAMODB_EXECUTIONS_TABLE;
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await updateExecutionStatus(execution_id, 'pending', 0);

      // Assert
      const input = dynamoMock.call(0).args[0].input as any;
      expect(input.TableName).toBe('tdnet_executions');
    });
  });

  describe('異常系', () => {
    it('DynamoDBエラーで失敗する', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      // Act & Assert
      await expect(updateExecutionStatus(execution_id, 'pending', 0)).rejects.toThrow(
        'DynamoDB error'
      );
    });

    it('エラーメッセージなしでfailedステータスを設定できる', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'failed', 50, 25, 5);

      // Assert
      expect(result.status).toBe('failed');
      expect(result.error_message).toBeUndefined();
      expect(result.completed_at).toBeDefined();
      expect(result.ttl).toBeDefined();
    });
  });

  describe('エッジケース', () => {
    it('進捗率が0の場合', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'pending', 0);

      // Assert
      expect(result.progress).toBe(0);
    });

    it('進捗率が100の場合', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'completed', 100);

      // Assert
      expect(result.progress).toBe(100);
    });

    it('collected_countとfailed_countが0の場合', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'pending', 0, 0, 0);

      // Assert
      expect(result.collected_count).toBe(0);
      expect(result.failed_count).toBe(0);
    });

    it('collected_countとfailed_countが大きい値の場合', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const result = await updateExecutionStatus(execution_id, 'completed', 100, 1000, 50);

      // Assert
      expect(result.collected_count).toBe(1000);
      expect(result.failed_count).toBe(50);
    });
  });
});

describe('getExecutionStatus', () => {
  const originalEnv = process.env.DYNAMODB_EXECUTIONS_TABLE;

  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
  });

  afterEach(() => {
    process.env.DYNAMODB_EXECUTIONS_TABLE = originalEnv;
  });

  describe('正常系', () => {
    it('実行状態を取得できる', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(GetItemCommand).resolves({
        Item: {
          execution_id: { S: 'exec_001' },
          status: { S: 'running' },
          progress: { N: '50' },
          collected_count: { N: '25' },
          failed_count: { N: '0' },
          started_at: { S: '2024-01-15T10:30:00Z' },
          updated_at: { S: '2024-01-15T10:35:00Z' },
        },
      });

      // Act
      const result = await getExecutionStatus(execution_id);

      // Assert
      expect(result).toMatchObject({
        execution_id: 'exec_001',
        status: 'running',
        progress: 50,
        collected_count: 25,
        failed_count: 0,
      });
      expect(dynamoMock.calls()).toHaveLength(1);
    });

    it('存在しない実行IDの場合、nullを返す', async () => {
      // Arrange
      const execution_id = 'exec_999';
      dynamoMock.on(GetItemCommand).resolves({});

      // Act
      const result = await getExecutionStatus(execution_id);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('異常系', () => {
    it('DynamoDBエラーで失敗する', async () => {
      // Arrange
      const execution_id = 'exec_001';
      dynamoMock.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      // Act & Assert
      await expect(getExecutionStatus(execution_id)).rejects.toThrow('DynamoDB error');
    });
  });
});

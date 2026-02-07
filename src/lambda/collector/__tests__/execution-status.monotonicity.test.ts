/**
 * 実行状態の進捗単調性テスト
 *
 * Property 11: 実行状態の進捗単調性
 * Validates: Requirements 5.4
 *
 * 進捗率が単調増加（0 → 100）し、減少しないことを検証します。
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import * as fc from 'fast-check';
import { updateExecutionStatus } from '../update-execution-status';

const dynamoMock = mockClient(DynamoDBClient);

describe('Property 11: 実行状態の進捗単調性', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_EXECUTIONS_TABLE = 'test-executions-table';
  });

  describe('ユニットテスト', () => {
    it('進捗率が0から100まで単調増加する', async () => {
      // Arrange
      const execution_id = 'exec_test_001';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act & Assert
      await updateExecutionStatus(execution_id, 'pending', 0);
      await updateExecutionStatus(execution_id, 'running', 25);
      await updateExecutionStatus(execution_id, 'running', 50);
      await updateExecutionStatus(execution_id, 'running', 75);
      await updateExecutionStatus(execution_id, 'completed', 100);

      // 5回の更新が行われた
      expect(dynamoMock.calls()).toHaveLength(5);

      // 各呼び出しで進捗率が増加していることを確認
      const calls = dynamoMock.calls();
      const progresses = calls.map(call => {
        const input = call.args[0].input as any;
        return parseInt(input.Item.progress.N);
      });

      // 進捗率が単調増加
      for (let i = 1; i < progresses.length; i++) {
        expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
      }
    });

    it('進捗率が100を超えない', async () => {
      // Arrange
      const execution_id = 'exec_test_002';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await updateExecutionStatus(execution_id, 'completed', 150); // 100を超える値

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      expect(parseInt(input.Item.progress.N)).toBe(100); // 100に制限される
    });

    it('進捗率が0未満にならない', async () => {
      // Arrange
      const execution_id = 'exec_test_003';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await updateExecutionStatus(execution_id, 'pending', -10); // 負の値

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      expect(parseInt(input.Item.progress.N)).toBe(0); // 0に制限される
    });

    it('ステータスがpending → running → completedの順に遷移する', async () => {
      // Arrange
      const execution_id = 'exec_test_004';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await updateExecutionStatus(execution_id, 'pending', 0);
      await updateExecutionStatus(execution_id, 'running', 50);
      await updateExecutionStatus(execution_id, 'completed', 100);

      // Assert
      const calls = dynamoMock.calls();
      const statuses = calls.map(call => {
        const input = call.args[0].input as any;
        return input.Item.status.S;
      });

      expect(statuses).toEqual(['pending', 'running', 'completed']);
    });

    it('失敗時にエラーメッセージが記録される', async () => {
      // Arrange
      const execution_id = 'exec_test_005';
      const error_message = 'Network error occurred';
      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await updateExecutionStatus(execution_id, 'failed', 50, 10, 5, error_message);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      expect(input.Item.status.S).toBe('failed');
      expect(input.Item.error_message.S).toBe(error_message);
      expect(parseInt(input.Item.collected_count.N)).toBe(10);
      expect(parseInt(input.Item.failed_count.N)).toBe(5);
    });
  });

  describe('プロパティベーステスト', () => {
    it('任意の進捗率シーケンスで単調性が保たれる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 2, maxLength: 10 }),
          async (progressValues) => {
            // Arrange
            dynamoMock.reset();
            dynamoMock.on(PutItemCommand).resolves({});
            const execution_id = `exec_test_${Math.random().toString(36).substring(7)}`;

            // ソートして単調増加にする
            const sortedProgress = [...progressValues].sort((a, b) => a - b);

            // Act
            for (const progress of sortedProgress) {
              const status = progress === 0 ? 'pending' : progress === 100 ? 'completed' : 'running';
              await updateExecutionStatus(execution_id, status, progress);
            }

            // Assert
            const calls = dynamoMock.calls();
            const progresses = calls.map(call => {
              const input = call.args[0].input as any;
              return parseInt(input.Item.progress.N);
            });

            // 進捗率が単調増加（または同じ値）
            for (let i = 1; i < progresses.length; i++) {
              expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
            }
          }
        ),
        { numRuns: 100 } // 100回反復
      );
    });

    it('任意の実行IDで進捗率が0-100の範囲内に収まる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.integer({ min: -1000, max: 1000 }), // 範囲外の値も含む
          async (execution_id, progress) => {
            // Arrange
            dynamoMock.reset();
            dynamoMock.on(PutItemCommand).resolves({});

            // Act
            await updateExecutionStatus(execution_id, 'running', progress);

            // Assert
            const call = dynamoMock.call(0);
            const input = call.args[0].input as any;
            const actualProgress = parseInt(input.Item.progress.N);

            // 進捗率が0-100の範囲内
            expect(actualProgress).toBeGreaterThanOrEqual(0);
            expect(actualProgress).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 } // 100回反復
      );
    });
  });
});

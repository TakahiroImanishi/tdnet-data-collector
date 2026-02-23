/**
 * Lambda Collector Aggregate Handler ユニットテスト
 */

import { Context } from 'aws-lambda';
import { handler, AggregateEvent, AggregateResponse } from '../handler';
import { updateExecutionStatus } from '../../collector/update-execution-status';
import { sendErrorMetric, sendMetrics } from '../../../utils/cloudwatch-metrics';
import {
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../../../utils/metrics';

// モック
jest.mock('../../collector/update-execution-status');
jest.mock('../../../utils/cloudwatch-metrics');
jest.mock('../../../utils/metrics');

const mockUpdateExecutionStatus = updateExecutionStatus as jest.MockedFunction<
  typeof updateExecutionStatus
>;
const mockSendErrorMetric = sendErrorMetric as jest.MockedFunction<typeof sendErrorMetric>;
const mockSendMetrics = sendMetrics as jest.MockedFunction<typeof sendMetrics>;
const mockSendDisclosuresCollectedMetric = sendDisclosuresCollectedMetric as jest.MockedFunction<
  typeof sendDisclosuresCollectedMetric
>;
const mockSendDisclosuresFailedMetric = sendDisclosuresFailedMetric as jest.MockedFunction<
  typeof sendDisclosuresFailedMetric
>;
const mockSendCollectionSuccessRateMetric = sendCollectionSuccessRateMetric as jest.MockedFunction<
  typeof sendCollectionSuccessRateMetric
>;

describe('Lambda Collector Aggregate Handler', () => {
  let mockContext: Context;

  beforeEach(() => {
    jest.clearAllMocks();

    // Lambda Contextのモック
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'CollectorAggregateFunction',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:CollectorAggregateFunction',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/CollectorAggregateFunction',
      logStreamName: '2024/01/15/[$LATEST]test',
      callbackWaitsForEmptyEventLoop: true,
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };

    // デフォルトのモック実装
    mockUpdateExecutionStatus.mockResolvedValue({
      execution_id: 'exec_test',
      status: 'completed',
      progress: 100,
      collected_count: 0,
      failed_count: 0,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });

    mockSendDisclosuresCollectedMetric.mockResolvedValue();
    mockSendDisclosuresFailedMetric.mockResolvedValue();
    mockSendCollectionSuccessRateMetric.mockResolvedValue();
    mockSendMetrics.mockResolvedValue();
  });

  describe('正常系', () => {
    test('全件成功の場合、statusがsuccessになる', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_001',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 100, failed_count: 0 } },
          { saveResult: { page_number: '2024-01-16', saved_count: 150, failed_count: 0 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_001',
        status: 'success',
        total_collected: 250,
        total_failed: 0,
        success_rate: 100,
      });

      // 実行状態の更新を確認
      expect(mockUpdateExecutionStatus).toHaveBeenCalledWith(
        'exec_test_001',
        'completed',
        100,
        250,
        0,
        undefined
      );

      // メトリクス送信を確認
      expect(mockSendDisclosuresCollectedMetric).toHaveBeenCalledWith(
        250,
        mockContext.functionName
      );
      expect(mockSendDisclosuresFailedMetric).toHaveBeenCalledWith(
        0,
        mockContext.functionName
      );
      expect(mockSendCollectionSuccessRateMetric).toHaveBeenCalledWith(
        100,
        mockContext.functionName
      );
    });

    test('部分的成功の場合、statusがpartial_successになる', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_002',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 95, failed_count: 5 } },
          { saveResult: { page_number: '2024-01-16', saved_count: 148, failed_count: 2 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_002',
        status: 'partial_success',
        total_collected: 243,
        total_failed: 7,
        success_rate: 97.2,
      });

      // 実行状態の更新を確認
      expect(mockUpdateExecutionStatus).toHaveBeenCalledWith(
        'exec_test_002',
        'completed',
        100,
        243,
        7,
        undefined
      );

      // メトリクス送信を確認
      expect(mockSendDisclosuresCollectedMetric).toHaveBeenCalledWith(
        243,
        mockContext.functionName
      );
      expect(mockSendDisclosuresFailedMetric).toHaveBeenCalledWith(
        7,
        mockContext.functionName
      );
      expect(mockSendCollectionSuccessRateMetric).toHaveBeenCalledWith(
        97.2,
        mockContext.functionName
      );
    });

    test('全件失敗の場合、statusがfailedになる', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_003',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 0, failed_count: 100 } },
          { saveResult: { page_number: '2024-01-16', saved_count: 0, failed_count: 150 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_003',
        status: 'failed',
        total_collected: 0,
        total_failed: 250,
        success_rate: 0,
      });

      // 実行状態の更新を確認（failedステータス）
      expect(mockUpdateExecutionStatus).toHaveBeenCalledWith(
        'exec_test_003',
        'failed',
        100,
        0,
        250,
        'Collection failed'
      );

      // メトリクス送信を確認
      expect(mockSendDisclosuresCollectedMetric).toHaveBeenCalledWith(
        0,
        mockContext.functionName
      );
      expect(mockSendDisclosuresFailedMetric).toHaveBeenCalledWith(
        250,
        mockContext.functionName
      );
      expect(mockSendCollectionSuccessRateMetric).toHaveBeenCalledWith(
        0,
        mockContext.functionName
      );
    });

    test('結果が空の場合、success_rateが0になる', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_004',
        results: [],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_004',
        status: 'success',
        total_collected: 0,
        total_failed: 0,
        success_rate: 0,
      });

      // 実行状態の更新を確認
      expect(mockUpdateExecutionStatus).toHaveBeenCalledWith(
        'exec_test_004',
        'completed',
        100,
        0,
        0,
        undefined
      );
    });

    test('success_rateがNaNにならないことを確認', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_009',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 0, failed_count: 0 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response.success_rate).toBe(0);
      expect(Number.isFinite(response.success_rate)).toBe(true);
      expect(Number.isNaN(response.success_rate)).toBe(false);
    });

    test('saveResultがないページを無視する', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_010',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 100, failed_count: 0 } },
          {}, // saveResultなし（ページ失敗）
          { saveResult: { page_number: '2024-01-17', saved_count: 50, failed_count: 5 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_010',
        status: 'partial_success',
        total_collected: 150,
        total_failed: 5,
        success_rate: 96.77419354838710,
      });
    });
  });

  describe('異常系', () => {
    test('DynamoDB書き込みエラー時、エラーをスローする', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_005',
        results: [
          { date: '2024-01-15', success_count: 100, failed_count: 0 },
        ],
      };

      const dbError = new Error('DynamoDB write failed');
      mockUpdateExecutionStatus.mockRejectedValueOnce(dbError);

      await expect(handler(event, mockContext)).rejects.toThrow('DynamoDB write failed');

      // エラーメトリクスが送信されることを確認
      expect(mockSendErrorMetric).toHaveBeenCalledWith('Error', 'CollectorAggregate');

      // 実行状態を失敗に更新しようとすることを確認
      expect(mockUpdateExecutionStatus).toHaveBeenCalledTimes(2);
      expect(mockUpdateExecutionStatus).toHaveBeenNthCalledWith(
        2,
        'exec_test_005',
        'failed',
        100,
        0,
        0,
        'DynamoDB write failed'
      );
    });

    test('メトリクス送信エラー時、処理は継続する', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_006',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 100, failed_count: 0 } },
        ],
      };

      // メトリクス送信でエラー
      mockSendDisclosuresCollectedMetric.mockRejectedValueOnce(
        new Error('CloudWatch error')
      );

      // エラーをスローせず、正常に完了する
      const response: AggregateResponse = await handler(event, mockContext);

      expect(response).toEqual({
        execution_id: 'exec_test_006',
        status: 'success',
        total_collected: 100,
        total_failed: 0,
        success_rate: 100,
      });

      // 実行状態の更新は成功している
      expect(mockUpdateExecutionStatus).toHaveBeenCalledWith(
        'exec_test_006',
        'completed',
        100,
        100,
        0,
        undefined
      );
    });
  });

  describe('エッジケース', () => {
    test('大量の結果を集約できる', async () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push({
          saveResult: {
            page_number: `2024-01-${String(i + 1).padStart(2, '0')}`,
            saved_count: 100,
            failed_count: 5,
          },
        });
      }

      const event: AggregateEvent = {
        execution_id: 'exec_test_007',
        results,
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response.execution_id).toBe('exec_test_007');
      expect(response.status).toBe('partial_success');
      expect(response.total_collected).toBe(10000);
      expect(response.total_failed).toBe(500);
      expect(response.success_rate).toBeCloseTo(95.238, 2);
    });

    test('成功率の計算が正確である', async () => {
      const event: AggregateEvent = {
        execution_id: 'exec_test_008',
        results: [
          { saveResult: { page_number: '2024-01-15', saved_count: 97, failed_count: 3 } },
        ],
      };

      const response: AggregateResponse = await handler(event, mockContext);

      expect(response.success_rate).toBe(97);
    });
  });
});

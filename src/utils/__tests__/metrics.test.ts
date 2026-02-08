/**
 * CloudWatchメトリクスヘルパーのユニットテスト
 *
 * メトリクス送信機能の動作を検証します。
 * Lambda実装チェックリストの「エラーメトリクス送信」に対応。
 *
 * Requirements: 要件6.4（エラーメトリクス）
 */

import {
  sendMetric,
  sendErrorMetric,
  sendSuccessMetric,
  sendExecutionTimeMetric,
  sendBatchResultMetrics,
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../metrics';
import { ValidationError, RetryableError } from '../../errors';

// AWS SDK v3のモック
jest.mock('@aws-sdk/client-cloudwatch', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  
  return {
    CloudWatchClient: jest.fn(() => ({
      send: mockSend,
    })),
    PutMetricDataCommand: jest.fn((params) => params),
  };
});

describe('CloudWatch Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMetric', () => {
    it('should send metric with default options', async () => {
      await sendMetric('TestMetric', 1);

      const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Namespace: 'TDnetDataCollector',
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'TestMetric',
              Value: 1,
              Unit: 'Count',
            }),
          ]),
        })
      );
    });

    it('should send metric with custom namespace', async () => {
      await sendMetric('TestMetric', 1, {
        namespace: 'CustomNamespace',
      });

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Namespace: 'CustomNamespace',
        })
      );
    });

    it('should send metric with dimensions', async () => {
      await sendMetric('TestMetric', 1, {
        dimensions: [
          { Name: 'ErrorType', Value: 'ValidationError' },
          { Name: 'FunctionName', Value: 'TestFunction' },
        ],
      });

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Dimensions: [
                { Name: 'ErrorType', Value: 'ValidationError' },
                { Name: 'FunctionName', Value: 'TestFunction' },
              ],
            }),
          ]),
        })
      );
    });

    it('should send metric with custom unit', async () => {
      await sendMetric('ExecutionTime', 1234, {
        unit: 'Milliseconds',
      });

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Unit: 'Milliseconds',
              Value: 1234,
            }),
          ]),
        })
      );
    });

    it('should not throw error on metric send failure', async () => {
      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      mockClient.send.mockRejectedValueOnce(new Error('Network error'));

      // メトリクス送信失敗でもエラーをスローしない
      await expect(sendMetric('TestMetric', 1)).resolves.not.toThrow();
    });
  });

  describe('sendErrorMetric', () => {
    it('should send error metric with error type', async () => {
      const error = new ValidationError('Invalid input');
      
      await sendErrorMetric(error);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'LambdaError',
              Value: 1,
              Dimensions: [
                { Name: 'ErrorType', Value: 'ValidationError' },
              ],
            }),
          ]),
        })
      );
    });

    it('should send error metric with function name', async () => {
      const error = new RetryableError('Network error');
      
      await sendErrorMetric(error, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Dimensions: [
                { Name: 'ErrorType', Value: 'RetryableError' },
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });

    it('should handle standard Error objects', async () => {
      const error = new Error('Standard error');
      
      await sendErrorMetric(error);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Dimensions: [
                { Name: 'ErrorType', Value: 'Error' },
              ],
            }),
          ]),
        })
      );
    });
  });

  describe('sendSuccessMetric', () => {
    it('should send success metric without function name', async () => {
      await sendSuccessMetric();

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'LambdaSuccess',
              Value: 1,
              Dimensions: [],
            }),
          ]),
        })
      );
    });

    it('should send success metric with function name', async () => {
      await sendSuccessMetric('CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Dimensions: [
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });
  });

  describe('sendExecutionTimeMetric', () => {
    it('should send execution time metric', async () => {
      await sendExecutionTimeMetric(1234);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'ExecutionTime',
              Value: 1234,
              Unit: 'Milliseconds',
            }),
          ]),
        })
      );
    });

    it('should send execution time metric with function name', async () => {
      await sendExecutionTimeMetric(1234, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Dimensions: [
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });
  });

  describe('sendBatchResultMetrics', () => {
    it('should send batch success and failed metrics', async () => {
      await sendBatchResultMetrics(95, 5);

      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      
      // 2回呼ばれる（success + failed）
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it('should send batch metrics with function name', async () => {
      await sendBatchResultMetrics(95, 5, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      // BatchSuccessとBatchFailedの両方が送信される
      const calls = PutMetricDataCommand.mock.calls;
      expect(calls.length).toBe(2);
      
      // 各呼び出しにFunctionNameディメンションが含まれる
      calls.forEach((call: any) => {
        expect(call[0].MetricData[0].Dimensions).toContainEqual({
          Name: 'FunctionName',
          Value: 'CollectorFunction',
        });
      });
    });

    it('should send correct values for success and failed', async () => {
      await sendBatchResultMetrics(95, 5);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      const calls = PutMetricDataCommand.mock.calls;
      
      // BatchSuccessメトリクス
      const successCall = calls.find(
        (call: any) => call[0].MetricData[0].MetricName === 'BatchSuccess'
      );
      expect(successCall[0].MetricData[0].Value).toBe(95);
      
      // BatchFailedメトリクス
      const failedCall = calls.find(
        (call: any) => call[0].MetricData[0].MetricName === 'BatchFailed'
      );
      expect(failedCall[0].MetricData[0].Value).toBe(5);
    });
  });

  describe('Lambda Integration Example', () => {
    it('should demonstrate complete Lambda error handling with metrics', async () => {
      // Lambda実装チェックリストに準拠した実装例
      const mockHandler = async (_event: any, context: any) => {
        const startTime = Date.now();
        
        try {
          // メイン処理（成功）
          await Promise.resolve({ success: true });
          
          // 成功メトリクス送信
          await sendSuccessMetric(context.functionName);
          
          // 実行時間メトリクス送信
          const executionTime = Date.now() - startTime;
          await sendExecutionTimeMetric(executionTime, context.functionName);
          
          return { statusCode: 200, body: JSON.stringify({ success: true }) };
        } catch (error) {
          // エラーメトリクス送信
          await sendErrorMetric(error as Error, context.functionName);
          throw error;
        }
      };

      const mockContext = {
        functionName: 'TestFunction',
        requestId: 'test-request-id',
      };

      await mockHandler({}, mockContext);

      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      
      // 成功メトリクスと実行時間メトリクスが送信される
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it('should demonstrate batch processing with metrics', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      let success = 0;
      let failed = 0;

      for (const _item of items) {
        try {
          // 5%の確率で失敗
          if (Math.random() < 0.05) {
            throw new Error('Random failure');
          }
          success++;
        } catch (error) {
          failed++;
        }
      }

      // バッチ結果メトリクス送信
      await sendBatchResultMetrics(success, failed, 'BatchFunction');

      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendDisclosuresCollectedMetric', () => {
    it('should send disclosures collected metric without function name', async () => {
      await sendDisclosuresCollectedMetric(150);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'DisclosuresCollected',
              Value: 150,
              Dimensions: [],
            }),
          ]),
        })
      );
    });

    it('should send disclosures collected metric with function name', async () => {
      await sendDisclosuresCollectedMetric(150, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'DisclosuresCollected',
              Value: 150,
              Dimensions: [
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });
  });

  describe('sendDisclosuresFailedMetric', () => {
    it('should send disclosures failed metric without function name', async () => {
      await sendDisclosuresFailedMetric(5);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'DisclosuresFailed',
              Value: 5,
              Dimensions: [],
            }),
          ]),
        })
      );
    });

    it('should send disclosures failed metric with function name', async () => {
      await sendDisclosuresFailedMetric(5, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'DisclosuresFailed',
              Value: 5,
              Dimensions: [
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });
  });

  describe('sendCollectionSuccessRateMetric', () => {
    it('should send collection success rate metric without function name', async () => {
      await sendCollectionSuccessRateMetric(96.77);

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'CollectionSuccessRate',
              Value: 96.77,
              Unit: 'Count',
              Dimensions: [],
            }),
          ]),
        })
      );
    });

    it('should send collection success rate metric with function name', async () => {
      await sendCollectionSuccessRateMetric(96.77, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              MetricName: 'CollectionSuccessRate',
              Value: 96.77,
              Unit: 'Count',
              Dimensions: [
                { Name: 'FunctionName', Value: 'CollectorFunction' },
              ],
            }),
          ]),
        })
      );
    });

    it('should handle 100% success rate', async () => {
      await sendCollectionSuccessRateMetric(100, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Value: 100,
            }),
          ]),
        })
      );
    });

    it('should handle 0% success rate', async () => {
      await sendCollectionSuccessRateMetric(0, 'CollectorFunction');

      const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
      
      expect(PutMetricDataCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          MetricData: expect.arrayContaining([
            expect.objectContaining({
              Value: 0,
            }),
          ]),
        })
      );
    });
  });

  describe('Custom Metrics Integration Example', () => {
    it('should demonstrate complete collection metrics workflow', async () => {
      // 収集結果のシミュレーション
      const collectedCount = 150;
      const failedCount = 5;
      const totalCount = collectedCount + failedCount;
      const successRate = (collectedCount / totalCount) * 100;

      // カスタムメトリクスを送信
      await Promise.all([
        sendDisclosuresCollectedMetric(collectedCount, 'CollectorFunction'),
        sendDisclosuresFailedMetric(failedCount, 'CollectorFunction'),
        sendCollectionSuccessRateMetric(successRate, 'CollectorFunction'),
      ]);

      const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');
      const mockClient = new CloudWatchClient();
      
      // 3つのメトリクスが送信される
      expect(mockClient.send).toHaveBeenCalledTimes(3);
    });

    it('should calculate success rate correctly', async () => {
      const testCases = [
        { collected: 100, failed: 0, expectedRate: 100 },
        { collected: 95, failed: 5, expectedRate: 95 },
        { collected: 150, failed: 5, expectedRate: 96.77419354838710 },
        { collected: 0, failed: 10, expectedRate: 0 },
      ];

      for (const testCase of testCases) {
        const totalCount = testCase.collected + testCase.failed;
        const successRate = totalCount > 0 
          ? (testCase.collected / totalCount) * 100 
          : 0;

        expect(successRate).toBeCloseTo(testCase.expectedRate, 2);
      }
    });
  });
});

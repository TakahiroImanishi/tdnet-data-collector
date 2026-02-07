/**
 * CloudWatch Metrics送信ユーティリティのテスト
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';
import {
  sendMetric,
  sendMetrics,
  sendErrorMetric,
  sendSuccessMetric,
} from '../cloudwatch-metrics';

const cloudwatchMock = mockClient(CloudWatchClient);

describe('CloudWatch Metrics', () => {
  beforeEach(() => {
    cloudwatchMock.reset();
  });

  describe('sendMetric', () => {
    it('should send a single metric to CloudWatch', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendMetric('TestMetric', 100, 'Count', {
        TestDimension: 'TestValue',
      });

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'TDnetDataCollector',
        MetricData: [
          {
            MetricName: 'TestMetric',
            Value: 100,
            Unit: 'Count',
            Dimensions: [
              {
                Name: 'TestDimension',
                Value: 'TestValue',
              },
            ],
          },
        ],
      });
    });

    it('should send metric without dimensions', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendMetric('TestMetric', 50, 'Milliseconds');

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'TDnetDataCollector',
        MetricData: [
          {
            MetricName: 'TestMetric',
            Value: 50,
            Unit: 'Milliseconds',
            Dimensions: undefined,
          },
        ],
      });
    });

    it('should not throw error if CloudWatch API fails', async () => {
      cloudwatchMock.on(PutMetricDataCommand).rejects(new Error('CloudWatch error'));

      // メトリクス送信失敗でもエラーをスローしない
      await expect(
        sendMetric('TestMetric', 100, 'Count')
      ).resolves.not.toThrow();
    });
  });

  describe('sendMetrics', () => {
    it('should send multiple metrics to CloudWatch', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendMetrics([
        { name: 'Metric1', value: 10, unit: 'Count' },
        { name: 'Metric2', value: 20, unit: 'Milliseconds' },
        { name: 'Metric3', value: 30 },
      ]);

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      const input = call.args[0].input as any;
      expect(input.MetricData).toHaveLength(3);
      expect(input.MetricData[0]).toMatchObject({
        MetricName: 'Metric1',
        Value: 10,
        Unit: 'Count',
      });
      expect(input.MetricData[1]).toMatchObject({
        MetricName: 'Metric2',
        Value: 20,
        Unit: 'Milliseconds',
      });
      expect(input.MetricData[2]).toMatchObject({
        MetricName: 'Metric3',
        Value: 30,
        Unit: 'Count',
      });
    });

    it('should send metrics with dimensions', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendMetrics([
        {
          name: 'Metric1',
          value: 10,
          dimensions: { Dimension1: 'Value1' },
        },
        {
          name: 'Metric2',
          value: 20,
          dimensions: { Dimension2: 'Value2' },
        },
      ]);

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      const input = call.args[0].input as any;
      expect(input.MetricData[0].Dimensions).toEqual([
        { Name: 'Dimension1', Value: 'Value1' },
      ]);
      expect(input.MetricData[1].Dimensions).toEqual([
        { Name: 'Dimension2', Value: 'Value2' },
      ]);
    });
  });

  describe('sendErrorMetric', () => {
    it('should send error metric with correct dimensions', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendErrorMetric('NetworkError', 'Collector', {
        Date: '2024-01-15',
      });

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'TDnetDataCollector',
        MetricData: [
          {
            MetricName: 'LambdaError',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
              { Name: 'ErrorType', Value: 'NetworkError' },
              { Name: 'FunctionName', Value: 'Collector' },
              { Name: 'Date', Value: '2024-01-15' },
            ],
          },
        ],
      });
    });
  });

  describe('sendSuccessMetric', () => {
    it('should send success metric with correct dimensions', async () => {
      cloudwatchMock.on(PutMetricDataCommand).resolves({});

      await sendSuccessMetric(10, 'Collector', {
        Date: '2024-01-15',
      });

      expect(cloudwatchMock.calls()).toHaveLength(1);
      const call = cloudwatchMock.call(0);
      expect(call.args[0].input).toMatchObject({
        Namespace: 'TDnetDataCollector',
        MetricData: [
          {
            MetricName: 'OperationSuccess',
            Value: 10,
            Unit: 'Count',
            Dimensions: [
              { Name: 'FunctionName', Value: 'Collector' },
              { Name: 'Date', Value: '2024-01-15' },
            ],
          },
        ],
      });
    });
  });
});

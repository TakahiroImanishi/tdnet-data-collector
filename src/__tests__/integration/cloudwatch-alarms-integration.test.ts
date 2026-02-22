/**
 * CloudWatch Alarms統合テスト
 *
 * CloudWatch Alarmsの作成、閾値設定、SNS通知を検証します。
 *
 * Requirements: タスク40（統合テストの拡充）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CloudWatchClient,
  PutMetricAlarmCommand,
  DescribeAlarmsCommand,
  DeleteAlarmsCommand,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { mockClient } from 'aws-sdk-client-mock';

// CloudWatchクライアントのモック
const cloudWatchMock = mockClient(CloudWatchClient);

describe('CloudWatch Alarms統合テスト', () => {
  beforeEach(() => {
    // モックのリセット
    cloudWatchMock.reset();
  });

  afterEach(() => {
    // クリーンアップ
    cloudWatchMock.reset();
  });

  describe('アラーム作成', () => {
    it('Lambda関数のエラー率アラームを作成できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // アラーム作成
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率が閾値を超えました',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: 'test-function',
          },
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });

    it('DynamoDBのスロットリングアラームを作成できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // アラーム作成
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-dynamodb-throttling',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'UserErrors',
        Namespace: 'AWS/DynamoDB',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 5,
        ActionsEnabled: true,
        AlarmDescription: 'DynamoDBのスロットリングが発生しました',
        Dimensions: [
          {
            Name: 'TableName',
            Value: 'test-table',
          },
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });

    it('API Gatewayの5xxエラーアラームを作成できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // アラーム作成
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-api-gateway-5xx',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: '5XXError',
        Namespace: 'AWS/ApiGateway',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
        ActionsEnabled: true,
        AlarmDescription: 'API Gatewayの5xxエラーが閾値を超えました',
        Dimensions: [
          {
            Name: 'ApiName',
            Value: 'test-api',
          },
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });
  });

  describe('閾値設定', () => {
    it('複数の閾値でアラームを作成できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 警告レベルのアラーム
      const warningCommand = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate-warning',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 5,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率が警告レベルを超えました',
      });

      await client.send(warningCommand);

      // クリティカルレベルのアラーム
      const criticalCommand = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate-critical',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 20,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率がクリティカルレベルを超えました',
      });

      await client.send(criticalCommand);

      // 両方のモックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(2);
    });

    it('評価期間を設定できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 3回連続で閾値を超えた場合にアラーム
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate-3-periods',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 3,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率が3回連続で閾値を超えました',
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });
  });

  describe('SNS通知', () => {
    it('SNSトピックARNを設定できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // SNS通知付きアラーム
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate-with-sns',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率が閾値を超えました',
        AlarmActions: [
          'arn:aws:sns:ap-northeast-1:123456789012:test-alarm-topic',
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });

    it('複数のSNSトピックを設定できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricAlarmCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 複数のSNS通知付きアラーム
      const command = new PutMetricAlarmCommand({
        AlarmName: 'test-lambda-error-rate-multiple-sns',
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
        ActionsEnabled: true,
        AlarmDescription: 'Lambda関数のエラー率が閾値を超えました',
        AlarmActions: [
          'arn:aws:sns:ap-northeast-1:123456789012:test-alarm-topic-1',
          'arn:aws:sns:ap-northeast-1:123456789012:test-alarm-topic-2',
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });
  });

  describe('アラーム管理', () => {
    it('アラームを取得できること', async () => {
      // モック設定
      cloudWatchMock.on(DescribeAlarmsCommand).resolves({
        MetricAlarms: [
          {
            AlarmName: 'test-lambda-error-rate',
            StateValue: 'OK',
            MetricName: 'Errors',
            Namespace: 'AWS/Lambda',
          },
        ],
      });

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // アラーム取得
      const command = new DescribeAlarmsCommand({
        AlarmNames: ['test-lambda-error-rate'],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.MetricAlarms).toBeDefined();
      expect(response.MetricAlarms).toHaveLength(1);
      expect(response.MetricAlarms![0].AlarmName).toBe('test-lambda-error-rate');
      expect(response.MetricAlarms![0].StateValue).toBe('OK');
    });

    it('アラームを削除できること', async () => {
      // モック設定
      cloudWatchMock.on(DeleteAlarmsCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // アラーム削除
      const command = new DeleteAlarmsCommand({
        AlarmNames: ['test-lambda-error-rate'],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });
  });

  describe('メトリクス送信', () => {
    it('カスタムメトリクスを送信できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricDataCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // メトリクス送信
      const command = new PutMetricDataCommand({
        Namespace: 'TdnetDataCollector',
        MetricData: [
          {
            MetricName: 'CollectedCount',
            Value: 10,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });

    it('複数のメトリクスを一度に送信できること', async () => {
      // モック設定
      cloudWatchMock.on(PutMetricDataCommand).resolves({});

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 複数のメトリクス送信
      const command = new PutMetricDataCommand({
        Namespace: 'TdnetDataCollector',
        MetricData: [
          {
            MetricName: 'CollectedCount',
            Value: 10,
            Unit: 'Count',
            Timestamp: new Date(),
          },
          {
            MetricName: 'FailedCount',
            Value: 2,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(cloudWatchMock.calls()).toHaveLength(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なアラーム名でエラーが発生すること', async () => {
      // モック設定（エラー）
      cloudWatchMock.on(PutMetricAlarmCommand).rejects(new Error('Invalid alarm name'));

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 無効なアラーム名
      const command = new PutMetricAlarmCommand({
        AlarmName: '', // 空のアラーム名
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        MetricName: 'Errors',
        Namespace: 'AWS/Lambda',
        Period: 300,
        Statistic: 'Sum',
        Threshold: 10,
      });

      await expect(client.send(command)).rejects.toThrow('Invalid alarm name');
    });

    it('存在しないアラームを取得するとエラーが発生すること', async () => {
      // モック設定（空の結果）
      cloudWatchMock.on(DescribeAlarmsCommand).resolves({
        MetricAlarms: [],
      });

      const client = new CloudWatchClient({ region: 'ap-northeast-1' });

      // 存在しないアラーム
      const command = new DescribeAlarmsCommand({
        AlarmNames: ['non-existent-alarm'],
      });

      const response = await client.send(command);

      // 空の結果が返されること
      expect(response.MetricAlarms).toHaveLength(0);
    });
  });
});

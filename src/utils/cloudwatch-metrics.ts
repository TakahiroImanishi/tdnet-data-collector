/**
 * CloudWatch Metrics送信ユーティリティ
 *
 * Lambda関数からCloudWatchにカスタムメトリクスを送信します。
 * エラー発生時の監視とアラート設定に使用します。
 *
 * Requirements: 要件7.1（監視とアラート）
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

// CloudWatchクライアントはグローバルスコープで初期化（再利用される）
const cloudwatchClient = new CloudWatchClient({});

/**
 * メトリクス名前空間
 */
const NAMESPACE = 'TDnet';

/**
 * メトリクスディメンション
 */
export interface MetricDimensions {
  [key: string]: string;
}

/**
 * CloudWatchにメトリクスを送信
 *
 * @param metricName メトリクス名
 * @param value メトリクス値
 * @param unit メトリクス単位（デフォルト: Count）
 * @param dimensions ディメンション（オプション）
 *
 * @example
 * ```typescript
 * // エラーカウント
 * await sendMetric('LambdaError', 1, 'Count', {
 *   ErrorType: 'NetworkError',
 *   FunctionName: 'Collector',
 * });
 *
 * // 処理時間
 * await sendMetric('ProcessingTime', 1234, 'Milliseconds', {
 *   FunctionName: 'Collector',
 * });
 *
 * // 成功カウント
 * await sendMetric('DisclosuresCollected', 10, 'Count', {
 *   Date: '2024-01-15',
 * });
 * ```
 */
export async function sendMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent' = 'Count',
  dimensions?: MetricDimensions
): Promise<void> {
  try {
    const metricData = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: dimensions
        ? Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    };

    await cloudwatchClient.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [metricData],
      })
    );

    logger.debug('Metric sent to CloudWatch', {
      namespace: NAMESPACE,
      metric_name: metricName,
      value,
      unit,
      dimensions,
    });
  } catch (error) {
    // メトリクス送信失敗はログに記録するが、エラーをスローしない
    // メトリクス送信失敗でメイン処理を中断しないため
    logger.warn('Failed to send metric to CloudWatch', {
      metric_name: metricName,
      value,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 複数のメトリクスを一括送信
 *
 * @param metrics メトリクスの配列
 *
 * @example
 * ```typescript
 * await sendMetrics([
 *   { name: 'DisclosuresCollected', value: 10, unit: 'Count' },
 *   { name: 'DisclosuresFailed', value: 2, unit: 'Count' },
 *   { name: 'ProcessingTime', value: 5000, unit: 'Milliseconds' },
 * ]);
 * ```
 */
export async function sendMetrics(
  metrics: Array<{
    name: string;
    value: number;
    unit?: 'Count' | 'Milliseconds' | 'Bytes' | 'Percent';
    dimensions?: MetricDimensions;
  }>
): Promise<void> {
  try {
    const metricData = metrics.map((metric) => ({
      MetricName: metric.name,
      Value: metric.value,
      Unit: metric.unit || 'Count',
      Timestamp: new Date(),
      Dimensions: metric.dimensions
        ? Object.entries(metric.dimensions).map(([Name, Value]) => ({ Name, Value }))
        : undefined,
    }));

    await cloudwatchClient.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: metricData,
      })
    );

    logger.debug('Metrics sent to CloudWatch', {
      namespace: NAMESPACE,
      count: metrics.length,
    });
  } catch (error) {
    logger.warn('Failed to send metrics to CloudWatch', {
      count: metrics.length,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * エラーメトリクスを送信
 *
 * @param errorType エラータイプ
 * @param functionName 関数名
 * @param additionalDimensions 追加ディメンション（オプション）
 *
 * @example
 * ```typescript
 * try {
 *   await operation();
 * } catch (error) {
 *   await sendErrorMetric(
 *     error.constructor.name,
 *     'Collector',
 *     { Date: '2024-01-15' }
 *   );
 *   throw error;
 * }
 * ```
 */
export async function sendErrorMetric(
  errorType: string,
  functionName: string,
  additionalDimensions?: MetricDimensions
): Promise<void> {
  await sendMetric('LambdaError', 1, 'Count', {
    ErrorType: errorType,
    FunctionName: functionName,
    ...additionalDimensions,
  });
}

/**
 * 成功メトリクスを送信
 *
 * @param count 成功件数
 * @param functionName 関数名
 * @param additionalDimensions 追加ディメンション（オプション）
 *
 * @example
 * ```typescript
 * await sendSuccessMetric(10, 'Collector', { Date: '2024-01-15' });
 * ```
 */
export async function sendSuccessMetric(
  count: number,
  functionName: string,
  additionalDimensions?: MetricDimensions
): Promise<void> {
  await sendMetric('OperationSuccess', count, 'Count', {
    FunctionName: functionName,
    ...additionalDimensions,
  });
}

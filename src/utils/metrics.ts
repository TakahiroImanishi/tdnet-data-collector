/**
 * CloudWatchメトリクス送信ヘルパー
 *
 * Lambda実装チェックリストの「エラーメトリクス送信」に対応。
 * CloudWatch Metricsにカスタムメトリクスを送信します。
 *
 * Requirements: 要件6.4（エラーメトリクス）
 */

import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { logger } from './logger';

/**
 * CloudWatchクライアント
 */
const cloudwatch = new CloudWatchClient({});

/**
 * メトリクスディメンション
 */
export interface MetricDimension {
  Name: string;
  Value: string;
}

/**
 * メトリクスオプション
 */
export interface MetricOptions {
  /**
   * メトリクス名前空間（デフォルト: TDnetDataCollector）
   */
  namespace?: string;

  /**
   * メトリクスディメンション（オプション）
   */
  dimensions?: MetricDimension[];

  /**
   * メトリクス単位（オプション）
   */
  unit?: 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes';

  /**
   * タイムスタンプ（オプション、デフォルト: 現在時刻）
   */
  timestamp?: Date;
}

/**
 * CloudWatchにメトリクスを送信
 *
 * @param metricName メトリクス名
 * @param value メトリクス値
 * @param options メトリクスオプション
 *
 * @example
 * ```typescript
 * // エラーカウントを送信
 * await sendMetric('LambdaError', 1, {
 *   dimensions: [
 *     { Name: 'ErrorType', Value: 'ValidationError' },
 *     { Name: 'FunctionName', Value: 'CollectorFunction' },
 *   ],
 * });
 *
 * // 実行時間を送信
 * await sendMetric('ExecutionTime', 1234, {
 *   unit: 'Milliseconds',
 *   dimensions: [
 *     { Name: 'FunctionName', Value: 'CollectorFunction' },
 *   ],
 * });
 * ```
 */
export async function sendMetric(
  metricName: string,
  value: number,
  options: MetricOptions = {}
): Promise<void> {
  const {
    namespace = 'TDnetDataCollector',
    dimensions = [],
    unit = 'Count',
    timestamp = new Date(),
  } = options;

  try {
    const command = new PutMetricDataCommand({
      Namespace: namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: timestamp,
          Dimensions: dimensions,
        },
      ],
    });

    await cloudwatch.send(command);

    logger.debug('Metric sent successfully', {
      metric_name: metricName,
      value,
      namespace,
      dimensions,
    });
  } catch (error) {
    // メトリクス送信失敗はログに記録するが、エラーをスローしない
    // （メトリクス送信失敗でLambda実行を失敗させない）
    logger.warn('Failed to send metric', {
      metric_name: metricName,
      value,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * エラーメトリクスを送信
 *
 * Lambda実装チェックリストに準拠したエラーメトリクス送信。
 *
 * @param error エラーオブジェクト
 * @param functionName Lambda関数名（オプション）
 *
 * @example
 * ```typescript
 * export async function handler(event: any, context: any) {
 *   try {
 *     await operation();
 *   } catch (error) {
 *     await sendErrorMetric(error, context.functionName);
 *     throw error;
 *   }
 * }
 * ```
 */
export async function sendErrorMetric(
  error: Error,
  functionName?: string
): Promise<void> {
  const dimensions: MetricDimension[] = [
    { Name: 'ErrorType', Value: error.constructor.name },
  ];

  if (functionName) {
    dimensions.push({ Name: 'FunctionName', Value: functionName });
  }

  await sendMetric('LambdaError', 1, { dimensions });
}

/**
 * 成功メトリクスを送信
 *
 * @param functionName Lambda関数名（オプション）
 *
 * @example
 * ```typescript
 * export async function handler(event: any, context: any) {
 *   try {
 *     await operation();
 *     await sendSuccessMetric(context.functionName);
 *   } catch (error) {
 *     await sendErrorMetric(error, context.functionName);
 *     throw error;
 *   }
 * }
 * ```
 */
export async function sendSuccessMetric(functionName?: string): Promise<void> {
  const dimensions: MetricDimension[] = [];

  if (functionName) {
    dimensions.push({ Name: 'FunctionName', Value: functionName });
  }

  await sendMetric('LambdaSuccess', 1, { dimensions });
}

/**
 * 実行時間メトリクスを送信
 *
 * @param executionTime 実行時間（ミリ秒）
 * @param functionName Lambda関数名（オプション）
 *
 * @example
 * ```typescript
 * export async function handler(event: any, context: any) {
 *   const startTime = Date.now();
 *   try {
 *     await operation();
 *     const executionTime = Date.now() - startTime;
 *     await sendExecutionTimeMetric(executionTime, context.functionName);
 *   } catch (error) {
 *     throw error;
 *   }
 * }
 * ```
 */
export async function sendExecutionTimeMetric(
  executionTime: number,
  functionName?: string
): Promise<void> {
  const dimensions: MetricDimension[] = [];

  if (functionName) {
    dimensions.push({ Name: 'FunctionName', Value: functionName });
  }

  await sendMetric('ExecutionTime', executionTime, {
    unit: 'Milliseconds',
    dimensions,
  });
}

/**
 * バッチ処理結果メトリクスを送信
 *
 * @param success 成功件数
 * @param failed 失敗件数
 * @param functionName Lambda関数名（オプション）
 *
 * @example
 * ```typescript
 * const results = { success: 95, failed: 5 };
 * await sendBatchResultMetrics(results.success, results.failed, context.functionName);
 * ```
 */
export async function sendBatchResultMetrics(
  success: number,
  failed: number,
  functionName?: string
): Promise<void> {
  const dimensions: MetricDimension[] = [];

  if (functionName) {
    dimensions.push({ Name: 'FunctionName', Value: functionName });
  }

  await Promise.all([
    sendMetric('BatchSuccess', success, { dimensions }),
    sendMetric('BatchFailed', failed, { dimensions }),
  ]);
}

/**
 * Lambda Collector Aggregate Handler
 *
 * Step Functions移行に伴う集約Lambda関数。
 * 各日付の実行結果を集約し、統計情報を計算して実行状態を更新します。
 *
 * Requirements: 要件5.4（実行状態管理）
 * 
 * 関連ドキュメント:
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/core/error-handling-patterns.md
 */

import { Context } from 'aws-lambda';
import { logger, createErrorContext } from '../../utils/logger';
import { sendErrorMetric, sendMetrics } from '../../utils/cloudwatch-metrics';
import {
  sendDisclosuresCollectedMetric,
  sendDisclosuresFailedMetric,
  sendCollectionSuccessRateMetric,
} from '../../utils/metrics';
import { updateExecutionStatus } from '../collector/update-execution-status';

/**
 * 集約イベント
 */
export interface AggregateEvent {
  /** 実行ID */
  execution_id: string;

  /** Map状態の実行結果（Step Functionsから渡される） */
  results: Array<{
    /** Save結果 */
    saveResult?: {
      /** ページ番号（日付文字列） */
      page_number: string;
      /** 保存成功件数 */
      saved_count: number;
      /** 保存失敗件数 */
      failed_count: number;
    };
  }>;
}

/**
 * 集約レスポンス
 */
export interface AggregateResponse {
  /** 実行ID */
  execution_id: string;

  /** 状態 */
  status: 'success' | 'partial_success' | 'failed';

  /** 総収集成功件数 */
  total_collected: number;

  /** 総収集失敗件数 */
  total_failed: number;

  /** 成功率（パーセンテージ） */
  success_rate: number;
}

/**
 * Lambda Collector Aggregateハンドラー
 *
 * @param event AggregateEvent
 * @param context Lambda Context
 * @returns AggregateResponse
 *
 * @example
 * ```typescript
 * const response = await handler({
 *   execution_id: 'exec_1234567890_abc123_12345678',
 *   results: [
 *     { date: '2024-01-15', success_count: 148, failed_count: 2 },
 *     { date: '2024-01-16', success_count: 200, failed_count: 0 },
 *   ],
 * }, context);
 * ```
 */
export async function handler(
  event: AggregateEvent,
  context: Context
): Promise<AggregateResponse> {
  const startTime = Date.now();

  try {
    logger.info('Lambda Collector Aggregate started', {
      event,
      execution_id: event.execution_id,
      request_id: context.awsRequestId,
      function_name: context.functionName,
    });

    // 実行結果の集約
    const { total_collected, total_failed } = aggregateResults(event.results);

    // 統計情報の計算
    const totalCount = total_collected + total_failed;
    const success_rate = totalCount > 0 
      ? (total_collected / totalCount) * 100 
      : 0;
    
    // NaN防止: success_rateが有効な数値であることを確認
    const validSuccessRate = Number.isFinite(success_rate) ? success_rate : 0;

    // ステータスの決定
    let status: 'success' | 'partial_success' | 'failed';
    if (total_failed === 0) {
      status = 'success';
    } else if (total_collected > 0) {
      status = 'partial_success';
    } else {
      status = 'failed';
    }

    logger.info('Aggregation completed', {
      execution_id: event.execution_id,
      status,
      total_collected,
      total_failed,
      success_rate: validSuccessRate.toFixed(2),
    });

    // 実行状態の更新（completed/failed）
    await updateExecutionStatus(
      event.execution_id,
      status === 'failed' ? 'failed' : 'completed',
      100,
      total_collected,
      total_failed,
      status === 'failed' ? 'Collection failed' : undefined
    );

    const duration = Date.now() - startTime;

    logger.info('Lambda Collector Aggregate completed', {
      execution_id: event.execution_id,
      status,
      total_collected,
      total_failed,
      success_rate: validSuccessRate.toFixed(2),
      duration_ms: duration,
    });

    // CloudWatchメトリクスの送信
    await sendCloudWatchMetrics(
      total_collected,
      total_failed,
      validSuccessRate,
      duration,
      context.functionName
    );

    return {
      execution_id: event.execution_id,
      status,
      total_collected,
      total_failed,
      success_rate: validSuccessRate,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(
      'Lambda Collector Aggregate failed',
      createErrorContext(error as Error, {
        execution_id: event.execution_id,
        request_id: context.awsRequestId,
        duration_ms: duration,
      })
    );

    // エラーメトリクス送信
    await sendErrorMetric(
      error instanceof Error ? error.constructor.name : 'Unknown',
      'CollectorAggregate'
    );

    // 実行状態を失敗に更新
    try {
      await updateExecutionStatus(
        event.execution_id,
        'failed',
        100,
        0,
        0,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      logger.error(
        'Failed to update execution status to failed',
        createErrorContext(updateError as Error, {
          execution_id: event.execution_id,
        })
      );
    }

    throw error;
  }
}

/**
 * 実行結果の集約
 *
 * Step FunctionsのMap状態から渡される結果を集約します。
 * Map状態の各要素は`saveResult`を含むオブジェクトです。
 *
 * @param results Map状態の実行結果
 * @returns 集約結果
 */
function aggregateResults(
  results: Array<{
    saveResult?: {
      page_number: string;
      saved_count: number;
      failed_count: number;
    };
  }>
): { total_collected: number; total_failed: number } {
  let total_collected = 0;
  let total_failed = 0;

  for (const result of results) {
    // saveResultが存在する場合のみ集約（失敗したページはsaveResultがない）
    if (result.saveResult) {
      const saved_count = Number.isFinite(result.saveResult.saved_count) 
        ? result.saveResult.saved_count 
        : 0;
      const failed_count = Number.isFinite(result.saveResult.failed_count) 
        ? result.saveResult.failed_count 
        : 0;

      total_collected += saved_count;
      total_failed += failed_count;

      logger.debug('Aggregating result', {
        page_number: result.saveResult.page_number,
        saved_count,
        failed_count,
        running_total_collected: total_collected,
        running_total_failed: total_failed,
      });
    } else {
      logger.warn('Result without saveResult (page failed)', {
        result,
      });
    }
  }

  return { total_collected, total_failed };
}

/**
 * CloudWatchメトリクスの送信
 *
 * メトリクス送信エラーはログに記録するが、処理は継続します。
 *
 * @param total_collected 総収集成功件数
 * @param total_failed 総収集失敗件数
 * @param success_rate 成功率
 * @param duration 実行時間（ミリ秒）
 * @param functionName Lambda関数名
 */
async function sendCloudWatchMetrics(
  total_collected: number,
  total_failed: number,
  success_rate: number,
  duration: number,
  functionName: string
): Promise<void> {
  try {
    await Promise.all([
      // 収集成功件数
      sendDisclosuresCollectedMetric(total_collected, functionName),
      // 収集失敗件数
      sendDisclosuresFailedMetric(total_failed, functionName),
      // 収集成功率
      sendCollectionSuccessRateMetric(success_rate, functionName),
      // 実行時間メトリクス
      sendMetrics([
        {
          name: 'LambdaExecutionTime',
          value: duration,
          unit: 'Milliseconds',
          dimensions: { FunctionName: 'CollectorAggregate' },
        },
      ]),
    ]);

    logger.debug('CloudWatch metrics sent successfully', {
      total_collected,
      total_failed,
      success_rate: success_rate.toFixed(2),
      duration_ms: duration,
    });
  } catch (error) {
    // メトリクス送信エラーはログに記録するが、処理は継続
    logger.warn(
      'Failed to send CloudWatch metrics',
      createErrorContext(error as Error, {
        total_collected,
        total_failed,
        success_rate,
      })
    );
  }
}

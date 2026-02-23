/**
 * 実行状態管理機能
 *
 * Lambda Collectorの実行状態をDynamoDBに保存・更新します。
 * 進捗率の単調性を保証し、TTLによる自動削除をサポートします。
 *
 * Requirements: 要件5.4（実行状態管理）
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { logger } from '../../utils/logger';
import type { ExecutionStatus } from '../../types';

// DynamoDBクライアントはグローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({});

// 環境変数は関数内で取得（テスト時の柔軟性のため）
function getDynamoExecutionsTable(): string {
  return process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod';
}

/**
 * 実行状態を作成または更新
 *
 * 進捗率は0-100の範囲に自動制限されます。
 * completed/failedステータスの場合、completed_atとTTLが自動設定されます。
 *
 * @param execution_id - 実行ID
 * @param status - ステータス
 * @param progress - 進捗率（0-100）
 * @param success_count - 収集成功件数（デフォルト: 0）
 * @param failed_count - 収集失敗件数（デフォルト: 0）
 * @param error_message - エラーメッセージ（failedの場合のみ）
 * @returns 更新後の実行状態
 *
 * @example
 * ```typescript
 * // 実行開始
 * await updateExecutionStatus('exec_001', 'pending', 0);
 *
 * // 進捗更新
 * await updateExecutionStatus('exec_001', 'running', 50, 25, 0);
 *
 * // 完了
 * await updateExecutionStatus('exec_001', 'completed', 100, 50, 0);
 *
 * // 失敗
 * await updateExecutionStatus('exec_001', 'failed', 50, 25, 5, 'Network error');
 * ```
 */
export async function updateExecutionStatus(
  execution_id: string,
  status: ExecutionStatus['status'],
  progress: number,
  success_count: number = 0,
  failed_count: number = 0,
  error_message?: string
): Promise<ExecutionStatus> {
  try {
    // 進捗率を0-100の範囲に制限
    const clampedProgress = Math.max(0, Math.min(100, progress));

    // NaN検証: 数値パラメータが有効であることを確認
    if (!Number.isFinite(clampedProgress)) {
      throw new Error(`Invalid progress value: ${progress} (resulted in ${clampedProgress})`);
    }
    if (!Number.isFinite(success_count)) {
      throw new Error(`Invalid success_count value: ${success_count}`);
    }
    if (!Number.isFinite(failed_count)) {
      throw new Error(`Invalid failed_count value: ${failed_count}`);
    }

    const now = new Date().toISOString();
    const isCompleted = status === 'completed' || status === 'failed';

    // TTL: 30日後（Unix timestamp）
    const ttl = isCompleted ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 : undefined;

    // 既存のレコードを取得してstarted_atを保持
    // getExecutionStatusが失敗しても実行状態の更新を継続する
    let started_at = now;
    try {
      const existingStatus = await getExecutionStatus(execution_id);
      if (existingStatus) {
        started_at = existingStatus.started_at;
        logger.debug('Found existing execution status', {
          execution_id,
          existing_started_at: existingStatus.started_at,
          existing_progress: existingStatus.progress,
        });
      }
    } catch (error) {
      logger.warn('Failed to get existing execution status, creating new record', {
        execution_id,
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
      });
    }

    const item: ExecutionStatus = {
      execution_id,
      status,
      progress: clampedProgress,
      success_count,
      failed_count,
      started_at,
      completed_at: isCompleted ? now : undefined,
      error_message: error_message || undefined,
      ttl: ttl || 0,
    };

    // DynamoDB書き込み前に環境情報をログに出力
    logger.info('Updating execution status', {
      execution_id,
      status,
      progress: clampedProgress,
      success_count,
      failed_count,
      table_name: getDynamoExecutionsTable(),
      region: process.env.AWS_REGION || 'not-set',
      environment: process.env.ENVIRONMENT || 'not-set',
    });

    // DynamoDBに保存
    await dynamoClient.send(
      new PutItemCommand({
        TableName: getDynamoExecutionsTable(),
        Item: marshall(item, {
          removeUndefinedValues: true,
        }),
      })
    );

    logger.info('Execution status updated successfully', {
      execution_id,
      status,
      progress: clampedProgress,
      table_name: getDynamoExecutionsTable(),
      write_confirmed: true,
    });

    return item;
  } catch (error) {
    logger.error('Failed to update execution status', {
      execution_id,
      status,
      progress,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 実行状態を取得
 *
 * @param execution_id - 実行ID
 * @returns 実行状態（存在しない場合はnull）
 *
 * @example
 * ```typescript
 * const status = await getExecutionStatus('exec_001');
 * if (status) {
 *   console.log(`Progress: ${status.progress}%`);
 * }
 * ```
 */
export async function getExecutionStatus(execution_id: string): Promise<ExecutionStatus | null> {
  try {
    const { GetItemCommand } = await import('@aws-sdk/client-dynamodb');
    const { unmarshall } = await import('@aws-sdk/util-dynamodb');

    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: getDynamoExecutionsTable(),
        Key: marshall({ execution_id }),
      })
    );

    if (!result.Item) {
      return null;
    }

    return unmarshall(result.Item) as ExecutionStatus;
  } catch (error) {
    logger.error('Failed to get execution status', {
      execution_id,
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

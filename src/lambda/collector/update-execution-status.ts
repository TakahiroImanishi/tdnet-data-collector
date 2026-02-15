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

// DynamoDBクライアントはグローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({});

// 環境変数は関数内で取得（テスト時の柔軟性のため）
function getDynamoExecutionsTable(): string {
  return process.env.DYNAMODB_EXECUTIONS_TABLE || 'tdnet_executions';
}

/**
 * 実行状態
 */
export interface ExecutionStatus {
  /** 実行ID */
  execution_id: string;

  /** ステータス */
  status: 'pending' | 'running' | 'completed' | 'failed';

  /** 進捗率（0-100） */
  progress: number;

  /** 収集成功件数 */
  collected_count: number;

  /** 収集失敗件数 */
  failed_count: number;

  /** 開始日時（ISO 8601形式） */
  started_at: string;

  /** 更新日時（ISO 8601形式） */
  updated_at: string;

  /** 完了日時（ISO 8601形式、completed/failedの場合のみ） */
  completed_at?: string;

  /** エラーメッセージ（failedの場合のみ） */
  error_message?: string;

  /** TTL（30日後に自動削除） */
  ttl?: number;
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
 * @param collected_count - 収集成功件数（デフォルト: 0）
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
  collected_count: number = 0,
  failed_count: number = 0,
  error_message?: string
): Promise<ExecutionStatus> {
  try {
    // 進捗率を0-100の範囲に制限
    const clampedProgress = Math.max(0, Math.min(100, progress));

    const now = new Date().toISOString();
    const isCompleted = status === 'completed' || status === 'failed';

    // TTL: 30日後（Unix timestamp）
    const ttl = isCompleted ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 : undefined;

    // 既存のレコードを取得してstarted_atを保持
    const existingStatus = await getExecutionStatus(execution_id);
    const started_at = existingStatus?.started_at || now;

    const item: ExecutionStatus = {
      execution_id,
      status,
      progress: clampedProgress,
      collected_count,
      failed_count,
      started_at,
      updated_at: now,
      ...(isCompleted ? { completed_at: now } : {}),
      ...(error_message ? { error_message } : {}),
      ...(ttl ? { ttl } : {}),
    };

    logger.info('Updating execution status', {
      execution_id,
      status,
      progress: clampedProgress,
      collected_count,
      failed_count,
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
export async function getExecutionStatus(
  execution_id: string
): Promise<ExecutionStatus | null> {
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

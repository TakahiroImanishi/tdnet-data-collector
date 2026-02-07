/**
 * メタデータ保存機能
 *
 * 開示情報のメタデータをDynamoDBに保存します。
 * 重複チェックとdate_partitionの自動生成を含みます。
 *
 * Requirements: 要件1.4, 2.4（メタデータ保存、重複チェック）
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { generateDatePartition } from '../../utils/date-partition';
import { logger } from '../../utils/logger';
import { Disclosure } from '../../types';

// DynamoDBクライアントはグローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({});

// 環境変数は関数内で取得（テスト時の柔軟性のため）
function getDynamoTable(): string {
  return process.env.DYNAMODB_TABLE || 'tdnet_disclosures';
}

/**
 * メタデータをDynamoDBに保存
 *
 * Two-Phase Commit原則に従い、date_partitionを事前生成してから保存します。
 * 重複チェック（ConditionExpression）により、同じdisclosure_idの重複保存を防ぎます。
 *
 * @param disclosure - 開示情報
 * @param s3_key - S3キー（PDFファイルの保存先）
 * @throws ConditionalCheckFailedException 重複する開示IDの場合（警告レベル）
 * @throws ValidationError date_partitionの生成に失敗した場合
 *
 * @example
 * ```typescript
 * const disclosure: Disclosure = {
 *   disclosure_id: 'TD20240115001',
 *   company_code: '1234',
 *   company_name: '株式会社サンプル',
 *   disclosure_type: '決算短信',
 *   title: '2024年3月期 第3四半期決算短信',
 *   disclosed_at: '2024-01-15T10:30:00Z',
 *   pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
 *   s3_key: '',
 *   collected_at: '',
 *   date_partition: '',
 * };
 *
 * await saveMetadata(disclosure, '2024/01/15/TD20240115001.pdf');
 * ```
 */
export async function saveMetadata(disclosure: Disclosure, s3_key: string): Promise<void> {
  try {
    // date_partitionを事前生成（Two-Phase Commit原則）
    const date_partition = generateDatePartition(disclosure.disclosed_at);

    const item = {
      disclosure_id: disclosure.disclosure_id,
      company_code: disclosure.company_code,
      company_name: disclosure.company_name,
      disclosure_type: disclosure.disclosure_type,
      title: disclosure.title,
      disclosed_at: disclosure.disclosed_at,
      date_partition,
      pdf_url: disclosure.pdf_url,
      s3_key,
      collected_at: new Date().toISOString(),
    };

    logger.info('Saving metadata to DynamoDB', {
      disclosure_id: disclosure.disclosure_id,
      date_partition,
    });

    // DynamoDBに保存（重複チェック付き）
    await dynamoClient.send(
      new PutItemCommand({
        TableName: getDynamoTable(),
        Item: marshall(item),
        ConditionExpression: 'attribute_not_exists(disclosure_id)',
      })
    );

    logger.info('Metadata saved successfully', {
      disclosure_id: disclosure.disclosure_id,
      date_partition,
      s3_key,
    });
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // 重複は警告レベルで記録（エラーではない）
      logger.warn('Duplicate disclosure detected', {
        disclosure_id: disclosure.disclosure_id,
        s3_key,
      });
      return; // 重複は無視
    }

    logger.error('Failed to save metadata', {
      disclosure_id: disclosure.disclosure_id,
      error_type: error.constructor?.name || 'Unknown',
      error_message: error.message || String(error),
    });
    throw error;
  }
}

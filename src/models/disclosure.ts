/**
 * Disclosureモデルと変換関数
 *
 * 開示情報のモデルとDynamoDBアイテムとの変換関数を提供します。
 *
 * Requirements: 要件2.1, 2.2, 2.3（メタデータ管理）
 */

import { Disclosure, DynamoDBItem } from '../types';
import { ValidationError } from '../errors';
import { generateDatePartition, validateDisclosedAt } from '../utils/date-partition';
import { generateDisclosureId } from '../utils/disclosure-id';

/**
 * Disclosureの必須フィールドをバリデーション
 *
 * @param disclosure - バリデーション対象のDisclosure
 * @throws {ValidationError} 必須フィールドが欠落している場合
 */
export function validateDisclosure(disclosure: Partial<Disclosure>): void {
  const requiredFields: Array<keyof Disclosure> = [
    'disclosure_id',
    'company_code',
    'company_name',
    'disclosure_type',
    'title',
    'disclosed_at',
    'pdf_url',
    's3_key',
    'collected_at',
    'date_partition',
  ];

  const missingFields = requiredFields.filter((field) => !disclosure[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`, {
      missing_fields: missingFields,
      disclosure,
    });
  }

  // disclosed_atのフォーマット検証
  validateDisclosedAt(disclosure.disclosed_at!);

  // collected_atのフォーマット検証
  validateDisclosedAt(disclosure.collected_at!);

  // company_codeのフォーマット検証（4桁の数字）
  const companyCodeRegex = /^\d{4}$/;
  if (!companyCodeRegex.test(disclosure.company_code!)) {
    throw new ValidationError(
      `Invalid company_code format: ${disclosure.company_code}. Expected 4-digit number.`,
      { company_code: disclosure.company_code }
    );
  }

  // date_partitionのフォーマット検証（YYYY-MM形式）
  const datePartitionRegex = /^\d{4}-\d{2}$/;
  if (!datePartitionRegex.test(disclosure.date_partition!)) {
    throw new ValidationError(
      `Invalid date_partition format: ${disclosure.date_partition}. Expected YYYY-MM format.`,
      { date_partition: disclosure.date_partition }
    );
  }
}

/**
 * DisclosureをDynamoDBアイテムに変換
 *
 * Two-Phase Commit原則に従い、date_partitionは事前に生成されている必要があります。
 * この関数は変換のみを行い、date_partitionの生成は行いません。
 *
 * @param disclosure - 変換元のDisclosure
 * @returns DynamoDBアイテム
 * @throws {ValidationError} バリデーションエラーの場合
 */
export function toDynamoDBItem(disclosure: Disclosure): DynamoDBItem {
  // バリデーション
  validateDisclosure(disclosure);

  // DynamoDBアイテムに変換
  return {
    disclosure_id: { S: disclosure.disclosure_id },
    company_code: { S: disclosure.company_code },
    company_name: { S: disclosure.company_name },
    disclosure_type: { S: disclosure.disclosure_type },
    title: { S: disclosure.title },
    disclosed_at: { S: disclosure.disclosed_at },
    pdf_url: { S: disclosure.pdf_url },
    s3_key: { S: disclosure.s3_key },
    collected_at: { S: disclosure.collected_at },
    date_partition: { S: disclosure.date_partition },
  };
}

/**
 * DynamoDBアイテムをDisclosureに変換
 *
 * @param item - 変換元のDynamoDBアイテム
 * @returns Disclosure
 * @throws {ValidationError} 必須フィールドが欠落している場合
 */
export function fromDynamoDBItem(item: DynamoDBItem): Disclosure {
  // 必須フィールドの存在チェック
  const requiredFields = [
    'disclosure_id',
    'company_code',
    'company_name',
    'disclosure_type',
    'title',
    'disclosed_at',
    'pdf_url',
    's3_key',
    'collected_at',
    'date_partition',
  ];

  const missingFields = requiredFields.filter((field) => !item[field]);

  if (missingFields.length > 0) {
    throw new ValidationError(
      `Missing required fields in DynamoDB item: ${missingFields.join(', ')}`,
      { missing_fields: missingFields, item }
    );
  }

  // Disclosureに変換
  const disclosure: Disclosure = {
    disclosure_id: item.disclosure_id.S ?? '',
    company_code: item.company_code.S ?? '',
    company_name: item.company_name.S ?? '',
    disclosure_type: item.disclosure_type.S ?? '',
    title: item.title.S ?? '',
    disclosed_at: item.disclosed_at.S ?? '',
    pdf_url: item.pdf_url.S ?? '',
    s3_key: item.s3_key.S ?? '',
    collected_at: item.collected_at.S ?? '',
    date_partition: item.date_partition.S ?? '',
  };

  // バリデーション
  validateDisclosure(disclosure);

  return disclosure;
}

/**
 * Disclosureを作成する際のヘルパー関数
 *
 * date_partitionを自動生成し、collected_atを現在時刻に設定します。
 * Two-Phase Commit原則に従い、date_partitionは保存前に生成されます。
 *
 * @param params - Disclosure作成パラメータ（date_partition、collected_atは省略可能）
 * @returns 完全なDisclosure
 * @throws {ValidationError} バリデーションエラーの場合
 */
export function createDisclosure(
  params: Omit<Disclosure, 'date_partition' | 'collected_at'> & {
    date_partition?: string;
    collected_at?: string;
  }
): Disclosure {
  // date_partitionが指定されていない場合は自動生成
  const date_partition = params.date_partition || generateDatePartition(params.disclosed_at);

  // collected_atが指定されていない場合は現在時刻を使用
  const collected_at = params.collected_at || new Date().toISOString();

  const disclosure: Disclosure = {
    ...params,
    date_partition,
    collected_at,
  };

  // バリデーション
  validateDisclosure(disclosure);

  return disclosure;
}

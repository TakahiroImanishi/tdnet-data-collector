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

// Re-export for convenience
export { generateDisclosureId };

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
    'downloaded_at',
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

  // downloaded_atのフォーマット検証
  validateDisclosedAt(disclosure.downloaded_at!);

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

  // file_sizeのバリデーション（10MB以下）
  if (disclosure.file_size !== undefined && disclosure.file_size !== null) {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (disclosure.file_size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size: ${disclosure.file_size} bytes (max: ${MAX_FILE_SIZE} bytes)`,
        { file_size: disclosure.file_size, max_file_size: MAX_FILE_SIZE }
      );
    }
    if (disclosure.file_size < 0) {
      throw new ValidationError(
        `File size must be non-negative: ${disclosure.file_size}`,
        { file_size: disclosure.file_size }
      );
    }
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
  const item: DynamoDBItem = {
    disclosure_id: { S: disclosure.disclosure_id },
    company_code: { S: disclosure.company_code },
    company_name: { S: disclosure.company_name },
    disclosure_type: { S: disclosure.disclosure_type },
    title: { S: disclosure.title },
    disclosed_at: { S: disclosure.disclosed_at },
    downloaded_at: { S: disclosure.downloaded_at },
    date_partition: { S: disclosure.date_partition },
  };

  // オプショナルフィールド
  if (disclosure.pdf_url) {
    item.pdf_url = { S: disclosure.pdf_url };
  }
  if (disclosure.pdf_s3_key) {
    item.pdf_s3_key = { S: disclosure.pdf_s3_key };
  }

  return item;
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
    'downloaded_at',
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
    downloaded_at: item.downloaded_at.S ?? '',
    date_partition: item.date_partition.S ?? '',
  };

  // オプショナルフィールド
  if (item.pdf_url?.S) {
    disclosure.pdf_url = item.pdf_url.S;
  }
  if (item.pdf_s3_key?.S) {
    disclosure.pdf_s3_key = item.pdf_s3_key.S;
  }

  // バリデーション
  validateDisclosure(disclosure);

  return disclosure;
}

/**
 * Disclosureを作成する際のヘルパー関数
 *
 * date_partitionを自動生成し、downloaded_atを現在時刻に設定します。
 * Two-Phase Commit原則に従い、date_partitionは保存前に生成されます。
 *
 * @param params - Disclosure作成パラメータ（date_partition、downloaded_atは省略可能）
 * @returns 完全なDisclosure
 * @throws {ValidationError} バリデーションエラーの場合
 */
export function createDisclosure(
  params: Omit<Disclosure, 'date_partition' | 'downloaded_at'> & {
    date_partition?: string;
    downloaded_at?: string;
  }
): Disclosure {
  // date_partitionが指定されていない場合は自動生成
  const date_partition = params.date_partition || generateDatePartition(params.disclosed_at);

  // downloaded_atが指定されていない場合は現在時刻を使用
  const downloaded_at = params.downloaded_at || new Date().toISOString();

  const disclosure: Disclosure = {
    ...params,
    date_partition,
    downloaded_at,
  };

  // バリデーション
  validateDisclosure(disclosure);

  return disclosure;
}

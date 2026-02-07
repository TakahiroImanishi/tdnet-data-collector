/**
 * 開示ID生成ユーティリティ
 *
 * 開示情報の一意なIDを生成します。
 * フォーマット: 日付_企業コード_連番（例: "20240115_1234_001"）
 *
 * Requirements: 要件2.3（開示ID生成）
 */

import { ValidationError } from '../errors';

/**
 * 開示IDを生成（日付_企業コード_連番形式）
 *
 * @param disclosedAt ISO 8601形式の日時文字列
 * @param companyCode 企業コード（4桁）
 * @param sequence 連番（同一日・同一企業の複数開示を区別）
 * @returns 開示ID（例: "20240115_1234_001"）
 * @throws ValidationError 不正な入力の場合
 */
export function generateDisclosureId(
  disclosedAt: string,
  companyCode: string,
  sequence: number
): string {
  // バリデーション
  if (!disclosedAt || !/^\d{4}-\d{2}-\d{2}T/.test(disclosedAt)) {
    throw new ValidationError(`Invalid disclosedAt format: ${disclosedAt}`);
  }

  if (!companyCode || !/^\d{4}$/.test(companyCode)) {
    throw new ValidationError(`Invalid companyCode: ${companyCode}`);
  }

  if (sequence < 1 || sequence > 999) {
    throw new ValidationError(`Invalid sequence: ${sequence} (must be 1-999)`);
  }

  // 日付部分を抽出（YYYYMMDD形式）
  const date = disclosedAt.substring(0, 10).replace(/-/g, '');

  // 連番を3桁にゼロパディング
  const seq = String(sequence).padStart(3, '0');

  return `${date}_${companyCode}_${seq}`;
}

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
 * TDnetは日本の開示情報サービスであり、開示日時はJST（日本標準時）基準で管理されます。
 * UTC時刻をそのまま使用すると、月またぎのエッジケースで誤った日付になる可能性があります。
 * 
 * 例: UTC 2024-01-31T15:30:00Z → JST 2024-02-01T00:30:00+09:00
 *     UTCのまま使用すると "20240131" になるが、正しくは "20240201" であるべき
 *
 * @param disclosedAt ISO 8601形式の日時文字列（UTC推奨）
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

  if (!companyCode || !/^[0-9A-Z]{4,5}$/.test(companyCode)) {
    throw new ValidationError(`Invalid companyCode: ${companyCode}`);
  }

  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999) {
    throw new ValidationError(`Invalid sequence: ${sequence} (must be an integer between 0-999)`);
  }

  // UTCからJSTに変換（UTC+9時間）してから日付を抽出
  // これにより、月またぎのエッジケースを正しく処理できる
  const utcDate = new Date(disclosedAt);
  const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  
  // YYYYMMDD形式で日付を抽出
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstDate.getUTCDate()).padStart(2, '0');
  const date = `${year}${month}${day}`;

  // 連番を3桁にゼロパディング
  const seq = String(sequence).padStart(3, '0');

  return `${date}_${companyCode}_${seq}`;
}

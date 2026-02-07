/**
 * date_partition生成ユーティリティ
 *
 * disclosed_atからdate_partition（YYYY-MM形式、JST基準）を生成します。
 * DynamoDBのGSIパーティションキーとして使用され、月単位のクエリを高速化します。
 *
 * Requirements: 要件2.1（date_partition）
 */

import { ValidationError } from '../errors';

/**
 * disclosed_atのバリデーション
 *
 * @param disclosedAt - ISO 8601形式の日時文字列（UTC推奨）
 * @throws {ValidationError} フォーマットまたは範囲が不正な場合
 */
export function validateDisclosedAt(disclosedAt: string): void {
  // ISO 8601形式チェック
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([Z]|[+-]\d{2}:\d{2})$/;
  if (!iso8601Regex.test(disclosedAt)) {
    throw new ValidationError(
      `Invalid disclosed_at format: ${disclosedAt}. Expected ISO 8601 format (e.g., "2024-01-15T10:30:00Z")`,
      { disclosed_at: disclosedAt }
    );
  }

  // 有効な日付チェック
  const date = new Date(disclosedAt);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`Invalid date: ${disclosedAt}. Date does not exist.`, {
      disclosed_at: disclosedAt,
    });
  }

  // 日付の正規化チェック（例: 2024-02-30 → 2024-03-01 のような変換を検出）
  // ISO8601文字列から年月日を抽出して、Dateオブジェクトと比較
  const match = disclosedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, yearStr, monthStr, dayStr] = match;
    const inputYear = parseInt(yearStr, 10);
    const inputMonth = parseInt(monthStr, 10);
    const inputDay = parseInt(dayStr, 10);

    // Dateオブジェクトの年月日と比較（UTCで比較）
    if (
      date.getUTCFullYear() !== inputYear ||
      date.getUTCMonth() + 1 !== inputMonth ||
      date.getUTCDate() !== inputDay
    ) {
      throw new ValidationError(`Invalid date: ${disclosedAt}. Date does not exist.`, {
        disclosed_at: disclosedAt,
        parsed_date: date.toISOString(),
      });
    }
  }

  // 範囲チェック（1970-01-01 以降、現在時刻+1日以内）
  const minDate = new Date('1970-01-01T00:00:00Z');
  const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 現在時刻+1日
  if (date < minDate || date > maxDate) {
    throw new ValidationError(
      `Date out of range: ${disclosedAt}. Must be between 1970-01-01 and ${maxDate.toISOString()}`,
      {
        disclosed_at: disclosedAt,
        min_date: minDate.toISOString(),
        max_date: maxDate.toISOString(),
      }
    );
  }
}

/**
 * disclosed_atからdate_partitionを生成（JST基準）
 *
 * TDnetは日本の開示情報サービスであり、開示時刻は日本時間（JST, UTC+9）で管理されます。
 * そのため、date_partitionはJST基準で生成します。
 *
 * 例：
 * - UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00 → "2024-02"
 * - UTC: 2024-02-01T14:59:59Z → JST: 2024-01-31T23:59:59 → "2024-01"
 *
 * @param disclosedAt - ISO 8601形式の日時文字列（UTC推奨）
 * @returns YYYY-MM形式のdate_partition
 * @throws {ValidationError} 不正なフォーマットまたは日付の場合
 */
export function generateDatePartition(disclosedAt: string): string {
  // バリデーション
  validateDisclosedAt(disclosedAt);

  // UTCからJSTに変換（UTC+9時間）
  const utcDate = new Date(disclosedAt);
  const jstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);

  // YYYY-MM形式で返却
  const year = jstDate.getUTCFullYear();
  const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

/**
 * 月範囲を生成するヘルパー関数
 *
 * 開始月から終了月までの月のリストを生成します。
 * 日付範囲クエリで複数月を並行クエリする際に使用します。
 *
 * 例：
 * - generateMonthRange("2024-01", "2024-03") → ["2024-01", "2024-02", "2024-03"]
 *
 * @param start - 開始月（YYYY-MM形式）
 * @param end - 終了月（YYYY-MM形式）
 * @returns 月のリスト（YYYY-MM形式）
 * @throws {ValidationError} フォーマットまたは範囲が不正な場合
 */
export function generateMonthRange(start: string, end: string): string[] {
  // フォーマット検証
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(start) || !monthRegex.test(end)) {
    throw new ValidationError(
      `Invalid month format. Expected YYYY-MM format. Got: start=${start}, end=${end}`,
      { start, end }
    );
  }

  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);

  // 範囲チェック（開始月 <= 終了月）
  if (startYear > endYear || (startYear === endYear && startMonth > endMonth)) {
    throw new ValidationError(
      `Invalid month range: start (${start}) must be before or equal to end (${end})`,
      { start, end }
    );
  }

  const months: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

/**
 * yearMonthフォーマットのバリデーション
 *
 * @param yearMonth - YYYY-MM形式の文字列
 * @throws {ValidationError} フォーマットが不正な場合
 */
export function validateYearMonth(yearMonth: string): void {
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(yearMonth)) {
    throw new ValidationError(`Invalid yearMonth format: ${yearMonth}. Expected YYYY-MM format.`, {
      year_month: yearMonth,
    });
  }

  // 月の範囲チェック（01〜12）
  const [, monthStr] = yearMonth.split('-');
  const month = Number(monthStr);
  if (month < 1 || month > 12) {
    throw new ValidationError(`Invalid month: ${month}. Month must be between 01 and 12.`, {
      year_month: yearMonth,
      month,
    });
  }
}

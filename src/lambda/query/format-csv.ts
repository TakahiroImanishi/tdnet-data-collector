/**
 * Format as CSV
 *
 * 開示情報リストをCSV形式に変換します。
 *
 * Requirements: 要件5.2（CSV形式）
 */

import { Disclosure } from '../../types';

/**
 * 開示情報リストをCSV形式に変換
 *
 * @param disclosures 開示情報リスト
 * @returns CSV文字列
 *
 * @example
 * ```typescript
 * const csv = formatAsCsv(disclosures);
 * // => "disclosure_id,company_code,company_name,disclosure_type,title,disclosed_at,pdf_url,pdf_s3_key,downloaded_at\n..."
 * ```
 */
export function formatAsCsv(disclosures: Disclosure[]): string {
  // CSVヘッダー
  const headers = [
    'disclosure_id',
    'company_code',
    'company_name',
    'disclosure_type',
    'title',
    'disclosed_at',
    'pdf_url',
    'pdf_s3_key',
    'downloaded_at',
    'date_partition',
  ];

  // CSVヘッダー行
  const headerRow = headers.join(',');

  // CSVデータ行
  const dataRows = disclosures.map((disclosure) => {
    return [
      escapeCsvField(disclosure.disclosure_id),
      escapeCsvField(disclosure.company_code),
      escapeCsvField(disclosure.company_name),
      escapeCsvField(disclosure.disclosure_type),
      escapeCsvField(disclosure.title),
      escapeCsvField(disclosure.disclosed_at),
      escapeCsvField(disclosure.pdf_url || ''),
      escapeCsvField(disclosure.pdf_s3_key || ''),
      escapeCsvField(disclosure.downloaded_at),
      escapeCsvField(disclosure.date_partition),
    ].join(',');
  });

  // ヘッダーとデータを結合
  return [headerRow, ...dataRows].join('\n');
}

/**
 * CSVフィールドをエスケープ
 *
 * カンマ、改行、ダブルクォートを含むフィールドをダブルクォートで囲みます。
 * ダブルクォート自体は2つ連続させてエスケープします。
 *
 * @param field フィールド値
 * @returns エスケープ済みフィールド値
 *
 * @example
 * ```typescript
 * escapeCsvField('Hello, World'); // => '"Hello, World"'
 * escapeCsvField('Say "Hello"');  // => '"Say ""Hello"""'
 * escapeCsvField('Line1\nLine2'); // => '"Line1\nLine2"'
 * ```
 */
function escapeCsvField(field: string): string {
  // null/undefinedの場合は空文字列
  if (field === null || field === undefined) {
    return '';
  }

  // 文字列に変換
  const str = String(field);

  // カンマ、改行、ダブルクォートを含む場合はエスケープが必要
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    // ダブルクォートを2つ連続させてエスケープ
    const escaped = str.replace(/"/g, '""');
    // ダブルクォートで囲む
    return `"${escaped}"`;
  }

  return str;
}

/**
 * CSV文字列をパース（テスト用）
 *
 * @param csv CSV文字列
 * @returns パース済みデータ
 */
export function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    return [];
  }

  // ヘッダー行
  const headers = lines[0].split(',');

  // データ行
  const data: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    data.push(row);
  }

  return data;
}

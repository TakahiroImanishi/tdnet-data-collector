/**
 * TDnet HTMLパーサー
 *
 * TDnet開示情報リストページのHTMLをパースし、メタデータを抽出します。
 *
 * Requirements: 要件1.1, 1.2（データ収集、メタデータ抽出）
 */

import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { ValidationError } from '../errors';

/**
 * 開示情報メタデータ
 */
export interface DisclosureMetadata {
  company_code: string;
  company_name: string;
  disclosure_type: string;
  title: string;
  disclosed_at: string; // ISO 8601形式（UTC）
  pdf_url: string;
}

/**
 * TDnet開示情報リストページのHTMLをパース
 *
 * @param html HTMLコンテンツ
 * @returns 開示情報メタデータの配列
 * @throws ValidationError HTMLが不正な場合
 */
export function parseDisclosureList(html: string): DisclosureMetadata[] {
  const $ = cheerio.load(html);
  const disclosures: DisclosureMetadata[] = [];

  // TDnetのテーブル構造に基づいてパース
  // 注: 実際のTDnetのHTML構造に合わせて調整が必要
  $('table.disclosure-list tr').each((index, element) => {
    if (index === 0) return; // ヘッダー行をスキップ

    const $row = $(element);
    const cells = $row.find('td');

    if (cells.length < 6) {
      logger.warn('Invalid row structure', { index, cellCount: cells.length });
      return;
    }

    try {
      const disclosure: DisclosureMetadata = {
        company_code: $(cells[0]).text().trim(),
        company_name: $(cells[1]).text().trim(),
        disclosure_type: $(cells[2]).text().trim(),
        title: $(cells[3]).text().trim(),
        disclosed_at: parseDisclosedAt($(cells[4]).text().trim()),
        pdf_url: $(cells[5]).find('a').attr('href') || '',
      };

      // バリデーション
      validateDisclosureMetadata(disclosure);

      disclosures.push(disclosure);
    } catch (error) {
      logger.error('Failed to parse disclosure row', {
        error_type: error instanceof Error ? error.constructor.name : 'Unknown',
        error_message: error instanceof Error ? error.message : String(error),
        row_index: index,
      });
    }
  });

  return disclosures;
}

/**
 * 開示日時をISO 8601形式（UTC）に変換
 *
 * @param dateStr 日時文字列（例: "2024/01/15 10:30"）
 * @returns ISO 8601形式の日時文字列
 */
function parseDisclosedAt(dateStr: string): string {
  // TDnetの日時形式（JST）をUTCに変換
  // 例: "2024/01/15 10:30" → "2024-01-15T01:30:00Z"
  const match = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/);
  if (!match) {
    throw new ValidationError(`Invalid date format: ${dateStr}`);
  }

  const [, year, month, day, hour, minute] = match;
  const jstDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
  return jstDate.toISOString();
}

/**
 * 開示情報メタデータのバリデーション
 *
 * @param disclosure 開示情報メタデータ
 * @throws ValidationError バリデーションエラー
 */
function validateDisclosureMetadata(disclosure: DisclosureMetadata): void {
  if (!disclosure.company_code || !/^\d{4}$/.test(disclosure.company_code)) {
    throw new ValidationError(`Invalid company_code: ${disclosure.company_code}`);
  }

  if (!disclosure.company_name) {
    throw new ValidationError('company_name is required');
  }

  if (!disclosure.disclosure_type) {
    throw new ValidationError('disclosure_type is required');
  }

  if (!disclosure.title) {
    throw new ValidationError('title is required');
  }

  if (!disclosure.disclosed_at) {
    throw new ValidationError('disclosed_at is required');
  }

  if (!disclosure.pdf_url || !disclosure.pdf_url.startsWith('http')) {
    throw new ValidationError(`Invalid pdf_url: ${disclosure.pdf_url}`);
  }
}

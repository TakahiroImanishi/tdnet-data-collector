/**
 * TDnet HTMLパーサー
 *
 * TDnet開示情報リストページのHTMLをパースし、メタデータを抽出します。
 *
 * Requirements: 要件1.1, 1.2（データ収集、メタデータ抽出）
 * 
 * @example
 * ```typescript
 * import { RateLimiter } from '../utils/rate-limiter';
 * import { parseDisclosureList } from './html-parser';
 * import axios from 'axios';
 * 
 * // RateLimiterを使用してTDnetからHTMLを取得
 * const rateLimiter = new RateLimiter({ minDelayMs: 2000 });
 * 
 * async function fetchAndParseDisclosures(date: string) {
 *   await rateLimiter.waitIfNeeded();
 *   const response = await axios.get(`https://www.release.tdnet.info/inbs/I_list_001_${date}.html`);
 *   return parseDisclosureList(response.data);
 * }
 * ```
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
 * @param requestDate リクエスト日付（YYYY-MM-DD形式）- disclosed_at生成に使用
 * @returns 開示情報メタデータの配列
 * @throws ValidationError HTMLが不正な場合
 */
export function parseDisclosureList(html: string, requestDate: string): DisclosureMetadata[] {
  try {
    // HTMLの基本検証
    if (!html || html.trim().length === 0) {
      throw new ValidationError('HTML content is empty');
    }

    // cheerioでHTMLをロード
    const $ = cheerio.load(html);
    const disclosures: DisclosureMetadata[] = [];

    // HTML構造の検証（テーブルが存在するか）
    const tables = $('table#main-list-table');
    if (tables.length === 0) {
      // HTMLプレビューをBase64エンコードしてログ出力（エンコーディングエラー回避）
      const htmlPreview = html.substring(0, 200);
      const htmlPreviewBase64 = Buffer.from(htmlPreview, 'utf-8').toString('base64');
      
      logger.warn('No disclosure table found in HTML', {
        html_length: html.length,
        html_preview_base64: htmlPreviewBase64,
        decode_instruction: 'Use Buffer.from(html_preview_base64, "base64").toString("utf-8") to decode',
      });
      // HTML構造が変更された可能性を検知
      detectHtmlStructureChange($);
      return [];
    }

    // ページヘッダーから日付を抽出（フォールバック用）
    const pageDate = extractPageDate($) || requestDate;

    // TDnetのテーブル構造に基づいてパース
    // 実際のHTML構造: table#main-list-table > tr > td (7セル)
    $('table#main-list-table tr').each((index, element) => {
      const $row = $(element);
      const cells = $row.find('td');

      // 7セル未満の行はスキップ（ヘッダーまたは不正な行）
      if (cells.length < 7) {
        if (cells.length > 0) {
          logger.debug('Skipping row with insufficient cells', { 
            index, 
            cellCount: cells.length 
          });
        }
        return;
      }

      try {
        // Cell 0: kjTime - 時刻（HH:MM形式）
        const time = $(cells[0]).text().trim();
        
        // Cell 1: kjCode - 企業コード（5桁）
        const companyCode = $(cells[1]).text().trim();
        
        // Cell 2: kjName - 企業名
        const companyName = $(cells[2]).text().trim();
        
        // Cell 3: kjTitle - タイトル（PDFリンク付き）
        const $titleCell = $(cells[3]);
        const title = $titleCell.text().trim();
        const pdfUrl = $titleCell.find('a').attr('href') || '';
        
        // Cell 4: kjXbrl - XBRL（オプション、スキップ）
        // Cell 5: kjPlace - 取引所（オプション、スキップ）
        // Cell 6: kjHistroy - 履歴（オプション、スキップ）

        const disclosure: DisclosureMetadata = {
          company_code: companyCode,
          company_name: companyName,
          disclosure_type: extractDisclosureType(title),
          title: title,
          disclosed_at: parseDisclosedAt(pageDate, time),
          pdf_url: buildAbsolutePdfUrl(pdfUrl),
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

    logger.info('HTML parsing completed', {
      total_rows: $('table#main-list-table tr').length,
      parsed_disclosures: disclosures.length,
      page_date: pageDate,
    });

    return disclosures;
  } catch (error) {
    logger.error('Failed to parse HTML', {
      error_type: error instanceof Error ? error.constructor.name : 'Unknown',
      error_message: error instanceof Error ? error.message : String(error),
      html_length: html?.length || 0,
    });
    throw error;
  }
}

/**
 * ページヘッダーから日付を抽出
 *
 * @param $ cheerioインスタンス
 * @returns 日付文字列（YYYY-MM-DD形式）、抽出失敗時はnull
 *
 * @example
 * HTML: <div id="kaiji-date-1">2026年02月13日</div>
 * Result: "2026-02-13"
 */
function extractPageDate($: cheerio.CheerioAPI): string | null {
  try {
    const dateText = $('#kaiji-date-1').text().trim();
    // "2026年02月13日" → "2026-02-13"
    const match = dateText.match(/(\d{4})年(\d{2})月(\d{2})日/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    }
    return null;
  } catch (error) {
    logger.warn('Failed to extract page date', {
      error_message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * タイトルから開示種類を抽出
 *
 * @param title タイトル文字列
 * @returns 開示種類
 *
 * @remarks
 * タイトルから開示種類を推測する簡易実装。
 * より正確な分類が必要な場合は、TDnetのカテゴリ情報を使用する。
 */
function extractDisclosureType(title: string): string {
  // 決算関連
  if (title.includes('決算') || title.includes('業績')) {
    return '決算短信';
  }
  // 適時開示
  if (title.includes('適時開示')) {
    return '適時開示';
  }
  // IR資料
  if (title.includes('説明資料') || title.includes('プレゼンテーション')) {
    return 'IR資料';
  }
  // その他
  return 'その他';
}

/**
 * 相対PDFURLを絶対URLに変換
 *
 * @param relativePath 相対パス（例: "140120260213562187.pdf"）
 * @returns 絶対URL
 */
function buildAbsolutePdfUrl(relativePath: string): string {
  if (!relativePath) {
    return '';
  }
  
  // 既に絶対URLの場合はそのまま返す
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  
  // TDnetのベースURL
  const baseUrl = 'https://www.release.tdnet.info/inbs';
  
  // 相対パスを絶対URLに変換
  return `${baseUrl}/${relativePath}`;
}

/**
 * 開示日時をISO 8601形式（UTC）に変換
 *
 * @param date 日付文字列（YYYY-MM-DD形式）
 * @param time 時刻文字列（HH:MM形式）
 * @returns ISO 8601形式の日時文字列
 */
function parseDisclosedAt(date: string, time: string): string {
  // 日付と時刻を結合してJST日時を作成
  // 例: "2026-02-13" + "22:00" → "2026-02-13T22:00:00+09:00"
  const jstDate = new Date(`${date}T${time}:00+09:00`);
  
  if (isNaN(jstDate.getTime())) {
    throw new ValidationError(`Invalid date/time: ${date} ${time}`);
  }
  
  return jstDate.toISOString();
}

/**
 * 開示情報メタデータのバリデーション
 *
 * @param disclosure 開示情報メタデータ
 * @throws ValidationError バリデーションエラー
 */
function validateDisclosureMetadata(disclosure: DisclosureMetadata): void {
  // 企業コードは4桁または5桁の英数字（数字とA-Z）
  if (!disclosure.company_code || !/^[0-9A-Z]{4,5}$/.test(disclosure.company_code)) {
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

/**
 * HTML構造の変更を検知
 *
 * TDnetのHTML構造が変更された場合を検知し、ログに記録する。
 * steeringファイル（development/tdnet-scraping-patterns.md）の要件に準拠。
 *
 * @param $ cheerioインスタンス
 * @returns HTML構造が変更されている場合はtrue
 */
function detectHtmlStructureChange($: cheerio.CheerioAPI): boolean {
  const expectedSelectors = [
    'table#main-list-table',
    'table#main-list-table tr',
    'table#main-list-table td',
    'div#kaiji-date-1',
  ];

  let structureChanged = false;

  for (const selector of expectedSelectors) {
    if ($(selector).length === 0) {
      logger.error('HTML structure changed: selector not found', {
        selector,
        error_type: 'HtmlStructureChangeDetected',
      });
      structureChanged = true;
    }
  }

  if (structureChanged) {
    logger.error('TDnet HTML structure has changed', {
      error_type: 'HtmlStructureChangeDetected',
      message: 'Expected HTML selectors not found. TDnet may have updated their website structure.',
      action_required: 'Update html-parser.ts to match new HTML structure',
    });
  }

  return structureChanged;
}

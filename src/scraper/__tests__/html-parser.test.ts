/**
 * HTMLパーサーのユニットテスト
 *
 * steeringファイル準拠:
 * - development/tdnet-scraping-patterns.md
 * - core/error-handling-patterns.md
 *
 * Requirements: 要件1.2（メタデータ抽出）
 */

import { parseDisclosureList, DisclosureMetadata } from '../html-parser';
import { ValidationError } from '../../errors';

describe('HTML Parser', () => {
  describe('正常系: HTMLパース成功', () => {
    it('should parse valid HTML with disclosure table', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr>
                <th>企業コード</th>
                <th>企業名</th>
                <th>開示種類</th>
                <th>タイトル</th>
                <th>開示日時</th>
                <th>PDF</th>
              </tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>2024年3月期 第3四半期決算短信</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
      expect(disclosures[0].disclosure_type).toBe('決算短信');
      expect(disclosures[0].title).toBe('2024年3月期 第3四半期決算短信');
      expect(disclosures[0].disclosed_at).toBe('2024-01-15T06:00:00.000Z'); // JST 15:00 → UTC 06:00
      expect(disclosures[0].pdf_url).toBe('https://example.com/test.pdf');
    });

    it('should parse multiple disclosure rows', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>決算短信タイトル</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test1.pdf">PDF</a></td>
              </tr>
              <tr>
                <td>9984</td>
                <td>ソフトバンクグループ株式会社</td>
                <td>業績予想</td>
                <td>業績予想修正</td>
                <td>2024/01/15 16:00</td>
                <td><a href="https://example.com/test2.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(2);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[1].company_code).toBe('9984');
    });

    it('should skip header row', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr>
                <th>企業コード</th>
                <th>企業名</th>
                <th>開示種類</th>
                <th>タイトル</th>
                <th>開示日時</th>
                <th>PDF</th>
              </tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>決算短信タイトル</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
    });
  });

  describe('異常系: エラーハンドリング', () => {
    it('should throw ValidationError for empty HTML', () => {
      expect(() => parseDisclosureList('')).toThrow(ValidationError);
      expect(() => parseDisclosureList('')).toThrow(/empty/);
    });

    it('should throw ValidationError for whitespace-only HTML', () => {
      expect(() => parseDisclosureList('   \n\t  ')).toThrow(ValidationError);
      expect(() => parseDisclosureList('   \n\t  ')).toThrow(/empty/);
    });

    it('should return empty array when no disclosure table found', () => {
      const html = `
        <html>
          <body>
            <p>No table here</p>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(0);
    });

    it('should skip rows with insufficient cells', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <!-- 不完全な行: セルが不足 -->
              </tr>
              <tr>
                <td>9984</td>
                <td>ソフトバンクグループ株式会社</td>
                <td>業績予想</td>
                <td>業績予想修正</td>
                <td>2024/01/15 16:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      // 不完全な行はスキップされ、有効な行のみパースされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });

    it('should skip rows with invalid company code', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>INVALID</td>
                <td>無効な企業</td>
                <td>決算短信</td>
                <td>タイトル</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>決算短信タイトル</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      // 無効な企業コードの行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
    });

    it('should skip rows with invalid date format', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>タイトル</td>
                <td>INVALID_DATE</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
              <tr>
                <td>9984</td>
                <td>ソフトバンクグループ株式会社</td>
                <td>業績予想</td>
                <td>業績予想修正</td>
                <td>2024/01/15 16:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      // 無効な日付の行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });

    it('should skip rows with invalid PDF URL', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>タイトル</td>
                <td>2024/01/15 15:00</td>
                <td><a href="invalid_url">PDF</a></td>
              </tr>
              <tr>
                <td>9984</td>
                <td>ソフトバンクグループ株式会社</td>
                <td>業績予想</td>
                <td>業績予想修正</td>
                <td>2024/01/15 16:00</td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      // 無効なPDF URLの行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });
  });

  describe('部分的失敗の処理（Graceful Degradation）', () => {
    it('should continue parsing after encountering invalid rows', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>7203</td>
                <td>トヨタ自動車株式会社</td>
                <td>決算短信</td>
                <td>タイトル1</td>
                <td>2024/01/15 15:00</td>
                <td><a href="https://example.com/test1.pdf">PDF</a></td>
              </tr>
              <tr>
                <td>INVALID</td>
                <td>無効な企業</td>
                <td>決算短信</td>
                <td>タイトル2</td>
                <td>2024/01/15 16:00</td>
                <td><a href="https://example.com/test2.pdf">PDF</a></td>
              </tr>
              <tr>
                <td>9984</td>
                <td>ソフトバンクグループ株式会社</td>
                <td>業績予想</td>
                <td>タイトル3</td>
                <td>2024/01/15 17:00</td>
                <td><a href="https://example.com/test3.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      // 無効な行をスキップして、有効な行のみパースされる
      expect(disclosures).toHaveLength(2);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[1].company_code).toBe('9984');
    });
  });

  describe('エッジケース', () => {
    it('should handle empty table (only header)', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(0);
    });

    it('should handle table with no rows', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(0);
    });

    it('should trim whitespace from cell values', () => {
      const html = `
        <html>
          <body>
            <table class="disclosure-list">
              <tr><th>Header</th></tr>
              <tr>
                <td>  7203  </td>
                <td>  トヨタ自動車株式会社  </td>
                <td>  決算短信  </td>
                <td>  決算短信タイトル  </td>
                <td>  2024/01/15 15:00  </td>
                <td><a href="https://example.com/test.pdf">PDF</a></td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
      expect(disclosures[0].disclosure_type).toBe('決算短信');
      expect(disclosures[0].title).toBe('決算短信タイトル');
    });
  });
});

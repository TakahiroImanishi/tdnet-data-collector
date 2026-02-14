/**
 * HTMLパーサーのユニットテスト
 *
 * steeringファイル準拠:
 * - development/tdnet-scraping-patterns.md
 * - core/error-handling-patterns.md
 *
 * Requirements: 要件1.2（メタデータ抽出）
 */

import { parseDisclosureList } from '../html-parser';
import { ValidationError } from '../../errors';

describe('HTML Parser', () => {
  const testDate = '2026-02-13';

  describe('正常系: HTMLパース成功', () => {
    it('should parse valid HTML with disclosure table', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ自動車株式会社</td>
                <td class="oddnew-M kjTitle"><a href="140120260213562187.pdf">2024年3月期 第3四半期決算短信</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
      expect(disclosures[0].disclosure_type).toBe('決算短信');
      expect(disclosures[0].title).toBe('2024年3月期 第3四半期決算短信');
      expect(disclosures[0].disclosed_at).toBe('2026-02-13T06:00:00.000Z'); // JST 15:00 → UTC 06:00
      expect(disclosures[0].pdf_url).toBe('https://www.release.tdnet.info/inbs/140120260213562187.pdf');
    });

    it('should parse multiple disclosure rows', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ自動車株式会社</td>
                <td class="oddnew-M kjTitle"><a href="test1.pdf">決算短信タイトル</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンクグループ株式会社</td>
                <td class="evennew-M kjTitle"><a href="test2.pdf">業績予想修正</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      expect(disclosures).toHaveLength(2);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[1].company_code).toBe('9984');
    });

    it('should handle 5-digit company codes', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">93380</td>
                <td class="oddnew-M kjName">GINFORICH</td>
                <td class="oddnew-M kjTitle"><a href="test.pdf">決算短信</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('93380');
    });
  });

  describe('異常系: エラーハンドリング', () => {
    it('should throw ValidationError for empty HTML', () => {
      expect(() => parseDisclosureList('', testDate)).toThrow(ValidationError);
      expect(() => parseDisclosureList('', testDate)).toThrow('HTML content is empty');
    });

    it('should throw ValidationError for whitespace-only HTML', () => {
      expect(() => parseDisclosureList('   \n\t  ', testDate)).toThrow(ValidationError);
      expect(() => parseDisclosureList('   \n\t  ', testDate)).toThrow('HTML content is empty');
    });

    it('should return empty array when no disclosure table found', () => {
      const html = `
        <html>
          <body>
            <p>No table here</p>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);
      expect(disclosures).toHaveLength(0);
    });

    it('should skip rows with insufficient cells', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td>15:00</td>
                <td>7203</td>
                <td>トヨタ</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // 不完全な行はスキップされ、有効な行のみパースされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });

    it('should skip rows with invalid company code', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">ABC</td>
                <td class="oddnew-M kjName">無効企業</td>
                <td class="oddnew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">7203</td>
                <td class="evennew-M kjName">トヨタ</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // 無効な企業コードの行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
    });

    it('should skip rows with invalid PDF URL', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ</td>
                <td class="oddnew-M kjTitle">タイトル（リンクなし）</td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

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
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ</td>
                <td class="oddnew-M kjTitle"><a href="test1.pdf">タイトル1</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td>15:30</td>
                <td>INVALID</td>
                <td>無効</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test2.pdf">タイトル2</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // 無効な行をスキップして、有効な行のみパースされる
      expect(disclosures).toHaveLength(2);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[1].company_code).toBe('9984');
    });
  });

  describe('バリデーションエラー: 必須フィールド欠落', () => {
    it('should skip rows with missing company_name', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName"></td>
                <td class="oddnew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // company_nameが空の行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });

    it('should skip rows with missing title', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ</td>
                <td class="oddnew-M kjTitle"><a href="test.pdf"></a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // titleが空の行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });

    it('should skip rows with missing PDF link', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ</td>
                <td class="oddnew-M kjTitle">タイトル</td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
              <tr>
                <td class="evennew-L kjTime">16:00</td>
                <td class="evennew-M kjCode">9984</td>
                <td class="evennew-M kjName">ソフトバンク</td>
                <td class="evennew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="evennew-M kjXbrl"></td>
                <td class="evennew-M kjPlace">東</td>
                <td class="evennew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      // PDF URLが空の行はスキップされる
      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('9984');
    });
  });

  describe('エッジケース', () => {
    it('should handle empty table', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);
      expect(disclosures).toHaveLength(0);
    });

    it('should handle table with no rows', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table"></table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);
      expect(disclosures).toHaveLength(0);
    });

    it('should trim whitespace from cell values', () => {
      const html = `
        <html>
          <body>
            <div id="kaiji-date-1">2026年02月13日</div>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">  15:00  </td>
                <td class="oddnew-M kjCode">  7203  </td>
                <td class="oddnew-M kjName">  トヨタ自動車株式会社  </td>
                <td class="oddnew-M kjTitle"><a href="test.pdf">  決算短信  </a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, testDate);

      expect(disclosures).toHaveLength(1);
      expect(disclosures[0].company_code).toBe('7203');
      expect(disclosures[0].company_name).toBe('トヨタ自動車株式会社');
      expect(disclosures[0].disclosure_type).toBe('決算短信');
      expect(disclosures[0].title).toBe('決算短信');
    });

    it('should use fallback date when page date extraction fails', () => {
      const html = `
        <html>
          <body>
            <table id="main-list-table">
              <tr>
                <td class="oddnew-L kjTime">15:00</td>
                <td class="oddnew-M kjCode">7203</td>
                <td class="oddnew-M kjName">トヨタ</td>
                <td class="oddnew-M kjTitle"><a href="test.pdf">タイトル</a></td>
                <td class="oddnew-M kjXbrl"></td>
                <td class="oddnew-M kjPlace">東</td>
                <td class="oddnew-R kjHistroy">ニューー</td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const disclosures = parseDisclosureList(html, '2026-02-14');

      expect(disclosures).toHaveLength(1);
      // フォールバック日付（2026-02-14）が使用される
      expect(disclosures[0].disclosed_at).toBe('2026-02-14T06:00:00.000Z');
    });
  });
});

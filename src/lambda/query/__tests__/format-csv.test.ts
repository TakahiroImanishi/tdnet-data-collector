/**
 * Format CSV Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

import { formatAsCsv, parseCsv } from '../format-csv';
import { Disclosure } from '../../../types';

describe('Format CSV', () => {
  const mockDisclosures: Disclosure[] = [
    {
      disclosure_id: 'TD20240115001',
      company_code: '7203',
      company_name: 'トヨタ自動車',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-15T10:30:00Z',
      pdf_url: 'https://www.release.tdnet.info/inbs/140120240115533808.pdf',
      s3_key: '2024/01/15/TD20240115001_7203.pdf',
      collected_at: '2024-01-15T10:35:00Z',
      date_partition: '2024-01',
    },
    {
      disclosure_id: 'TD20240115002',
      company_code: '6758',
      company_name: 'ソニーグループ',
      disclosure_type: '有価証券報告書',
      title: '第78期有価証券報告書',
      disclosed_at: '2024-01-15T11:00:00Z',
      pdf_url: 'https://www.release.tdnet.info/inbs/140120240115534001.pdf',
      s3_key: '2024/01/15/TD20240115002_6758.pdf',
      collected_at: '2024-01-15T11:05:00Z',
      date_partition: '2024-01',
    },
  ];

  describe('formatAsCsv', () => {
    it('開示情報リストをCSV形式に変換', () => {
      const csv = formatAsCsv(mockDisclosures);

      // ヘッダー行を確認
      expect(csv).toContain('disclosure_id,company_code,company_name');
      expect(csv).toContain('disclosure_type,title,disclosed_at');
      expect(csv).toContain('pdf_url,s3_key,collected_at,date_partition');

      // データ行を確認
      expect(csv).toContain('TD20240115001');
      expect(csv).toContain('7203');
      expect(csv).toContain('トヨタ自動車');
      expect(csv).toContain('TD20240115002');
      expect(csv).toContain('6758');
      expect(csv).toContain('ソニーグループ');
    });

    it('空のリストは ヘッダーのみ返す', () => {
      const csv = formatAsCsv([]);

      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // ヘッダーのみ
      expect(lines[0]).toContain('disclosure_id,company_code');
    });

    it('カンマを含むフィールドをエスケープ', () => {
      const disclosures: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル, カンマ付き',
        },
      ];

      const csv = formatAsCsv(disclosures);

      // カンマを含むフィールドはダブルクォートで囲まれる
      expect(csv).toContain('"タイトル, カンマ付き"');
    });

    it('ダブルクォートを含むフィールドをエスケープ', () => {
      const disclosures: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル "引用符" 付き',
        },
      ];

      const csv = formatAsCsv(disclosures);

      // ダブルクォートは2つ連続させてエスケープ
      expect(csv).toContain('"タイトル ""引用符"" 付き"');
    });

    it('改行を含むフィールドをエスケープ', () => {
      const disclosures: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル\n改行付き',
        },
      ];

      const csv = formatAsCsv(disclosures);

      // 改行を含むフィールドはダブルクォートで囲まれる
      expect(csv).toContain('"タイトル\n改行付き"');
    });

    it('すべてのフィールドが含まれる', () => {
      const csv = formatAsCsv(mockDisclosures);

      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      expect(headers).toContain('disclosure_id');
      expect(headers).toContain('company_code');
      expect(headers).toContain('company_name');
      expect(headers).toContain('disclosure_type');
      expect(headers).toContain('title');
      expect(headers).toContain('disclosed_at');
      expect(headers).toContain('pdf_url');
      expect(headers).toContain('s3_key');
      expect(headers).toContain('collected_at');
      expect(headers).toContain('date_partition');
    });

    it('複数の開示情報を正しく変換', () => {
      const csv = formatAsCsv(mockDisclosures);

      const lines = csv.split('\n').filter((line) => line.trim() !== '');
      expect(lines.length).toBe(3); // ヘッダー + 2データ行
    });
  });

  describe('parseCsv（テスト用）', () => {
    it('CSV文字列をパース', () => {
      const csv = formatAsCsv(mockDisclosures);
      const parsed = parseCsv(csv);

      expect(parsed.length).toBe(2);
      expect(parsed[0].disclosure_id).toBe('TD20240115001');
      expect(parsed[0].company_code).toBe('7203');
      expect(parsed[1].disclosure_id).toBe('TD20240115002');
      expect(parsed[1].company_code).toBe('6758');
    });

    it('空のCSV文字列は空配列を返す', () => {
      const parsed = parseCsv('');

      expect(parsed).toEqual([]);
    });
  });

  describe('エッジケース', () => {
    it('null/undefinedフィールドは空文字列として扱う', () => {
      const disclosures: any[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '7203',
          company_name: null,
          disclosure_type: undefined,
          title: '2024年3月期 第3四半期決算短信',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://www.release.tdnet.info/...',
          s3_key: '2024/01/15/TD20240115001_7203.pdf',
          collected_at: '2024-01-15T10:35:00Z',
          date_partition: '2024-01',
        },
      ];

      const csv = formatAsCsv(disclosures as Disclosure[]);

      // null/undefinedは空文字列として扱われる
      expect(csv).toContain('TD20240115001,7203,,');
    });

    it('特殊文字を含むフィールドを正しく処理', () => {
      const disclosures: Disclosure[] = [
        {
          ...mockDisclosures[0],
          title: 'タイトル & 特殊文字 < > " \' / \\',
        },
      ];

      const csv = formatAsCsv(disclosures);

      // ダブルクォートのみエスケープが必要
      expect(csv).toContain('"タイトル & 特殊文字 < > "" \' / \\"');
    });
  });
});

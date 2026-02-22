/**
 * Zodスキーマのテスト
 */

import {
  disclosureSchema,
  validateDisclosureWithZod,
  safeValidateDisclosure,
  collectionResultSchema,
  executionStatusSchema,
  queryFilterSchema,
} from '../disclosure-schema';
import { z } from 'zod';

describe('disclosure-schema', () => {
  describe('disclosureSchema', () => {
    const validDisclosure = {
      disclosure_id: '20240115_7203_001',
      company_code: '7203',
      company_name: 'トヨタ自動車株式会社',
      disclosure_type: '決算短信',
      title: '2024年3月期 第3四半期決算短信',
      disclosed_at: '2024-01-15T10:30:00Z',
      downloaded_at: '2024-01-15T10:35:00Z',
      date_partition: '2024-01',
    };

    describe('正常系', () => {
      it('有効な開示情報を受け入れる', () => {
        expect(() => disclosureSchema.parse(validDisclosure)).not.toThrow();
      });

      it('オプショナルフィールドを含む開示情報を受け入れる', () => {
        const withOptional = {
          ...validDisclosure,
          pdf_url: 'https://example.com/disclosure.pdf',
          pdf_s3_key: '2024/01/20240115_7203_001.pdf',
          file_size: 1024000,
        };
        expect(() => disclosureSchema.parse(withOptional)).not.toThrow();
      });

      it('validateDisclosureWithZodが正しく動作する', () => {
        const result = validateDisclosureWithZod(validDisclosure);
        expect(result.disclosure_id).toBe('20240115_7203_001');
        expect(result.company_code).toBe('7203');
      });

      it('safeValidateDisclosureが成功時にsuccessを返す', () => {
        const result = safeValidateDisclosure(validDisclosure);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.disclosure_id).toBe('20240115_7203_001');
        }
      });
    });

    describe('異常系 - disclosure_id', () => {
      it('不正なフォーマットを拒否する', () => {
        const invalid = { ...validDisclosure, disclosure_id: 'invalid' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('空文字列を拒否する', () => {
        const invalid = { ...validDisclosure, disclosure_id: '' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - company_code', () => {
      it('3桁の企業コードを拒否する', () => {
        const invalid = { ...validDisclosure, company_code: '123' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('5桁の企業コードを拒否する', () => {
        const invalid = { ...validDisclosure, company_code: '12345' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('数字以外を含む企業コードを拒否する', () => {
        const invalid = { ...validDisclosure, company_code: 'ABCD' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('範囲外の企業コードを拒否する（< 1000）', () => {
        const invalid = { ...validDisclosure, company_code: '0999' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - disclosed_at', () => {
      it('不正なフォーマットを拒否する', () => {
        const invalid = { ...validDisclosure, disclosed_at: '2024-01-15' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('存在しない日付を拒否する', () => {
        const invalid = { ...validDisclosure, disclosed_at: '2024-02-30T10:30:00Z' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('範囲外の日付を拒否する（1970年以前）', () => {
        const invalid = { ...validDisclosure, disclosed_at: '1969-12-31T23:59:59Z' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - date_partition', () => {
      it('不正なフォーマットを拒否する', () => {
        const invalid = { ...validDisclosure, date_partition: '2024-1' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('不正な月を拒否する', () => {
        const invalid = { ...validDisclosure, date_partition: '2024-13' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - pdf_url', () => {
      it('不正なURLを拒否する', () => {
        const invalid = { ...validDisclosure, pdf_url: 'not-a-url' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - pdf_s3_key', () => {
      it('不正なフォーマットを拒否する', () => {
        const invalid = { ...validDisclosure, pdf_s3_key: 'invalid-key' };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - file_size', () => {
      it('負の値を拒否する', () => {
        const invalid = { ...validDisclosure, file_size: -1 };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('100MBを超える値を拒否する', () => {
        const invalid = { ...validDisclosure, file_size: 101 * 1024 * 1024 };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('小数を拒否する', () => {
        const invalid = { ...validDisclosure, file_size: 1024.5 };
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('異常系 - 必須フィールド', () => {
      it('company_nameが欠落している場合はエラー', () => {
        const invalid = { ...validDisclosure };
        delete (invalid as any).company_name;
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });

      it('disclosure_typeが欠落している場合はエラー', () => {
        const invalid = { ...validDisclosure };
        delete (invalid as any).disclosure_type;
        expect(() => disclosureSchema.parse(invalid)).toThrow(z.ZodError);
      });
    });

    describe('safeValidateDisclosure', () => {
      it('バリデーションエラー時にsuccessがfalseを返す', () => {
        const invalid = { ...validDisclosure, company_code: '123' };
        const result = safeValidateDisclosure(invalid);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(z.ZodError);
        }
      });
    });
  });

  describe('collectionResultSchema', () => {
    const validResult = {
      execution_id: 'exec-20240115-001',
      success_count: 10,
      failed_count: 2,
      disclosures: [],
      errors: [
        {
          disclosure_id: '20240115_7203_001',
          error_message: 'Download failed',
          error_type: 'NetworkError',
        },
      ],
    };

    it('有効な収集結果を受け入れる', () => {
      expect(() => collectionResultSchema.parse(validResult)).not.toThrow();
    });

    it('負の成功件数を拒否する', () => {
      const invalid = { ...validResult, success_count: -1 };
      expect(() => collectionResultSchema.parse(invalid)).toThrow(z.ZodError);
    });
  });

  describe('executionStatusSchema', () => {
    const validStatus = {
      execution_id: 'exec-20240115-001',
      status: 'running' as const,
      started_at: '2024-01-15T10:00:00Z',
      progress: 50,
      success_count: 5,
      failed_count: 1,
      ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    };

    it('有効な実行状態を受け入れる', () => {
      expect(() => executionStatusSchema.parse(validStatus)).not.toThrow();
    });

    it('不正なステータスを拒否する', () => {
      const invalid = { ...validStatus, status: 'invalid' };
      expect(() => executionStatusSchema.parse(invalid)).toThrow(z.ZodError);
    });

    it('範囲外の進捗率を拒否する', () => {
      const invalid = { ...validStatus, progress: 101 };
      expect(() => executionStatusSchema.parse(invalid)).toThrow(z.ZodError);
    });
  });

  describe('queryFilterSchema', () => {
    it('有効なクエリフィルターを受け入れる', () => {
      const validFilter = {
        company_code: '7203',
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-31T23:59:59Z',
        disclosure_type: '決算短信',
        limit: 100,
        offset: 0,
      };
      expect(() => queryFilterSchema.parse(validFilter)).not.toThrow();
    });

    it('範囲外のlimitを拒否する', () => {
      const invalid = { limit: 1001 };
      expect(() => queryFilterSchema.parse(invalid)).toThrow(z.ZodError);
    });

    it('負のoffsetを拒否する', () => {
      const invalid = { offset: -1 };
      expect(() => queryFilterSchema.parse(invalid)).toThrow(z.ZodError);
    });
  });
});


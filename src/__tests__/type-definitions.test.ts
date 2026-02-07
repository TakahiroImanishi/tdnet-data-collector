/**
 * TypeScript型定義とインターフェースのテスト
 *
 * Task 2.1の実装を検証します。
 *
 * Requirements: 要件2.1, 2.2, 2.3（メタデータ管理）
 */

import { Disclosure, CollectionResult, ExecutionStatus, QueryFilter } from '../types';
import {
  toDynamoDBItem,
  fromDynamoDBItem,
  createDisclosure,
  generateDisclosureId,
  validateDisclosure,
} from '../models/disclosure';
import {
  generateDatePartition,
  validateDisclosedAt,
  generateMonthRange,
  validateYearMonth,
} from '../utils/date-partition';
import { ValidationError } from '../errors';

describe('TypeScript型定義とインターフェース', () => {
  describe('Disclosure型', () => {
    it('should have all required fields', () => {
      const disclosure: Disclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        collected_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-01',
      };

      expect(disclosure.disclosure_id).toBe('20240115_1234_001');
      expect(disclosure.company_code).toBe('1234');
      expect(disclosure.date_partition).toBe('2024-01');
    });
  });

  describe('CollectionResult型', () => {
    it('should have all required fields', () => {
      const result: CollectionResult = {
        execution_id: 'exec-123',
        success_count: 10,
        failed_count: 2,
        disclosures: [],
        errors: [
          {
            disclosure_id: '20240115_1234_001',
            error_message: 'Network error',
            error_type: 'NetworkError',
          },
        ],
      };

      expect(result.execution_id).toBe('exec-123');
      expect(result.success_count).toBe(10);
      expect(result.failed_count).toBe(2);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('ExecutionStatus型', () => {
    it('should have all required fields', () => {
      const status: ExecutionStatus = {
        execution_id: 'exec-123',
        status: 'running',
        started_at: '2024-01-15T10:00:00Z',
        progress: 50,
        success_count: 5,
        failed_count: 1,
        ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      expect(status.execution_id).toBe('exec-123');
      expect(status.status).toBe('running');
      expect(status.progress).toBe(50);
    });
  });

  describe('QueryFilter型', () => {
    it('should support optional fields', () => {
      const filter: QueryFilter = {
        company_code: '1234',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        disclosure_type: '決算短信',
        limit: 100,
        offset: 0,
      };

      expect(filter.company_code).toBe('1234');
      expect(filter.limit).toBe(100);
    });

    it('should allow empty filter', () => {
      const filter: QueryFilter = {};
      expect(filter).toEqual({});
    });
  });

  describe('toDynamoDBItem', () => {
    it('should convert Disclosure to DynamoDB item', () => {
      const disclosure: Disclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        collected_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-01',
      };

      const item = toDynamoDBItem(disclosure);

      expect(item.disclosure_id.S).toBe('20240115_1234_001');
      expect(item.company_code.S).toBe('1234');
      expect(item.date_partition.S).toBe('2024-01');
    });

    it('should throw ValidationError for missing fields', () => {
      const invalidDisclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        // Missing required fields
      } as Disclosure;

      expect(() => toDynamoDBItem(invalidDisclosure)).toThrow(ValidationError);
    });
  });

  describe('fromDynamoDBItem', () => {
    it('should convert DynamoDB item to Disclosure', () => {
      const item = {
        disclosure_id: { S: '20240115_1234_001' },
        company_code: { S: '1234' },
        company_name: { S: 'テスト株式会社' },
        disclosure_type: { S: '決算短信' },
        title: { S: '2024年3月期 第3四半期決算短信' },
        disclosed_at: { S: '2024-01-15T10:30:00Z' },
        pdf_url: { S: 'https://example.com/pdf/test.pdf' },
        s3_key: { S: 'pdfs/2024/01/20240115_1234_001.pdf' },
        collected_at: { S: '2024-01-15T10:35:00Z' },
        date_partition: { S: '2024-01' },
      };

      const disclosure = fromDynamoDBItem(item);

      expect(disclosure.disclosure_id).toBe('20240115_1234_001');
      expect(disclosure.company_code).toBe('1234');
      expect(disclosure.date_partition).toBe('2024-01');
    });

    it('should throw ValidationError for missing fields', () => {
      const invalidItem = {
        disclosure_id: { S: '20240115_1234_001' },
        // Missing required fields
      };

      expect(() => fromDynamoDBItem(invalidItem)).toThrow(ValidationError);
    });
  });

  describe('generateDatePartition', () => {
    it('should generate date_partition in YYYY-MM format (JST)', () => {
      const partition = generateDatePartition('2024-01-15T10:30:00Z');
      expect(partition).toBe('2024-01');
    });

    it('should handle month boundary (UTC to JST)', () => {
      // UTC: 2024-01-31 15:30 → JST: 2024-02-01 00:30
      const partition = generateDatePartition('2024-01-31T15:30:00Z');
      expect(partition).toBe('2024-02');
    });

    it('should handle leap year February', () => {
      // UTC: 2024-02-29 15:00 → JST: 2024-03-01 00:00
      const partition = generateDatePartition('2024-02-29T15:00:00Z');
      expect(partition).toBe('2024-03');
    });

    it('should handle year boundary', () => {
      // UTC: 2023-12-31 15:30 → JST: 2024-01-01 00:30
      const partition = generateDatePartition('2023-12-31T15:30:00Z');
      expect(partition).toBe('2024-01');
    });

    it('should throw ValidationError for invalid format', () => {
      expect(() => generateDatePartition('2024-01-15')).toThrow(ValidationError);
      expect(() => generateDatePartition('invalid-date')).toThrow(ValidationError);
    });

    it('should reject non-existent dates', () => {
      // Note: JavaScript Date constructor accepts '2024-02-30' and converts to '2024-03-02'
      // Our validation now detects this normalization and rejects non-existent dates
      expect(() => generateDatePartition('2024-02-30T10:30:00Z')).toThrow(ValidationError);
      expect(() => generateDatePartition('2024-02-31T10:30:00Z')).toThrow(ValidationError);
      expect(() => generateDatePartition('2024-04-31T10:30:00Z')).toThrow(ValidationError);
    });

    it('should throw ValidationError for out of range date', () => {
      expect(() => generateDatePartition('1969-12-31T23:59:59Z')).toThrow(ValidationError);
    });
  });

  describe('validateDisclosedAt', () => {
    it('should accept valid ISO 8601 format', () => {
      expect(() => validateDisclosedAt('2024-01-15T10:30:00Z')).not.toThrow();
      expect(() => validateDisclosedAt('2024-01-15T10:30:00.123Z')).not.toThrow();
      expect(() => validateDisclosedAt('2024-01-15T10:30:00+09:00')).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => validateDisclosedAt('2024-01-15')).toThrow(ValidationError);
      expect(() => validateDisclosedAt('2024/01/15 10:30:00')).toThrow(ValidationError);
      expect(() => validateDisclosedAt('invalid')).toThrow(ValidationError);
    });

    it('should reject non-existent dates', () => {
      // Note: JavaScript Date constructor accepts '2024-02-30' and converts to '2024-03-02'
      // Our validation now detects this normalization and rejects non-existent dates
      expect(() => validateDisclosedAt('2024-02-30T10:30:00Z')).toThrow(ValidationError);
      // Completely invalid dates like '2024-13-01' will also be rejected
      expect(() => validateDisclosedAt('2024-13-01T10:30:00Z')).toThrow(ValidationError);
    });

    it('should reject out of range date', () => {
      expect(() => validateDisclosedAt('1969-12-31T23:59:59Z')).toThrow(ValidationError);
    });
  });

  describe('generateMonthRange', () => {
    it('should generate month range', () => {
      const months = generateMonthRange('2024-01', '2024-03');
      expect(months).toEqual(['2024-01', '2024-02', '2024-03']);
    });

    it('should handle single month', () => {
      const months = generateMonthRange('2024-01', '2024-01');
      expect(months).toEqual(['2024-01']);
    });

    it('should handle year boundary', () => {
      const months = generateMonthRange('2023-11', '2024-02');
      expect(months).toEqual(['2023-11', '2023-12', '2024-01', '2024-02']);
    });

    it('should throw ValidationError for invalid format', () => {
      expect(() => generateMonthRange('2024-1', '2024-03')).toThrow(ValidationError);
      expect(() => generateMonthRange('2024/01', '2024/03')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid range', () => {
      expect(() => generateMonthRange('2024-03', '2024-01')).toThrow(ValidationError);
    });
  });

  describe('validateYearMonth', () => {
    it('should accept valid YYYY-MM format', () => {
      expect(() => validateYearMonth('2024-01')).not.toThrow();
      expect(() => validateYearMonth('2024-12')).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => validateYearMonth('2024-1')).toThrow(ValidationError);
      expect(() => validateYearMonth('2024/01')).toThrow(ValidationError);
      expect(() => validateYearMonth('202401')).toThrow(ValidationError);
    });

    it('should reject invalid month', () => {
      expect(() => validateYearMonth('2024-00')).toThrow(ValidationError);
      expect(() => validateYearMonth('2024-13')).toThrow(ValidationError);
    });
  });

  describe('createDisclosure', () => {
    it('should create Disclosure with auto-generated date_partition', () => {
      const disclosure = createDisclosure({
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
      });

      expect(disclosure.date_partition).toBe('2024-01');
      expect(disclosure.collected_at).toBeDefined();
    });

    it('should use provided date_partition', () => {
      const disclosure = createDisclosure({
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        date_partition: '2024-02',
      });

      expect(disclosure.date_partition).toBe('2024-02');
    });
  });

  describe('generateDisclosureId', () => {
    it('should generate disclosure ID in correct format', () => {
      const id = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1);
      expect(id).toBe('20240115_1234_001');
    });

    it('should handle JST date conversion', () => {
      // UTC: 2024-01-31 15:30 → JST: 2024-02-01 00:30
      const id = generateDisclosureId('2024-01-31T15:30:00Z', '1234', 1);
      expect(id).toBe('20240201_1234_001');
    });

    it('should pad sequence with zeros', () => {
      const id1 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1);
      const id2 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 99);
      const id3 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 999);

      expect(id1).toBe('20240115_1234_001');
      expect(id2).toBe('20240115_1234_099');
      expect(id3).toBe('20240115_1234_999');
    });

    it('should throw ValidationError for invalid company_code', () => {
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '123', 1)).toThrow(ValidationError);
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '12345', 1)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', 'ABCD', 1)).toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError for invalid sequence', () => {
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '1234', -1)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1.5)).toThrow(
        ValidationError
      );
    });
  });

  describe('validateDisclosure', () => {
    it('should accept valid Disclosure', () => {
      const disclosure: Disclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        collected_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-01',
      };

      expect(() => validateDisclosure(disclosure)).not.toThrow();
    });

    it('should throw ValidationError for missing fields', () => {
      const invalidDisclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
      } as Disclosure;

      expect(() => validateDisclosure(invalidDisclosure)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid company_code', () => {
      const disclosure: Disclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '123', // Invalid: not 4 digits
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        collected_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-01',
      };

      expect(() => validateDisclosure(disclosure)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid date_partition', () => {
      const disclosure: Disclosure = {
        disclosure_id: '20240115_1234_001',
        company_code: '1234',
        company_name: 'テスト株式会社',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://example.com/pdf/test.pdf',
        s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
        collected_at: '2024-01-15T10:35:00Z',
        date_partition: '2024-1', // Invalid: not YYYY-MM format
      };

      expect(() => validateDisclosure(disclosure)).toThrow(ValidationError);
    });
  });
});

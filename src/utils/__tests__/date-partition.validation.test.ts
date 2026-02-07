/**
 * date_partition バリデーションのユニットテスト
 *
 * generateDatePartition関数のバリデーション機能をテストします。
 * 不正な入力に対して適切にValidationErrorをスローすることを確認します。
 *
 * Requirements: 要件6.1, 6.2（エラーハンドリング）
 * Task: 2.4 - date_partitionバリデーションのユニットテスト
 */

import { generateDatePartition, validateDisclosedAt } from '../date-partition';
import { ValidationError } from '../../errors';

describe('date_partition validation', () => {
  describe('validateDisclosedAt', () => {
    describe('不正なフォーマット（ISO8601以外）', () => {
      it('should throw ValidationError for non-ISO8601 format', () => {
        const invalidFormats = [
          '2024-01-15',
          '2024/01/15 10:30:00',
          '15-01-2024T10:30:00Z',
          '2024-01-15 10:30:00',
          '2024-01-15T10:30:00',
          '2024-01-15T10:30',
          'invalid-date',
          '',
          '2024-1-15T10:30:00Z',
          '2024-01-1T10:30:00Z',
        ];

        invalidFormats.forEach((format) => {
          expect(() => validateDisclosedAt(format)).toThrow(ValidationError);
          expect(() => validateDisclosedAt(format)).toThrow(
            /Invalid disclosed_at format.*Expected ISO 8601 format/
          );
        });
      });

      it('should throw ValidationError with details', () => {
        try {
          validateDisclosedAt('2024-01-15');
          fail('Expected ValidationError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).details).toEqual({
            disclosed_at: '2024-01-15',
          });
        }
      });
    });

    describe('存在しない日付', () => {
      it('should throw ValidationError for non-existent dates', () => {
        const invalidDates = [
          '2024-02-30T10:30:00Z',
          '2024-02-31T10:30:00Z',
          '2024-04-31T10:30:00Z',
          '2024-06-31T10:30:00Z',
          '2024-09-31T10:30:00Z',
          '2024-11-31T10:30:00Z',
          '2023-02-29T10:30:00Z',
          '2024-13-01T10:30:00Z',
          '2024-00-01T10:30:00Z',
        ];

        invalidDates.forEach((date) => {
          expect(() => validateDisclosedAt(date)).toThrow(ValidationError);
          expect(() => validateDisclosedAt(date)).toThrow(/Invalid date.*Date does not exist/);
        });
      });

      it('should accept leap year February 29', () => {
        expect(() => validateDisclosedAt('2024-02-29T10:30:00Z')).not.toThrow();
      });

      it('should reject non-leap year February 29', () => {
        expect(() => validateDisclosedAt('2023-02-29T10:30:00Z')).toThrow(ValidationError);
      });
    });

    describe('範囲外の日付', () => {
      it('should throw ValidationError for dates before 1970-01-01', () => {
        const oldDates = [
          '1969-12-31T23:59:59Z',
          '1969-01-01T00:00:00Z',
          '1900-01-01T00:00:00Z',
        ];

        oldDates.forEach((date) => {
          expect(() => validateDisclosedAt(date)).toThrow(ValidationError);
          expect(() => validateDisclosedAt(date)).toThrow(/Date out of range.*Must be between/);
        });
      });

      it('should accept 1970-01-01', () => {
        expect(() => validateDisclosedAt('1970-01-01T00:00:00Z')).not.toThrow();
      });

      it('should throw ValidationError for dates after current time + 1 day', () => {
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        const futureDateStr = futureDate.toISOString();

        expect(() => validateDisclosedAt(futureDateStr)).toThrow(ValidationError);
        expect(() => validateDisclosedAt(futureDateStr)).toThrow(
          /Date out of range.*Must be between/
        );
      });

      it('should accept current time', () => {
        const now = new Date().toISOString();
        expect(() => validateDisclosedAt(now)).not.toThrow();
      });

      it('should accept current time + 1 day', () => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const tomorrowStr = tomorrow.toISOString();
        expect(() => validateDisclosedAt(tomorrowStr)).not.toThrow();
      });

      it('should throw ValidationError with range details', () => {
        try {
          validateDisclosedAt('1969-12-31T23:59:59Z');
          fail('Expected ValidationError to be thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ValidationError);
          expect((error as ValidationError).details).toHaveProperty('disclosed_at');
          expect((error as ValidationError).details).toHaveProperty('min_date');
          expect((error as ValidationError).details).toHaveProperty('max_date');
        }
      });
    });

    describe('有効な日付', () => {
      it('should accept valid ISO8601 dates with Z timezone', () => {
        const validDates = [
          '2024-01-15T10:30:00Z',
          '2024-01-15T10:30:00.000Z',
          '2024-12-31T23:59:59Z',
          '2024-12-31T23:59:59.999Z',
          '1970-01-01T00:00:00Z',
        ];

        validDates.forEach((date) => {
          expect(() => validateDisclosedAt(date)).not.toThrow();
        });
      });

      it('should accept valid ISO8601 dates with offset timezone', () => {
        const validDates = [
          '2024-01-15T10:30:00+09:00',
          '2024-01-15T10:30:00-05:00',
          '2024-01-15T10:30:00+00:00',
        ];

        validDates.forEach((date) => {
          expect(() => validateDisclosedAt(date)).not.toThrow();
        });
      });
    });
  });

  describe('generateDatePartition', () => {
    describe('不正な入力でValidationErrorをスロー', () => {
      it('should throw ValidationError for invalid format', () => {
        expect(() => generateDatePartition('2024-01-15')).toThrow(ValidationError);
      });

      it('should throw ValidationError for non-existent date', () => {
        expect(() => generateDatePartition('2024-02-30T10:30:00Z')).toThrow(ValidationError);
      });

      it('should throw ValidationError for out-of-range date', () => {
        expect(() => generateDatePartition('1969-12-31T23:59:59Z')).toThrow(ValidationError);
      });
    });

    describe('有効な入力でdate_partitionを生成', () => {
      it('should generate date_partition for valid dates', () => {
        expect(generateDatePartition('2024-01-15T10:30:00Z')).toBe('2024-01');
        expect(generateDatePartition('2024-12-31T23:59:59Z')).toBe('2025-01');
        expect(generateDatePartition('1970-01-01T00:00:00Z')).toBe('1970-01');
      });
    });
  });

  describe('エッジケース', () => {
    describe('月またぎ（UTC → JST）', () => {
      it('should handle month boundary correctly', () => {
        expect(generateDatePartition('2024-01-31T15:30:00Z')).toBe('2024-02');
        expect(generateDatePartition('2024-02-01T14:59:59Z')).toBe('2024-01');
      });

      it('should handle leap year February correctly', () => {
        expect(generateDatePartition('2024-02-29T15:00:00Z')).toBe('2024-03');
      });

      it('should handle year boundary correctly', () => {
        expect(generateDatePartition('2023-12-31T15:30:00Z')).toBe('2024-01');
      });

      it('should handle non-leap year February correctly', () => {
        expect(generateDatePartition('2023-02-28T15:00:00Z')).toBe('2023-03');
      });
    });

    describe('タイムゾーンオフセット', () => {
      it('should handle JST timezone offset', () => {
        expect(generateDatePartition('2024-01-31T15:30:00+09:00')).toBe('2024-01');
      });

      it('should handle negative timezone offset', () => {
        expect(generateDatePartition('2024-01-31T15:30:00-05:00')).toBe('2024-02');
      });
    });
  });
});

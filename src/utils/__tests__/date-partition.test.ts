/**
 * date-partition.test.ts
 *
 * date_partition生成ユーティリティのテスト
 *
 * Steering準拠チェック:
 * - JST基準でYYYY-MM形式を生成
 * - UTC→JST変換（+9時間）を正しく実装
 * - 月またぎのエッジケース処理
 * - ISO 8601形式のバリデーション
 * - 範囲チェック（1970-01-01以降、現在+1日以内）
 * - ValidationErrorのスロー
 */

import {
  generateDatePartition,
  validateDisclosedAt,
  generateMonthRange,
  validateYearMonth,
} from '../date-partition';
import { ValidationError } from '../../errors';

describe('validateDisclosedAt', () => {
  describe('正常系: 有効なISO 8601形式', () => {
    it('UTC形式（Z）を受け入れる', () => {
      expect(() => validateDisclosedAt('2024-01-15T10:30:00Z')).not.toThrow();
    });

    it('ミリ秒付きUTC形式を受け入れる', () => {
      expect(() => validateDisclosedAt('2024-01-15T10:30:00.123Z')).not.toThrow();
    });

    it('タイムゾーンオフセット形式を受け入れる', () => {
      expect(() => validateDisclosedAt('2024-01-15T19:30:00+09:00')).not.toThrow();
    });
  });

  describe('異常系: 不正なフォーマット', () => {
    it('ISO 8601形式でない場合はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2024-01-15')).toThrow(ValidationError);
      expect(() => validateDisclosedAt('2024/01/15 10:30:00')).toThrow(ValidationError);
      expect(() => validateDisclosedAt('invalid-date')).toThrow(ValidationError);
    });

    it('タイムゾーン指定がない場合はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2024-01-15T10:30:00')).toThrow(ValidationError);
    });
  });

  describe('異常系: 存在しない日付', () => {
    it('2024-02-30（存在しない日付）はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2024-02-30T10:30:00Z')).toThrow(ValidationError);
    });

    it('2023-02-29（非うるう年の2月29日）はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2023-02-29T10:30:00Z')).toThrow(ValidationError);
    });

    it('2024-13-01（13月）はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2024-13-01T10:30:00Z')).toThrow(ValidationError);
    });

    it('2024-01-32（32日）はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('2024-01-32T10:30:00Z')).toThrow(ValidationError);
    });
  });

  describe('異常系: 範囲外の日付', () => {
    it('1970-01-01より前の日付はValidationErrorをスロー', () => {
      expect(() => validateDisclosedAt('1969-12-31T23:59:59Z')).toThrow(ValidationError);
    });

    it('現在時刻+2日以降の日付はValidationErrorをスロー', () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      const futureDateStr = futureDate.toISOString();
      expect(() => validateDisclosedAt(futureDateStr)).toThrow(ValidationError);
    });
  });

  describe('正常系: 境界値', () => {
    it('1970-01-01T00:00:00Zを受け入れる', () => {
      expect(() => validateDisclosedAt('1970-01-01T00:00:00Z')).not.toThrow();
    });

    it('現在時刻を受け入れる', () => {
      const now = new Date().toISOString();
      expect(() => validateDisclosedAt(now)).not.toThrow();
    });

    it('現在時刻+1日を受け入れる', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString();
      expect(() => validateDisclosedAt(tomorrowStr)).not.toThrow();
    });
  });
});

describe('generateDatePartition', () => {
  describe('正常系: JST基準でYYYY-MM形式を生成', () => {
    it('UTC: 2024-01-15T01:30:00Z → JST: 2024-01-15T10:30:00 → "2024-01"', () => {
      expect(generateDatePartition('2024-01-15T01:30:00Z')).toBe('2024-01');
    });

    it('UTC: 2024-06-15T12:00:00Z → JST: 2024-06-15T21:00:00 → "2024-06"', () => {
      expect(generateDatePartition('2024-06-15T12:00:00Z')).toBe('2024-06');
    });

    it('UTC: 2024-12-31T14:59:59Z → JST: 2024-12-31T23:59:59 → "2024-12"', () => {
      expect(generateDatePartition('2024-12-31T14:59:59Z')).toBe('2024-12');
    });
  });

  describe('エッジケース: 月またぎ（UTC→JST変換）', () => {
    it('UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00 → "2024-02"', () => {
      expect(generateDatePartition('2024-01-31T15:30:00Z')).toBe('2024-02');
    });

    it('UTC: 2024-02-01T14:59:59Z → JST: 2024-01-31T23:59:59 → "2024-01"', () => {
      expect(generateDatePartition('2024-02-01T14:59:59Z')).toBe('2024-01');
    });

    it('UTC: 2024-02-29T15:00:00Z → JST: 2024-03-01T00:00:00 → "2024-03"（うるう年）', () => {
      expect(generateDatePartition('2024-02-29T15:00:00Z')).toBe('2024-03');
    });

    it('UTC: 2023-02-28T15:00:00Z → JST: 2023-03-01T00:00:00 → "2023-03"（非うるう年）', () => {
      expect(generateDatePartition('2023-02-28T15:00:00Z')).toBe('2023-03');
    });

    it('UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01T00:30:00 → "2024-01"（年またぎ）', () => {
      expect(generateDatePartition('2023-12-31T15:30:00Z')).toBe('2024-01');
    });

    it('UTC: 2024-01-01T14:59:59Z → JST: 2023-12-31T23:59:59 → "2023-12"（年またぎ逆）', () => {
      expect(generateDatePartition('2024-01-01T14:59:59Z')).toBe('2023-12');
    });
  });

  describe('エッジケース: 月末の深夜', () => {
    it('UTC: 2024-03-31T15:00:00Z → JST: 2024-04-01T00:00:00 → "2024-04"', () => {
      expect(generateDatePartition('2024-03-31T15:00:00Z')).toBe('2024-04');
    });

    it('UTC: 2024-04-30T15:00:00Z → JST: 2024-05-01T00:00:00 → "2024-05"', () => {
      expect(generateDatePartition('2024-04-30T15:00:00Z')).toBe('2024-05');
    });

    it('UTC: 2024-05-31T15:00:00Z → JST: 2024-06-01T00:00:00 → "2024-06"', () => {
      expect(generateDatePartition('2024-05-31T15:00:00Z')).toBe('2024-06');
    });
  });

  describe('異常系: 不正な入力', () => {
    it('不正なフォーマットの場合はValidationErrorをスロー', () => {
      expect(() => generateDatePartition('2024-01-15')).toThrow(ValidationError);
      expect(() => generateDatePartition('invalid-date')).toThrow(ValidationError);
    });

    it('存在しない日付の場合はValidationErrorをスロー', () => {
      expect(() => generateDatePartition('2024-02-30T10:30:00Z')).toThrow(ValidationError);
    });

    it('範囲外の日付の場合はValidationErrorをスロー', () => {
      expect(() => generateDatePartition('1969-12-31T23:59:59Z')).toThrow(ValidationError);
    });
  });
});

describe('generateMonthRange', () => {
  describe('正常系: 月範囲の生成', () => {
    it('同一月の場合は1つの月を返す', () => {
      expect(generateMonthRange('2024-01', '2024-01')).toEqual(['2024-01']);
    });

    it('連続する3ヶ月の範囲を生成', () => {
      expect(generateMonthRange('2024-01', '2024-03')).toEqual([
        '2024-01',
        '2024-02',
        '2024-03',
      ]);
    });

    it('年をまたぐ範囲を生成', () => {
      expect(generateMonthRange('2023-11', '2024-02')).toEqual([
        '2023-11',
        '2023-12',
        '2024-01',
        '2024-02',
      ]);
    });

    it('1年間の範囲を生成', () => {
      const result = generateMonthRange('2024-01', '2024-12');
      expect(result).toHaveLength(12);
      expect(result[0]).toBe('2024-01');
      expect(result[11]).toBe('2024-12');
    });
  });

  describe('異常系: 不正な入力', () => {
    it('不正なフォーマットの場合はValidationErrorをスロー', () => {
      expect(() => generateMonthRange('2024-1', '2024-03')).toThrow(ValidationError);
      expect(() => generateMonthRange('2024/01', '2024/03')).toThrow(ValidationError);
      expect(() => generateMonthRange('invalid', '2024-03')).toThrow(ValidationError);
    });

    it('開始月が終了月より後の場合はValidationErrorをスロー', () => {
      expect(() => generateMonthRange('2024-03', '2024-01')).toThrow(ValidationError);
      expect(() => generateMonthRange('2024-12', '2023-01')).toThrow(ValidationError);
    });
  });
});

describe('validateYearMonth', () => {
  describe('正常系: 有効なYYYY-MM形式', () => {
    it('2024-01を受け入れる', () => {
      expect(() => validateYearMonth('2024-01')).not.toThrow();
    });

    it('2024-12を受け入れる', () => {
      expect(() => validateYearMonth('2024-12')).not.toThrow();
    });
  });

  describe('異常系: 不正なフォーマット', () => {
    it('YYYY-MM形式でない場合はValidationErrorをスロー', () => {
      expect(() => validateYearMonth('2024-1')).toThrow(ValidationError);
      expect(() => validateYearMonth('2024/01')).toThrow(ValidationError);
      expect(() => validateYearMonth('202401')).toThrow(ValidationError);
    });

    it('月が範囲外（00, 13）の場合はValidationErrorをスロー', () => {
      expect(() => validateYearMonth('2024-00')).toThrow(ValidationError);
      expect(() => validateYearMonth('2024-13')).toThrow(ValidationError);
    });
  });
});

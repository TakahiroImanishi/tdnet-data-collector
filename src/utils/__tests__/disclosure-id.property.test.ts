/**
 * 開示ID生成のプロパティベーステスト
 *
 * Property 4: 開示IDの一意性
 * - 異なる入力は異なるIDを生成
 * - 同じ入力は同じIDを生成
 *
 * Requirements: 要件2.3（開示ID生成）
 */

import * as fc from 'fast-check';
import { generateDisclosureId } from '../disclosure-id';
import { ValidationError } from '../../errors';

describe('generateDisclosureId - Property Tests', () => {
  describe('Property 4: 開示IDの一意性', () => {
    it('異なる入力は異なるIDを生成', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              disclosedAt: fc
                .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
                .map((d) => d.toISOString()),
              companyCode: fc.integer({ min: 1000, max: 9999 }).map(String),
              sequence: fc.integer({ min: 1, max: 999 }),
            }),
            { minLength: 2, maxLength: 100 }
          ),
          (inputs) => {
            const ids = inputs.map((input) =>
              generateDisclosureId(input.disclosedAt, input.companyCode, input.sequence)
            );

            // すべてのIDが一意であることを確認
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('同じ入力は同じIDを生成（冪等性）', () => {
      fc.assert(
        fc.property(
          fc.record({
            disclosedAt: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
              .map((d) => d.toISOString()),
            companyCode: fc.integer({ min: 1000, max: 9999 }).map(String),
            sequence: fc.integer({ min: 1, max: 999 }),
          }),
          (input) => {
            const id1 = generateDisclosureId(input.disclosedAt, input.companyCode, input.sequence);
            const id2 = generateDisclosureId(input.disclosedAt, input.companyCode, input.sequence);

            expect(id1).toBe(id2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('正しいフォーマットでIDを生成', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';
      const companyCode = '1234';
      const sequence = 1;

      const id = generateDisclosureId(disclosedAt, companyCode, sequence);

      expect(id).toBe('20240115_1234_001');
    });

    it('連番を3桁にゼロパディング', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';
      const companyCode = '1234';

      expect(generateDisclosureId(disclosedAt, companyCode, 1)).toBe('20240115_1234_001');
      expect(generateDisclosureId(disclosedAt, companyCode, 10)).toBe('20240115_1234_010');
      expect(generateDisclosureId(disclosedAt, companyCode, 100)).toBe('20240115_1234_100');
      expect(generateDisclosureId(disclosedAt, companyCode, 999)).toBe('20240115_1234_999');
    });

    it('異なる日付で異なるIDを生成', () => {
      const companyCode = '1234';
      const sequence = 1;

      const id1 = generateDisclosureId('2024-01-15T10:30:00Z', companyCode, sequence);
      const id2 = generateDisclosureId('2024-01-16T10:30:00Z', companyCode, sequence);

      expect(id1).not.toBe(id2);
      expect(id1).toBe('20240115_1234_001');
      expect(id2).toBe('20240116_1234_001');
    });

    it('異なる企業コードで異なるIDを生成', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';
      const sequence = 1;

      const id1 = generateDisclosureId(disclosedAt, '1234', sequence);
      const id2 = generateDisclosureId(disclosedAt, '5678', sequence);

      expect(id1).not.toBe(id2);
      expect(id1).toBe('20240115_1234_001');
      expect(id2).toBe('20240115_5678_001');
    });

    it('異なる連番で異なるIDを生成', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';
      const companyCode = '1234';

      const id1 = generateDisclosureId(disclosedAt, companyCode, 1);
      const id2 = generateDisclosureId(disclosedAt, companyCode, 2);

      expect(id1).not.toBe(id2);
      expect(id1).toBe('20240115_1234_001');
      expect(id2).toBe('20240115_1234_002');
    });
  });

  describe('Validation Tests', () => {
    it('不正な日付フォーマットでエラー', () => {
      expect(() => generateDisclosureId('invalid', '1234', 1)).toThrow(ValidationError);
      expect(() => generateDisclosureId('2024/01/15', '1234', 1)).toThrow(ValidationError);
      expect(() => generateDisclosureId('', '1234', 1)).toThrow(ValidationError);
    });

    it('不正な企業コードでエラー', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';

      expect(() => generateDisclosureId(disclosedAt, '123', 1)).toThrow(ValidationError); // 3桁
      expect(() => generateDisclosureId(disclosedAt, '12345', 1)).toThrow(ValidationError); // 5桁
      expect(() => generateDisclosureId(disclosedAt, 'ABCD', 1)).toThrow(ValidationError); // 非数字
      expect(() => generateDisclosureId(disclosedAt, '', 1)).toThrow(ValidationError); // 空文字
    });

    it('不正な連番でエラー', () => {
      const disclosedAt = '2024-01-15T10:30:00Z';
      const companyCode = '1234';

      expect(() => generateDisclosureId(disclosedAt, companyCode, 0)).toThrow(ValidationError); // 0
      expect(() => generateDisclosureId(disclosedAt, companyCode, -1)).toThrow(ValidationError); // 負数
      expect(() => generateDisclosureId(disclosedAt, companyCode, 1000)).toThrow(ValidationError); // 1000以上
    });
  });

  describe('Edge Cases', () => {
    it('月またぎの日付を正しく処理', () => {
      // UTC: 2024-01-31 23:59:59 → JST: 2024-02-01 08:59:59 (翌日)
      const id1 = generateDisclosureId('2024-01-31T23:59:59Z', '1234', 1);
      // UTC: 2024-02-01 00:00:00 → JST: 2024-02-01 09:00:00 (同日)
      const id2 = generateDisclosureId('2024-02-01T00:00:00Z', '1234', 1);

      // JST基準で日付を抽出するため、両方とも2024-02-01になる
      expect(id1).toBe('20240201_1234_001');
      expect(id2).toBe('20240201_1234_001');
    });

    it('年またぎの日付を正しく処理', () => {
      // UTC: 2023-12-31 23:59:59 → JST: 2024-01-01 08:59:59 (翌年)
      const id1 = generateDisclosureId('2023-12-31T23:59:59Z', '1234', 1);
      // UTC: 2024-01-01 00:00:00 → JST: 2024-01-01 09:00:00 (同日)
      const id2 = generateDisclosureId('2024-01-01T00:00:00Z', '1234', 1);

      // JST基準で日付を抽出するため、両方とも2024-01-01になる
      expect(id1).toBe('20240101_1234_001');
      expect(id2).toBe('20240101_1234_001');
    });

    it('うるう年の日付を正しく処理', () => {
      const id = generateDisclosureId('2024-02-29T12:00:00Z', '1234', 1);
      expect(id).toBe('20240229_1234_001');
    });

    it('タイムゾーン付き日付を正しく処理', () => {
      const id1 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1);
      const id2 = generateDisclosureId('2024-01-15T10:30:00+09:00', '1234', 1);

      // JST基準で日付を抽出
      // UTC 2024-01-15T10:30:00Z → JST 2024-01-15T19:30:00+09:00 → 20240115
      // JST 2024-01-15T10:30:00+09:00 → UTC 2024-01-15T01:30:00Z → JST 2024-01-15T10:30:00+09:00 → 20240115
      expect(id1).toBe('20240115_1234_001');
      expect(id2).toBe('20240115_1234_001');
    });

    it('月またぎのエッジケース（UTC深夜→JST翌日）を正しく処理', () => {
      // UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01T00:30:00+09:00
      // UTCでは1月31日だが、JSTでは2月1日になる
      const id = generateDisclosureId('2024-01-31T15:30:00Z', '1234', 1);
      expect(id).toBe('20240201_1234_001'); // JST基準で2月1日
    });

    it('年またぎのエッジケース（UTC深夜→JST翌年）を正しく処理', () => {
      // UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01T00:30:00+09:00
      // UTCでは2023年12月31日だが、JSTでは2024年1月1日になる
      const id = generateDisclosureId('2023-12-31T15:30:00Z', '1234', 1);
      expect(id).toBe('20240101_1234_001'); // JST基準で2024年1月1日
    });
  });
});

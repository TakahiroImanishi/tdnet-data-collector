/**
 * Disclosureモデルのプロパティベーステスト
 *
 * Property 3: メタデータの必須フィールド
 * Validates: Requirements 2.1, 2.2
 *
 * 任意の開示情報に対して、toDynamoDBItemが必須フィールドをすべて含むことを検証します。
 */

import * as fc from 'fast-check';
import {
  toDynamoDBItem,
  fromDynamoDBItem,
  validateDisclosure,
  createDisclosure,
  generateDisclosureId,
} from '../disclosure';
import { Disclosure } from '../../types';
import { ValidationError } from '../../errors';

/**
 * Disclosure型のArbitraryジェネレーター
 *
 * fast-checkで使用するランダムなDisclosureを生成します。
 */
const disclosureArbitrary = (): fc.Arbitrary<Disclosure> => {
  return fc.record({
    disclosure_id: fc
      .tuple(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 1000, max: 9999 }),
        fc.integer({ min: 0, max: 999 })
      )
      .map(([date, companyCode, seq]) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        const companyCodeStr = String(companyCode);
        const seqStr = String(seq).padStart(3, '0');
        return `${dateStr}_${companyCodeStr}_${seqStr}`;
      }),
    company_code: fc.integer({ min: 1000, max: 9999 }).map(String),
    company_name: fc.string({ minLength: 1, maxLength: 100 }),
    disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示', 'その他'),
    title: fc.string({ minLength: 1, maxLength: 200 }),
    disclosed_at: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((date) => date.toISOString()),
    pdf_url: fc
      .webUrl()
      .map((url) => `${url}/disclosure.pdf`)
      .filter((url) => url.length <= 500),
    s3_key: fc
      .tuple(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 1000, max: 9999 }),
        fc.integer({ min: 0, max: 999 })
      )
      .map(([date, companyCode, seq]) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        const companyCodeStr = String(companyCode);
        const seqStr = String(seq).padStart(3, '0');
        return `pdfs/${year}/${month}/${dateStr}_${companyCodeStr}_${seqStr}.pdf`;
      }),
    collected_at: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((date) => date.toISOString()),
    date_partition: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map((date) => {
        // JST基準でdate_partitionを生成
        const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
        const year = jstDate.getUTCFullYear();
        const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      }),
  });
};

describe('Disclosure Property Tests', () => {
  describe('Property 3: メタデータの必須フィールド', () => {
    it('toDynamoDBItemは任意のDisclosureに対して必須フィールドをすべて含む', () => {
      fc.assert(
        fc.property(disclosureArbitrary(), (disclosure) => {
          // toDynamoDBItemを実行
          const item = toDynamoDBItem(disclosure);

          // 必須フィールドの存在確認
          const requiredFields = [
            'disclosure_id',
            'company_code',
            'company_name',
            'disclosure_type',
            'title',
            'disclosed_at',
            'pdf_url',
            's3_key',
            'collected_at',
            'date_partition',
          ];

          // すべての必須フィールドが存在することを確認
          for (const field of requiredFields) {
            expect(item[field]).toBeDefined();
            expect(item[field].S).toBeDefined();
            expect(typeof item[field].S).toBe('string');
            expect(item[field].S!.length).toBeGreaterThan(0);
          }

          // フィールド値が元のDisclosureと一致することを確認
          expect(item.disclosure_id.S).toBe(disclosure.disclosure_id);
          expect(item.company_code.S).toBe(disclosure.company_code);
          expect(item.company_name.S).toBe(disclosure.company_name);
          expect(item.disclosure_type.S).toBe(disclosure.disclosure_type);
          expect(item.title.S).toBe(disclosure.title);
          expect(item.disclosed_at.S).toBe(disclosure.disclosed_at);
          expect(item.pdf_url.S).toBe(disclosure.pdf_url);
          expect(item.s3_key.S).toBe(disclosure.s3_key);
          expect(item.collected_at.S).toBe(disclosure.collected_at);
          expect(item.date_partition.S).toBe(disclosure.date_partition);
        }),
        { numRuns: 1000 } // 1000回の反復実行
      );
    });

    it('fromDynamoDBItemは任意のDynamoDBItemに対して必須フィールドをすべて含むDisclosureを返す', () => {
      fc.assert(
        fc.property(disclosureArbitrary(), (disclosure) => {
          // toDynamoDBItem → fromDynamoDBItem のラウンドトリップ
          const item = toDynamoDBItem(disclosure);
          const restored = fromDynamoDBItem(item);

          // 必須フィールドの存在確認
          expect(restored.disclosure_id).toBeDefined();
          expect(restored.company_code).toBeDefined();
          expect(restored.company_name).toBeDefined();
          expect(restored.disclosure_type).toBeDefined();
          expect(restored.title).toBeDefined();
          expect(restored.disclosed_at).toBeDefined();
          expect(restored.pdf_url).toBeDefined();
          expect(restored.s3_key).toBeDefined();
          expect(restored.collected_at).toBeDefined();
          expect(restored.date_partition).toBeDefined();

          // フィールド値が元のDisclosureと一致することを確認
          expect(restored.disclosure_id).toBe(disclosure.disclosure_id);
          expect(restored.company_code).toBe(disclosure.company_code);
          expect(restored.company_name).toBe(disclosure.company_name);
          expect(restored.disclosure_type).toBe(disclosure.disclosure_type);
          expect(restored.title).toBe(disclosure.title);
          expect(restored.disclosed_at).toBe(disclosure.disclosed_at);
          expect(restored.pdf_url).toBe(disclosure.pdf_url);
          expect(restored.s3_key).toBe(disclosure.s3_key);
          expect(restored.collected_at).toBe(disclosure.collected_at);
          expect(restored.date_partition).toBe(disclosure.date_partition);
        }),
        { numRuns: 1000 }
      );
    });

    it('validateDisclosureは必須フィールドが欠落している場合にValidationErrorをスローする', () => {
      fc.assert(
        fc.property(
          disclosureArbitrary(),
          fc.constantFrom(...Object.keys({} as Disclosure)),
          (disclosure, fieldToRemove) => {
            // 1つのフィールドを削除
            const incompleteDisclosure = { ...disclosure };
            delete (incompleteDisclosure as any)[fieldToRemove];

            // validateDisclosureがValidationErrorをスローすることを確認
            expect(() => validateDisclosure(incompleteDisclosure)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 } // フィールド削除のテストは100回で十分
      );
    });
  });

  describe('Property: ラウンドトリップの一貫性', () => {
    it('toDynamoDBItem → fromDynamoDBItem のラウンドトリップで元のDisclosureが復元される', () => {
      fc.assert(
        fc.property(disclosureArbitrary(), (disclosure) => {
          // ラウンドトリップ
          const item = toDynamoDBItem(disclosure);
          const restored = fromDynamoDBItem(item);

          // 完全に一致することを確認
          expect(restored).toEqual(disclosure);
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property: createDisclosureの正確性', () => {
    it('createDisclosureは有効なDisclosureを生成する', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 9999 }).map(String),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom('決算短信', '有価証券報告書', '適時開示', 'その他'),
          fc.string({ minLength: 1, maxLength: 200 }),
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .map((d) => d.toISOString()),
          fc.webUrl().map((url) => `${url}/disclosure.pdf`),
          fc.string({ minLength: 1, maxLength: 200 }),
          (companyCode, companyName, disclosureType, title, disclosedAt, pdfUrl, disclosureId) => {
            // createDisclosureを実行
            const disclosure = createDisclosure({
              disclosure_id: disclosureId,
              company_code: companyCode,
              company_name: companyName,
              disclosure_type: disclosureType,
              title: title,
              disclosed_at: disclosedAt,
              pdf_url: pdfUrl,
              s3_key: `pdfs/${disclosureId}.pdf`,
            });

            // 必須フィールドが存在することを確認
            expect(disclosure.disclosure_id).toBeDefined();
            expect(disclosure.company_code).toBe(companyCode);
            expect(disclosure.company_name).toBe(companyName);
            expect(disclosure.disclosure_type).toBe(disclosureType);
            expect(disclosure.title).toBe(title);
            expect(disclosure.disclosed_at).toBe(disclosedAt);
            expect(disclosure.pdf_url).toBe(pdfUrl);
            expect(disclosure.s3_key).toBeDefined();
            expect(disclosure.collected_at).toBeDefined();
            expect(disclosure.date_partition).toBeDefined();

            // date_partitionがYYYY-MM形式であることを確認
            expect(disclosure.date_partition).toMatch(/^\d{4}-\d{2}$/);

            // collected_atがISO 8601形式であることを確認
            expect(disclosure.collected_at).toMatch(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
            );

            // validateDisclosureが成功することを確認
            expect(() => validateDisclosure(disclosure)).not.toThrow();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 4: 開示IDの一意性', () => {
    it('generateDisclosureIdは異なる入力に対して異なるIDを生成する', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc
                .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
                .map((d) => d.toISOString()),
              fc.integer({ min: 1000, max: 9999 }).map(String),
              fc.integer({ min: 0, max: 999 })
            ),
            { minLength: 2, maxLength: 100 }
          ),
          (inputs) => {
            // すべての入力に対してIDを生成
            const ids = inputs.map(([disclosedAt, companyCode, sequence]) =>
              generateDisclosureId(disclosedAt, companyCode, sequence)
            );

            // 重複を除去
            const uniqueIds = new Set(ids);

            // 異なる入力に対しては異なるIDが生成されることを確認
            // （ただし、同じ日・同じ企業コード・同じ連番の場合は同じIDになる）
            const uniqueInputs = new Set(
              inputs.map(([disclosedAt, companyCode, sequence]) => {
                const date = new Date(disclosedAt);
                const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
                const year = jstDate.getUTCFullYear();
                const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(jstDate.getUTCDate()).padStart(2, '0');
                return `${year}${month}${day}_${companyCode}_${String(sequence).padStart(3, '0')}`;
              })
            );

            // 一意な入力の数と一意なIDの数が一致することを確認
            expect(uniqueIds.size).toBe(uniqueInputs.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('generateDisclosureIdは同じ入力に対して同じIDを生成する（冪等性）', () => {
      fc.assert(
        fc.property(
          fc
            .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
            .map((d) => d.toISOString()),
          fc.integer({ min: 1000, max: 9999 }).map(String),
          fc.integer({ min: 0, max: 999 }),
          (disclosedAt, companyCode, sequence) => {
            // 同じ入力で2回IDを生成
            const id1 = generateDisclosureId(disclosedAt, companyCode, sequence);
            const id2 = generateDisclosureId(disclosedAt, companyCode, sequence);

            // 同じIDが生成されることを確認
            expect(id1).toBe(id2);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});

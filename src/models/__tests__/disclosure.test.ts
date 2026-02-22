/**
 * disclosure.test.ts
 *
 * Disclosureモデルと変換関数のテスト
 *
 * Steering準拠チェック:
 * - 必須フィールドの検証
 * - disclosed_atフォーマット検証
 * - date_partition自動生成
 * - ValidationErrorのスロー
 * - 構造化ログの記録
 */

import {
  validateDisclosure,
  toDynamoDBItem,
  fromDynamoDBItem,
  createDisclosure,
  generateDisclosureId,
} from '../disclosure';
import { Disclosure, DynamoDBItem } from '../../types';
import { ValidationError } from '../../errors';

describe('validateDisclosure', () => {
  const validDisclosure: Disclosure = {
    disclosure_id: '20240115_1234_001',
    company_code: '1234',
    company_name: 'テスト株式会社',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T10:30:00Z',
    pdf_url: 'https://www.release.tdnet.info/inbs/example.pdf',
    pdf_s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
    downloaded_at: '2024-01-15T10:35:00Z',
    date_partition: '2024-01',
  };

  describe('正常系: 有効なDisclosure', () => {
    it('すべての必須フィールドが存在する場合は成功', () => {
      expect(() => validateDisclosure(validDisclosure)).not.toThrow();
    });
  });

  describe('異常系: 必須フィールドの欠落', () => {
    it('disclosure_idが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, disclosure_id: undefined };
      expect(() => validateDisclosure(invalid as any)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid as any)).toThrow(/Missing required fields/);
    });

    it('company_codeが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, company_code: undefined };
      expect(() => validateDisclosure(invalid as any)).toThrow(ValidationError);
    });

    it('disclosed_atが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, disclosed_at: undefined };
      expect(() => validateDisclosure(invalid as any)).toThrow(ValidationError);
    });

    it('date_partitionが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, date_partition: undefined };
      expect(() => validateDisclosure(invalid as any)).toThrow(ValidationError);
    });

    it('複数のフィールドが欠落している場合はすべてのフィールド名を含むエラーをスロー', () => {
      const invalid = {
        ...validDisclosure,
        disclosure_id: undefined,
        company_code: undefined,
      };
      expect(() => validateDisclosure(invalid as any)).toThrow(/disclosure_id/);
      expect(() => validateDisclosure(invalid as any)).toThrow(/company_code/);
    });
  });

  describe('異常系: フォーマット検証', () => {
    it('disclosed_atが不正なフォーマットの場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, disclosed_at: '2024-01-15' };
      expect(() => validateDisclosure(invalid)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid)).toThrow(/Invalid disclosed_at format/);
    });

    it('downloaded_atが不正なフォーマットの場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, downloaded_at: '2024/01/15 10:35:00' };
      expect(() => validateDisclosure(invalid)).toThrow(ValidationError);
    });

    it('company_codeが4桁の数字でない場合はValidationErrorをスロー', () => {
      const invalid1 = { ...validDisclosure, company_code: '123' }; // 3桁
      expect(() => validateDisclosure(invalid1)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid1)).toThrow(/Invalid company_code format/);

      const invalid2 = { ...validDisclosure, company_code: '12345' }; // 5桁
      expect(() => validateDisclosure(invalid2)).toThrow(ValidationError);

      const invalid3 = { ...validDisclosure, company_code: 'ABCD' }; // 英字
      expect(() => validateDisclosure(invalid3)).toThrow(ValidationError);
    });

    it('date_partitionがYYYY-MM形式でない場合はValidationErrorをスロー', () => {
      const invalid1 = { ...validDisclosure, date_partition: '2024-1' }; // 月が1桁
      expect(() => validateDisclosure(invalid1)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid1)).toThrow(/Invalid date_partition format/);

      const invalid2 = { ...validDisclosure, date_partition: '202401' }; // ハイフンなし
      expect(() => validateDisclosure(invalid2)).toThrow(ValidationError);

      const invalid3 = { ...validDisclosure, date_partition: '2024/01' }; // スラッシュ
      expect(() => validateDisclosure(invalid3)).toThrow(ValidationError);
    });

    it('file_sizeが100MBを超える場合はValidationErrorをスロー', () => {
      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      const invalid = { ...validDisclosure, file_size: MAX_FILE_SIZE + 1 };
      expect(() => validateDisclosure(invalid)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid)).toThrow(/Invalid file_size range/);
    });

    it('file_sizeが負の値の場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, file_size: -1 };
      expect(() => validateDisclosure(invalid)).toThrow(ValidationError);
      expect(() => validateDisclosure(invalid)).toThrow(/Invalid file_size range/);
    });

    it('file_sizeが10MB以下の場合は成功', () => {
      const valid1 = { ...validDisclosure, file_size: 0 };
      expect(() => validateDisclosure(valid1)).not.toThrow();

      const valid2 = { ...validDisclosure, file_size: 5 * 1024 * 1024 }; // 5MB
      expect(() => validateDisclosure(valid2)).not.toThrow();

      const valid3 = { ...validDisclosure, file_size: 10 * 1024 * 1024 }; // 10MB（境界値）
      expect(() => validateDisclosure(valid3)).not.toThrow();
    });

    it('file_sizeがundefinedまたはnullの場合はバリデーションをスキップ', () => {
      const valid1 = { ...validDisclosure, file_size: undefined };
      expect(() => validateDisclosure(valid1)).not.toThrow();

      const valid2 = { ...validDisclosure, file_size: null };
      expect(() => validateDisclosure(valid2 as any)).not.toThrow();
    });
  });
});

describe('toDynamoDBItem', () => {
  const validDisclosure: Disclosure = {
    disclosure_id: '20240115_1234_001',
    company_code: '1234',
    company_name: 'テスト株式会社',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T10:30:00Z',
    pdf_url: 'https://www.release.tdnet.info/inbs/example.pdf',
    pdf_s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
    downloaded_at: '2024-01-15T10:35:00Z',
    date_partition: '2024-01',
  };

  describe('正常系: DynamoDBアイテムへの変換', () => {
    it('有効なDisclosureをDynamoDBアイテムに変換', () => {
      const item = toDynamoDBItem(validDisclosure);

      expect(item.disclosure_id.S).toBe('20240115_1234_001');
      expect(item.company_code.S).toBe('1234');
      expect(item.company_name.S).toBe('テスト株式会社');
      expect(item.disclosure_type.S).toBe('決算短信');
      expect(item.title.S).toBe('2024年3月期 第3四半期決算短信');
      expect(item.disclosed_at.S).toBe('2024-01-15T10:30:00Z');
      expect(item.pdf_url?.S).toBe('https://www.release.tdnet.info/inbs/example.pdf');
      expect(item.pdf_s3_key?.S).toBe('pdfs/2024/01/20240115_1234_001.pdf');
      expect(item.downloaded_at.S).toBe('2024-01-15T10:35:00Z');
      expect(item.date_partition.S).toBe('2024-01');
    });
  });

  describe('異常系: バリデーションエラー', () => {
    it('不正なDisclosureの場合はValidationErrorをスロー', () => {
      const invalid = { ...validDisclosure, company_code: '123' };
      expect(() => toDynamoDBItem(invalid)).toThrow(ValidationError);
    });
  });
});

describe('fromDynamoDBItem', () => {
  const validItem: DynamoDBItem = {
    disclosure_id: { S: '20240115_1234_001' },
    company_code: { S: '1234' },
    company_name: { S: 'テスト株式会社' },
    disclosure_type: { S: '決算短信' },
    title: { S: '2024年3月期 第3四半期決算短信' },
    disclosed_at: { S: '2024-01-15T10:30:00Z' },
    pdf_url: { S: 'https://www.release.tdnet.info/inbs/example.pdf' },
    pdf_s3_key: { S: 'pdfs/2024/01/20240115_1234_001.pdf' },
    downloaded_at: { S: '2024-01-15T10:35:00Z' },
    date_partition: { S: '2024-01' },
  };

  describe('正常系: DynamoDBアイテムからDisclosureへの変換', () => {
    it('有効なDynamoDBアイテムをDisclosureに変換', () => {
      const disclosure = fromDynamoDBItem(validItem);

      expect(disclosure.disclosure_id).toBe('20240115_1234_001');
      expect(disclosure.company_code).toBe('1234');
      expect(disclosure.company_name).toBe('テスト株式会社');
      expect(disclosure.disclosure_type).toBe('決算短信');
      expect(disclosure.title).toBe('2024年3月期 第3四半期決算短信');
      expect(disclosure.disclosed_at).toBe('2024-01-15T10:30:00Z');
      expect(disclosure.pdf_url).toBe('https://www.release.tdnet.info/inbs/example.pdf');
      expect(disclosure.pdf_s3_key).toBe('pdfs/2024/01/20240115_1234_001.pdf');
      expect(disclosure.downloaded_at).toBe('2024-01-15T10:35:00Z');
      expect(disclosure.date_partition).toBe('2024-01');
    });
  });

  describe('異常系: 必須フィールドの欠落', () => {
    it('disclosure_idが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validItem };
      delete invalid.disclosure_id;
      expect(() => fromDynamoDBItem(invalid)).toThrow(ValidationError);
      expect(() => fromDynamoDBItem(invalid)).toThrow(/Missing required fields/);
    });

    it('date_partitionが欠落している場合はValidationErrorをスロー', () => {
      const invalid = { ...validItem };
      delete invalid.date_partition;
      expect(() => fromDynamoDBItem(invalid)).toThrow(ValidationError);
    });
  });

  describe('エッジケース: nullish coalescing演算子のテスト', () => {
    it('DynamoDBアイテムのフィールドがundefinedの場合は空文字列にフォールバック', () => {
      // フィールドが存在するが、Sプロパティがundefinedの場合
      const itemWithUndefined: DynamoDBItem = {
        disclosure_id: { S: '20240115_1234_001' },
        company_code: { S: '1234' },
        company_name: { S: 'テスト株式会社' },
        disclosure_type: { S: '決算短信' },
        title: { S: '2024年3月期 第3四半期決算短信' },
        disclosed_at: { S: '2024-01-15T10:30:00Z' },
        pdf_url: { S: 'https://example.com/pdf.pdf' },
        pdf_s3_key: { S: 'pdfs/2024/01/20240115_1234_001.pdf' },
        downloaded_at: { S: undefined as any }, // Sがundefined（必須フィールド）
        date_partition: { S: '2024-01' },
      };

      // 必須フィールドのdownloaded_atがundefinedなのでバリデーションエラー
      expect(() => fromDynamoDBItem(itemWithUndefined)).toThrow(ValidationError);
    });

    it('すべてのフィールドのSプロパティがundefinedの場合は空文字列にフォールバック', () => {
      const itemAllUndefined: DynamoDBItem = {
        disclosure_id: { S: undefined as any },
        company_code: { S: undefined as any },
        company_name: { S: undefined as any },
        disclosure_type: { S: undefined as any },
        title: { S: undefined as any },
        disclosed_at: { S: undefined as any },
        pdf_url: { S: undefined as any },
        pdf_s3_key: { S: undefined as any },
        downloaded_at: { S: undefined as any },
        date_partition: { S: undefined as any },
      };

      // すべて空文字列になり、バリデーションエラーになることを確認
      expect(() => fromDynamoDBItem(itemAllUndefined)).toThrow(ValidationError);
    });

    it('一部のフィールドのSプロパティがundefinedの場合', () => {
      const itemPartialUndefined: DynamoDBItem = {
        disclosure_id: { S: '20240115_1234_001' },
        company_code: { S: undefined as any },
        company_name: { S: 'テスト株式会社' },
        disclosure_type: { S: undefined as any },
        title: { S: '2024年3月期 第3四半期決算短信' },
        disclosed_at: { S: '2024-01-15T10:30:00Z' },
        pdf_url: { S: 'https://www.release.tdnet.info/inbs/example.pdf' },
        pdf_s3_key: { S: undefined as any },
        downloaded_at: { S: '2024-01-15T10:35:00Z' },
        date_partition: { S: '2024-01' },
      };

      // 空文字列になったフィールドがあり、バリデーションエラーになることを確認
      expect(() => fromDynamoDBItem(itemPartialUndefined)).toThrow(ValidationError);
    });

    it('Sプロパティがnullの場合も空文字列にフォールバック', () => {
      const itemWithNull: DynamoDBItem = {
        disclosure_id: { S: '20240115_1234_001' },
        company_code: { S: '1234' },
        company_name: { S: null as any },
        disclosure_type: { S: '決算短信' },
        title: { S: '2024年3月期 第3四半期決算短信' },
        disclosed_at: { S: '2024-01-15T10:30:00Z' },
        pdf_url: { S: 'https://www.release.tdnet.info/inbs/example.pdf' },
        pdf_s3_key: { S: 'pdfs/2024/01/20240115_1234_001.pdf' },
        downloaded_at: { S: '2024-01-15T10:35:00Z' },
        date_partition: { S: '2024-01' },
      };

      // nullも空文字列になり、バリデーションエラーになることを確認
      expect(() => fromDynamoDBItem(itemWithNull)).toThrow(ValidationError);
    });

    it('複数のフィールドがnullまたはundefinedの場合', () => {
      const itemMixed: DynamoDBItem = {
        disclosure_id: { S: '20240115_1234_001' },
        company_code: { S: null as any },
        company_name: { S: undefined as any },
        disclosure_type: { S: '決算短信' },
        title: { S: null as any },
        disclosed_at: { S: '2024-01-15T10:30:00Z' },
        pdf_url: { S: undefined as any },
        pdf_s3_key: { S: 'pdfs/2024/01/20240115_1234_001.pdf' },
        downloaded_at: { S: null as any },
        date_partition: { S: '2024-01' },
      };

      // すべて空文字列になり、バリデーションエラーになることを確認
      expect(() => fromDynamoDBItem(itemMixed)).toThrow(ValidationError);
    });
  });
});

describe('createDisclosure', () => {
  const baseParams = {
    disclosure_id: '20240115_1234_001',
    company_code: '1234',
    company_name: 'テスト株式会社',
    disclosure_type: '決算短信',
    title: '2024年3月期 第3四半期決算短信',
    disclosed_at: '2024-01-15T10:30:00Z',
    pdf_url: 'https://www.release.tdnet.info/inbs/example.pdf',
    pdf_s3_key: 'pdfs/2024/01/20240115_1234_001.pdf',
  };

  describe('正常系: date_partitionの自動生成', () => {
    it('date_partitionが指定されていない場合は自動生成', () => {
      const disclosure = createDisclosure(baseParams);

      expect(disclosure.date_partition).toBe('2024-01');
      expect(disclosure.downloaded_at).toBeDefined();
      expect(disclosure.downloaded_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('date_partitionが指定されている場合はそれを使用', () => {
      const disclosure = createDisclosure({
        ...baseParams,
        date_partition: '2024-02',
      });

      expect(disclosure.date_partition).toBe('2024-02');
    });

    it('downloaded_atが指定されている場合はそれを使用', () => {
      const disclosure = createDisclosure({
        ...baseParams,
        downloaded_at: '2024-01-15T10:35:00Z',
      });

      expect(disclosure.downloaded_at).toBe('2024-01-15T10:35:00Z');
    });
  });

  describe('正常系: JST基準でdate_partitionを生成', () => {
    it('UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01 → date_partition: "2024-02"', () => {
      const disclosure = createDisclosure({
        ...baseParams,
        disclosed_at: '2024-01-31T15:30:00Z',
      });

      expect(disclosure.date_partition).toBe('2024-02');
    });

    it('UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01 → date_partition: "2024-01"', () => {
      const disclosure = createDisclosure({
        ...baseParams,
        disclosed_at: '2023-12-31T15:30:00Z',
      });

      expect(disclosure.date_partition).toBe('2024-01');
    });
  });

  describe('異常系: バリデーションエラー', () => {
    it('不正なdisclosed_atの場合はValidationErrorをスロー', () => {
      expect(() =>
        createDisclosure({
          ...baseParams,
          disclosed_at: '2024-01-15',
        })
      ).toThrow(ValidationError);
    });

    it('不正なcompany_codeの場合はValidationErrorをスロー', () => {
      expect(() =>
        createDisclosure({
          ...baseParams,
          company_code: '123',
        })
      ).toThrow(ValidationError);
    });
  });
});

describe('generateDisclosureId', () => {
  describe('正常系: 開示IDの生成', () => {
    it('JST基準で日付を抽出してIDを生成', () => {
      const id = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1);
      expect(id).toBe('20240115_1234_001');
    });

    it('連番を3桁にゼロパディング', () => {
      const id1 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 0);
      expect(id1).toBe('20240115_1234_000');

      const id2 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 99);
      expect(id2).toBe('20240115_1234_099');

      const id3 = generateDisclosureId('2024-01-15T10:30:00Z', '1234', 999);
      expect(id3).toBe('20240115_1234_999');
    });
  });

  describe('エッジケース: 月またぎ（UTC→JST変換）', () => {
    it('UTC: 2024-01-31T15:30:00Z → JST: 2024-02-01 → ID: 20240201_xxxx_xxx', () => {
      const id = generateDisclosureId('2024-01-31T15:30:00Z', '1234', 1);
      expect(id).toBe('20240201_1234_001');
    });

    it('UTC: 2023-12-31T15:30:00Z → JST: 2024-01-01 → ID: 20240101_xxxx_xxx', () => {
      const id = generateDisclosureId('2023-12-31T15:30:00Z', '1234', 1);
      expect(id).toBe('20240101_1234_001');
    });
  });

  describe('異常系: バリデーションエラー', () => {
    it('不正なdisclosed_atの場合はValidationErrorをスロー', () => {
      expect(() => generateDisclosureId('2024-01-15', '1234', 1)).toThrow(ValidationError);
      expect(() => generateDisclosureId('invalid-date', '1234', 1)).toThrow(ValidationError);
    });

    it('不正なcompany_codeの場合はValidationErrorをスロー', () => {
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '123', 1)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '123456', 1)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', 'ABC', 1)).toThrow(
        ValidationError
      );
    });

    it('不正なsequenceの場合はValidationErrorをスロー', () => {
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '1234', -1)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '1234', 1.5)).toThrow(
        ValidationError
      );
      expect(() => generateDisclosureId('2024-01-15T10:30:00Z', '1234', NaN)).toThrow(
        ValidationError
      );
    });
  });
});

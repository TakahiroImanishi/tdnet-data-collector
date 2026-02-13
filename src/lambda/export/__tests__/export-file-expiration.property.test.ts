/**
 * Property 10: エクスポートファイルの有効期限
 *
 * Validates: Requirements 7.2, 12.4
 * エクスポートファイルに7日後の自動削除ライフサイクルポリシーが適用されることを確認
 *
 * Requirements: 要件14.2（プロパティテスト）
 */

import * as fc from 'fast-check';
import { exportToS3 } from '../export-to-s3';
import { Disclosure } from '../../../types';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

// モック
jest.mock('../../../utils/logger');
jest.mock('../../../utils/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
}));

describe('Property 10: エクスポートファイルの有効期限', () => {
  const s3Mock = mockClient(S3Client);

  beforeEach(() => {
    s3Mock.reset();
    process.env.EXPORT_BUCKET_NAME = 'test-exports-bucket';
    process.env.AWS_REGION = 'ap-northeast-1';

    // S3Client.send のモック - PutObjectCommandを正しくキャプチャ
    s3Mock.on(PutObjectCommand).resolves({});
  });

  /**
   * Property: すべてのエクスポートファイルに auto-delete タグが設定される
   *
   * このプロパティは、エクスポートファイルがS3にアップロードされる際に、
   * 必ず auto-delete=true タグが設定されることを検証します。
   * このタグは、S3ライフサイクルポリシーによって7日後に自動削除されるために使用されます。
   */
  it('Property: すべてのエクスポートファイルに auto-delete タグが設定される', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary: エクスポートID
        fc.string({ minLength: 10, maxLength: 50 }),
        // Arbitrary: フォーマット（json または csv）
        fc.constantFrom('json' as const, 'csv' as const),
        // Arbitrary: 開示情報のリスト（0〜100件）
        fc.array(
          fc.record({
            disclosure_id: fc.string({ minLength: 10, maxLength: 20 }),
            company_code: fc.string({ minLength: 4, maxLength: 4 }).map(s => s.replace(/[^0-9]/g, '0')),
            company_name: fc.string({ minLength: 1, maxLength: 100 }),
            disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示'),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            disclosed_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            pdf_url: fc.webUrl(),
            s3_key: fc.string({ minLength: 10, maxLength: 100 }),
            collected_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            date_partition: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                return `${year}-${month}`;
              }),
          }),
          { minLength: 0, maxLength: 100 }
        ),
        async (export_id, format, disclosures) => {
          // Arrange
          s3Mock.reset();
          s3Mock.on(PutObjectCommand).resolves({});

          // Act
          await exportToS3(export_id, disclosures as Disclosure[], format);

          // Assert
          expect(s3Mock.calls()).toHaveLength(1);
          const call = s3Mock.call(0);
          
          // PutObjectCommandのinputプロパティにアクセス
          expect(call.args[0].input).toBeDefined();
          expect((call.args[0].input as any).Tagging).toBe('auto-delete=true');
        }
      ),
      {
        numRuns: 100, // 100回のランダムテストを実行
        verbose: true,
      }
    );
  });

  /**
   * Property: S3キーが正しいフォーマットで生成される
   *
   * このプロパティは、エクスポートファイルのS3キーが常に正しいフォーマット
   * （exports/YYYY/MM/DD/export_id.format）で生成されることを検証します。
   */
  it('Property: S3キーが正しいフォーマットで生成される', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary: エクスポートID（英数字とハイフンのみ、スラッシュや特殊文字を除外）
        fc.stringMatching(/^[a-zA-Z0-9_-]{10,50}$/),
        // Arbitrary: フォーマット（json または csv）
        fc.constantFrom('json' as const, 'csv' as const),
        // Arbitrary: 開示情報のリスト（0〜10件、パフォーマンスのため少なめ）
        fc.array(
          fc.record({
            disclosure_id: fc.string({ minLength: 10, maxLength: 20 }),
            company_code: fc.string({ minLength: 4, maxLength: 4 }).map(s => s.replace(/[^0-9]/g, '0')),
            company_name: fc.string({ minLength: 1, maxLength: 100 }),
            disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示'),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            disclosed_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            pdf_url: fc.webUrl(),
            s3_key: fc.string({ minLength: 10, maxLength: 100 }),
            collected_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            date_partition: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                return `${year}-${month}`;
              }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (export_id, format, disclosures) => {
          // Act
          const s3_key = await exportToS3(export_id, disclosures as Disclosure[], format);

          // Assert
          // Property: S3キーが正しいフォーマット（exports/YYYY/MM/DD/export_id.format）
          const s3KeyRegex = new RegExp(
            `^exports/\\d{4}/\\d{2}/\\d{2}/[^/]+\\.${format}$`
          );
          expect(s3_key).toMatch(s3KeyRegex);
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  /**
   * Property: ContentTypeが正しく設定される
   *
   * このプロパティは、エクスポートファイルのContentTypeが
   * フォーマットに応じて正しく設定されることを検証します。
   * - JSON: application/json
   * - CSV: text/csv
   */
  it('Property: ContentTypeが正しく設定される', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary: エクスポートID
        fc.string({ minLength: 10, maxLength: 50 }),
        // Arbitrary: フォーマット（json または csv）
        fc.constantFrom('json' as const, 'csv' as const),
        // Arbitrary: 開示情報のリスト（0〜10件）
        fc.array(
          fc.record({
            disclosure_id: fc.string({ minLength: 10, maxLength: 20 }),
            company_code: fc.string({ minLength: 4, maxLength: 4 }).map(s => s.replace(/[^0-9]/g, '0')),
            company_name: fc.string({ minLength: 1, maxLength: 100 }),
            disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示'),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            disclosed_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            pdf_url: fc.webUrl(),
            s3_key: fc.string({ minLength: 10, maxLength: 100 }),
            collected_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => d.toISOString()),
            date_partition: fc
              .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              .map((d) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                return `${year}-${month}`;
              }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (export_id, format, disclosures) => {
          // Arrange
          s3Mock.reset();
          s3Mock.on(PutObjectCommand).resolves({});

          // Act
          await exportToS3(export_id, disclosures as Disclosure[], format);

          // Assert
          expect(s3Mock.calls()).toHaveLength(1);
          const call = s3Mock.call(0);
          
          // PutObjectCommandのinputプロパティにアクセス
          expect(call.args[0].input).toBeDefined();
          const contentType = (call.args[0].input as any).ContentType;

          // Property: ContentTypeが正しく設定されている
          const expectedContentType = format === 'json' ? 'application/json' : 'text/csv';
          expect(contentType).toBe(expectedContentType);
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  /**
   * Property: CSV形式の場合、カンマを含む値が正しくエスケープされる
   *
   * このプロパティは、CSV形式でエクスポートする際に、
   * カンマを含む値が正しくダブルクォートで囲まれることを検証します。
   */
  it('Property: CSV形式の場合、カンマを含む値が正しくエスケープされる', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary: エクスポートID（英数字とハイフンのみ）
        fc.stringMatching(/^[a-zA-Z0-9_-]{10,50}$/),
        // Arbitrary: カンマを含むタイトル（ダブルクォートを除外）
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('"')).map((s) => `${s}, カンマ含む`),
        async (export_id, titleWithComma) => {
          // Arrange
          const disclosures: Disclosure[] = [
            {
              disclosure_id: '20240115_1234_001',
              company_code: '1234',
              company_name: 'テスト株式会社',
              disclosure_type: '決算短信',
              title: titleWithComma,
              disclosed_at: '2024-01-15T10:30:00Z',
              pdf_url: 'https://example.com/pdf/20240115_1234_001.pdf',
              s3_key: 'pdfs/2024/01/15/20240115_1234_001.pdf',
              collected_at: '2024-01-15T10:35:00Z',
              date_partition: '2024-01',
            },
          ];

          // Arrange
          s3Mock.reset();
          s3Mock.on(PutObjectCommand).resolves({});

          // Act
          await exportToS3(export_id, disclosures, 'csv');

          // Assert
          expect(s3Mock.calls()).toHaveLength(1);
          const call = s3Mock.call(0);
          
          // PutObjectCommandのinputプロパティにアクセス
          expect(call.args[0].input).toBeDefined();
          const body = (call.args[0].input as any).Body;
          const lines = body.split('\n');

          // Property: カンマを含む値がダブルクォートで囲まれている
          expect(lines[1]).toContain(`"${titleWithComma}"`);
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });
});

/**
 * 重複収集の冪等性テスト
 *
 * Property 5: 重複収集の冪等性
 * Validates: Requirements 2.4
 *
 * 同じ開示情報を複数回保存しても、DynamoDBには1件のみ保存されることを検証します。
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import * as fc from 'fast-check';
import { saveMetadata } from '../save-metadata';
import { Disclosure } from '../../../types';
import { logger } from '../../../utils/logger';

const dynamoMock = mockClient(DynamoDBClient);

describe('Property 5: 重複収集の冪等性', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_TABLE = 'test-table';
    
    // logger.warnのモック
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'info').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ユニットテスト', () => {
    it('同じ開示情報を2回保存しても1件のみ保存される', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        s3_key: '',
        collected_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      // 1回目は成功
      dynamoMock.on(PutItemCommand).resolvesOnce({});

      // 2回目は重複エラー
      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutItemCommand).rejectsOnce(conditionalCheckError);

      // Act
      await saveMetadata(disclosure, s3_key); // 1回目
      await saveMetadata(disclosure, s3_key); // 2回目（重複）

      // Assert
      expect(dynamoMock.calls()).toHaveLength(2);
      // 両方とも正常終了（2回目は警告ログのみ）
    });

    it('重複時に警告ログが出力される', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        s3_key: '',
        collected_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutItemCommand).rejects(conditionalCheckError);

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith('Duplicate disclosure detected', {
        disclosure_id: 'TD20240115001',
        s3_key: '2024/01/15/TD20240115001.pdf',
      });
    });

    it('異なる開示IDは両方とも保存される', async () => {
      // Arrange
      const disclosure1: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        s3_key: '',
        collected_at: '',
        date_partition: '',
      };

      const disclosure2: Disclosure = {
        disclosure_id: 'TD20240115002', // 異なるID
        company_code: '5678',
        company_name: '株式会社別会社',
        disclosure_type: '有価証券報告書',
        title: '2024年3月期 有価証券報告書',
        disclosed_at: '2024-01-15T11:00:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115002.pdf',
        s3_key: '',
        collected_at: '',
        date_partition: '',
      };

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure1, '2024/01/15/TD20240115001.pdf');
      await saveMetadata(disclosure2, '2024/01/15/TD20240115002.pdf');

      // Assert
      expect(dynamoMock.calls()).toHaveLength(2);
      // 両方とも成功
    });
  });

  describe('プロパティベーステスト', () => {
    it('任意の開示情報を2回保存しても冪等性が保たれる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            disclosure_id: fc.string({ minLength: 10, maxLength: 20 }),
            company_code: fc.string({ minLength: 4, maxLength: 4 }),
            company_name: fc.string({ minLength: 1, maxLength: 100 }),
            disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示'),
            title: fc.string({ minLength: 1, maxLength: 200 }),
            disclosed_at: fc
              .date({ min: new Date('2020-01-01'), max: new Date() })
              .map((d) => d.toISOString()),
            pdf_url: fc.webUrl(),
          }),
          async (disclosureData) => {
            // Arrange
            dynamoMock.reset();
            const disclosure: Disclosure = {
              ...disclosureData,
              s3_key: '',
              collected_at: '',
              date_partition: '',
            };
            const s3_key = `2024/01/15/${disclosure.disclosure_id}.pdf`;

            // 1回目は成功
            dynamoMock.on(PutItemCommand).resolvesOnce({});

            // 2回目は重複エラー
            const conditionalCheckError = new Error('ConditionalCheckFailedException');
            conditionalCheckError.name = 'ConditionalCheckFailedException';
            dynamoMock.on(PutItemCommand).rejectsOnce(conditionalCheckError);

            // Act & Assert
            await expect(saveMetadata(disclosure, s3_key)).resolves.toBeUndefined();
            await expect(saveMetadata(disclosure, s3_key)).resolves.toBeUndefined();

            // 両方とも正常終了（エラーをスローしない）
            expect(dynamoMock.calls()).toHaveLength(2);
          }
        ),
        { numRuns: 100 } // 100回反復
      );
    });

    it('複数の異なる開示情報を保存しても、それぞれ1件のみ保存される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              disclosure_id: fc.string({ minLength: 10, maxLength: 20 }),
              company_code: fc.string({ minLength: 4, maxLength: 4 }),
              company_name: fc.string({ minLength: 1, maxLength: 100 }),
              disclosure_type: fc.constantFrom('決算短信', '有価証券報告書', '適時開示'),
              title: fc.string({ minLength: 1, maxLength: 200 }),
              disclosed_at: fc
                .date({ min: new Date('2020-01-01'), max: new Date() })
                .map((d) => d.toISOString()),
              pdf_url: fc.webUrl(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (disclosuresData) => {
            // Arrange
            dynamoMock.reset();
            dynamoMock.on(PutItemCommand).resolves({});

            // Act
            for (const disclosureData of disclosuresData) {
              const disclosure: Disclosure = {
                ...disclosureData,
                s3_key: '',
                collected_at: '',
                date_partition: '',
              };
              const s3_key = `2024/01/15/${disclosure.disclosure_id}.pdf`;
              await saveMetadata(disclosure, s3_key);
            }

            // Assert
            expect(dynamoMock.calls()).toHaveLength(disclosuresData.length);
          }
        ),
        { numRuns: 100 } // 100回反復
      );
    });
  });
});

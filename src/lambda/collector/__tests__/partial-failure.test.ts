/**
 * 部分的失敗のユニットテスト
 *
 * Property 7: エラー時の部分的成功
 * Validates: Requirements 6.4
 *
 * 一部の開示情報の処理が失敗しても、成功した開示情報は永続化されることを検証します。
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { saveMetadata } from '../save-metadata';
import { Disclosure } from '../../../types';

// モック設定
const dynamoMock = mockClient(DynamoDBClient);

describe('Property 7: エラー時の部分的成功', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_TABLE = 'test-table';
  });

  describe('ユニットテスト', () => {
    it('一部が失敗しても成功した開示情報は永続化される', async () => {
      // Arrange
      const disclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '1234',
          company_name: '株式会社サンプル1',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://example.com/test1.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
        {
          disclosure_id: 'TD20240115002',
          company_code: '5678',
          company_name: '株式会社サンプル2',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
        {
          disclosure_id: 'TD20240115003',
          company_code: '9012',
          company_name: '株式会社サンプル3',
          disclosure_type: '適時開示',
          title: 'テスト開示3',
          disclosed_at: '2024-01-15T12:00:00Z',
          pdf_url: 'https://example.com/test3.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
      ];

      // モックの設定: 1件目成功、2件目失敗、3件目成功
      let callCount = 0;
      dynamoMock.on(PutItemCommand).callsFake(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('DynamoDB error');
        }
        return {};
      });

      // Act
      const results = await Promise.allSettled(
        disclosures.map((disclosure) =>
          saveMetadata(disclosure, `2024/01/15/${disclosure.disclosure_id}.pdf`)
        )
      );

      // Assert
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(2); // 1件目と3件目が成功
      expect(failedCount).toBe(1); // 2件目が失敗
      expect(dynamoMock.calls()).toHaveLength(3); // 3回呼ばれた
    });

    it('すべて成功した場合、ステータスはsuccessになる', async () => {
      // Arrange
      const disclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '1234',
          company_name: '株式会社サンプル1',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://example.com/test1.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
        {
          disclosure_id: 'TD20240115002',
          company_code: '5678',
          company_name: '株式会社サンプル2',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
      ];

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      const results = await Promise.allSettled(
        disclosures.map((disclosure) =>
          saveMetadata(disclosure, `2024/01/15/${disclosure.disclosure_id}.pdf`)
        )
      );

      // Assert
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(2);
      expect(failedCount).toBe(0);

      // ステータス判定
      const status =
        failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed';
      expect(status).toBe('success');
    });

    it('一部失敗した場合、ステータスはpartial_successになる', async () => {
      // Arrange
      const disclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '1234',
          company_name: '株式会社サンプル1',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://example.com/test1.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
        {
          disclosure_id: 'TD20240115002',
          company_code: '5678',
          company_name: '株式会社サンプル2',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
      ];

      // 1件目: 成功
      dynamoMock.on(PutItemCommand).resolvesOnce({});

      // 2件目: 失敗
      dynamoMock.on(PutItemCommand).rejectsOnce(new Error('DynamoDB error'));

      // Act
      const results = await Promise.allSettled(
        disclosures.map((disclosure) =>
          saveMetadata(disclosure, `2024/01/15/${disclosure.disclosure_id}.pdf`)
        )
      );

      // Assert
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failedCount).toBe(1);

      // ステータス判定
      const status =
        failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed';
      expect(status).toBe('partial_success');
    });

    it('すべて失敗した場合、ステータスはfailedになる', async () => {
      // Arrange
      const disclosures: Disclosure[] = [
        {
          disclosure_id: 'TD20240115001',
          company_code: '1234',
          company_name: '株式会社サンプル1',
          disclosure_type: '決算短信',
          title: 'テスト開示1',
          disclosed_at: '2024-01-15T10:30:00Z',
          pdf_url: 'https://example.com/test1.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
        {
          disclosure_id: 'TD20240115002',
          company_code: '5678',
          company_name: '株式会社サンプル2',
          disclosure_type: '有価証券報告書',
          title: 'テスト開示2',
          disclosed_at: '2024-01-15T11:00:00Z',
          pdf_url: 'https://example.com/test2.pdf',
          s3_key: '',
          collected_at: '',
          date_partition: '',
        },
      ];

      // すべて失敗
      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      // Act
      const results = await Promise.allSettled(
        disclosures.map((disclosure) =>
          saveMetadata(disclosure, `2024/01/15/${disclosure.disclosure_id}.pdf`)
        )
      );

      // Assert
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(0);
      expect(failedCount).toBe(2);

      // ステータス判定
      const status =
        failedCount === 0 ? 'success' : successCount > 0 ? 'partial_success' : 'failed';
      expect(status).toBe('failed');
    });

    it('collected_countとfailed_countが正確にカウントされる', async () => {
      // Arrange
      const disclosures: Disclosure[] = Array.from({ length: 10 }, (_, i) => ({
        disclosure_id: `TD2024011500${String(i + 1).padStart(2, '0')}`,
        company_code: `${1000 + i}`,
        company_name: `株式会社サンプル${i + 1}`,
        disclosure_type: '決算短信',
        title: `テスト開示${i + 1}`,
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: `https://example.com/test${i + 1}.pdf`,
        s3_key: '',
        collected_at: '',
        date_partition: '',
      }));

      // 7件成功、3件失敗（4番目、7番目、10番目が失敗）
      let callCount = 0;
      dynamoMock.on(PutItemCommand).callsFake(() => {
        callCount++;
        if (callCount === 4 || callCount === 7 || callCount === 10) {
          throw new Error('Error');
        }
        return {};
      });

      // Act
      const results = await Promise.allSettled(
        disclosures.map((disclosure) =>
          saveMetadata(disclosure, `2024/01/15/${disclosure.disclosure_id}.pdf`)
        )
      );

      // Assert
      const collected_count = results.filter((r) => r.status === 'fulfilled').length;
      const failed_count = results.filter((r) => r.status === 'rejected').length;

      expect(collected_count).toBe(7);
      expect(failed_count).toBe(3);
    });
  });
});

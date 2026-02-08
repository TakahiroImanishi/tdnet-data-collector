/**
 * Update Export Status Unit Tests
 *
 * Requirements: 要件14.1（ユニットテスト）
 */

// モック設定（importより前に定義）
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actualModule = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actualModule,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
  };
});

jest.mock('../../../utils/logger');
jest.mock('../../../utils/retry', () => ({
  retryWithBackoff: jest.fn((fn) => fn()), // retryをバイパス
}));

import { updateExportStatus } from '../update-export-status';
import { UpdateItemCommand } from '@aws-sdk/client-dynamodb';

describe('updateExportStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    mockSend.mockResolvedValue({
      $metadata: { httpStatusCode: 200 },
      Attributes: {},
    });

    process.env.EXPORT_STATUS_TABLE_NAME = 'test-export-status-table';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  describe('正常系: ステータス更新', () => {
    it('pending → processing への更新が正常に実行される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_abc123_12345678';
      const status = 'processing';
      const progress = 10;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.TableName).toBe('test-export-status-table');
      expect(command.input.Key).toEqual({
        export_id: { S: export_id },
      });

      // UpdateExpressionの検証
      expect(command.input.UpdateExpression).toContain('#status = :status');
      expect(command.input.UpdateExpression).toContain('#progress = :progress');
      expect(command.input.UpdateExpression).not.toContain('#completed_at');

      // ExpressionAttributeValuesの検証
      expect(command.input.ExpressionAttributeValues).toEqual({
        ':status': { S: 'processing' },
        ':progress': { N: '10' },
      });
    });

    it('processing → completed への更新が正常に実行される（s3_key, download_url付き）', async () => {
      // Arrange
      const export_id = 'export_1705305600000_def456_87654321';
      const status = 'completed';
      const progress = 100;
      const s3_key = 'exports/2024/01/15/export_1705305600000_def456_87654321.json';
      const download_url = 'https://s3.amazonaws.com/signed-url?expires=...';

      // Act
      await updateExportStatus(export_id, status, progress, s3_key, download_url);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;

      // UpdateExpressionの検証
      expect(command.input.UpdateExpression).toContain('#status = :status');
      expect(command.input.UpdateExpression).toContain('#progress = :progress');
      expect(command.input.UpdateExpression).toContain('#completed_at = :completed_at');
      expect(command.input.UpdateExpression).toContain('#s3_key = :s3_key');
      expect(command.input.UpdateExpression).toContain('#download_url = :download_url');

      // ExpressionAttributeValuesの検証
      expect(command.input.ExpressionAttributeValues?.[':status']).toEqual({ S: 'completed' });
      expect(command.input.ExpressionAttributeValues?.[':progress']).toEqual({ N: '100' });
      expect(command.input.ExpressionAttributeValues?.[':s3_key']).toEqual({ S: s3_key });
      expect(command.input.ExpressionAttributeValues?.[':download_url']).toEqual({ S: download_url });
      expect(command.input.ExpressionAttributeValues?.[':completed_at']).toBeDefined();
      expect(command.input.ExpressionAttributeValues?.[':completed_at'].S).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });

    it('processing → failed への更新が正常に実行される（error_message付き）', async () => {
      // Arrange
      const export_id = 'export_1705305600000_ghi789_11111111';
      const status = 'failed';
      const progress = 0;
      const error_message = 'DynamoDB query failed';

      // Act
      await updateExportStatus(export_id, status, progress, undefined, undefined, error_message);

      // Assert
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;

      // UpdateExpressionの検証
      expect(command.input.UpdateExpression).toContain('#status = :status');
      expect(command.input.UpdateExpression).toContain('#progress = :progress');
      expect(command.input.UpdateExpression).toContain('#completed_at = :completed_at');
      expect(command.input.UpdateExpression).toContain('#error_message = :error_message');

      // ExpressionAttributeValuesの検証
      expect(command.input.ExpressionAttributeValues?.[':status']).toEqual({ S: 'failed' });
      expect(command.input.ExpressionAttributeValues?.[':progress']).toEqual({ N: '0' });
      expect(command.input.ExpressionAttributeValues?.[':error_message']).toEqual({
        S: 'DynamoDB query failed',
      });
      expect(command.input.ExpressionAttributeValues?.[':completed_at']).toBeDefined();
    });

    it('completed_at が completed 時に自動設定される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_jkl012_22222222';
      const status = 'completed';
      const progress = 100;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;

      // completed_atが含まれることを確認
      expect(command.input.UpdateExpression).toContain('#completed_at = :completed_at');
      expect(command.input.ExpressionAttributeValues?.[':completed_at']).toBeDefined();

      // ISO 8601形式であることを確認
      const completedAt = command.input.ExpressionAttributeValues?.[':completed_at'].S;
      expect(completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('completed_at が failed 時に自動設定される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_mno345_33333333';
      const status = 'failed';
      const progress = 0;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;

      // completed_atが含まれることを確認
      expect(command.input.UpdateExpression).toContain('#completed_at = :completed_at');
      expect(command.input.ExpressionAttributeValues?.[':completed_at']).toBeDefined();
    });

    it('進捗率が正しく更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_pqr678_44444444';
      const progressValues = [10, 25, 50, 75, 90, 100];

      // Act & Assert
      for (const progress of progressValues) {
        mockSend.mockClear();
        await updateExportStatus(export_id, 'processing', progress);

        const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
        expect(command.input.ExpressionAttributeValues?.[':progress']).toEqual({
          N: String(progress),
        });
      }
    });

    it('オプショナルフィールドが指定されない場合、UpdateExpressionに含まれない', async () => {
      // Arrange
      const export_id = 'export_1705305600000_stu901_55555555';
      const status = 'processing';
      const progress = 50;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;

      // s3_key, download_url, error_messageが含まれないことを確認
      expect(command.input.UpdateExpression).not.toContain('#s3_key');
      expect(command.input.UpdateExpression).not.toContain('#download_url');
      expect(command.input.UpdateExpression).not.toContain('#error_message');
    });
  });

  describe('異常系: DynamoDB UpdateItem 失敗', () => {
    it('DynamoDB UpdateItem 失敗時、エラーが伝播される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_vwx234_66666666';
      const status = 'processing';
      const progress = 10;

      const error = new Error('DynamoDB UpdateItem failed');
      error.name = 'InternalServerError';
      mockSend.mockRejectedValue(error);

      // Act & Assert
      await expect(updateExportStatus(export_id, status, progress)).rejects.toThrow(
        'DynamoDB UpdateItem failed'
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('ProvisionedThroughputExceededException 発生時、再試行される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_yza567_77777777';
      const status = 'processing';
      const progress = 10;

      // retryWithBackoffのモックを実際の再試行ロジックに置き換え
      const { retryWithBackoff } = jest.requireActual('../../../utils/retry');
      jest.spyOn(require('../../../utils/retry'), 'retryWithBackoff').mockImplementation(retryWithBackoff);

      const error = new Error('ProvisionedThroughputExceededException');
      error.name = 'ProvisionedThroughputExceededException';

      // 最初の2回は失敗、3回目は成功
      mockSend
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          $metadata: { httpStatusCode: 200 },
          Attributes: {},
        });

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      // 再試行により3回呼ばれることを確認
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('ValidationException 発生時、即座にエラーが伝播される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_bcd890_88888888';
      const status = 'processing';
      const progress = 10;

      const error = new Error('ValidationException: Invalid attribute value');
      error.name = 'ValidationException';
      mockSend.mockRejectedValue(error);

      // Act & Assert
      await expect(updateExportStatus(export_id, status, progress)).rejects.toThrow(
        'ValidationException: Invalid attribute value'
      );

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('異常系: 環境変数未設定', () => {
    it('EXPORT_STATUS_TABLE_NAME が未設定の場合、デフォルト値が使用される', async () => {
      // Arrange
      delete process.env.EXPORT_STATUS_TABLE_NAME;
      const export_id = 'export_1705305600000_efg123_99999999';
      const status = 'processing';
      const progress = 10;

      // モジュールを再読み込み
      jest.resetModules();
      const { updateExportStatus: updateExportStatusReloaded } = require('../update-export-status');

      // Act
      await updateExportStatusReloaded(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.TableName).toBe('tdnet-export-status'); // デフォルト値
    });
  });

  describe('エッジケース', () => {
    it('進捗率0%でも正常に更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_hij456_00000000';
      const status = 'pending';
      const progress = 0;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.ExpressionAttributeValues?.[':progress']).toEqual({ N: '0' });
    });

    it('進捗率100%でも正常に更新される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_klm789_11111112';
      const status = 'completed';
      const progress = 100;

      // Act
      await updateExportStatus(export_id, status, progress);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.ExpressionAttributeValues?.[':progress']).toEqual({ N: '100' });
    });

    it('長いエラーメッセージも正常に記録される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_nop012_22222223';
      const status = 'failed';
      const progress = 0;
      const error_message = 'A'.repeat(1000); // 1000文字のエラーメッセージ

      // Act
      await updateExportStatus(export_id, status, progress, undefined, undefined, error_message);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.ExpressionAttributeValues?.[':error_message']).toEqual({
        S: error_message,
      });
    });

    it('特殊文字を含むS3キーも正常に記録される', async () => {
      // Arrange
      const export_id = 'export_1705305600000_qrs345_33333334';
      const status = 'completed';
      const progress = 100;
      const s3_key = 'exports/2024/01/15/export_特殊文字_テスト.json';

      // Act
      await updateExportStatus(export_id, status, progress, s3_key);

      // Assert
      const command = mockSend.mock.calls[0][0] as UpdateItemCommand;
      expect(command.input.ExpressionAttributeValues?.[':s3_key']).toEqual({ S: s3_key });
    });
  });
});

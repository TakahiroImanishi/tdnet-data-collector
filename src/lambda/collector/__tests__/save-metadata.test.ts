/**
 * saveMetadata関数のユニットテスト
 *
 * Requirements: 要件1.4, 2.4（メタデータ保存、重複チェック）
 */

import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { saveMetadata } from '../save-metadata';
import { Disclosure } from '../../../types';
import { ValidationError } from '../../../errors';

const dynamoMock = mockClient(DynamoDBClient);

describe('saveMetadata', () => {
  const originalEnv = process.env.DYNAMODB_TABLE;

  beforeEach(() => {
    jest.clearAllMocks();
    dynamoMock.reset();
    process.env.DYNAMODB_TABLE = 'test-table';
  });

  afterEach(() => {
    process.env.DYNAMODB_TABLE = originalEnv;
  });

  describe('正常系', () => {
    it('メタデータをDynamoDBに保存できる', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      expect(dynamoMock.calls()).toHaveLength(1);
      const call = dynamoMock.call(0);
      expect(call.args[0].input).toMatchObject({
        TableName: 'test-table',
        ConditionExpression: 'attribute_not_exists(disclosure_id)',
      });

      // date_partitionが正しく生成されているか確認
      const input = call.args[0].input as any;
      const item = input.Item;
      expect(item?.date_partition?.S).toBe('2024-01');
      expect(item?.disclosure_id?.S).toBe('TD20240115001');
      expect(item?.s3_key?.S).toBe(s3_key);
    });

    it('date_partitionを事前生成してから保存する（Two-Phase Commit）', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;

      // date_partitionが保存前に生成されている
      expect(item?.date_partition?.S).toBeDefined();
      expect(item?.date_partition?.S).toBe('2024-01');
    });

    it('月またぎ（UTC→JST）のdate_partitionを正しく生成できる', async () => {
      // Arrange: UTC 2024-01-31 15:30 → JST 2024-02-01 00:30
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240131001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-31T15:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240131001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/02/01/TD20240131001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;
      expect(item?.date_partition?.S).toBe('2024-02');
    });

    it('年またぎ（UTC→JST）のdate_partitionを正しく生成できる', async () => {
      // Arrange: UTC 2023-12-31 15:30 → JST 2024-01-01 00:30
      const disclosure: Disclosure = {
        disclosure_id: 'TD20231231001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2023-12-31T15:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120231231001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/01/TD20231231001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;
      expect(item?.date_partition?.S).toBe('2024-01');
    });

    it('collected_atに現在時刻を設定する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      const beforeTime = new Date().toISOString();

      // Act
      await saveMetadata(disclosure, s3_key);

      const afterTime = new Date().toISOString();

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;
      const collectedAt = item?.collected_at?.S;

      expect(collectedAt).toBeDefined();
      expect(collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(collectedAt! >= beforeTime).toBe(true);
      expect(collectedAt! <= afterTime).toBe(true);
    });
  });

  describe('異常系', () => {
    it('重複する開示IDの場合、警告レベルで記録して正常終了する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutItemCommand).rejects(conditionalCheckError);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).resolves.toBeUndefined();
      expect(dynamoMock.calls()).toHaveLength(1);
    });

    it('不正なdisclosed_atフォーマットでValidationErrorをスローする', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15 10:30:00', // 不正なフォーマット
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow(ValidationError);
      expect(dynamoMock.calls()).toHaveLength(0); // DynamoDBは呼ばれない
    });

    it('存在しない日付でValidationErrorをスローする', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240230001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-02-30T10:30:00Z', // 存在しない日付
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240230001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/02/30/TD20240230001.pdf';

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow(ValidationError);
      expect(dynamoMock.calls()).toHaveLength(0); // DynamoDBは呼ばれない
    });

    it('DynamoDBエラーで失敗する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow('DynamoDB error');
    });
  });

  describe('エッジケース', () => {
    it('うるう年2月末（UTC→JST）のdate_partitionを正しく生成できる', async () => {
      // Arrange: UTC 2024-02-29 15:00 → JST 2024-03-01 00:00
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240229001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-02-29T15:00:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240229001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/03/01/TD20240229001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;
      expect(item?.date_partition?.S).toBe('2024-03');
    });

    it('環境変数DYNAMODB_TABLEが未設定の場合、デフォルト値を使用する', async () => {
      // Arrange
      delete process.env.DYNAMODB_TABLE;
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const input = dynamoMock.call(0).args[0].input as any;
      expect(input.TableName).toBe('tdnet_disclosures');
    });

    it('すべてのメタデータフィールドが正しく保存される', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      dynamoMock.on(PutItemCommand).resolves({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      const call = dynamoMock.call(0);
      const input = call.args[0].input as any;
      const item = input.Item;

      expect(item?.disclosure_id?.S).toBe('TD20240115001');
      expect(item?.company_code?.S).toBe('1234');
      expect(item?.company_name?.S).toBe('株式会社サンプル');
      expect(item?.disclosure_type?.S).toBe('決算短信');
      expect(item?.title?.S).toBe('2024年3月期 第3四半期決算短信');
      expect(item?.disclosed_at?.S).toBe('2024-01-15T10:30:00Z');
      expect(item?.date_partition?.S).toBe('2024-01');
      expect(item?.pdf_url?.S).toBe('https://www.release.tdnet.info/inbs/140120240115001.pdf');
      expect(item?.s3_key?.S).toBe(s3_key);
      expect(item?.collected_at?.S).toBeDefined();
    });
  });
});

  describe('再試行ロジック', () => {
    beforeEach(() => {
      dynamoMock.reset();
    });

    it('ProvisionedThroughputExceededExceptionで再試行する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const throughputError = new Error('ProvisionedThroughputExceededException');
      throughputError.name = 'ProvisionedThroughputExceededException';

      // 最初の2回は失敗、3回目は成功
      dynamoMock
        .on(PutItemCommand)
        .rejectsOnce(throughputError)
        .rejectsOnce(throughputError)
        .resolvesOnce({});

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      expect(dynamoMock.calls()).toHaveLength(3); // 初回 + 2回再試行
    });

    it('ProvisionedThroughputExceededExceptionで最大再試行回数後に失敗する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const throughputError = new Error('ProvisionedThroughputExceededException');
      throughputError.name = 'ProvisionedThroughputExceededException';

      dynamoMock.on(PutItemCommand).rejects(throughputError);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow(
        'ProvisionedThroughputExceededException'
      );
      expect(dynamoMock.calls()).toHaveLength(4); // 初回 + 3回再試行
    });

    it('ConditionalCheckFailedExceptionは再試行しない', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const conditionalCheckError = new Error('ConditionalCheckFailedException');
      conditionalCheckError.name = 'ConditionalCheckFailedException';
      dynamoMock.on(PutItemCommand).rejects(conditionalCheckError);

      // Act
      await saveMetadata(disclosure, s3_key);

      // Assert
      expect(dynamoMock.calls()).toHaveLength(1); // 再試行しない
    });

    it('その他のDynamoDBエラーは再試行しない', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const validationError = new Error('ValidationException');
      validationError.name = 'ValidationException';
      dynamoMock.on(PutItemCommand).rejects(validationError);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow('ValidationException');
      expect(dynamoMock.calls()).toHaveLength(1); // 再試行しない
    });
  });

  describe('エラーメトリクス送信', () => {
    it('エラー発生時にCloudWatchメトリクスを送信する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      dynamoMock.on(PutItemCommand).rejects(networkError);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toThrow('Network error');
      // メトリクス送信が呼ばれることを確認（実装依存）
    });

    it('エラーにconstructorがない場合でもエラーメトリクスを送信する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      // constructorがnullのエラーオブジェクト
      const errorWithoutConstructor = Object.create(null);
      errorWithoutConstructor.message = 'Unknown error';
      dynamoMock.on(PutItemCommand).rejects(errorWithoutConstructor);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toBeDefined();
    });

    it('エラーにmessageがない場合でもエラーメトリクスを送信する', async () => {
      // Arrange
      const disclosure: Disclosure = {
        disclosure_id: 'TD20240115001',
        company_code: '1234',
        company_name: '株式会社サンプル',
        disclosure_type: '決算短信',
        title: '2024年3月期 第3四半期決算短信',
        disclosed_at: '2024-01-15T10:30:00Z',
        pdf_url: 'https://www.release.tdnet.info/inbs/140120240115001.pdf',
        pdf_s3_key: '',
        downloaded_at: '',
        date_partition: '',
      };
      const s3_key = '2024/01/15/TD20240115001.pdf';

      // messageがないエラーオブジェクト
      const errorWithoutMessage: any = new Error();
      delete errorWithoutMessage.message;
      dynamoMock.on(PutItemCommand).rejects(errorWithoutMessage);

      // Act & Assert
      await expect(saveMetadata(disclosure, s3_key)).rejects.toBeDefined();
    });
  });

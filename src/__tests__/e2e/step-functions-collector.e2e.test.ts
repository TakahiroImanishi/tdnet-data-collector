/**
 * Step Functions Collector E2E Tests
 *
 * LocalStack環境でのエンドツーエンドテスト。
 * Step Functionsステートマシンの実行を検証します。
 *
 * Requirements: タスク6.1 - E2Eテスト作成
 */

import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
  ExecutionStatus,
} from '@aws-sdk/client-sfn';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// LocalStack環境設定
const isLocalStack = process.env.AWS_ENDPOINT !== undefined;
const region = process.env.AWS_REGION || 'ap-northeast-1';

const sfnClient = new SFNClient({
  region,
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

const dynamoClient = new DynamoDBClient({
  region,
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
  }),
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

const s3Client = new S3Client({
  region,
  ...(isLocalStack && {
    endpoint: process.env.AWS_ENDPOINT,
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
    forcePathStyle: true,
  }),
});

describe('Step Functions Collector E2E Tests', () => {
  const stateMachineArn = process.env.STATE_MACHINE_ARN || 
    'arn:aws:states:ap-northeast-1:000000000000:stateMachine:TDnetCollectorStateMachine';
  const executionsTableName = process.env.EXECUTION_STATE_TABLE || 'tdnet_executions';
  const disclosuresTableName = process.env.DYNAMODB_TABLE_NAME || 'tdnet_disclosures';
  const s3BucketName = process.env.S3_BUCKET_NAME || 'tdnet-data-collector-pdfs-local';

  /**
   * 実行完了を待機するヘルパー関数
   */
  const waitForExecution = async (
    executionArn: string,
    maxWaitTime: number = 60000,
    pollInterval: number = 2000
  ): Promise<ExecutionStatus> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const response = await sfnClient.send(
        new DescribeExecutionCommand({ executionArn })
      );
      
      const status = response.status;
      if (status === ExecutionStatus.SUCCEEDED || 
          status === ExecutionStatus.FAILED || 
          status === ExecutionStatus.TIMED_OUT ||
          status === ExecutionStatus.ABORTED) {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error(`Execution did not complete within ${maxWaitTime}ms`);
  };

  describe('正常系テスト（小規模データ）', () => {
    it('1日分の小規模データ収集が成功する', async () => {
      // Arrange
      const input = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };

      // Act
      const startResponse = await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify(input),
        })
      );

      expect(startResponse.executionArn).toBeDefined();
      const executionArn = startResponse.executionArn!;

      // 実行完了を待機
      const finalStatus = await waitForExecution(executionArn);

      // Assert
      expect(finalStatus).toBe(ExecutionStatus.SUCCEEDED);

      // 実行状態テーブルを確認
      const executionId = executionArn.split(':').pop()!;
      const executionState = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: executionId },
        })
      );

      expect(executionState.Item).toBeDefined();
      expect(executionState.Item?.status).toBe('completed');
      expect(executionState.Item?.collected_count).toBeGreaterThan(0);
      expect(executionState.Item?.progress).toBe(100);
    }, 90000); // 90秒タイムアウト

    it('収集したデータがDynamoDBに保存される', async () => {
      // Arrange
      const input = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };

      // Act
      const startResponse = await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify(input),
        })
      );

      const executionArn = startResponse.executionArn!;
      await waitForExecution(executionArn);

      // Assert - DynamoDBにデータが保存されているか確認
      const queryResponse = await docClient.send(
        new QueryCommand({
          TableName: disclosuresTableName,
          IndexName: 'GSI_DatePartition',
          KeyConditionExpression: 'date_partition = :partition',
          ExpressionAttributeValues: {
            ':partition': '2024-01',
          },
          Limit: 10,
        })
      );

      expect(queryResponse.Items).toBeDefined();
      expect(queryResponse.Items!.length).toBeGreaterThan(0);

      // データ構造を検証
      const item = queryResponse.Items![0];
      expect(item).toHaveProperty('disclosure_id');
      expect(item).toHaveProperty('date_partition');
      expect(item).toHaveProperty('disclosed_at');
      expect(item).toHaveProperty('company_code');
      expect(item).toHaveProperty('company_name');
      expect(item).toHaveProperty('title');
    }, 90000);

    it('PDFファイルがS3に保存される', async () => {
      // Arrange
      const input = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };

      // Act
      const startResponse = await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify(input),
        })
      );

      const executionArn = startResponse.executionArn!;
      await waitForExecution(executionArn);

      // Assert - S3にPDFが保存されているか確認
      const s3Response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: s3BucketName,
          Prefix: '2024/01/',
          MaxKeys: 10,
        })
      );

      expect(s3Response.Contents).toBeDefined();
      expect(s3Response.Contents!.length).toBeGreaterThan(0);

      // PDFファイル名の形式を検証
      const pdfKey = s3Response.Contents![0].Key!;
      expect(pdfKey).toMatch(/^\d{4}\/\d{2}\/[A-Z0-9]+\.pdf$/);
    }, 90000);
  });

  describe('異常系テスト（エラーハンドリング）', () => {
    it('無効な日付形式でバリデーションエラーが発生する', async () => {
      // Arrange
      const input = {
        startDate: 'invalid-date',
        endDate: '2024-01-15',
      };

      // Act & Assert
      await expect(
        sfnClient.send(
          new StartExecutionCommand({
            stateMachineArn,
            input: JSON.stringify(input),
          })
        ).then(async (response) => {
          const executionArn = response.executionArn!;
          const finalStatus = await waitForExecution(executionArn);
          
          if (finalStatus !== ExecutionStatus.FAILED) {
            throw new Error(`Expected FAILED status, got ${finalStatus}`);
          }
          
          return finalStatus;
        })
      ).resolves.toBe(ExecutionStatus.FAILED);
    }, 90000);

    it('開始日が終了日より後の場合にバリデーションエラーが発生する', async () => {
      // Arrange
      const input = {
        startDate: '2024-01-20',
        endDate: '2024-01-15',
      };

      // Act & Assert
      await expect(
        sfnClient.send(
          new StartExecutionCommand({
            stateMachineArn,
            input: JSON.stringify(input),
          })
        ).then(async (response) => {
          const executionArn = response.executionArn!;
          const finalStatus = await waitForExecution(executionArn);
          
          if (finalStatus !== ExecutionStatus.FAILED) {
            throw new Error(`Expected FAILED status, got ${finalStatus}`);
          }
          
          return finalStatus;
        })
      ).resolves.toBe(ExecutionStatus.FAILED);
    }, 90000);
  });

  describe('大規模データテスト（モック）', () => {
    it('複数日のデータ収集が成功する', async () => {
      // Arrange - 3日分のデータ収集
      const input = {
        startDate: '2024-01-15',
        endDate: '2024-01-17',
      };

      // Act
      const startResponse = await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify(input),
        })
      );

      const executionArn = startResponse.executionArn!;
      const finalStatus = await waitForExecution(executionArn, 180000); // 3分タイムアウト

      // Assert
      expect(finalStatus).toBe(ExecutionStatus.SUCCEEDED);

      // 実行状態を確認
      const executionId = executionArn.split(':').pop()!;
      const executionState = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: executionId },
        })
      );

      expect(executionState.Item).toBeDefined();
      expect(executionState.Item?.status).toBe('completed');
      expect(executionState.Item?.collected_count).toBeGreaterThan(0);
      expect(executionState.Item?.progress).toBe(100);
    }, 200000); // 200秒タイムアウト
  });

  describe('実行状態管理', () => {
    it('実行中の進捗が正しく更新される', async () => {
      // Arrange
      const input = {
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      };

      // Act
      const startResponse = await sfnClient.send(
        new StartExecutionCommand({
          stateMachineArn,
          input: JSON.stringify(input),
        })
      );

      const executionArn = startResponse.executionArn!;
      const executionId = executionArn.split(':').pop()!;

      // 少し待機してから実行状態を確認
      await new Promise(resolve => setTimeout(resolve, 5000));

      const executionState = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: executionId },
        })
      );

      // Assert - 実行中の状態を確認
      expect(executionState.Item).toBeDefined();
      expect(['pending', 'running', 'completed']).toContain(executionState.Item?.status);
      expect(executionState.Item).toHaveProperty('started_at');
      expect(executionState.Item).toHaveProperty('updated_at');

      // 実行完了を待機
      await waitForExecution(executionArn);

      // 完了後の状態を確認
      const finalState = await docClient.send(
        new GetCommand({
          TableName: executionsTableName,
          Key: { execution_id: executionId },
        })
      );

      expect(finalState.Item?.status).toBe('completed');
      expect(finalState.Item).toHaveProperty('completed_at');
    }, 90000);
  });
});

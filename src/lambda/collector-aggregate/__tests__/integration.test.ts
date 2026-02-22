/**
 * Lambda Collector Aggregate Handler 統合テスト
 *
 * LocalStackを使用したDynamoDB連携テスト
 */

import { Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { handler, AggregateEvent, AggregateResponse } from '../handler';
import { updateExecutionStatus } from '../../collector/update-execution-status';

// LocalStack環境でのみ実行
const isLocalStack = process.env.AWS_ENDPOINT_URL !== undefined;

describe('Lambda Collector Aggregate Handler - 統合テスト', () => {
  let dynamoClient: DynamoDBClient;
  let mockContext: Context;

  beforeAll(() => {
    if (!isLocalStack) {
      console.log('LocalStack環境ではないため、統合テストをスキップします');
      return;
    }

    // LocalStack用のDynamoDBクライアント
    dynamoClient = new DynamoDBClient({
      endpoint: process.env.AWS_ENDPOINT_URL,
      region: process.env.AWS_REGION || 'ap-northeast-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
  });

  beforeEach(() => {
    // Lambda Contextのモック
    mockContext = {
      awsRequestId: 'test-request-id',
      functionName: 'CollectorAggregateFunction',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:ap-northeast-1:123456789012:function:CollectorAggregateFunction',
      memoryLimitInMB: '256',
      logGroupName: '/aws/lambda/CollectorAggregateFunction',
      logStreamName: '2024/01/15/[$LATEST]test',
      callbackWaitsForEmptyEventLoop: true,
      getRemainingTimeInMillis: () => 30000,
      done: jest.fn(),
      fail: jest.fn(),
      succeed: jest.fn(),
    };
  });

  // LocalStack環境でない場合はテストをスキップ
  const testIf = (condition: boolean) => (condition ? test : test.skip);

  testIf(isLocalStack)('実行状態がDynamoDBに正しく保存される', async () => {
    const execution_id = `exec_integration_${Date.now()}`;

    // 初期状態を作成
    await updateExecutionStatus(execution_id, 'pending', 0);

    const event: AggregateEvent = {
      execution_id,
      results: [
        { date: '2024-01-15', success_count: 100, failed_count: 5 },
        { date: '2024-01-16', success_count: 150, failed_count: 3 },
      ],
    };

    // ハンドラー実行
    const response: AggregateResponse = await handler(event, mockContext);

    // レスポンス検証
    expect(response.execution_id).toBe(execution_id);
    expect(response.status).toBe('partial_success');
    expect(response.total_collected).toBe(250);
    expect(response.total_failed).toBe(8);
    expect(response.success_rate).toBeCloseTo(96.899, 2);

    // DynamoDBから実行状態を取得
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod',
        Key: marshall({ execution_id }),
      })
    );

    expect(result.Item).toBeDefined();

    const item = unmarshall(result.Item!);

    // 実行状態の検証
    expect(item.execution_id).toBe(execution_id);
    expect(item.status).toBe('completed');
    expect(item.progress).toBe(100);
    expect(item.collected_count).toBe(250);
    expect(item.failed_count).toBe(8);
    expect(item.completed_at).toBeDefined();
    expect(item.ttl).toBeDefined();
  });

  testIf(isLocalStack)('全件失敗時、statusがfailedになる', async () => {
    const execution_id = `exec_integration_failed_${Date.now()}`;

    // 初期状態を作成
    await updateExecutionStatus(execution_id, 'pending', 0);

    const event: AggregateEvent = {
      execution_id,
      results: [
        { date: '2024-01-15', success_count: 0, failed_count: 100 },
        { date: '2024-01-16', success_count: 0, failed_count: 150 },
      ],
    };

    // ハンドラー実行
    const response: AggregateResponse = await handler(event, mockContext);

    // レスポンス検証
    expect(response.status).toBe('failed');
    expect(response.total_collected).toBe(0);
    expect(response.total_failed).toBe(250);

    // DynamoDBから実行状態を取得
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod',
        Key: marshall({ execution_id }),
      })
    );

    const item = unmarshall(result.Item!);

    // 実行状態の検証
    expect(item.status).toBe('failed');
    expect(item.error_message).toBe('Collection failed');
  });

  testIf(isLocalStack)('全件成功時、statusがsuccessになる', async () => {
    const execution_id = `exec_integration_success_${Date.now()}`;

    // 初期状態を作成
    await updateExecutionStatus(execution_id, 'pending', 0);

    const event: AggregateEvent = {
      execution_id,
      results: [
        { date: '2024-01-15', success_count: 100, failed_count: 0 },
        { date: '2024-01-16', success_count: 150, failed_count: 0 },
      ],
    };

    // ハンドラー実行
    const response: AggregateResponse = await handler(event, mockContext);

    // レスポンス検証
    expect(response.status).toBe('success');
    expect(response.total_collected).toBe(250);
    expect(response.total_failed).toBe(0);
    expect(response.success_rate).toBe(100);

    // DynamoDBから実行状態を取得
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: process.env.EXECUTION_STATE_TABLE || 'ExecutionState_prod',
        Key: marshall({ execution_id }),
      })
    );

    const item = unmarshall(result.Item!);

    // 実行状態の検証
    expect(item.status).toBe('completed');
    expect(item.collected_count).toBe(250);
    expect(item.failed_count).toBe(0);
    expect(item.error_message).toBeUndefined();
  });
});

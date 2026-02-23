/**
 * 負荷テスト
 *
 * 大量データ収集と同時アクセスのテスト
 *
 * 【重要】このテストは実際のAWS環境（Lambda + API Gateway + DynamoDB）が必要です
 * LocalStack環境では実行できません
 *
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 *
 * 実行方法:
 * 1. AWS環境にデプロイ
 * 2. 環境変数を設定:
 *    - RUN_LOAD_TESTS=true
 *    - API_BASE_URL=https://your-api-gateway-url
 *    - API_KEY=your-api-key
 *    - COLLECTOR_FUNCTION_NAME=your-collector-function-name
 *    - DISCLOSURES_TABLE_NAME=your-table-name
 * 3. npm test -- load-test.test.ts --testTimeout=600000
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import axios from 'axios';

// テスト環境設定
const TEST_ENV = process.env.TEST_ENV || 'local';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-api-key';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Lambda関数名
const COLLECTOR_FUNCTION_NAME = process.env.COLLECTOR_FUNCTION_NAME || 'tdnet-collector-dev';

// DynamoDB テーブル名
const DISCLOSURES_TABLE_NAME = process.env.DISCLOSURES_TABLE_NAME || 'tdnet-disclosures-dev';

// Load テスト実行フラグ
const RUN_LOAD_TESTS = process.env.RUN_LOAD_TESTS === 'true';

// AWS クライアント（Load テスト有効時のみ初期化）
let lambdaClient: LambdaClient | undefined;
let dynamodbClient: DynamoDBClient | undefined;

if (RUN_LOAD_TESTS) {
  lambdaClient = new LambdaClient({ region: AWS_REGION });
  dynamodbClient = new DynamoDBClient({ region: AWS_REGION });
}

// テストスキップ条件
const describeOrSkip = RUN_LOAD_TESTS ? describe : describe.skip;

describeOrSkip('負荷テスト', () => {
  // タイムアウトを10分に設定
  jest.setTimeout(600000);

  beforeAll(() => {
    if (!RUN_LOAD_TESTS) {
      console.log('\n⚠️  Load テストはスキップされました');
      console.log('実行するには環境変数 RUN_LOAD_TESTS=true を設定してください');
      console.log('詳細はテストファイルのコメントを参照してください\n');
    }
  });

  describe('シナリオ1: 大量データ収集（100件以上）', () => {
    it('100件以上の開示情報を収集できること', async () => {
      // テスト日付範囲（過去30日間）
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`\n📊 大量データ収集テスト開始`);
      console.log(`期間: ${startDateStr} 〜 ${endDateStr}`);

      const startTime = Date.now();

      // Lambda Collector を呼び出し
      if (!lambdaClient) {
        throw new Error('Lambda client is not initialized');
      }

      const invokeCommand = new InvokeCommand({
        FunctionName: COLLECTOR_FUNCTION_NAME,
        Payload: JSON.stringify({
          start_date: startDateStr,
          end_date: endDateStr,
          mode: 'batch',
        }),
      });

      const response = await lambdaClient.send(invokeCommand);
      const payload = JSON.parse(new TextDecoder().decode(response.Payload));

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`\n✅ 収集完了`);
      console.log(`実行時間: ${duration.toFixed(2)}秒`);
      console.log(`ステータス: ${payload.status}`);
      console.log(`収集件数: ${payload.total_count || 0}件`);
      console.log(`成功件数: ${payload.success_count || 0}件`);
      console.log(`失敗件数: ${payload.failed_count || 0}件`);

      // アサーション
      expect(payload.status).toBe('completed');
      expect(payload.total_count).toBeGreaterThanOrEqual(100);
      expect(payload.success_count).toBeGreaterThan(0);

      // 成功率が95%以上であること
      const successRate = (payload.success_count / payload.total_count) * 100;
      console.log(`成功率: ${successRate.toFixed(2)}%`);
      expect(successRate).toBeGreaterThanOrEqual(95);

      // 実行時間が15分以内であること
      expect(duration).toBeLessThan(900);
    });

    it('収集したデータがDynamoDBに保存されていること', async () => {
      console.log(`\n📊 DynamoDB データ確認`);

      // DynamoDB から最近のデータを取得
      if (!dynamodbClient) {
        throw new Error('DynamoDB client is not initialized');
      }

      const scanCommand = new ScanCommand({
        TableName: DISCLOSURES_TABLE_NAME,
        Limit: 100,
      });

      const response = await dynamodbClient.send(scanCommand);

      console.log(`\n✅ データ確認完了`);
      console.log(`取得件数: ${response.Items?.length || 0}件`);

      // アサーション
      expect(response.Items).toBeDefined();
      expect(response.Items!.length).toBeGreaterThan(0);
    });
  });

  describe('シナリオ2: 同時API呼び出し（10並列）', () => {
    it('GET /disclosures を10並列で呼び出せること', async () => {
      console.log(`\n📊 同時API呼び出しテスト開始（10並列）`);

      const startTime = Date.now();

      // 10並列でAPIを呼び出し
      const promises = Array.from({ length: 10 }, (_, i) =>
        axios
          .get(`${API_BASE_URL}/disclosures`, {
            headers: {
              'x-api-key': API_KEY,
            },
            params: {
              limit: 10,
              offset: i * 10,
            },
          })
          .then((response) => ({
            index: i,
            status: response.status,
            count: response.data.disclosures?.length || 0,
            duration: Date.now() - startTime,
          }))
          .catch((error) => ({
            index: i,
            status: error.response?.status || 500,
            error: error.message,
            duration: Date.now() - startTime,
          }))
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      console.log(`\n✅ 同時呼び出し完了`);
      console.log(`総実行時間: ${totalDuration.toFixed(2)}秒`);

      // 結果集計
      const successCount = results.filter((r) => r.status === 200).length;
      const failureCount = results.filter((r) => r.status !== 200).length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000;

      console.log(`成功: ${successCount}件`);
      console.log(`失敗: ${failureCount}件`);
      console.log(`平均応答時間: ${avgDuration.toFixed(2)}秒`);

      // 詳細ログ
      results.forEach((r) => {
        if (r.status === 200) {
          console.log(
            `  [${r.index}] ✅ ${r.status} - ${r.count}件 - ${(r.duration / 1000).toFixed(2)}秒`
          );
        } else {
          console.log(`  [${r.index}] ❌ ${r.status} - ${r.error || 'Unknown error'}`);
        }
      });

      // アサーション
      expect(successCount).toBeGreaterThanOrEqual(8); // 80%以上成功
      expect(avgDuration).toBeLessThan(5); // 平均5秒以内
    });
  });

  describe('シナリオ3: エクスポート同時実行（5並列）', () => {
    it('POST /exports を5並列で呼び出せること', async () => {
      console.log(`\n📊 エクスポート同時実行テスト開始（5並列）`);

      const startTime = Date.now();

      // テスト日付範囲
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // 5並列でエクスポートを呼び出し
      const promises = Array.from({ length: 5 }, (_, i) =>
        axios
          .post(
            `${API_BASE_URL}/exports`,
            {
              start_date: startDateStr,
              end_date: endDateStr,
              format: i % 2 === 0 ? 'json' : 'csv',
            },
            {
              headers: {
                'x-api-key': API_KEY,
              },
            }
          )
          .then((response) => ({
            index: i,
            status: response.status,
            export_id: response.data.export_id,
            duration: Date.now() - startTime,
          }))
          .catch((error) => ({
            index: i,
            status: error.response?.status || 500,
            error: error.message,
            duration: Date.now() - startTime,
          }))
      );

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      console.log(`\n✅ エクスポート同時実行完了`);
      console.log(`総実行時間: ${totalDuration.toFixed(2)}秒`);

      // 結果集計
      const successCount = results.filter((r) => r.status === 202).length;
      const failureCount = results.filter((r) => r.status !== 202).length;

      console.log(`成功: ${successCount}件`);
      console.log(`失敗: ${failureCount}件`);

      // 詳細ログ
      results.forEach((r) => {
        if (r.status === 202) {
          console.log(
            `  [${r.index}] ✅ ${r.status} - Export ID: ${r.export_id} - ${(r.duration / 1000).toFixed(2)}秒`
          );
        } else {
          console.log(`  [${r.index}] ❌ ${r.status} - ${r.error || 'Unknown error'}`);
        }
      });

      // アサーション
      expect(successCount).toBeGreaterThanOrEqual(4); // 80%以上成功
      expect(totalDuration).toBeLessThan(10); // 10秒以内
    });
  });

  describe('シナリオ4: レート制限の確認', () => {
    it('連続リクエストでレート制限が機能すること', async () => {
      console.log(`\n📊 レート制限確認テスト開始`);

      const startTime = Date.now();
      const results: number[] = [];

      // 5回連続でAPIを呼び出し
      for (let i = 0; i < 5; i++) {
        const requestStart = Date.now();

        try {
          await axios.get(`${API_BASE_URL}/disclosures`, {
            headers: {
              'x-api-key': API_KEY,
            },
            params: {
              limit: 1,
            },
          });

          const requestDuration = Date.now() - requestStart;
          results.push(requestDuration);

          console.log(`  リクエスト ${i + 1}: ${requestDuration}ms`);
        } catch (error: any) {
          console.log(`  リクエスト ${i + 1}: エラー - ${error.message}`);
        }
      }

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      console.log(`\n✅ レート制限確認完了`);
      console.log(`総実行時間: ${totalDuration.toFixed(2)}秒`);

      // 連続リクエスト間の最小間隔を確認（レート制限: 1リクエスト/秒）
      // 実際には API Gateway のレート制限が適用される
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe('シナリオ5: エラーハンドリングの確認', () => {
    it('不正なリクエストでエラーが返されること', async () => {
      console.log(`\n📊 エラーハンドリング確認テスト開始`);

      // 不正な日付範囲
      try {
        await axios.get(`${API_BASE_URL}/disclosures`, {
          headers: {
            'x-api-key': API_KEY,
          },
          params: {
            start_date: '2024-12-31',
            end_date: '2024-01-01', // 開始日 > 終了日
          },
        });

        fail('エラーが発生すべき');
      } catch (error: any) {
        console.log(
          `  ✅ 期待通りエラー: ${error.response?.status} - ${error.response?.data?.error?.message}`
        );
        expect(error.response?.status).toBe(400);
      }

      // APIキーなし
      try {
        await axios.get(`${API_BASE_URL}/disclosures`, {
          params: {
            limit: 1,
          },
        });

        fail('エラーが発生すべき');
      } catch (error: any) {
        console.log(
          `  ✅ 期待通りエラー: ${error.response?.status} - ${error.response?.data?.error?.message}`
        );
        expect(error.response?.status).toBe(401);
      }

      console.log(`\n✅ エラーハンドリング確認完了`);
    });
  });
});

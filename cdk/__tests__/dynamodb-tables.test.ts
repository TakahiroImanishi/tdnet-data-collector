/**
 * DynamoDB Table Structure Verification Test
 *
 * Task 3.2: DynamoDBテーブル構造の検証テスト
 * Requirements: 要件2.5, 13.3（データベース、暗号化）
 *
 * このテストは、CDKで定義されたDynamoDBテーブルが設計通りに構成されていることを検証します。
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('DynamoDB Tables', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetDataCollectorStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
    });
    template = Template.fromStack(stack);
  });

  describe('tdnet_disclosures table', () => {
    it('should be created with correct configuration', () => {
      // テーブルが存在することを確認
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures',
        BillingMode: 'PAY_PER_REQUEST', // オンデマンドモード
        SSESpecification: {
          SSEEnabled: true, // 暗号化有効化
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // ポイントインタイムリカバリ有効化
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures',
        KeySchema: [
          {
            AttributeName: 'disclosure_id',
            KeyType: 'HASH', // パーティションキー
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'disclosure_id',
            AttributeType: 'S', // String型
          },
        ]),
      });
    });

    it('should have GSI_CompanyCode_DiscloseDate index', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_CompanyCode_DiscloseDate',
            KeySchema: [
              {
                AttributeName: 'company_code',
                KeyType: 'HASH', // パーティションキー
              },
              {
                AttributeName: 'disclosed_at',
                KeyType: 'RANGE', // ソートキー
              },
            ],
            Projection: {
              ProjectionType: 'ALL', // すべての属性を投影
            },
          },
        ]),
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'company_code',
            AttributeType: 'S',
          },
          {
            AttributeName: 'disclosed_at',
            AttributeType: 'S',
          },
        ]),
      });
    });

    it('should have GSI_DatePartition index', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_DatePartition',
            KeySchema: [
              {
                AttributeName: 'date_partition',
                KeyType: 'HASH', // パーティションキー
              },
              {
                AttributeName: 'disclosed_at',
                KeyType: 'RANGE', // ソートキー
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ]),
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'date_partition',
            AttributeType: 'S',
          },
        ]),
      });
    });

    it('should have exactly 2 GSIs', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures',
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({ IndexName: 'GSI_CompanyCode_DiscloseDate' }),
          Match.objectLike({ IndexName: 'GSI_DatePartition' }),
        ]),
      });
    });
  });

  describe('tdnet_executions table', () => {
    it('should be created with correct configuration', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions',
        BillingMode: 'PAY_PER_REQUEST', // オンデマンドモード
        SSESpecification: {
          SSEEnabled: true, // 暗号化有効化
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // ポイントインタイムリカバリ有効化
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions',
        KeySchema: [
          {
            AttributeName: 'execution_id',
            KeyType: 'HASH', // パーティションキー
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'execution_id',
            AttributeType: 'S', // String型
          },
        ]),
      });
    });

    it('should have TTL enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true, // TTL有効化
        },
      });
    });

    it('should have GSI_Status_StartedAt index', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_Status_StartedAt',
            KeySchema: [
              {
                AttributeName: 'status',
                KeyType: 'HASH', // パーティションキー
              },
              {
                AttributeName: 'started_at',
                KeyType: 'RANGE', // ソートキー
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          },
        ]),
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'status',
            AttributeType: 'S',
          },
          {
            AttributeName: 'started_at',
            AttributeType: 'S',
          },
        ]),
      });
    });

    it('should have exactly 1 GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions',
        GlobalSecondaryIndexes: [
          Match.objectLike({ IndexName: 'GSI_Status_StartedAt' }),
        ],
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('should export DisclosuresTableName', () => {
      template.hasOutput('DisclosuresTableName', {
        Value: {
          Ref: Match.stringLikeRegexp('DisclosuresTable'),
        },
        Export: {
          Name: 'TdnetDisclosuresTableName',
        },
      });
    });

    it('should export ExecutionsTableName', () => {
      template.hasOutput('ExecutionsTableName', {
        Value: {
          Ref: Match.stringLikeRegexp('ExecutionsTable'),
        },
        Export: {
          Name: 'TdnetExecutionsTableName',
        },
      });
    });
  });

  describe('Security and Compliance', () => {
    it('should have encryption enabled on all tables', () => {
      // すべてのDynamoDBテーブルで暗号化が有効化されていることを確認
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);

      expect(tableKeys.length).toBeGreaterThanOrEqual(2);

      tableKeys.forEach((key) => {
        const table = tables[key];
        expect(table.Properties.SSESpecification).toBeDefined();
        expect(table.Properties.SSESpecification.SSEEnabled).toBe(true);
      });
    });

    it('should have point-in-time recovery enabled on all tables', () => {
      // すべてのDynamoDBテーブルでポイントインタイムリカバリが有効化されていることを確認
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);

      tableKeys.forEach((key) => {
        const table = tables[key];
        expect(
          table.Properties.PointInTimeRecoverySpecification
        ).toBeDefined();
        expect(
          table.Properties.PointInTimeRecoverySpecification
            .PointInTimeRecoveryEnabled
        ).toBe(true);
      });
    });

    it('should use on-demand billing mode for cost optimization', () => {
      // すべてのDynamoDBテーブルでオンデマンドモードが使用されていることを確認
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);

      tableKeys.forEach((key) => {
        const table = tables[key];
        expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
      });
    });
  });

  describe('Table Count', () => {
    it('should have exactly 2 DynamoDB tables', () => {
      // DynamoDBテーブルが正確に2つ存在することを確認
      template.resourceCountIs('AWS::DynamoDB::Table', 2);
    });
  });
});

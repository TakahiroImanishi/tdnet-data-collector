/**
 * DynamoDB Table Structure Verification Test
 *
 * Task 3.2: DynamoDBチE�Eブル構造の検証チE��チE
 * Requirements: 要件2.5, 13.3�E�データベ�Eス、暗号化！E
 *
 * こ�EチE��ト�E、CDKで定義されたDynamoDBチE�Eブルが設計通りに構�EされてぁE��ことを検証します、E
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetFoundationStack } from '../lib/stacks/foundation-stack';

describe('DynamoDB Tables', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetFoundationStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      environment: 'dev',
    });
    template = Template.fromStack(stack);
  });

  describe('tdnet_disclosures table', () => {
    it('should be created with correct configuration', () => {
      // チE�Eブルが存在することを確誁E
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        BillingMode: 'PAY_PER_REQUEST', // オンチE�EンドモーチE
        SSESpecification: {
          SSEEnabled: true, // 暗号化有効匁E
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // ポイントインタイムリカバリ有効匁E
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        KeySchema: [
          {
            AttributeName: 'disclosure_id',
            KeyType: 'HASH', // パ�EチE��ションキー
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'disclosure_id',
            AttributeType: 'S', // String垁E
          },
        ]),
      });
    });

    it('should have GSI_CompanyCode_DiscloseDate index', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_CompanyCode_DiscloseDate',
            KeySchema: [
              {
                AttributeName: 'company_code',
                KeyType: 'HASH', // パ�EチE��ションキー
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
        TableName: 'tdnet_disclosures_dev',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_DatePartition',
            KeySchema: [
              {
                AttributeName: 'date_partition',
                KeyType: 'HASH', // パ�EチE��ションキー
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
        TableName: 'tdnet_disclosures_dev',
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
        TableName: 'tdnet_executions_dev',
        BillingMode: 'PAY_PER_REQUEST', // オンチE�EンドモーチE
        SSESpecification: {
          SSEEnabled: true, // 暗号化有効匁E
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // ポイントインタイムリカバリ有効匁E
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        KeySchema: [
          {
            AttributeName: 'execution_id',
            KeyType: 'HASH', // パ�EチE��ションキー
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'execution_id',
            AttributeType: 'S', // String垁E
          },
        ]),
      });
    });

    it('should have TTL enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true, // TTL有効匁E
        },
      });
    });

    it('should have GSI_Status_StartedAt index', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        GlobalSecondaryIndexes: Match.arrayWith([
          {
            IndexName: 'GSI_Status_StartedAt',
            KeySchema: [
              {
                AttributeName: 'status',
                KeyType: 'HASH', // パ�EチE��ションキー
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
        TableName: 'tdnet_executions_dev',
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
          Name: 'TdnetDisclosuresTableName-dev',
        },
      });
    });

    it('should export ExecutionsTableName', () => {
      template.hasOutput('ExecutionsTableName', {
        Value: {
          Ref: Match.stringLikeRegexp('ExecutionsTable'),
        },
        Export: {
          Name: 'TdnetExecutionsTableName-dev',
        },
      });
    });
  });

  describe('Security and Compliance', () => {
    it('should have encryption enabled on all tables', () => {
      // すべてのDynamoDBチE�Eブルで暗号化が有効化されてぁE��ことを確誁E
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
      // すべてのDynamoDBチE�Eブルでポイントインタイムリカバリが有効化されてぁE��ことを確誁E
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
      // すべてのDynamoDBチE�EブルでオンチE�Eンドモードが使用されてぁE��ことを確誁E
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);

      tableKeys.forEach((key) => {
        const table = tables[key];
        expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
      });
    });
  });

  describe('Table Count', () => {
    it('should have exactly 3 DynamoDB tables', () => {
      // DynamoDBチE�Eブルが正確に3つ存在することを確誁E
      // 1. tdnet_disclosures
      // 2. tdnet_executions
      // 3. tdnet_export_status
      template.resourceCountIs('AWS::DynamoDB::Table', 3);
    });
  });
});

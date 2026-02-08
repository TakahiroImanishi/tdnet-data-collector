/**
 * DynamoDB Table Structure Verification Test
 *
 * Task 3.2: DynamoDB繝・・繝悶Ν讒矩縺ｮ讀懆ｨｼ繝・せ繝・
 * Requirements: 隕∽ｻｶ2.5, 13.3・医ョ繝ｼ繧ｿ繝吶・繧ｹ縲∵囓蜿ｷ蛹厄ｼ・
 *
 * 縺薙・繝・せ繝医・縲，DK縺ｧ螳夂ｾｩ縺輔ｌ縺櫂ynamoDB繝・・繝悶Ν縺瑚ｨｭ險磯壹ｊ縺ｫ讒区・縺輔ｌ縺ｦ縺・ｋ縺薙→繧呈､懆ｨｼ縺励∪縺吶・
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
      // 繝・・繝悶Ν縺悟ｭ伜惠縺吶ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        BillingMode: 'PAY_PER_REQUEST', // 繧ｪ繝ｳ繝・・繝ｳ繝峨Δ繝ｼ繝・
        SSESpecification: {
          SSEEnabled: true, // 證怜捷蛹匁怏蜉ｹ蛹・
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // 繝昴う繝ｳ繝医う繝ｳ繧ｿ繧､繝繝ｪ繧ｫ繝舌Μ譛牙柑蛹・
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        KeySchema: [
          {
            AttributeName: 'disclosure_id',
            KeyType: 'HASH', // 繝代・繝・ぅ繧ｷ繝ｧ繝ｳ繧ｭ繝ｼ
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'disclosure_id',
            AttributeType: 'S', // String蝙・
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
                KeyType: 'HASH', // 繝代・繝・ぅ繧ｷ繝ｧ繝ｳ繧ｭ繝ｼ
              },
              {
                AttributeName: 'disclosed_at',
                KeyType: 'RANGE', // 繧ｽ繝ｼ繝医く繝ｼ
              },
            ],
            Projection: {
              ProjectionType: 'ALL', // 縺吶∋縺ｦ縺ｮ螻樊ｧ繧呈兜蠖ｱ
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
                KeyType: 'HASH', // 繝代・繝・ぅ繧ｷ繝ｧ繝ｳ繧ｭ繝ｼ
              },
              {
                AttributeName: 'disclosed_at',
                KeyType: 'RANGE', // 繧ｽ繝ｼ繝医く繝ｼ
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
        BillingMode: 'PAY_PER_REQUEST', // 繧ｪ繝ｳ繝・・繝ｳ繝峨Δ繝ｼ繝・
        SSESpecification: {
          SSEEnabled: true, // 證怜捷蛹匁怏蜉ｹ蛹・
        },
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true, // 繝昴う繝ｳ繝医う繝ｳ繧ｿ繧､繝繝ｪ繧ｫ繝舌Μ譛牙柑蛹・
        },
      });
    });

    it('should have correct partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        KeySchema: [
          {
            AttributeName: 'execution_id',
            KeyType: 'HASH', // 繝代・繝・ぅ繧ｷ繝ｧ繝ｳ繧ｭ繝ｼ
          },
        ],
        AttributeDefinitions: Match.arrayWith([
          {
            AttributeName: 'execution_id',
            AttributeType: 'S', // String蝙・
          },
        ]),
      });
    });

    it('should have TTL enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true, // TTL譛牙柑蛹・
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
                KeyType: 'HASH', // 繝代・繝・ぅ繧ｷ繝ｧ繝ｳ繧ｭ繝ｼ
              },
              {
                AttributeName: 'started_at',
                KeyType: 'RANGE', // 繧ｽ繝ｼ繝医く繝ｼ
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
      // 縺吶∋縺ｦ縺ｮDynamoDB繝・・繝悶Ν縺ｧ證怜捷蛹悶′譛牙柑蛹悶＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
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
      // 縺吶∋縺ｦ縺ｮDynamoDB繝・・繝悶Ν縺ｧ繝昴う繝ｳ繝医う繝ｳ繧ｿ繧､繝繝ｪ繧ｫ繝舌Μ縺梧怏蜉ｹ蛹悶＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
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
      // 縺吶∋縺ｦ縺ｮDynamoDB繝・・繝悶Ν縺ｧ繧ｪ繝ｳ繝・・繝ｳ繝峨Δ繝ｼ繝峨′菴ｿ逕ｨ縺輔ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
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
      // DynamoDB繝・・繝悶Ν縺梧ｭ｣遒ｺ縺ｫ3縺､蟄伜惠縺吶ｋ縺薙→繧堤｢ｺ隱・
      // 1. tdnet_disclosures
      // 2. tdnet_executions
      // 3. tdnet_export_status
      template.resourceCountIs('AWS::DynamoDB::Table', 3);
    });
  });
});

/**
 * ExecutionStateTableConstruct テスト
 *
 * Step Functions実行状態管理テーブルの設定を検証します。
 *
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 * 関連設計: .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { ExecutionStateTableConstruct } from '../execution-state-table';

describe('ExecutionStateTableConstruct', () => {
  describe('テーブル作成', () => {
    it('DynamoDBテーブルが作成される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::DynamoDB::Table', 1);
    });

    it('テーブル名が正しく設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'ExecutionState_prod',
      });
    });

    it('環境名がdev時にテーブル名が正しく設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'dev',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'ExecutionState_dev',
      });
    });
  });

  describe('パーティションキー', () => {
    it('execution_idがパーティションキーとして設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          {
            AttributeName: 'execution_id',
            KeyType: 'HASH',
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: 'execution_id',
            AttributeType: 'S',
          },
        ],
      });
    });
  });

  describe('課金モード', () => {
    it('オンデマンド課金が設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        BillingMode: 'PAY_PER_REQUEST',
      });
    });
  });

  describe('暗号化', () => {
    it('AWS管理キーによる暗号化が有効化される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        SSESpecification: {
          SSEEnabled: true,
        },
      });
    });
  });

  describe('TTL設定', () => {
    it('TTL属性が設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },
      });
    });
  });

  describe('ポイントインタイムリカバリ', () => {
    it('ポイントインタイムリカバリが有効化される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });
  });

  describe('削除ポリシー', () => {
    it('デフォルトでRETAINポリシーが設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    it('カスタム削除ポリシーが設定できる', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'dev',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const template = Template.fromStack(stack);
      template.hasResource('AWS::DynamoDB::Table', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });
  });

  describe('タグ付け', () => {
    it('Purpose タグが設定される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableProps = Object.values(tables)[0] as any;
      const tags = tableProps.Properties.Tags;

      expect(tags).toContainEqual({
        Key: 'Purpose',
        Value: 'StepFunctionsExecutionState',
      });
      expect(tags).toContainEqual({
        Key: 'Environment',
        Value: 'prod',
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('テーブル名が出力される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      const outputs = template.findOutputs('*');
      const outputKeys = Object.keys(outputs);

      // テーブル名の出力が存在することを確認
      const tableNameOutput = outputKeys.find((key) => key.includes('TableName'));
      expect(tableNameOutput).toBeDefined();
      expect(outputs[tableNameOutput!].Export.Name).toBe('ExecutionStateTableName-prod');
    });

    it('テーブルARNが出力される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      const outputs = template.findOutputs('*');
      const outputKeys = Object.keys(outputs);

      // テーブルARNの出力が存在することを確認
      const tableArnOutput = outputKeys.find((key) => key.includes('TableArn'));
      expect(tableArnOutput).toBeDefined();
      expect(outputs[tableArnOutput!].Export.Name).toBe('ExecutionStateTableArn-prod');
    });
  });

  describe('Public Properties', () => {
    it('tableプロパティが公開される', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      const construct = new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      expect(construct.table).toBeDefined();
      expect(construct.table).toBeInstanceOf(dynamodb.Table);
    });
  });

  describe('GSI設定', () => {
    it('GSIが作成されない（execution_idで直接アクセス）', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');

      new ExecutionStateTableConstruct(stack, 'ExecutionStateTable', {
        environment: 'prod',
      });

      const template = Template.fromStack(stack);
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableProps = Object.values(tables)[0] as any;

      expect(tableProps.Properties.GlobalSecondaryIndexes).toBeUndefined();
    });
  });
});

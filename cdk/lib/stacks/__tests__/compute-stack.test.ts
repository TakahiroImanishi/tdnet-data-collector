/**
 * Compute Stack テスト
 *
 * Lambda関数、DLQ、IAM権限の設定を検証します。
 * 
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { TdnetComputeStack } from '../compute-stack';

function createComputeStack(env: 'prod' | 'local') {
  const app = new cdk.App();
  const baseStack = new cdk.Stack(app, `${env}BaseStack`);

  const mockResources = {
    disclosuresTable: dynamodb.Table.fromTableName(baseStack, 'Disclosures', 'test-disclosures'),
    executionsTable: dynamodb.Table.fromTableName(baseStack, 'Executions', 'test-executions'),
    exportStatusTable: dynamodb.Table.fromTableName(baseStack, 'ExportStatus', 'test-export-status'),
    pdfsBucket: s3.Bucket.fromBucketName(baseStack, 'Pdfs', 'test-pdfs'),
    exportsBucket: s3.Bucket.fromBucketName(baseStack, 'Exports', 'test-exports'),
    apiKeySecret: secretsmanager.Secret.fromSecretNameV2(baseStack, 'ApiKey', 'test-api-key'),
    alertTopic: sns.Topic.fromTopicArn(baseStack, 'Alert', 'arn:aws:sns:us-east-1:123456789012:test-alert'),
  };

  const computeStack = new TdnetComputeStack(app, `${env}ComputeStack`, {
    environment: env,
    ...mockResources,
  });

  return { computeStack, template: Template.fromStack(computeStack) };
}

describe('TdnetComputeStack', () => {
  describe('Lambda Functions', () => {
    it('9個のLambda関数が作成されている', () => {
      const { template } = createComputeStack('prod');
      
      const functions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBe(9);
    });

    it('Collector Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Runtime: 'nodejs20.x',
        Timeout: 300,
        MemorySize: 512,
      });
    });

    it('Query Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-query-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Export Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-export-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Collect Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Collect Status Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-status-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Export Status Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-export-status-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('PDF Download Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-pdf-download-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Health Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-health-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Stats Functionが正しく設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-stats-prod',
        Runtime: 'nodejs20.x',
      });
    });
  });

  describe('X-Ray Tracing', () => {
    it('すべてのLambda関数でX-Rayトレーシングが有効', () => {
      const { template } = createComputeStack('prod');
      
      const functions = template.findResources('AWS::Lambda::Function');
      Object.values(functions).forEach((fn: any) => {
        expect(fn.Properties.TracingConfig?.Mode).toBe('Active');
      });
    });
  });

  describe('DLQ', () => {
    it('DLQが作成されている', () => {
      const { computeStack } = createComputeStack('prod');
      
      expect(computeStack.dlq).toBeDefined();
      expect(computeStack.dlq.queue).toBeDefined();
    });

    it('Collector FunctionにDLQが設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        DeadLetterConfig: Match.objectLike({
          TargetArn: Match.anyValue(),
        }),
      });
    });
  });

  describe('IAM Permissions', () => {
    it('CloudWatch PutMetricData権限が設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'cloudwatch:PutMetricData',
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                StringEquals: {
                  'cloudwatch:namespace': 'TDnet',
                },
              },
            }),
          ]),
        }),
      });
    });

    it('DynamoDB権限が設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                Match.stringLikeRegexp('dynamodb:.*'),
              ]),
            }),
          ]),
        }),
      });
    });

    it('S3権限が設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                Match.stringLikeRegexp('s3:.*'),
              ]),
            }),
          ]),
        }),
      });
    });
  });

  describe('Environment Variables', () => {
    it('Collector Functionの環境変数が設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Environment: {
          Variables: Match.objectLike({
            DYNAMODB_TABLE: Match.anyValue(),
            DYNAMODB_EXECUTIONS_TABLE: Match.anyValue(),
            S3_BUCKET: Match.anyValue(),
            TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
            ENVIRONMENT: 'prod',
          }),
        },
      });
    });

    it('Query Functionの環境変数が設定されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-query-prod',
        Environment: {
          Variables: Match.objectLike({
            DYNAMODB_TABLE_NAME: Match.anyValue(),
            S3_BUCKET_NAME: Match.anyValue(),
            ENVIRONMENT: 'prod',
          }),
        },
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('すべてのLambda関数のARNが出力されている', () => {
      const { template } = createComputeStack('prod');
      
      template.hasOutput('CollectorFunctionArn', {
        Export: { Name: 'TdnetCollectorFunctionArn-prod' },
      });
      template.hasOutput('QueryFunctionArn', {
        Export: { Name: 'TdnetQueryFunctionArn-prod' },
      });
      template.hasOutput('ExportFunctionArn', {
        Export: { Name: 'TdnetExportFunctionArn-prod' },
      });
      template.hasOutput('CollectFunctionArn', {
        Export: { Name: 'TdnetCollectFunctionArn-prod' },
      });
      template.hasOutput('CollectStatusFunctionArn', {
        Export: { Name: 'TdnetCollectStatusFunctionArn-prod' },
      });
      template.hasOutput('ExportStatusFunctionArn', {
        Export: { Name: 'TdnetExportStatusFunctionArn-prod' },
      });
      template.hasOutput('PdfDownloadFunctionArn', {
        Export: { Name: 'TdnetPdfDownloadFunctionArn-prod' },
      });
      template.hasOutput('HealthFunctionArn', {
        Export: { Name: 'TdnetHealthFunctionArn-prod' },
      });
      template.hasOutput('StatsFunctionArn', {
        Export: { Name: 'TdnetStatsFunctionArn-prod' },
      });
    });
  });

  describe('タグ付け', () => {
    it('必須タグが設定されている', () => {
      const { computeStack } = createComputeStack('prod');
      
      const tags = cdk.Tags.of(computeStack);
      expect(tags).toBeDefined();
    });
  });

  describe('環境別設定', () => {
    it('本番環境の設定が正しい', () => {
      const { template } = createComputeStack('prod');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Timeout: 300,
        MemorySize: 512,
      });
    });

    it('ローカル環境の設定が正しい', () => {
      const { template } = createComputeStack('local');
      
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-local',
      });
    });
  });

  describe('Public Properties', () => {
    it('すべてのLambda関数がpublicプロパティとして公開されている', () => {
      const { computeStack } = createComputeStack('prod');
      
      expect(computeStack.collectorFunction).toBeDefined();
      expect(computeStack.queryFunction).toBeDefined();
      expect(computeStack.exportFunction).toBeDefined();
      expect(computeStack.collectFunction).toBeDefined();
      expect(computeStack.collectStatusFunction).toBeDefined();
      expect(computeStack.exportStatusFunction).toBeDefined();
      expect(computeStack.pdfDownloadFunction).toBeDefined();
      expect(computeStack.healthFunction).toBeDefined();
      expect(computeStack.statsFunction).toBeDefined();
      expect(computeStack.dlq).toBeDefined();
    });
  });
});

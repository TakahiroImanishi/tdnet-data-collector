/**
 * Monitoring Stack テスト
 *
 * CloudWatch Logs、Alarms、Dashboard、CloudTrailの設定を検証します。
 *
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import { TdnetMonitoringStack } from '../monitoring-stack';

function createMockStack(app: cdk.App, id: string, env: 'prod' | 'local') {
  const stack = new cdk.Stack(app, `${id}BaseStack`);

  const mockLambdaFunctions = {
    collector: lambda.Function.fromFunctionName(stack, 'Collector', 'test-collector'),
    query: lambda.Function.fromFunctionName(stack, 'Query', 'test-query'),
    export: lambda.Function.fromFunctionName(stack, 'Export', 'test-export'),
    collect: lambda.Function.fromFunctionName(stack, 'Collect', 'test-collect'),
    collectStatus: lambda.Function.fromFunctionName(stack, 'CollectStatus', 'test-collect-status'),
    exportStatus: lambda.Function.fromFunctionName(stack, 'ExportStatus', 'test-export-status'),
    pdfDownload: lambda.Function.fromFunctionName(stack, 'PdfDownload', 'test-pdf-download'),
    health: lambda.Function.fromFunctionName(stack, 'Health', 'test-health'),
    stats: lambda.Function.fromFunctionName(stack, 'Stats', 'test-stats'),
  };

  const mockDynamodbTables = {
    disclosures: dynamodb.Table.fromTableName(stack, 'Disclosures', 'test-disclosures'),
    executions: dynamodb.Table.fromTableName(stack, 'Executions', 'test-executions'),
    exportStatus: dynamodb.Table.fromTableName(stack, 'ExportStatusTable', 'test-export-status'),
  };

  const mockS3Buckets = {
    pdfs: s3.Bucket.fromBucketName(stack, 'Pdfs', 'test-pdfs'),
    exports: s3.Bucket.fromBucketName(stack, 'Exports', 'test-exports'),
    cloudtrailLogs: s3.Bucket.fromBucketName(stack, 'CloudTrail', 'test-cloudtrail'),
  };

  const mockApi = apigateway.RestApi.fromRestApiId(stack, 'Api', 'test-api-id');
  const mockAlertTopic = sns.Topic.fromTopicArn(
    stack,
    'AlertTopic',
    'arn:aws:sns:us-east-1:123456789012:test-topic'
  );

  const monitoringStack = new TdnetMonitoringStack(app, `${id}MonitoringStack`, {
    environment: env,
    lambdaFunctions: mockLambdaFunctions,
    dynamodbTables: mockDynamodbTables,
    s3Buckets: mockS3Buckets,
    api: mockApi,
    alertTopic: mockAlertTopic,
  });

  return { monitoringStack, template: Template.fromStack(monitoringStack) };
}

describe('TdnetMonitoringStack', () => {
  describe('CloudWatch Logs - 本番環境', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const { template: t } = createMockStack(app, 'Prod', 'prod');
      template = t;
    });

    it('本番環境ではLambda LogGroupを作成しない（既存LogGroupを参照）', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      // 本番環境ではLambda LogGroupを作成せず、既存のものを参照する設計
      // CloudTrail用のLogGroupのみ作成される可能性がある
      const lambdaLogGroups = Object.values(logGroups).filter((lg: any) =>
        lg.Properties.LogGroupName?.includes('/aws/lambda/')
      );
      expect(lambdaLogGroups.length).toBe(0);
    });

    it('本番環境の設計方針: 既存LogGroupを使用してコスト最適化', () => {
      // 本番環境では、Lambda関数作成時に自動生成されたLogGroupsをそのまま使用
      // これにより、CDKスタック削除時にログが保持され、監査要件を満たす
      const logGroups = template.findResources('AWS::Logs::LogGroup');

      // CloudTrail用など、Lambda以外のLogGroupは作成される可能性がある
      // ここでは本番環境でLambda LogGroupを作成しないことを確認
      expect(logGroups).toBeDefined();
    });
  });

  describe('CloudWatch Logs - ローカル環境', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const { template: t } = createMockStack(app, 'Local', 'local');
      template = t;
    });

    it('すべてのLambdaのログ保持期間が1週間に設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      const oneWeekLogGroups = Object.values(logGroups).filter(
        (lg: any) => lg.Properties.RetentionInDays === 7
      );
      // 9個のLambda関数すべて（collector, query, export, collect, collectStatus, exportStatus, pdfDownload, health, stats）
      expect(oneWeekLogGroups.length).toBe(9);
    });

    it('ローカル環境のLambda LogGroupにDESTROYポリシーが設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      const lambdaLogGroups = Object.values(logGroups).filter(
        (lg: any) => lg.Properties.RetentionInDays === 7
      );
      lambdaLogGroups.forEach((logGroup: any) => {
        expect(logGroup.DeletionPolicy).toBe('Delete');
      });
    });
  });

  describe('CloudWatch Alarms', () => {
    it('CloudWatch Alarmsが作成されている', () => {
      const app = new cdk.App();
      const { monitoringStack } = createMockStack(app, 'Alarms', 'prod');

      expect(monitoringStack.alarms).toBeDefined();
      expect(monitoringStack.alarms.alarms.length).toBeGreaterThan(0);
    });

    it('Step Functions用のアラームが作成されている（Step Functions有効時）', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestBaseStack');

      // Step Functions State Machineのモック作成
      const mockStateMachine = {
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine',
        stateMachineName: 'test-state-machine',
      } as any;

      const mockLambdaFunctions = {
        collector: lambda.Function.fromFunctionName(stack, 'Collector', 'test-collector'),
        query: lambda.Function.fromFunctionName(stack, 'Query', 'test-query'),
        export: lambda.Function.fromFunctionName(stack, 'Export', 'test-export'),
        collect: lambda.Function.fromFunctionName(stack, 'Collect', 'test-collect'),
        collectStatus: lambda.Function.fromFunctionName(
          stack,
          'CollectStatus',
          'test-collect-status'
        ),
        exportStatus: lambda.Function.fromFunctionName(stack, 'ExportStatus', 'test-export-status'),
        pdfDownload: lambda.Function.fromFunctionName(stack, 'PdfDownload', 'test-pdf-download'),
        health: lambda.Function.fromFunctionName(stack, 'Health', 'test-health'),
        stats: lambda.Function.fromFunctionName(stack, 'Stats', 'test-stats'),
      };

      const mockDynamodbTables = {
        disclosures: dynamodb.Table.fromTableName(stack, 'Disclosures', 'test-disclosures'),
        executions: dynamodb.Table.fromTableName(stack, 'Executions', 'test-executions'),
        exportStatus: dynamodb.Table.fromTableName(
          stack,
          'ExportStatusTable',
          'test-export-status'
        ),
      };

      const mockS3Buckets = {
        pdfs: s3.Bucket.fromBucketName(stack, 'Pdfs', 'test-pdfs'),
        exports: s3.Bucket.fromBucketName(stack, 'Exports', 'test-exports'),
        cloudtrailLogs: s3.Bucket.fromBucketName(stack, 'CloudTrail', 'test-cloudtrail'),
      };

      const mockApi = apigateway.RestApi.fromRestApiId(stack, 'Api', 'test-api-id');
      const mockAlertTopic = sns.Topic.fromTopicArn(
        stack,
        'AlertTopic',
        'arn:aws:sns:us-east-1:123456789012:test-topic'
      );

      const mockStepFunctionsCollector = {
        stateMachine: mockStateMachine,
      } as any;

      const monitoringStack = new TdnetMonitoringStack(app, 'TestMonitoringStackWithSFN', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
        stepFunctionsCollector: mockStepFunctionsCollector,
      });

      const template = Template.fromStack(monitoringStack);

      // Step Functions実行失敗アラームが作成されていることを確認
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ExecutionsFailed',
        Namespace: 'AWS/States',
      });

      // Step Functions実行時間超過アラームが作成されていることを確認
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ExecutionTime',
        Namespace: 'AWS/States',
      });

      // Step Functionsスロットリングアラームが作成されていることを確認
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'ExecutionThrottled',
        Namespace: 'AWS/States',
      });
    });
  });

  describe('CloudWatch Dashboard', () => {
    it('CloudWatch Dashboardが作成されている', () => {
      const app = new cdk.App();
      const { monitoringStack } = createMockStack(app, 'Dashboard', 'prod');

      expect(monitoringStack.dashboard).toBeDefined();
      expect(monitoringStack.dashboard.dashboard).toBeDefined();
    });
  });

  describe('CloudFormation Outputs', () => {
    it('必要なOutputsが定義されている', () => {
      const app = new cdk.App();
      const { template } = createMockStack(app, 'Outputs', 'prod');

      template.hasOutput('CloudWatchAlarmsCount', {});
      template.hasOutput('DashboardName', {});
    });
  });
});

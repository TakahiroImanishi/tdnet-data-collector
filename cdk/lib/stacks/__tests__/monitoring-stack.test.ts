/**
 * Monitoring Stack テスト
 *
 * CloudWatch Logs、Alarms、Dashboard、CloudTrailの設定を検証します。
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import { TdnetMonitoringStack } from '../monitoring-stack';

function createMockStack(app: cdk.App, id: string, env: 'prod' | 'dev') {
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

    it('Collector Lambdaのログ保持期間が3ヶ月に設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      const collectorLogGroup = Object.values(logGroups).find(
        (lg: any) => lg.Properties.RetentionInDays === 90
      );
      expect(collectorLogGroup).toBeDefined();
      expect(collectorLogGroup.Properties.RetentionInDays).toBe(90);
    });

    it('その他のLambdaのログ保持期間が1ヶ月に設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      const oneMonthLogGroups = Object.values(logGroups).filter(
        (lg: any) => lg.Properties.RetentionInDays === 30
      );
      // 8個のLambda関数（collector以外の9個中8個）
      expect(oneMonthLogGroups.length).toBe(8);
    });

    it('本番環境のLogGroupにRETAINポリシーが設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      Object.values(logGroups).forEach((logGroup: any) => {
        expect(logGroup.DeletionPolicy).toBe('Retain');
      });
    });

    it('9個のLambda LogGroupが作成されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      
      // Lambda LogGroupの数を確認（RetentionInDaysが7, 30, 90のもの）
      const lambdaLogGroups = Object.values(logGroups).filter(
        (lg: any) => [7, 30, 90].includes(lg.Properties.RetentionInDays)
      );
      expect(lambdaLogGroups.length).toBe(9);
    });
  });

  describe('CloudWatch Logs - 開発環境', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const { template: t } = createMockStack(app, 'Dev', 'dev');
      template = t;
    });

    it('すべてのLambdaのログ保持期間が1週間に設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      const oneWeekLogGroups = Object.values(logGroups).filter(
        (lg: any) => lg.Properties.RetentionInDays === 7
      );
      // 9個のLambda関数すべて
      expect(oneWeekLogGroups.length).toBe(9);
    });

    it('開発環境のLambda LogGroupにDESTROYポリシーが設定されている', () => {
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

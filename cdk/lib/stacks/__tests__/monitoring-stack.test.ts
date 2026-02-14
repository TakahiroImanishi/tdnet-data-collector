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
import * as logs from 'aws-cdk-lib/aws-logs';
import { TdnetMonitoringStack } from '../monitoring-stack';

describe('TdnetMonitoringStack', () => {
  describe('CloudWatch Logs - 本番環境', () => {
    let app: cdk.App;
    let stack: cdk.Stack;
    let monitoringStack: TdnetMonitoringStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');

      // Mock Lambda Functions
      const mockLambdaFunctions = {
        collector: lambda.Function.fromFunctionName(stack, 'MockCollector', 'test-collector'),
        query: lambda.Function.fromFunctionName(stack, 'MockQuery', 'test-query'),
        export: lambda.Function.fromFunctionName(stack, 'MockExport', 'test-export'),
        collect: lambda.Function.fromFunctionName(stack, 'MockCollect', 'test-collect'),
        collectStatus: lambda.Function.fromFunctionName(
          stack,
          'MockCollectStatus',
          'test-collect-status'
        ),
        exportStatus: lambda.Function.fromFunctionName(
          stack,
          'MockExportStatus',
          'test-export-status'
        ),
        pdfDownload: lambda.Function.fromFunctionName(
          stack,
          'MockPdfDownload',
          'test-pdf-download'
        ),
        health: lambda.Function.fromFunctionName(stack, 'MockHealth', 'test-health'),
        stats: lambda.Function.fromFunctionName(stack, 'MockStats', 'test-stats'),
      };

      // Mock DynamoDB Tables
      const mockDynamodbTables = {
        disclosures: dynamodb.Table.fromTableName(stack, 'MockDisclosures', 'test-disclosures'),
        executions: dynamodb.Table.fromTableName(stack, 'MockExecutions', 'test-executions'),
        exportStatus: dynamodb.Table.fromTableName(
          stack,
          'MockExportStatus',
          'test-export-status'
        ),
      };

      // Mock S3 Buckets
      const mockS3Buckets = {
        pdfs: s3.Bucket.fromBucketName(stack, 'MockPdfs', 'test-pdfs'),
        exports: s3.Bucket.fromBucketName(stack, 'MockExports', 'test-exports'),
        cloudtrailLogs: s3.Bucket.fromBucketName(stack, 'MockCloudTrail', 'test-cloudtrail'),
      };

      // Mock API Gateway
      const mockApi = apigateway.RestApi.fromRestApiId(stack, 'MockApi', 'test-api-id');

      // Mock SNS Topic
      const mockAlertTopic = sns.Topic.fromTopicArn(
        stack,
        'MockAlertTopic',
        'arn:aws:sns:us-east-1:123456789012:test-topic'
      );

      monitoringStack = new TdnetMonitoringStack(app, 'ProdMonitoringStack', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
      });
      template = Template.fromStack(monitoringStack);
    });

    it('Collector Lambdaのログ保持期間が3ヶ月に設定されている', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/lambda/test-collector',
        RetentionInDays: 90, // 3ヶ月
      });
    });

    it('その他のLambdaのログ保持期間が1ヶ月に設定されている', () => {
      const otherFunctions = [
        'test-query',
        'test-export',
        'test-collect',
        'test-collect-status',
        'test-export-status',
        'test-pdf-download',
        'test-health',
        'test-stats',
      ];

      otherFunctions.forEach((functionName) => {
        template.hasResourceProperties('AWS::Logs::LogGroup', {
          LogGroupName: `/aws/lambda/${functionName}`,
          RetentionInDays: 30, // 1ヶ月
        });
      });
    });

    it('本番環境のLogGroupにRETAINポリシーが設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      Object.values(logGroups).forEach((logGroup: any) => {
        expect(logGroup.DeletionPolicy).toBe('Retain');
      });
    });

    it('9個のLogGroupが作成されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      expect(Object.keys(logGroups).length).toBe(9);
    });
  });

  describe('CloudWatch Logs - 開発環境', () => {
    let app: cdk.App;
    let stack: cdk.Stack;
    let monitoringStack: TdnetMonitoringStack;
    let template: Template;

    beforeEach(() => {
      app = new cdk.App();
      stack = new cdk.Stack(app, 'DevTestStack');

      // Mock Lambda Functions
      const mockLambdaFunctions = {
        collector: lambda.Function.fromFunctionName(stack, 'MockCollector', 'test-collector'),
        query: lambda.Function.fromFunctionName(stack, 'MockQuery', 'test-query'),
        export: lambda.Function.fromFunctionName(stack, 'MockExport', 'test-export'),
        collect: lambda.Function.fromFunctionName(stack, 'MockCollect', 'test-collect'),
        collectStatus: lambda.Function.fromFunctionName(
          stack,
          'MockCollectStatus',
          'test-collect-status'
        ),
        exportStatus: lambda.Function.fromFunctionName(
          stack,
          'MockExportStatus',
          'test-export-status'
        ),
        pdfDownload: lambda.Function.fromFunctionName(
          stack,
          'MockPdfDownload',
          'test-pdf-download'
        ),
        health: lambda.Function.fromFunctionName(stack, 'MockHealth', 'test-health'),
        stats: lambda.Function.fromFunctionName(stack, 'MockStats', 'test-stats'),
      };

      // Mock DynamoDB Tables
      const mockDynamodbTables = {
        disclosures: dynamodb.Table.fromTableName(stack, 'MockDisclosures', 'test-disclosures'),
        executions: dynamodb.Table.fromTableName(stack, 'MockExecutions', 'test-executions'),
        exportStatus: dynamodb.Table.fromTableName(
          stack,
          'MockExportStatus',
          'test-export-status'
        ),
      };

      // Mock S3 Buckets
      const mockS3Buckets = {
        pdfs: s3.Bucket.fromBucketName(stack, 'MockPdfs', 'test-pdfs'),
        exports: s3.Bucket.fromBucketName(stack, 'MockExports', 'test-exports'),
        cloudtrailLogs: s3.Bucket.fromBucketName(stack, 'MockCloudTrail', 'test-cloudtrail'),
      };

      // Mock API Gateway
      const mockApi = apigateway.RestApi.fromRestApiId(stack, 'MockApi', 'test-api-id');

      // Mock SNS Topic
      const mockAlertTopic = sns.Topic.fromTopicArn(
        stack,
        'MockAlertTopic',
        'arn:aws:sns:us-east-1:123456789012:test-topic'
      );

      monitoringStack = new TdnetMonitoringStack(app, 'DevMonitoringStack', {
        environment: 'dev',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
      });
      template = Template.fromStack(monitoringStack);
    });

    it('すべてのLambdaのログ保持期間が1週間に設定されている', () => {
      const allFunctions = [
        'test-collector',
        'test-query',
        'test-export',
        'test-collect',
        'test-collect-status',
        'test-export-status',
        'test-pdf-download',
        'test-health',
        'test-stats',
      ];

      allFunctions.forEach((functionName) => {
        template.hasResourceProperties('AWS::Logs::LogGroup', {
          LogGroupName: `/aws/lambda/${functionName}`,
          RetentionInDays: 7, // 1週間
        });
      });
    });

    it('開発環境のLogGroupにDESTROYポリシーが設定されている', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup');
      Object.values(logGroups).forEach((logGroup: any) => {
        expect(logGroup.DeletionPolicy).toBe('Delete');
      });
    });
  });

  describe('CloudWatch Alarms', () => {
    it('CloudWatch Alarmsが作成されている', () => {
      const monitoringStack = new TdnetMonitoringStack(app, 'MonitoringStack', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
      });

      expect(monitoringStack.alarms).toBeDefined();
      expect(monitoringStack.alarms.alarms.length).toBeGreaterThan(0);
    });
  });

  describe('CloudWatch Dashboard', () => {
    it('CloudWatch Dashboardが作成されている', () => {
      const monitoringStack = new TdnetMonitoringStack(app, 'MonitoringStack', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
      });

      expect(monitoringStack.dashboard).toBeDefined();
      expect(monitoringStack.dashboard.dashboard).toBeDefined();
    });
  });

  describe('CloudFormation Outputs', () => {
    it('必要なOutputsが定義されている', () => {
      const monitoringStack = new TdnetMonitoringStack(app, 'MonitoringStack', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        api: mockApi,
        alertTopic: mockAlertTopic,
      });

      const template = Template.fromStack(monitoringStack);

      template.hasOutput('CloudWatchAlarmsCount', {});
      template.hasOutput('DashboardName', {});
    });
  });
});

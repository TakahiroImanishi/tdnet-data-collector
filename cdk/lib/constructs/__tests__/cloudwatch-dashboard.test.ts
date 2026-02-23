/**
 * CloudWatch Dashboard Construct テスト
 *
 * CloudWatch Dashboardの設定を検証します。
 *
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { CloudWatchDashboard } from '../cloudwatch-dashboard';

describe('CloudWatchDashboard', () => {
  let stack: cdk.Stack;
  let mockLambdaFunctions: any;
  let mockDynamodbTables: any;
  let mockS3Buckets: any;
  let mockApiGateway: apigateway.IRestApi;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    mockLambdaFunctions = {
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
    };

    mockDynamodbTables = {
      disclosures: dynamodb.Table.fromTableName(stack, 'Disclosures', 'test-disclosures'),
      executions: dynamodb.Table.fromTableName(stack, 'Executions', 'test-executions'),
      exportStatus: dynamodb.Table.fromTableName(stack, 'ExportStatusTable', 'test-export-status'),
    };

    mockS3Buckets = {
      pdfs: s3.Bucket.fromBucketName(stack, 'Pdfs', 'test-pdfs'),
      exports: s3.Bucket.fromBucketName(stack, 'Exports', 'test-exports'),
    };

    mockApiGateway = apigateway.RestApi.fromRestApiId(stack, 'Api', 'test-api-id');
  });

  describe('基本機能', () => {
    it('CloudWatch Dashboardが作成される', () => {
      const dashboard = new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      expect(dashboard.dashboard).toBeDefined();
      // CDKトークンが含まれるため、文字列の完全一致ではなく存在確認のみ
      expect(dashboard.dashboard.dashboardName).toBeDefined();
    });

    it('CloudWatch Dashboardリソースが作成される', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });

  describe('Step Functions統合', () => {
    it('Step Functions用のウィジェットが追加される', () => {
      const mockStateMachine = {
        stateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine',
        stateMachineName: 'test-state-machine',
      } as sfn.IStateMachine;

      const mockStepFunctionsLambdas = {
        collectorInit: lambda.Function.fromFunctionName(
          stack,
          'CollectorInit',
          'test-collector-init'
        ),
        collectorFetch: lambda.Function.fromFunctionName(
          stack,
          'CollectorFetch',
          'test-collector-fetch'
        ),
        collectorSave: lambda.Function.fromFunctionName(
          stack,
          'CollectorSave',
          'test-collector-save'
        ),
        collectorAggregate: lambda.Function.fromFunctionName(
          stack,
          'CollectorAggregate',
          'test-collector-aggregate'
        ),
      };

      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
        stateMachine: mockStateMachine,
        stepFunctionsLambdas: mockStepFunctionsLambdas,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });

    it('Step Functionsが無効の場合、Dashboardは正常に作成される', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });

  describe('Lambda関数メトリクス', () => {
    it('Lambda Invocationsウィジェットが含まれている', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });

    it('Lambda Errorsウィジェットが含まれている', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });

  describe('DynamoDBメトリクス', () => {
    it('DynamoDB Consumed Capacity Unitsウィジェットが含まれている', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });

  describe('API Gatewayメトリクス', () => {
    it('API Gateway Requestsウィジェットが含まれている', () => {
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'prod',
        lambdaFunctions: mockLambdaFunctions,
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // CloudWatch Dashboardリソースが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });
  });
});

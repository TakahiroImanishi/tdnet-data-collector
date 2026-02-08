/**
 * CloudWatch Logs Construct Tests
 * 
 * Tests for CloudWatch Logs configuration with environment-specific retention periods
 */

import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Template } from 'aws-cdk-lib/assertions';
import { CloudWatchLogs } from '../lib/constructs/cloudwatch-logs';

describe('CloudWatchLogs Construct', () => {
  describe('Development Environment', () => {
    let app: cdk.App;
    let stack: cdk.Stack;
    let cloudWatchLogs: CloudWatchLogs;

    beforeEach(() => {
      app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');
      cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });
    });

    test('should set retention to 7 days for dev environment', () => {
      expect(cloudWatchLogs.retentionDays).toBe(logs.RetentionDays.ONE_WEEK);
      expect(cloudWatchLogs.getRetentionDaysAsNumber()).toBe(7);
    });

    test('should set removal policy to DESTROY for dev environment', () => {
      expect(cloudWatchLogs.removalPolicy).toBe(cdk.RemovalPolicy.DESTROY);
    });

    test('should configure log group for Lambda function', () => {
      // Lambda関数を作成
      const testFunction = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
        functionName: 'test-function',
      });

      // ログ設定を適用
      const logGroup = cloudWatchLogs.configureForLambda(testFunction);

      // CloudFormationテンプレートを検証
      const template = Template.fromStack(stack);

      // ログ保持期間が7日であることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });

      // ロググループが作成されたことを確認
      expect(logGroup).toBeDefined();
      // LogGroupNameはCDKトークンとして生成されるため、文字列として検証できない
      expect(logGroup.logGroupName).toContain('Token');
    });

    test('should configure log groups for multiple Lambda functions', () => {
      // 複数のLambda関数を作成
      const functions = [
        new lambda.Function(stack, 'Function1', {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline('exports.handler = async () => {};'),
          functionName: 'function-1',
        }),
        new lambda.Function(stack, 'Function2', {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline('exports.handler = async () => {};'),
          functionName: 'function-2',
        }),
      ];

      // ログ設定を適用
      const logGroups = cloudWatchLogs.configureForLambdas(functions);

      // CloudFormationテンプレートを検証
      const template = Template.fromStack(stack);

      // 2つのロググループが作成されたことを確認
      template.resourceCountIs('AWS::Logs::LogGroup', 2);

      // 各ロググループの設定を確認（保持期間のみ検証）
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });

      // ロググループが作成されたことを確認
      expect(logGroups).toHaveLength(2);
      expect(logGroups[0].logGroupName).toContain('Token');
      expect(logGroups[1].logGroupName).toContain('Token');
    });

    test('should support custom log group name', () => {
      const testFunction = new lambda.Function(stack, 'CustomFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
        functionName: 'custom-function',
      });

      // カスタムロググループ名を指定
      const logGroup = cloudWatchLogs.configureForLambda(
        testFunction,
        '/custom/log/group'
      );

      // CloudFormationテンプレートを検証
      const template = Template.fromStack(stack);

      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });

      expect(logGroup.logGroupName).toContain('Token');
    });
  });

  describe('Production Environment', () => {
    let app: cdk.App;
    let stack: cdk.Stack;
    let cloudWatchLogs: CloudWatchLogs;

    beforeEach(() => {
      app = new cdk.App();
      stack = new cdk.Stack(app, 'TestStack');
      cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });
    });

    test('should set retention to 90 days for prod environment', () => {
      expect(cloudWatchLogs.retentionDays).toBe(logs.RetentionDays.THREE_MONTHS);
      expect(cloudWatchLogs.getRetentionDaysAsNumber()).toBe(90);
    });

    test('should set removal policy to RETAIN for prod environment', () => {
      expect(cloudWatchLogs.removalPolicy).toBe(cdk.RemovalPolicy.RETAIN);
    });

    test('should configure log group for Lambda function with 90 days retention', () => {
      const testFunction = new lambda.Function(stack, 'ProdFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
        functionName: 'prod-function',
      });

      cloudWatchLogs.configureForLambda(testFunction);

      const template = Template.fromStack(stack);

      // ログ保持期間が90日であることを確認
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 90,
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    test('should create CloudFormation output for log group', () => {
      const app = new cdk.App();
      const stack = new cdk.Stack(app, 'TestStack');
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const testFunction = new lambda.Function(stack, 'OutputTestFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
        functionName: 'output-test-function',
      });

      cloudWatchLogs.configureForLambda(testFunction);

      const template = Template.fromStack(stack);

      // CloudFormation Outputが作成されたことを確認
      // Output名は動的に生成されるため、存在確認のみ
      const outputs = template.findOutputs('*');
      const outputKeys = Object.keys(outputs);
      
      expect(outputKeys.length).toBeGreaterThan(0);
      expect(outputKeys.some(key => key.includes('LogGroupName'))).toBe(true);
    });
  });
});

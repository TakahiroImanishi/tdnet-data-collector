import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CloudWatchLogs } from '../lib/constructs/cloudwatch-logs';

describe('CloudWatchLogs Construct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
  });

  describe('環境別ログ保持期間設定', () => {
    it('should set 90 days retention for prod environment', () => {
      // Arrange & Act
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });

      // Assert
      expect(cloudWatchLogs.retentionDays).toBe(logs.RetentionDays.THREE_MONTHS);
      expect(cloudWatchLogs.removalPolicy).toBe(cdk.RemovalPolicy.RETAIN);
    });

    it('should set 7 days retention for dev environment', () => {
      // Arrange & Act
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      // Assert
      expect(cloudWatchLogs.retentionDays).toBe(logs.RetentionDays.ONE_WEEK);
      expect(cloudWatchLogs.removalPolicy).toBe(cdk.RemovalPolicy.DESTROY);
    });
  });

  describe('Lambda関数のログ設定', () => {
    it('should configure log group for Lambda function with default name', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        functionName: 'test-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      const logGroup = cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      expect(logGroup).toBeDefined();
      
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: Match.anyValue(), // トークンなので任意の値
        RetentionInDays: 7, // dev環境
      });
    });

    it('should configure log group for Lambda function with custom name', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        functionName: 'test-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      const logGroup = cloudWatchLogs.configureForLambda(
        testLambda,
        '/custom/log/group'
      );

      // Assert
      expect(logGroup).toBeDefined();
      
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/custom/log/group',
        RetentionInDays: 90, // prod環境
      });
    });

    it('should apply RETAIN removal policy for prod environment', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        functionName: 'test-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResource('AWS::Logs::LogGroup', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    it('should apply DESTROY removal policy for dev environment', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        functionName: 'test-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResource('AWS::Logs::LogGroup', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });

    it('should create CloudFormation output for log group', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        functionName: 'test-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      // CloudFormation Outputが作成されていることを確認
      template.hasOutput('*', {
        Description: Match.anyValue(),
        Export: {
          Name: Match.anyValue(),
        },
      });
    });
  });

  describe('複数Lambda関数のログ設定', () => {
    it('should configure log groups for multiple Lambda functions', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const lambda1 = new lambda.Function(stack, 'Lambda1', {
        functionName: 'function-1',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      const lambda2 = new lambda.Function(stack, 'Lambda2', {
        functionName: 'function-2',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      const logGroups = cloudWatchLogs.configureForLambdas([lambda1, lambda2]);

      // Assert
      expect(logGroups).toHaveLength(2);
      expect(logGroups[0]).toBeDefined();
      expect(logGroups[1]).toBeDefined();

      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Logs::LogGroup', 2);
    });

    it('should handle empty Lambda functions array', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      // Act
      const logGroups = cloudWatchLogs.configureForLambdas([]);

      // Assert
      expect(logGroups).toHaveLength(0);
    });
  });

  describe('保持期間の数値取得', () => {
    it('should return 7 for ONE_WEEK retention', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      // Act
      const days = cloudWatchLogs.getRetentionDaysAsNumber();

      // Assert
      expect(days).toBe(7);
    });

    it('should return 90 for THREE_MONTHS retention', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });

      // Act
      const days = cloudWatchLogs.getRetentionDaysAsNumber();

      // Assert
      expect(days).toBe(90);
    });

    it('should throw error for unexpected retention days', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      // 内部的にretentionDaysを不正な値に変更（テスト用）
      // @ts-ignore - テストのために型チェックを無視
      cloudWatchLogs.retentionDays = 999;

      // Act & Assert
      expect(() => {
        cloudWatchLogs.getRetentionDaysAsNumber();
      }).toThrow('Unexpected retention days: 999');
    });
  });

  describe('環境別の統合テスト', () => {
    it('should configure complete logging setup for prod environment', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'prod',
      });

      const testLambda = new lambda.Function(stack, 'ProdLambda', {
        functionName: 'prod-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      
      // ログ保持期間: 90日
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 90,
      });

      // 削除ポリシー: RETAIN
      template.hasResource('AWS::Logs::LogGroup', {
        DeletionPolicy: 'Retain',
      });

      // CloudFormation Output
      template.hasOutput('*', {
        Description: Match.anyValue(),
      });
    });

    it('should configure complete logging setup for dev environment', () => {
      // Arrange
      const cloudWatchLogs = new CloudWatchLogs(stack, 'CloudWatchLogs', {
        environment: 'dev',
      });

      const testLambda = new lambda.Function(stack, 'DevLambda', {
        functionName: 'dev-function',
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      cloudWatchLogs.configureForLambda(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      
      // ログ保持期間: 7日
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });

      // 削除ポリシー: DESTROY
      template.hasResource('AWS::Logs::LogGroup', {
        DeletionPolicy: 'Delete',
      });

      // CloudFormation Output
      template.hasOutput('*', {
        Description: Match.anyValue(),
      });
    });
  });
});

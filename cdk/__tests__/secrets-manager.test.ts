import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SecretsManagerConstruct } from '../lib/constructs/secrets-manager';

describe('SecretsManagerConstruct', () => {
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

  describe('APIキーシークレット作成', () => {
    it('should create API key secret with correct name', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: '/tdnet/api-key',
        Description: 'TDnet API Key for authentication',
      });
    });

    it('should use RETAIN removal policy', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'prod',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResource('AWS::SecretsManager::Secret', {
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });

    it('should generate secret string with correct configuration', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        GenerateSecretString: {
          SecretStringTemplate: '{"apiKey":""}',
          GenerateStringKey: 'apiKey',
          ExcludePunctuation: true,
          PasswordLength: 32,
        },
      });
    });
  });

  describe('自動ローテーション設定', () => {
    it('should create rotation function when enableRotation is true', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-api-key-rotation-dev',
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 30,
        MemorySize: 128,
      });
    });

    it('should NOT create rotation function when enableRotation is false', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: false,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::Lambda::Function', 0);
    });

    it('should create rotation schedule with default 90 days', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: {
          ScheduleExpression: 'rate(90 days)',
        },
      });
    });

    it('should create rotation schedule with custom rotation days', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'prod',
        enableRotation: true,
        rotationDays: 30,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: {
          ScheduleExpression: 'rate(30 days)',
        },
      });
    });

    it('should grant read and write permissions to rotation function', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      
      // ローテーション関数にシークレット読み取り権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
              Effect: 'Allow',
            }),
          ]),
        },
      });

      // ローテーション関数にシークレット書き込み権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'secretsmanager:PutSecretValue',
                'secretsmanager:UpdateSecretVersionStage',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('Lambda関数への権限付与', () => {
    it('should grant read permission to Lambda function', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: false,
      });

      const testLambda = new lambda.Function(stack, 'TestLambda', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      secretsManager.grantRead(testLambda);

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith(['secretsmanager:GetSecretValue']),
              Effect: 'Allow',
              Resource: {
                Ref: Match.stringLikeRegexp('SecretsManagerApiKeySecret'),
              },
            }),
          ]),
        },
      });
    });
  });

  describe('シークレット情報取得', () => {
    it('should return secret ARN', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: false,
      });

      // Act
      const secretArn = secretsManager.getSecretArn();

      // Assert
      expect(secretArn).toBeDefined();
      expect(typeof secretArn).toBe('string');
    });

    it('should return secret value', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: false,
      });

      // Act
      const secretValue = secretsManager.getSecretValue();

      // Assert
      expect(secretValue).toBeDefined();
    });
  });

  describe('環境別設定', () => {
    it('should create rotation function with dev environment name', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-api-key-rotation-dev',
        Environment: {
          Variables: {
            ENVIRONMENT: 'dev',
            LOG_LEVEL: 'info',
            NODE_OPTIONS: '--enable-source-maps',
          },
        },
      });
    });

    it('should create rotation function with prod environment name', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'prod',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-api-key-rotation-prod',
        Environment: {
          Variables: {
            ENVIRONMENT: 'prod',
            LOG_LEVEL: 'info',
            NODE_OPTIONS: '--enable-source-maps',
          },
        },
      });
    });
  });

  describe('デフォルト値', () => {
    it('should use default enableRotation=true when not specified', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
      });

      // Assert
      const template = Template.fromStack(stack);
      // ローテーション関数が作成されていることを確認（デフォルトでenableRotation=true）
      template.resourceCountIs('AWS::Lambda::Function', 1);
    });

    it('should use default rotationDays=90 when not specified', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager', {
        environment: 'dev',
        enableRotation: true,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SecretsManager::RotationSchedule', {
        RotationRules: {
          ScheduleExpression: 'rate(90 days)',
        },
      });
    });
  });
});

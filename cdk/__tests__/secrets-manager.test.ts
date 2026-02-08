import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SecretsManagerConstruct } from '../lib/constructs/secrets-manager';

describe('SecretsManagerConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  describe('シークレット作成', () => {
    it('シークレット名が /tdnet/api-key であること', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager');
      template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: '/tdnet/api-key',
      });
    });

    it('シークレットの説明が設定されていること', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager');
      template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Description: 'TDnet API Key for authentication',
      });
    });

    it('シークレットが自動生成設定を持つこと', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager');
      template = Template.fromStack(stack);

      // Assert
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        GenerateSecretString: {
          SecretStringTemplate: '{"apiKey":""}',
          GenerateStringKey: 'apiKey',
          ExcludePunctuation: true,
          PasswordLength: 32,
        },
      });
    });

    it('シークレットが暗号化されていること（デフォルトのAWS管理キー）', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager');
      template = Template.fromStack(stack);

      // Assert
      // KmsKeyIdが指定されていない場合、デフォルトのAWS管理キーが使用される
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        KmsKeyId: Match.absent(),
      });
    });
  });

  describe('Lambda関数へのアクセス権限', () => {
    it('Lambda関数にシークレット読み取り権限が付与されること', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager');
      const testFunction = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      secretsManager.grantRead(testFunction);
      template = Template.fromStack(stack);

      // Assert
      // Lambda関数のロールにシークレット読み取りポリシーが追加されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
              Effect: 'Allow',
              Resource: {
                Ref: Match.stringLikeRegexp('SecretsManagerApiKeySecret'),
              },
            }),
          ]),
        },
      });
    });

    it('複数のLambda関数にシークレット読み取り権限が付与されること', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager');
      const queryFunction = new lambda.Function(stack, 'QueryFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });
      const exportFunction = new lambda.Function(stack, 'ExportFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
      });

      // Act
      secretsManager.grantRead(queryFunction);
      secretsManager.grantRead(exportFunction);
      template = Template.fromStack(stack);

      // Assert
      // 各Lambda関数のロールにシークレット読み取りポリシーが追加されていることを確認
      const allPolicies = template.findResources('AWS::IAM::Policy');
      const secretsPolicies = Object.values(allPolicies).filter((policy: any) => {
        const statements = policy.Properties?.PolicyDocument?.Statement || [];
        return statements.some((stmt: any) => 
          Array.isArray(stmt.Action) && 
          stmt.Action.includes('secretsmanager:GetSecretValue')
        );
      });

      // 少なくとも2つのシークレット読み取りポリシーが存在することを確認
      expect(secretsPolicies.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ヘルパーメソッド', () => {
    it('getSecretArn() がシークレットARNを返すこと', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager');

      // Act
      const secretArn = secretsManager.getSecretArn();

      // Assert
      expect(secretArn).toBeDefined();
      expect(typeof secretArn).toBe('string');
    });

    it('getSecretValue() がSecretValue型を返すこと', () => {
      // Arrange
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager');

      // Act
      const secretValue = secretsManager.getSecretValue();

      // Assert
      expect(secretValue).toBeDefined();
      // SecretValue型は unsafeUnwrap() メソッドを持つ
      expect(typeof secretValue.unsafeUnwrap).toBe('function');
    });
  });

  describe('削除保護', () => {
    it('シークレットが削除保護されていること（RETAIN）', () => {
      // Arrange & Act
      new SecretsManagerConstruct(stack, 'SecretsManager');
      template = Template.fromStack(stack);

      // Assert
      // DeletionPolicyがRetainであることを確認
      const secrets = template.findResources('AWS::SecretsManager::Secret');
      const secretKeys = Object.keys(secrets);
      expect(secretKeys.length).toBe(1);

      const secretResource = secrets[secretKeys[0]];
      expect(secretResource.DeletionPolicy).toBe('Retain');
    });
  });

  describe('統合テスト', () => {
    it('SecretsManagerConstructが正しくスタックに統合されること', () => {
      // Arrange & Act
      const secretsManager = new SecretsManagerConstruct(stack, 'SecretsManager');
      const testFunction = new lambda.Function(stack, 'TestFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {}'),
        environment: {
          API_KEY_SECRET_ARN: secretsManager.getSecretArn(),
        },
      });
      secretsManager.grantRead(testFunction);
      template = Template.fromStack(stack);

      // Assert
      // 1. シークレットが作成されていること
      template.resourceCountIs('AWS::SecretsManager::Secret', 1);

      // 2. Lambda関数が作成されていること
      template.resourceCountIs('AWS::Lambda::Function', 1);

      // 3. Lambda関数の環境変数にシークレットARNが設定されていること
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            API_KEY_SECRET_ARN: {
              Ref: Match.stringLikeRegexp('SecretsManagerApiKeySecret'),
            },
          },
        },
      });

      // 4. IAMポリシーが作成されていること
      template.resourceCountIs('AWS::IAM::Policy', 1);
    });
  });
});

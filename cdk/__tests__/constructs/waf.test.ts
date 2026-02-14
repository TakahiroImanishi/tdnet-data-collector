import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { WafConstruct } from '../../lib/constructs/waf';

describe('WafConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let api: apigateway.RestApi;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });

    // テスト用のLambda関数を作成
    const testFunction = new lambda.Function(stack, 'TestFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
    });

    // テスト用のAPI Gatewayを作成
    api = new apigateway.RestApi(stack, 'TestApi', {
      restApiName: 'test-api',
      deployOptions: {
        stageName: 'prod',
      },
    });

    const integration = new apigateway.LambdaIntegration(testFunction);
    api.root.addMethod('GET', integration);
  });

  test('WAF Web ACLが作成される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
  });

  test('Web ACLの基本設定が正しい', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Name: 'tdnet-web-acl-test',
      Scope: 'REGIONAL',
      DefaultAction: { Allow: {} },
      Description: 'Web ACL for TDnet Data Collector API',
      VisibilityConfig: {
        SampledRequestsEnabled: true,
        CloudWatchMetricsEnabled: true,
        MetricName: 'TdnetWebAcl',
      },
    });
  });

  test('レート制限ルールが設定される（デフォルト: 500リクエスト/5分）', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'RateLimitRule',
          Priority: 1,
          Statement: {
            RateBasedStatement: {
              Limit: 500,
              AggregateKeyType: 'IP',
            },
          },
          Action: {
            Block: {
              CustomResponse: {
                ResponseCode: 429,
                CustomResponseBodyKey: 'RateLimitExceeded',
              },
            },
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'RateLimitRule',
          },
        }),
      ]),
    });
  });

  test('カスタムレート制限が設定できる', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
      rateLimitPerFiveMinutes: 1000,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'RateLimitRule',
          Statement: {
            RateBasedStatement: {
              Limit: 1000,
            },
          },
        }),
      ]),
    });
  });

  test('AWS Managed Rules - Common Rule Setが設定される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWSManagedRulesCommonRuleSet',
          Priority: 2,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          OverrideAction: { None: {} },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWSManagedRulesCommonRuleSet',
          },
        }),
      ]),
    });
  });

  test('AWS Managed Rules - Known Bad Inputsが設定される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'AWSManagedRulesKnownBadInputsRuleSet',
          Priority: 3,
          Statement: {
            ManagedRuleGroupStatement: {
              VendorName: 'AWS',
              Name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          OverrideAction: { None: {} },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        }),
      ]),
    });
  });

  test('カスタムエラーレスポンスが設定される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      CustomResponseBodies: {
        RateLimitExceeded: {
          ContentType: 'APPLICATION_JSON',
          Content: JSON.stringify({
            error_code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          }),
        },
      },
    });
  });

  test('WAF AssociationがAPI Gatewayに関連付けられる', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
    
    template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
      ResourceArn: Match.anyValue(),
      WebACLArn: Match.anyValue(),
    });
  });

  test('CloudFormation OutputsにWeb ACL ARNとIDが出力される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    const outputs = template.toJSON().Outputs;
    
    const webAclArnOutput = Object.keys(outputs || {}).find(key => 
      key.includes('WebAclArn')
    );
    const webAclIdOutput = Object.keys(outputs || {}).find(key => 
      key.includes('WebAclId')
    );
    
    expect(webAclArnOutput).toBeDefined();
    expect(webAclIdOutput).toBeDefined();
    
    if (webAclArnOutput) {
      expect(outputs[webAclArnOutput]).toMatchObject({
        Description: 'WAF Web ACL ARN',
        Export: {
          Name: 'TdnetWebAclArn-test',
        },
      });
    }
    
    if (webAclIdOutput) {
      expect(outputs[webAclIdOutput]).toMatchObject({
        Description: 'WAF Web ACL ID',
      });
    }
  });

  test('3つのルールが正しい優先順位で設定される', () => {
    // Arrange & Act
    new WafConstruct(stack, 'TestWaf', {
      environment: 'test',
      api,
    });

    // Assert
    const template = Template.fromStack(stack);
    const webAcls = template.findResources('AWS::WAFv2::WebACL');
    const webAclKeys = Object.keys(webAcls);
    expect(webAclKeys.length).toBe(1);
    
    const webAcl = webAcls[webAclKeys[0]];
    const rules = webAcl.Properties.Rules;
    
    expect(rules).toHaveLength(3);
    expect(rules[0].Name).toBe('RateLimitRule');
    expect(rules[0].Priority).toBe(1);
    expect(rules[1].Name).toBe('AWSManagedRulesCommonRuleSet');
    expect(rules[1].Priority).toBe(2);
    expect(rules[2].Name).toBe('AWSManagedRulesKnownBadInputsRuleSet');
    expect(rules[2].Priority).toBe(3);
  });
});

/**
 * API Gateway + WAF構造の検証テスト
 * 
 * このテストは、API GatewayとAWS WAFが正しく設定されていることを検証します。
 * 
 * Requirements:
 * - 要件11.1: API認証（APIキー認証）
 * - 要件11.2: 使用量プラン設定
 * - 要件13.1: WAF保護（レート制限、マネージドルール）
 * 
 * Test Coverage:
 * - API Gatewayが正しく作成されていることを確認
 * - APIキー認証が有効化されていることを確認
 * - 使用量プランが設定されていることを確認
 * - CORS設定が正しいことを確認
 * - WAFが関連付けられていることを確認
 * - WAFルールが正しく設定されていることを確認
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('API Gateway + WAF構造の検証', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetDataCollectorStack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('API Gateway REST API', () => {
    it('REST APIが作成されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api',
        Description: 'TDnet Data Collector REST API',
      });
    });

    it('デプロイメント設定が正しいこと', () => {
      template.hasResourceProperties('AWS::ApiGateway::Deployment', {
        Description: Match.anyValue(),
      });

      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            LoggingLevel: 'INFO',
            DataTraceEnabled: true,
            MetricsEnabled: true,
          }),
        ]),
      });
    });

    it('CORS設定が有効化されていること', () => {
      // OPTIONSメソッドが存在することを確認
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
        Integration: Match.objectLike({
          Type: 'MOCK',
          IntegrationResponses: Match.arrayWith([
            Match.objectLike({
              ResponseParameters: Match.objectLike({
                'method.response.header.Access-Control-Allow-Headers': Match.stringLikeRegexp('.*X-Api-Key.*'),
                'method.response.header.Access-Control-Allow-Methods': Match.anyValue(),
                'method.response.header.Access-Control-Allow-Origin': Match.anyValue(),
              }),
            }),
          ]),
        }),
      });
    });

    it('CloudWatch Logsロールが設定されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::Account', {
        CloudWatchRoleArn: Match.anyValue(),
      });
    });
  });

  describe('API Key認証', () => {
    it('APIキーが作成されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'tdnet-api-key',
        Description: 'API Key for TDnet Data Collector',
        Enabled: true,
      });
    });

    it('使用量プランが作成されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'tdnet-usage-plan',
        Description: 'Usage plan for TDnet Data Collector API',
        Throttle: {
          RateLimit: 100,
          BurstLimit: 200,
        },
        Quota: {
          Limit: 10000,
          Period: 'MONTH',
        },
      });
    });

    it('APIキーが使用量プランに関連付けられていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
        KeyType: 'API_KEY',
      });
    });
  });

  describe('AWS WAF設定', () => {
    it('Web ACLが作成されていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Name: 'tdnet-web-acl',
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

    it('レート制限ルールが設定されていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 2000, // 5分間で2000リクエスト
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

    it('AWSマネージドルール（Common Rule Set）が適用されていること', () => {
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
          }),
        ]),
      });
    });

    it('AWSマネージドルール（Known Bad Inputs）が適用されていること', () => {
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
          }),
        ]),
      });
    });

    it('カスタムレスポンスボディが設定されていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        CustomResponseBodies: {
          RateLimitExceeded: {
            ContentType: 'APPLICATION_JSON',
            Content: Match.stringLikeRegexp('.*RATE_LIMIT_EXCEEDED.*'),
          },
        },
      });
    });

    it('WAFがAPI Gatewayに関連付けられていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: Match.anyValue(),
        WebACLArn: Match.anyValue(), // 正しいプロパティ名は WebACLArn
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('API Endpointが出力されていること', () => {
      template.hasOutput('ApiEndpoint', {
        Description: 'API Gateway endpoint URL',
        Export: {
          Name: 'TdnetApiEndpoint',
        },
      });
    });

    it('API Key IDが出力されていること', () => {
      template.hasOutput('ApiKeyId', {
        Description: 'API Key ID',
        Export: {
          Name: 'TdnetApiKeyId',
        },
      });
    });

    it('Web ACL ARNが出力されていること', () => {
      template.hasOutput('WebAclArn', {
        Description: 'WAF Web ACL ARN',
        Export: {
          Name: 'TdnetWebAclArn',
        },
      });
    });
  });

  describe('セキュリティ設定', () => {
    it('API Gatewayのログが有効化されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            LoggingLevel: 'INFO',
            DataTraceEnabled: true,
          }),
        ]),
      });
    });

    it('スロットリング設定が有効化されていること', () => {
      // スロットリング設定は使用量プランで管理される
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        Throttle: {
          RateLimit: 100,
          BurstLimit: 200,
        },
      });
    });

    it('使用量プランにクォータが設定されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        Quota: {
          Limit: 10000,
          Period: 'MONTH',
        },
      });
    });
  });

  describe('パフォーマンス設定', () => {
    it('API Gatewayメトリクスが有効化されていること', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            MetricsEnabled: true,
          }),
        ]),
      });
    });

    it('WAFメトリクスが有効化されていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: true,
          MetricName: 'TdnetWebAcl',
        },
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('レート制限超過時のカスタムレスポンスが設定されていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Action: {
              Block: {
                CustomResponse: {
                  ResponseCode: 429,
                  CustomResponseBodyKey: 'RateLimitExceeded',
                },
              },
            },
          }),
        ]),
      });
    });

    it('カスタムレスポンスにエラーコードが含まれていること', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        CustomResponseBodies: {
          RateLimitExceeded: {
            Content: Match.stringLikeRegexp('.*error_code.*'),
          },
        },
      });
    });
  });
});

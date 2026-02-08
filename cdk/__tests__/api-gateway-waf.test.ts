/**
 * API Gateway + WAF讒矩縺ｮ讀懆ｨｼ繝・せ繝・
 * 
 * 縺薙・繝・せ繝医・縲、PI Gateway縺ｨAWS WAF縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・ｋ縺薙→繧呈､懆ｨｼ縺励∪縺吶・
 * 
 * Requirements:
 * - 隕∽ｻｶ11.1: API隱崎ｨｼ・・PI繧ｭ繝ｼ隱崎ｨｼ・・
 * - 隕∽ｻｶ11.2: 菴ｿ逕ｨ驥上・繝ｩ繝ｳ險ｭ螳・
 * - 隕∽ｻｶ13.1: WAF菫晁ｭｷ・医Ξ繝ｼ繝亥宛髯舌√・繝阪・繧ｸ繝峨Ν繝ｼ繝ｫ・・
 * 
 * Test Coverage:
 * - API Gateway縺梧ｭ｣縺励￥菴懈・縺輔ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
 * - API繧ｭ繝ｼ隱崎ｨｼ縺梧怏蜉ｹ蛹悶＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
 * - 菴ｿ逕ｨ驥上・繝ｩ繝ｳ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
 * - CORS險ｭ螳壹′豁｣縺励＞縺薙→繧堤｢ｺ隱・
 * - WAF縺碁未騾｣莉倥￠繧峨ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
 * - WAF繝ｫ繝ｼ繝ｫ縺梧ｭ｣縺励￥險ｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('API Gateway + WAF讒矩縺ｮ讀懆ｨｼ', () => {
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
    it('REST API縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api-dev',
        Description: 'TDnet Data Collector REST API',
      });
    });

    it('繝・・繝ｭ繧､繝｡繝ｳ繝郁ｨｭ螳壹′豁｣縺励＞縺薙→', () => {
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

    it('CORS險ｭ螳壹′譛牙柑蛹悶＆繧後※縺・ｋ縺薙→', () => {
      // OPTIONS繝｡繧ｽ繝・ラ縺悟ｭ伜惠縺吶ｋ縺薙→繧堤｢ｺ隱・
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

    it('CloudWatch Logs繝ｭ繝ｼ繝ｫ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::Account', {
        CloudWatchRoleArn: Match.anyValue(),
      });
    });
  });

  describe('API Key隱崎ｨｼ', () => {
    it('API繧ｭ繝ｼ縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'tdnet-api-key-dev',
        Description: 'API Key for TDnet Data Collector',
        Enabled: true,
      });
    });

    it('菴ｿ逕ｨ驥上・繝ｩ繝ｳ縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'tdnet-usage-plan-dev',
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

    it('API繧ｭ繝ｼ縺御ｽｿ逕ｨ驥上・繝ｩ繝ｳ縺ｫ髢｢騾｣莉倥￠繧峨ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
        KeyType: 'API_KEY',
      });
    });
  });

  describe('AWS WAF險ｭ螳・, () => {
    it('Web ACL縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Name: 'tdnet-web-acl-dev',
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

    it('繝ｬ繝ｼ繝亥宛髯舌Ν繝ｼ繝ｫ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: 'RateLimitRule',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 2000, // 5蛻・俣縺ｧ2000繝ｪ繧ｯ繧ｨ繧ｹ繝・
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

    it('AWS繝槭ロ繝ｼ繧ｸ繝峨Ν繝ｼ繝ｫ・・ommon Rule Set・峨′驕ｩ逕ｨ縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
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

    it('AWS繝槭ロ繝ｼ繧ｸ繝峨Ν繝ｼ繝ｫ・・nown Bad Inputs・峨′驕ｩ逕ｨ縺輔ｌ縺ｦ縺・ｋ縺薙→', () => {
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

    it('繧ｫ繧ｹ繧ｿ繝繝ｬ繧ｹ繝昴Φ繧ｹ繝懊ョ繧｣縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        CustomResponseBodies: {
          RateLimitExceeded: {
            ContentType: 'APPLICATION_JSON',
            Content: Match.stringLikeRegexp('.*RATE_LIMIT_EXCEEDED.*'),
          },
        },
      });
    });

    it('WAF縺窟PI Gateway縺ｫ髢｢騾｣莉倥￠繧峨ｌ縺ｦ縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: Match.anyValue(),
        WebACLArn: Match.anyValue(), // 豁｣縺励＞繝励Ο繝代ユ繧｣蜷阪・ WebACLArn
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('API Endpoint縺悟・蜉帙＆繧後※縺・ｋ縺薙→', () => {
      template.hasOutput('ApiEndpoint', {
        Description: 'API Gateway endpoint URL',
        Export: {
          Name: 'TdnetApiEndpoint',
        },
      });
    });

    it('API Key ID縺悟・蜉帙＆繧後※縺・ｋ縺薙→', () => {
      template.hasOutput('ApiKeyId', {
        Description: 'API Key ID',
        Export: {
          Name: 'TdnetApiKeyId',
        },
      });
    });

    it('Web ACL ARN縺悟・蜉帙＆繧後※縺・ｋ縺薙→', () => {
      template.hasOutput('WebAclArn', {
        Description: 'WAF Web ACL ARN',
        Export: {
          Name: 'TdnetWebAclArn',
        },
      });
    });
  });

  describe('繧ｻ繧ｭ繝･繝ｪ繝・ぅ險ｭ螳・, () => {
    it('API Gateway縺ｮ繝ｭ繧ｰ縺梧怏蜉ｹ蛹悶＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            LoggingLevel: 'INFO',
            DataTraceEnabled: true,
          }),
        ]),
      });
    });

    it('繧ｹ繝ｭ繝・ヨ繝ｪ繝ｳ繧ｰ險ｭ螳壹′譛牙柑蛹悶＆繧後※縺・ｋ縺薙→', () => {
      // 繧ｹ繝ｭ繝・ヨ繝ｪ繝ｳ繧ｰ險ｭ螳壹・菴ｿ逕ｨ驥上・繝ｩ繝ｳ縺ｧ邂｡逅・＆繧後ｋ
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        Throttle: {
          RateLimit: 100,
          BurstLimit: 200,
        },
      });
    });

    it('菴ｿ逕ｨ驥上・繝ｩ繝ｳ縺ｫ繧ｯ繧ｩ繝ｼ繧ｿ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        Quota: {
          Limit: 10000,
          Period: 'MONTH',
        },
      });
    });
  });

  describe('繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ險ｭ螳・, () => {
    it('API Gateway繝｡繝医Μ繧ｯ繧ｹ縺梧怏蜉ｹ蛹悶＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            MetricsEnabled: true,
          }),
        ]),
      });
    });

    it('WAF繝｡繝医Μ繧ｯ繧ｹ縺梧怏蜉ｹ蛹悶＆繧後※縺・ｋ縺薙→', () => {
      template.hasResourceProperties('AWS::WAFv2::WebACL', {
        VisibilityConfig: {
          CloudWatchMetricsEnabled: true,
          MetricName: 'TdnetWebAcl',
        },
      });
    });
  });

  describe('繧ｨ繝ｩ繝ｼ繝上Φ繝峨Μ繝ｳ繧ｰ', () => {
    it('繝ｬ繝ｼ繝亥宛髯占ｶ・℃譎ゅ・繧ｫ繧ｹ繧ｿ繝繝ｬ繧ｹ繝昴Φ繧ｹ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→', () => {
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

    it('繧ｫ繧ｹ繧ｿ繝繝ｬ繧ｹ繝昴Φ繧ｹ縺ｫ繧ｨ繝ｩ繝ｼ繧ｳ繝ｼ繝峨′蜷ｫ縺ｾ繧後※縺・ｋ縺薙→', () => {
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

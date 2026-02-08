/**
 * API Gateway Query & Export Endpoints Tests
 *
 * GET /disclosures 縺翫ｈ縺ｳ POST /exports 繧ｨ繝ｳ繝峨・繧､繝ｳ繝医・邨ｱ蜷医ユ繧ｹ繝・
 *
 * Requirements: 繧ｿ繧ｹ繧ｯ13.3, 13.4 - API Gateway 繧ｨ繝ｳ繝峨・繧､繝ｳ繝亥ｮ溯｣・
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('API Gateway Query & Export Endpoints', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetDataCollectorStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  describe('GET /disclosures 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・, () => {
    it('should create /disclosures resource', () => {
      // /disclosures 繝ｪ繧ｽ繝ｼ繧ｹ縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'disclosures',
      });
    });

    it('should create GET method with API key required', () => {
      // GET 繝｡繧ｽ繝・ラ縺御ｽ懈・縺輔ｌ縲、PI繧ｭ繝ｼ隱崎ｨｼ縺悟ｿ・医〒縺ゅｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ApiKeyRequired: true,
        ResourceId: Match.objectLike({
          Ref: Match.stringLikeRegexp('.*disclosures.*'),
        }),
      });
    });

    it('should configure query parameters', () => {
      // 繧ｯ繧ｨ繝ｪ繝代Λ繝｡繝ｼ繧ｿ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        RequestParameters: {
          'method.request.querystring.company_code': false,
          'method.request.querystring.start_date': false,
          'method.request.querystring.end_date': false,
          'method.request.querystring.disclosure_type': false,
          'method.request.querystring.format': false,
          'method.request.querystring.limit': false,
          'method.request.querystring.offset': false,
        },
      });
    });

    it('should configure Lambda integration', () => {
      // Lambda邨ｱ蜷医′險ｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST',
          Uri: Match.objectLike({
            'Fn::Join': Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp('.*lambda.*'),
              ]),
            ]),
          }),
        },
      });
    });

    it('should configure CORS headers', () => {
      // CORS繝倥ャ繝繝ｼ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        MethodResponses: Match.arrayWith([
          Match.objectLike({
            StatusCode: '200',
            ResponseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Content-Type': true,
            },
          }),
        ]),
      });
    });

    it('should configure error responses (400, 401, 500)', () => {
      // 繧ｨ繝ｩ繝ｼ繝ｬ繧ｹ繝昴Φ繧ｹ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        MethodResponses: Match.arrayWith([
          Match.objectLike({ StatusCode: '200' }),
          Match.objectLike({ StatusCode: '400' }),
          Match.objectLike({ StatusCode: '401' }),
          Match.objectLike({ StatusCode: '500' }),
        ]),
      });
    });

    it('should grant Query Lambda permission to be invoked by API Gateway', () => {
      // API Gateway縺群uery Lambda繧貞他縺ｳ蜃ｺ縺呎ｨｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        FunctionName: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('QueryFunction.*'),
            'Arn',
          ]),
        }),
      });
    });
  });

  describe('POST /exports 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・, () => {
    it('should create /exports resource', () => {
      // /exports 繝ｪ繧ｽ繝ｼ繧ｹ縺御ｽ懈・縺輔ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'exports',
      });
    });

    it('should create POST method with API key required', () => {
      // POST 繝｡繧ｽ繝・ラ縺御ｽ懈・縺輔ｌ縲、PI繧ｭ繝ｼ隱崎ｨｼ縺悟ｿ・医〒縺ゅｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ApiKeyRequired: true,
        ResourceId: Match.objectLike({
          Ref: Match.stringLikeRegexp('.*exports.*'),
        }),
      });
    });

    it('should configure Lambda integration', () => {
      // Lambda邨ｱ蜷医′險ｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        Integration: {
          Type: 'AWS_PROXY',
          IntegrationHttpMethod: 'POST',
          Uri: Match.objectLike({
            'Fn::Join': Match.arrayWith([
              Match.arrayWith([
                Match.stringLikeRegexp('.*lambda.*'),
              ]),
            ]),
          }),
        },
      });
    });

    it('should configure CORS headers', () => {
      // CORS繝倥ャ繝繝ｼ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        MethodResponses: Match.arrayWith([
          Match.objectLike({
            StatusCode: '202',
            ResponseParameters: {
              'method.response.header.Access-Control-Allow-Origin': true,
            },
          }),
        ]),
      });
    });

    it('should configure success response (202 Accepted)', () => {
      // 謌仙粥繝ｬ繧ｹ繝昴Φ繧ｹ・・02 Accepted・峨′險ｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        MethodResponses: Match.arrayWith([
          Match.objectLike({ StatusCode: '202' }),
        ]),
      });
    });

    it('should configure error responses (400, 401, 500)', () => {
      // 繧ｨ繝ｩ繝ｼ繝ｬ繧ｹ繝昴Φ繧ｹ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        MethodResponses: Match.arrayWith([
          Match.objectLike({ StatusCode: '202' }),
          Match.objectLike({ StatusCode: '400' }),
          Match.objectLike({ StatusCode: '401' }),
          Match.objectLike({ StatusCode: '500' }),
        ]),
      });
    });

    it('should grant Export Lambda permission to be invoked by API Gateway', () => {
      // API Gateway縺窪xport Lambda繧貞他縺ｳ蜃ｺ縺呎ｨｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::Lambda::Permission', {
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        FunctionName: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('ExportFunction.*'),
            'Arn',
          ]),
        }),
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('should export Disclosures endpoint URL', () => {
      // Disclosures 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・RL縺後お繧ｯ繧ｹ繝昴・繝医＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasOutput('DisclosuresEndpoint', {
        Description: 'Disclosures query API endpoint URL',
        Export: {
          Name: 'TdnetDisclosuresEndpoint',
        },
      });
    });

    it('should export Exports endpoint URL', () => {
      // Exports 繧ｨ繝ｳ繝峨・繧､繝ｳ繝・RL縺後お繧ｯ繧ｹ繝昴・繝医＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasOutput('ExportsEndpoint', {
        Description: 'Export API endpoint URL',
        Export: {
          Name: 'TdnetExportsEndpoint',
        },
      });
    });
  });

  describe('API Gateway邨ｱ蜷医・謨ｴ蜷域ｧ', () => {
    it('should have consistent API Gateway configuration', () => {
      // API Gateway縺ｮ蝓ｺ譛ｬ險ｭ螳壹′蟄伜惠縺吶ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api',
        Description: 'TDnet Data Collector REST API',
      });
    });

    it('should have deployment stage configured', () => {
      // 繝・・繝ｭ繧､繧ｹ繝・・繧ｸ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
      });
    });

    it('should have usage plan with API key', () => {
      // Usage Plan縺ｨAPI繧ｭ繝ｼ縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'tdnet-usage-plan',
        Description: 'Usage plan for TDnet Data Collector API',
      });
    });

    it('should associate API key with usage plan', () => {
      // API繧ｭ繝ｼ縺袈sage Plan縺ｫ髢｢騾｣莉倥￠繧峨ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
        KeyType: 'API_KEY',
      });
    });
  });

  describe('Lambda髢｢謨ｰ縺ｮ讓ｩ髯・, () => {
    it('should grant Query Lambda read access to DynamoDB', () => {
      // Query Lambda縺ｫDynamoDB縺ｮ隱ｭ縺ｿ蜿悶ｊ讓ｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: Match.arrayWith([
          Match.objectLike({
            Ref: Match.stringLikeRegexp('QueryFunction.*Role.*'),
          }),
        ]),
      });
    });

    it('should grant Export Lambda read access to DynamoDB', () => {
      // Export Lambda縺ｫDynamoDB縺ｮ隱ｭ縺ｿ蜿悶ｊ讓ｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: Match.arrayWith([
          Match.objectLike({
            Ref: Match.stringLikeRegexp('ExportFunction.*Role.*'),
          }),
        ]),
      });
    });

    it('should grant Export Lambda write access to S3 exports bucket', () => {
      // Export Lambda縺ｫS3 exports繝舌こ繝・ヨ縺ｸ縺ｮ譖ｸ縺崎ｾｼ縺ｿ讓ｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                's3:PutObject',
                's3:PutObjectLegalHold',
                's3:PutObjectRetention',
                's3:PutObjectTagging',
                's3:PutObjectVersionTagging',
                's3:Abort*',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: Match.arrayWith([
          Match.objectLike({
            Ref: Match.stringLikeRegexp('ExportFunction.*Role.*'),
          }),
        ]),
      });
    });

    it('should grant Query Lambda read access to S3 PDFs bucket', () => {
      // Query Lambda縺ｫS3 PDFs繝舌こ繝・ヨ縺ｸ縺ｮ隱ｭ縺ｿ蜿悶ｊ讓ｩ髯舌′莉倅ｸ弱＆繧後※縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
        Roles: Match.arrayWith([
          Match.objectLike({
            Ref: Match.stringLikeRegexp('QueryFunction.*Role.*'),
          }),
        ]),
      });
    });
  });

  describe('WAF邨ｱ蜷・, () => {
    it('should associate WAF Web ACL with API Gateway', () => {
      // WAF Web ACL縺窟PI Gateway縺ｫ髢｢騾｣莉倥￠繧峨ｌ縺ｦ縺・ｋ縺薙→繧堤｢ｺ隱・
      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: Match.objectLike({
          'Fn::Join': Match.arrayWith([
            '',
            Match.arrayWith([
              Match.stringLikeRegexp('arn:'),
              Match.stringLikeRegexp(':apigateway:'),
            ]),
          ]),
        }),
        WebACLArn: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('.*WebAcl.*'),
            'Arn',
          ]),
        }),
      });
    });
  });
});

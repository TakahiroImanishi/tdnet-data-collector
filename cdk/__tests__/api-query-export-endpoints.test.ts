/**
 * API Gateway Query & Export Endpoints Tests
 *
 * GET /disclosures および POST /exports エンドポイントの統合テスト
 *
 * Requirements: タスク13.3, 13.4 - API Gateway エンドポイント実装
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

  describe('GET /disclosures エンドポイント', () => {
    it('should create /disclosures resource', () => {
      // /disclosures リソースが作成されていることを確認
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'disclosures',
      });
    });

    it('should create GET method with API key required', () => {
      // GET メソッドが作成され、APIキー認証が必須であることを確認
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ApiKeyRequired: true,
        ResourceId: Match.objectLike({
          Ref: Match.stringLikeRegexp('.*disclosures.*'),
        }),
      });
    });

    it('should configure query parameters', () => {
      // クエリパラメータが設定されていることを確認
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
      // Lambda統合が設定されていることを確認
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
      // CORSヘッダーが設定されていることを確認
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
      // エラーレスポンスが設定されていることを確認
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
      // API GatewayがQuery Lambdaを呼び出す権限が付与されていることを確認
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

  describe('POST /exports エンドポイント', () => {
    it('should create /exports resource', () => {
      // /exports リソースが作成されていることを確認
      template.hasResourceProperties('AWS::ApiGateway::Resource', {
        PathPart: 'exports',
      });
    });

    it('should create POST method with API key required', () => {
      // POST メソッドが作成され、APIキー認証が必須であることを確認
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ApiKeyRequired: true,
        ResourceId: Match.objectLike({
          Ref: Match.stringLikeRegexp('.*exports.*'),
        }),
      });
    });

    it('should configure Lambda integration', () => {
      // Lambda統合が設定されていることを確認
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
      // CORSヘッダーが設定されていることを確認
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
      // 成功レスポンス（202 Accepted）が設定されていることを確認
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        MethodResponses: Match.arrayWith([
          Match.objectLike({ StatusCode: '202' }),
        ]),
      });
    });

    it('should configure error responses (400, 401, 500)', () => {
      // エラーレスポンスが設定されていることを確認
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
      // API GatewayがExport Lambdaを呼び出す権限が付与されていることを確認
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
      // Disclosures エンドポイントURLがエクスポートされていることを確認
      template.hasOutput('DisclosuresEndpoint', {
        Description: 'Disclosures query API endpoint URL',
        Export: {
          Name: 'TdnetDisclosuresEndpoint',
        },
      });
    });

    it('should export Exports endpoint URL', () => {
      // Exports エンドポイントURLがエクスポートされていることを確認
      template.hasOutput('ExportsEndpoint', {
        Description: 'Export API endpoint URL',
        Export: {
          Name: 'TdnetExportsEndpoint',
        },
      });
    });
  });

  describe('API Gateway統合の整合性', () => {
    it('should have consistent API Gateway configuration', () => {
      // API Gatewayの基本設定が存在することを確認
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api',
        Description: 'TDnet Data Collector REST API',
      });
    });

    it('should have deployment stage configured', () => {
      // デプロイステージが設定されていることを確認
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
      });
    });

    it('should have usage plan with API key', () => {
      // Usage PlanとAPIキーが設定されていることを確認
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'tdnet-usage-plan',
        Description: 'Usage plan for TDnet Data Collector API',
      });
    });

    it('should associate API key with usage plan', () => {
      // APIキーがUsage Planに関連付けられていることを確認
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
        KeyType: 'API_KEY',
      });
    });
  });

  describe('Lambda関数の権限', () => {
    it('should grant Query Lambda read access to DynamoDB', () => {
      // Query LambdaにDynamoDBの読み取り権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
                'dynamodb:DescribeTable',
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
      // Export LambdaにDynamoDBの読み取り権限が付与されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:BatchGetItem',
                'dynamodb:GetRecords',
                'dynamodb:GetShardIterator',
                'dynamodb:Query',
                'dynamodb:GetItem',
                'dynamodb:Scan',
                'dynamodb:ConditionCheckItem',
                'dynamodb:DescribeTable',
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
      // Export LambdaにS3 exportsバケットへの書き込み権限が付与されていることを確認
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
      // Query LambdaにS3 PDFsバケットへの読み取り権限が付与されていることを確認
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

  describe('WAF統合', () => {
    it('should associate WAF Web ACL with API Gateway', () => {
      // WAF Web ACLがAPI Gatewayに関連付けられていることを確認
      template.hasResourceProperties('AWS::WAFv2::WebACLAssociation', {
        ResourceArn: Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              Match.stringLikeRegexp('.*execute-api.*'),
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

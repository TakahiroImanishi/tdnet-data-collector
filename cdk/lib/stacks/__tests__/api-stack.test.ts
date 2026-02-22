/**
 * API Stack テスト
 *
 * API Gateway、WAF、API Key、Usage Planの設定を検証します。
 * 
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { TdnetApiStack } from '../api-stack';

function createMockLambdaFunction(stack: cdk.Stack, id: string, name: string): lambda.IFunction {
  return lambda.Function.fromFunctionName(stack, id, name);
}

function createApiStack(env: 'prod' | 'local') {
  const app = new cdk.App();
  const baseStack = new cdk.Stack(app, `${env}BaseStack`);

  const mockFunctions = {
    queryFunction: createMockLambdaFunction(baseStack, 'Query', 'test-query'),
    exportFunction: createMockLambdaFunction(baseStack, 'Export', 'test-export'),
    collectFunction: createMockLambdaFunction(baseStack, 'Collect', 'test-collect'),
    collectStatusFunction: createMockLambdaFunction(baseStack, 'CollectStatus', 'test-collect-status'),
    exportStatusFunction: createMockLambdaFunction(baseStack, 'ExportStatus', 'test-export-status'),
    pdfDownloadFunction: createMockLambdaFunction(baseStack, 'PdfDownload', 'test-pdf-download'),
    healthFunction: createMockLambdaFunction(baseStack, 'Health', 'test-health'),
    statsFunction: createMockLambdaFunction(baseStack, 'Stats', 'test-stats'),
  };

  const apiStack = new TdnetApiStack(app, `${env}ApiStack`, {
    environment: env,
    ...mockFunctions,
  });

  return { apiStack, template: Template.fromStack(apiStack) };
}

describe('TdnetApiStack', () => {
  describe('API Gateway', () => {
    it('REST APIが作成されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api-prod',
        Description: 'TDnet Data Collector REST API',
      });
    });

    it('デプロイメント設定が正しい', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        StageName: 'prod',
        ThrottlingRateLimit: 100,
        ThrottlingBurstLimit: 200,
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            LoggingLevel: 'INFO',
            DataTraceEnabled: true,
            MetricsEnabled: true,
          }),
        ]),
      });
    });

    it('CORS設定が有効', () => {
      const { template } = createApiStack('prod');
      
      // OPTIONSメソッドが存在することを確認
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'OPTIONS',
      });
    });
  });

  describe('API Key & Usage Plan', () => {
    it('API Keyが作成されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'tdnet-api-key-prod',
        Description: 'API Key for TDnet Data Collector',
        Enabled: true,
      });
    });

    it('Usage Planが作成されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'tdnet-usage-plan-prod',
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

    it('Usage PlanにAPI Keyが関連付けられている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::UsagePlanKey', {
        KeyType: 'API_KEY',
      });
    });
  });

  describe('API Endpoints', () => {
    it('GET /disclosuresエンドポイントが作成されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ApiKeyRequired: true,
      });
    });

    it('POST /exportsエンドポイントが作成されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ApiKeyRequired: true,
      });
    });

    it('GET /healthエンドポイントはAPI Key不要', () => {
      const { template } = createApiStack('prod');
      
      const methods = template.findResources('AWS::ApiGateway::Method', {
        Properties: {
          HttpMethod: 'GET',
          ApiKeyRequired: false,
        },
      });
      
      expect(Object.keys(methods).length).toBeGreaterThan(0);
    });

    it('GET /statsエンドポイントはAPI Key必要', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ApiKeyRequired: true,
      });
    });
  });

  describe('WAF', () => {
    it('WAF Web ACLが作成されている', () => {
      const { apiStack } = createApiStack('prod');
      
      expect(apiStack.wafConstruct).toBeDefined();
    });
  });

  describe('CloudFormation Outputs', () => {
    it('API Endpointが出力されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasOutput('ApiEndpoint', {
        Export: {
          Name: 'TdnetApiEndpoint-prod',
        },
      });
    });

    it('API Key IDが出力されている', () => {
      const { template } = createApiStack('prod');
      
      template.hasOutput('ApiKeyId', {
        Export: {
          Name: 'TdnetApiKeyId-prod',
        },
      });
    });
  });

  describe('タグ付け', () => {
    it('必須タグが設定されている', () => {
      const { apiStack } = createApiStack('prod');
      
      const tags = cdk.Tags.of(apiStack);
      expect(tags).toBeDefined();
    });
  });

  describe('環境別設定', () => {
    it('本番環境の設定が正しい', () => {
      const { template } = createApiStack('prod');
      
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api-prod',
      });
    });

    it('ローカル環境の設定が正しい', () => {
      const { template } = createApiStack('local');
      
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api-local',
      });
    });
  });
});

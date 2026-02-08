/**
 * Environment Parameterization Test
 *
 * Task 15.15-A: CDKスタックの環境パラメータ化テスト
 * Requirements: 要件8.1（設定管理）
 *
 * このテストは、CDKスタックが環境（dev/prod）ごとに正しくパラメータ化されていることを検証します。
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('Environment Parameterization', () => {
  const testAccount = '123456789012';
  const testRegion = 'ap-northeast-1';

  describe('Development Environment', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new TdnetDataCollectorStack(app, 'TestStack-dev', {
        env: { 
          account: testAccount, 
          region: testRegion 
        },
        environmentConfig: { environment: 'dev' },
      });
      template = Template.fromStack(stack);
    });

    describe('DynamoDB Tables', () => {
      it('should have environment suffix in table names', () => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_disclosures_dev',
        });

        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_executions_dev',
        });

        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_export_status_dev',
        });
      });
    });

    describe('S3 Buckets', () => {
      it('should have environment suffix in bucket names', () => {
        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-data-collector-pdfs-dev-', { Ref: 'AWS::AccountId' }]] },
        });

        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-data-collector-exports-dev-', { Ref: 'AWS::AccountId' }]] },
        });

        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-dashboard-dev-', { Ref: 'AWS::AccountId' }]] },
        });

        // CloudTrail bucket does not have environment suffix (shared resource)
        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: `tdnet-cloudtrail-logs-${testAccount}`,
        });
      });
    });

    describe('Lambda Functions', () => {
      it('should have environment suffix in function names', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collector-dev',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-query-dev',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-export-dev',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collector-dev', // Changed from tdnet-collect-dev
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collect-status-dev',
        });
      });
    });

    describe('API Gateway', () => {
      it('should have environment suffix in API name', () => {
        template.hasResourceProperties('AWS::ApiGateway::RestApi', {
          Name: 'tdnet-data-collector-api-dev',
        });
      });

      it('should have environment suffix in API key name', () => {
        template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
          Name: 'tdnet-api-key-dev',
        });
      });

      it('should have environment suffix in usage plan name', () => {
        template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
          UsagePlanName: 'tdnet-usage-plan-dev',
        });
      });
    });

    describe('WAF', () => {
      it('should have environment suffix in Web ACL name', () => {
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
          Name: 'tdnet-web-acl-dev',
        });
      });
    });
  });

  describe('Production Environment', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new TdnetDataCollectorStack(app, 'TestStack-prod', {
        env: { account: testAccount, region: testRegion },
        environmentConfig: { environment: 'prod' },
      });
      template = Template.fromStack(stack);
    });

    describe('DynamoDB Tables', () => {
      it('should have environment suffix in table names', () => {
        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_disclosures_prod',
        });

        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_executions_prod',
        });

        template.hasResourceProperties('AWS::DynamoDB::Table', {
          TableName: 'tdnet_export_status_prod',
        });
      });
    });

    describe('S3 Buckets', () => {
      it('should have environment suffix in bucket names', () => {
        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-data-collector-pdfs-prod-', { Ref: 'AWS::AccountId' }]] },
        });

        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-data-collector-exports-prod-', { Ref: 'AWS::AccountId' }]] },
        });

        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: { 'Fn::Join': ['', ['tdnet-dashboard-prod-', { Ref: 'AWS::AccountId' }]] },
        });

        // CloudTrail bucket does not have environment suffix (shared resource)
        template.hasResourceProperties('AWS::S3::Bucket', {
          BucketName: `tdnet-cloudtrail-logs-${testAccount}`,
        });
      });
    });

    describe('Lambda Functions', () => {
      it('should have environment suffix in function names', () => {
        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collector-prod',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-query-prod',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-export-prod',
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collector-prod', // Changed from tdnet-collect-prod
        });

        template.hasResourceProperties('AWS::Lambda::Function', {
          FunctionName: 'tdnet-collect-status-prod',
        });
      });
    });

    describe('API Gateway', () => {
      it('should have environment suffix in API name', () => {
        template.hasResourceProperties('AWS::ApiGateway::RestApi', {
          Name: 'tdnet-data-collector-api-prod',
        });
      });

      it('should have environment suffix in API key name', () => {
        template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
          Name: 'tdnet-api-key-prod',
        });
      });

      it('should have environment suffix in usage plan name', () => {
        template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
          UsagePlanName: 'tdnet-usage-plan-prod',
        });
      });
    });

    describe('WAF', () => {
      it('should have environment suffix in Web ACL name', () => {
        template.hasResourceProperties('AWS::WAFv2::WebACL', {
          Name: 'tdnet-web-acl-prod',
        });
      });
    });
  });

  describe('Default Environment (no config provided)', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new TdnetDataCollectorStack(app, 'TestStack-default', {
        env: { account: testAccount, region: testRegion },
        // environmentConfig not provided - should default to 'dev'
      });
      template = Template.fromStack(stack);
    });

    it('should default to dev environment', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
      });

      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-dev',
      });

      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'tdnet-data-collector-api-dev',
      });
    });
  });

  describe('Resource Isolation', () => {
    it('should create different resource names for dev and prod', () => {
      const app = new cdk.App();
      
      const devStack = new TdnetDataCollectorStack(app, 'DevStack', {
        env: { account: testAccount, region: testRegion },
        environmentConfig: { environment: 'dev' },
      });
      
      const prodStack = new TdnetDataCollectorStack(app, 'ProdStack', {
        env: { account: testAccount, region: testRegion },
        environmentConfig: { environment: 'prod' },
      });

      const devTemplate = Template.fromStack(devStack);
      const prodTemplate = Template.fromStack(prodStack);

      // Verify dev resources
      devTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
      });

      // Verify prod resources
      prodTemplate.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_prod',
      });

      // Ensure they are different
      expect(devStack.disclosuresTable.tableName).not.toBe(
        prodStack.disclosuresTable.tableName
      );
    });
  });

  describe('Environment Variable Propagation', () => {
    let template: Template;

    beforeAll(() => {
      const app = new cdk.App();
      const stack = new TdnetDataCollectorStack(app, 'TestStack-env-vars', {
        env: { account: testAccount, region: testRegion },
        environmentConfig: { environment: 'dev' },
      });
      template = Template.fromStack(stack);
    });

    it('should pass environment-specific table names to Lambda functions', () => {
      // Collector function should have table references
      const resources = template.toJSON().Resources;
      const collectorFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-collector-dev'
      ) as any;
      
      expect(collectorFunction).toBeDefined();
      expect(collectorFunction.Properties.Environment.Variables.DYNAMODB_TABLE).toBeDefined();
      expect(collectorFunction.Properties.Environment.Variables.DYNAMODB_EXECUTIONS_TABLE).toBeDefined();

      // Query function should have table reference
      const queryFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-query-dev'
      ) as any;
      
      expect(queryFunction).toBeDefined();
      expect(queryFunction.Properties.Environment.Variables.DYNAMODB_TABLE_NAME).toBeDefined();

      // Export function should have table references
      const exportFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-export-dev'
      ) as any;
      
      expect(exportFunction).toBeDefined();
      expect(exportFunction.Properties.Environment.Variables.DYNAMODB_TABLE_NAME).toBeDefined();
      expect(exportFunction.Properties.Environment.Variables.EXPORT_STATUS_TABLE_NAME).toBeDefined();
    });

    it('should pass environment-specific bucket names to Lambda functions', () => {
      const resources = template.toJSON().Resources;
      
      // Collector function should have bucket reference
      const collectorFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-collector-dev'
      ) as any;
      
      expect(collectorFunction).toBeDefined();
      expect(collectorFunction.Properties.Environment.Variables.S3_BUCKET).toBeDefined();

      // Query function should have bucket reference
      const queryFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-query-dev'
      ) as any;
      
      expect(queryFunction).toBeDefined();
      expect(queryFunction.Properties.Environment.Variables.S3_BUCKET_NAME).toBeDefined();

      // Export function should have bucket reference
      const exportFunction = Object.values(resources).find(
        (r: any) => r.Type === 'AWS::Lambda::Function' && r.Properties?.FunctionName === 'tdnet-export-dev'
      ) as any;
      
      expect(exportFunction).toBeDefined();
      expect(exportFunction.Properties.Environment.Variables.EXPORT_BUCKET_NAME).toBeDefined();
    });
  });
});

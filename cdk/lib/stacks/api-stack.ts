import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';

/**
 * API Stack - API Gateway, WAF
 * 変更頻度: 中（月数回）
 * 依存: Foundation Stack, Compute Stack
 */
export interface TdnetApiStackProps extends cdk.StackProps {
  environment: Environment;
  queryFunction: lambda.IFunction;
  exportFunction: lambda.IFunction;
  collectFunction: lambda.IFunction;
  collectStatusFunction: lambda.IFunction;
  exportStatusFunction: lambda.IFunction;
  pdfDownloadFunction: lambda.IFunction;
}

export class TdnetApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: TdnetApiStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // ========================================
    // API Gateway
    // ========================================

    this.api = new apigateway.RestApi(this, 'TdnetApi', {
      restApiName: `tdnet-data-collector-api-${env}`,
      description: 'TDnet Data Collector REST API',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
      cloudWatchRole: true,
    });

    // ========================================
    // API Key & Usage Plan
    // ========================================

    this.apiKey = new apigateway.ApiKey(this, 'TdnetApiKey', {
      apiKeyName: `tdnet-api-key-${env}`,
      description: 'API Key for TDnet Data Collector',
      enabled: true,
    });

    const usagePlan = this.api.addUsagePlan('TdnetUsagePlan', {
      name: `tdnet-usage-plan-${env}`,
      description: 'Usage plan for TDnet Data Collector API',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiKey(this.apiKey);
    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // ========================================
    // WAF Web ACL
    // ========================================

    this.webAcl = new wafv2.CfnWebACL(this, 'TdnetWebAcl', {
      name: `tdnet-web-acl-${env}`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: 'Web ACL for TDnet Data Collector API',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'TdnetWebAcl',
      },
      rules: [
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'RateLimitExceeded',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
      ],
      customResponseBodies: {
        RateLimitExceeded: {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error_code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          }),
        },
      },
    });

    new wafv2.CfnWebACLAssociation(this, 'TdnetWebAclAssociation', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });

    // ========================================
    // API Endpoints
    // ========================================

    // GET /disclosures
    const disclosuresResource = this.api.root.addResource('disclosures');
    const disclosuresIntegration = new apigateway.LambdaIntegration(props.queryFunction, {
      proxy: true,
    });

    disclosuresResource.addMethod('GET', disclosuresIntegration, {
      apiKeyRequired: true,
    });

    // POST /exports
    const exportsResource = this.api.root.addResource('exports');
    const exportsIntegration = new apigateway.LambdaIntegration(props.exportFunction, {
      proxy: true,
    });

    exportsResource.addMethod('POST', exportsIntegration, {
      apiKeyRequired: true,
    });

    // GET /exports/{export_id}
    const exportIdResource = exportsResource.addResource('{export_id}');
    const exportStatusIntegration = new apigateway.LambdaIntegration(props.exportStatusFunction, {
      proxy: true,
    });

    exportIdResource.addMethod('GET', exportStatusIntegration, {
      apiKeyRequired: true,
    });

    // POST /collect
    const collectResource = this.api.root.addResource('collect');
    const collectIntegration = new apigateway.LambdaIntegration(props.collectFunction, {
      proxy: true,
    });

    collectResource.addMethod('POST', collectIntegration, {
      apiKeyRequired: true,
    });

    // GET /collect/{execution_id}
    const collectStatusResource = collectResource.addResource('{execution_id}');
    const collectStatusIntegration = new apigateway.LambdaIntegration(props.collectStatusFunction, {
      proxy: true,
    });

    collectStatusResource.addMethod('GET', collectStatusIntegration, {
      apiKeyRequired: true,
    });

    // GET /disclosures/{disclosure_id}/pdf
    const disclosureIdResource = disclosuresResource.addResource('{disclosure_id}');
    const pdfResource = disclosureIdResource.addResource('pdf');
    const pdfDownloadIntegration = new apigateway.LambdaIntegration(props.pdfDownloadFunction, {
      proxy: true,
    });

    pdfResource.addMethod('GET', pdfDownloadIntegration, {
      apiKeyRequired: true,
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      exportName: `TdnetApiEndpoint-${env}`,
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: this.apiKey.keyId,
      exportName: `TdnetApiKeyId-${env}`,
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      exportName: `TdnetWebAclArn-${env}`,
    });
  }
}

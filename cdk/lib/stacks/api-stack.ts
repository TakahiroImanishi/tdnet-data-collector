import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';
import { WafConstruct } from '../constructs/waf';

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
  healthFunction: lambda.IFunction;
  statsFunction: lambda.IFunction;
}

export class TdnetApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly wafConstruct: WafConstruct;

  constructor(scope: Construct, id: string, props: TdnetApiStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // タグ付け戦略: コスト管理と運用管理のためのタグ
    cdk.Tags.of(this).add('Project', 'TDnetDataCollector');
    cdk.Tags.of(this).add('Environment', env);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', 'Engineering');
    cdk.Tags.of(this).add('Owner', 'DataTeam');

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
      // TLS 1.2以上を強制（カスタムドメイン使用時）
      // 注: デフォルトのAPI Gateway URLはTLS 1.2がデフォルトで有効
      // カスタムドメインを使用する場合は、DomainNameでsecurityPolicyを設定
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

    this.wafConstruct = new WafConstruct(this, 'Waf', {
      environment: env,
      api: this.api,
      rateLimitPerFiveMinutes: 500, // 100リクエスト/分相当
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

    // GET /health
    const healthResource = this.api.root.addResource('health');
    const healthIntegration = new apigateway.LambdaIntegration(props.healthFunction, {
      proxy: true,
    });

    healthResource.addMethod('GET', healthIntegration, {
      apiKeyRequired: false, // ヘルスチェックは認証不要
    });

    // GET /stats
    const statsResource = this.api.root.addResource('stats');
    const statsIntegration = new apigateway.LambdaIntegration(props.statsFunction, {
      proxy: true,
    });

    statsResource.addMethod('GET', statsIntegration, {
      apiKeyRequired: true, // 統計情報は認証必要
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

    // カスタムドメイン使用時のTLS 1.2設定例（コメントアウト）
    // const domainName = new apigateway.DomainName(this, 'CustomDomain', {
    //   domainName: 'api.example.com',
    //   certificate: certificate, // ACM証明書
    //   securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    // });
    // 
    // new apigateway.BasePathMapping(this, 'BasePathMapping', {
    //   domainName: domainName,
    //   restApi: this.api,
    // });
  }
}

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Environment, getEnvironmentConfig } from './config/environment-config';
import { CloudWatchAlarms } from './constructs/cloudwatch-alarms';

/**
 * Stack properties with environment configuration
 */
export interface TdnetDataCollectorStackProps extends cdk.StackProps {
  /**
   * Environment configuration (optional, defaults to 'dev')
   */
  environmentConfig?: {
    environment: Environment;
  };
}

export class TdnetDataCollectorStack extends cdk.Stack {
  // Public properties for cross-stack references
  public readonly disclosuresTable: dynamodb.Table;
  public readonly executionsTable: dynamodb.Table;
  public readonly exportStatusTable: dynamodb.Table;
  public readonly pdfsBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly dashboardBucket: s3.Bucket;
  public readonly cloudtrailLogsBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly webAcl: wafv2.CfnWebACL;

  // Environment configuration (renamed to avoid conflict with base class)
  private readonly deploymentEnvironment: Environment;

  constructor(scope: Construct, id: string, props?: TdnetDataCollectorStackProps) {
    super(scope, id, props);

    // Extract environment configuration (default to 'dev')
    this.deploymentEnvironment = props?.environmentConfig?.environment ?? 'dev';

    // Get environment-specific Lambda configurations
    const envConfig = getEnvironmentConfig(this.deploymentEnvironment);

    // Helper function to generate environment-specific resource names
    const getResourceName = (baseName: string): string => {
      return `${baseName}_${this.deploymentEnvironment}`;
    };

    // Helper function to generate environment-specific bucket names
    const getBucketName = (baseName: string): string => {
      return `${baseName}-${this.deploymentEnvironment}-${cdk.Aws.ACCOUNT_ID}`;
    };

    // ========================================
    // Phase 1: DynamoDB Tables
    // ========================================

    // 1. tdnet_disclosures - 開示情報メタデータテーブル
    this.disclosuresTable = new dynamodb.Table(this, 'DisclosuresTable', {
      tableName: getResourceName('tdnet_disclosures'),
      partitionKey: {
        name: 'disclosure_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理キーで暗号化
      pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // GSI: CompanyCode_DiscloseDate - 企業コードと開示日時でクエリ
    this.disclosuresTable.addGlobalSecondaryIndex({
      indexName: 'GSI_CompanyCode_DiscloseDate',
      partitionKey: {
        name: 'company_code',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL, // すべての属性を投影
    });

    // GSI: DatePartition - 月単位の効率的なクエリ（YYYY-MM形式）
    this.disclosuresTable.addGlobalSecondaryIndex({
      indexName: 'GSI_DatePartition',
      partitionKey: {
        name: 'date_partition',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. tdnet_executions - 実行状態管理テーブル
    this.executionsTable = new dynamodb.Table(this, 'ExecutionsTable', {
      tableName: getResourceName('tdnet_executions'),
      partitionKey: {
        name: 'execution_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理キーで暗号化
      timeToLiveAttribute: 'ttl', // TTL有効化（30日後に自動削除）
      pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // GSI: Status_StartedAt - 実行状態と開始日時でクエリ
    this.executionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI_Status_StartedAt',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'started_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 3. tdnet_export_status - エクスポート状態管理テーブル
    this.exportStatusTable = new dynamodb.Table(this, 'ExportStatusTable', {
      tableName: getResourceName('tdnet_export_status'),
      partitionKey: {
        name: 'export_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理キーで暗号化
      timeToLiveAttribute: 'ttl', // TTL有効化（30日後に自動削除）
      pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // GSI: Status_RequestedAt - エクスポート状態とリクエスト日時でクエリ
    this.exportStatusTable.addGlobalSecondaryIndex({
      indexName: 'GSI_Status_RequestedAt',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'requested_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DisclosuresTableName', {
      value: this.disclosuresTable.tableName,
      description: 'DynamoDB table name for disclosures',
      exportName: 'TdnetDisclosuresTableName',
    });

    new cdk.CfnOutput(this, 'ExecutionsTableName', {
      value: this.executionsTable.tableName,
      description: 'DynamoDB table name for executions',
      exportName: 'TdnetExecutionsTableName',
    });

    new cdk.CfnOutput(this, 'ExportStatusTableName', {
      value: this.exportStatusTable.tableName,
      description: 'DynamoDB table name for export status',
      exportName: 'TdnetExportStatusTableName',
    });

    // ========================================
    // Phase 1: S3 Buckets
    // ========================================

    // 1. PDFバケット - TDnetからダウンロードしたPDFファイルの長期保存
    this.pdfsBucket = new s3.Bucket(this, 'PdfsBucket', {
      bucketName: getBucketName('tdnet-data-collector-pdfs'),
      encryption: s3.BucketEncryption.S3_MANAGED, // S3マネージドキーで暗号化
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // パブリックアクセスブロック
      versioned: true, // バージョニング有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
      autoDeleteObjects: false, // 自動削除無効
      lifecycleRules: [
        {
          id: 'TransitionToStandardIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90), // 90日後にStandard-IAに移行
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365), // 365日後にGlacierに移行
            },
          ],
        },
      ],
    });

    // 2. エクスポートバケット - ユーザーがエクスポートしたCSV/JSONファイルの一時保存
    this.exportsBucket = new s3.Bucket(this, 'ExportsBucket', {
      bucketName: getBucketName('tdnet-data-collector-exports'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'DeleteAfter7Days',
          enabled: true,
          expiration: cdk.Duration.days(7), // 7日後に自動削除
        },
      ],
    });

    // 3. ダッシュボードバケット - Webダッシュボードの静的ファイルホスティング
    this.dashboardBucket = new s3.Bucket(this, 'DashboardBucket', {
      bucketName: getBucketName('tdnet-dashboard'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // CloudFront OAI経由でのみアクセス
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      // ライフサイクルポリシーなし（静的ファイルは永続保存）
    });

    // 4. CloudTrailログバケット - 監査ログの長期保存
    this.cloudtrailLogsBucket = new s3.Bucket(this, 'CloudTrailLogsBucket', {
      bucketName: `tdnet-cloudtrail-logs-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'ArchiveAndDelete',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90), // 90日後にGlacierに移行
            },
          ],
          expiration: cdk.Duration.days(2555), // 7年後に自動削除（コンプライアンス要件）
        },
      ],
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'PdfsBucketName', {
      value: this.pdfsBucket.bucketName,
      description: 'S3 bucket name for PDF files',
      exportName: 'TdnetPdfsBucketName',
    });

    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      description: 'S3 bucket name for export files',
      exportName: 'TdnetExportsBucketName',
    });

    new cdk.CfnOutput(this, 'DashboardBucketName', {
      value: this.dashboardBucket.bucketName,
      description: 'S3 bucket name for dashboard',
      exportName: 'TdnetDashboardBucketName',
    });

    new cdk.CfnOutput(this, 'CloudTrailLogsBucketName', {
      value: this.cloudtrailLogsBucket.bucketName,
      description: 'S3 bucket name for CloudTrail logs',
      exportName: 'TdnetCloudTrailLogsBucketName',
    });

    // ========================================
    // Phase 2: Secrets Manager（Lambda関数より前に初期化）
    // ========================================

    // IMPORTANT: apiKeyValueはLambda関数の環境変数で使用されるため、
    // Lambda関数定義より前に初期化する必要があります
    const apiKeyValue = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApiKeySecret',
      '/tdnet/api-key'
    );

    // ========================================
    // Phase 1: Lambda Functions
    // ========================================

    // Lambda Collector Function
    const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
      functionName: `tdnet-collector-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collector'),
      timeout: cdk.Duration.seconds(envConfig.collector.timeout),
      memorySize: envConfig.collector.memorySize,
      environment: {
        DYNAMODB_TABLE: this.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: this.executionsTable.tableName,
        S3_BUCKET: this.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.collector.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
      reservedConcurrentExecutions: 1, // 同時実行数を1に制限（レート制限のため）
    });

    // IAM権限の付与
    // DynamoDB: 両テーブルへの読み書き権限
    this.disclosuresTable.grantReadWriteData(collectorFunction);
    this.executionsTable.grantReadWriteData(collectorFunction);

    // S3: PDFバケットへの書き込み権限
    this.pdfsBucket.grantPut(collectorFunction);
    this.pdfsBucket.grantRead(collectorFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    collectorFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'CollectorFunctionName', {
      value: collectorFunction.functionName,
      description: 'Lambda Collector function name',
      exportName: 'TdnetCollectorFunctionName',
    });

    new cdk.CfnOutput(this, 'CollectorFunctionArn', {
      value: collectorFunction.functionArn,
      description: 'Lambda Collector function ARN',
      exportName: 'TdnetCollectorFunctionArn',
    });

    // ========================================
    // Phase 2: Lambda Query Function
    // ========================================

    // Lambda Query Function
    const queryFunction = new lambda.Function(this, 'QueryFunction', {
      functionName: `tdnet-query-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/query'),
      timeout: cdk.Duration.seconds(envConfig.query.timeout),
      memorySize: envConfig.query.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: this.disclosuresTable.tableName,
        S3_BUCKET_NAME: this.pdfsBucket.bucketName,
        API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定（セキュリティ修正）
        LOG_LEVEL: envConfig.query.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // DynamoDB: disclosuresテーブルへの読み取り権限
    this.disclosuresTable.grantReadData(queryFunction);

    // S3: PDFバケットへの読み取り権限（署名付きURL生成用）
    this.pdfsBucket.grantRead(queryFunction);

    // Secrets Manager: APIキー読み取り権限
    apiKeyValue.grantRead(queryFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    queryFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'QueryFunctionName', {
      value: queryFunction.functionName,
      description: 'Lambda Query function name',
      exportName: 'TdnetQueryFunctionName',
    });

    new cdk.CfnOutput(this, 'QueryFunctionArn', {
      value: queryFunction.functionArn,
      description: 'Lambda Query function ARN',
      exportName: 'TdnetQueryFunctionArn',
    });

    // ========================================
    // Phase 2: Lambda Export Function
    // ========================================

    // Lambda Export Function
    const exportFunction = new lambda.Function(this, 'ExportFunction', {
      functionName: `tdnet-export-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/export'),
      timeout: cdk.Duration.seconds(envConfig.export.timeout),
      memorySize: envConfig.export.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: this.disclosuresTable.tableName,
        EXPORT_STATUS_TABLE_NAME: this.exportStatusTable.tableName,
        EXPORT_BUCKET_NAME: this.exportsBucket.bucketName,
        API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定（セキュリティ修正）
        LOG_LEVEL: envConfig.export.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
        // AWS_REGION is automatically set by Lambda runtime
      },
    });

    // IAM権限の付与
    // DynamoDB: disclosuresテーブルへの読み取り権限
    this.disclosuresTable.grantReadData(exportFunction);

    // DynamoDB: exportStatusテーブルへの読み書き権限
    this.exportStatusTable.grantReadWriteData(exportFunction);

    // S3: exportsバケットへの書き込み権限
    this.exportsBucket.grantPut(exportFunction);
    this.exportsBucket.grantRead(exportFunction);

    // Secrets Manager: APIキー読み取り権限
    apiKeyValue.grantRead(exportFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    exportFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ExportFunctionName', {
      value: exportFunction.functionName,
      description: 'Lambda Export function name',
      exportName: 'TdnetExportFunctionName',
    });

    new cdk.CfnOutput(this, 'ExportFunctionArn', {
      value: exportFunction.functionArn,
      description: 'Lambda Export function ARN',
      exportName: 'TdnetExportFunctionArn',
    });

    // ========================================
    // Phase 2: API Gateway + WAF
    // ========================================

    // 1. API Gateway REST API
    this.api = new apigateway.RestApi(this, 'TdnetApi', {
      restApiName: `tdnet-data-collector-api-${this.deploymentEnvironment}`,
      description: 'TDnet Data Collector REST API',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100, // リクエスト/秒
        throttlingBurstLimit: 200, // バーストリクエスト数
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // 本番環境では特定のオリジンに制限
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
      cloudWatchRole: true, // CloudWatch Logsへのログ出力を有効化
    });

    // 2. API Key生成
    // Note: apiKeyValueは既にファイル先頭で初期化済み
    this.apiKey = new apigateway.ApiKey(this, 'TdnetApiKey', {
      apiKeyName: `tdnet-api-key-${this.deploymentEnvironment}`,
      description: 'API Key for TDnet Data Collector',
      enabled: true,
      value: apiKeyValue.secretValue.unsafeUnwrap(), // Secrets Managerから取得
    });

    // 3. Usage Plan設定
    const usagePlan = this.api.addUsagePlan('TdnetUsagePlan', {
      name: `tdnet-usage-plan-${this.deploymentEnvironment}`,
      description: 'Usage plan for TDnet Data Collector API',
      throttle: {
        rateLimit: 100, // リクエスト/秒
        burstLimit: 200, // バーストリクエスト数
      },
      quota: {
        limit: 10000, // 月間リクエスト数上限
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiKey(this.apiKey);
    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // 4. AWS WAF Web ACL設定
    this.webAcl = new wafv2.CfnWebACL(this, 'TdnetWebAcl', {
      name: `tdnet-web-acl-${this.deploymentEnvironment}`,
      scope: 'REGIONAL', // API Gatewayは REGIONAL
      defaultAction: { allow: {} },
      description: 'Web ACL for TDnet Data Collector API',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'TdnetWebAcl',
      },
      rules: [
        // ルール1: レート制限（2000リクエスト/5分）
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: 2000, // 5分間のリクエスト数上限
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
        // ルール2: AWSマネージドルール - Common Rule Set
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
        // ルール3: AWSマネージドルール - Known Bad Inputs
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

    // 5. WAFとAPI Gatewayの関連付け
    new wafv2.CfnWebACLAssociation(this, 'TdnetWebAclAssociation', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'TdnetApiEndpoint',
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: this.apiKey.keyId,
      description: 'API Key ID',
      exportName: 'TdnetApiKeyId',
    });

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: 'TdnetWebAclArn',
    });

    // ========================================
    // Phase 2: API Gateway Integrations
    // ========================================

    // 1. GET /disclosures エンドポイント
    const disclosuresResource = this.api.root.addResource('disclosures');
    const disclosuresIntegration = new apigateway.LambdaIntegration(queryFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200', // Success
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Content-Type': "'application/json'",
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    disclosuresResource.addMethod('GET', disclosuresIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      requestParameters: {
        'method.request.querystring.company_code': false,
        'method.request.querystring.start_date': false,
        'method.request.querystring.end_date': false,
        'method.request.querystring.disclosure_type': false,
        'method.request.querystring.format': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.offset': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Content-Type': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // 2. POST /exports エンドポイント
    const exportsResource = this.api.root.addResource('exports');
    const exportsIntegration = new apigateway.LambdaIntegration(exportFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '202', // Accepted
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    exportsResource.addMethod('POST', exportsIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      methodResponses: [
        {
          statusCode: '202',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // ========================================
    // Phase 2: Lambda Collect Functions
    // ========================================

    // Lambda Collect Function (POST /collect)
    const collectFunction = new lambda.Function(this, 'CollectFunction', {
      functionName: `tdnet-collector-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collect'),
      timeout: cdk.Duration.seconds(envConfig.collect.timeout),
      memorySize: envConfig.collect.memorySize,
      environment: {
        COLLECTOR_FUNCTION_NAME: collectorFunction.functionName,
        API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定（セキュリティ修正）
        LOG_LEVEL: envConfig.collect.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // Lambda Collectorを呼び出す権限
    collectorFunction.grantInvoke(collectFunction);

    // Secrets Manager: APIキー読み取り権限
    apiKeyValue.grantRead(collectFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    collectFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // Lambda Collect Status Function (GET /collect/{execution_id})
    const collectStatusFunction = new lambda.Function(this, 'CollectStatusFunction', {
      functionName: `tdnet-collect-status-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collect-status'),
      timeout: cdk.Duration.seconds(envConfig.collectStatus.timeout),
      memorySize: envConfig.collectStatus.memorySize,
      environment: {
        DYNAMODB_EXECUTIONS_TABLE: this.executionsTable.tableName,
        S3_BUCKET: this.pdfsBucket.bucketName, // 追加: S3バケット名
        LOG_LEVEL: envConfig.collectStatus.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // DynamoDB: executionsテーブルへの読み取り権限
    this.executionsTable.grantReadData(collectStatusFunction);

    // S3: PDFバケットへの読み取り権限（追加）
    this.pdfsBucket.grantRead(collectStatusFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    collectStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // ========================================
    // Phase 2: /collect API Gateway Integrations
    // ========================================

    // 1. /collect エンドポイント
    const collectResource = this.api.root.addResource('collect');

    // POST /collect
    const collectIntegration = new apigateway.LambdaIntegration(collectFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200', // Success
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    collectResource.addMethod('POST', collectIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // 2. /collect/{execution_id} エンドポイント
    const collectStatusResource = collectResource.addResource('{execution_id}');

    // GET /collect/{execution_id}
    const collectStatusIntegration = new apigateway.LambdaIntegration(collectStatusFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200', // Success
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '404', // Not Found
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    collectStatusResource.addMethod('GET', collectStatusIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // ========================================
    // Phase 2: Export Status & PDF Download Lambda Functions
    // ========================================

    // Lambda Export Status Function (GET /exports/{export_id})
    const exportStatusFunction = new lambda.Function(this, 'ExportStatusFunction', {
      functionName: `tdnet-export-status-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/api/export-status'),
      timeout: cdk.Duration.seconds(envConfig.exportStatus.timeout),
      memorySize: envConfig.exportStatus.memorySize,
      environment: {
        EXPORT_STATUS_TABLE_NAME: this.exportStatusTable.tableName,
        API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定（セキュリティ修正）
        LOG_LEVEL: envConfig.exportStatus.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // DynamoDB: exportStatusテーブルへの読み取り権限
    this.exportStatusTable.grantReadData(exportStatusFunction);

    // Secrets Manager: APIキー読み取り権限
    apiKeyValue.grantRead(exportStatusFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    exportStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // Lambda PDF Download Function (GET /disclosures/{disclosure_id}/pdf)
    const pdfDownloadFunction = new lambda.Function(this, 'PdfDownloadFunction', {
      functionName: `tdnet-pdf-download-${this.deploymentEnvironment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/api/pdf-download'),
      timeout: cdk.Duration.seconds(envConfig.pdfDownload.timeout),
      memorySize: envConfig.pdfDownload.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: this.disclosuresTable.tableName,
        S3_BUCKET_NAME: this.pdfsBucket.bucketName,
        API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定（セキュリティ修正）
        LOG_LEVEL: envConfig.pdfDownload.logLevel,
        ENVIRONMENT: this.deploymentEnvironment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // DynamoDB: disclosuresテーブルへの読み取り権限
    this.disclosuresTable.grantReadData(pdfDownloadFunction);

    // S3: PDFバケットへの読み取り権限（署名付きURL生成用）
    this.pdfsBucket.grantRead(pdfDownloadFunction);

    // Secrets Manager: APIキー読み取り権限
    apiKeyValue.grantRead(pdfDownloadFunction);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    pdfDownloadFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // ========================================
    // Phase 2: Export Status & PDF Download API Gateway Integrations
    // ========================================

    // 1. GET /exports/{export_id} エンドポイント
    const exportIdResource = exportsResource.addResource('{export_id}');

    const exportStatusIntegration = new apigateway.LambdaIntegration(exportStatusFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200', // Success
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '404', // Not Found
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    exportIdResource.addMethod('GET', exportStatusIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // 2. GET /disclosures/{disclosure_id}/pdf エンドポイント
    const disclosureIdResource = disclosuresResource.addResource('{disclosure_id}');
    const pdfResource = disclosureIdResource.addResource('pdf');

    const pdfDownloadIntegration = new apigateway.LambdaIntegration(pdfDownloadFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200', // Success
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '400', // Bad Request
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '401', // Unauthorized
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '404', // Not Found
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
        {
          statusCode: '500', // Internal Server Error
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    });

    pdfResource.addMethod('GET', pdfDownloadIntegration, {
      apiKeyRequired: true, // APIキー認証必須
      requestParameters: {
        'method.request.querystring.expiration': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '400',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '401',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '404',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
        {
          statusCode: '500',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'ExportStatusFunctionName', {
      value: exportStatusFunction.functionName,
      description: 'Lambda Export Status function name',
      exportName: 'TdnetExportStatusFunctionName',
    });

    new cdk.CfnOutput(this, 'PdfDownloadFunctionName', {
      value: pdfDownloadFunction.functionName,
      description: 'Lambda PDF Download function name',
      exportName: 'TdnetPdfDownloadFunctionName',
    });

    new cdk.CfnOutput(this, 'CollectFunctionName', {
      value: collectFunction.functionName,
      description: 'Lambda Collect function name',
      exportName: 'TdnetCollectFunctionName',
    });

    new cdk.CfnOutput(this, 'CollectStatusFunctionName', {
      value: collectStatusFunction.functionName,
      description: 'Lambda Collect Status function name',
      exportName: 'TdnetCollectStatusFunctionName',
    });

    new cdk.CfnOutput(this, 'DisclosuresEndpoint', {
      value: `${this.api.url}disclosures`,
      description: 'Disclosures query API endpoint URL',
      exportName: 'TdnetDisclosuresEndpoint',
    });

    new cdk.CfnOutput(this, 'ExportsEndpoint', {
      value: `${this.api.url}exports`,
      description: 'Export API endpoint URL',
      exportName: 'TdnetExportsEndpoint',
    });

    new cdk.CfnOutput(this, 'CollectEndpoint', {
      value: `${this.api.url}collect`,
      description: 'Collect API endpoint URL',
      exportName: 'TdnetCollectEndpoint',
    });

    // ========================================
    // Phase 3: CloudWatch Alarms
    // ========================================

    // すべてのLambda関数を監視対象として収集
    const allLambdaFunctions = [
      collectorFunction,
      queryFunction,
      exportFunction,
      collectFunction,
      collectStatusFunction,
      exportStatusFunction,
      pdfDownloadFunction,
    ];

    // CloudWatch Alarmsを作成
    const cloudwatchAlarms = new CloudWatchAlarms(this, 'CloudWatchAlarms', {
      lambdaFunctions: allLambdaFunctions,
      environment: this.deploymentEnvironment,
      // alertEmail: 'your-email@example.com', // オプション: メール通知先
      errorRateThreshold: 10, // 10%
      durationThreshold: 840, // 14分 = 840秒
      collectionSuccessRateThreshold: 95, // 95%
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'CloudWatchAlarmsCount', {
      value: cloudwatchAlarms.alarms.length.toString(),
      description: 'Number of CloudWatch Alarms created',
    });
  }
}

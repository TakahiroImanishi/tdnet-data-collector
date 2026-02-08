import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class TdnetDataCollectorStack extends cdk.Stack {
  // Public properties for cross-stack references
  public readonly disclosuresTable: dynamodb.Table;
  public readonly executionsTable: dynamodb.Table;
  public readonly pdfsBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly dashboardBucket: s3.Bucket;
  public readonly cloudtrailLogsBucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly apiKey: apigateway.ApiKey;
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Phase 1: DynamoDB Tables
    // ========================================

    // 1. tdnet_disclosures - 開示情報メタデータテーブル
    this.disclosuresTable = new dynamodb.Table(this, 'DisclosuresTable', {
      tableName: 'tdnet_disclosures',
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
      tableName: 'tdnet_executions',
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

    // ========================================
    // Phase 1: S3 Buckets
    // ========================================

    // 1. PDFバケット - TDnetからダウンロードしたPDFファイルの長期保存
    this.pdfsBucket = new s3.Bucket(this, 'PdfsBucket', {
      bucketName: `tdnet-data-collector-pdfs-${this.account}`,
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
      bucketName: `tdnet-data-collector-exports-${this.account}`,
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
      bucketName: `tdnet-dashboard-${this.account}`,
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
    // Phase 1: Lambda Functions
    // ========================================

    // Lambda Collector Function
    const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
      functionName: 'tdnet-collector',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collector'),
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: {
        DYNAMODB_TABLE: this.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: this.executionsTable.tableName,
        S3_BUCKET: this.pdfsBucket.bucketName,
        LOG_LEVEL: 'info',
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
      functionName: 'tdnet-query',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/query'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        DYNAMODB_TABLE_NAME: this.disclosuresTable.tableName,
        S3_BUCKET_NAME: this.pdfsBucket.bucketName,
        API_KEY: apiKeyValue.secretValue.unsafeUnwrap(), // Secrets Managerから取得
        LOG_LEVEL: 'info',
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // IAM権限の付与
    // DynamoDB: disclosuresテーブルへの読み取り権限
    this.disclosuresTable.grantReadData(queryFunction);

    // S3: PDFバケットへの読み取り権限（署名付きURL生成用）
    this.pdfsBucket.grantRead(queryFunction);

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

    // Stack resources will be added here in subsequent tasks
    // Phase 2: Lambda Export function, API Gateway integration
    // Phase 3: EventBridge rules, SNS topics, CloudWatch monitoring
    // Phase 4: CloudTrail, security configurations

    // ========================================
    // Phase 2: API Gateway + WAF
    // ========================================

    // 1. API Gateway REST API
    this.api = new apigateway.RestApi(this, 'TdnetApi', {
      restApiName: 'tdnet-data-collector-api',
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

    // 2. API Key生成とSecrets Managerへの保存
    const apiKeyValue = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApiKeySecret',
      '/tdnet/api-key'
    );

    this.apiKey = new apigateway.ApiKey(this, 'TdnetApiKey', {
      apiKeyName: 'tdnet-api-key',
      description: 'API Key for TDnet Data Collector',
      enabled: true,
      value: apiKeyValue.secretValue.unsafeUnwrap(), // Secrets Managerから取得
    });

    // 3. Usage Plan設定
    const usagePlan = this.api.addUsagePlan('TdnetUsagePlan', {
      name: 'tdnet-usage-plan',
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
      name: 'tdnet-web-acl',
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
  }
}

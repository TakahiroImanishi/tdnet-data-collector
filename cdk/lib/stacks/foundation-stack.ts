import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';
import { SecretsManagerConstruct } from '../constructs/secrets-manager';
import { DashboardCloudFront } from '../constructs/cloudfront';

/**
 * Foundation Stack - 基盤リソース（DynamoDB, S3, Secrets Manager）
 * 変更頻度: 低（月1回以下）
 * 依存: なし
 */
export interface TdnetFoundationStackProps extends cdk.StackProps {
  environment: Environment;
}

export class TdnetFoundationStack extends cdk.Stack {
  // Public properties for cross-stack references
  public readonly disclosuresTable: dynamodb.Table;
  public readonly executionsTable: dynamodb.Table;
  public readonly exportStatusTable: dynamodb.Table;
  public readonly pdfsBucket: s3.Bucket;
  public readonly exportsBucket: s3.Bucket;
  public readonly dashboardBucket: s3.Bucket;
  public readonly cloudtrailLogsBucket: s3.Bucket;
  public readonly secretsManager: SecretsManagerConstruct;
  public readonly dashboardCloudFront: DashboardCloudFront;

  constructor(scope: Construct, id: string, props: TdnetFoundationStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // Helper functions
    const getResourceName = (baseName: string): string => {
      return `${baseName}_${env}`;
    };

    const getBucketName = (baseName: string): string => {
      return `${baseName}-${env}-${cdk.Aws.ACCOUNT_ID}`;
    };

    // ========================================
    // DynamoDB Tables
    // ========================================

    // 1. tdnet_disclosures
    this.disclosuresTable = new dynamodb.Table(this, 'DisclosuresTable', {
      tableName: getResourceName('tdnet_disclosures'),
      partitionKey: {
        name: 'disclosure_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

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
      projectionType: dynamodb.ProjectionType.ALL,
    });

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

    // 2. tdnet_executions
    this.executionsTable = new dynamodb.Table(this, 'ExecutionsTable', {
      tableName: getResourceName('tdnet_executions'),
      partitionKey: {
        name: 'execution_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

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

    // 3. tdnet_export_status
    this.exportStatusTable = new dynamodb.Table(this, 'ExportStatusTable', {
      tableName: getResourceName('tdnet_export_status'),
      partitionKey: {
        name: 'export_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

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

    // ========================================
    // S3 Buckets
    // ========================================

    // 1. PDFバケット
    this.pdfsBucket = new s3.Bucket(this, 'PdfsBucket', {
      bucketName: getBucketName('tdnet-data-collector-pdfs'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'TransitionToStandardIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(365),
            },
          ],
        },
      ],
    });

    // 2. エクスポートバケット
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
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    // 3. ダッシュボードバケット
    this.dashboardBucket = new s3.Bucket(this, 'DashboardBucket', {
      bucketName: getBucketName('tdnet-dashboard'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // 4. CloudTrailログバケット
    this.cloudtrailLogsBucket = new s3.Bucket(this, 'CloudTrailLogsBucket', {
      bucketName: getBucketName('tdnet-cloudtrail-logs'),
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
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(2555),
        },
      ],
    });

    // ========================================
    // Secrets Manager
    // ========================================

    this.secretsManager = new SecretsManagerConstruct(this, 'SecretsManager', {
      environment: env,
      enableRotation: false,
      useExistingSecret: true,
    });

    // ========================================
    // CloudFront Distribution
    // ========================================

    this.dashboardCloudFront = new DashboardCloudFront(this, 'DashboardCloudFront', {
      dashboardBucket: this.dashboardBucket,
      environment: env,
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'DisclosuresTableName', {
      value: this.disclosuresTable.tableName,
      exportName: `TdnetDisclosuresTableName-${env}`,
    });

    new cdk.CfnOutput(this, 'ExecutionsTableName', {
      value: this.executionsTable.tableName,
      exportName: `TdnetExecutionsTableName-${env}`,
    });

    new cdk.CfnOutput(this, 'ExportStatusTableName', {
      value: this.exportStatusTable.tableName,
      exportName: `TdnetExportStatusTableName-${env}`,
    });

    new cdk.CfnOutput(this, 'PdfsBucketName', {
      value: this.pdfsBucket.bucketName,
      exportName: `TdnetPdfsBucketName-${env}`,
    });

    new cdk.CfnOutput(this, 'ExportsBucketName', {
      value: this.exportsBucket.bucketName,
      exportName: `TdnetExportsBucketName-${env}`,
    });

    new cdk.CfnOutput(this, 'DashboardBucketName', {
      value: this.dashboardBucket.bucketName,
      exportName: `TdnetDashboardBucketName-${env}`,
    });

    new cdk.CfnOutput(this, 'CloudTrailLogsBucketName', {
      value: this.cloudtrailLogsBucket.bucketName,
      exportName: `TdnetCloudTrailLogsBucketName-${env}`,
    });

    new cdk.CfnOutput(this, 'ApiKeySecretArn', {
      value: this.secretsManager.apiKeySecret.secretArn,
      exportName: `TdnetApiKeySecretArn-${env}`,
    });
  }
}

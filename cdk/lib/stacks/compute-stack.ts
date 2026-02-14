import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Environment, getEnvironmentConfig } from '../config/environment-config';
import { LambdaDLQ } from '../constructs/lambda-dlq';

/**
 * Compute Stack - Lambda関数とDLQ
 * 変更頻度: 高（週数回）
 * 依存: Foundation Stack
 */
export interface TdnetComputeStackProps extends cdk.StackProps {
  environment: Environment;
  disclosuresTable: dynamodb.ITable;
  executionsTable: dynamodb.ITable;
  exportStatusTable: dynamodb.ITable;
  pdfsBucket: s3.IBucket;
  exportsBucket: s3.IBucket;
  apiKeySecret: secretsmanager.ISecret;
  alertTopic: sns.ITopic;
}

export class TdnetComputeStack extends cdk.Stack {
  // Public properties
  public readonly collectorFunction: lambda.Function;
  public readonly queryFunction: lambda.Function;
  public readonly exportFunction: lambda.Function;
  public readonly collectFunction: lambda.Function;
  public readonly collectStatusFunction: lambda.Function;
  public readonly exportStatusFunction: lambda.Function;
  public readonly pdfDownloadFunction: lambda.Function;
  public readonly dlq: LambdaDLQ;

  constructor(scope: Construct, id: string, props: TdnetComputeStackProps) {
    super(scope, id, props);

    const env = props.environment;
    const envConfig = getEnvironmentConfig(env);

    // ========================================
    // DLQ
    // ========================================

    this.dlq = new LambdaDLQ(this, 'LambdaDLQ', {
      environment: env,
      alertTopic: props.alertTopic,
      queueNamePrefix: 'tdnet',
    });

    // ========================================
    // Lambda Functions
    // ========================================

    // 1. Collector Function
    this.collectorFunction = new lambda.Function(this, 'CollectorFunction', {
      functionName: `tdnet-collector-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collector'),
      timeout: cdk.Duration.seconds(envConfig.collector.timeout),
      memorySize: envConfig.collector.memorySize,
      environment: {
        DYNAMODB_TABLE: props.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        S3_BUCKET: props.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.collector.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      deadLetterQueue: this.dlq.queue,
      deadLetterQueueEnabled: true,
      retryAttempts: 2,
    });

    props.disclosuresTable.grantReadWriteData(this.collectorFunction);
    props.executionsTable.grantReadWriteData(this.collectorFunction);
    props.pdfsBucket.grantPut(this.collectorFunction);
    props.pdfsBucket.grantRead(this.collectorFunction);

    this.collectorFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/Collector',
          },
        },
      })
    );

    // 2. Query Function
    this.queryFunction = new lambda.Function(this, 'QueryFunction', {
      functionName: `tdnet-query-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/query'),
      timeout: cdk.Duration.seconds(envConfig.query.timeout),
      memorySize: envConfig.query.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: envConfig.query.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    props.disclosuresTable.grantReadData(this.queryFunction);
    props.pdfsBucket.grantRead(this.queryFunction);
    props.apiKeySecret.grantRead(this.queryFunction);

    this.queryFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/Query',
          },
        },
      })
    );

    // 3. Export Function
    this.exportFunction = new lambda.Function(this, 'ExportFunction', {
      functionName: `tdnet-export-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/export'),
      timeout: cdk.Duration.seconds(envConfig.export.timeout),
      memorySize: envConfig.export.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
        EXPORT_BUCKET_NAME: props.exportsBucket.bucketName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: envConfig.export.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    props.disclosuresTable.grantReadData(this.exportFunction);
    props.exportStatusTable.grantReadWriteData(this.exportFunction);
    props.exportsBucket.grantPut(this.exportFunction);
    props.exportsBucket.grantRead(this.exportFunction);
    props.apiKeySecret.grantRead(this.exportFunction);

    this.exportFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/Export',
          },
        },
      })
    );

    // 4. Collect Function
    this.collectFunction = new lambda.Function(this, 'CollectFunction', {
      functionName: `tdnet-collect-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collect'),
      timeout: cdk.Duration.seconds(envConfig.collect.timeout),
      memorySize: envConfig.collect.memorySize,
      environment: {
        COLLECTOR_FUNCTION_NAME: this.collectorFunction.functionName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: envConfig.collect.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    this.collectorFunction.grantInvoke(this.collectFunction);
    props.apiKeySecret.grantRead(this.collectFunction);

    this.collectFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/Collect',
          },
        },
      })
    );

    // 5. Collect Status Function
    this.collectStatusFunction = new lambda.Function(this, 'CollectStatusFunction', {
      functionName: `tdnet-collect-status-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collect-status'),
      timeout: cdk.Duration.seconds(envConfig.collectStatus.timeout),
      memorySize: envConfig.collectStatus.memorySize,
      environment: {
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        S3_BUCKET: props.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.collectStatus.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    props.executionsTable.grantReadData(this.collectStatusFunction);
    props.pdfsBucket.grantRead(this.collectStatusFunction);

    this.collectStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/CollectStatus',
          },
        },
      })
    );

    // 6. Export Status Function
    this.exportStatusFunction = new lambda.Function(this, 'ExportStatusFunction', {
      functionName: `tdnet-export-status-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/api/export-status'),
      timeout: cdk.Duration.seconds(envConfig.exportStatus.timeout),
      memorySize: envConfig.exportStatus.memorySize,
      environment: {
        EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: envConfig.exportStatus.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    props.exportStatusTable.grantReadData(this.exportStatusFunction);
    props.apiKeySecret.grantRead(this.exportStatusFunction);

    this.exportStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/ExportStatus',
          },
        },
      })
    );

    // 7. PDF Download Function
    this.pdfDownloadFunction = new lambda.Function(this, 'PdfDownloadFunction', {
      functionName: `tdnet-pdf-download-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/api/pdf-download'),
      timeout: cdk.Duration.seconds(envConfig.pdfDownload.timeout),
      memorySize: envConfig.pdfDownload.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: envConfig.pdfDownload.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    props.disclosuresTable.grantReadData(this.pdfDownloadFunction);
    props.pdfsBucket.grantRead(this.pdfDownloadFunction);
    props.apiKeySecret.grantRead(this.pdfDownloadFunction);

    this.pdfDownloadFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet/PdfDownload',
          },
        },
      })
    );

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'CollectorFunctionArn', {
      value: this.collectorFunction.functionArn,
      exportName: `TdnetCollectorFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'QueryFunctionArn', {
      value: this.queryFunction.functionArn,
      exportName: `TdnetQueryFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'ExportFunctionArn', {
      value: this.exportFunction.functionArn,
      exportName: `TdnetExportFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'CollectFunctionArn', {
      value: this.collectFunction.functionArn,
      exportName: `TdnetCollectFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'CollectStatusFunctionArn', {
      value: this.collectStatusFunction.functionArn,
      exportName: `TdnetCollectStatusFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'ExportStatusFunctionArn', {
      value: this.exportStatusFunction.functionArn,
      exportName: `TdnetExportStatusFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'PdfDownloadFunctionArn', {
      value: this.pdfDownloadFunction.functionArn,
      exportName: `TdnetPdfDownloadFunctionArn-${env}`,
    });
  }
}

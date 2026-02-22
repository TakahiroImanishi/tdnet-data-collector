import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
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
  public readonly healthFunction: lambda.Function;
  public readonly statsFunction: lambda.Function;
  public readonly dlq: LambdaDLQ;

  constructor(scope: Construct, id: string, props: TdnetComputeStackProps) {
    super(scope, id, props);

    const env = props.environment;
    const envConfig = getEnvironmentConfig(env);

    // タグ付け戦略: コスト管理と運用管理のためのタグ
    cdk.Tags.of(this).add('Project', 'TDnetDataCollector');
    cdk.Tags.of(this).add('Environment', env);
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', 'Engineering');
    cdk.Tags.of(this).add('Owner', 'DataTeam');

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
    this.collectorFunction = new NodejsFunction(this, 'CollectorFunction', {
      functionName: `tdnet-collector-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/collector/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.collector.timeout),
      memorySize: envConfig.collector.memorySize,
      environment: {
        DYNAMODB_TABLE: props.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        S3_BUCKET: props.pdfsBucket.bucketName,
        TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
        LOG_LEVEL: envConfig.collector.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      deadLetterQueue: this.dlq.queue,
      deadLetterQueueEnabled: true,
      retryAttempts: 2,
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
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
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 2. Query Function
    this.queryFunction = new NodejsFunction(this, 'QueryFunction', {
      functionName: `tdnet-query-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/query/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.query.timeout),
      memorySize: envConfig.query.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.query.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.disclosuresTable.grantReadData(this.queryFunction);
    props.pdfsBucket.grantRead(this.queryFunction);

    this.queryFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 3. Export Function
    this.exportFunction = new NodejsFunction(this, 'ExportFunction', {
      functionName: `tdnet-export-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/export/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.export.timeout),
      memorySize: envConfig.export.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
        EXPORT_BUCKET_NAME: props.exportsBucket.bucketName,
        LOG_LEVEL: envConfig.export.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.disclosuresTable.grantReadData(this.exportFunction);
    props.exportStatusTable.grantReadWriteData(this.exportFunction);
    props.exportsBucket.grantPut(this.exportFunction);
    props.exportsBucket.grantRead(this.exportFunction);

    this.exportFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 4. Collect Function
    this.collectFunction = new NodejsFunction(this, 'CollectFunction', {
      functionName: `tdnet-collect-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/collect/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.collect.timeout),
      memorySize: envConfig.collect.memorySize,
      environment: {
        COLLECTOR_FUNCTION_NAME: this.collectorFunction.functionName,
        LOG_LEVEL: envConfig.collect.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    this.collectorFunction.grantInvoke(this.collectFunction);

    this.collectFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 5. Collect Status Function
    this.collectStatusFunction = new NodejsFunction(this, 'CollectStatusFunction', {
      functionName: `tdnet-collect-status-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/collect-status/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.collectStatus.timeout),
      memorySize: envConfig.collectStatus.memorySize,
      environment: {
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        LOG_LEVEL: envConfig.collectStatus.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.executionsTable.grantReadData(this.collectStatusFunction);

    this.collectStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 6. Export Status Function
    this.exportStatusFunction = new NodejsFunction(this, 'ExportStatusFunction', {
      functionName: `tdnet-export-status-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/api/export-status/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.exportStatus.timeout),
      memorySize: envConfig.exportStatus.memorySize,
      environment: {
        EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
        LOG_LEVEL: envConfig.exportStatus.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.exportStatusTable.grantReadData(this.exportStatusFunction);

    this.exportStatusFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 7. PDF Download Function
    this.pdfDownloadFunction = new NodejsFunction(this, 'PdfDownloadFunction', {
      functionName: `tdnet-pdf-download-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/api/pdf-download/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.pdfDownload.timeout),
      memorySize: envConfig.pdfDownload.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.pdfDownload.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.disclosuresTable.grantReadData(this.pdfDownloadFunction);
    props.pdfsBucket.grantRead(this.pdfDownloadFunction);

    this.pdfDownloadFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 8. Health Function
    this.healthFunction = new NodejsFunction(this, 'HealthFunction', {
      functionName: `tdnet-health-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/health/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.health.timeout),
      memorySize: envConfig.health.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        S3_BUCKET_NAME: props.pdfsBucket.bucketName,
        LOG_LEVEL: envConfig.health.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    // DynamoDBテーブルのDescribe権限を付与
    this.healthFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['dynamodb:DescribeTable'],
        resources: [props.disclosuresTable.tableArn],
      })
    );

    // S3バケットのHeadBucket権限を付与
    this.healthFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['s3:HeadBucket'],
        resources: [props.pdfsBucket.bucketArn],
      })
    );

    this.healthFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
          },
        },
      })
    );

    // 9. Stats Function
    this.statsFunction = new NodejsFunction(this, 'StatsFunction', {
      functionName: `tdnet-stats-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/lambda/stats/handler.ts',
      handler: 'handler',
      timeout: cdk.Duration.seconds(envConfig.stats.timeout),
      memorySize: envConfig.stats.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        LOG_LEVEL: envConfig.stats.logLevel,
        ENVIRONMENT: env,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    props.disclosuresTable.grantReadData(this.statsFunction);

    this.statsFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'TDnet',
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

    new cdk.CfnOutput(this, 'HealthFunctionArn', {
      value: this.healthFunction.functionArn,
      exportName: `TdnetHealthFunctionArn-${env}`,
    });

    new cdk.CfnOutput(this, 'StatsFunctionArn', {
      value: this.statsFunction.functionArn,
      exportName: `TdnetStatsFunctionArn-${env}`,
    });
  }
}

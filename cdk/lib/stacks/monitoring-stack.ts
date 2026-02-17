import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';
import { CloudWatchAlarms } from '../constructs/cloudwatch-alarms';
import { CloudWatchDashboard } from '../constructs/cloudwatch-dashboard';
import { CloudTrailConstruct } from '../constructs/cloudtrail';

/**
 * Monitoring Stack - CloudWatch Alarms, Dashboard, CloudTrail
 * 変更頻度: 低（月1回以下）
 * 依存: Foundation Stack, Compute Stack, API Stack
 */
export interface TdnetMonitoringStackProps extends cdk.StackProps {
  environment: Environment;
  lambdaFunctions: {
    collector: lambda.IFunction;
    query: lambda.IFunction;
    export: lambda.IFunction;
    collect: lambda.IFunction;
    collectStatus: lambda.IFunction;
    exportStatus: lambda.IFunction;
    pdfDownload: lambda.IFunction;
    health: lambda.IFunction;
    stats: lambda.IFunction;
  };
  dynamodbTables: {
    disclosures: dynamodb.ITable;
    executions: dynamodb.ITable;
    exportStatus: dynamodb.ITable;
  };
  s3Buckets: {
    pdfs: s3.IBucket;
    exports: s3.IBucket;
    cloudtrailLogs: s3.IBucket;
  };
  api: apigateway.IRestApi;
  alertTopic: sns.ITopic;
}

export class TdnetMonitoringStack extends cdk.Stack {
  public readonly alarms: CloudWatchAlarms;
  public readonly dashboard: CloudWatchDashboard;

  constructor(scope: Construct, id: string, props: TdnetMonitoringStackProps) {
    super(scope, id, props);

    const env = props.environment;

    // ========================================
    // CloudWatch Logs - Log Groups with Retention
    // ========================================

    // Lambda関数のログ保持期間を設定
    const logRetentionConfig = {
      collector: env === 'prod' ? logs.RetentionDays.THREE_MONTHS : logs.RetentionDays.ONE_WEEK,
      other: env === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
    };

    const removalPolicy = env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

    // Collector Lambda（スクレイピング処理、長期保持）
    new logs.LogGroup(this, 'CollectorLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.collector.functionName}`,
      retention: logRetentionConfig.collector,
      removalPolicy,
    });

    // Query Lambda
    new logs.LogGroup(this, 'QueryLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.query.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // Export Lambda
    new logs.LogGroup(this, 'ExportLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.export.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // Collect Lambda
    new logs.LogGroup(this, 'CollectLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.collect.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // Collect Status Lambda
    new logs.LogGroup(this, 'CollectStatusLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.collectStatus.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // Export Status Lambda
    new logs.LogGroup(this, 'ExportStatusLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.exportStatus.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // PDF Download Lambda
    new logs.LogGroup(this, 'PdfDownloadLogGroup', {
      logGroupName: `/aws/lambda/${props.lambdaFunctions.pdfDownload.functionName}`,
      retention: logRetentionConfig.other,
      removalPolicy,
    });

    // Health Lambda - 既存のLogGroupを使用（CDKで管理しない）
    // /aws/lambda/${props.lambdaFunctions.health.functionName}

    // Stats Lambda - 既存のLogGroupを使用（CDKで管理しない）
    // /aws/lambda/${props.lambdaFunctions.stats.functionName}

    // ========================================
    // CloudWatch Alarms
    // ========================================

    const allLambdaFunctions = [
      props.lambdaFunctions.collector,
      props.lambdaFunctions.query,
      props.lambdaFunctions.export,
      props.lambdaFunctions.collect,
      props.lambdaFunctions.collectStatus,
      props.lambdaFunctions.exportStatus,
      props.lambdaFunctions.pdfDownload,
    ];

    this.alarms = new CloudWatchAlarms(this, 'CloudWatchAlarms', {
      lambdaFunctions: allLambdaFunctions,
      environment: env,
      existingAlertTopic: props.alertTopic,
      errorRateThreshold: 10,
      durationThreshold: 840,
      collectionSuccessRateThreshold: 95,
    });

    // ========================================
    // CloudWatch Dashboard
    // ========================================

    this.dashboard = new CloudWatchDashboard(this, 'CloudWatchDashboard', {
      environment: env,
      lambdaFunctions: props.lambdaFunctions,
      dynamodbTables: props.dynamodbTables,
      s3Buckets: {
        pdfs: props.s3Buckets.pdfs,
        exports: props.s3Buckets.exports,
      },
      apiGateway: props.api,
    });

    // ========================================
    // CloudTrail
    // ========================================

    new CloudTrailConstruct(this, 'CloudTrail', {
      logsBucket: props.s3Buckets.cloudtrailLogs,
      environment: env,
      pdfsBucket: props.s3Buckets.pdfs,
      dynamodbTables: [
        props.dynamodbTables.disclosures,
        props.dynamodbTables.executions,
        props.dynamodbTables.exportStatus,
      ],
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'CloudWatchAlarmsCount', {
      value: this.alarms.alarms.length.toString(),
      description: 'Number of CloudWatch Alarms created',
    });

    new cdk.CfnOutput(this, 'DashboardName', {
      value: this.dashboard.dashboard.dashboardName,
      exportName: `TdnetDashboardName-${env}`,
    });
  }
}

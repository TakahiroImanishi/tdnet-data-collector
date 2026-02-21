import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

/**
 * CloudWatch Dashboard Construct Properties
 */
export interface CloudWatchDashboardProps {
  /**
   * Environment name (dev, staging, prod)
   */
  environment: string;

  /**
   * Lambda functions to monitor
   */
  lambdaFunctions: {
    collector: lambda.IFunction;
    query: lambda.IFunction;
    export: lambda.IFunction;
    collect: lambda.IFunction;
    collectStatus: lambda.IFunction;
    exportStatus: lambda.IFunction;
    pdfDownload: lambda.IFunction;
  };

  /**
   * DynamoDB tables to monitor
   */
  dynamodbTables: {
    disclosures: dynamodb.ITable;
    executions: dynamodb.ITable;
    exportStatus: dynamodb.ITable;
  };

  /**
   * S3 buckets to monitor
   */
  s3Buckets: {
    pdfs: s3.IBucket;
    exports: s3.IBucket;
  };

  /**
   * API Gateway to monitor
   */
  apiGateway: apigateway.IRestApi;
}

/**
 * CloudWatch Dashboard Construct
 * 
 * TDnet Data Collectorの監視ダッシュボードを作成します。
 * 以下のメトリクスを可視化：
 * - Lambda実行メトリクス（Invocations、Errors、Duration）
 * - DynamoDB読み書きメトリクス
 * - ビジネスメトリクス（日次収集件数、失敗件数）
 * - API Gatewayメトリクス
 * - S3ストレージメトリクス
 */
export class CloudWatchDashboard extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: CloudWatchDashboardProps) {
    super(scope, id);

    // ダッシュボード作成
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `tdnet-collector-${props.environment}`,
    });

    // Lambda実行メトリクスウィジェット
    this.addLambdaMetricsWidgets(props);

    // DynamoDBメトリクスウィジェット
    this.addDynamoDBMetricsWidgets(props);

    // ビジネスメトリクスウィジェット
    this.addBusinessMetricsWidgets(props);

    // API Gatewayメトリクスウィジェット
    this.addApiGatewayMetricsWidgets(props);

    // S3ストレージメトリクスウィジェット
    this.addS3MetricsWidgets(props);
  }

  /**
   * Lambda実行メトリクスウィジェットを追加
   */
  private addLambdaMetricsWidgets(props: CloudWatchDashboardProps): void {
    const { lambdaFunctions } = props;

    // Lambda Invocations
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [
          lambdaFunctions.collector.metricInvocations({ label: 'Collector' }),
          lambdaFunctions.query.metricInvocations({ label: 'Query' }),
          lambdaFunctions.export.metricInvocations({ label: 'Export' }),
          lambdaFunctions.collect.metricInvocations({ label: 'Collect' }),
          lambdaFunctions.collectStatus.metricInvocations({ label: 'CollectStatus' }),
          lambdaFunctions.exportStatus.metricInvocations({ label: 'ExportStatus' }),
          lambdaFunctions.pdfDownload.metricInvocations({ label: 'PdfDownload' }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      })
    );

    // Lambda Errors
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [
          lambdaFunctions.collector.metricErrors({ label: 'Collector' }),
          lambdaFunctions.query.metricErrors({ label: 'Query' }),
          lambdaFunctions.export.metricErrors({ label: 'Export' }),
          lambdaFunctions.collect.metricErrors({ label: 'Collect' }),
          lambdaFunctions.collectStatus.metricErrors({ label: 'CollectStatus' }),
          lambdaFunctions.exportStatus.metricErrors({ label: 'ExportStatus' }),
          lambdaFunctions.pdfDownload.metricErrors({ label: 'PdfDownload' }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      })
    );

    // Lambda Duration
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (ms)',
        left: [
          lambdaFunctions.collector.metricDuration({ label: 'Collector' }),
          lambdaFunctions.query.metricDuration({ label: 'Query' }),
          lambdaFunctions.export.metricDuration({ label: 'Export' }),
          lambdaFunctions.collect.metricDuration({ label: 'Collect' }),
          lambdaFunctions.collectStatus.metricDuration({ label: 'CollectStatus' }),
          lambdaFunctions.exportStatus.metricDuration({ label: 'ExportStatus' }),
          lambdaFunctions.pdfDownload.metricDuration({ label: 'PdfDownload' }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      })
    );

    // Lambda Throttles
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        left: [
          lambdaFunctions.collector.metricThrottles({ label: 'Collector' }),
          lambdaFunctions.query.metricThrottles({ label: 'Query' }),
          lambdaFunctions.export.metricThrottles({ label: 'Export' }),
          lambdaFunctions.collect.metricThrottles({ label: 'Collect' }),
          lambdaFunctions.collectStatus.metricThrottles({ label: 'CollectStatus' }),
          lambdaFunctions.exportStatus.metricThrottles({ label: 'ExportStatus' }),
          lambdaFunctions.pdfDownload.metricThrottles({ label: 'PdfDownload' }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      })
    );
  }

  /**
   * DynamoDBメトリクスウィジェットを追加
   */
  private addDynamoDBMetricsWidgets(props: CloudWatchDashboardProps): void {
    const { dynamodbTables } = props;

    // DynamoDB Read/Write Capacity
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Consumed Capacity Units',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.disclosures.tableName },
            statistic: 'Sum',
            label: 'Disclosures Read',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.executions.tableName },
            statistic: 'Sum',
            label: 'Executions Read',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.exportStatus.tableName },
            statistic: 'Sum',
            label: 'ExportStatus Read',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.disclosures.tableName },
            statistic: 'Sum',
            label: 'Disclosures Write',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.executions.tableName },
            statistic: 'Sum',
            label: 'Executions Write',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: dynamodbTables.exportStatus.tableName },
            statistic: 'Sum',
            label: 'ExportStatus Write',
          }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
      })
    );

    // DynamoDB Errors
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: { TableName: dynamodbTables.disclosures.tableName },
            statistic: 'Sum',
            label: 'Disclosures UserErrors',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'SystemErrors',
            dimensionsMap: { TableName: dynamodbTables.disclosures.tableName },
            statistic: 'Sum',
            label: 'Disclosures SystemErrors',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: { TableName: dynamodbTables.executions.tableName },
            statistic: 'Sum',
            label: 'Executions UserErrors',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'SystemErrors',
            dimensionsMap: { TableName: dynamodbTables.executions.tableName },
            statistic: 'Sum',
            label: 'Executions SystemErrors',
          }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
      })
    );

    // DynamoDB Throttles
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Throttled Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ThrottledRequests',
            dimensionsMap: { TableName: dynamodbTables.disclosures.tableName },
            statistic: 'Sum',
            label: 'Disclosures',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ThrottledRequests',
            dimensionsMap: { TableName: dynamodbTables.executions.tableName },
            statistic: 'Sum',
            label: 'Executions',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ThrottledRequests',
            dimensionsMap: { TableName: dynamodbTables.exportStatus.tableName },
            statistic: 'Sum',
            label: 'ExportStatus',
          }),
        ],
        width: 12,
        period: cdk.Duration.minutes(5),
      })
    );
  }

  /**
   * ビジネスメトリクスウィジェットを追加
   */
  private addBusinessMetricsWidgets(props: CloudWatchDashboardProps): void {
    const { environment } = props;

    // 日次収集件数
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Disclosures Collected (Daily)',
        left: [
          new cloudwatch.Metric({
            namespace: 'TDnet',
            metricName: 'DisclosuresCollected',
            dimensionsMap: { Environment: environment },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 12,
      })
    );

    // 収集失敗件数
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Disclosures Failed',
        left: [
          new cloudwatch.Metric({
            namespace: 'TDnet',
            metricName: 'DisclosuresFailed',
            dimensionsMap: { Environment: environment },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 12,
      })
    );

    // 収集成功率
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Collection Success Rate (%)',
        left: [
          new cloudwatch.MathExpression({
            expression: '(collected / (collected + failed)) * 100',
            usingMetrics: {
              collected: new cloudwatch.Metric({
                namespace: 'TDnet',
                metricName: 'DisclosuresCollected',
                dimensionsMap: { Environment: environment },
                statistic: 'Sum',
              }),
              failed: new cloudwatch.Metric({
                namespace: 'TDnet',
                metricName: 'DisclosuresFailed',
                dimensionsMap: { Environment: environment },
                statistic: 'Sum',
              }),
            },
            label: 'Success Rate',
            period: cdk.Duration.hours(1),
          }),
        ],
        width: 12,
        leftYAxis: {
          min: 0,
          max: 100,
        },
      })
    );
  }

  /**
   * API Gatewayメトリクスウィジェットを追加
   */
  private addApiGatewayMetricsWidgets(_props: CloudWatchDashboardProps): void {
    // Note: API Gateway metrics are currently commented out due to type errors
    // TODO: Fix API Gateway metric types
    // const { apiGateway } = _props;

    // API Gateway Requests
    this.dashboard.addWidgets(
      // API Gateway Requests - 型エラーのためコメントアウト
      // new cloudwatch.GraphWidget({
      //   title: 'API Gateway Requests',
      //   left: [
      //     apiGateway.metricCount({ label: 'Total Requests' }),
      //   ],
      //   width: 12,
      //   period: cdk.Duration.minutes(5),
      //   statistic: 'Sum',
      // })
    );

    // API Gateway Errors - 型エラーのためコメントアウト
    // this.dashboard.addWidgets(
    //   new cloudwatch.GraphWidget({
    //     title: 'API Gateway Errors',
    //     left: [
    //       apiGateway.metricClientError({ label: '4XX Errors' }),
    //       apiGateway.metricServerError({ label: '5XX Errors' }),
    //     ],
    //     width: 12,
    //     period: cdk.Duration.minutes(5),
    //     statistic: 'Sum',
    //   })
    // );

    // API Gateway Latency - 型エラーのためコメントアウト
    // this.dashboard.addWidgets(
    //   new cloudwatch.GraphWidget({
    //     title: 'API Gateway Latency (ms)',
    //     left: [
    //       apiGateway.metricLatency({ label: 'Latency', statistic: 'Average' }),
    //       apiGateway.metricIntegrationLatency({ label: 'Integration Latency', statistic: 'Average' }),
    //     ],
    //     width: 12,
    //     period: cdk.Duration.minutes(5),
    //   })
    // );
  }

  /**
   * S3ストレージメトリクスウィジェットを追加
   */
  private addS3MetricsWidgets(props: CloudWatchDashboardProps): void {
    const { s3Buckets } = props;

    // S3 Bucket Size
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'S3 Bucket Size (Bytes)',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: s3Buckets.pdfs.bucketName,
              StorageType: 'StandardStorage',
            },
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'PDFs Bucket',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'BucketSizeBytes',
            dimensionsMap: {
              BucketName: s3Buckets.exports.bucketName,
              StorageType: 'StandardStorage',
            },
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Exports Bucket',
          }),
        ],
        width: 12,
      })
    );

    // S3 Number of Objects
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'S3 Number of Objects',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'NumberOfObjects',
            dimensionsMap: {
              BucketName: s3Buckets.pdfs.bucketName,
              StorageType: 'AllStorageTypes',
            },
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'PDFs Bucket',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'NumberOfObjects',
            dimensionsMap: {
              BucketName: s3Buckets.exports.bucketName,
              StorageType: 'AllStorageTypes',
            },
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Exports Bucket',
          }),
        ],
        width: 12,
      })
    );

    // S3 Requests
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'S3 Requests',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'AllRequests',
            dimensionsMap: {
              BucketName: s3Buckets.pdfs.bucketName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'PDFs Bucket',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/S3',
            metricName: 'AllRequests',
            dimensionsMap: {
              BucketName: s3Buckets.exports.bucketName,
            },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Exports Bucket',
          }),
        ],
        width: 12,
      })
    );
  }
}

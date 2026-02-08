/**
 * Lambda Collector Construct
 * 
 * This construct creates the TDnet Collector Lambda function with environment-specific configuration.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaEnvironmentConfig, Environment } from '../config/environment-config';

/**
 * Properties for Lambda Collector Construct
 */
export interface LambdaCollectorProps {
  /**
   * Environment name (dev or prod)
   */
  environment: Environment;

  /**
   * Lambda function configuration
   */
  config: LambdaEnvironmentConfig;

  /**
   * DynamoDB disclosures table
   */
  disclosuresTable: dynamodb.ITable;

  /**
   * DynamoDB executions table
   */
  executionsTable: dynamodb.ITable;

  /**
   * S3 PDFs bucket
   */
  pdfsBucket: s3.IBucket;
}

/**
 * Lambda Collector Construct
 */
export class LambdaCollector extends Construct {
  /**
   * The Lambda function
   */
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaCollectorProps) {
    super(scope, id);

    // Create Lambda function
    this.function = new lambda.Function(this, 'Function', {
      functionName: 'tdnet-collector',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/collector'),
      timeout: cdk.Duration.seconds(props.config.timeout),
      memorySize: props.config.memorySize,
      environment: {
        DYNAMODB_TABLE: props.disclosuresTable.tableName,
        DYNAMODB_EXECUTIONS_TABLE: props.executionsTable.tableName,
        S3_BUCKET: props.pdfsBucket.bucketName,
        LOG_LEVEL: props.config.logLevel,
        ENVIRONMENT: props.environment,
        NODE_OPTIONS: '--enable-source-maps',
      },
      reservedConcurrentExecutions: 1, // 同時実行数を1に制限（レート制限のため）
    });

    // Grant IAM permissions
    // DynamoDB: 両テーブルへの読み書き権限
    props.disclosuresTable.grantReadWriteData(this.function);
    props.executionsTable.grantReadWriteData(this.function);

    // S3: PDFバケットへの書き込み権限
    props.pdfsBucket.grantPut(this.function);
    props.pdfsBucket.grantRead(this.function);

    // CloudWatch Metrics: カスタムメトリクス送信権限
    this.function.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
      })
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'FunctionName', {
      value: this.function.functionName,
      description: 'Lambda Collector function name',
      exportName: 'TdnetCollectorFunctionName',
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda Collector function ARN',
      exportName: 'TdnetCollectorFunctionArn',
    });
  }
}

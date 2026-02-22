/**
 * Lambda Export Construct
 * 
 * This construct creates the TDnet Export Lambda function with environment-specific configuration.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { LambdaEnvironmentConfig, Environment } from '../config/environment-config';

/**
 * Properties for Lambda Export Construct
 */
export interface LambdaExportProps {
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
   * DynamoDB export status table
   */
  exportStatusTable: dynamodb.ITable;

  /**
   * S3 exports bucket
   */
  exportsBucket: s3.IBucket;

  /**
   * API Key secret
   */
  apiKeySecret: secretsmanager.ISecret;
}

/**
 * Lambda Export Construct
 */
export class LambdaExport extends Construct {
  /**
   * The Lambda function
   */
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaExportProps) {
    super(scope, id);

    // Create Lambda function
    this.function = new lambda.Function(this, 'Function', {
      functionName: 'tdnet-export',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/src/lambda/export'),
      timeout: cdk.Duration.seconds(props.config.timeout),
      memorySize: props.config.memorySize,
      environment: {
        DYNAMODB_TABLE_NAME: props.disclosuresTable.tableName,
        EXPORT_STATUS_TABLE_NAME: props.exportStatusTable.tableName,
        EXPORT_BUCKET_NAME: props.exportsBucket.bucketName,
        API_KEY_SECRET_ARN: props.apiKeySecret.secretArn,
        LOG_LEVEL: props.config.logLevel,
        ENVIRONMENT: props.environment,
        NODE_OPTIONS: '--enable-source-maps',
      },
      // X-Rayトレーシング有効化
      tracing: lambda.Tracing.ACTIVE,
    });

    // Grant IAM permissions
    // DynamoDB: disclosuresテーブルへの読み取り権限
    props.disclosuresTable.grantReadData(this.function);

    // DynamoDB: exportStatusテーブルへの読み書き権限
    props.exportStatusTable.grantReadWriteData(this.function);

    // S3: exportsバケットへの書き込み権限
    props.exportsBucket.grantPut(this.function);
    props.exportsBucket.grantRead(this.function);

    // Secrets Manager: APIキー読み取り権限
    props.apiKeySecret.grantRead(this.function);

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
      description: 'Lambda Export function name',
      exportName: 'TdnetExportFunctionName',
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda Export function ARN',
      exportName: 'TdnetExportFunctionArn',
    });
  }
}

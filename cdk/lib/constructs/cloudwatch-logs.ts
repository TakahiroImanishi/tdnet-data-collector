/**
 * CloudWatch Logs Construct
 * 
 * This construct configures CloudWatch Logs for Lambda functions with environment-specific
 * retention periods to optimize costs and comply with logging requirements.
 * 
 * Retention Periods:
 * - Production: 90 days (3 months) - 要件6.3準拠
 * - Development: 7 days (1 week) - コスト最適化
 */

import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';

/**
 * Properties for CloudWatch Logs Construct
 */
export interface CloudWatchLogsProps {
  /**
   * Environment name (dev or prod)
   */
  environment: Environment;
}

/**
 * CloudWatch Logs Construct
 * 
 * Provides centralized log configuration for all Lambda functions
 */
export class CloudWatchLogs extends Construct {
  /**
   * Log retention period for the environment
   */
  public readonly retentionDays: logs.RetentionDays;

  /**
   * Removal policy for log groups
   */
  public readonly removalPolicy: cdk.RemovalPolicy;

  constructor(scope: Construct, id: string, props: CloudWatchLogsProps) {
    super(scope, id);

    // 環境ごとのログ保持期間を設定
    if (props.environment === 'prod') {
      // 本番環境: 3ヶ月（90日）
      this.retentionDays = logs.RetentionDays.THREE_MONTHS;
      // 本番環境: スタック削除時もログを保持
      this.removalPolicy = cdk.RemovalPolicy.RETAIN;
    } else {
      // 開発環境: 1週間（7日）
      this.retentionDays = logs.RetentionDays.ONE_WEEK;
      // 開発環境: スタック削除時にログも削除
      this.removalPolicy = cdk.RemovalPolicy.DESTROY;
    }
  }

  /**
   * Configure CloudWatch Logs for a Lambda function
   * 
   * @param lambdaFunction - Lambda function to configure
   * @param logGroupName - Optional custom log group name (defaults to /aws/lambda/{functionName})
   * @returns Created log group
   */
  public configureForLambda(
    lambdaFunction: lambda.Function,
    logGroupName?: string
  ): logs.LogGroup {
    const logGroup = new logs.LogGroup(this, `${lambdaFunction.node.id}LogGroup`, {
      logGroupName: logGroupName || `/aws/lambda/${lambdaFunction.functionName}`,
      retention: this.retentionDays,
      removalPolicy: this.removalPolicy,
    });

    // CloudFormation Output
    new cdk.CfnOutput(this, `${lambdaFunction.node.id}LogGroupName`, {
      value: logGroup.logGroupName,
      description: `Log group for ${lambdaFunction.functionName}`,
      exportName: `${lambdaFunction.functionName}-LogGroupName`,
    });

    return logGroup;
  }

  /**
   * Configure CloudWatch Logs for multiple Lambda functions
   * 
   * @param lambdaFunctions - Array of Lambda functions to configure
   * @returns Array of created log groups
   */
  public configureForLambdas(lambdaFunctions: lambda.Function[]): logs.LogGroup[] {
    return lambdaFunctions.map((fn) => this.configureForLambda(fn));
  }

  /**
   * Get retention days as number (for testing/validation)
   * 
   * @returns Number of days
   */
  public getRetentionDaysAsNumber(): number {
    switch (this.retentionDays) {
      case logs.RetentionDays.ONE_WEEK:
        return 7;
      case logs.RetentionDays.THREE_MONTHS:
        return 90;
      default:
        throw new Error(`Unexpected retention days: ${this.retentionDays}`);
    }
  }
}

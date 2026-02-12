/**
 * Lambda DLQ Construct
 * 
 * This construct creates a Dead Letter Queue (DLQ) for Lambda functions
 * and a DLQ processor Lambda to handle failed messages.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';

/**
 * Properties for Lambda DLQ Construct
 */
export interface LambdaDLQProps {
  /**
   * Environment name (dev or prod)
   */
  environment: Environment;

  /**
   * SNS topic for alerts
   */
  alertTopic: sns.ITopic;

  /**
   * Queue name prefix
   */
  queueNamePrefix?: string;
}

/**
 * Lambda DLQ Construct
 */
export class LambdaDLQ extends Construct {
  /**
   * The DLQ queue
   */
  public readonly queue: sqs.Queue;

  /**
   * The DLQ processor Lambda function
   */
  public readonly processor: lambda.Function;

  /**
   * CloudWatch alarm for DLQ messages
   */
  public readonly alarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: LambdaDLQProps) {
    super(scope, id);

    const queueName = `${props.queueNamePrefix || 'tdnet'}-collector-dlq-${props.environment}`;

    // Create DLQ
    this.queue = new sqs.Queue(this, 'Queue', {
      queueName,
      retentionPeriod: cdk.Duration.days(14),
      visibilityTimeout: cdk.Duration.minutes(5),
    });

    // Create DLQ processor Lambda
    this.processor = new lambda.Function(this, 'Processor', {
      functionName: `tdnet-dlq-processor-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('dist/src/lambda/dlq-processor'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        ALERT_TOPIC_ARN: props.alertTopic.topicArn,
        LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
        ENVIRONMENT: props.environment,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // Add SQS event source to DLQ processor
    this.processor.addEventSource(new lambdaEventSources.SqsEventSource(this.queue, {
      batchSize: 10,
    }));

    // Grant permissions
    this.queue.grantConsumeMessages(this.processor);
    props.alertTopic.grantPublish(this.processor);

    // CloudWatch Logs permissions
    this.processor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: ['*'],
      })
    );

    // Create CloudWatch Alarm for DLQ messages
    this.alarm = new cloudwatch.Alarm(this, 'Alarm', {
      alarmName: `tdnet-dlq-messages-${props.environment}`,
      alarmDescription: 'Alert when messages are sent to DLQ',
      metric: this.queue.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add SNS action to alarm
    this.alarm.addAlarmAction(new cloudwatchActions.SnsAction(props.alertTopic));

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'QueueUrl', {
      value: this.queue.queueUrl,
      description: 'DLQ URL',
      exportName: `TdnetDLQUrl-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'QueueArn', {
      value: this.queue.queueArn,
      description: 'DLQ ARN',
      exportName: `TdnetDLQArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'ProcessorFunctionName', {
      value: this.processor.functionName,
      description: 'DLQ Processor function name',
      exportName: `TdnetDLQProcessorFunctionName-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'AlarmName', {
      value: this.alarm.alarmName,
      description: 'DLQ Alarm name',
      exportName: `TdnetDLQAlarmName-${props.environment}`,
    });
  }
}

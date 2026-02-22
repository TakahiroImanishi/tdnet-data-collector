import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

/**
 * CloudWatch Alarms Construct Properties
 */
export interface CloudWatchAlarmsProps {
  /**
   * Lambda関数のリスト（監視対象）
   */
  lambdaFunctions: lambda.IFunction[];

  /**
   * 環境名（dev, staging, prod）
   */
  environment: string;

  /**
   * 既存のSNS Topic（オプション）
   * 指定された場合は新規作成せず、既存のトピックを使用
   */
  existingAlertTopic?: sns.ITopic;

  /**
   * アラート通知先メールアドレス（オプション）
   */
  alertEmail?: string;

  /**
   * Lambda Error Rate閾値（デフォルト: 10%）
   */
  errorRateThreshold?: number;

  /**
   * Lambda Duration閾値（秒、デフォルト: 600秒 = 10分）
   */
  durationThreshold?: number;

  /**
   * CollectionSuccessRate閾値（デフォルト: 95%）
   */
  collectionSuccessRateThreshold?: number;

  /**
   * DLQキュー（オプション）
   * 指定された場合、DLQメッセージ数のアラームを作成
   */
  dlqQueue?: sqs.IQueue;

  /**
   * DynamoDBテーブル（オプション）
   * 指定された場合、DynamoDBアラームを作成
   */
  dynamodbTables?: {
    disclosures?: dynamodb.ITable;
    executions?: dynamodb.ITable;
    exportStatus?: dynamodb.ITable;
  };

  /**
   * API Gateway（オプション）
   * 指定された場合、API Gatewayアラームを作成
   */
  apiGateway?: apigateway.IRestApi;
}

/**
 * CloudWatch Alarms Construct
 * 
 * Lambda関数とシステム全体の監視アラームを設定します。
 * 
 * 設定されるアラーム:
 * - Lambda Error Rate > 10% → Critical
 * - Lambda Duration > 14分 → Warning
 * - CollectionSuccessRate < 95% → Warning
 * - SNS Topicへの通知設定
 */
export class CloudWatchAlarms extends Construct {
  /**
   * SNS Topic（アラート通知用）
   */
  public readonly alertTopic: sns.ITopic;

  /**
   * 作成されたアラームのリスト
   */
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: CloudWatchAlarmsProps) {
    super(scope, id);

    // デフォルト値の設定
    const errorRateThreshold = props.errorRateThreshold ?? 10; // 10%
    const durationThreshold = props.durationThreshold ?? 600; // 10分 = 600秒
    const collectionSuccessRateThreshold = props.collectionSuccessRateThreshold ?? 95; // 95%

    // ========================================
    // SNS Topic作成（アラート通知用）
    // ========================================
    if (props.existingAlertTopic) {
      // 既存のSNS Topicを使用
      this.alertTopic = props.existingAlertTopic;
    } else {
      // 新規にSNS Topicを作成
      this.alertTopic = new sns.Topic(this, 'AlertTopic', {
        topicName: `tdnet-alerts-${props.environment}`,
        displayName: `TDnet Data Collector Alerts (${props.environment})`,
      });
    }

    // メール通知の追加（オプション）
    if (props.alertEmail) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(props.alertEmail)
      );
    }

    // ========================================
    // Lambda関数ごとのアラーム設定
    // ========================================
    props.lambdaFunctions.forEach((lambdaFunction, index) => {
      const functionName = lambdaFunction.functionName;
      // CDK IDには静的な値を使用（トークンを含めない）
      const alarmIdPrefix = `LambdaFunction${index}`;

      // 1. Lambda Error Rate アラーム（Warning - 5%）
      const errorRateWarningAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}ErrorRateWarningAlarm`, {
        alarmName: `${functionName}-error-rate-warning-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} のエラー率が 5% を超えました（警告）`,
        metric: this.createErrorRateMetric(lambdaFunction),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorRateWarningAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(errorRateWarningAlarm);

      // 1-2. Lambda Error Rate アラーム（Critical - 10%）
      const errorRateCriticalAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}ErrorRateCriticalAlarm`, {
        alarmName: `${functionName}-error-rate-critical-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} のエラー率が ${errorRateThreshold}% を超えました（重大）`,
        metric: this.createErrorRateMetric(lambdaFunction),
        threshold: errorRateThreshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      errorRateCriticalAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(errorRateCriticalAlarm);

      // 2. Lambda Duration アラーム（Warning - 10分）
      const durationAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}DurationAlarm`, {
        alarmName: `${functionName}-duration-warning-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} の実行時間が ${durationThreshold} 秒を超えました（警告）`,
        metric: lambdaFunction.metricDuration({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: durationThreshold * 1000, // ミリ秒に変換
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(durationAlarm);

      // 2-2. Lambda Duration アラーム（Critical - 13分）
      const durationCriticalAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}DurationCriticalAlarm`, {
        alarmName: `${functionName}-duration-critical-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} の実行時間が 780 秒を超えました（重大）`,
        metric: lambdaFunction.metricDuration({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 780 * 1000, // 13分 = 780秒をミリ秒に変換
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      durationCriticalAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(durationCriticalAlarm);

      // 3. Lambda Throttles アラーム（Warning - > 0）
      const throttleWarningAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}ThrottleWarningAlarm`, {
        alarmName: `${functionName}-throttles-warning-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} でスロットリングが発生しました（警告）`,
        metric: lambdaFunction.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleWarningAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(throttleWarningAlarm);

      // 3-2. Lambda Throttles アラーム（Critical - > 5）
      const throttleCriticalAlarm = new cloudwatch.Alarm(this, `${alarmIdPrefix}ThrottleCriticalAlarm`, {
        alarmName: `${functionName}-throttles-critical-${props.environment}`,
        alarmDescription: `Lambda関数 ${functionName} でスロットリングが5回以上発生しました（重大）`,
        metric: lambdaFunction.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      throttleCriticalAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(throttleCriticalAlarm);
    });

    // ========================================
    // カスタムメトリクスのアラーム
    // ========================================

    // 4. CollectionSuccessRate アラーム（Warning）
    const collectionSuccessRateAlarm = new cloudwatch.Alarm(
      this,
      'CollectionSuccessRateAlarm',
      {
        alarmName: `tdnet-collection-success-rate-${props.environment}`,
        alarmDescription: `収集成功率が ${collectionSuccessRateThreshold}% を下回りました`,
        metric: this.createCollectionSuccessRateMetric(props.environment),
        threshold: collectionSuccessRateThreshold,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    collectionSuccessRateAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alertTopic)
    );
    this.alarms.push(collectionSuccessRateAlarm);

    // 5. データ収集停止アラーム（Critical）
    const noDataAlarm = new cloudwatch.Alarm(this, 'NoDataCollectedAlarm', {
      alarmName: `tdnet-no-data-collected-${props.environment}`,
      alarmDescription: '24時間データ収集がありません',
      metric: new cloudwatch.Metric({
        namespace: 'TDnet',
        metricName: 'DisclosuresCollected',
        statistic: 'Sum',
        period: cdk.Duration.hours(24),
        dimensionsMap: {
          Environment: props.environment,
        },
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    noDataAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    this.alarms.push(noDataAlarm);

    // 6. 収集失敗アラーム（Warning）
    const collectionFailureAlarm = new cloudwatch.Alarm(this, 'CollectionFailureAlarm', {
      alarmName: `tdnet-collection-failures-${props.environment}`,
      alarmDescription: '24時間で10件以上の収集失敗が発生しました',
      metric: new cloudwatch.Metric({
        namespace: 'TDnet',
        metricName: 'DisclosuresFailed',
        statistic: 'Sum',
        period: cdk.Duration.hours(24),
        dimensionsMap: {
          Environment: props.environment,
        },
      }),
      threshold: 10,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    collectionFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
    this.alarms.push(collectionFailureAlarm);

    // ========================================
    // DLQアラーム（オプション）
    // ========================================
    if (props.dlqQueue) {
      // 7. DLQメッセージアラーム（Critical）
      const dlqAlarm = new cloudwatch.Alarm(this, 'DLQMessagesAlarm', {
        alarmName: `tdnet-dlq-messages-${props.environment}`,
        alarmDescription: 'DLQにメッセージが送信されました（Critical）',
        metric: props.dlqQueue.metricApproximateNumberOfMessagesVisible({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      dlqAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(dlqAlarm);
    }

    // ========================================
    // DynamoDBアラーム（オプション）
    // ========================================
    if (props.dynamodbTables) {
      const tables = [
        { name: 'Disclosures', table: props.dynamodbTables.disclosures },
        { name: 'Executions', table: props.dynamodbTables.executions },
        { name: 'ExportStatus', table: props.dynamodbTables.exportStatus },
      ];

      tables.forEach(({ name, table }, index) => {
        if (!table) return;

        // DynamoDB UserErrors アラーム
        const userErrorsAlarm = new cloudwatch.Alarm(this, `DynamoDB${name}UserErrorsAlarm`, {
          alarmName: `tdnet-dynamodb-${name.toLowerCase()}-user-errors-${props.environment}`,
          alarmDescription: `DynamoDB ${name}テーブルでUserErrorsが発生しました`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'UserErrors',
            dimensionsMap: { TableName: table.tableName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          threshold: 5,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        userErrorsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
        this.alarms.push(userErrorsAlarm);

        // DynamoDB SystemErrors アラーム
        const systemErrorsAlarm = new cloudwatch.Alarm(this, `DynamoDB${name}SystemErrorsAlarm`, {
          alarmName: `tdnet-dynamodb-${name.toLowerCase()}-system-errors-${props.environment}`,
          alarmDescription: `DynamoDB ${name}テーブルでSystemErrorsが発生しました`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'SystemErrors',
            dimensionsMap: { TableName: table.tableName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          threshold: 0,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        systemErrorsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
        this.alarms.push(systemErrorsAlarm);

        // DynamoDB ThrottledRequests アラーム
        const throttledRequestsAlarm = new cloudwatch.Alarm(this, `DynamoDB${name}ThrottledRequestsAlarm`, {
          alarmName: `tdnet-dynamodb-${name.toLowerCase()}-throttled-requests-${props.environment}`,
          alarmDescription: `DynamoDB ${name}テーブルでThrottledRequestsが発生しました`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ThrottledRequests',
            dimensionsMap: { TableName: table.tableName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          threshold: 0,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        throttledRequestsAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
        this.alarms.push(throttledRequestsAlarm);
      });
    }

    // ========================================
    // API Gatewayアラーム（オプション）
    // ========================================
    if (props.apiGateway) {
      // API Gateway 4XXError アラーム
      const api4xxErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway4XXErrorAlarm', {
        alarmName: `tdnet-api-gateway-4xx-error-${props.environment}`,
        alarmDescription: 'API Gatewayで4XXエラーが多発しています',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '4XXError',
          dimensionsMap: { ApiName: props.apiGateway.restApiName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      api4xxErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(api4xxErrorAlarm);

      // API Gateway 5XXError アラーム
      const api5xxErrorAlarm = new cloudwatch.Alarm(this, 'ApiGateway5XXErrorAlarm', {
        alarmName: `tdnet-api-gateway-5xx-error-${props.environment}`,
        alarmDescription: 'API Gatewayで5XXエラーが発生しました',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: { ApiName: props.apiGateway.restApiName },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      api5xxErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(api5xxErrorAlarm);

      // API Gateway Latency アラーム
      const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
        alarmName: `tdnet-api-gateway-latency-${props.environment}`,
        alarmDescription: 'API Gatewayのレイテンシが高くなっています',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: 'Latency',
          dimensionsMap: { ApiName: props.apiGateway.restApiName },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5000, // 5秒
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      apiLatencyAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alertTopic));
      this.alarms.push(apiLatencyAlarm);
    }

    // ========================================
    // CloudFormation Outputs
    // ========================================
    // Note: 既存のSNS Topicを使用する場合は、Outputsを作成しない
    if (!props.existingAlertTopic) {
      new cdk.CfnOutput(this, 'AlertTopicArn', {
        value: this.alertTopic.topicArn,
        description: 'SNS Topic ARN for alerts',
        exportName: `TdnetAlertTopicArn-${props.environment}`,
      });
    }

    new cdk.CfnOutput(this, 'AlarmCount', {
      value: this.alarms.length.toString(),
      description: 'Number of CloudWatch Alarms created',
    });
  }

  /**
   * Lambda Error Rateメトリクスを作成
   * 
   * Error Rate = (Errors / Invocations) * 100
   */
  private createErrorRateMetric(lambdaFunction: lambda.IFunction): cloudwatch.IMetric {
    const errors = lambdaFunction.metricErrors({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const invocations = lambdaFunction.metricInvocations({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Error Rate = (Errors / Invocations) * 100
    return new cloudwatch.MathExpression({
      expression: '(errors / invocations) * 100',
      usingMetrics: {
        errors,
        invocations,
      },
      label: 'Error Rate (%)',
      period: cdk.Duration.minutes(5),
    });
  }

  /**
   * CollectionSuccessRateメトリクスを作成
   * 
   * Success Rate = (DisclosuresCollected / (DisclosuresCollected + DisclosuresFailed)) * 100
   */
  private createCollectionSuccessRateMetric(environment: string): cloudwatch.IMetric {
    const collected = new cloudwatch.Metric({
      namespace: 'TDnet',
      metricName: 'DisclosuresCollected',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
      dimensionsMap: {
        Environment: environment,
      },
    });

    const failed = new cloudwatch.Metric({
      namespace: 'TDnet',
      metricName: 'DisclosuresFailed',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
      dimensionsMap: {
        Environment: environment,
      },
    });

    // Success Rate = (Collected / (Collected + Failed)) * 100
    return new cloudwatch.MathExpression({
      expression: '(collected / (collected + failed)) * 100',
      usingMetrics: {
        collected,
        failed,
      },
      label: 'Collection Success Rate (%)',
      period: cdk.Duration.hours(1),
    });
  }
}

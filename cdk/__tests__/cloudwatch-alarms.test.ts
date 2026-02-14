import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CloudWatchAlarms } from '../lib/constructs/cloudwatch-alarms';

describe('CloudWatchAlarms Construct', () => {
  let stack: cdk.Stack;
  let testLambdaFunction: lambda.Function;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // テスト用のLambda関数を作成
    testLambdaFunction = new lambda.Function(stack, 'TestFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      functionName: 'test-function',
    });
  });

  test('SNS Topicが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Topic', 1);

    template.hasResourceProperties('AWS::SNS::Topic', {
      DisplayName: 'TDnet Data Collector Alerts (test)',
      TopicName: 'tdnet-alerts-test',
    });
  });

  test('メール通知が設定されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      alertEmail: 'test@example.com',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::SNS::Subscription', 1);

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'test@example.com',
    });
  });

  test('Lambda Error Rateアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      errorRateThreshold: 10,
    });

    // Assert
    const template = Template.fromStack(stack);

    // Error Rateアラームが存在することを確認（AlarmNameとAlarmDescriptionはトークンなのでMatch.anyValue()を使用）
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(), // トークンを含むため
      AlarmDescription: Match.anyValue(), // トークンを含むため
      ComparisonOperator: 'GreaterThanThreshold',
      Threshold: 10,
      EvaluationPeriods: 1,
      TreatMissingData: 'notBreaching',
    });
  });

  test('Lambda Durationアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      durationThreshold: 840, // 14分 = 840秒
    });

    // Assert
    const template = Template.fromStack(stack);

    // Durationアラームが存在することを確認（AlarmNameとAlarmDescriptionはトークンなのでMatch.anyValue()を使用）
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(), // トークンを含むため
      AlarmDescription: Match.anyValue(), // トークンを含むため
      ComparisonOperator: 'GreaterThanThreshold',
      Threshold: 840000, // ミリ秒
      EvaluationPeriods: 2,
      TreatMissingData: 'notBreaching',
    });
  });

  test('Lambda Throttlesアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);

    // Throttlesアラームが存在することを確認（AlarmNameとAlarmDescriptionはトークンなのでMatch.anyValue()を使用）
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(), // トークンを含むため
      AlarmDescription: Match.anyValue(), // トークンを含むため
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      Threshold: 1,
      EvaluationPeriods: 1,
      TreatMissingData: 'notBreaching',
    });
  });

  test('CollectionSuccessRateアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      collectionSuccessRateThreshold: 95,
    });

    // Assert
    const template = Template.fromStack(stack);

    // CollectionSuccessRateアラームが存在することを確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-collection-success-rate-test',
      AlarmDescription: '収集成功率が 95% を下回りました',
      ComparisonOperator: 'LessThanThreshold',
      Threshold: 95,
      EvaluationPeriods: 1,
      TreatMissingData: 'notBreaching',
    });
  });

  test('NoDataCollectedアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);

    // NoDataCollectedアラームが存在することを確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-no-data-collected-test',
      AlarmDescription: '24時間データ収集がありません',
      ComparisonOperator: 'LessThanThreshold',
      Threshold: 1,
      EvaluationPeriods: 1,
      TreatMissingData: 'breaching',
    });
  });

  test('CollectionFailureアラームが作成されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);

    // CollectionFailureアラームが存在することを確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-collection-failures-test',
      AlarmDescription: '24時間で10件以上の収集失敗が発生しました',
      ComparisonOperator: 'GreaterThanThreshold',
      Threshold: 10,
      EvaluationPeriods: 1,
      TreatMissingData: 'notBreaching',
    });
  });

  test('複数のLambda関数に対してアラームが作成されること', () => {
    // Arrange
    const testLambdaFunction2 = new lambda.Function(stack, 'TestFunction2', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
      functionName: 'test-function-2',
    });

    // Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction, testLambdaFunction2],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);

    // 各Lambda関数に対して4つのアラーム（Error Rate, Duration Warning, Duration Critical, Throttles）が作成される
    // + カスタムメトリクスアラーム3つ（CollectionSuccessRate, NoData, CollectionFailure）
    // = 2 * 4 + 3 = 11個のアラーム
    template.resourceCountIs('AWS::CloudWatch::Alarm', 11);
  });

  test('すべてのアラームにSNSアクションが設定されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);

    // すべてのアラームにAlarmActionsが設定されていることを確認
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const alarmKeys = Object.keys(alarms);

    expect(alarmKeys.length).toBeGreaterThan(0);

    alarmKeys.forEach((key) => {
      const alarm = alarms[key];
      expect(alarm.Properties.AlarmActions).toBeDefined();
      expect(alarm.Properties.AlarmActions.length).toBeGreaterThan(0);
    });
  });

  test('デフォルト閾値が正しく設定されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      // 閾値を指定しない（デフォルト値を使用）
    });

    // Assert
    const template = Template.fromStack(stack);

    // Error Rate: 10% (AlarmNameはトークンなのでMatch.anyValue()を使用)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(),
      Threshold: 10,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
    });

    // Duration Warning: 600秒 = 600000ミリ秒 (AlarmNameはトークンなのでMatch.anyValue()を使用)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(),
      Threshold: 600000,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,
    });

    // Duration Critical: 780秒 = 780000ミリ秒 (AlarmNameはトークンなのでMatch.anyValue()を使用)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(),
      Threshold: 780000,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
    });

    // CollectionSuccessRate: 95%
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-collection-success-rate-test',
      Threshold: 95,
    });
  });

  test('カスタム閾値が正しく設定されること', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      errorRateThreshold: 5, // カスタム: 5%
      durationThreshold: 600, // カスタム: 10分 = 600秒
      collectionSuccessRateThreshold: 90, // カスタム: 90%
    });

    // Assert
    const template = Template.fromStack(stack);

    // Error Rate: 5% (AlarmNameはトークンなのでMatch.anyValue()を使用)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(),
      Threshold: 5,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
    });

    // Duration: 600秒 = 600000ミリ秒 (AlarmNameはトークンなのでMatch.anyValue()を使用)
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: Match.anyValue(),
      Threshold: 600000,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,
    });

    // CollectionSuccessRate: 90%
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-collection-success-rate-test',
      Threshold: 90,
    });
  });

  test('DLQアラームが正しく作成されること', () => {
    // Arrange
    const dlqQueue = new sqs.Queue(stack, 'TestDLQ', {
      queueName: 'test-dlq',
    });

    // Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      dlqQueue,
    });

    // Assert
    const template = Template.fromStack(stack);

    // DLQアラームが作成されていることを確認
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'tdnet-dlq-messages-test',
      AlarmDescription: 'DLQにメッセージが送信されました（Critical）',
      Threshold: 0,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      TreatMissingData: 'notBreaching',
    });
  });

  test('DLQキューが指定されていない場合、DLQアラームは作成されないこと', () => {
    // Arrange & Act
    new CloudWatchAlarms(stack, 'TestAlarms', {
      lambdaFunctions: [testLambdaFunction],
      environment: 'test',
      // dlqQueueを指定しない
    });

    // Assert
    const template = Template.fromStack(stack);
    const alarms = template.findResources('AWS::CloudWatch::Alarm');
    const alarmNames = Object.values(alarms).map((alarm: any) => alarm.Properties.AlarmName);

    // DLQアラームが存在しないことを確認
    expect(alarmNames).not.toContain('tdnet-dlq-messages-test');
  });
});

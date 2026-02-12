/**
 * Lambda DLQ Construct Tests
 */

import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Template } from 'aws-cdk-lib/assertions';
import { LambdaDLQ } from '../lib/constructs/lambda-dlq';

describe('LambdaDLQ Construct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let alertTopic: sns.Topic;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
    alertTopic = new sns.Topic(stack, 'AlertTopic', {
      displayName: 'Test Alert Topic',
    });
  });

  describe('リソース作成', () => {
    it('SQS DLQキューが正しく作成される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'tdnet-collector-dlq-dev',
        MessageRetentionPeriod: 1209600, // 14日 = 1209600秒
        VisibilityTimeout: 300, // 5分 = 300秒
      });
    });

    it('DLQプロセッサーLambda関数が正しく作成される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-dlq-processor-dev',
        Runtime: 'nodejs20.x',
        Handler: 'index.handler',
        Timeout: 30,
        MemorySize: 256,
        Environment: {
          Variables: {
            LOG_LEVEL: 'DEBUG',
            ENVIRONMENT: 'dev',
            NODE_OPTIONS: '--enable-source-maps',
          },
        },
      });
    });

    it('DLQプロセッサーにSQSイベントソースが設定される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
        BatchSize: 10,
        EventSourceArn: {
          'Fn::GetAtt': [
            template.findResources('AWS::SQS::Queue')[Object.keys(template.findResources('AWS::SQS::Queue'))[0]],
            'Arn',
          ],
        },
      });
    });

    it('CloudWatch Alarmが正しく作成される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-dlq-messages-dev',
        AlarmDescription: 'Alert when messages are sent to DLQ',
        Threshold: 0,
        ComparisonOperator: 'GreaterThanThreshold',
        EvaluationPeriods: 1,
        TreatMissingData: 'notBreaching',
      });
    });
  });

  describe('IAM権限', () => {
    it('DLQプロセッサーにSQS読み取り権限が付与される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'sqs:ReceiveMessage',
                'sqs:ChangeMessageVisibility',
                'sqs:GetQueueUrl',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
              ],
              Effect: 'Allow',
            },
          ],
        },
      });
    });

    it('DLQプロセッサーにSNS発行権限が付与される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'sns:Publish',
              Effect: 'Allow',
            },
          ],
        },
      });
    });

    it('DLQプロセッサーにCloudWatch Logs権限が付与される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });
  });

  describe('環境別設定', () => {
    it('本番環境ではログレベルがINFOになる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'prod',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            LOG_LEVEL: 'INFO',
            ENVIRONMENT: 'prod',
          },
        },
      });
    });

    it('開発環境ではログレベルがDEBUGになる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: {
            LOG_LEVEL: 'DEBUG',
            ENVIRONMENT: 'dev',
          },
        },
      });
    });

    it('カスタムキュー名プレフィックスが使用される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
        queueNamePrefix: 'custom',
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SQS::Queue', {
        QueueName: 'custom-collector-dlq-dev',
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('DLQ URLがエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('TestDLQQueueUrl', {
        Export: {
          Name: 'TdnetDLQUrl-dev',
        },
      });
    });

    it('DLQ ARNがエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('TestDLQQueueArn', {
        Export: {
          Name: 'TdnetDLQArn-dev',
        },
      });
    });

    it('DLQプロセッサー関数名がエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('TestDLQProcessorFunctionName', {
        Export: {
          Name: 'TdnetDLQProcessorFunctionName-dev',
        },
      });
    });

    it('DLQアラーム名がエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('TestDLQAlarmName', {
        Export: {
          Name: 'TdnetDLQAlarmName-dev',
        },
      });
    });
  });
});

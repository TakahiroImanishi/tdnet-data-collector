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
      const resources = template.findResources('AWS::Lambda::EventSourceMapping');
      const eventSourceMapping = Object.values(resources)[0];
      
      expect(eventSourceMapping.Properties.BatchSize).toBe(10);
      expect(eventSourceMapping.Properties.EventSourceArn).toHaveProperty('Fn::GetAtt');
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
      const policies = template.findResources('AWS::IAM::Policy');
      const policy = Object.values(policies)[0];
      const statements = policy.Properties.PolicyDocument.Statement;
      
      const sqsStatement = statements.find((s: any) => 
        Array.isArray(s.Action) && s.Action.includes('sqs:ReceiveMessage')
      );
      
      expect(sqsStatement).toBeDefined();
      expect(sqsStatement.Action).toContain('sqs:ReceiveMessage');
      expect(sqsStatement.Action).toContain('sqs:ChangeMessageVisibility');
      expect(sqsStatement.Action).toContain('sqs:GetQueueUrl');
      expect(sqsStatement.Action).toContain('sqs:DeleteMessage');
      expect(sqsStatement.Action).toContain('sqs:GetQueueAttributes');
      expect(sqsStatement.Effect).toBe('Allow');
    });

    it('DLQプロセッサーにSNS発行権限が付与される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      const policies = template.findResources('AWS::IAM::Policy');
      const policy = Object.values(policies)[0];
      const statements = policy.Properties.PolicyDocument.Statement;
      
      const snsStatement = statements.find((s: any) => 
        s.Action === 'sns:Publish' || (Array.isArray(s.Action) && s.Action.includes('sns:Publish'))
      );
      
      expect(snsStatement).toBeDefined();
      expect(snsStatement.Effect).toBe('Allow');
    });

    it('DLQプロセッサーにCloudWatch Logs権限が付与される', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      const policies = template.findResources('AWS::IAM::Policy');
      const policy = Object.values(policies)[0];
      const statements = policy.Properties.PolicyDocument.Statement;
      
      const logsStatement = statements.find((s: any) => 
        Array.isArray(s.Action) && s.Action.includes('logs:CreateLogGroup')
      );
      
      expect(logsStatement).toBeDefined();
      expect(logsStatement.Action).toContain('logs:CreateLogGroup');
      expect(logsStatement.Action).toContain('logs:CreateLogStream');
      expect(logsStatement.Action).toContain('logs:PutLogEvents');
      expect(logsStatement.Effect).toBe('Allow');
      expect(logsStatement.Resource).toBe('*');
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
      const outputs = template.toJSON().Outputs;
      const queueUrlOutput = Object.values(outputs).find((o: any) => 
        o.Export?.Name === 'TdnetDLQUrl-dev'
      );
      
      expect(queueUrlOutput).toBeDefined();
    });

    it('DLQ ARNがエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      const outputs = template.toJSON().Outputs;
      const queueArnOutput = Object.values(outputs).find((o: any) => 
        o.Export?.Name === 'TdnetDLQArn-dev'
      );
      
      expect(queueArnOutput).toBeDefined();
    });

    it('DLQプロセッサー関数名がエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      const outputs = template.toJSON().Outputs;
      const functionNameOutput = Object.values(outputs).find((o: any) => 
        o.Export?.Name === 'TdnetDLQProcessorFunctionName-dev'
      );
      
      expect(functionNameOutput).toBeDefined();
    });

    it('DLQアラーム名がエクスポートされる', () => {
      // Arrange & Act
      new LambdaDLQ(stack, 'TestDLQ', {
        environment: 'dev',
        alertTopic,
      });

      // Assert
      const template = Template.fromStack(stack);
      const outputs = template.toJSON().Outputs;
      const alarmNameOutput = Object.values(outputs).find((o: any) => 
        o.Export?.Name === 'TdnetDLQAlarmName-dev'
      );
      
      expect(alarmNameOutput).toBeDefined();
    });
  });
});

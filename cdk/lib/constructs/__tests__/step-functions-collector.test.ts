/**
 * Step Functions Collector Construct Unit Tests
 * 
 * Step Functions Collector Constructの単体テスト。
 * Constructの正常作成、ステートマシン定義、Lambda統合、IAMロール設定を検証。
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { StepFunctionsCollector } from '../step-functions-collector';

describe('StepFunctionsCollector', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let mockInitFunction: lambda.IFunction;
  let mockFetchFunction: lambda.IFunction;
  let mockSaveFunction: lambda.IFunction;
  let mockAggregateFunction: lambda.IFunction;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');

    // モックLambda関数を作成
    mockInitFunction = lambda.Function.fromFunctionArn(
      stack,
      'MockInitFunction',
      'arn:aws:lambda:us-east-1:123456789012:function:collector-init'
    );

    mockFetchFunction = lambda.Function.fromFunctionArn(
      stack,
      'MockFetchFunction',
      'arn:aws:lambda:us-east-1:123456789012:function:collector-fetch'
    );

    mockSaveFunction = lambda.Function.fromFunctionArn(
      stack,
      'MockSaveFunction',
      'arn:aws:lambda:us-east-1:123456789012:function:collector-save'
    );

    mockAggregateFunction = lambda.Function.fromFunctionArn(
      stack,
      'MockAggregateFunction',
      'arn:aws:lambda:us-east-1:123456789012:function:collector-aggregate'
    );
  });

  describe('Construct作成', () => {
    test('Constructが正常に作成されること', () => {
      // Act
      const construct = new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      expect(construct).toBeDefined();
      expect(construct.stateMachine).toBeDefined();
      expect(construct.logGroup).toBeDefined();
    });

    test('カスタムログ保持期間が設定されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
        logRetentionDays: logs.RetentionDays.ONE_WEEK,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 7,
      });
    });
  });

  describe('ステートマシン設定', () => {
    test('Standard Workflowsが作成されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        StateMachineType: 'STANDARD',
      });
    });

    test('X-Rayトレーシングが有効化されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        TracingConfiguration: {
          Enabled: true,
        },
      });
    });

    test('CloudWatch Logsが設定されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        LoggingConfiguration: {
          Level: 'ALL',
          IncludeExecutionData: true,
          Destinations: Match.arrayWith([
            Match.objectLike({
              CloudWatchLogsLogGroup: Match.objectLike({
                LogGroupArn: Match.anyValue(),
              }),
            }),
          ]),
        },
      });
    });

    test('タイムアウトが1時間に設定されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      // DefinitionStringはFn::Joinで構築されているため、配列として検証
      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // タイムアウトが3600秒（1時間）に設定されていることを確認
        expect(fullDefinition).toContain('"TimeoutSeconds":3600');
      }
    });
  });

  describe('Lambda関数統合', () => {
    test('4つのLambda関数が統合されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      expect(stateMachineKeys.length).toBeGreaterThan(0);

      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;
      expect(definitionString).toBeDefined();

      // DefinitionStringはFn::Joinで構築されているため、配列として検証
      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // 各Lambda関数が定義に含まれていることを確認
        expect(fullDefinition).toContain('collector-init');
        expect(fullDefinition).toContain('collector-fetch');
        expect(fullDefinition).toContain('collector-save');
        expect(fullDefinition).toContain('collector-aggregate');
      }
    });

    test('Lambda Invoke Taskが正しく設定されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // Lambda Invoke Taskの設定を確認（ARNは動的に生成されるため、states:::lambda:invokeの部分を確認）
        expect(fullDefinition).toContain('states:::lambda:invoke');
        expect(fullDefinition).toContain('Initialize');
        expect(fullDefinition).toContain('FetchPageData');
        expect(fullDefinition).toContain('SavePageData');
        expect(fullDefinition).toContain('AggregateResults');
      }
    });
  });

  describe('IAMロール設定', () => {
    test('ステートマシンにIAMロールが作成されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'states.amazonaws.com',
              },
            }),
          ]),
        },
      });
    });

    test('Lambda実行権限が付与されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'lambda:InvokeFunction',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('CloudWatch Logs書き込み権限が付与されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'logs:CreateLogDelivery',
                'logs:GetLogDelivery',
                'logs:UpdateLogDelivery',
                'logs:DeleteLogDelivery',
                'logs:ListLogDeliveries',
                'logs:PutResourcePolicy',
                'logs:DescribeResourcePolicies',
                'logs:DescribeLogGroups',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('CloudWatch Logs設定', () => {
    test('ロググループが作成されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/vendedlogs/states/tdnet-collector',
        RetentionInDays: 30,
      });
    });

    test('ロググループの削除ポリシーがDESTROYに設定されること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResource('AWS::Logs::LogGroup', {
        DeletionPolicy: 'Delete',
        UpdateReplacePolicy: 'Delete',
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    test('StateMachineArnがエクスポートされること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('*', {
        Export: {
          Name: 'TdnetCollectorStateMachineArn',
        },
      });
    });

    test('StateMachineNameがエクスポートされること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasOutput('*', {
        Export: {
          Name: 'TdnetCollectorStateMachineName',
        },
      });
    });
  });

  describe('エラーハンドリング', () => {
    test('Retryが設定されていること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // Retry設定が含まれていることを確認
        expect(fullDefinition).toContain('Retry');
        expect(fullDefinition).toContain('States.TaskFailed');
      }
    });

    test('Catchが設定されていること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // Catch設定が含まれていることを確認
        expect(fullDefinition).toContain('Catch');
        expect(fullDefinition).toContain('States.ALL');
      }
    });
  });

  describe('Map状態設定', () => {
    test('Map状態が定義されていること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // Map状態が含まれていることを確認
        expect(fullDefinition).toContain('ProcessPages');
        expect(fullDefinition).toContain('"Type":"Map"');
      }
    });

    test('MaxConcurrencyが5に設定されていること', () => {
      // Act
      new StepFunctionsCollector(stack, 'TestConstruct', {
        collectorInitFunction: mockInitFunction,
        collectorFetchFunction: mockFetchFunction,
        collectorSaveFunction: mockSaveFunction,
        collectorAggregateFunction: mockAggregateFunction,
      });

      // Assert
      const template = Template.fromStack(stack);
      const stateMachine = template.findResources('AWS::StepFunctions::StateMachine');
      const stateMachineKeys = Object.keys(stateMachine);
      const definitionString = stateMachine[stateMachineKeys[0]].Properties.DefinitionString;

      if (typeof definitionString === 'object' && 'Fn::Join' in definitionString) {
        const joinParts = (definitionString as any)['Fn::Join'][1];
        const fullDefinition = joinParts.join('');

        // MaxConcurrency設定が含まれていることを確認
        expect(fullDefinition).toContain('"MaxConcurrency":5');
      }
    });
  });
});

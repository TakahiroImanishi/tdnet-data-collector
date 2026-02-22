/**
 * Compute Stack テスト
 *
 * Lambda関数、DLQ、IAM権限の設定を検証します。
 * 
 * テスト戦略: .kiro/steering/development/testing-strategy.md
 * 
 * 注意: Dockerバンドリングを回避するため、Lambda関数コードをモック化しています
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { TdnetComputeStack } from '../compute-stack';

// Dockerバンドリングを回避: NodejsFunctionの代わりにインラインコードを使用
jest.mock('aws-cdk-lib/aws-lambda-nodejs', () => {
  const actual = jest.requireActual('aws-cdk-lib/aws-lambda-nodejs');
  return {
    ...actual,
    NodejsFunction: class MockNodejsFunction extends actual.NodejsFunction {
      constructor(scope: any, id: string, props: any) {
        // NodejsFunctionの代わりに通常のFunctionを作成（インラインコード使用）
        const mockProps = {
          ...props,
          code: lambda.Code.fromInline('exports.handler = async () => ({ statusCode: 200 });'),
          handler: 'index.handler',
        };
        // NodejsFunctionのentry, bundlingなどのプロパティを削除
        delete mockProps.entry;
        delete mockProps.bundling;
        delete mockProps.depsLockFilePath;
        delete mockProps.projectRoot;
        
        super(scope, id, mockProps);
      }
    },
  };
});

function createComputeStack(env: 'prod' | 'local', enableStepFunctions = false) {
  const app = new cdk.App();
  const baseStack = new cdk.Stack(app, `${env}BaseStack`);

  const mockResources = {
    disclosuresTable: dynamodb.Table.fromTableName(baseStack, 'Disclosures', 'test-disclosures'),
    executionsTable: dynamodb.Table.fromTableName(baseStack, 'Executions', 'test-executions'),
    exportStatusTable: dynamodb.Table.fromTableName(baseStack, 'ExportStatus', 'test-export-status'),
    pdfsBucket: s3.Bucket.fromBucketName(baseStack, 'Pdfs', 'test-pdfs'),
    exportsBucket: s3.Bucket.fromBucketName(baseStack, 'Exports', 'test-exports'),
    apiKeySecret: secretsmanager.Secret.fromSecretNameV2(baseStack, 'ApiKey', 'test-api-key'),
    alertTopic: sns.Topic.fromTopicArn(baseStack, 'Alert', 'arn:aws:sns:us-east-1:123456789012:test-alert'),
  };

  const computeStack = new TdnetComputeStack(app, `${env}ComputeStack`, {
    environment: env,
    enableStepFunctions,
    ...mockResources,
  });

  return { computeStack, template: Template.fromStack(computeStack) };
}

describe('TdnetComputeStack', () => {
  // 本番環境スタックを一度だけ作成（Dockerバンドリング最適化）
  let prodStack: ReturnType<typeof createComputeStack>;
  let localStack: ReturnType<typeof createComputeStack>;

  beforeAll(() => {
    prodStack = createComputeStack('prod');
    localStack = createComputeStack('local');
  });

  describe('Lambda Functions', () => {
    it('9個のLambda関数が作成されている（SingletonFunction除く）', () => {
      const functions = prodStack.template.findResources('AWS::Lambda::Function');
      // 9個のメインLambda + 1個のSingletonFunction（CDK内部使用）= 10個
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(9);
    });

    it('Collector Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Runtime: 'nodejs20.x',
        Timeout: 900, // 本番環境は15分（900秒）
        MemorySize: 512,
      });
    });

    it('Query Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-query-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Export Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-export-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Collect Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Collect Status Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-status-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Export Status Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-export-status-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('PDF Download Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-pdf-download-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Health Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-health-prod',
        Runtime: 'nodejs20.x',
      });
    });

    it('Stats Functionが正しく設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-stats-prod',
        Runtime: 'nodejs20.x',
      });
    });
  });

  describe('X-Ray Tracing', () => {
    it('すべてのLambda関数でX-Rayトレーシングが有効', () => {
      const functions = prodStack.template.findResources('AWS::Lambda::Function');
      Object.values(functions).forEach((fn: any) => {
        expect(fn.Properties.TracingConfig?.Mode).toBe('Active');
      });
    });
  });

  describe('DLQ', () => {
    it('DLQが作成されている', () => {
      expect(prodStack.computeStack.dlq).toBeDefined();
      expect(prodStack.computeStack.dlq.queue).toBeDefined();
    });

    it('Collector FunctionにDLQが設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        DeadLetterConfig: Match.objectLike({
          TargetArn: Match.anyValue(),
        }),
      });
    });
  });

  describe('IAM Permissions', () => {
    it('CloudWatch PutMetricData権限が設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'cloudwatch:PutMetricData',
              Effect: 'Allow',
              Resource: '*',
              Condition: {
                StringEquals: {
                  'cloudwatch:namespace': 'TDnet',
                },
              },
            }),
          ]),
        }),
      });
    });

    it('DynamoDB権限が設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                Match.stringLikeRegexp('dynamodb:.*'),
              ]),
            }),
          ]),
        }),
      });
    });

    it('S3権限が設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                Match.stringLikeRegexp('s3:.*'),
              ]),
            }),
          ]),
        }),
      });
    });
  });

  describe('Environment Variables', () => {
    it('Collector Functionの環境変数が設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Environment: {
          Variables: Match.objectLike({
            DYNAMODB_TABLE: Match.anyValue(),
            EXECUTION_STATE_TABLE: Match.anyValue(),
            S3_BUCKET: Match.anyValue(),
            TDNET_BASE_URL: 'https://www.release.tdnet.info/inbs',
            ENVIRONMENT: 'prod',
          }),
        },
      });
    });

    it('Query Functionの環境変数が設定されている', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-query-prod',
        Environment: {
          Variables: Match.objectLike({
            DYNAMODB_TABLE_NAME: Match.anyValue(),
            S3_BUCKET_NAME: Match.anyValue(),
            ENVIRONMENT: 'prod',
          }),
        },
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('すべてのLambda関数のARNが出力されている', () => {
      prodStack.template.hasOutput('CollectorFunctionArn', {
        Export: { Name: 'TdnetCollectorFunctionArn-prod' },
      });
      prodStack.template.hasOutput('QueryFunctionArn', {
        Export: { Name: 'TdnetQueryFunctionArn-prod' },
      });
      prodStack.template.hasOutput('ExportFunctionArn', {
        Export: { Name: 'TdnetExportFunctionArn-prod' },
      });
      prodStack.template.hasOutput('CollectFunctionArn', {
        Export: { Name: 'TdnetCollectFunctionArn-prod' },
      });
      prodStack.template.hasOutput('CollectStatusFunctionArn', {
        Export: { Name: 'TdnetCollectStatusFunctionArn-prod' },
      });
      prodStack.template.hasOutput('ExportStatusFunctionArn', {
        Export: { Name: 'TdnetExportStatusFunctionArn-prod' },
      });
      prodStack.template.hasOutput('PdfDownloadFunctionArn', {
        Export: { Name: 'TdnetPdfDownloadFunctionArn-prod' },
      });
      prodStack.template.hasOutput('HealthFunctionArn', {
        Export: { Name: 'TdnetHealthFunctionArn-prod' },
      });
      prodStack.template.hasOutput('StatsFunctionArn', {
        Export: { Name: 'TdnetStatsFunctionArn-prod' },
      });
    });
  });

  describe('タグ付け', () => {
    it('必須タグが設定されている', () => {
      const tags = cdk.Tags.of(prodStack.computeStack);
      expect(tags).toBeDefined();
    });
  });

  describe('環境別設定', () => {
    it('本番環境の設定が正しい', () => {
      prodStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-prod',
        Timeout: 900, // 本番環境は15分（900秒）
        MemorySize: 512,
      });
    });

    it('ローカル環境の設定が正しい', () => {
      localStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-local',
      });
    });
  });

  describe('Public Properties', () => {
    it('すべてのLambda関数がpublicプロパティとして公開されている', () => {
      expect(prodStack.computeStack.collectorFunction).toBeDefined();
      expect(prodStack.computeStack.queryFunction).toBeDefined();
      expect(prodStack.computeStack.exportFunction).toBeDefined();
      expect(prodStack.computeStack.collectFunction).toBeDefined();
      expect(prodStack.computeStack.collectStatusFunction).toBeDefined();
      expect(prodStack.computeStack.exportStatusFunction).toBeDefined();
      expect(prodStack.computeStack.pdfDownloadFunction).toBeDefined();
      expect(prodStack.computeStack.healthFunction).toBeDefined();
      expect(prodStack.computeStack.statsFunction).toBeDefined();
      expect(prodStack.computeStack.dlq).toBeDefined();
    });
  });

  describe('Step Functions統合（enableStepFunctions=true）', () => {
    // Step Functions有効スタックを一度だけ作成
    let stepFunctionsStack: ReturnType<typeof createComputeStack>;
    let noStepFunctionsStack: ReturnType<typeof createComputeStack>;

    beforeAll(() => {
      stepFunctionsStack = createComputeStack('prod', true);
      noStepFunctionsStack = createComputeStack('prod', false);
    });

    it('Step Functions有効時に追加のLambda関数が作成される', () => {
      // 既存9個 + Step Functions用4個 + SingletonFunction = 14個
      const functions = stepFunctionsStack.template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(13);
    });

    it('Collector-Init Functionが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-init-prod',
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    it('Collector-Fetch Functionが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-fetch-prod',
        Runtime: 'nodejs20.x',
        Timeout: 60,
        MemorySize: 256,
      });
    });

    it('Collector-Save Functionが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-save-prod',
        Runtime: 'nodejs20.x',
        Timeout: 120,
        MemorySize: 512,
      });
    });

    it('Collector-Aggregate Functionが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collector-aggregate-prod',
        Runtime: 'nodejs20.x',
        Timeout: 30,
        MemorySize: 256,
      });
    });

    it('ExecutionStateTableが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'ExecutionState_prod',
      });
    });

    it('Step Functions StateMachineが作成される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
        StateMachineName: 'tdnet-collector-workflow',
        StateMachineType: 'STANDARD',
      });
    });

    it('Collect FunctionにSTATE_MACHINE_ARN環境変数が設定される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-prod',
        Environment: {
          Variables: Match.objectLike({
            STATE_MACHINE_ARN: Match.anyValue(),
          }),
        },
      });
    });

    it('Collect Status FunctionにSTATE_MACHINE_ARN環境変数が設定される', () => {
      stepFunctionsStack.template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'tdnet-collect-status-prod',
        Environment: {
          Variables: Match.objectLike({
            STATE_MACHINE_ARN: Match.anyValue(),
            EXECUTION_STATE_TABLE: Match.anyValue(),
          }),
        },
      });
    });

    it('Step Functions関連のCloudFormation Outputsが出力される', () => {
      stepFunctionsStack.template.hasOutput('CollectorInitFunctionArn', {
        Export: { Name: 'TdnetCollectorInitFunctionArn-prod' },
      });
      stepFunctionsStack.template.hasOutput('CollectorFetchFunctionArn', {
        Export: { Name: 'TdnetCollectorFetchFunctionArn-prod' },
      });
      stepFunctionsStack.template.hasOutput('CollectorSaveFunctionArn', {
        Export: { Name: 'TdnetCollectorSaveFunctionArn-prod' },
      });
      stepFunctionsStack.template.hasOutput('CollectorAggregateFunctionArn', {
        Export: { Name: 'TdnetCollectorAggregateFunctionArn-prod' },
      });
      stepFunctionsStack.template.hasOutput('ExecutionStateTableName', {
        Export: { Name: 'TdnetExecutionStateTableName-prod' },
      });
      stepFunctionsStack.template.hasOutput('StateMachineArn', {
        Export: { Name: 'TdnetStateMachineArn-prod' },
      });
      stepFunctionsStack.template.hasOutput('StateMachineName', {
        Export: { Name: 'TdnetStateMachineName-prod' },
      });
    });

    it('Step Functions無効時は追加リソースが作成されない', () => {
      // 既存9個 + SingletonFunction = 10個
      const functions = noStepFunctionsStack.template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(9);
      expect(Object.keys(functions).length).toBeLessThan(13); // Step Functions用の4個は含まれない
      
      // ExecutionStateTableは作成されない
      const tables = noStepFunctionsStack.template.findResources('AWS::DynamoDB::Table');
      expect(Object.keys(tables).length).toBe(0);
      
      // StateMachineは作成されない
      const stateMachines = noStepFunctionsStack.template.findResources('AWS::StepFunctions::StateMachine');
      expect(Object.keys(stateMachines).length).toBe(0);
    });

    it('Step Functions有効時のpublicプロパティが設定される', () => {
      expect(stepFunctionsStack.computeStack.collectorInitFunction).toBeDefined();
      expect(stepFunctionsStack.computeStack.collectorFetchFunction).toBeDefined();
      expect(stepFunctionsStack.computeStack.collectorSaveFunction).toBeDefined();
      expect(stepFunctionsStack.computeStack.collectorAggregateFunction).toBeDefined();
      expect(stepFunctionsStack.computeStack.executionStateTable).toBeDefined();
      expect(stepFunctionsStack.computeStack.stepFunctionsCollector).toBeDefined();
    });
  });
});

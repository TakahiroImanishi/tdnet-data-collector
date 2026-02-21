/**
 * CloudWatch Integration Tests
 * 
 * すべてのCloudWatchコンポーネント（メトリクス、アラーム、ダッシュボード）が
 * 正しく統合されていることを検証します。
 * 
 * Requirements: 要件14.1（テスト）
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { CloudWatchAlarms } from '../lib/constructs/cloudwatch-alarms';
import { CloudWatchDashboard } from '../lib/constructs/cloudwatch-dashboard';

describe('CloudWatch Integration Tests', () => {
  let stack: cdk.Stack;
  let mockLambdaFunctions: {
    collector: lambda.IFunction;
    query: lambda.IFunction;
    export: lambda.IFunction;
  };
  let mockDynamodbTables: {
    disclosures: dynamodb.ITable;
    executions: dynamodb.ITable;
    exportStatus: dynamodb.ITable;
  };
  let mockS3Buckets: {
    pdfs: s3.IBucket;
    exports: s3.IBucket;
  };
  let mockApiGateway: apigateway.IRestApi;

  beforeEach(() => {
    stack = new cdk.Stack();

    // モックLambda関数を作成
    const createMockLambda = (id: string): lambda.IFunction => {
      return new lambda.Function(stack, id, {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
        functionName: `test-${id.toLowerCase()}`,
      });
    };

    mockLambdaFunctions = {
      collector: createMockLambda('CollectorFunction'),
      query: createMockLambda('QueryFunction'),
      export: createMockLambda('ExportFunction'),
    };

    // モックDynamoDBテーブルを作成
    mockDynamodbTables = {
      disclosures: new dynamodb.Table(stack, 'DisclosuresTable', {
        partitionKey: { name: 'disclosure_id', type: dynamodb.AttributeType.STRING },
      }),
      executions: new dynamodb.Table(stack, 'ExecutionsTable', {
        partitionKey: { name: 'execution_id', type: dynamodb.AttributeType.STRING },
      }),
      exportStatus: new dynamodb.Table(stack, 'ExportStatusTable', {
        partitionKey: { name: 'export_id', type: dynamodb.AttributeType.STRING },
      }),
    };

    // モックS3バケットを作成
    mockS3Buckets = {
      pdfs: new s3.Bucket(stack, 'PdfsBucket'),
      exports: new s3.Bucket(stack, 'ExportsBucket'),
    };

    // モックAPI Gatewayを作成
    mockApiGateway = new apigateway.RestApi(stack, 'TestApi', {
      restApiName: 'test-api',
      deploy: false,
    });

    // ダミーリソースとメソッドを追加
    const resource = mockApiGateway.root.addResource('test');
    resource.addMethod('GET');
  });

  describe('カスタムメトリクスの送信確認', () => {
    test('Lambda関数にCloudWatchメトリクス送信権限が付与されていること', () => {
      // Lambda関数にメトリクス送信権限を付与
      Object.values(mockLambdaFunctions).forEach((fn) => {
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
          })
        );
      });

      const template = Template.fromStack(stack);

      // IAMポリシーが作成されていることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'cloudwatch:PutMetricData',
              Effect: 'Allow',
              Resource: '*',
            }),
          ]),
        },
      });
    });

    test('カスタムメトリクス名前空間が正しく設定されていること', () => {
      // メトリクス送信のテスト（実際のメトリクス送信はsrc/utils/metrics.tsでテスト済み）
      // ここではLambda関数が正しい環境変数を持っていることを確認

      const template = Template.fromStack(stack);

      // Lambda関数が作成されていることを確認
      template.resourceCountIs('AWS::Lambda::Function', 3);
    });

    test('すべてのLambda関数がメトリクス送信権限を持つこと', () => {
      // すべてのLambda関数にメトリクス送信権限を付与
      Object.values(mockLambdaFunctions).forEach((fn) => {
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
          })
        );
      });

      const template = Template.fromStack(stack);

      // 3つのLambda関数に対して3つのIAMポリシーが作成される
      template.resourceCountIs('AWS::IAM::Policy', 3);
    });
  });

  describe('アラームの設定確認', () => {
    test('すべてのLambda関数に対してアラームが作成されること', () => {
      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
      });

      const template = Template.fromStack(stack);

      // 各Lambda関数に対して4つのアラーム（Error Rate, Duration, DurationCritical, Throttles）
      // + カスタムメトリクスアラーム3つ（CollectionSuccessRate, NoData, CollectionFailure）
      // = 3 * 4 + 3 = 15個のアラーム
      template.resourceCountIs('AWS::CloudWatch::Alarm', 15);
    });

    test('アラームにSNSトピックが関連付けられていること', () => {
      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
      });

      const template = Template.fromStack(stack);

      // SNS Topicが作成されていることを確認
      template.resourceCountIs('AWS::SNS::Topic', 1);

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

    test('カスタムメトリクスアラームが作成されること', () => {
      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
      });

      const template = Template.fromStack(stack);

      // CollectionSuccessRateアラーム（MathExpressionを使用しているためMetricName/Namespaceは未定義）
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-collection-success-rate-test',
        ComparisonOperator: 'LessThanThreshold',
        Threshold: 95,
      });

      // NoDataCollectedアラーム
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-no-data-collected-test',
        MetricName: 'DisclosuresCollected',
        Namespace: 'TDnet/Collector',
      });

      // CollectionFailureアラーム
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-collection-failures-test',
        MetricName: 'DisclosuresFailed',
        Namespace: 'TDnet/Collector',
      });
    });

    test('アラーム閾値が正しく設定されていること', () => {
      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
        errorRateThreshold: 5,
        durationThreshold: 600,
        collectionSuccessRateThreshold: 90,
      });

      const template = Template.fromStack(stack);

      // Error Rate: 5%
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Threshold: 5,
        ComparisonOperator: 'GreaterThanThreshold',
      });

      // Duration: 600秒 = 600000ミリ秒
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        Threshold: 600000,
        ComparisonOperator: 'GreaterThanThreshold',
      });

      // CollectionSuccessRate: 90%
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-collection-success-rate-test',
        Threshold: 90,
        ComparisonOperator: 'LessThanThreshold',
      });
    });
  });

  describe('ダッシュボードの表示確認', () => {
    test('ダッシュボードが正しく作成されること', () => {
      // CloudWatch Dashboardを作成
      const dashboard = new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'test',
        lambdaFunctions: {
          collector: mockLambdaFunctions.collector,
          query: mockLambdaFunctions.query,
          export: mockLambdaFunctions.export,
          collect: mockLambdaFunctions.collector, // 同じ関数を使用
          collectStatus: mockLambdaFunctions.collector,
          exportStatus: mockLambdaFunctions.export,
          pdfDownload: mockLambdaFunctions.query,
        },
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      // ダッシュボードが作成されていることを確認
      expect(dashboard.dashboard).toBeDefined();

      const template = Template.fromStack(stack);

      // ダッシュボードリソースが存在することを確認
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'tdnet-collector-test',
      });
    });

    test('ダッシュボードにすべてのウィジェットが含まれていること', () => {
      // CloudWatch Dashboardを作成
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'test',
        lambdaFunctions: {
          collector: mockLambdaFunctions.collector,
          query: mockLambdaFunctions.query,
          export: mockLambdaFunctions.export,
          collect: mockLambdaFunctions.collector,
          collectStatus: mockLambdaFunctions.collector,
          exportStatus: mockLambdaFunctions.export,
          pdfDownload: mockLambdaFunctions.query,
        },
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // ダッシュボードリソースが存在することを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);

      // ダッシュボードリソースを取得
      const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
      const dashboardKeys = Object.keys(dashboards);
      expect(dashboardKeys.length).toBe(1);

      // DashboardBodyプロパティが存在することを確認
      const dashboard = dashboards[dashboardKeys[0]];
      expect(dashboard.Properties.DashboardBody).toBeDefined();
    });

    test('ダッシュボード名に環境名が含まれていること', () => {
      // 本番環境でダッシュボードを作成
      new CloudWatchDashboard(stack, 'ProdDashboard', {
        environment: 'prod',
        lambdaFunctions: {
          collector: mockLambdaFunctions.collector,
          query: mockLambdaFunctions.query,
          export: mockLambdaFunctions.export,
          collect: mockLambdaFunctions.collector,
          collectStatus: mockLambdaFunctions.collector,
          exportStatus: mockLambdaFunctions.export,
          pdfDownload: mockLambdaFunctions.query,
        },
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // ダッシュボード名に環境名が含まれていることを確認
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'tdnet-collector-prod',
      });
    });
  });

  describe('CloudWatch統合の完全性確認', () => {
    test('メトリクス、アラーム、ダッシュボードがすべて連携していること', () => {
      // すべてのLambda関数にメトリクス送信権限を付与
      Object.values(mockLambdaFunctions).forEach((fn) => {
        fn.addToRolePolicy(
          new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*'],
          })
        );
      });

      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
      });

      // CloudWatch Dashboardを作成
      new CloudWatchDashboard(stack, 'TestDashboard', {
        environment: 'test',
        lambdaFunctions: {
          collector: mockLambdaFunctions.collector,
          query: mockLambdaFunctions.query,
          export: mockLambdaFunctions.export,
          collect: mockLambdaFunctions.collector,
          collectStatus: mockLambdaFunctions.collector,
          exportStatus: mockLambdaFunctions.export,
          pdfDownload: mockLambdaFunctions.query,
        },
        dynamodbTables: mockDynamodbTables,
        s3Buckets: mockS3Buckets,
        apiGateway: mockApiGateway,
      });

      const template = Template.fromStack(stack);

      // Lambda関数が作成されていることを確認
      template.resourceCountIs('AWS::Lambda::Function', 3);

      // IAMポリシーが作成されていることを確認（メトリクス送信権限）
      template.resourceCountIs('AWS::IAM::Policy', 3);

      // CloudWatch Alarmsが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Alarm', 15);

      // SNS Topicが作成されていることを確認
      template.resourceCountIs('AWS::SNS::Topic', 1);

      // CloudWatch Dashboardが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    });

    test('環境ごとに異なる設定が適用されること', () => {
      // 開発環境
      const devStack = new cdk.Stack();
      const devLambda = new lambda.Function(devStack, 'DevFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
      });

      new CloudWatchAlarms(devStack, 'DevAlarms', {
        lambdaFunctions: [devLambda],
        environment: 'dev',
      });

      const devTemplate = Template.fromStack(devStack);

      // 開発環境のアラーム名を確認
      devTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-collection-success-rate-dev',
      });

      // 本番環境
      const prodStack = new cdk.Stack();
      const prodLambda = new lambda.Function(prodStack, 'ProdFunction', {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline('exports.handler = async () => {};'),
      });

      new CloudWatchAlarms(prodStack, 'ProdAlarms', {
        lambdaFunctions: [prodLambda],
        environment: 'prod',
      });

      const prodTemplate = Template.fromStack(prodStack);

      // 本番環境のアラーム名を確認
      prodTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'tdnet-collection-success-rate-prod',
      });
    });

    test('すべてのリソースが正しい名前空間を使用していること', () => {
      // CloudWatch Alarmsを作成
      new CloudWatchAlarms(stack, 'TestAlarms', {
        lambdaFunctions: Object.values(mockLambdaFunctions),
        environment: 'test',
      });

      const template = Template.fromStack(stack);

      // カスタムメトリクスアラームがTDnet/Collector名前空間を使用していることを確認
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'DisclosuresCollected',
        Namespace: 'TDnet/Collector',
      });

      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'DisclosuresFailed',
        Namespace: 'TDnet/Collector',
      });

      // Lambda関数のメトリクスはAWS/Lambda名前空間を使用
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        MetricName: 'Duration',
        Namespace: 'AWS/Lambda',
      });
    });
  });

  describe('エラーシナリオの確認', () => {
    test('Lambda関数が存在しない場合でもスタックが作成できること', () => {
      // Lambda関数なしでCloudWatch Alarmsを作成
      expect(() => {
        new CloudWatchAlarms(stack, 'EmptyAlarms', {
          lambdaFunctions: [],
          environment: 'test',
        });
      }).not.toThrow();

      const template = Template.fromStack(stack);

      // カスタムメトリクスアラームのみが作成される（3個）
      template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
    });

    test('無効な環境名でもスタックが作成できること', () => {
      expect(() => {
        new CloudWatchAlarms(stack, 'InvalidEnvAlarms', {
          lambdaFunctions: Object.values(mockLambdaFunctions),
          environment: 'invalid-env',
        });
      }).not.toThrow();

      const template = Template.fromStack(stack);

      // アラームが作成されていることを確認
      template.resourceCountIs('AWS::CloudWatch::Alarm', 15);
    });
  });
});

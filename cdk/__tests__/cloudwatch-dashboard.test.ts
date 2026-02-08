import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Template } from 'aws-cdk-lib/assertions';
import { CloudWatchDashboard } from '../lib/constructs/cloudwatch-dashboard';

describe('CloudWatchDashboard', () => {
  let stack: cdk.Stack;
  let mockLambdaFunctions: {
    collector: lambda.IFunction;
    query: lambda.IFunction;
    export: lambda.IFunction;
    collect: lambda.IFunction;
    collectStatus: lambda.IFunction;
    exportStatus: lambda.IFunction;
    pdfDownload: lambda.IFunction;
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
      });
    };

    mockLambdaFunctions = {
      collector: createMockLambda('CollectorFunction'),
      query: createMockLambda('QueryFunction'),
      export: createMockLambda('ExportFunction'),
      collect: createMockLambda('CollectFunction'),
      collectStatus: createMockLambda('CollectStatusFunction'),
      exportStatus: createMockLambda('ExportStatusFunction'),
      pdfDownload: createMockLambda('PdfDownloadFunction'),
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
      deploy: false, // デプロイを無効化してテストを高速化
    });

    // ダミーリソースとメソッドを追加（API Gatewayの検証エラーを回避）
    const resource = mockApiGateway.root.addResource('test');
    resource.addMethod('GET');
  });

  test('ダッシュボードが正しく作成される', () => {
    // CloudWatch Dashboardを作成
    const dashboard = new CloudWatchDashboard(stack, 'TestDashboard', {
      environment: 'dev',
      lambdaFunctions: mockLambdaFunctions,
      dynamodbTables: mockDynamodbTables,
      s3Buckets: mockS3Buckets,
      apiGateway: mockApiGateway,
    });

    // ダッシュボードが作成されていることを確認
    expect(dashboard.dashboard).toBeDefined();

    // CloudFormationテンプレートを取得
    const template = Template.fromStack(stack);

    // ダッシュボードリソースが存在することを確認
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'tdnet-collector-dev',
    });
  });

  test('すべてのウィジェットが含まれている', () => {
    // CloudWatch Dashboardを作成
    new CloudWatchDashboard(stack, 'TestDashboard', {
      environment: 'dev',
      lambdaFunctions: mockLambdaFunctions,
      dynamodbTables: mockDynamodbTables,
      s3Buckets: mockS3Buckets,
      apiGateway: mockApiGateway,
    });

    // CloudFormationテンプレートを取得
    const template = Template.fromStack(stack);

    // ダッシュボードリソースを取得
    const dashboards = template.findResources('AWS::CloudWatch::Dashboard');
    const dashboardKeys = Object.keys(dashboards);
    expect(dashboardKeys.length).toBe(1);

    const dashboardBody = JSON.parse(dashboards[dashboardKeys[0]].Properties.DashboardBody);

    // ウィジェットが存在することを確認
    expect(dashboardBody.widgets).toBeDefined();
    expect(dashboardBody.widgets.length).toBeGreaterThan(0);

    // Lambda Invocationsウィジェットが含まれていることを確認
    const invocationsWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'Lambda Invocations'
    );
    expect(invocationsWidget).toBeDefined();

    // Lambda Errorsウィジェットが含まれていることを確認
    const errorsWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'Lambda Errors'
    );
    expect(errorsWidget).toBeDefined();

    // Lambda Durationウィジェットが含まれていることを確認
    const durationWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'Lambda Duration (ms)'
    );
    expect(durationWidget).toBeDefined();

    // DynamoDB Consumed Capacityウィジェットが含まれていることを確認
    const dynamoWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'DynamoDB Consumed Capacity Units'
    );
    expect(dynamoWidget).toBeDefined();

    // ビジネスメトリクスウィジェットが含まれていることを確認
    const businessWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'Disclosures Collected (Daily)'
    );
    expect(businessWidget).toBeDefined();

    // API Gatewayウィジェットが含まれていることを確認
    const apiWidget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'API Gateway Requests'
    );
    expect(apiWidget).toBeDefined();

    // S3ウィジェットが含まれていることを確認
    const s3Widget = dashboardBody.widgets.find(
      (w: any) => w.properties?.title === 'S3 Bucket Size (Bytes)'
    );
    expect(s3Widget).toBeDefined();
  });

  test('環境名が正しく設定される', () => {
    // 本番環境でダッシュボードを作成
    new CloudWatchDashboard(stack, 'ProdDashboard', {
      environment: 'prod',
      lambdaFunctions: mockLambdaFunctions,
      dynamodbTables: mockDynamodbTables,
      s3Buckets: mockS3Buckets,
      apiGateway: mockApiGateway,
    });

    // CloudFormationテンプレートを取得
    const template = Template.fromStack(stack);

    // ダッシュボード名に環境名が含まれていることを確認
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'tdnet-collector-prod',
    });
  });
});

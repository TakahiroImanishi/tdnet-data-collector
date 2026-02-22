/**
 * Step Functions Collector Construct
 * 
 * TDnetデータ収集ワークフローをStep Functionsで実装するConstruct。
 * 長時間実行対応、処理の可視化、柔軟なエラーハンドリングを実現。
 * 
 * 関連ドキュメント:
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-state-machine.json
 * - .kiro/steering/core/tdnet-implementation-rules.md
 * - .kiro/steering/infrastructure/cdk-implementation.md
 */

import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * Step Functions Collector Constructのプロパティ
 */
export interface StepFunctionsCollectorProps {
  /**
   * Collector-Init Lambda関数
   */
  collectorInitFunction: lambda.IFunction;

  /**
   * Collector-Fetch Lambda関数
   */
  collectorFetchFunction: lambda.IFunction;

  /**
   * Collector-Save Lambda関数
   */
  collectorSaveFunction: lambda.IFunction;

  /**
   * Collector-Aggregate Lambda関数
   */
  collectorAggregateFunction: lambda.IFunction;

  /**
   * CloudWatch Logsのログ保持期間（日数）
   * @default 30日
   */
  logRetentionDays?: logs.RetentionDays;
}

/**
 * Step Functions Collector Construct
 * 
 * TDnetデータ収集ワークフローをStep Functionsで実装。
 * Standard Workflowsを使用し、最大1年間の実行時間に対応。
 */
export class StepFunctionsCollector extends Construct {
  /**
   * Step Functionsステートマシン
   */
  public readonly stateMachine: sfn.StateMachine;

  /**
   * CloudWatch Logsロググループ
   */
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: StepFunctionsCollectorProps) {
    super(scope, id);

    // CloudWatch Logsロググループ作成
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: '/aws/vendedlogs/states/tdnet-collector',
      retention: props.logRetentionDays ?? logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用（本番環境ではRETAINに変更）
    });

    // ステートマシン定義
    const definition = this.createDefinition(props);

    // ステートマシン作成
    this.stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      stateMachineName: 'tdnet-collector-workflow',
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.hours(1), // 1時間（大量データ収集に対応）
      tracingEnabled: true, // X-Ray有効化
      logs: {
        destination: this.logGroup,
        level: sfn.LogLevel.ALL, // すべてのログを記録
        includeExecutionData: true, // 実行データを含める
      },
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'Step Functions State Machine ARN',
      exportName: 'TdnetCollectorStateMachineArn',
    });

    new cdk.CfnOutput(this, 'StateMachineName', {
      value: this.stateMachine.stateMachineName,
      description: 'Step Functions State Machine Name',
      exportName: 'TdnetCollectorStateMachineName',
    });
  }

  /**
   * ステートマシン定義を作成
   * 
   * @param props Constructプロパティ
   * @returns ステートマシン定義
   */
  private createDefinition(props: StepFunctionsCollectorProps): sfn.IChainable {
    // 1. 初期化ステップ
    const initTask = new tasks.LambdaInvoke(this, 'Initialize', {
      lambdaFunction: props.collectorInitFunction,
      payload: sfn.TaskInput.fromObject({
        'start_date.$': '$.start_date',
        'end_date.$': '$.end_date',
        'max_items.$': '$.max_items',
      }),
      resultPath: '$.initResult',
      resultSelector: {
        'execution_id.$': '$.Payload.execution_id',
        'total_count.$': '$.Payload.total_count',
        'pages.$': '$.Payload.pages',
        'parameters.$': '$.Payload.parameters',
      },
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(30)),
      retryOnServiceExceptions: true,
    });

    // 初期化エラーハンドリング
    initTask.addRetry({
      errors: ['States.TaskFailed'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    const handleInitError = new sfn.Pass(this, 'HandleInitializationError', {
      parameters: {
        'execution_id.$': '$.initResult.execution_id',
        status: 'initialization_failed',
        'error.$': '$.error',
      },
    });

    const collectionFailed = new sfn.Fail(this, 'CollectionFailed', {
      error: 'CollectionFailed',
      cause: 'データ収集処理が失敗しました。詳細はCloudWatch Logsを確認してください。',
    });

    initTask.addCatch(handleInitError, {
      errors: ['ValidationError', 'AuthenticationError'],
      resultPath: '$.error',
    });

    initTask.addCatch(handleInitError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    handleInitError.next(collectionFailed);

    // 2. 総件数チェック
    const checkTotalCount = new sfn.Choice(this, 'CheckTotalCount', {
      comment: '取得件数が0件の場合は処理をスキップ',
    });

    const noDataToCollect = new sfn.Succeed(this, 'NoDataToCollect', {
      comment: '取得対象データが0件のため正常終了',
    });

    // 3. ページごとのデータ取得・保存（Map状態）
    const fetchPageData = new tasks.LambdaInvoke(this, 'FetchPageData', {
      lambdaFunction: props.collectorFetchFunction,
      payload: sfn.TaskInput.fromObject({
        'page_number.$': '$.page_number',
        'start_date.$': '$.start_date',
        'end_date.$': '$.end_date',
        'max_items.$': '$.max_items',
        'execution_id.$': '$.execution_id',
      }),
      resultPath: '$.fetchResult',
      resultSelector: {
        'page_number.$': '$.Payload.page_number',
        'items.$': '$.Payload.items',
        'count.$': '$.Payload.count',
      },
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(60)),
      retryOnServiceExceptions: true,
    });

    // Fetchエラーハンドリング
    fetchPageData.addRetry({
      errors: ['RateLimitError'],
      interval: cdk.Duration.seconds(1),
      maxAttempts: 5,
      backoffRate: 1.0,
    });

    fetchPageData.addRetry({
      errors: ['States.TaskFailed'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    const fetchFailed = new sfn.Pass(this, 'FetchFailed', {
      comment: 'データ取得失敗を記録',
      parameters: {
        'page_number.$': '$.page_number',
        status: 'fetch_failed',
        'error.$': '$.error',
      },
    });

    const pageFailed = new sfn.Succeed(this, 'PageFailed', {
      comment: 'ページ処理失敗（Map全体は継続）',
    });

    fetchPageData.addCatch(fetchFailed, {
      errors: ['AuthenticationError'],
      resultPath: '$.error',
    });

    fetchPageData.addCatch(fetchFailed, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    fetchFailed.next(pageFailed);

    // 4. データ保存ステップ
    const savePageData = new tasks.LambdaInvoke(this, 'SavePageData', {
      lambdaFunction: props.collectorSaveFunction,
      payload: sfn.TaskInput.fromObject({
        'items.$': '$.fetchResult.items',
        'page_number.$': '$.fetchResult.page_number',
        'execution_id.$': '$.execution_id',
      }),
      resultPath: '$.saveResult',
      resultSelector: {
        'page_number.$': '$.Payload.page_number',
        'saved_count.$': '$.Payload.saved_count',
        'failed_count.$': '$.Payload.failed_count',
        'failed_items.$': '$.Payload.failed_items',
      },
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(120)),
      retryOnServiceExceptions: true,
    });

    // Saveエラーハンドリング
    savePageData.addRetry({
      errors: ['DynamoDB.ProvisionedThroughputExceededException', 'DynamoDB.ThrottlingException'],
      interval: cdk.Duration.seconds(1),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    savePageData.addRetry({
      errors: ['States.TaskFailed'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    const saveFailed = new sfn.Pass(this, 'SaveFailed', {
      comment: 'データ保存失敗を記録（部分的失敗を許容）',
      parameters: {
        'page_number.$': '$.page_number',
        status: 'save_failed',
        'saved_count.$': '$.saveResult.saved_count',
        'failed_count.$': '$.saveResult.failed_count',
        'error.$': '$.error',
      },
    });

    savePageData.addCatch(saveFailed, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    saveFailed.next(pageFailed);

    const pageSuccess = new sfn.Succeed(this, 'PageSuccess', {
      comment: 'ページ処理成功',
    });

    // Fetch → Save → Success
    fetchPageData.next(savePageData);
    savePageData.next(pageSuccess);

    // Map状態（並列処理）
    const processPages = new sfn.Map(this, 'ProcessPages', {
      comment: 'ページごとのデータ取得・保存を並列実行（最大5並列）',
      itemsPath: '$.initResult.pages',
      maxConcurrency: 5,
      resultPath: '$.processResults',
      itemSelector: {
        'page_number.$': '$$.Map.Item.Value',
        'execution_id.$': '$.initResult.execution_id',
        'start_date.$': '$.start_date',
        'end_date.$': '$.end_date',
        'max_items.$': '$.max_items',
      },
    });

    processPages.itemProcessor(fetchPageData);

    // 5. 集約ステップ
    const aggregateResults = new tasks.LambdaInvoke(this, 'AggregateResults', {
      lambdaFunction: props.collectorAggregateFunction,
      payload: sfn.TaskInput.fromObject({
        'execution_id.$': '$.initResult.execution_id',
        'results.$': '$.processResults',
        'total_count.$': '$.initResult.total_count',
        'parameters.$': '$.initResult.parameters',
      }),
      resultPath: '$.aggregateResult',
      resultSelector: {
        'execution_id.$': '$.Payload.execution_id',
        'status.$': '$.Payload.status',
        'total_collected.$': '$.Payload.total_collected',
        'total_failed.$': '$.Payload.total_failed',
        'success_rate.$': '$.Payload.success_rate',
      },
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(30)),
      retryOnServiceExceptions: true,
    });

    aggregateResults.addRetry({
      errors: ['States.TaskFailed'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 3,
      backoffRate: 2.0,
    });

    const handleAggregationError = new sfn.Pass(this, 'HandleAggregationError', {
      comment: '集約エラーを記録（実行状態更新失敗）',
      parameters: {
        'execution_id.$': '$.initResult.execution_id',
        status: 'aggregation_failed',
        'error.$': '$.error',
      },
    });

    aggregateResults.addCatch(handleAggregationError, {
      errors: ['States.ALL'],
      resultPath: '$.error',
    });

    handleAggregationError.next(collectionFailed);

    // Map全体のエラーハンドリング
    processPages.addCatch(aggregateResults, {
      errors: ['States.ALL'],
      resultPath: '$.mapError',
    });

    // 6. 集約結果のステータスチェック
    const checkAggregateStatus = new sfn.Choice(this, 'CheckAggregateStatus', {
      comment: '集約結果のステータスに応じて分岐',
    });

    const collectionSuccess = new sfn.Succeed(this, 'CollectionSuccess', {
      comment: 'データ収集完全成功',
    });

    const partialSuccess = new sfn.Succeed(this, 'PartialSuccess', {
      comment: 'データ収集部分的成功（一部失敗あり）',
    });

    // ワークフロー定義
    const definition = initTask
      .next(checkTotalCount
        .when(
          sfn.Condition.numberGreaterThan('$.initResult.total_count', 0),
          processPages
            .next(aggregateResults)
            .next(checkAggregateStatus
              .when(
                sfn.Condition.stringEquals('$.aggregateResult.status', 'completed'),
                collectionSuccess
              )
              .when(
                sfn.Condition.stringEquals('$.aggregateResult.status', 'partial_success'),
                partialSuccess
              )
              .otherwise(collectionFailed)
            )
        )
        .otherwise(noDataToCollect)
      );

    return definition;
  }
}

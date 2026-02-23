import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * ExecutionStateTableConstruct - Step Functions実行状態管理テーブル
 *
 * Step Functionsワークフローの実行状態を追跡・管理するDynamoDBテーブル。
 * 進捗率、収集件数、エラー情報などをリアルタイムで記録します。
 *
 * 関連ドキュメント:
 * - .kiro/specs/tdnet-data-collector/designs/step-functions-architecture.md
 * - .kiro/steering/infrastructure/cdk-implementation.md
 */
export interface ExecutionStateTableProps {
  /**
   * 環境名（dev, prod等）
   */
  environment: string;

  /**
   * テーブルの削除ポリシー
   * @default cdk.RemovalPolicy.RETAIN
   */
  removalPolicy?: cdk.RemovalPolicy;
}

export class ExecutionStateTableConstruct extends Construct {
  /**
   * 実行状態管理テーブル
   */
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ExecutionStateTableProps) {
    super(scope, id);

    const { environment, removalPolicy = cdk.RemovalPolicy.RETAIN } = props;

    // テーブル名生成
    const tableName = `ExecutionState_${environment}`;

    // 実行状態管理テーブル作成
    this.table = new dynamodb.Table(this, 'Table', {
      tableName,
      partitionKey: {
        name: 'execution_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy,
    });

    // タグ付け
    cdk.Tags.of(this.table).add('Purpose', 'StepFunctionsExecutionState');
    cdk.Tags.of(this.table).add('Environment', environment);

    // CloudFormation出力
    new cdk.CfnOutput(this, 'TableName', {
      value: this.table.tableName,
      description: 'Step Functions実行状態管理テーブル名',
      exportName: `ExecutionStateTableName-${environment}`,
    });

    new cdk.CfnOutput(this, 'TableArn', {
      value: this.table.tableArn,
      description: 'Step Functions実行状態管理テーブルARN',
      exportName: `ExecutionStateTableArn-${environment}`,
    });
  }
}

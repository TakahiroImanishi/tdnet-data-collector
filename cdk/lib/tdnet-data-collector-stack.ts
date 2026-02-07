import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class TdnetDataCollectorStack extends cdk.Stack {
  // Public properties for cross-stack references
  public readonly disclosuresTable: dynamodb.Table;
  public readonly executionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // Phase 1: DynamoDB Tables
    // ========================================

    // 1. tdnet_disclosures - 開示情報メタデータテーブル
    this.disclosuresTable = new dynamodb.Table(this, 'DisclosuresTable', {
      tableName: 'tdnet_disclosures',
      partitionKey: {
        name: 'disclosure_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理キーで暗号化
      pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // GSI: CompanyCode_DiscloseDate - 企業コードと開示日時でクエリ
    this.disclosuresTable.addGlobalSecondaryIndex({
      indexName: 'GSI_CompanyCode_DiscloseDate',
      partitionKey: {
        name: 'company_code',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL, // すべての属性を投影
    });

    // GSI: DatePartition - 月単位の効率的なクエリ（YYYY-MM形式）
    this.disclosuresTable.addGlobalSecondaryIndex({
      indexName: 'GSI_DatePartition',
      partitionKey: {
        name: 'date_partition',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'disclosed_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. tdnet_executions - 実行状態管理テーブル
    this.executionsTable = new dynamodb.Table(this, 'ExecutionsTable', {
      tableName: 'tdnet_executions',
      partitionKey: {
        name: 'execution_id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // オンデマンドモード
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS管理キーで暗号化
      timeToLiveAttribute: 'ttl', // TTL有効化（30日後に自動削除）
      pointInTimeRecovery: true, // ポイントインタイムリカバリ有効化
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 本番環境では削除保護
    });

    // GSI: Status_StartedAt - 実行状態と開始日時でクエリ
    this.executionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI_Status_StartedAt',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'started_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DisclosuresTableName', {
      value: this.disclosuresTable.tableName,
      description: 'DynamoDB table name for disclosures',
      exportName: 'TdnetDisclosuresTableName',
    });

    new cdk.CfnOutput(this, 'ExecutionsTableName', {
      value: this.executionsTable.tableName,
      description: 'DynamoDB table name for executions',
      exportName: 'TdnetExecutionsTableName',
    });

    // Stack resources will be added here in subsequent tasks
    // Phase 1: S3 buckets, Lambda functions
    // Phase 2: API Gateway, Lambda Query/Export functions
    // Phase 3: EventBridge rules, SNS topics, CloudWatch monitoring
    // Phase 4: CloudTrail, WAF, security configurations
  }
}

import * as cdk from 'aws-cdk-lib';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * CloudTrail Construct Properties
 */
export interface CloudTrailConstructProps {
  /**
   * S3 bucket for CloudTrail logs
   */
  readonly logsBucket: s3.IBucket;

  /**
   * Environment name (dev, staging, prod)
   */
  readonly environment: string;

  /**
   * S3 bucket for PDF files (to track data events)
   */
  readonly pdfsBucket?: s3.IBucket;

  /**
   * DynamoDB tables to track (optional)
   */
  readonly dynamodbTables?: cdk.aws_dynamodb.ITable[];
}

/**
 * CloudTrail Construct
 * 
 * AWS CloudTrailを設定し、以下を記録：
 * - すべてのAPI呼び出し（管理イベント）
 * - S3データイベント（PDFバケット）
 * - DynamoDBデータイベント
 * - CloudWatch Logsへの送信
 * 
 * Requirements: 要件13.2（監査ログ）
 */
export class CloudTrailConstruct extends Construct {
  public readonly trail: cloudtrail.Trail;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: CloudTrailConstructProps) {
    super(scope, id);

    // CloudWatch Logs ロググループ作成
    this.logGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
      logGroupName: `/aws/cloudtrail/tdnet-audit-trail-${props.environment}`,
      retention: logs.RetentionDays.ONE_YEAR, // 1年間保持
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 削除保護
    });

    // CloudTrail証跡作成
    this.trail = new cloudtrail.Trail(this, 'AuditTrail', {
      trailName: `tdnet-audit-trail-${props.environment}`,
      bucket: props.logsBucket,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: this.logGroup,
      enableFileValidation: true, // ログファイルの整合性検証
      includeGlobalServiceEvents: true, // IAM、CloudFrontなどのグローバルサービスイベントを記録
      isMultiRegionTrail: false, // 単一リージョン（コスト最適化）
      managementEvents: cloudtrail.ReadWriteType.ALL, // すべての管理イベントを記録
    });

    // S3データイベント記録（PDFバケット）
    if (props.pdfsBucket) {
      this.trail.addS3EventSelector(
        [
          {
            bucket: props.pdfsBucket,
            objectPrefix: '', // すべてのオブジェクト
          },
        ],
        {
          readWriteType: cloudtrail.ReadWriteType.ALL, // 読み取り・書き込み両方
          includeManagementEvents: false, // 管理イベントは既に記録済み
        }
      );
    }

    // DynamoDBデータイベント記録
    if (props.dynamodbTables && props.dynamodbTables.length > 0) {
      // CloudTrailはDynamoDBテーブルのARNを直接指定する必要がある
      const tableArns = props.dynamodbTables.map((table) => table.tableArn);

      // カスタムポリシーでDynamoDBデータイベントを記録
      const cfnTrail = this.trail.node.defaultChild as cloudtrail.CfnTrail;
      cfnTrail.eventSelectors = [
        ...(cfnTrail.eventSelectors || []),
        {
          readWriteType: 'All',
          includeManagementEvents: false,
          dataResources: [
            {
              type: 'AWS::DynamoDB::Table',
              values: tableArns,
            },
          ],
        },
      ];
    }

    // CloudWatch Logsへの書き込み権限をCloudTrailに付与
    this.logGroup.grantWrite(
      new iam.ServicePrincipal('cloudtrail.amazonaws.com')
    );

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'TrailArn', {
      value: this.trail.trailArn,
      description: 'CloudTrail ARN',
      exportName: `TdnetCloudTrailArn-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'LogGroupName', {
      value: this.logGroup.logGroupName,
      description: 'CloudTrail CloudWatch Logs group name',
      exportName: `TdnetCloudTrailLogGroupName-${props.environment}`,
    });
  }
}

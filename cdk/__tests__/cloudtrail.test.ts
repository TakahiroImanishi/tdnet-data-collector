import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('CloudTrail Configuration', () => {
  let app: cdk.App;
  let stack: TdnetDataCollectorStack;
  let template: Template;
  const testAccountId = '123456789012';

  beforeEach(() => {
    app = new cdk.App();
    stack = new TdnetDataCollectorStack(app, 'TestStack', {
      env: {
        account: testAccountId,
        region: 'ap-northeast-1',
      },
      environmentConfig: {
        environment: 'dev',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('CloudTrail Trail', () => {
    it('should create CloudTrail trail with correct name', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        TrailName: 'tdnet-audit-trail-dev',
      });
    });

    it('should enable file validation', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        EnableLogFileValidation: true,
      });
    });

    it('should include global service events', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        IncludeGlobalServiceEvents: true,
      });
    });

    it('should be single-region trail for cost optimization', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        IsMultiRegionTrail: false,
      });
    });

    it('should send logs to CloudWatch Logs', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        CloudWatchLogsLogGroupArn: Match.anyValue(),
        CloudWatchLogsRoleArn: Match.anyValue(),
      });
    });

    it('should use CloudTrail logs bucket', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        S3BucketName: Match.objectLike({
          Ref: Match.stringLikeRegexp('CloudTrailLogsBucket'),
        }),
      });
    });
  });

  describe('CloudWatch Logs Integration', () => {
    it('should create CloudWatch Logs group', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/cloudtrail/tdnet-audit-trail-dev',
        RetentionInDays: 365, // 1年間保持
      });
    });

    it('should have RETAIN removal policy', () => {
      const logGroups = template.findResources('AWS::Logs::LogGroup', {
        Properties: {
          LogGroupName: '/aws/cloudtrail/tdnet-audit-trail-dev',
        },
        DeletionPolicy: 'Retain',
      });

      expect(Object.keys(logGroups).length).toBeGreaterThan(0);
    });
  });

  describe('Data Events', () => {
    it('should record S3 data events for PDFs bucket', () => {
      // S3データイベントセレクターを確認
      const trails = template.findResources('AWS::CloudTrail::Trail');
      const trailKey = Object.keys(trails)[0];
      const trail = trails[trailKey];

      // EventSelectorsが存在することを確認
      expect(trail.Properties.EventSelectors).toBeDefined();
      expect(trail.Properties.EventSelectors.length).toBeGreaterThan(0);

      // S3データイベントセレクターを探す
      const s3Selector = trail.Properties.EventSelectors.find(
        (selector: any) =>
          selector.DataResources &&
          selector.DataResources.some((dr: any) => dr.Type === 'AWS::S3::Object')
      );

      expect(s3Selector).toBeDefined();
      expect(s3Selector.ReadWriteType).toBe('All');
    });

    it('should record DynamoDB data events', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        EventSelectors: Match.arrayWith([
          Match.objectLike({
            DataResources: Match.arrayWith([
              Match.objectLike({
                Type: 'AWS::DynamoDB::Table',
                Values: Match.arrayWith([
                  Match.objectLike({
                    'Fn::GetAtt': Match.arrayWith([
                      Match.stringLikeRegexp('DisclosuresTable'),
                      'Arn',
                    ]),
                  }),
                ]),
              }),
            ]),
            ReadWriteType: 'All',
          }),
        ]),
      });
    });

    it('should record all three DynamoDB tables', () => {
      const trails = template.findResources('AWS::CloudTrail::Trail');
      const trailKey = Object.keys(trails)[0];
      const trail = trails[trailKey];

      // DynamoDBデータイベントセレクターを探す
      const dynamodbSelector = trail.Properties.EventSelectors.find(
        (selector: any) =>
          selector.DataResources &&
          selector.DataResources.some((dr: any) => dr.Type === 'AWS::DynamoDB::Table')
      );

      expect(dynamodbSelector).toBeDefined();

      // 3つのテーブルが記録されていることを確認
      const dynamodbResource = dynamodbSelector.DataResources.find(
        (dr: any) => dr.Type === 'AWS::DynamoDB::Table'
      );

      expect(dynamodbResource.Values).toHaveLength(3);
    });
  });

  describe('Management Events', () => {
    it('should record all management events', () => {
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        EventSelectors: Match.arrayWith([
          Match.objectLike({
            IncludeManagementEvents: true,
            ReadWriteType: 'All',
          }),
        ]),
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('should export CloudTrail ARN', () => {
      template.hasOutput('CloudTrailArn', {
        Export: {
          Name: 'TdnetCloudTrailArn-dev',
        },
      });
    });

    it('should export CloudTrail Log Group name', () => {
      template.hasOutput('CloudTrailLogGroupName', {
        Export: {
          Name: 'TdnetCloudTrailLogGroupName-dev',
        },
      });
    });

    it('should export CloudTrail Logs Bucket name', () => {
      template.hasOutput('CloudTrailLogsBucketName', {
        Value: {
          Ref: Match.stringLikeRegexp('CloudTrailLogsBucket'),
        },
        Export: {
          Name: 'TdnetCloudTrailLogsBucketName',
        },
      });
    });
  });

  describe('Security Requirements', () => {
    it('should meet requirement 13.2 - audit logging', () => {
      // CloudTrailが有効化されていることを確認
      const trails = template.findResources('AWS::CloudTrail::Trail');
      expect(Object.keys(trails).length).toBeGreaterThan(0);

      // CloudWatch Logsへの送信が有効化されていることを確認
      template.hasResourceProperties('AWS::CloudTrail::Trail', {
        CloudWatchLogsLogGroupArn: Match.anyValue(),
      });
    });

    it('should meet requirement 13.3 - encryption at rest', () => {
      // S3バケットの暗号化を確認
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            },
          ],
        },
      });

      // DynamoDBテーブルの暗号化を確認
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        SSESpecification: {
          SSEEnabled: true,
        },
      });
    });
  });

  describe('Lifecycle Policy', () => {
    it('should transition to Glacier after 90 days', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Status: 'Enabled',
              Transitions: Match.arrayWith([
                Match.objectLike({
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90,
                }),
              ]),
            }),
          ]),
        },
      });
    });

    it('should delete after 7 years (2555 days)', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Status: 'Enabled',
              ExpirationInDays: 2555, // 7年 = 365 * 7 = 2555日
            }),
          ]),
        },
      });
    });
  });

  describe('Property 14: Encryption Effectiveness', () => {
    it('should verify CloudTrail is enabled', () => {
      const trails = template.findResources('AWS::CloudTrail::Trail');
      expect(Object.keys(trails).length).toBeGreaterThan(0);
    });

    it('should verify S3 bucket encryption is enabled', () => {
      // すべてのS3バケットを取得
      const buckets = template.findResources('AWS::S3::Bucket');

      // PDFバケットを探す
      const pdfsBucket = Object.values(buckets).find((bucket: any) => {
        const bucketName = bucket.Properties.BucketName;
        if (typeof bucketName === 'string') {
          return bucketName.includes('tdnet-data-collector-pdfs');
        } else if (bucketName && bucketName['Fn::Join']) {
          // CloudFormation関数の場合、文字列表現を確認
          const joinParts = bucketName['Fn::Join'][1];
          return joinParts.some((part: any) => 
            typeof part === 'string' && part.includes('tdnet-data-collector-pdfs')
          );
        }
        return false;
      });

      expect(pdfsBucket).toBeDefined();
      expect(pdfsBucket.Properties.BucketEncryption).toBeDefined();
      expect(pdfsBucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration).toBeDefined();

      // CloudTrailログバケット
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        BucketEncryption: Match.objectLike({
          ServerSideEncryptionConfiguration: Match.arrayWith([
            Match.objectLike({
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
            }),
          ]),
        }),
      });
    });

    it('should verify DynamoDB table encryption is enabled', () => {
      // disclosuresテーブル
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_disclosures_dev',
        SSESpecification: {
          SSEEnabled: true,
        },
      });

      // executionsテーブル
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_executions_dev',
        SSESpecification: {
          SSEEnabled: true,
        },
      });

      // exportStatusテーブル
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'tdnet_export_status_dev',
        SSESpecification: {
          SSEEnabled: true,
        },
      });
    });
  });

  describe('Environment Parameterization', () => {
    it('should use environment-specific trail name for prod', () => {
      // 新しいAppインスタンスを作成（synthesis問題を回避）
      const prodApp = new cdk.App();
      const prodStack = new TdnetDataCollectorStack(prodApp, 'ProdStack', {
        env: {
          account: testAccountId,
          region: 'ap-northeast-1',
        },
        environmentConfig: {
          environment: 'prod',
        },
      });

      const prodTemplate = Template.fromStack(prodStack);

      prodTemplate.hasResourceProperties('AWS::CloudTrail::Trail', {
        TrailName: 'tdnet-audit-trail-prod',
      });
    });

    it('should use environment-specific log group name for dev', () => {
      // 既存のdevスタックを使用
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/cloudtrail/tdnet-audit-trail-dev',
      });
    });
  });
});

  describe('Optional DynamoDB Tables', () => {
    it('should handle empty DynamoDB tables array', () => {
      // CloudTrail Constructを直接テストするため、新しいスタックを作成
      const testApp = new cdk.App();
      const testStack = new cdk.Stack(testApp, 'TestStackNoDynamoDB');
      
      const logsBucket = new cdk.aws_s3.Bucket(testStack, 'LogsBucket');
      
      // DynamoDBテーブルなしでCloudTrail Constructを作成
      const { CloudTrailConstruct } = require('../lib/constructs/cloudtrail');
      new CloudTrailConstruct(testStack, 'CloudTrail', {
        logsBucket,
        environment: 'test',
        dynamodbTables: [], // 空配列
      });

      const testTemplate = Template.fromStack(testStack);
      
      // CloudTrailが作成されていることを確認
      const trails = testTemplate.findResources('AWS::CloudTrail::Trail');
      expect(Object.keys(trails).length).toBe(1);
      
      // DynamoDBデータイベントセレクターが存在しないことを確認
      const trail = trails[Object.keys(trails)[0]];
      const dynamodbSelectors = trail.Properties.EventSelectors?.filter(
        (selector: any) =>
          selector.DataResources &&
          selector.DataResources.some((dr: any) => dr.Type === 'AWS::DynamoDB::Table')
      ) || [];
      
      expect(dynamodbSelectors.length).toBe(0);
    });

    it('should handle undefined DynamoDB tables', () => {
      // CloudTrail Constructを直接テストするため、新しいスタックを作成
      const testApp = new cdk.App();
      const testStack = new cdk.Stack(testApp, 'TestStackNoDynamoDB2');
      
      const logsBucket = new cdk.aws_s3.Bucket(testStack, 'LogsBucket');
      
      // DynamoDBテーブルなしでCloudTrail Constructを作成
      const { CloudTrailConstruct } = require('../lib/constructs/cloudtrail');
      new CloudTrailConstruct(testStack, 'CloudTrail', {
        logsBucket,
        environment: 'test',
        // dynamodbTables: undefined (省略)
      });

      const testTemplate = Template.fromStack(testStack);
      
      // CloudTrailが作成されていることを確認
      const trails = testTemplate.findResources('AWS::CloudTrail::Trail');
      expect(Object.keys(trails).length).toBe(1);
    });

    it('should handle undefined PDFs bucket', () => {
      // CloudTrail Constructを直接テストするため、新しいスタックを作成
      const testApp = new cdk.App();
      const testStack = new cdk.Stack(testApp, 'TestStackNoPdfsBucket');
      
      const logsBucket = new cdk.aws_s3.Bucket(testStack, 'LogsBucket');
      
      // PDFバケットなしでCloudTrail Constructを作成
      const { CloudTrailConstruct } = require('../lib/constructs/cloudtrail');
      new CloudTrailConstruct(testStack, 'CloudTrail', {
        logsBucket,
        environment: 'test',
        // pdfsBucket: undefined (省略)
      });

      const testTemplate = Template.fromStack(testStack);
      
      // CloudTrailが作成されていることを確認
      const trails = testTemplate.findResources('AWS::CloudTrail::Trail');
      expect(Object.keys(trails).length).toBe(1);
      
      // S3データイベントセレクターが存在しないことを確認
      const trail = trails[Object.keys(trails)[0]];
      const s3Selectors = trail.Properties.EventSelectors?.filter(
        (selector: any) =>
          selector.DataResources &&
          selector.DataResources.some((dr: any) => dr.Type === 'AWS::S3::Object')
      ) || [];
      
      expect(s3Selectors.length).toBe(0);
    });
  });

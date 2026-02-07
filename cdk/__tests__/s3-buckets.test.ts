/**
 * S3 Bucket Structure Verification Test
 *
 * Task 4.2: S3バケット構造の検証テスト
 * Requirements: 要件3.5, 12.4, 13.3（ファイルストレージ、コスト最適化、暗号化）
 *
 * このテストは、CDKで定義されたS3バケットが設計通りに構成されていることを検証します。
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('S3 Buckets', () => {
  let template: Template;
  const testAccountId = '123456789012';

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetDataCollectorStack(app, 'TestStack', {
      env: { account: testAccountId, region: 'ap-northeast-1' },
    });
    template = Template.fromStack(stack);
  });

  describe('PDFs Bucket', () => {
    it('should be created with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
      });
    });

    it('should have encryption enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            {
              ServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256', // S3マネージド暗号化
              },
            },
          ],
        },
      });
    });

    it('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('should have lifecycle rules for cost optimization', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToStandardIA',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90, // 90日後にStandard-IAに移行
                },
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 365, // 365日後にGlacierに移行
                },
              ],
            },
          ],
        },
      });
    });
  });

  describe('Exports Bucket', () => {
    it('should be created with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-exports-${testAccountId}`,
      });
    });

    it('should have encryption enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-exports-${testAccountId}`,
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
    });

    it('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-exports-${testAccountId}`,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-exports-${testAccountId}`,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('should have lifecycle rule to delete after 7 days', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-data-collector-exports-${testAccountId}`,
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'DeleteAfter7Days',
              Status: 'Enabled',
              ExpirationInDays: 7, // 7日後に自動削除
            },
          ],
        },
      });
    });
  });

  describe('Dashboard Bucket', () => {
    it('should be created with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-dashboard-${testAccountId}`,
      });
    });

    it('should have encryption enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-dashboard-${testAccountId}`,
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
    });

    it('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-dashboard-${testAccountId}`,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-dashboard-${testAccountId}`,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('should not have lifecycle rules (static files persist)', () => {
      // ダッシュボードバケットはライフサイクルルールを持たない
      const buckets = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: `tdnet-dashboard-${testAccountId}`,
        },
      });

      const bucketKeys = Object.keys(buckets);
      expect(bucketKeys.length).toBe(1);

      const bucket = buckets[bucketKeys[0]];
      expect(bucket.Properties.LifecycleConfiguration).toBeUndefined();
    });
  });

  describe('CloudTrail Logs Bucket', () => {
    it('should be created with correct name', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
      });
    });

    it('should have encryption enabled', () => {
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
    });

    it('should have public access blocked', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('should have versioning enabled', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    it('should have lifecycle rules for compliance', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'ArchiveAndDelete',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90, // 90日後にGlacierに移行
                },
              ],
              ExpirationInDays: 2555, // 7年後に自動削除（コンプライアンス要件）
            },
          ],
        },
      });
    });
  });

  describe('CloudFormation Outputs', () => {
    it('should export PdfsBucketName', () => {
      template.hasOutput('PdfsBucketName', {
        Value: {
          Ref: Match.stringLikeRegexp('PdfsBucket'),
        },
        Export: {
          Name: 'TdnetPdfsBucketName',
        },
      });
    });

    it('should export ExportsBucketName', () => {
      template.hasOutput('ExportsBucketName', {
        Value: {
          Ref: Match.stringLikeRegexp('ExportsBucket'),
        },
        Export: {
          Name: 'TdnetExportsBucketName',
        },
      });
    });

    it('should export DashboardBucketName', () => {
      template.hasOutput('DashboardBucketName', {
        Value: {
          Ref: Match.stringLikeRegexp('DashboardBucket'),
        },
        Export: {
          Name: 'TdnetDashboardBucketName',
        },
      });
    });

    it('should export CloudTrailLogsBucketName', () => {
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

  describe('Security and Compliance', () => {
    it('should have encryption enabled on all buckets', () => {
      // すべてのS3バケットで暗号化が有効化されていることを確認
      const buckets = template.findResources('AWS::S3::Bucket');
      const bucketKeys = Object.keys(buckets);

      expect(bucketKeys.length).toBeGreaterThanOrEqual(4);

      bucketKeys.forEach((key) => {
        const bucket = buckets[key];
        expect(bucket.Properties.BucketEncryption).toBeDefined();
        expect(
          bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration
        ).toBeDefined();
        expect(
          bucket.Properties.BucketEncryption
            .ServerSideEncryptionConfiguration[0].ServerSideEncryptionByDefault
            .SSEAlgorithm
        ).toBe('AES256');
      });
    });

    it('should have public access blocked on all buckets', () => {
      // すべてのS3バケットでパブリックアクセスがブロックされていることを確認
      const buckets = template.findResources('AWS::S3::Bucket');
      const bucketKeys = Object.keys(buckets);

      bucketKeys.forEach((key) => {
        const bucket = buckets[key];
        expect(bucket.Properties.PublicAccessBlockConfiguration).toBeDefined();
        expect(
          bucket.Properties.PublicAccessBlockConfiguration.BlockPublicAcls
        ).toBe(true);
        expect(
          bucket.Properties.PublicAccessBlockConfiguration.BlockPublicPolicy
        ).toBe(true);
        expect(
          bucket.Properties.PublicAccessBlockConfiguration.IgnorePublicAcls
        ).toBe(true);
        expect(
          bucket.Properties.PublicAccessBlockConfiguration
            .RestrictPublicBuckets
        ).toBe(true);
      });
    });

    it('should have versioning enabled on all buckets', () => {
      // すべてのS3バケットでバージョニングが有効化されていることを確認
      const buckets = template.findResources('AWS::S3::Bucket');
      const bucketKeys = Object.keys(buckets);

      bucketKeys.forEach((key) => {
        const bucket = buckets[key];
        expect(bucket.Properties.VersioningConfiguration).toBeDefined();
        expect(bucket.Properties.VersioningConfiguration.Status).toBe(
          'Enabled'
        );
      });
    });

    it('should have lifecycle rules for cost optimization', () => {
      // PDFバケットとCloudTrailログバケットにライフサイクルルールが設定されていることを確認
      const pdfsBucket = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: `tdnet-data-collector-pdfs-${testAccountId}`,
        },
      });

      const cloudtrailBucket = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: `tdnet-cloudtrail-logs-${testAccountId}`,
        },
      });

      const pdfsBucketKey = Object.keys(pdfsBucket)[0];
      const cloudtrailBucketKey = Object.keys(cloudtrailBucket)[0];

      expect(
        pdfsBucket[pdfsBucketKey].Properties.LifecycleConfiguration
      ).toBeDefined();
      expect(
        cloudtrailBucket[cloudtrailBucketKey].Properties.LifecycleConfiguration
      ).toBeDefined();
    });
  });

  describe('Bucket Count', () => {
    it('should have exactly 4 S3 buckets', () => {
      // S3バケットが正確に4つ存在することを確認
      template.resourceCountIs('AWS::S3::Bucket', 4);
    });
  });
});

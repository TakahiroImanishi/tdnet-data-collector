/**
 * S3ライフサイクルポリシーのテスト
 *
 * タスク24.1: S3ライフサイクルポリシーの最適化
 * - PDFバケット: 90日後にStandard-IA、365日後にGlacier
 * - エクスポートバケット: 7日後に自動削除
 * - CloudTrailログバケット: 90日後にGlacier、7年後に削除
 */

import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TdnetFoundationStack } from '../lib/stacks/foundation-stack';

describe('S3ライフサイクルポリシー', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new TdnetFoundationStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-northeast-1' },
      environment: 'dev',
    });
    template = Template.fromStack(stack);
  });

  describe('PDFバケット', () => {
    test('90日後にStandard-IAに移行', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-pdfs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'TransitionToStandardIA',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90,
                },
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 365,
                },
              ],
            },
          ],
        },
      });
    });

    test('365日後にGlacierに移行', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-pdfs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90,
                },
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 365,
                },
              ],
            },
          ],
        },
      });
    });

    test('バージョニングが有効', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-pdfs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });

    test('暗号化が有効', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-pdfs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
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
  });

  describe('エクスポートバケット', () => {
    test('7日後に自動削除', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-exports-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'DeleteAfter7Days',
              Status: 'Enabled',
              ExpirationInDays: 7,
            },
          ],
        },
      });
    });

    test('バージョニングが有効', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-exports-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });
  });

  describe('CloudTrailログバケット', () => {
    test('90日後にGlacierに移行', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-cloudtrail-logs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'ArchiveAndDelete',
              Status: 'Enabled',
              Transitions: [
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 90,
                },
              ],
              ExpirationInDays: 2555, // 7年後に削除
            },
          ],
        },
      });
    });

    test('7年後に自動削除', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-cloudtrail-logs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              ExpirationInDays: 2555, // 7年 = 365 * 7 = 2555日
            },
          ],
        },
      });
    });
  });

  describe('ダッシュボードバケット', () => {
    test('ライフサイクルポリシーなし（永続保存）', () => {
      // ダッシュボードバケットにはライフサイクルポリシーが設定されていないことを確認
      const buckets = template.findResources('AWS::S3::Bucket', {
        Properties: {
          BucketName: {
            'Fn::Join': [
              '',
              [
                'tdnet-dashboard-dev-',
                { Ref: 'AWS::AccountId' },
              ],
            ],
          },
        },
      });

      const bucketKeys = Object.keys(buckets);
      expect(bucketKeys.length).toBe(1);

      const bucket = buckets[bucketKeys[0]];
      expect(bucket.Properties.LifecycleConfiguration).toBeUndefined();
    });

    test('バージョニングが有効', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-dashboard-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      });
    });
  });

  describe('セキュリティ設定', () => {
    test('すべてのバケットでパブリックアクセスブロック', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const bucketKeys = Object.keys(buckets);

      bucketKeys.forEach((key) => {
        const bucket = buckets[key];
        expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual({
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        });
      });
    });

    test('すべてのバケットで暗号化が有効', () => {
      const buckets = template.findResources('AWS::S3::Bucket');
      const bucketKeys = Object.keys(buckets);

      bucketKeys.forEach((key) => {
        const bucket = buckets[key];
        expect(bucket.Properties.BucketEncryption).toBeDefined();
        expect(
          bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration
        ).toBeDefined();
      });
    });
  });

  describe('コスト最適化', () => {
    test('PDFバケットのライフサイクルポリシーでストレージコスト削減', () => {
      // 90日後にStandard-IA（約50%コスト削減）
      // 365日後にGlacier（約80%コスト削減）
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-pdfs-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              Transitions: [
                {
                  StorageClass: 'STANDARD_IA',
                  TransitionInDays: 90,
                },
                {
                  StorageClass: 'GLACIER',
                  TransitionInDays: 365,
                },
              ],
            },
          ],
        },
      });
    });

    test('エクスポートバケットの自動削除で不要なストレージコスト削減', () => {
      // 7日後に自動削除（一時ファイルの長期保存を防止）
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: {
          'Fn::Join': [
            '',
            [
              'tdnet-data-collector-exports-dev-',
              { Ref: 'AWS::AccountId' },
            ],
          ],
        },
        LifecycleConfiguration: {
          Rules: [
            {
              ExpirationInDays: 7,
            },
          ],
        },
      });
    });
  });
});

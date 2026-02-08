import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { DashboardCloudFront } from '../lib/constructs/cloudfront';

describe('DashboardCloudFront Construct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let dashboardBucket: s3.IBucket;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });

    // テスト用のS3バケットを作成
    dashboardBucket = new s3.Bucket(stack, 'TestDashboardBucket', {
      bucketName: 'test-dashboard-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  });

  test('CloudFront Distributionが作成される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('Origin Access Identity (OAI) が作成される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::CloudFront::CloudFrontOriginAccessIdentity', 1);
    
    template.hasResourceProperties('AWS::CloudFront::CloudFrontOriginAccessIdentity', {
      CloudFrontOriginAccessIdentityConfig: {
        Comment: 'OAI for TDnet Dashboard (test)',
      },
    });
  });

  test('S3バケットポリシーにOAIからの読み取り権限が追加される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
            Principal: {
              CanonicalUser: Match.anyValue(),
            },
            Resource: Match.anyValue(),
          }),
        ]),
      },
    });
  });

  test('HTTPS強制が設定される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'redirect-to-https',
        },
      },
    });
  });

  test('index.html用のキャッシュポリシーが作成される（TTL: 60秒）', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: {
        Name: 'tdnet-dashboard-index-test',
        DefaultTTL: 60,
        MinTTL: 0,
        MaxTTL: 60,
      },
    });
  });

  test('静的アセット用のキャッシュポリシーが作成される（TTL: 1日）', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: {
        Name: 'tdnet-dashboard-assets-test',
        DefaultTTL: 86400, // 1日 = 86400秒
        MinTTL: 0,
        MaxTTL: 31536000, // 365日
      },
    });
  });

  test('静的アセット用の追加ビヘイビアが設定される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: '/static/*',
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
          Match.objectLike({
            PathPattern: '*.js',
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
          Match.objectLike({
            PathPattern: '*.css',
            ViewerProtocolPolicy: 'redirect-to-https',
          }),
        ]),
      },
    });
  });

  test('SPA用エラーページ設定（404/403 → index.html）が設定される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        CustomErrorResponses: Match.arrayWith([
          {
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
            ErrorCachingMinTTL: 60,
          },
          {
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
            ErrorCachingMinTTL: 60,
          },
        ]),
      },
    });
  });

  test('デフォルトルートオブジェクトがindex.htmlに設定される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
      },
    });
  });

  test('圧縮が有効化される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          Compress: true,
        },
      },
    });
  });

  test('価格クラスがPRICE_CLASS_100に設定される（コスト最適化）', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        PriceClass: 'PriceClass_100',
      },
    });
  });

  test('HTTP/2とHTTP/3が有効化される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        HttpVersion: 'http2and3',
      },
    });
  });

  test('最小TLSバージョンがTLSv1.2に設定される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        ViewerCertificate: {
          MinimumProtocolVersion: 'TLSv1.2_2021',
        },
      },
    });
  });

  test('CloudFront Distribution URLがCfnOutputとして出力される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    template.hasOutput('TestCloudFrontDistributionDomainName*', {
      Description: 'CloudFront Distribution Domain Name',
      Export: {
        Name: 'tdnet-dashboard-domain-test',
      },
    });

    template.hasOutput('TestCloudFrontDistributionId*', {
      Description: 'CloudFront Distribution ID',
      Export: {
        Name: 'tdnet-dashboard-distribution-id-test',
      },
    });

    template.hasOutput('TestCloudFrontDashboardUrl*', {
      Description: 'TDnet Dashboard URL',
      Export: {
        Name: 'tdnet-dashboard-url-test',
      },
    });
  });

  test('Gzip圧縮とBrotli圧縮が有効化される', () => {
    // Arrange & Act
    new DashboardCloudFront(stack, 'TestCloudFront', {
      dashboardBucket,
      environment: 'test',
    });

    // Assert
    const template = Template.fromStack(stack);
    
    // キャッシュポリシーでGzipとBrotliが有効化されていることを確認
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: {
        ParametersInCacheKeyAndForwardedToOrigin: {
          EnableAcceptEncodingGzip: true,
          EnableAcceptEncodingBrotli: true,
        },
      },
    });
  });
});

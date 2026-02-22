import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

/**
 * CloudFront Distribution Constructのプロパティ
 */
export interface DashboardCloudFrontProps {
  /**
   * ダッシュボードのS3バケット
   */
  readonly dashboardBucket: s3.IBucket;

  /**
   * 環境名（dev, prod等）
   */
  readonly environment: string;
}

/**
 * TDnet Dashboard用CloudFront Distribution Construct
 * 
 * 機能:
 * - S3バケットへのOAI（Origin Access Identity）アクセス
 * - HTTPS強制
 * - キャッシュ最適化（index.html: 1分、その他: 1日）
 * - エラーページ設定（404 → index.html for SPA routing）
 */
export class DashboardCloudFront extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly originAccessIdentity: cloudfront.OriginAccessIdentity;

  constructor(scope: Construct, id: string, props: DashboardCloudFrontProps) {
    super(scope, id);

    // Origin Access Identity (OAI) を作成
    // S3バケットへの直接アクセスを防ぎ、CloudFront経由のみ許可
    this.originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for TDnet Dashboard (${props.environment})`,
    });

    // S3バケットポリシーにOAIからの読み取りを許可
    props.dashboardBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [props.dashboardBucket.arnForObjects('*')],
        principals: [
          new iam.CanonicalUserPrincipal(
            this.originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId
          ),
        ],
      })
    );

    // index.html用のキャッシュポリシー（短いTTL: 1分）
    const indexCachePolicy = new cloudfront.CachePolicy(this, 'IndexCachePolicy', {
      cachePolicyName: `tdnet-dashboard-index-${props.environment}`,
      comment: 'Cache policy for index.html with short TTL',
      defaultTtl: cdk.Duration.seconds(60),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(60),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // 静的アセット用のキャッシュポリシー（長いTTL: 1日）
    const assetsCachePolicy = new cloudfront.CachePolicy(this, 'AssetsCachePolicy', {
      cachePolicyName: `tdnet-dashboard-assets-${props.environment}`,
      comment: 'Cache policy for static assets with long TTL',
      defaultTtl: cdk.Duration.days(1),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.days(365),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // CloudFront Distribution作成
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `TDnet Dashboard Distribution (${props.environment})`,
      defaultRootObject: 'index.html',
      
      // S3オリジン設定
      defaultBehavior: {
        origin: new origins.S3Origin(props.dashboardBucket, {
          originAccessIdentity: this.originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: indexCachePolicy,
        compress: true,
      },

      // 静的アセット用の追加ビヘイビア
      additionalBehaviors: {
        '/static/*': {
          origin: new origins.S3Origin(props.dashboardBucket, {
            originAccessIdentity: this.originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: assetsCachePolicy,
          compress: true,
        },
        '*.js': {
          origin: new origins.S3Origin(props.dashboardBucket, {
            originAccessIdentity: this.originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: assetsCachePolicy,
          compress: true,
        },
        '*.css': {
          origin: new origins.S3Origin(props.dashboardBucket, {
            originAccessIdentity: this.originAccessIdentity,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: assetsCachePolicy,
          compress: true,
        },
      },

      // SPA用エラーページ設定（404 → index.html）
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(60),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(60),
        },
      ],

      // 価格クラス（コスト最適化: 北米・欧州のみ）
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,

      // HTTPバージョン
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // CloudFront Distribution URLを出力
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `tdnet-dashboard-domain-${props.environment}`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `tdnet-dashboard-distribution-id-${props.environment}`,
    });

    // CloudFront Distribution URLをHTTPS形式で出力
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'TDnet Dashboard URL',
      exportName: `tdnet-dashboard-url-${props.environment}`,
    });

    // CDK Nag抑制: AwsSolutions-CFR4
    // デフォルトのCloudFront証明書を使用する場合、TLS 1.2を強制できない制限がある
    // カスタムドメインとACM証明書を使用する場合は、minimumProtocolVersionでTLS 1.2を強制可能
    // 本番環境では、Route 53 + ACM証明書の使用を推奨
    //
    // 【カスタムドメイン使用時のTLS 1.2強制設定例】
    // 1. Route 53でドメインを登録（例: dashboard.example.com）
    // 2. ACM証明書をus-east-1リージョンで作成（CloudFrontの要件）
    //    aws acm request-certificate \
    //      --domain-name dashboard.example.com \
    //      --validation-method DNS \
    //      --region us-east-1
    // 3. CloudFront Distributionに以下を追加:
    //    domainNames: ['dashboard.example.com'],
    //    certificate: acm.Certificate.fromCertificateArn(this, 'Certificate', 'arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID'),
    //    minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    // 4. Route 53でAレコードを作成してCloudFrontディストリビューションを指定
    NagSuppressions.addResourceSuppressions(
      this.distribution,
      [
        {
          id: 'AwsSolutions-CFR4',
          reason: 'デフォルトのCloudFront証明書を使用。カスタムドメインがない環境では、ACM証明書を使用できないため、デフォルト証明書を使用。本番環境では、Route 53 + ACM証明書でTLS 1.2を強制することを推奨。',
        },
      ],
      true
    );
  }
}

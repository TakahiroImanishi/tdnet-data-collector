/**
 * WAF Construct
 *
 * API Gatewayを保護するWAF Web ACLを提供します。
 * レート制限、AWS Managed Rules、カスタムレスポンスを設定します。
 */

import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { Environment } from '../config/environment-config';

export interface WafConstructProps {
  /** 環境名（dev, prod） */
  environment: Environment;

  /** 保護対象のAPI Gateway */
  api: apigateway.IRestApi;

  /** レート制限（リクエスト/5分）デフォルト: 500（100リクエスト/分相当） */
  rateLimitPerFiveMinutes?: number;
}

/**
 * WAF Construct
 *
 * API Gatewayを保護するWAF Web ACLを作成します。
 *
 * 機能:
 * - レート制限（IP単位）
 * - AWS Managed Rules（Common Rule Set、Known Bad Inputs）
 * - カスタムエラーレスポンス
 */
export class WafConstruct extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: WafConstructProps) {
    super(scope, id);

    const env = props.environment;
    const rateLimit = props.rateLimitPerFiveMinutes || 500; // 100リクエスト/分相当

    // ========================================
    // WAF Web ACL
    // ========================================

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `tdnet-web-acl-${env}`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      description: 'Web ACL for TDnet Data Collector API',
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'TdnetWebAcl',
      },
      rules: [
        // レート制限ルール
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: rateLimit,
              aggregateKeyType: 'IP',
            },
          },
          action: {
            block: {
              customResponse: {
                responseCode: 429,
                customResponseBodyKey: 'RateLimitExceeded',
              },
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // AWS Managed Rules - Common Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
          },
        },
      ],
      customResponseBodies: {
        RateLimitExceeded: {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error_code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          }),
        },
      },
    });

    // ========================================
    // WAF Association
    // ========================================

    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: props.api.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });

    // ========================================
    // CloudFormation Outputs
    // ========================================

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: `TdnetWebAclArn-${env}`,
    });

    new cdk.CfnOutput(this, 'WebAclId', {
      value: this.webAcl.attrId,
      description: 'WAF Web ACL ID',
    });
  }
}

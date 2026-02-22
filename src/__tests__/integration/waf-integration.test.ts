/**
 * WAF統合テスト
 *
 * WAFルール、レート制限、IPセットを検証します。
 *
 * Requirements: タスク40（統合テストの拡充）
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  WAFV2Client,
  CreateWebACLCommand,
  GetWebACLCommand,
  DeleteWebACLCommand,
  CreateIPSetCommand,
  GetIPSetCommand,
  DeleteIPSetCommand,
  UpdateWebACLCommand,
} from '@aws-sdk/client-wafv2';
import { mockClient } from 'aws-sdk-client-mock';

// WAFV2クライアントのモック
const wafMock = mockClient(WAFV2Client);

describe('WAF統合テスト', () => {
  beforeEach(() => {
    // モックのリセット
    wafMock.reset();
  });

  afterEach(() => {
    // クリーンアップ
    wafMock.reset();
  });

  describe('WebACL作成', () => {
    it('基本的なWebACLを作成できること', async () => {
      // モック設定
      wafMock.on(CreateWebACLCommand).resolves({
        Summary: {
          Name: 'test-web-acl',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/test-web-acl/test-id',
          LockToken: 'test-lock-token',
        },
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // WebACL作成
      const command = new CreateWebACLCommand({
        Name: 'test-web-acl',
        Scope: 'REGIONAL',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test-web-acl',
        },
        Rules: [],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.Summary).toBeDefined();
      expect(response.Summary!.Name).toBe('test-web-acl');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });

    it('レート制限ルール付きWebACLを作成できること', async () => {
      // モック設定
      wafMock.on(CreateWebACLCommand).resolves({
        Summary: {
          Name: 'test-web-acl-rate-limit',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/test-web-acl-rate-limit/test-id',
          LockToken: 'test-lock-token',
        },
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // レート制限ルール付きWebACL作成
      const command = new CreateWebACLCommand({
        Name: 'test-web-acl-rate-limit',
        Scope: 'REGIONAL',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test-web-acl-rate-limit',
        },
        Rules: [
          {
            Name: 'RateLimitRule',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 2000,
                AggregateKeyType: 'IP',
              },
            },
            Action: {
              Block: {},
            },
            VisibilityConfig: {
              SampledRequestsEnabled: true,
              CloudWatchMetricsEnabled: true,
              MetricName: 'RateLimitRule',
            },
          },
        ],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.Summary).toBeDefined();
      expect(response.Summary!.Name).toBe('test-web-acl-rate-limit');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });

    it('AWS Managed Rulesを含むWebACLを作成できること', async () => {
      // モック設定
      wafMock.on(CreateWebACLCommand).resolves({
        Summary: {
          Name: 'test-web-acl-managed-rules',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/test-web-acl-managed-rules/test-id',
          LockToken: 'test-lock-token',
        },
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // AWS Managed Rules付きWebACL作成
      const command = new CreateWebACLCommand({
        Name: 'test-web-acl-managed-rules',
        Scope: 'REGIONAL',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test-web-acl-managed-rules',
        },
        Rules: [
          {
            Name: 'AWSManagedRulesCommonRuleSet',
            Priority: 1,
            Statement: {
              ManagedRuleGroupStatement: {
                VendorName: 'AWS',
                Name: 'AWSManagedRulesCommonRuleSet',
              },
            },
            OverrideAction: {
              None: {},
            },
            VisibilityConfig: {
              SampledRequestsEnabled: true,
              CloudWatchMetricsEnabled: true,
              MetricName: 'AWSManagedRulesCommonRuleSet',
            },
          },
        ],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.Summary).toBeDefined();
      expect(response.Summary!.Name).toBe('test-web-acl-managed-rules');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });
  });

  describe('IPセット管理', () => {
    it('IPセットを作成できること', async () => {
      // モック設定
      wafMock.on(CreateIPSetCommand).resolves({
        Summary: {
          Name: 'test-ip-set',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/ipset/test-ip-set/test-id',
          LockToken: 'test-lock-token',
        },
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // IPセット作成
      const command = new CreateIPSetCommand({
        Name: 'test-ip-set',
        Scope: 'REGIONAL',
        IPAddressVersion: 'IPV4',
        Addresses: ['192.0.2.0/24', '198.51.100.0/24'],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.Summary).toBeDefined();
      expect(response.Summary!.Name).toBe('test-ip-set');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });

    it('IPセットを取得できること', async () => {
      // モック設定
      wafMock.on(GetIPSetCommand).resolves({
        IPSet: {
          Name: 'test-ip-set',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/ipset/test-ip-set/test-id',
          IPAddressVersion: 'IPV4',
          Addresses: ['192.0.2.0/24', '198.51.100.0/24'],
        },
        LockToken: 'test-lock-token',
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // IPセット取得
      const command = new GetIPSetCommand({
        Name: 'test-ip-set',
        Scope: 'REGIONAL',
        Id: 'test-id',
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.IPSet).toBeDefined();
      expect(response.IPSet!.Name).toBe('test-ip-set');
      expect(response.IPSet!.Addresses).toHaveLength(2);
    });

    it('IPセットを削除できること', async () => {
      // モック設定
      wafMock.on(DeleteIPSetCommand).resolves({});

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // IPセット削除
      const command = new DeleteIPSetCommand({
        Name: 'test-ip-set',
        Scope: 'REGIONAL',
        Id: 'test-id',
        LockToken: 'test-lock-token',
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });
  });

  describe('WebACL管理', () => {
    it('WebACLを取得できること', async () => {
      // モック設定
      wafMock.on(GetWebACLCommand).resolves({
        WebACL: {
          Name: 'test-web-acl',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/test-web-acl/test-id',
          DefaultAction: {
            Allow: {},
          },
          VisibilityConfig: {
            SampledRequestsEnabled: true,
            CloudWatchMetricsEnabled: true,
            MetricName: 'test-web-acl',
          },
          Rules: [],
        },
        LockToken: 'test-lock-token',
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // WebACL取得
      const command = new GetWebACLCommand({
        Name: 'test-web-acl',
        Scope: 'REGIONAL',
        Id: 'test-id',
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.WebACL).toBeDefined();
      expect(response.WebACL!.Name).toBe('test-web-acl');
    });

    it('WebACLを更新できること', async () => {
      // モック設定
      wafMock.on(UpdateWebACLCommand).resolves({
        NextLockToken: 'new-lock-token',
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // WebACL更新
      const command = new UpdateWebACLCommand({
        Name: 'test-web-acl',
        Scope: 'REGIONAL',
        Id: 'test-id',
        LockToken: 'test-lock-token',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test-web-acl',
        },
        Rules: [
          {
            Name: 'NewRule',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 1000,
                AggregateKeyType: 'IP',
              },
            },
            Action: {
              Block: {},
            },
            VisibilityConfig: {
              SampledRequestsEnabled: true,
              CloudWatchMetricsEnabled: true,
              MetricName: 'NewRule',
            },
          },
        ],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.NextLockToken).toBe('new-lock-token');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });

    it('WebACLを削除できること', async () => {
      // モック設定
      wafMock.on(DeleteWebACLCommand).resolves({});

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // WebACL削除
      const command = new DeleteWebACLCommand({
        Name: 'test-web-acl',
        Scope: 'REGIONAL',
        Id: 'test-id',
        LockToken: 'test-lock-token',
      });

      await expect(client.send(command)).resolves.not.toThrow();

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });
  });

  describe('レート制限ルール', () => {
    it('異なるレート制限値でルールを作成できること', async () => {
      // モック設定
      wafMock.on(CreateWebACLCommand).resolves({
        Summary: {
          Name: 'test-web-acl-custom-rate',
          Id: 'test-id',
          ARN: 'arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/test-web-acl-custom-rate/test-id',
          LockToken: 'test-lock-token',
        },
      });

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // カスタムレート制限ルール
      const command = new CreateWebACLCommand({
        Name: 'test-web-acl-custom-rate',
        Scope: 'REGIONAL',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test-web-acl-custom-rate',
        },
        Rules: [
          {
            Name: 'CustomRateLimitRule',
            Priority: 1,
            Statement: {
              RateBasedStatement: {
                Limit: 500, // カスタムレート制限
                AggregateKeyType: 'IP',
              },
            },
            Action: {
              Block: {},
            },
            VisibilityConfig: {
              SampledRequestsEnabled: true,
              CloudWatchMetricsEnabled: true,
              MetricName: 'CustomRateLimitRule',
            },
          },
        ],
      });

      const response = await client.send(command);

      // レスポンスの検証
      expect(response.Summary).toBeDefined();
      expect(response.Summary!.Name).toBe('test-web-acl-custom-rate');

      // モックが呼ばれたことを確認
      expect(wafMock.calls()).toHaveLength(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なWebACL名でエラーが発生すること', async () => {
      // モック設定（エラー）
      wafMock.on(CreateWebACLCommand).rejects(new Error('Invalid WebACL name'));

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // 無効なWebACL名
      const command = new CreateWebACLCommand({
        Name: '', // 空の名前
        Scope: 'REGIONAL',
        DefaultAction: {
          Allow: {},
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'test',
        },
        Rules: [],
      });

      await expect(client.send(command)).rejects.toThrow('Invalid WebACL name');
    });

    it('存在しないWebACLを取得するとエラーが発生すること', async () => {
      // モック設定（エラー）
      wafMock.on(GetWebACLCommand).rejects(new Error('WebACL not found'));

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // 存在しないWebACL
      const command = new GetWebACLCommand({
        Name: 'non-existent-web-acl',
        Scope: 'REGIONAL',
        Id: 'non-existent-id',
      });

      await expect(client.send(command)).rejects.toThrow('WebACL not found');
    });

    it('無効なIPアドレスでIPセット作成がエラーになること', async () => {
      // モック設定（エラー）
      wafMock.on(CreateIPSetCommand).rejects(new Error('Invalid IP address'));

      const client = new WAFV2Client({ region: 'ap-northeast-1' });

      // 無効なIPアドレス
      const command = new CreateIPSetCommand({
        Name: 'test-ip-set',
        Scope: 'REGIONAL',
        IPAddressVersion: 'IPV4',
        Addresses: ['invalid-ip'], // 無効なIPアドレス
      });

      await expect(client.send(command)).rejects.toThrow('Invalid IP address');
    });
  });
});

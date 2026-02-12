/**
 * セキュリティ強化の検証テスト（タスク21.4）
 * 
 * このテストは以下を検証します：
 * - タスク21.1: IAMロールが最小権限であること
 * - タスク21.2: S3バケットがパブリックアクセスブロックされていること
 * - タスク21.3: APIキーローテーションが機能すること
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { TdnetDataCollectorStack } from '../lib/tdnet-data-collector-stack';

describe('セキュリティ強化テスト', () => {
  let app: cdk.App;
  let stack: TdnetDataCollectorStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new TdnetDataCollectorStack(app, 'TestStack', {
      environmentConfig: {
        environment: 'dev',
      },
    });
    template = Template.fromStack(stack);
  });

  describe('タスク21.1: IAMロールの最小権限化', () => {
    it('Lambda関数のCloudWatch PutMetricData権限が特定の名前空間に制限されていること', () => {
      // Lambda関数のIAMロールを取得
      const lambdaRoles = template.findResources('AWS::IAM::Role', {
        Properties: {
          AssumeRolePolicyDocument: {
            Statement: Match.arrayWith([
              Match.objectLike({
                Principal: {
                  Service: 'lambda.amazonaws.com',
                },
              }),
            ]),
          },
        },
      });

      // 各Lambda関数のロールを検証
      Object.keys(lambdaRoles).forEach((roleKey) => {
        const role = lambdaRoles[roleKey];
        
        // ManagedPolicyArnsにCloudWatch権限が含まれていないことを確認
        // （カスタムポリシーで制限された権限のみを使用）
        if (role.Properties.ManagedPolicyArns) {
          const managedPolicies = role.Properties.ManagedPolicyArns;
          managedPolicies.forEach((policyArn: any) => {
            // CloudWatchFullAccessのような広範囲な権限がないことを確認
            expect(policyArn).not.toMatch(/CloudWatchFullAccess/);
          });
        }
      });
    });

    it('Lambda関数のIAMポリシーにCloudWatch名前空間の条件が設定されていること', () => {
      // IAMポリシーを検索
      const policies = template.findResources('AWS::IAM::Policy');

      let foundCloudWatchPolicy = false;

      Object.keys(policies).forEach((policyKey) => {
        const policy = policies[policyKey];
        const statements = policy.Properties.PolicyDocument.Statement;

        statements.forEach((statement: any) => {
          // CloudWatch PutMetricData権限を持つステートメントを検索
          if (
            statement.Action &&
            (statement.Action === 'cloudwatch:PutMetricData' ||
              (Array.isArray(statement.Action) && statement.Action.includes('cloudwatch:PutMetricData')))
          ) {
            foundCloudWatchPolicy = true;

            // 条件が設定されていることを確認
            expect(statement.Condition).toBeDefined();
            expect(statement.Condition.StringEquals).toBeDefined();
            expect(statement.Condition.StringEquals['cloudwatch:namespace']).toBeDefined();
            
            // 名前空間がTDnetで始まることを確認
            const namespace = statement.Condition.StringEquals['cloudwatch:namespace'];
            expect(namespace).toMatch(/^TDnet\//);
          }
        });
      });

      // 少なくとも1つのCloudWatchポリシーが見つかることを確認
      expect(foundCloudWatchPolicy).toBe(true);
    });

    it('Lambda関数がDynamoDBテーブルへの最小権限のみを持つこと', () => {
      // DynamoDBテーブルへのアクセス権限を検証
      const policies = template.findResources('AWS::IAM::Policy');

      Object.keys(policies).forEach((policyKey) => {
        const policy = policies[policyKey];
        const statements = policy.Properties.PolicyDocument.Statement;

        statements.forEach((statement: any) => {
          // DynamoDB権限を持つステートメントを検索
          if (statement.Action && Array.isArray(statement.Action)) {
            const dynamoActions = statement.Action.filter((action: string) =>
              action.startsWith('dynamodb:')
            );

            if (dynamoActions.length > 0) {
              // 広範囲な権限（*）がないことを確認
              expect(dynamoActions).not.toContain('dynamodb:*');
              
              // 特定のリソースに対してのみ権限が付与されていることを確認
              expect(statement.Resource).toBeDefined();
              expect(statement.Resource).not.toBe('*');
            }
          }
        });
      });
    });

    it('Lambda関数がS3バケットへの最小権限のみを持つこと', () => {
      // S3バケットへのアクセス権限を検証
      const policies = template.findResources('AWS::IAM::Policy');

      Object.keys(policies).forEach((policyKey) => {
        const policy = policies[policyKey];
        const statements = policy.Properties.PolicyDocument.Statement;

        statements.forEach((statement: any) => {
          // S3権限を持つステートメントを検索
          if (statement.Action && Array.isArray(statement.Action)) {
            const s3Actions = statement.Action.filter((action: string) => action.startsWith('s3:'));

            if (s3Actions.length > 0) {
              // 広範囲な権限（*）がないことを確認
              expect(s3Actions).not.toContain('s3:*');
              
              // 特定のリソースに対してのみ権限が付与されていることを確認
              expect(statement.Resource).toBeDefined();
              
              // リソースが配列の場合、すべての要素が特定のバケットを指していることを確認
              if (Array.isArray(statement.Resource)) {
                statement.Resource.forEach((resource: any) => {
                  expect(resource).not.toBe('*');
                });
              } else {
                expect(statement.Resource).not.toBe('*');
              }
            }
          }
        });
      });
    });
  });

  describe('タスク21.2: S3バケットのパブリックアクセスブロック', () => {
    it('すべてのS3バケットでパブリックアクセスがブロックされていること', () => {
      // S3バケットを検索
      const buckets = template.findResources('AWS::S3::Bucket');

      // 各バケットを検証
      Object.keys(buckets).forEach((bucketKey) => {
        const bucket = buckets[bucketKey];

        // PublicAccessBlockConfigurationが設定されていることを確認
        expect(bucket.Properties.PublicAccessBlockConfiguration).toBeDefined();

        const blockConfig = bucket.Properties.PublicAccessBlockConfiguration;

        // すべてのパブリックアクセスブロック設定がtrueであることを確認
        expect(blockConfig.BlockPublicAcls).toBe(true);
        expect(blockConfig.BlockPublicPolicy).toBe(true);
        expect(blockConfig.IgnorePublicAcls).toBe(true);
        expect(blockConfig.RestrictPublicBuckets).toBe(true);
      });
    });

    it('S3バケットがバージョニングを有効化していること', () => {
      // S3バケットを検索
      const buckets = template.findResources('AWS::S3::Bucket');

      // 各バケットを検証
      Object.keys(buckets).forEach((bucketKey) => {
        const bucket = buckets[bucketKey];

        // バージョニングが有効化されていることを確認
        expect(bucket.Properties.VersioningConfiguration).toBeDefined();
        expect(bucket.Properties.VersioningConfiguration.Status).toBe('Enabled');
      });
    });

    it('S3バケットが暗号化されていること', () => {
      // S3バケットを検索
      const buckets = template.findResources('AWS::S3::Bucket');

      // 各バケットを検証
      Object.keys(buckets).forEach((bucketKey) => {
        const bucket = buckets[bucketKey];

        // 暗号化が設定されていることを確認
        expect(bucket.Properties.BucketEncryption).toBeDefined();
        expect(bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration).toBeDefined();

        const encryptionRules =
          bucket.Properties.BucketEncryption.ServerSideEncryptionConfiguration;
        expect(encryptionRules.length).toBeGreaterThan(0);

        // 各ルールでSSE-S3またはSSE-KMSが使用されていることを確認
        encryptionRules.forEach((rule: any) => {
          expect(rule.ServerSideEncryptionByDefault).toBeDefined();
          const algorithm = rule.ServerSideEncryptionByDefault.SSEAlgorithm;
          expect(['AES256', 'aws:kms']).toContain(algorithm);
        });
      });
    });
  });

  describe('タスク21.3: APIキーのローテーション設定', () => {
    it('Secrets Managerシークレットが作成されていること', () => {
      // Secrets Managerシークレットを検索
      template.hasResourceProperties('AWS::SecretsManager::Secret', {
        Name: '/tdnet/api-key',
        Description: 'TDnet API Key for authentication',
      });
    });

    it('ローテーション用Lambda関数が作成されていること', () => {
      // ローテーション用Lambda関数を検索
      const lambdaFunctions = template.findResources('AWS::Lambda::Function');

      let foundRotationFunction = false;

      Object.keys(lambdaFunctions).forEach((functionKey) => {
        const func = lambdaFunctions[functionKey];
        
        // 関数名にrotationが含まれているか確認
        if (func.Properties.FunctionName && 
            typeof func.Properties.FunctionName === 'string' &&
            func.Properties.FunctionName.includes('rotation')) {
          foundRotationFunction = true;

          // タイムアウトが適切に設定されていることを確認
          expect(func.Properties.Timeout).toBeLessThanOrEqual(30);

          // メモリサイズが適切に設定されていることを確認
          expect(func.Properties.MemorySize).toBeLessThanOrEqual(256);
        }
      });

      expect(foundRotationFunction).toBe(true);
    });

    it('Secrets Managerローテーションスケジュールが設定されていること', () => {
      // ローテーションスケジュールを検索
      const rotationSchedules = template.findResources('AWS::SecretsManager::RotationSchedule');

      // 少なくとも1つのローテーションスケジュールが存在することを確認
      expect(Object.keys(rotationSchedules).length).toBeGreaterThan(0);

      // 各ローテーションスケジュールを検証
      Object.keys(rotationSchedules).forEach((scheduleKey) => {
        const schedule = rotationSchedules[scheduleKey];

        // ローテーション間隔が設定されていることを確認
        expect(schedule.Properties.RotationRules).toBeDefined();
        expect(schedule.Properties.RotationRules.AutomaticallyAfterDays).toBeDefined();
        
        // ローテーション間隔が90日であることを確認
        expect(schedule.Properties.RotationRules.AutomaticallyAfterDays).toBe(90);

        // ローテーションLambda関数が設定されていることを確認
        expect(schedule.Properties.RotationLambdaARN).toBeDefined();
      });
    });

    it('ローテーション用Lambda関数がSecrets Manager権限を持つこと', () => {
      // IAMポリシーを検索
      const policies = template.findResources('AWS::IAM::Policy');

      let foundSecretsManagerPolicy = false;

      Object.keys(policies).forEach((policyKey) => {
        const policy = policies[policyKey];
        const statements = policy.Properties.PolicyDocument.Statement;

        statements.forEach((statement: any) => {
          // Secrets Manager権限を持つステートメントを検索
          if (statement.Action && Array.isArray(statement.Action)) {
            const secretsActions = statement.Action.filter((action: string) =>
              action.startsWith('secretsmanager:')
            );

            if (secretsActions.length > 0) {
              foundSecretsManagerPolicy = true;

              // 必要な権限が含まれていることを確認
              const requiredActions = [
                'secretsmanager:DescribeSecret',
                'secretsmanager:GetSecretValue',
                'secretsmanager:PutSecretValue',
                'secretsmanager:UpdateSecretVersionStage',
              ];

              requiredActions.forEach((requiredAction) => {
                expect(secretsActions).toContain(requiredAction);
              });

              // 特定のリソースに対してのみ権限が付与されていることを確認
              expect(statement.Resource).toBeDefined();
              expect(statement.Resource).not.toBe('*');
            }
          }
        });
      });

      expect(foundSecretsManagerPolicy).toBe(true);
    });
  });

  describe('統合テスト', () => {
    it('セキュリティ強化がスタック全体に適用されていること', () => {
      // スタックが正常に作成されることを確認
      expect(stack).toBeDefined();

      // 主要なリソースが存在することを確認（最小数を確認）
      const resources = template.toJSON().Resources;
      const lambdaFunctions = Object.values(resources).filter(
        (r: any) => r.Type === 'AWS::Lambda::Function'
      );
      const s3Buckets = Object.values(resources).filter((r: any) => r.Type === 'AWS::S3::Bucket');
      const dynamoTables = Object.values(resources).filter(
        (r: any) => r.Type === 'AWS::DynamoDB::Table'
      );
      const secrets = Object.values(resources).filter(
        (r: any) => r.Type === 'AWS::SecretsManager::Secret'
      );
      const rotationSchedules = Object.values(resources).filter(
        (r: any) => r.Type === 'AWS::SecretsManager::RotationSchedule'
      );

      expect(lambdaFunctions.length).toBeGreaterThan(0);
      expect(s3Buckets.length).toBeGreaterThan(0);
      expect(dynamoTables.length).toBeGreaterThan(0);
      expect(secrets.length).toBeGreaterThan(0);
      expect(rotationSchedules.length).toBeGreaterThan(0);
    });

    it('CloudFormationテンプレートが有効であること', () => {
      // テンプレートが正常に生成されることを確認
      const templateJson = template.toJSON();
      expect(templateJson).toBeDefined();
      expect(templateJson.Resources).toBeDefined();
      expect(Object.keys(templateJson.Resources).length).toBeGreaterThan(0);
    });
  });
});

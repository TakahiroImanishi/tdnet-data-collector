---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/iam/**/*.ts|**/security/**/*.ts'
---

# セキュリティベストプラクティス

このファイルは、TDnet Data Collectorプロジェクトのセキュリティに関するベストプラクティスをまとめたものです。

## セキュリティの原則

1. **最小権限の原則**: 必要最小限の権限のみを付与
2. **深層防御**: 複数のセキュリティレイヤーを実装
3. **暗号化**: データは転送時・保存時ともに暗号化
4. **監査**: すべてのアクセスをログに記録
5. **定期的な見直し**: セキュリティ設定を定期的にレビュー

## IAM権限管理

### Lambda関数のIAMロール

#### 最小権限の実装

```typescript
// CDKでの最小権限設定
import * as iam from 'aws-cdk-lib/aws-iam';

const collectorRole = new iam.Role(this, 'CollectorRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'Role for TDnet Collector Lambda',
});

// CloudWatch Logsへの書き込み権限（必須）
collectorRole.addManagedPolicy(
    iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
    )
);

// S3への読み書き権限（特定バケットのみ）
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        's3:PutObject',
        's3:GetObject',
        's3:DeleteObject',
    ],
    resources: [
        `${pdfBucket.bucketArn}/*`,
    ],
}));

// DynamoDBへの書き込み権限（特定テーブルのみ）
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: [
        'dynamodb:PutItem',
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
    ],
    resources: [
        table.tableArn,
        `${table.tableArn}/index/*`,
    ],
}));

// SNS通知権限（特定トピックのみ）
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['sns:Publish'],
    resources: [alertTopic.topicArn],
}));

// SSM Parameter Store読み取り権限（特定パラメータのみ）
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['ssm:GetParameter'],
    resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/tdnet/${props.environment}/*`,
    ],
}));
```

#### 禁止事項

```typescript
// ❌ 悪い例: ワイルドカード権限
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:*'],
    resources: ['*'],
}));

// ✅ 良い例: 特定リソースへの特定アクション
collectorRole.addToPolicy(new iam.PolicyStatement({
    effect: iam.Effect.ALLOW,
    actions: ['s3:PutObject', 's3:GetObject'],
    resources: [`${pdfBucket.bucketArn}/*`],
}));
```

### リソースベースのポリシー

#### S3バケットポリシー

```typescript
// S3バケットポリシーで追加の制限
pdfBucket.addToResourcePolicy(new iam.PolicyStatement({
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ['s3:*'],
    resources: [
        pdfBucket.bucketArn,
        `${pdfBucket.bucketArn}/*`,
    ],
    conditions: {
        Bool: {
            'aws:SecureTransport': 'false',
        },
    },
}));
```

#### DynamoDBリソースポリシー

```typescript
// DynamoDBへのアクセスをVPCエンドポイント経由に制限（オプション）
table.addToResourcePolicy(new iam.PolicyStatement({
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ['dynamodb:*'],
    resources: [table.tableArn],
    conditions: {
        StringNotEquals: {
            'aws:sourceVpce': vpcEndpoint.vpcEndpointId,
        },
    },
}));
```

## データ暗号化

### 転送時の暗号化

#### HTTPS通信の強制

```typescript
// API GatewayでHTTPSを強制
const api = new apigateway.RestApi(this, 'TdnetApi', {
    restApiName: 'TDnet Data Collector API',
    endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
    },
    // HTTPSのみ許可
    disableExecuteApiEndpoint: false,
});

// カスタムドメインでHTTPSを強制
const domainName = new apigateway.DomainName(this, 'CustomDomain', {
    domainName: 'api.example.com',
    certificate: certificate,
    securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
});
```

#### TLS 1.2以上の使用

```typescript
// axios設定でTLS 1.2以上を強制
import https from 'https';
import axios from 'axios';

const httpsAgent = new https.Agent({
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3',
});

const client = axios.create({
    httpsAgent,
});
```

### 保存時の暗号化

#### S3暗号化

```typescript
// S3バケットでSSE-S3暗号化を有効化
const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
    bucketName: 'tdnet-pdfs-prod',
    encryption: s3.BucketEncryption.S3_MANAGED,
    enforceSSL: true, // HTTPS通信を強制
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    versioned: false,
    lifecycleRules: [
        {
            transitions: [
                {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: cdk.Duration.days(90),
                },
            ],
        },
    ],
});
```

#### DynamoDB暗号化

```typescript
// DynamoDBでデフォルト暗号化を有効化
const table = new dynamodb.Table(this, 'DisclosuresTable', {
    tableName: 'tdnet-disclosures',
    partitionKey: {
        name: 'disclosure_id',
        type: dynamodb.AttributeType.STRING,
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    encryption: dynamodb.TableEncryption.AWS_MANAGED,
    pointInTimeRecovery: true, // バックアップ有効化
});
```

#### Lambda環境変数の暗号化

```typescript
// KMSキーでLambda環境変数を暗号化
const kmsKey = new kms.Key(this, 'EnvKey', {
    description: 'Key for Lambda environment variables',
    enableKeyRotation: true,
});

const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    environment: {
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
    },
    environmentEncryption: kmsKey,
});
```

## 機密情報の管理

### Secrets Manager

```typescript
// Secrets Managerで機密情報を管理
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
    secretName: `tdnet/${props.environment}/api-key`,
    description: 'API Key for TDnet Data Collector',
    generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'api' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
    },
});

// Lambda関数に読み取り権限を付与
apiKeySecret.grantRead(collectorFn);

// Lambda関数内での取得
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({ region: 'ap-northeast-1' });

async function getApiKey(): Promise<string> {
    const response = await secretsManager.send(new GetSecretValueCommand({
        SecretId: `tdnet/${process.env.ENVIRONMENT}/api-key`,
    }));
    
    const secret = JSON.parse(response.SecretString!);
    return secret.password;
}
```

### SSM Parameter Store

```typescript
// SSM Parameter Storeで設定値を管理
import * as ssm from 'aws-cdk-lib/aws-ssm';

const apiKeyParameter = new ssm.StringParameter(this, 'ApiKeyParameter', {
    parameterName: `/tdnet/${props.environment}/api-key`,
    stringValue: 'placeholder', // 実際の値はデプロイ後に設定
    type: ssm.ParameterType.SECURE_STRING,
    description: 'API Key for TDnet Data Collector',
});

// Lambda関数に読み取り権限を付与
apiKeyParameter.grantRead(collectorFn);
```

### 環境変数からの機密情報除外

```typescript
// ❌ 悪い例: 環境変数に直接APIキーを設定
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    environment: {
        API_KEY: 'my-secret-api-key', // 絶対にしない！
    },
});

// ✅ 良い例: Secrets ManagerのARNのみを環境変数に設定
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    environment: {
        API_KEY_SECRET_ARN: apiKeySecret.secretArn,
    },
});
```

## ネットワークセキュリティ

### VPC設定（オプション）

```typescript
// Lambda関数をVPC内に配置（必要に応じて）
import * as ec2 from 'aws-cdk-lib/aws-ec2';

const vpc = new ec2.Vpc(this, 'TdnetVpc', {
    maxAzs: 2,
    natGateways: 1,
    subnetConfiguration: [
        {
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
    ],
});

const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    vpc,
    vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
});

// VPCエンドポイントでAWSサービスへのアクセスを最適化
const dynamodbEndpoint = vpc.addGatewayEndpoint('DynamoDBEndpoint', {
    service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
});

const s3Endpoint = vpc.addGatewayEndpoint('S3Endpoint', {
    service: ec2.GatewayVpcEndpointAwsService.S3,
});
```

### セキュリティグループ

```typescript
// Lambda用セキュリティグループ
const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
    vpc,
    description: 'Security group for TDnet Collector Lambda',
    allowAllOutbound: true, // HTTPSアクセスのため
});

// 必要に応じてインバウンドルールを追加
// （通常、Lambdaはインバウンド不要）
```

## API Gateway セキュリティ

### WAF設定

```typescript
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';

// WAF Web ACLの作成
const webAcl = new wafv2.CfnWebACL(this, 'ApiWaf', {
    scope: 'REGIONAL',
    defaultAction: { allow: {} },
    rules: [
        {
            name: 'RateLimitRule',
            priority: 1,
            statement: {
                rateBasedStatement: {
                    limit: 2000, // 5分間で2000リクエスト
                    aggregateKeyType: 'IP',
                },
            },
            action: { block: {} },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: 'RateLimitRule',
            },
        },
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
    ],
    visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'TdnetApiWaf',
    },
});

// API GatewayにWAFを関連付け
new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
    resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
    webAclArn: webAcl.attrArn,
});
```

### APIキー認証

```typescript
// APIキーの作成
const apiKey = api.addApiKey('TdnetApiKey', {
    apiKeyName: 'tdnet-api-key',
    description: 'API Key for TDnet Data Collector',
});

// 使用量プランの作成
const usagePlan = api.addUsagePlan('TdnetUsagePlan', {
    name: 'tdnet-usage-plan',
    throttle: {
        rateLimit: 100, // 1秒あたり100リクエスト
        burstLimit: 200,
    },
    quota: {
        limit: 10000, // 月間10000リクエスト
        period: apigateway.Period.MONTH,
    },
});

usagePlan.addApiKey(apiKey);
usagePlan.addApiStage({
    stage: api.deploymentStage,
});

// エンドポイントでAPIキーを要求
const disclosures = api.root.addResource('disclosures');
disclosures.addMethod('GET', integration, {
    apiKeyRequired: true,
});
```

### CORS設定

```typescript
// 安全なCORS設定
const api = new apigateway.RestApi(this, 'TdnetApi', {
    defaultCorsPreflightOptions: {
        allowOrigins: [
            'https://dashboard.example.com', // 本番ドメインのみ
        ],
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
            'Content-Type',
            'X-API-Key',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
    },
});
```

## 監査とログ

### CloudTrail

```typescript
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

// CloudTrailでAPIコールを記録
const trail = new cloudtrail.Trail(this, 'TdnetTrail', {
    trailName: 'tdnet-audit-trail',
    sendToCloudWatchLogs: true,
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: false,
});

// 特定のS3バケットのイベントを記録
trail.addS3EventSelector([{
    bucket: pdfBucket,
    objectPrefix: '',
}], {
    readWriteType: cloudtrail.ReadWriteType.ALL,
});

// DynamoDBテーブルのイベントを記録
trail.logAllLambdaDataEvents();
```

### CloudWatch Logs

```typescript
// 構造化ログの実装
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
    ],
});

// 機密情報をログから除外
function sanitizeForLog(data: any): any {
    const sanitized = { ...data };
    
    // APIキーをマスク
    if (sanitized.api_key) {
        sanitized.api_key = '***REDACTED***';
    }
    
    // パスワードをマスク
    if (sanitized.password) {
        sanitized.password = '***REDACTED***';
    }
    
    return sanitized;
}

// 使用例
logger.info('Processing disclosure', sanitizeForLog({
    disclosure_id: 'TD20240115001',
    api_key: 'secret-key', // ログには出力されない
}));
```

## 脆弱性管理

### 依存関係のスキャン

```bash
# npm auditで脆弱性をチェック
npm audit

# 自動修正
npm audit fix

# 強制修正（破壊的変更を含む）
npm audit fix --force
```

### 定期的な更新

```json
// package.jsonでバージョン範囲を適切に設定
{
  "dependencies": {
    "axios": "^1.6.0",  // マイナーバージョンの自動更新
    "cheerio": "~1.0.0" // パッチバージョンのみ自動更新
  }
}
```

### Dependabot設定

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "security-team"
    labels:
      - "dependencies"
      - "security"
```

## インシデント対応

### セキュリティインシデント対応フロー

1. **検知**
   - CloudWatch Alarms
   - GuardDuty（オプション）
   - Security Hub（オプション）

2. **初期対応**
   - 影響範囲の特定
   - 一時的な緩和策の実施
   - 関係者への通知

3. **調査**
   - CloudTrailログの分析
   - CloudWatch Logsの分析
   - X-Rayトレースの確認

4. **復旧**
   - 脆弱性の修正
   - 侵害されたクレデンシャルのローテーション
   - システムの再デプロイ

5. **事後対応**
   - インシデントレポート作成
   - 再発防止策の実施
   - セキュリティ設定の見直し

### クレデンシャルのローテーション

```bash
# APIキーのローテーション
aws secretsmanager rotate-secret \
  --secret-id tdnet/prod/api-key \
  --rotation-lambda-arn arn:aws:lambda:...

# IAMアクセスキーのローテーション（該当する場合）
aws iam create-access-key --user-name tdnet-user
aws iam delete-access-key --user-name tdnet-user --access-key-id OLD_KEY_ID
```

## セキュリティチェックリスト

### デプロイ前

- [ ] IAM権限が最小権限になっている
- [ ] 機密情報が環境変数に含まれていない
- [ ] すべてのデータが暗号化されている
- [ ] npm auditで脆弱性がない
- [ ] CloudTrailが有効化されている
- [ ] WAFルールが設定されている

### 定期レビュー（月次）

- [ ] IAM権限の見直し
- [ ] 未使用のリソースの削除
- [ ] CloudTrailログの確認
- [ ] セキュリティアラートの確認
- [ ] 依存関係の更新
- [ ] クレデンシャルのローテーション

## 関連ドキュメント

- **環境変数**: `../infrastructure/environment-variables.md` - 機密情報の管理方法
- **監視とアラート**: `../infrastructure/monitoring-alerts.md` - セキュリティアラート設定

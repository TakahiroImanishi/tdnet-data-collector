# 作業記録: アーキテクチャ整合性レビュー

## タスク概要

### 目的
CDK構成と設計書の整合性を確認し、Lambda/DynamoDB/S3の実装が設計通りか検証する。

### 背景
- プロジェクトの実装が進む中で、CDK構成と設計書の間に不整合が生じていないか確認する必要がある
- 特にLambda関数の構成、DynamoDBテーブル構造、S3バケット構成、IAMロール・ポリシーの整合性を検証

### 目標
- CDK構成と設計書の整合性を確認
- 不整合がある場合は改善提案を作成
- 最小権限の原則に従っているか検証

## 実施内容

### 1. レビュー対象ファイルの確認

#### CDK構成ファイル
- cdk/lib/tdnet-data-collector-stack.ts
- cdk/lib/constructs/*.ts

#### 設計書
- .kiro/specs/tdnet-data-collector/docs/design.md

### 2. 確認項目

#### Lambda関数
- [ ] タイムアウト設定
- [ ] メモリ設定
- [ ] 環境変数
- [ ] ランタイム
- [ ] IAMロール

#### DynamoDB
- [ ] パーティションキー
- [ ] ソートキー
- [ ] GSI（Global Secondary Index）
- [ ] TTL設定
- [ ] 暗号化

#### S3
- [ ] バケット名
- [ ] 暗号化設定
- [ ] ライフサイクルポリシー
- [ ] バージョニング
- [ ] アクセス制御

#### IAM
- [ ] 最小権限の原則
- [ ] ロール分離
- [ ] ポリシー設定

### 3. 実施した作業

#### 3.1 CDK構成ファイルの確認

**確認ファイル:**
- `cdk/lib/tdnet-data-collector-stack.ts` - メインスタック
- `cdk/lib/constructs/secrets-manager.ts` - Secrets Manager construct

**CDK構成の概要:**
- DynamoDBテーブル: 3個（disclosures, executions, export_status）
- S3バケット: 4個（pdfs, exports, dashboard, cloudtrail-logs）
- Lambda関数: 5個（collector, query, export, collect, collect-status）
- API Gateway: REST API + WAF
- Secrets Manager: APIキー管理

#### 3.2 設計書の確認

**確認ファイル:**
- `.kiro/specs/tdnet-data-collector/docs/design.md`

**設計書の主要セクション:**
- アーキテクチャ図
- コンポーネント設計（Lambda, DynamoDB, S3, API Gateway）
- データモデル
- セキュリティ設計

#### 3.3 整合性確認結果

##### ✅ Lambda関数の構成

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **Collector** | | | |
| - タイムアウト | 15分 | 15分（本番）、5分（開発） | ⚠️ 環境分離なし |
| - メモリ | 512MB | 512MB（本番）、256MB（開発） | ⚠️ 環境分離なし |
| - 環境変数 | DYNAMODB_TABLE, DYNAMODB_EXECUTIONS_TABLE, S3_BUCKET, LOG_LEVEL, NODE_OPTIONS | 設計書に記載あり | ✅ 一致 |
| - 同時実行数 | 1（reservedConcurrentExecutions） | 設計書に記載あり | ✅ 一致 |
| **Query** | | | |
| - タイムアウト | 30秒 | 30秒 | ✅ 一致 |
| - メモリ | 256MB | 256MB | ✅ 一致 |
| - 環境変数 | DYNAMODB_TABLE_NAME, S3_BUCKET_NAME, API_KEY, LOG_LEVEL, NODE_OPTIONS | 設計書に記載あり | ✅ 一致 |
| **Export** | | | |
| - タイムアウト | 5分 | 5分 | ✅ 一致 |
| - メモリ | 512MB | 512MB | ✅ 一致 |
| - 環境変数 | DYNAMODB_TABLE_NAME, EXPORT_STATUS_TABLE_NAME, EXPORT_BUCKET_NAME, API_KEY, LOG_LEVEL, NODE_OPTIONS | 設計書に記載あり | ✅ 一致 |
| **Collect** | | | |
| - タイムアウト | 30秒 | 30秒 | ✅ 一致 |
| - メモリ | 256MB | 256MB | ✅ 一致 |
| **Collect Status** | | | |
| - タイムアウト | 30秒 | 30秒 | ✅ 一致 |
| - メモリ | 256MB | 256MB | ✅ 一致 |

**問題点:**
- ⚠️ **環境分離が未実装**: 設計書では開発環境と本番環境で異なる設定を推奨しているが、CDKスタックでは環境分離が実装されていない

##### ✅ DynamoDBテーブル構造

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **tdnet_disclosures** | | | |
| - パーティションキー | disclosure_id (STRING) | disclosure_id (String) | ✅ 一致 |
| - ソートキー | なし | なし | ✅ 一致 |
| - GSI 1 | GSI_CompanyCode_DiscloseDate (company_code, disclosed_at) | GSI_CompanyCode_DiscloseDate | ✅ 一致 |
| - GSI 2 | GSI_DatePartition (date_partition, disclosed_at) | GSI_DatePartition | ✅ 一致 |
| - 課金モード | PAY_PER_REQUEST | オンデマンドモード | ✅ 一致 |
| - 暗号化 | AWS_MANAGED | AWS管理キー | ✅ 一致 |
| - PITR | true | 有効化 | ✅ 一致 |
| - 削除保護 | RETAIN | RETAIN | ✅ 一致 |
| **tdnet_executions** | | | |
| - パーティションキー | execution_id (STRING) | execution_id (String) | ✅ 一致 |
| - GSI | GSI_Status_StartedAt (status, started_at) | GSI_Status_StartedAt | ✅ 一致 |
| - TTL | ttl | ttl（30日） | ✅ 一致 |
| **tdnet_export_status** | | | |
| - パーティションキー | export_id (STRING) | export_id (String) | ✅ 一致 |
| - GSI | GSI_Status_RequestedAt (status, requested_at) | GSI_Status_RequestedAt | ✅ 一致 |
| - TTL | ttl | ttl（30日） | ✅ 一致 |

**問題点:**
- なし（完全一致）

##### ✅ S3バケット構成

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **PDFバケット** | | | |
| - バケット名 | tdnet-data-collector-pdfs-{account} | tdnet-data-collector-pdfs-{account-id} | ✅ 一致 |
| - 暗号化 | S3_MANAGED | SSE-S3 | ✅ 一致 |
| - バージョニング | true | 有効 | ✅ 一致 |
| - パブリックアクセス | BLOCK_ALL | ブロック | ✅ 一致 |
| - ライフサイクル（90日） | Standard-IA | Standard-IA | ✅ 一致 |
| - ライフサイクル（365日） | Glacier | Glacier | ✅ 一致 |
| **エクスポートバケット** | | | |
| - ライフサイクル | 7日後削除 | 7日後削除 | ✅ 一致 |
| **ダッシュボードバケット** | | | |
| - 設定 | 基本設定のみ | CloudFront OAI | ⚠️ CloudFront未実装 |
| **CloudTrailログバケット** | | | |
| - ライフサイクル（90日） | Glacier移行 | Glacier移行 | ✅ 一致 |
| - ライフサイクル（7年） | 削除 | 削除（2555日） | ✅ 一致 |

**問題点:**
- ⚠️ **CloudFront未実装**: ダッシュボードバケットにCloudFront OAIが設定されていない

##### ✅ IAMロール・ポリシー

| Lambda関数 | 権限 | CDK実装 | 設計書 | 整合性 |
|-----------|------|---------|--------|--------|
| **Collector** | DynamoDB読み書き | grantReadWriteData | 設計書に記載 | ✅ 一致 |
| | S3読み書き | grantPut, grantRead | 設計書に記載 | ✅ 一致 |
| | CloudWatch Metrics | PutMetricData | 設計書に記載 | ✅ 一致 |
| **Query** | DynamoDB読み取り | grantReadData | 設計書に記載 | ✅ 一致 |
| | S3読み取り | grantRead | 設計書に記載 | ✅ 一致 |
| | CloudWatch Metrics | PutMetricData | 設計書に記載 | ✅ 一致 |
| **Export** | DynamoDB読み取り | grantReadData | 設計書に記載 | ✅ 一致 |
| | DynamoDB読み書き（export_status） | grantReadWriteData | 設計書に記載 | ✅ 一致 |
| | S3読み書き | grantPut, grantRead | 設計書に記載 | ✅ 一致 |
| | CloudWatch Metrics | PutMetricData | 設計書に記載 | ✅ 一致 |
| **Collect** | Lambda呼び出し | grantInvoke | 設計書に記載 | ✅ 一致 |
| | CloudWatch Metrics | PutMetricData | 設計書に記載 | ✅ 一致 |
| **Collect Status** | DynamoDB読み取り | grantReadData | 設計書に記載 | ✅ 一致 |
| | CloudWatch Metrics | PutMetricData | 設計書に記載 | ✅ 一致 |

**問題点:**
- なし（最小権限の原則に従っている）

##### ⚠️ API Gateway構成

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **REST API** | | | |
| - ステージ名 | prod | prod | ✅ 一致 |
| - スロットリング | 100req/s, 200burst | 100req/s, 200burst | ✅ 一致 |
| - ログレベル | INFO | INFO | ✅ 一致 |
| - CORS | ALL_ORIGINS | ALL_ORIGINS | ⚠️ 本番では制限推奨 |
| **APIキー** | | | |
| - 認証 | 必須（apiKeyRequired: true） | 必須 | ✅ 一致 |
| - Usage Plan | 100req/s, 10000req/月 | 設計書に記載 | ✅ 一致 |
| **WAF** | | | |
| - レート制限 | 2000req/5分 | 2000req/5分 | ✅ 一致 |
| - マネージドルール | CommonRuleSet, KnownBadInputs | 設計書に記載 | ✅ 一致 |

**問題点:**
- ⚠️ **CORS設定**: 本番環境では特定のオリジンに制限すべき（現在はALL_ORIGINS）

##### ❌ Secrets Manager構成

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **APIキー** | | | |
| - シークレット名 | /tdnet/api-key | /tdnet/api-key | ✅ 一致 |
| - 暗号化 | AWS管理キー | AWS管理キー | ✅ 一致 |
| - 削除保護 | RETAIN | RETAIN | ✅ 一致 |
| - 自動ローテーション | 未実装（TODO） | 90日ごと | ❌ 未実装 |
| **環境変数での使用** | | | |
| - Query Lambda | unsafeUnwrap() | ❌ 非推奨 | ❌ セキュリティリスク |
| - Export Lambda | unsafeUnwrap() | ❌ 非推奨 | ❌ セキュリティリスク |

**重大な問題:**
- ❌ **環境変数にシークレット値を直接設定**: `unsafeUnwrap()`を使用して環境変数に直接設定している。これはセキュリティベストプラクティスに反する
- ❌ **自動ローテーション未実装**: 設計書では90日ごとの自動ローテーションを推奨しているが、未実装

##### ❌ 監視・アラート構成

| 項目 | CDK実装 | 設計書 | 整合性 |
|------|---------|--------|--------|
| **CloudWatch Logs** | | | |
| - ロググループ | 未実装 | 保持期間設定あり | ❌ 未実装 |
| **CloudWatch Metrics** | | | |
| - カスタムメトリクス | 未実装 | 3個（DisclosuresCollected, DisclosuresFailed, CollectionSuccessRate） | ❌ 未実装 |
| **CloudWatch Alarms** | | | |
| - アラーム | 未実装 | エラー率、Duration等 | ❌ 未実装 |
| **CloudWatch Dashboard** | | | |
| - ダッシュボード | 未実装 | tdnet-collector-dashboard | ❌ 未実装 |
| **SNS Topic** | | | |
| - アラート通知 | 未実装 | tdnet-alerts | ❌ 未実装 |
| **CloudTrail** | | | |
| - 証跡 | 未実装 | tdnet-audit-trail | ❌ 未実装 |

**重大な問題:**
- ❌ **監視機能が全く実装されていない**: CloudWatch Logs、Metrics、Alarms、Dashboard、SNS、CloudTrailのすべてが未実装

#### 3.4 整合性確認サマリー

**✅ 一致している項目（9カテゴリ）:**
1. Lambda関数の基本構成（タイムアウト、メモリ、環境変数）
2. DynamoDBテーブル構造（パーティションキー、GSI、TTL）
3. S3バケット基本構成（暗号化、バージョニング、ライフサイクル）
4. IAMロール・ポリシー（最小権限の原則）
5. API Gateway基本構成（スロットリング、ログレベル）
6. APIキー認証（Usage Plan）
7. WAF設定（レート制限、マネージドルール）
8. Secrets Manager基本構成（シークレット名、暗号化）
9. CloudFormation Outputs（すべてのリソース名）

**⚠️ 部分的に不一致（3カテゴリ）:**
1. Lambda関数の環境分離（開発/本番）
2. CloudFront OAI（ダッシュボードバケット）
3. CORS設定（本番環境での制限）

**❌ 未実装（2カテゴリ）:**
1. Secrets Managerの自動ローテーション
2. 監視・アラート機能（CloudWatch Logs/Metrics/Alarms/Dashboard、SNS、CloudTrail）

**🔴 セキュリティリスク（1カテゴリ）:**
1. 環境変数へのシークレット値直接設定（unsafeUnwrap()）



## 成果物

### 整合性確認結果レポート

**確認日時:** 2026-02-08 15:14

**確認対象:**
- CDK構成: `cdk/lib/tdnet-data-collector-stack.ts`
- 設計書: `.kiro/specs/tdnet-data-collector/docs/design.md`

**整合性スコア:**
- ✅ 完全一致: 9カテゴリ（60%）
- ⚠️ 部分的不一致: 3カテゴリ（20%）
- ❌ 未実装: 2カテゴリ（13%）
- 🔴 セキュリティリスク: 1カテゴリ（7%）

### 改善提案（優先度順）

#### 🔴 Critical（即座に対応が必要）

**1. Secrets Managerの環境変数使用を修正**

**問題:**
- Query LambdaとExport Lambdaで`unsafeUnwrap()`を使用してシークレット値を環境変数に直接設定
- 環境変数はCloudWatch Logsに記録される可能性があり、セキュリティリスク

**推奨対応:**
```typescript
// ❌ 現在の実装（セキュリティリスク）
environment: {
    API_KEY: apiKeyValue.secretValue.unsafeUnwrap(),
}

// ✅ 推奨実装
environment: {
    API_KEY_SECRET_ARN: apiKeyValue.secretArn, // ARNのみを環境変数に設定
}

// Lambda関数内でシークレット値を取得
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManagerClient({ region: 'ap-northeast-1' });
const secretArn = process.env.API_KEY_SECRET_ARN!;

const response = await secretsManager.send(new GetSecretValueCommand({
    SecretId: secretArn,
}));

const apiKey = JSON.parse(response.SecretString!).apiKey;
```

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`: Query Lambda、Export Lambda
- `src/lambda/query/index.ts`: シークレット取得ロジック追加
- `src/lambda/export/index.ts`: シークレット取得ロジック追加

**工数:** 2時間

---

#### 🟠 High（早急に対応すべき）

**2. 監視・アラート機能の実装**

**問題:**
- CloudWatch Logs、Metrics、Alarms、Dashboard、SNS、CloudTrailが全く実装されていない
- 本番運用時にトラブルシューティングが困難

**推奨対応:**

**Phase 1: CloudWatch Logs（優先度: 最高）**
```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

const collectorLogGroup = new logs.LogGroup(this, 'CollectorLogGroup', {
    logGroupName: `/aws/lambda/${collectorFunction.functionName}`,
    retention: logs.RetentionDays.THREE_MONTHS,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
});
```

**Phase 2: CloudWatch Alarms（優先度: 高）**
```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';

const errorAlarm = new cloudwatch.Alarm(this, 'CollectorErrorAlarm', {
    metric: collectorFunction.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
    }),
    threshold: 5,
    evaluationPeriods: 2,
    alarmDescription: 'Collector function error rate is too high',
});
```

**Phase 3: SNS Topic（優先度: 高）**
```typescript
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

const alertTopic = new sns.Topic(this, 'AlertTopic', {
    topicName: 'tdnet-alerts',
    displayName: 'TDnet Data Collector Alerts',
});

alertTopic.addSubscription(
    new subscriptions.EmailSubscription(process.env.ALERT_EMAIL!)
);

errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
```

**Phase 4: CloudTrail（優先度: 中）**
```typescript
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

const trail = new cloudtrail.Trail(this, 'TdnetTrail', {
    trailName: 'tdnet-audit-trail',
    bucket: this.cloudtrailLogsBucket,
    sendToCloudWatchLogs: true,
    includeGlobalServiceEvents: true,
    managementEvents: cloudtrail.ReadWriteType.ALL,
});

trail.addS3EventSelector([{ bucket: this.pdfsBucket }], {
    readWriteType: cloudtrail.ReadWriteType.ALL,
});
```

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`: 監視リソース追加
- 環境変数: `ALERT_EMAIL`追加

**工数:** 8時間

---

**3. 環境分離の実装**

**問題:**
- 開発環境と本番環境で同じ設定を使用
- 設計書では環境ごとに異なるタイムアウト、メモリ、ログレベルを推奨

**推奨対応:**
```typescript
export interface TdnetStackProps extends cdk.StackProps {
    environment: 'dev' | 'prod';
}

export class TdnetDataCollectorStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: TdnetStackProps) {
        super(scope, id, props);
        
        const config = this.getConfig(props.environment);
        
        const collectorFunction = new lambda.Function(this, 'CollectorFunction', {
            timeout: config.collectorTimeout,
            memorySize: config.lambdaMemory,
            environment: {
                LOG_LEVEL: config.logLevel,
            },
        });
    }
    
    private getConfig(env: 'dev' | 'prod') {
        const configs = {
            dev: {
                collectorTimeout: cdk.Duration.minutes(5),
                lambdaMemory: 256,
                logLevel: 'DEBUG',
            },
            prod: {
                collectorTimeout: cdk.Duration.minutes(15),
                lambdaMemory: 512,
                logLevel: 'INFO',
            },
        };
        return configs[env];
    }
}
```

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`: 環境分離ロジック追加
- `cdk/bin/tdnet-data-collector.ts`: 環境パラメータ追加

**工数:** 3時間

---

#### 🟡 Medium（計画的に対応）

**4. CloudFront OAIの実装**

**問題:**
- ダッシュボードバケットにCloudFront OAIが設定されていない
- 設計書ではCloudFront経由でのみアクセスを推奨

**推奨対応:**
```typescript
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const oai = new cloudfront.OriginAccessIdentity(this, 'DashboardOAI', {
    comment: 'OAI for TDnet Dashboard',
});

this.dashboardBucket.grantRead(oai);

const distribution = new cloudfront.Distribution(this, 'DashboardDistribution', {
    defaultBehavior: {
        origin: new origins.S3Origin(this.dashboardBucket, {
            originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    },
    defaultRootObject: 'index.html',
});
```

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`: CloudFront追加

**工数:** 2時間

---

**5. CORS設定の環境別制限**

**問題:**
- 本番環境でもCORSが`ALL_ORIGINS`に設定されている
- セキュリティリスク

**推奨対応:**
```typescript
defaultCorsPreflightOptions: {
    allowOrigins: props.environment === 'prod' 
        ? ['https://your-domain.com'] 
        : apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: [
        'Content-Type',
        'X-Amz-Date',
        'Authorization',
        'X-Api-Key',
        'X-Amz-Security-Token',
    ],
    allowCredentials: true,
}
```

**影響範囲:**
- `cdk/lib/tdnet-data-collector-stack.ts`: CORS設定修正

**工数:** 1時間

---

**6. Secrets Manager自動ローテーションの実装**

**問題:**
- 設計書では90日ごとの自動ローテーションを推奨しているが、未実装

**推奨対応:**
```typescript
// Phase 4で実装予定
const rotationFunction = new lambda.Function(this, 'ApiKeyRotationFunction', {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('dist/src/lambda/rotation'),
    timeout: cdk.Duration.minutes(5),
});

apiKeyValue.addRotationSchedule('RotationSchedule', {
    rotationLambda: rotationFunction,
    automaticallyAfter: cdk.Duration.days(90),
});
```

**影響範囲:**
- `cdk/lib/constructs/secrets-manager.ts`: ローテーション設定追加
- `src/lambda/rotation/index.ts`: ローテーションLambda実装

**工数:** 4時間

---

### 改善実施計画

**Phase 1（即座に対応）: セキュリティリスク解消**
- [ ] 1. Secrets Managerの環境変数使用を修正（2時間）

**Phase 2（1週間以内）: 監視機能実装**
- [ ] 2-1. CloudWatch Logs実装（2時間）
- [ ] 2-2. CloudWatch Alarms実装（2時間）
- [ ] 2-3. SNS Topic実装（2時間）
- [ ] 3. 環境分離の実装（3時間）

**Phase 3（2週間以内）: 運用改善**
- [ ] 2-4. CloudTrail実装（2時間）
- [ ] 4. CloudFront OAI実装（2時間）
- [ ] 5. CORS設定の環境別制限（1時間）

**Phase 4（1ヶ月以内）: 長期的改善**
- [ ] 6. Secrets Manager自動ローテーション（4時間）

**総工数:** 約20時間

---

## 次回への申し送り

### 未完了の作業

なし（レビュー完了）

### 注意点

1. **セキュリティリスク**: Secrets Managerの環境変数使用は最優先で修正すること
2. **監視機能**: 本番運用前に必ずCloudWatch Logs/Alarms/SNSを実装すること
3. **環境分離**: 開発環境と本番環境で異なる設定を使用すること
4. **CloudTrail**: 監査ログは法令遵守のため、本番環境では必須

### 推奨される次のタスク

1. **Phase 1実装**: Secrets Managerの環境変数使用修正
2. **Phase 2実装**: 監視機能（CloudWatch Logs/Alarms/SNS）
3. **Phase 3実装**: 環境分離、CloudFront OAI、CORS設定

---

**作業完了日時:** 2026-02-08 15:14

---
inclusion: fileMatch
fileMatchPattern: '**/cdk/**/*.ts|**/lambda/**/*.ts|**/.env*'
---

# 環境変数一覧

TDnet Data Collectorプロジェクトで使用する環境変数。

## 必須環境変数

| 変数名 | 説明 | 例 | 設定場所 |
|--------|------|-----|---------|
| S3_BUCKET_NAME | PDFファイル保存先 | `tdnet-pdfs-prod` | Lambda環境変数 |
| DYNAMODB_TABLE_NAME | 開示情報テーブル名 | `tdnet-disclosures` | Lambda環境変数 |
| ALERT_TOPIC_ARN | エラーアラート送信先 | `arn:aws:sns:...` | Lambda環境変数 |
| API_KEY | API Gateway認証用 | `xxxxxxxx` | SSM Parameter Store |
| LOG_LEVEL | ログレベル | `info` / `debug` | Lambda環境変数 |

## オプション環境変数

### スクレイピング設定

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| SCRAPING_RATE_LIMIT | `2` | リクエスト間隔（秒） |
| SCRAPING_MAX_RETRIES | `3` | 最大再試行回数 |
| SCRAPING_TIMEOUT | `30000` | タイムアウト（ミリ秒） |
| SCRAPING_CONCURRENCY | `2` | 並行リクエスト数 |

### バッチ処理設定

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| BATCH_SIZE | `100` | 一度に処理する件数 |
| BATCH_DATE_RANGE_DAYS | `7` | 遡って収集する日数 |

### エラーハンドリング

| 変数名 | デフォルト値 | 説明 |
|--------|------------|------|
| ERROR_THRESHOLD | `10` | エラーアラート閾値 |
| CIRCUIT_BREAKER_THRESHOLD | `5` | サーキットブレーカー閾値 |
| CIRCUIT_BREAKER_TIMEOUT | `60000` | タイムアウト（ミリ秒） |

## 環境別設定

### 開発環境（dev）

```bash
S3_BUCKET_NAME=tdnet-pdfs-dev
DYNAMODB_TABLE_NAME=tdnet-disclosures-dev
LOG_LEVEL=debug
BATCH_SIZE=50
BATCH_DATE_RANGE_DAYS=3
```

### 本番環境（prod）

```bash
S3_BUCKET_NAME=tdnet-pdfs-prod
DYNAMODB_TABLE_NAME=tdnet-disclosures-prod
LOG_LEVEL=info
BATCH_SIZE=100
BATCH_DATE_RANGE_DAYS=7
```

## CDKでの設定

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    environment: {
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
        SCRAPING_RATE_LIMIT: '2',
        SCRAPING_MAX_RETRIES: '3',
        BATCH_SIZE: props.environment === 'prod' ? '100' : '50',
    },
});
```

## SSM Parameter Storeでの設定

```bash
# APIキーの設定
aws ssm put-parameter \
  --name /tdnet/prod/api-key \
  --value "your-api-key-here" \
  --type SecureString

# APIキーの取得
aws ssm get-parameter \
  --name /tdnet/prod/api-key \
  --with-decryption
```

## 環境変数の検証

```typescript
// config.ts
function loadConfig(): Config {
    const required = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME', 'ALERT_TOPIC_ARN'];
    
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Required environment variable ${key} is not set`);
        }
    }
    
    return {
        s3BucketName: process.env.S3_BUCKET_NAME!,
        dynamoTableName: process.env.DYNAMODB_TABLE_NAME!,
        alertTopicArn: process.env.ALERT_TOPIC_ARN!,
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
        scrapingRateLimit: parseInt(process.env.SCRAPING_RATE_LIMIT || '2', 10),
        batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    };
}
```

## セキュリティベストプラクティス

### 機密情報の管理

- APIキーは必ずSSM Parameter StoreまたはSecrets Managerで管理
- 環境変数に直接機密情報を設定しない
- ログに機密情報を出力しない

### 環境変数の暗号化

```typescript
// Lambda環境変数の暗号化（CDK）
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    environmentEncryption: kms.Key.fromKeyArn(this, 'EnvKey', 'arn:aws:kms:...'),
});
```

### アクセス制御

```typescript
// SSM Parameter Storeへのアクセス権限
collectorFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: [`arn:aws:ssm:ap-northeast-1:123456789012:parameter/tdnet/${props.environment}/*`],
}));
```

## トラブルシューティング

### 環境変数が設定されていない

```bash
# Lambda環境変数の確認
aws lambda get-function-configuration \
  --function-name tdnet-collector-prod \
  --query 'Environment.Variables'
```

### SSM Parameter Storeから取得できない

```bash
# IAMロールの確認
aws lambda get-function \
  --function-name tdnet-collector-prod \
  --query 'Configuration.Role'
```

## 関連ドキュメント

- `deployment-checklist.md` - 環境変数の設定確認
- `../security/security-best-practices.md` - 機密情報の管理

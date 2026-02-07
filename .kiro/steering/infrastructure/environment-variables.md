---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/**/*-stack.ts|**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts|**/lambda/**/index.ts|**/lambda/**/handler.ts|**/.env*|**/config/**/*.ts'
---

# 環境変数一覧

このファイルは、TDnet Data Collectorプロジェクトで使用するすべての環境変数をまとめたものです。

## 必須環境変数

### AWS リソース

| 変数名 | 説明 | 例 | 設定場所 |
|--------|------|-----|---------|
| S3_BUCKET_NAME | PDFファイル保存先S3バケット名 | `tdnet-pdfs-prod` | Lambda環境変数 |
| DYNAMODB_TABLE_NAME | 開示情報メタデータテーブル名 | `tdnet-disclosures` | Lambda環境変数 |
| ALERT_TOPIC_ARN | エラーアラート送信先SNSトピックARN | `arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts` | Lambda環境変数 |

### API認証

| 変数名 | 説明 | 例 | 設定場所 |
|--------|------|-----|---------|
| API_KEY | API Gateway認証用APIキー | `xxxxxxxxxxxxxxxx` | SSM Parameter Store |
| API_KEY_HASH | APIキーのハッシュ値（検証用） | `sha256:...` | Lambda環境変数 |

### ログ設定

| 変数名 | 説明 | 例 | 設定場所 |
|--------|------|-----|---------|
| LOG_LEVEL | ログレベル | `info` / `debug` / `warn` / `error` | Lambda環境変数 |
| LOG_FORMAT | ログ出力形式 | `json` / `text` | Lambda環境変数 |

## オプション環境変数

### スクレイピング設定

| 変数名 | 説明 | デフォルト値 | 設定場所 |
|--------|------|------------|---------|
| SCRAPING_RATE_LIMIT | リクエスト間隔（秒） | `2` | Lambda環境変数 |
| SCRAPING_MAX_RETRIES | 最大再試行回数 | `3` | Lambda環境変数 |
| SCRAPING_TIMEOUT | タイムアウト（ミリ秒） | `30000` | Lambda環境変数 |
| SCRAPING_USER_AGENT | User-Agentヘッダー | `TDnet-Data-Collector/1.0` | Lambda環境変数 |
| SCRAPING_CONCURRENCY | 並行リクエスト数 | `2` | Lambda環境変数 |

### バッチ処理設定

| 変数名 | 説明 | デフォルト値 | 設定場所 |
|--------|------|------------|---------|
| BATCH_SIZE | 一度に処理する件数 | `100` | Lambda環境変数 |
| BATCH_INTERVAL | バッチ実行間隔（cron） | `0 18 * * ? *` | EventBridge |
| BATCH_DATE_RANGE_DAYS | 遡って収集する日数 | `7` | Lambda環境変数 |

### キャッシュ設定

| 変数名 | 説明 | デフォルト値 | 設定場所 |
|--------|------|------------|---------|
| CACHE_ENABLED | キャッシュ有効化 | `true` | Lambda環境変数 |
| CACHE_TTL | キャッシュ有効期限（秒） | `3600` | Lambda環境変数 |

### エラーハンドリング

| 変数名 | 説明 | デフォルト値 | 設定場所 |
|--------|------|------------|---------|
| ERROR_THRESHOLD | エラーアラート閾値 | `10` | Lambda環境変数 |
| CIRCUIT_BREAKER_THRESHOLD | サーキットブレーカー閾値 | `5` | Lambda環境変数 |
| CIRCUIT_BREAKER_TIMEOUT | サーキットブレーカータイムアウト（ミリ秒） | `60000` | Lambda環境変数 |

## 環境別設定

### 開発環境（dev）

```bash
# AWS リソース
S3_BUCKET_NAME=tdnet-pdfs-dev
DYNAMODB_TABLE_NAME=tdnet-disclosures-dev
ALERT_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts-dev

# ログ設定
LOG_LEVEL=debug
LOG_FORMAT=json

# スクレイピング設定
SCRAPING_RATE_LIMIT=2
SCRAPING_MAX_RETRIES=3
SCRAPING_TIMEOUT=30000

# バッチ処理設定
BATCH_SIZE=50
BATCH_DATE_RANGE_DAYS=3
```

### 本番環境（prod）

```bash
# AWS リソース
S3_BUCKET_NAME=tdnet-pdfs-prod
DYNAMODB_TABLE_NAME=tdnet-disclosures-prod
ALERT_TOPIC_ARN=arn:aws:sns:ap-northeast-1:123456789012:tdnet-alerts-prod

# ログ設定
LOG_LEVEL=info
LOG_FORMAT=json

# スクレイピング設定
SCRAPING_RATE_LIMIT=2
SCRAPING_MAX_RETRIES=3
SCRAPING_TIMEOUT=30000

# バッチ処理設定
BATCH_SIZE=100
BATCH_DATE_RANGE_DAYS=7
```

## 環境変数の設定方法

### CDKでの設定

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    environment: {
        S3_BUCKET_NAME: pdfBucket.bucketName,
        DYNAMODB_TABLE_NAME: table.tableName,
        ALERT_TOPIC_ARN: alertTopic.topicArn,
        LOG_LEVEL: props.environment === 'prod' ? 'info' : 'debug',
        LOG_FORMAT: 'json',
        SCRAPING_RATE_LIMIT: '2',
        SCRAPING_MAX_RETRIES: '3',
        SCRAPING_TIMEOUT: '30000',
        SCRAPING_USER_AGENT: 'TDnet-Data-Collector/1.0 (your-email@example.com)',
        SCRAPING_CONCURRENCY: '2',
        BATCH_SIZE: props.environment === 'prod' ? '100' : '50',
        BATCH_DATE_RANGE_DAYS: props.environment === 'prod' ? '7' : '3',
        CACHE_ENABLED: 'true',
        CACHE_TTL: '3600',
        ERROR_THRESHOLD: '10',
        CIRCUIT_BREAKER_THRESHOLD: '5',
        CIRCUIT_BREAKER_TIMEOUT: '60000',
    },
});
```

### SSM Parameter Storeでの設定

```bash
# APIキーの設定（SecureString）
aws ssm put-parameter \
  --name /tdnet/prod/api-key \
  --value "your-api-key-here" \
  --type SecureString \
  --description "TDnet API Key for production"

# APIキーの取得
aws ssm get-parameter \
  --name /tdnet/prod/api-key \
  --with-decryption
```

### Secrets Managerでの設定

```bash
# APIキーの設定
aws secretsmanager create-secret \
  --name tdnet/prod/api-key \
  --description "TDnet API Key for production" \
  --secret-string "your-api-key-here"

# APIキーの取得
aws secretsmanager get-secret-value \
  --secret-id tdnet/prod/api-key
```

## 環境変数の検証

### 起動時検証

```typescript
// config.ts
interface Config {
    s3BucketName: string;
    dynamoTableName: string;
    alertTopicArn: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logFormat: 'json' | 'text';
    scrapingRateLimit: number;
    scrapingMaxRetries: number;
    scrapingTimeout: number;
    scrapingUserAgent: string;
    scrapingConcurrency: number;
    batchSize: number;
    batchDateRangeDays: number;
    cacheEnabled: boolean;
    cacheTTL: number;
    errorThreshold: number;
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
}

function loadConfig(): Config {
    const required = [
        'S3_BUCKET_NAME',
        'DYNAMODB_TABLE_NAME',
        'ALERT_TOPIC_ARN',
    ];
    
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
        logFormat: (process.env.LOG_FORMAT as any) || 'json',
        scrapingRateLimit: parseInt(process.env.SCRAPING_RATE_LIMIT || '2', 10),
        scrapingMaxRetries: parseInt(process.env.SCRAPING_MAX_RETRIES || '3', 10),
        scrapingTimeout: parseInt(process.env.SCRAPING_TIMEOUT || '30000', 10),
        scrapingUserAgent: process.env.SCRAPING_USER_AGENT || 'TDnet-Data-Collector/1.0',
        scrapingConcurrency: parseInt(process.env.SCRAPING_CONCURRENCY || '2', 10),
        batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
        batchDateRangeDays: parseInt(process.env.BATCH_DATE_RANGE_DAYS || '7', 10),
        cacheEnabled: process.env.CACHE_ENABLED === 'true',
        cacheTTL: parseInt(process.env.CACHE_TTL || '3600', 10),
        errorThreshold: parseInt(process.env.ERROR_THRESHOLD || '10', 10),
        circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5', 10),
        circuitBreakerTimeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
    };
}

export const config = loadConfig();
```

## セキュリティのベストプラクティス

### 1. 機密情報の管理

- APIキーは**必ず**SSM Parameter StoreまたはSecrets Managerで管理
- 環境変数に直接機密情報を設定しない
- ログに機密情報を出力しない

### 2. 環境変数の暗号化

```typescript
// Lambda環境変数の暗号化（CDK）
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    // ...
    environmentEncryption: kms.Key.fromKeyArn(
        this,
        'EnvKey',
        'arn:aws:kms:ap-northeast-1:123456789012:key/...'
    ),
});
```

### 3. アクセス制御

```typescript
// SSM Parameter Storeへのアクセス権限
collectorFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['ssm:GetParameter'],
    resources: [
        `arn:aws:ssm:ap-northeast-1:123456789012:parameter/tdnet/${props.environment}/*`,
    ],
}));
```

## トラブルシューティング

### 環境変数が設定されていない

**症状**: Lambda起動時に「Required environment variable XXX is not set」エラー

**対処法**:
1. Lambda関数の設定を確認
2. CDKコードで環境変数が設定されているか確認
3. デプロイ後に環境変数が反映されているか確認

```bash
# Lambda環境変数の確認
aws lambda get-function-configuration \
  --function-name tdnet-collector-prod \
  --query 'Environment.Variables'
```

### SSM Parameter Storeから取得できない

**症状**: 「AccessDeniedException」エラー

**対処法**:
1. IAMロールに適切な権限があるか確認
2. パラメータ名が正しいか確認
3. リージョンが一致しているか確認

```bash
# IAMロールの確認
aws lambda get-function \
  --function-name tdnet-collector-prod \
  --query 'Configuration.Role'

# IAMポリシーの確認
aws iam get-role-policy \
  --role-name tdnet-collector-role \
  --policy-name SSMParameterAccess
```

## 関連ドキュメント

- **実装ルール**: `tdnet-implementation-rules.md` - 環境変数の使用方法
- **デプロイチェックリスト**: `deployment-checklist.md` - 環境変数の確認手順
- **セキュリティ**: `security-best-practices.md` - 機密情報の管理方法

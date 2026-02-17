---
inclusion: fileMatch
fileMatchPattern: '**/.env*|**/config/**/*.ts|**/cdk/lib/config/**/*.ts'
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

## 環境変数の検証

```typescript
function loadConfig(): Config {
    const required = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME', 'ALERT_TOPIC_ARN'];
    for (const key of required) {
        if (!process.env[key]) throw new Error(`Required: ${key}`);
    }
    return {
        s3BucketName: process.env.S3_BUCKET_NAME!,
        dynamoTableName: process.env.DYNAMODB_TABLE_NAME!,
        alertTopicArn: process.env.ALERT_TOPIC_ARN!,
        logLevel: process.env.LOG_LEVEL || 'info',
        scrapingRateLimit: parseInt(process.env.SCRAPING_RATE_LIMIT || '2', 10),
    };
}
```

## セキュリティ

- APIキーはSSM Parameter Store/Secrets Managerで管理
- 環境変数に機密情報を設定しない
- Lambda環境変数は暗号化（KMS）

## 関連ドキュメント

- `deployment-checklist.md` - 環境変数の設定確認
- `../security/security-best-practices.md` - 機密情報の管理

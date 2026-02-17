---
inclusion: fileMatch
fileMatchPattern: '**/lambda/**/handler.ts|**/lambda/**/index.ts'
---

# Lambda実装ガイド

## メモリとタイムアウト

| 関数タイプ | メモリ | タイムアウト |
|-----------|--------|------------|
| Collector（スクレイピング） | 512MB | 15分 |
| Parser（PDF解析） | 1024MB | 5分 |
| Query（API） | 256MB | 30秒 |
| Export（大量データ） | 1024MB | 15分 |

## 環境変数検証

```typescript
function loadConfig(): Config {
    const required = ['S3_BUCKET_NAME', 'DYNAMODB_TABLE_NAME', 'ALERT_TOPIC_ARN'];
    for (const key of required) {
        if (!process.env[key]) throw new Error(`${key} is not set`);
    }
    return {
        s3BucketName: process.env.S3_BUCKET_NAME!,
        dynamoTableName: process.env.DYNAMODB_TABLE_NAME!,
        alertTopicArn: process.env.ALERT_TOPIC_ARN!,
        logLevel: (process.env.LOG_LEVEL as any) || 'info',
    };
}
```

## エラーハンドリング

```typescript
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        logger.info('Lambda invoked', { requestId: context.requestId });
        const result = await processEvent(event);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'success', data: result }),
        };
    } catch (error) {
        logger.error('Lambda execution failed', { requestId: context.requestId, error });
        return toErrorResponse(error as Error, context.requestId);
    }
};
```

**詳細実装:**
- `error-handling-implementation.md` - 再試行戦略、AWS SDK設定、DLQ
- `../api/error-codes.md` - エラーコードマップ
- `../core/error-handling-patterns.md` - エラー分類

## パフォーマンス最適化

```typescript
// グローバルスコープで初期化（コールドスタート対策）
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'ap-northeast-1' });
const config = {
    tableName: process.env.DYNAMODB_TABLE_NAME!,
    bucketName: process.env.S3_BUCKET_NAME!,
};

export const handler = async (event: any): Promise<any> => {
    const result = await docClient.send(new GetCommand({
        TableName: config.tableName,
        Key: { disclosure_id: event.id },
    }));
    return result.Item;
};
```

**詳細最適化:** `../infrastructure/performance-optimization.md`

## 実装チェックリスト

- [ ] 必須環境変数検証
- [ ] エラーハンドリング実装
- [ ] メモリ・タイムアウト設定
- [ ] コールドスタート対策
- [ ] 構造化ログ

## 関連ドキュメント

- `../core/error-handling-patterns.md` - エラーハンドリング基本
- `error-handling-implementation.md` - 詳細実装
- `../infrastructure/environment-variables.md` - 環境変数
- `../infrastructure/performance-optimization.md` - 最適化
- `testing-strategy.md` - テスト戦略

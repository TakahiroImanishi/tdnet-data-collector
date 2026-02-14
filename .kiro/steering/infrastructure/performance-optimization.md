---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts|**/dynamodb/**/*.ts|**/s3/**/*.ts|**/lambda/**/*.ts'
---

# パフォーマンス最適化

## Lambda設定

| 関数 | メモリ | タイムアウト |
|------|--------|------------|
| Collector | 512MB | 15分 |
| Parser | 1024MB | 5分 |
| Query | 256MB | 30秒 |
| Export | 1024MB | 15分 |

## コールドスタート対策

```typescript
// グローバルスコープで初期化
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const config = { tableName: process.env.DYNAMODB_TABLE_NAME!, bucketName: process.env.S3_BUCKET_NAME! };

export const handler = async (event: any) => { /* 初期化済みクライアント使用 */ };
```

CDK:
```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    bundling: { minify: true, target: 'es2022', externalModules: ['@aws-sdk/*'] }
});
```

## DynamoDB最適化

```typescript
// Query（GSI使用）
const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI_DatePartition',
    KeyConditionExpression: 'date_partition = :partition',
    ExpressionAttributeValues: { ':partition': '2024-01' },
    ScanIndexForward: false,
}));

// Projection Expression
const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { disclosure_id: id },
    ProjectionExpression: 'disclosure_id, company_code, title, disclosed_at',
}));
```

## 並行処理

```typescript
// Promise.allSettled
const results = await Promise.allSettled(disclosures.map(d => processDisclosure(d)));

// p-limit
import pLimit from 'p-limit';
const limit = pLimit(5);
await Promise.allSettled(disclosures.map(d => limit(() => processDisclosure(d))));
```

## 目標指標

| 指標 | 目標 |
|------|------|
| Lambda実行時間（Collector） | < 5分 |
| Lambda実行時間（Query） | < 1秒 |
| DynamoDBクエリレイテンシ | < 100ms |
| API レスポンスタイム | < 500ms |

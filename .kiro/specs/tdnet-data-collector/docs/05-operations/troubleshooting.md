# トラブルシューティングガイド

**バージョン:** 1.0.0  
**最終更新:** 2026-02-15

TDnet Data Collectorの開発・運用中に発生する可能性のある問題と解決策をまとめたものです。

---

## 関連ドキュメント

- **設計書**: `design.md` - システムアーキテクチャと詳細設計
- **環境セットアップ**: `../04-deployment/environment-setup.md` - 開発環境構築手順
- **メトリクスとKPI**: `metrics-and-kpi.md` - パフォーマンス指標
- **エラーハンドリング**: `../../.kiro/steering/core/error-handling-patterns.md` - エラー処理パターン
- **監視とアラート**: `../../.kiro/steering/infrastructure/monitoring-alerts.md` - CloudWatch設定

---

## Lambda関連

### 問題: Lambda関数がタイムアウトする

**症状:**
```
Task timed out after 900.00 seconds
```

**原因:**
- TDnetからのレスポンスが遅い
- 大量のPDFダウンロードで時間がかかる
- 無限ループやデッドロック

**解決策:**

1. **タイムアウト時間を延長**
   ```typescript
   const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
       timeout: cdk.Duration.minutes(15), // 最大15分
   });
   ```

2. **バッチサイズを削減**
   ```typescript
   const BATCH_SIZE = 10; // 50 → 10に削減
   ```

3. **並列処理を制限**
   ```typescript
   import pMap from 'p-map';
   await pMap(disclosures, processDisclosure, { concurrency: 3 });
   ```

---

### 問題: Lambda関数のメモリ不足

**症状:**
```
Runtime exited with error: signal: killed
Runtime.ExitError
```

**原因:**
- 大きなPDFファイルをメモリに保持
- メモリリーク
- 不適切なバッファ管理

**解決策:**

1. **メモリサイズを増やす**
   ```typescript
   const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
       memorySize: 1024, // 512MB → 1024MBに増加
   });
   ```

2. **ストリーミング処理を使用**
   ```typescript
   const stream = await axios.get(url, { responseType: 'stream' });
   await s3.upload({
       Bucket: bucketName,
       Key: s3Key,
       Body: stream.data,
   }).promise();
   ```

3. **不要なオブジェクトを解放**
   ```typescript
   let pdfBuffer = await downloadPDF(url);
   await uploadToS3(pdfBuffer, s3Key);
   pdfBuffer = null; // 明示的に解放
   ```

---

## DynamoDB関連

### 問題: ConditionalCheckFailedException

**症状:**
```
ConditionalCheckFailedException: The conditional request failed
```

**原因:**
- 重複する開示情報IDの登録試行
- 条件付き書込の条件が満たされない

**解決策:**

```typescript
try {
    await docClient.send(new PutCommand({
        TableName: tableName,
        Item: disclosure,
        ConditionExpression: 'attribute_not_exists(disclosure_id)',
    }));
} catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
        logger.info('Disclosure already exists, skipping', {
            disclosure_id: disclosure.disclosure_id,
        });
        return; // 正常な動作
    }
    throw error;
}
```

---

### 問題: ProvisionedThroughputExceededException

**症状:**
```
ProvisionedThroughputExceededException: The level of configured provisioned throughput for the table was exceeded
```

**原因:**
- 読み書きキャパシティを超えるリクエスト
- ホットパーティション

**解決策:**

1. **オンデマンドモードに変更**
   ```typescript
   const table = new dynamodb.Table(this, 'DisclosuresTable', {
       billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
   });
   ```

2. **バッチ書込を使用**
   ```typescript
   import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
   
   const chunks = chunkArray(disclosures, 25); // 最大25件
   for (const chunk of chunks) {
       await docClient.send(new BatchWriteCommand({
           RequestItems: {
               [tableName]: chunk.map(item => ({
                   PutRequest: { Item: item }
               }))
           }
       }));
   }
   ```

3. **指数バックオフで再試行**
   ```typescript
   await retryWithBackoff(
       () => docClient.send(command),
       { maxRetries: 5, initialDelay: 1000 }
   );
   ```

---

## S3関連

### 問題: AccessDenied エラー

**症状:**
```
AccessDenied: Access Denied
```

**原因:**
- IAMロールに適切な権限がない
- バケットポリシーが制限的
- リージョンが異なる

**解決策:**

1. **IAM権限を確認**
   ```typescript
   pdfBucket.grantReadWrite(collectorFn);
   ```

2. **リージョンを確認**
   ```typescript
   const s3Client = new S3Client({
       region: 'ap-northeast-1', // バケットと同じリージョン
   });
   ```

---

### 問題: NoSuchKey エラー

**症状:**
```
NoSuchKey: The specified key does not exist
```

**原因:**
- S3キーが存在しない
- S3キーのパスが間違っている

**解決策:**

```typescript
try {
    await s3Client.send(new HeadObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
    }));
} catch (error) {
    if (error.name === 'NotFound') {
        logger.error('S3 object not found', { s3Key });
        throw new NotFoundError('PDF file not found', 'pdf', s3Key);
    }
    throw error;
}
```

---

## スクレイピング関連

### 問題: TDnetからのレスポンスが403 Forbidden

**症状:**
```
AxiosError: Request failed with status code 403
```

**原因:**
- User-Agentヘッダーが未設定
- リクエスト頻度が高すぎる
- IPアドレスがブロックされている

**解決策:**

1. **User-Agentを設定**
   ```typescript
   const response = await axios.get(url, {
       headers: {
           'User-Agent': 'TDnetDataCollector/1.0 (Personal Use; contact@example.com)',
       },
   });
   ```

2. **リクエスト間隔を増やす**
   ```typescript
   const DELAY_MS = 3000; // 2秒 → 3秒に増加
   await sleep(DELAY_MS);
   ```

---

### 問題: HTMLパースエラー

**症状:**
```
TypeError: Cannot read property 'text' of undefined
```

**原因:**
- TDnetのHTML構造が変更された
- セレクタが間違っている
- レスポンスが空

**解決策:**

```typescript
const title = $(row).find('.kjTitle a').text().trim();
if (!title) {
    logger.warn('Title not found', { row: $(row).html() });
    continue; // スキップ
}
```

---

## API Gateway関連

### 問題: 429 Too Many Requests

**症状:**
```
{
  "message": "Too Many Requests"
}
```

**原因:**
- 使用量プランのレート制限を超えた
- バーストリミットを超えた

**解決策:**

```typescript
const plan = api.addUsagePlan('UsagePlan', {
    throttle: {
        rateLimit: 100, // 1秒あたり100リクエスト
        burstLimit: 200, // バースト200リクエスト
    },
});
```

---

### 問題: 502 Bad Gateway

**症状:**
```
{
  "message": "Internal server error"
}
```

**原因:**
- Lambda関数がエラーを返している
- Lambda関数がタイムアウトしている
- レスポンス形式が不正

**解決策:**

1. **CloudWatch Logsを確認**
   ```bash
   aws logs tail /aws/lambda/QueryFunction --follow
   ```

2. **レスポンス形式を確認**
   ```typescript
   return {
       statusCode: 200,
       headers: {
           'Content-Type': 'application/json',
       },
       body: JSON.stringify({ data: result }),
   };
   ```

---

## CDK/デプロイ関連

### 問題: cdk deploy が失敗する

**症状:**
```
CREATE_FAILED | AWS::Lambda::Function | CollectorFunction
Resource handler returned message: "The role defined for the function cannot be assumed by Lambda."
```

**原因:**
- IAMロールの信頼関係が不正
- 依存関係の順序が間違っている
- リソース名の重複

**解決策:**

1. **IAMロールの信頼関係を確認**
   ```typescript
   const role = new iam.Role(this, 'LambdaRole', {
       assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
   });
   ```

2. **依存関係を明示**
   ```typescript
   collectorFn.node.addDependency(table);
   collectorFn.node.addDependency(pdfBucket);
   ```

---

## 監視・ログ関連

### 問題: CloudWatch Logsにログが表示されない

**症状:**
- Lambda関数は実行されているが、ログが見つからない

**原因:**
- IAMロールにCloudWatch Logs権限がない
- ログ出力が正しく実装されていない

**解決策:**

1. **IAM権限を確認**
   ```typescript
   collectorFn.addToRolePolicy(new iam.PolicyStatement({
       actions: [
           'logs:CreateLogGroup',
           'logs:CreateLogStream',
           'logs:PutLogEvents',
       ],
       resources: ['*'],
   }));
   ```

2. **ログ出力を確認**
   ```typescript
   console.log(JSON.stringify({ level: 'info', message: 'Test log' }));
   ```

---

## ネットワーク関連

### 問題: ECONNRESET エラー

**症状:**
```
Error: socket hang up
code: 'ECONNRESET'
```

**原因:**
- ネットワーク接続が切断された
- TDnetサーバーが応答を停止した
- タイムアウト

**解決策:**

```typescript
await retryWithBackoff(
    () => axios.get(url),
    { maxRetries: 3, initialDelay: 2000 }
);
```

---

## FAQ

### Q: Lambda関数のログレベルを変更するには?

**A:** 環境変数 `LOG_LEVEL` を設定してください。

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    environment: {
        LOG_LEVEL: 'DEBUG', // DEBUG, INFO, WARN, ERROR
    },
});
```

### Q: DynamoDBのデータをバックアップするには?

**A:** オンデマンドバックアップまたはPITRを使用してください。

```bash
aws dynamodb create-backup \
    --table-name tdnet-disclosures-prod \
    --backup-name tdnet-backup-20240115
```

### Q: S3のコストを削減するには?

**A:** ライフサイクルポリシーを設定してください。

```typescript
pdfBucket.addLifecycleRule({
    transitions: [
        {
            storageClass: s3.StorageClass.STANDARD_IA,
            transitionAfter: cdk.Duration.days(90),
        },
        {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(365),
        },
    ],
});
```

---

## 関連ドキュメント

- **[エラーハンドリングパターン](../../.kiro/steering/core/error-handling-patterns.md)** - エラー処理の詳細
- **[監視とアラート](../../.kiro/steering/infrastructure/monitoring-alerts.md)** - 監視設定
- **[パフォーマンス最適化](../../.kiro/steering/infrastructure/performance-optimization.md)** - 最適化戦略
- **[デプロイチェックリスト](../../.kiro/steering/infrastructure/deployment-checklist.md)** - デプロイ手順

---

**最終更新:** 2026-02-15


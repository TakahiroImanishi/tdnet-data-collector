---
inclusion: fileMatch
fileMatchPattern: '**/cdk/lib/constructs/*lambda*.ts|**/cdk/lib/constructs/*function*.ts|**/dynamodb/**/*.ts|**/s3/**/*.ts|**/lambda/**/*.ts'
---

# パフォーマンス最適化

## Lambda関数の最適化

### メモリとタイムアウトの設定

**基本原則**: メモリを増やすとCPUも比例して増加。実際の使用量の1.5倍を目安に設定。

| 関数タイプ | メモリ | タイムアウト | 理由 |
|-----------|--------|------------|------|
| Collector（スクレイピング） | 512MB | 15分 | ネットワークI/O待機が多い |
| Parser（PDF解析） | 1024MB | 5分 | CPU集約的 |
| Query（API） | 256MB | 30秒 | 軽量なデータ取得 |
| Export（大量データ） | 1024MB | 15分 | メモリ集約的 |

### コールドスタート対策

```typescript
// ❌ 悪い例: 全体をインポート
import * as AWS from 'aws-sdk';

// ✅ 良い例: 必要な部分のみ
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// グローバルスコープで初期化（再利用される）
const dynamoClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const config = {
    tableName: process.env.DYNAMODB_TABLE_NAME!,
    bucketName: process.env.S3_BUCKET_NAME!,
};

export const handler = async (event: any): Promise<any> => {
    // ハンドラー内では初期化済みのクライアントを使用
};
```

### バンドルサイズの最適化

```typescript
const collectorFn = new NodejsFunction(this, 'CollectorFunction', {
    bundling: {
        minify: true,
        target: 'es2022',
        externalModules: ['@aws-sdk/*'], // AWS SDK v3は含めない
    },
});
```

## DynamoDB最適化

### キャパシティモードの選択

| 特性 | オンデマンド | プロビジョニング |
|------|------------|----------------|
| コスト | 高い（従量課金） | 低い（予測可能な負荷） |
| スケーリング | 自動 | 手動/Auto Scaling |
| 適用ケース | 不規則な負荷 | 予測可能な負荷 |

**推奨**: 開発環境はオンデマンド、本番環境は負荷が安定したらプロビジョニング。

### クエリの最適化

```typescript
// ❌ 悪い例: Scan（全テーブルスキャン）
const badResult = await docClient.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: 'company_code = :code',
}));

// ✅ 良い例: Query（GSI使用）
const goodResult = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI_CompanyCode',
    KeyConditionExpression: 'company_code = :code',
    ExpressionAttributeValues: { ':code': '7203' },
    Limit: 100,
}));
```

### date_partitionを使った効率的なクエリ

```typescript
// 月次データの取得
async function getDisclosuresByMonth(yearMonth: string): Promise<Disclosure[]> {
    const result = await docClient.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI_DatePartition',
        KeyConditionExpression: 'date_partition = :partition',
        ExpressionAttributeValues: { ':partition': yearMonth }, // '2024-01'
        ScanIndexForward: false, // 降順（最新から）
    }));
    return result.Items as Disclosure[];
}
```

## 並行処理の最適化

```typescript
// ❌ 悪い例: 1つでも失敗すると全体が失敗
const results = await Promise.all(disclosures.map(d => processDisclosure(d)));

// ✅ 良い例: 個別の成功/失敗を処理
const results = await Promise.allSettled(disclosures.map(d => processDisclosure(d)));
const succeeded = results.filter(r => r.status === 'fulfilled');
const failed = results.filter(r => r.status === 'rejected');
```

### 並行度の制御

```typescript
import pLimit from 'p-limit';

async function processDisclosuresWithLimit(
    disclosures: Disclosure[],
    concurrency: number = 5
): Promise<void> {
    const limit = pLimit(concurrency);
    const promises = disclosures.map(disclosure =>
        limit(() => processDisclosure(disclosure))
    );
    await Promise.allSettled(promises);
}
```

## コスト最適化

### Lambda実行時間の削減

```typescript
// ❌ 悪い例: 逐次処理
for (const disclosure of disclosures) {
    await processDisclosure(disclosure);
}

// ✅ 良い例: 並行処理
await Promise.allSettled(disclosures.map(d => processDisclosure(d)));
```

### DynamoDBのコスト削減

```typescript
// Projection Expressionで必要な属性のみ取得
const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { disclosure_id: id },
    ProjectionExpression: 'disclosure_id, company_code, title, disclosed_at',
}));
```

## パフォーマンス最適化チェックリスト

- [ ] Lambda メモリサイズを実測値の1.5倍に設定
- [ ] コールドスタート対策（依存関係最小化、初期化最適化）
- [ ] DynamoDB GSIを適切に設計（date_partition活用）
- [ ] バッチ操作を使用（BatchGet/BatchWrite）
- [ ] 並行処理の制御（p-limit使用）
- [ ] カスタムメトリクスで継続的監視

## 目標パフォーマンス指標

| 指標 | 目標値 |
|------|--------|
| Lambda実行時間（Collector） | < 5分 |
| Lambda実行時間（Query） | < 1秒 |
| DynamoDBクエリレイテンシ | < 100ms |
| S3アップロードレイテンシ | < 5秒 |
| API レスポンスタイム | < 500ms |
| バッチ処理スループット | > 100件/分 |

## 関連ドキュメント

- `../core/tdnet-implementation-rules.md` - 実装ルール（コスト最適化の基本方針）

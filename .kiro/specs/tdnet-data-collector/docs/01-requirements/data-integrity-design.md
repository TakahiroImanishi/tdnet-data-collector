# データ整合性保証の詳細設計

**作成日時:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 概要

### データ整合性の重要性

TDnet Data Collectorでは、開示情報のメタデータ（DynamoDB）とPDFファイル（S3）を別々のストレージに保存します。
この分散ストレージアーキテクチャでは、整合性の問題が発生する可能性があります。

**潜在的な問題:**
- メタデータは保存されたがPDFアップロードに失敗
- PDFはアップロードされたがメタデータ保存に失敗
- 部分的な失敗後のロールバック漏れ
- ネットワーク障害による不完全な状態

**影響:**
- ユーザーがメタデータを検索できるがPDFをダウンロードできない
- PDFは存在するが検索結果に表示されない
- ストレージコストの無駄（孤立したファイル）

### データモデル

```typescript
interface Disclosure {
    disclosure_id: string;           // プライマリキー
    company_code: string;            // 企業コード
    company_name: string;            // 企業名
    disclosure_type: string;         // 開示種類
    title: string;                   // タイトル
    disclosed_at: string;            // 開示日時（ISO8601）
    date_partition: string;          // 日付パーティション（YYYY-MM）
    pdf_s3_key: string;              // S3オブジェクトキー
    pdf_size: number;                // ファイルサイズ
    status: 'pending' | 'committed' | 'failed';  // トランザクション状態
    temp_s3_key?: string;            // 一時S3キー（pending時のみ）
    created_at: string;              // 作成日時
    updated_at: string;              // 更新日時
}
```

**対応関係の保証:**
- `pdf_s3_key`が指すS3オブジェクトは必ず存在する
- S3に存在するPDFは必ずDynamoDBにメタデータが存在する
- `status='committed'`のレコードのみが完全な状態
- `status='pending'`のレコードは一時的な状態（要検証）
- `status='failed'`のレコードは失敗状態（要調査）

---

## Two-Phase Commitパターン

### パターンの説明

Two-Phase Commit（2相コミット）は、DynamoDBとS3という2つの独立したストレージ間でデータ整合性を保証するためのパターンです。

**フェーズ:**

1. **Phase 1: Prepare（準備フェーズ）**
   - PDFを一時キーでS3にアップロード
   - メタデータを`status='pending'`でDynamoDBに保存
   - 両方が成功したらPhase 2へ進む
   - いずれかが失敗したらロールバック

2. **Phase 2: Commit（コミットフェーズ）**
   - S3オブジェクトを一時キーから正式キーに移動
   - DynamoDBの`status`を`'committed'`に更新
   - 両方が成功したら完了
   - いずれかが失敗したらアラート送信

**利点:**
- 部分的な失敗を検出可能
- ロールバックが容易
- 整合性チェックバッチで自動修復可能
- 監視とアラートが容易

### 実装の要点

**Prepare Phase:**
```typescript
// 1. PDFを一時キーでS3にアップロード
const tempS3Key = `temp/${disclosure_id}.pdf`;
await s3.putObject({ Key: tempS3Key, Body: pdfBuffer });

// 2. date_partitionをPrepare Phase開始時に生成（重要）
const datePartition = generateDatePartition(disclosed_at);

// 3. メタデータをstatus='pending'で保存
await dynamodb.putItem({
    disclosure_id,
    status: 'pending',
    temp_s3_key: tempS3Key,
    date_partition: datePartition,  // ここで確定
    // ...
});
```

**Commit Phase:**
```typescript
// 1. S3オブジェクトを正式キーに移動
const finalS3Key = `pdfs/${disclosure_id}.pdf`;
await s3.copyObject({ CopySource: tempS3Key, Key: finalS3Key });
await s3.deleteObject({ Key: tempS3Key });

// 2. statusを'committed'に更新
await dynamodb.updateItem({
    Key: { disclosure_id },
    UpdateExpression: 'SET #status = :committed, temp_s3_key = :null',
    ExpressionAttributeValues: {
        ':committed': 'committed',
        ':null': null,
    },
});
```

**Rollback:**
```typescript
// Prepare Phase失敗時
if (tempS3KeyUploaded) {
    await s3.deleteObject({ Key: tempS3Key });
}
if (metadataSaved) {
    await dynamodb.deleteItem({ Key: { disclosure_id } });
}
```

**詳細実装**: `../../steering/development/error-handling-implementation.md`

---

## 整合性チェックバッチ

### 目的

定期的に実行し、`status='pending'`または`status='failed'`のレコードを検出して自動修復します。

### チェック項目

| チェック項目 | 検出条件 | 修復アクション |
|------------|---------|--------------|
| 孤立したメタデータ | DynamoDBにレコードあり、S3にPDFなし | メタデータ削除 |
| 孤立したPDF | S3にPDFあり、DynamoDBにレコードなし | PDF削除 |
| Pending状態の長期化 | `status='pending'`が24時間以上 | Commit Phase再実行またはロールバック |
| Failed状態の放置 | `status='failed'`が7日以上 | アラート送信、手動調査 |

### 実装の要点

**基本フロー:**
```typescript
// 1. pending/failedレコードを取得
const inconsistentRecords = await dynamodb.query({
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status IN (:pending, :failed)',
});

// 2. 各レコードをチェック
for (const record of inconsistentRecords) {
    // S3オブジェクトの存在確認
    const pdfExists = await checkS3ObjectExists(record.pdf_s3_key);
    
    if (!pdfExists) {
        // 孤立したメタデータ → 削除
        await dynamodb.deleteItem({ Key: { disclosure_id: record.disclosure_id } });
    } else if (record.status === 'pending' && isOlderThan24Hours(record.created_at)) {
        // Pending長期化 → Commit Phase再実行
        await retryCommitPhase(record);
    }
}

// 3. 孤立したS3オブジェクトをチェック
const orphanedPdfs = await findOrphanedS3Objects();
for (const s3Key of orphanedPdfs) {
    await s3.deleteObject({ Key: s3Key });
}
```

**実行頻度:** 日次（深夜）

**詳細実装**: `../../steering/development/error-handling-implementation.md`

---

## S3 Object Lock設定

### 目的

誤削除や不正な変更からPDFファイルを保護します。

### 設定内容

**Object Lock Mode:** Governance Mode（管理者は削除可能）

**Retention Period:** 90日間（Standard-IAへの移行まで）

**Legal Hold:** 使用しない（通常運用では不要）

### CDK実装例

```typescript
const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
    bucketName: `tdnet-pdfs-${this.account}`,
    objectLockEnabled: true,
    objectLockDefaultRetention: {
        mode: s3.ObjectLockRetentionMode.GOVERNANCE,
        duration: cdk.Duration.days(90),
    },
});
```

**注意:** Object Lock有効化後はバケット削除不可（本番環境のみ推奨）

**詳細**: `../../steering/infrastructure/performance-optimization.md`

---

## DynamoDB Transactionsの活用

### 使用ケース

複数のDynamoDBテーブルを更新する場合にトランザクションを使用します。

**例:** 実行状態テーブル（tdnet_executions）と開示情報テーブル（tdnet_disclosures）の同時更新

### 実装例

```typescript
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

await dynamoClient.send(new TransactWriteCommand({
    TransactItems: [
        {
            Put: {
                TableName: 'tdnet_disclosures',
                Item: { disclosure_id, status: 'committed', /* ... */ },
            },
        },
        {
            Update: {
                TableName: 'tdnet_executions',
                Key: { execution_id },
                UpdateExpression: 'SET collected_count = collected_count + :inc',
                ExpressionAttributeValues: { ':inc': 1 },
            },
        },
    ],
}));
```

**制限:**
- 最大25アイテム/トランザクション
- 同一テーブル内の複数アイテムも可能
- 失敗時は全体がロールバック

**詳細**: AWS DynamoDB Transactions公式ドキュメント

---

## テスト戦略

### ユニットテスト

| テストケース | 検証内容 |
|------------|---------|
| Prepare Phase成功 | PDFアップロード、メタデータ保存、status='pending' |
| Prepare Phase失敗（S3） | ロールバック実行、メタデータ未保存 |
| Prepare Phase失敗（DynamoDB） | S3オブジェクト削除、ロールバック完了 |
| Commit Phase成功 | S3移動、status='committed'、temp_s3_key削除 |
| Commit Phase失敗 | アラート送信、status='failed' |

### 統合テスト

| テストケース | 検証内容 |
|------------|---------|
| 完全なTwo-Phase Commit | Prepare → Commit → 整合性確認 |
| ネットワーク障害シミュレーション | 部分的失敗の検出、ロールバック |
| 整合性チェックバッチ | 孤立データの検出、自動修復 |

### E2Eテスト

| テストケース | 検証内容 |
|------------|---------|
| 大量データ収集 | 100件の開示情報を収集、整合性確認 |
| 障害リカバリー | Lambda再起動後の整合性維持 |

**詳細**: `../../steering/development/testing-strategy.md`

---

## 監視とアラート

### CloudWatchメトリクス

| メトリクス | 説明 | アラート閾値 |
|-----------|------|------------|
| PendingRecordsCount | status='pending'のレコード数 | > 10件でWarning |
| FailedRecordsCount | status='failed'のレコード数 | > 5件でCritical |
| OrphanedPdfsCount | 孤立したPDFファイル数 | > 10件でWarning |
| IntegrityCheckDuration | 整合性チェック実行時間 | > 5分でWarning |

### CloudWatch Alarms

```typescript
const pendingAlarm = new cloudwatch.Alarm(this, 'PendingRecordsAlarm', {
    metric: new cloudwatch.Metric({
        namespace: 'TDnet/Integrity',
        metricName: 'PendingRecordsCount',
        statistic: 'Maximum',
    }),
    threshold: 10,
    evaluationPeriods: 2,
    alarmDescription: 'Too many pending records detected',
});

pendingAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alertTopic));
```

**詳細**: `../../steering/infrastructure/monitoring-alerts.md`

---

## 関連ドキュメント

### 設計ドキュメント
- **[Design Document](./design.md)** - システム全体設計
- **[Requirements](./requirements.md)** - 要件定義（要件2.4: 重複収集の冪等性）
- **[Error Recovery Strategy](./error-recovery-strategy.md)** - エラーリカバリー戦略

### 実装ガイドライン（Steering）
- **[エラーハンドリング実装](../../steering/development/error-handling-implementation.md)** - Two-Phase Commit実装詳細
- **[データバリデーション](../../steering/development/data-validation.md)** - date_partition生成ロジック
- **[テスト戦略](../../steering/development/testing-strategy.md)** - 整合性テスト実装
- **[パフォーマンス最適化](../../steering/infrastructure/performance-optimization.md)** - S3 Object Lock設定
- **[監視とアラート](../../steering/infrastructure/monitoring-alerts.md)** - 整合性監視設定

---

**最終更新:** 2026-02-15

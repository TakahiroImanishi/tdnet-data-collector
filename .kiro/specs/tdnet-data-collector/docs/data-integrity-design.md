# データ整合性保証の詳細設計

**作成日時:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft

---

## 目次

1. [概要](#概要)
2. [Two-Phase Commitパターンの実装](#two-phase-commitパターンの実装)
3. [整合性チェックバッチの実装](#整合性チェックバッチの実装)
4. [S3 Object Lock設定](#s3-object-lock設定)
5. [DynamoDB Transactionsの活用](#dynamodb-transactionsの活用)
6. [テスト戦略](#テスト戦略)
7. [監視とアラート](#監視とアラート)
8. [関連ドキュメント](#関連ドキュメント)

---

## 概要

### データ整合性の重要性

TDnet Data Collectorでは、開示情報のメタデータ（DynamoDB）とPDFファイル（S3）を別々のストレージに保存します。
この分散ストレージアーキテクチャでは、以下のような整合性の問題が発生する可能性があります：

**潜在的な問題:**
- メタデータは保存されたがPDFアップロードに失敗
- PDFはアップロードされたがメタデータ保存に失敗
- 部分的な失敗後のロールバック漏れ
- ネットワーク障害による不完全な状態

**影響:**
- ユーザーがメタデータを検索できるがPDFをダウンロードできない
- PDFは存在するが検索結果に表示されない
- ストレージコストの無駄（孤立したファイル）
- データの信頼性低下

### メタデータとPDFの対応関係

**データモデル:**

```typescript
interface Disclosure {
    // プライマリキー
    disclosure_id: string;           // 例: "20240115_7203_001"
    
    // メタデータ
    company_code: string;            // 企業コード（4桁）
    company_name: string;            // 企業名
    disclosure_type: string;         // 開示種類
    title: string;                   // タイトル
    disclosed_at: string;            // 開示日時（ISO8601）
    date_partition: string;          // 日付パーティション（YYYY-MM-DD）
    
    // PDFファイル参照
    pdf_s3_key: string;              // S3オブジェクトキー
    pdf_size: number;                // ファイルサイズ（バイト）
    
    // 整合性管理
    status: 'pending' | 'committed' | 'failed';  // トランザクション状態
    temp_s3_key?: string;            // 一時S3キー（pending時のみ）
    
    // メタデータ
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

## Two-Phase Commitパターンの実装

### パターンの説明

Two-Phase Commit（2相コミット）は、分散トランザクションを実現するための古典的なパターンです。
TDnet Data Collectorでは、DynamoDBとS3という2つの独立したストレージ間でデータ整合性を保証するために使用します。

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

### 完全な実装コード

#### Phase 1: Prepare（準備フェーズ）

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger';
import { generateDatePartition } from '../validators/date-partition';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
);

interface DisclosureInput {
    disclosure_id: string;
    company_code: string;
    company_name: string;
    disclosure_type: string;
    title: string;
    disclosed_at: string;
}

async function preparePhase(
    disclosure: DisclosureInput,
    pdfBuffer: Buffer
): Promise<{ tempS3Key: string; finalS3Key: string }> {
    const tempS3Key = `temp/${disclosure.disclosure_id}.pdf`;
    const finalS3Key = `pdfs/${disclosure.disclosure_id}.pdf`;
    
    logger.info('Starting prepare phase', {
        disclosure_id: disclosure.disclosure_id,
        temp_s3_key: tempS3Key,
    });
    
    try {
        // 1. PDFを一時キーでS3にアップロード
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: tempS3Key,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
            Metadata: {
                disclosure_id: disclosure.disclosure_id,
                company_code: disclosure.company_code,
                phase: 'prepare',
            },
        }));
        
        logger.info('PDF uploaded to temp location', {
            disclosure_id: disclosure.disclosure_id,
            temp_s3_key: tempS3Key,
            size: pdfBuffer.length,
        });
        
        // 2. メタデータをstatus='pending'でDynamoDBに保存
        // ✅ 修正: date_partitionをPrepare Phase開始時に生成
        // Two-Phase Commitの原則: Prepare Phaseではすべてのデータが確定している必要がある
        const datePartition = generateDatePartition(disclosure.disclosed_at);
        const now = new Date().toISOString();
        
        await dynamoClient.send(new PutCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Item: {
                disclosure_id: disclosure.disclosure_id,
                company_code: disclosure.company_code,
                company_name: disclosure.company_name,
                disclosure_type: disclosure.disclosure_type,
                title: disclosure.title,
                disclosed_at: disclosure.disclosed_at,
                date_partition: datePartition,
                pdf_s3_key: finalS3Key,  // 最終的なキーを記録
                temp_s3_key: tempS3Key,  // 一時キーも記録
                pdf_size: pdfBuffer.length,
                status: 'pending',
                created_at: now,
                updated_at: now,
            },
            // 重複チェック
            ConditionExpression: 'attribute_not_exists(disclosure_id)',
        }));
        
        logger.info('Metadata saved with pending status', {
            disclosure_id: disclosure.disclosure_id,
            status: 'pending',
        });
        
        return { tempS3Key, finalS3Key };
        
    } catch (error) {
        logger.error('Prepare phase failed', {
            disclosure_id: disclosure.disclosure_id,
            error,
        });
        
        // Prepare失敗時は一時ファイルを削除
        await cleanupTempFile(tempS3Key);
        throw error;
    }
}
```

#### Phase 2: Commit（コミットフェーズ）

```typescript
import { CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

async function commitPhase(
    disclosureId: string,
    tempS3Key: string,
    finalS3Key: string
): Promise<void> {
    logger.info('Starting commit phase', {
        disclosure_id: disclosureId,
        temp_s3_key: tempS3Key,
        final_s3_key: finalS3Key,
    });
    
    try {
        // 1. S3オブジェクトを一時キーから正式キーにコピー
        // ✅ pdfs/プレフィックスにはObject Lockを設定
        await s3Client.send(new CopyObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            CopySource: `${process.env.S3_BUCKET}/${tempS3Key}`,
            Key: finalS3Key,
            ContentType: 'application/pdf',
            Metadata: {
                disclosure_id: disclosureId,
                phase: 'committed',
            },
            MetadataDirective: 'REPLACE',
            // Object Lock設定（pdfs/プレフィックスのみ）
            ObjectLockMode: 'GOVERNANCE',
            ObjectLockRetainUntilDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年後
        }));
        
        logger.info('PDF copied to final location with Object Lock', {
            disclosure_id: disclosureId,
            final_s3_key: finalS3Key,
            object_lock_mode: 'GOVERNANCE',
            retain_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
        
        // 2. 一時ファイルを削除
        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: tempS3Key,
        }));
        
        logger.info('Temp PDF deleted', {
            disclosure_id: disclosureId,
            temp_s3_key: tempS3Key,
        });
        
        // 3. DynamoDBのstatusを'committed'に更新
        await dynamoClient.send(new UpdateCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Key: { disclosure_id: disclosureId },
            UpdateExpression: 'SET #status = :committed, updated_at = :now REMOVE temp_s3_key',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':committed': 'committed',
                ':now': new Date().toISOString(),
            },
            // statusがpendingの場合のみ更新
            ConditionExpression: '#status = :pending',
            ExpressionAttributeValues: {
                ':committed': 'committed',
                ':pending': 'pending',
                ':now': new Date().toISOString(),
            },
        }));
        
        logger.info('Commit phase completed', {
            disclosure_id: disclosureId,
            status: 'committed',
        });
        
    } catch (error) {
        logger.error('Commit phase failed', {
            disclosure_id: disclosureId,
            error,
        });
        
        // Commit失敗時はアラート送信（手動対応が必要）
        await sendAlert('Commit phase failed', {
            disclosure_id: disclosureId,
            temp_s3_key: tempS3Key,
            final_s3_key: finalS3Key,
            error: error.message,
        });
        
        throw error;
    }
}
```

#### Rollback処理の実装

```typescript
async function rollback(
    disclosureId: string,
    tempS3Key: string
): Promise<void> {
    logger.warn('Starting rollback', {
        disclosure_id: disclosureId,
        temp_s3_key: tempS3Key,
    });
    
    const errors: Error[] = [];
    
    try {
        // 1. 一時S3ファイルを削除
        await cleanupTempFile(tempS3Key);
    } catch (error) {
        logger.error('Failed to delete temp S3 file during rollback', {
            disclosure_id: disclosureId,
            temp_s3_key: tempS3Key,
            error,
        });
        errors.push(error);
    }
    
    try {
        // 2. DynamoDBのstatusを'failed'に更新
        await dynamoClient.send(new UpdateCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Key: { disclosure_id: disclosureId },
            UpdateExpression: 'SET #status = :failed, updated_at = :now',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':failed': 'failed',
                ':now': new Date().toISOString(),
            },
        }));
        
        logger.info('Rollback completed', {
            disclosure_id: disclosureId,
            status: 'failed',
        });
        
    } catch (error) {
        logger.error('Failed to update status during rollback', {
            disclosure_id: disclosureId,
            error,
        });
        errors.push(error);
    }
    
    // ロールバック自体が失敗した場合はアラート送信
    if (errors.length > 0) {
        await sendAlert('Rollback failed', {
            disclosure_id: disclosureId,
            temp_s3_key: tempS3Key,
            errors: errors.map(e => e.message),
        });
        
        throw new Error(`Rollback failed with ${errors.length} errors`);
    }
}

async function cleanupTempFile(tempS3Key: string): Promise<void> {
    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: tempS3Key,
        }));
        
        logger.info('Temp file cleaned up', { temp_s3_key: tempS3Key });
    } catch (error) {
        // ファイルが存在しない場合は無視
        if (error.name === 'NoSuchKey') {
            logger.info('Temp file does not exist, skipping cleanup', {
                temp_s3_key: tempS3Key,
            });
            return;
        }
        throw error;
    }
}
```

#### 統合関数

```typescript
/**
 * Two-Phase Commitパターンで開示情報とPDFを保存
 * 
 * @param disclosure - 開示情報メタデータ
 * @param pdfBuffer - PDFファイルのバッファ
 * @throws {Error} Prepare/Commit失敗時
 */
export async function saveDisclosureWithTwoPhaseCommit(
    disclosure: DisclosureInput,
    pdfBuffer: Buffer
): Promise<void> {
    let tempS3Key: string | undefined;
    let finalS3Key: string | undefined;
    
    try {
        // Phase 1: Prepare
        const keys = await preparePhase(disclosure, pdfBuffer);
        tempS3Key = keys.tempS3Key;
        finalS3Key = keys.finalS3Key;
        
        // Phase 2: Commit
        await commitPhase(disclosure.disclosure_id, tempS3Key, finalS3Key);
        
        logger.info('Two-phase commit completed successfully', {
            disclosure_id: disclosure.disclosure_id,
        });
        
    } catch (error) {
        logger.error('Two-phase commit failed', {
            disclosure_id: disclosure.disclosure_id,
            error,
        });
        
        // Rollback
        if (tempS3Key) {
            await rollback(disclosure.disclosure_id, tempS3Key);
        }
        
        throw error;
    }
}

/**
 * アラート送信（SNS経由）
 */
async function sendAlert(subject: string, details: any): Promise<void> {
    const sns = new SNSClient({ region: process.env.AWS_REGION });
    
    try {
        await sns.send(new PublishCommand({
            TopicArn: process.env.ALERT_TOPIC_ARN!,
            Subject: `[TDnet Collector] ${subject}`,
            Message: JSON.stringify(details, null, 2),
        }));
        
        logger.info('Alert sent', { subject, details });
    } catch (error) {
        logger.error('Failed to send alert', { subject, details, error });
    }
}
```

**実装場所:** `src/collector/two-phase-commit.ts`

---

## 整合性チェックバッチの実装

### バッチの目的

Two-Phase Commitパターンでは、Commit失敗時に`status='pending'`のレコードが残る可能性があります。
整合性チェックバッチは、これらのレコードを定期的に検証し、自動修復またはアラート送信を行います。

**検証内容:**
1. `status='pending'`のレコードを取得
2. 各レコードについてS3オブジェクトの存在を確認
3. 存在する場合は`status='committed'`に更新
4. 存在しない場合はアラート送信

**実行頻度:**
- EventBridgeで1時間ごとに実行
- 手動実行も可能（Lambda関数を直接呼び出し）

### 完全な実装コード

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../utils/logger';

const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
);
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

interface IntegrityCheckResult {
    total: number;
    fixed: number;
    failed: number;
    errors: Array<{
        disclosure_id: string;
        error: string;
    }>;
}

/**
 * 整合性チェックバッチのメインハンドラー
 */
export const handler = async (): Promise<IntegrityCheckResult> => {
    logger.info('Starting integrity check batch');
    
    const result: IntegrityCheckResult = {
        total: 0,
        fixed: 0,
        failed: 0,
        errors: [],
    };
    
    try {
        // 1. status='pending'のレコードを取得
        const pendingRecords = await getPendingRecords();
        result.total = pendingRecords.length;
        
        logger.info('Found pending records', { count: pendingRecords.length });
        
        // 2. 各レコードを検証
        for (const record of pendingRecords) {
            try {
                await checkAndFixRecord(record, result);
            } catch (error) {
                logger.error('Failed to check record', {
                    disclosure_id: record.disclosure_id,
                    error,
                });
                result.errors.push({
                    disclosure_id: record.disclosure_id,
                    error: error.message,
                });
            }
        }
        
        // 3. 結果をログ出力
        logger.info('Integrity check completed', result);
        
        // 4. エラーがある場合はアラート送信
        if (result.errors.length > 0) {
            await sendIntegrityAlert(result);
        }
        
        return result;
        
    } catch (error) {
        logger.error('Integrity check batch failed', { error });
        throw error;
    }
};

/**
 * status='pending'のレコードを取得
 */
async function getPendingRecords(): Promise<any[]> {
    const records: any[] = [];
    let lastEvaluatedKey: any = undefined;
    
    do {
        const response = await dynamoClient.send(new QueryCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            IndexName: 'GSI_Status',
            KeyConditionExpression: '#status = :pending',
            ExpressionAttributeNames: {
                '#status': 'status',
            },
            ExpressionAttributeValues: {
                ':pending': 'pending',
            },
            ExclusiveStartKey: lastEvaluatedKey,
        }));
        
        if (response.Items) {
            records.push(...response.Items);
        }
        
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    return records;
}

/**
 * レコードの整合性をチェックして修復
 */
async function checkAndFixRecord(
    record: any,
    result: IntegrityCheckResult
): Promise<void> {
    const { disclosure_id, pdf_s3_key, temp_s3_key } = record;
    
    logger.info('Checking record', { disclosure_id, pdf_s3_key });
    
    // 正式なS3キーのオブジェクトが存在するか確認
    const finalExists = await checkS3ObjectExists(pdf_s3_key);
    
    if (finalExists) {
        // 正式なファイルが存在する場合、statusを'committed'に更新
        await updateStatusToCommitted(disclosure_id);
        result.fixed++;
        
        logger.info('Fixed record - final file exists', {
            disclosure_id,
            pdf_s3_key,
        });
        
        // 一時ファイルが残っている場合は削除
        if (temp_s3_key) {
            await cleanupTempFile(temp_s3_key);
        }
        
    } else {
        // 正式なファイルが存在しない場合、一時ファイルを確認
        const tempExists = temp_s3_key ? await checkS3ObjectExists(temp_s3_key) : false;
        
        if (tempExists) {
            // 一時ファイルが存在する場合、Commit処理を再実行
            logger.info('Retrying commit phase', {
                disclosure_id,
                temp_s3_key,
                pdf_s3_key,
            });
            
            try {
                await commitPhase(disclosure_id, temp_s3_key, pdf_s3_key);
                result.fixed++;
            } catch (error) {
                logger.error('Failed to retry commit', {
                    disclosure_id,
                    error,
                });
                result.failed++;
                throw error;
            }
            
        } else {
            // 両方のファイルが存在しない場合、データ整合性エラー
            logger.error('Data integrity error - no files found', {
                disclosure_id,
                pdf_s3_key,
                temp_s3_key,
            });
            
            result.failed++;
            
            // statusを'failed'に更新
            await updateStatusToFailed(disclosure_id);
            
            // アラート送信
            await sendAlert('Data integrity error', {
                disclosure_id,
                pdf_s3_key,
                temp_s3_key,
                message: 'Neither final nor temp file exists',
            });
        }
    }
}

/**
 * S3オブジェクトの存在確認
 */
async function checkS3ObjectExists(s3Key: string): Promise<boolean> {
    try {
        await s3Client.send(new HeadObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: s3Key,
        }));
        return true;
    } catch (error) {
        if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
            return false;
        }
        throw error;
    }
}

/**
 * statusを'committed'に更新
 */
async function updateStatusToCommitted(disclosureId: string): Promise<void> {
    await dynamoClient.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: { disclosure_id: disclosureId },
        UpdateExpression: 'SET #status = :committed, updated_at = :now REMOVE temp_s3_key',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':committed': 'committed',
            ':now': new Date().toISOString(),
        },
    }));
}

/**
 * statusを'failed'に更新
 */
async function updateStatusToFailed(disclosureId: string): Promise<void> {
    await dynamoClient.send(new UpdateCommand({
        TableName: process.env.DYNAMODB_TABLE!,
        Key: { disclosure_id: disclosureId },
        UpdateExpression: 'SET #status = :failed, updated_at = :now',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
        ExpressionAttributeValues: {
            ':failed': 'failed',
            ':now': new Date().toISOString(),
        },
    }));
}

/**
 * 整合性チェック結果のアラート送信
 */
async function sendIntegrityAlert(result: IntegrityCheckResult): Promise<void> {
    await snsClient.send(new PublishCommand({
        TopicArn: process.env.ALERT_TOPIC_ARN!,
        Subject: '[TDnet Collector] Integrity Check Alert',
        Message: JSON.stringify({
            message: 'Data integrity issues detected',
            total: result.total,
            fixed: result.fixed,
            failed: result.failed,
            errors: result.errors,
            timestamp: new Date().toISOString(),
        }, null, 2),
    }));
}
```

**実装場所:** `src/batch/integrity-checker.ts`

### EventBridge設定（CDK）

```typescript
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export class IntegrityCheckerConstruct extends Construct {
    public readonly function: lambda.Function;
    
    constructor(scope: Construct, id: string, props: {
        table: dynamodb.Table;
        bucket: s3.Bucket;
        alertTopic: sns.Topic;
    }) {
        super(scope, id);
        
        // Lambda関数の作成
        this.function = new lambda.Function(this, 'IntegrityCheckerFunction', {
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'integrity-checker.handler',
            code: lambda.Code.fromAsset('dist/batch'),
            timeout: cdk.Duration.minutes(15),
            memorySize: 512,
            environment: {
                DYNAMODB_TABLE: props.table.tableName,
                S3_BUCKET: props.bucket.bucketName,
                ALERT_TOPIC_ARN: props.alertTopic.topicArn,
                AWS_REGION: cdk.Stack.of(this).region,
            },
            description: 'Checks data integrity between DynamoDB and S3',
        });
        
        // DynamoDBとS3へのアクセス権限を付与
        props.table.grantReadWriteData(this.function);
        props.bucket.grantRead(this.function);
        props.alertTopic.grantPublish(this.function);
        
        // EventBridgeルールの作成（1時間ごと実行）
        const rule = new events.Rule(this, 'IntegrityCheckRule', {
            schedule: events.Schedule.rate(cdk.Duration.hours(1)),
            description: 'Runs integrity checker every hour',
        });
        
        rule.addTarget(new targets.LambdaFunction(this.function, {
            retryAttempts: 2,
        }));
        
        // CloudWatch Logsの保持期間設定
        new logs.LogGroup(this, 'IntegrityCheckerLogGroup', {
            logGroupName: `/aws/lambda/${this.function.functionName}`,
            retention: logs.RetentionDays.ONE_MONTH,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
    }
}
```

**実装場所:** `cdk/lib/constructs/integrity-checker-construct.ts`

---

## S3 Object Lock設定

### Object Lockの目的

S3 Object Lockは、オブジェクトの削除や上書きを防止する機能です。
TDnet Data Collectorでは、以下の目的で使用します：

**目的:**
- 誤削除の防止
- データ改ざんの防止
- コンプライアンス要件の充足
- 監査証跡の保持

**適用対象:**
- 開示情報PDF（`pdfs/`プレフィックス）
- 監査ログ（`audit-logs/`プレフィックス）

**適用除外:**
- 一時ファイル（`temp/`プレフィックス）
- キャッシュファイル（`cache/`プレフィックス）

### CDK実装コード

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class TDnetBucketConstruct extends Construct {
    public readonly bucket: s3.Bucket;
    
    constructor(scope: Construct, id: string) {
        super(scope, id);
        
        // S3バケットの作成
        // ✅ Object Lockを有効化するが、デフォルト保持期間は設定しない
        this.bucket = new s3.Bucket(this, 'TDnetBucket', {
            bucketName: `tdnet-data-${cdk.Stack.of(this).account}`,
            
            // Object Lockを有効化（バケット作成時のみ設定可能）
            // デフォルト保持期間は設定せず、オブジェクトごとに設定
            objectLockEnabled: true,
            
            // バージョニングを有効化（Object Lockの前提条件）
            versioned: true,
            
            // 暗号化設定
            encryption: s3.BucketEncryption.S3_MANAGED,
            
            // パブリックアクセスをブロック
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            
            // ライフサイクルルール
            lifecycleRules: [
                {
                    id: 'DeleteTempFiles',
                    prefix: 'temp/',
                    expiration: cdk.Duration.days(1),
                    enabled: true,
                },
                {
                    id: 'DeleteExportFiles',
                    prefix: 'exports/',
                    expiration: cdk.Duration.days(7),
                    enabled: true,
                },
                {
                    id: 'TransitionOldVersions',
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                    enabled: true,
                },
            ],
            
            // 削除保護
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });
        
        // ⚠️ 重要: デフォルト保持期間は設定しない
        // cfnBucket.objectLockConfiguration は設定しない
        // オブジェクトごとに ObjectLockMode を指定する
    }
}
```

**実装場所:** `cdk/lib/constructs/tdnet-bucket-construct.ts`

**⚠️ 重要な設計決定:**

1. **Object Lockはバケット全体で有効化**
   - `objectLockEnabled: true`を設定（バケット作成時のみ可能）
   - これにより、オブジェクトごとに`ObjectLockMode`を設定できるようになる

2. **デフォルト保持期間は設定しない**
   - `cfnBucket.objectLockConfiguration`は設定しない
   - すべてのオブジェクトに自動的に保持期間が適用されることを防ぐ
   - オブジェクトごとに明示的に`ObjectLockMode`を指定する

3. **プレフィックスごとの適用制御**
   - `pdfs/`: アップロード時に`ObjectLockMode: 'GOVERNANCE'`を指定
   - `temp/`: `ObjectLockMode`を指定しない → ライフサイクルポリシーで1日後に削除可能
   - `exports/`: `ObjectLockMode`を指定しない → ライフサイクルポリシーで7日後に削除可能

4. **ライフサイクルポリシーとの共存**
   - Object Lockが設定されていないオブジェクトは、ライフサイクルポリシーで削除可能
   - Object Lockが設定されたオブジェクトは、保持期間経過後に削除可能

### Governance ModeとCompliance Modeの比較

| 項目 | Governance Mode | Compliance Mode |
|------|----------------|-----------------|
| **削除可能性** | 特別な権限があれば削除可能 | 保持期間中は誰も削除不可 |
| **上書き可能性** | 特別な権限があれば上書き可能 | 保持期間中は誰も上書き不可 |
| **保持期間の変更** | 短縮・延長ともに可能 | 延長のみ可能 |
| **用途** | 通常の運用、開発環境 | 厳格なコンプライアンス要件 |
| **コスト** | 標準 | 標準 |
| **推奨** | ✅ TDnet Collectorに推奨 | 金融機関など厳格な要件がある場合 |

**TDnet Collectorの選択:**
- **Governance Mode**を推奨
- 理由: 誤削除を防ぎつつ、必要に応じて管理者が削除可能
- 保持期間: 1年間（監査要件を考慮）

### 保持期間の設定

**推奨設定:**

| データ種類 | 保持期間 | 理由 |
|-----------|---------|------|
| **開示情報PDF** | 1年間 | 監査要件、法的要件 |
| **監査ログ** | 1年間 | セキュリティ監査要件 |
| **一時ファイル** | 1日間 | コスト削減 |

**オブジェクトごとのObject Lock設定:**

```typescript
import { PutObjectCommand } from '@aws-sdk/client-s3';

// ✅ 開示情報PDF（pdfs/）にはObject Lockを設定
await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `pdfs/${disclosure_id}.pdf`,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    
    // Object Lock設定（pdfs/プレフィックスのみ）
    ObjectLockMode: 'GOVERNANCE',
    ObjectLockRetainUntilDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年後
}));

// ✅ 一時ファイル（temp/）にはObject Lockを設定しない
await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `temp/${disclosure_id}.pdf`,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    
    // Object Lockを設定しない（ライフサイクルポリシーで1日後に自動削除）
    // ObjectLockMode を指定しない
}));

// ✅ エクスポートファイル（exports/）にもObject Lockを設定しない
await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: `exports/${export_id}.csv`,
    Body: csvBuffer,
    ContentType: 'text/csv',
    
    // Object Lockを設定しない（ライフサイクルポリシーで7日後に自動削除）
    // ObjectLockMode を指定しない
}));
```

### Object Lockの適用範囲まとめ

| プレフィックス | Object Lock | 保持期間 | 理由 |
|--------------|------------|---------|------|
| **pdfs/** | ✅ 適用 | 1年間 | 監査要件、法的要件、誤削除防止 |
| **temp/** | ❌ 適用除外 | 1日後に自動削除 | 一時ファイル、コスト削減 |
| **exports/** | ❌ 適用除外 | 7日後に自動削除 | エクスポートファイル、一時的 |
| **audit-logs/** | ✅ 適用（将来） | 1年間 | セキュリティ監査要件 |

**設計の利点:**
- 一時ファイルとエクスポートファイルは自動削除が正常に動作
- 開示情報PDFは誤削除・改ざんから保護
- ライフサイクルポリシーとObject Lockが競合しない
- プレフィックスごとに柔軟な保持ポリシーを設定可能

---

## DynamoDB Transactionsの活用

### TransactWriteItemsの使用

DynamoDB Transactionsを使用すると、複数の操作をアトミックに実行できます。
TDnet Data Collectorでは、以下のシナリオで使用します：

**使用シナリオ:**
1. 開示情報の作成と重複チェック
2. 複数レコードの一括更新
3. 条件付き更新（楽観的ロック）

### 実装例

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
);

/**
 * 開示情報の保存（統計情報の更新は分離）
 * 
 * ✅ 設計原則:
 * - 開示情報の保存と統計情報の更新を分離
 * - 統計情報の更新失敗時でも開示情報は保存される
 * - 開示情報の保存が最優先
 */
async function saveDisclosure(
    disclosure: Disclosure
): Promise<void> {
    const now = new Date().toISOString();
    
    try {
        // 1. 開示情報を保存（重複チェック付き）
        await dynamoClient.send(new PutCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Item: {
                ...disclosure,
                created_at: now,
                updated_at: now,
            },
            ConditionExpression: 'attribute_not_exists(disclosure_id)',
        }));
        
        logger.info('Disclosure saved successfully', {
            disclosure_id: disclosure.disclosure_id,
        });
        
        // 2. 統計情報を更新（失敗しても開示情報は保存済み）
        try {
            await updateStatistics(disclosure);
        } catch (error) {
            logger.warn('Failed to update statistics', {
                disclosure_id: disclosure.disclosure_id,
                error,
            });
            // 統計情報の更新失敗は無視（開示情報は保存済み）
            // 統計情報は後で整合性チェックバッチで修復可能
        }
        
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            throw new Error(`Duplicate disclosure_id: ${disclosure.disclosure_id}`);
        }
        
        logger.error('Failed to save disclosure', {
            disclosure_id: disclosure.disclosure_id,
            error,
        });
        throw error;
    }
}

/**
 * 統計情報の更新（開示情報の保存とは独立）
 */
async function updateStatistics(disclosure: Disclosure): Promise<void> {
    const now = new Date().toISOString();
    
    await dynamoClient.send(new UpdateCommand({
        TableName: process.env.STATS_TABLE!,
        Key: {
            stat_type: 'daily_count',
            date: disclosure.disclosed_at.substring(0, 10),
        },
        UpdateExpression: 'ADD #count :inc SET updated_at = :now',
        ExpressionAttributeNames: {
            '#count': 'count',
        },
        ExpressionAttributeValues: {
            ':inc': 1,
            ':now': now,
        },
    }));
    
    logger.info('Statistics updated successfully', {
        disclosure_id: disclosure.disclosure_id,
        date: disclosure.disclosed_at.substring(0, 10),
    });
}
```

### 設計の利点

**1. データ損失のリスク削減:**
- 統計情報の更新失敗時でも、開示情報は保存される
- 開示情報の保存が最優先（ビジネス上最も重要なデータ）
- 統計情報は後で整合性チェックバッチで修復可能

**2. エラーハンドリングの簡素化:**
- 統計情報の更新失敗は警告レベルで記録
- 開示情報の保存失敗のみがエラー
- エラーの影響範囲が明確

**3. パフォーマンス向上:**
- トランザクションのオーバーヘッドを削減
- DynamoDBの書き込みキャパシティを節約
- 統計情報の更新失敗時のロールバックコストを削減

**4. 保守性の向上:**
- 開示情報と統計情報の責任が明確に分離
- テストが容易（各機能を独立してテスト可能）
- 統計情報の更新ロジックを変更しても開示情報の保存に影響しない

**5. スケーラビリティ:**
- 統計情報の更新を非同期化することも可能（将来の拡張）
- 統計情報の更新失敗が開示情報の保存をブロックしない

### トランザクションを使用すべきケース

DynamoDB Transactionsは、以下のケースでのみ使用すべきです：

**✅ 適切な使用例:**
1. **複数レコードの整合性が必須の場合**
   - 例: 在庫の減少と注文の作成を同時に実行
   - 例: 口座間の送金（送金元の減額と送金先の増額）

2. **楽観的ロックが必要な場合**
   - 例: バージョン番号を使用した競合検出
   - 例: 複数ユーザーによる同時編集の防止

3. **複雑な条件付き更新**
   - 例: 複数の条件を満たす場合のみ更新

**❌ 不適切な使用例:**
1. **独立した操作の結合**
   - 例: 開示情報の保存と統計情報の更新（本ケース）
   - 理由: 統計情報の更新失敗が開示情報の保存をブロックする

2. **パフォーマンスが重要な場合**
   - 理由: トランザクションはオーバーヘッドが大きい
   - 代替案: 非同期処理、結果整合性

3. **一方の失敗が他方に影響しない場合**
   - 理由: 不要な結合により可用性が低下
   - 代替案: 独立した操作として実行

### 適切なトランザクション使用例

以下は、DynamoDB Transactionsを適切に使用する例です：

```typescript
 * 楽観的ロックを使用した更新
 * バージョン番号を使用して競合を検出
 */
async function updateDisclosureWithOptimisticLock(
    disclosureId: string,
    updates: Partial<Disclosure>,
    expectedVersion: number
): Promise<void> {
    try {
        await dynamoClient.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Update: {
                        TableName: process.env.DYNAMODB_TABLE!,
                        Key: { disclosure_id: disclosureId },
                        UpdateExpression: 'SET #version = :newVersion, updated_at = :now, #updates',
                        ConditionExpression: '#version = :expectedVersion',
                        ExpressionAttributeNames: {
                            '#version': 'version',
                            '#updates': Object.keys(updates).map(k => `#${k} = :${k}`).join(', '),
                            ...Object.keys(updates).reduce((acc, k) => ({
                                ...acc,
                                [`#${k}`]: k,
                            }), {}),
                        },
                        ExpressionAttributeValues: {
                            ':expectedVersion': expectedVersion,
                            ':newVersion': expectedVersion + 1,
                            ':now': new Date().toISOString(),
                            ...Object.entries(updates).reduce((acc, [k, v]) => ({
                                ...acc,
                                [`:${k}`]: v,
                            }), {}),
                        },
                    },
                },
            ],
        }));
        
        logger.info('Optimistic lock update succeeded', {
            disclosure_id: disclosureId,
            version: expectedVersion + 1,
        });
        
    } catch (error) {
        if (error.name === 'TransactionCanceledException') {
            throw new Error('Optimistic lock failed - record was modified by another process');
        }
        throw error;
    }
}
```

### エラーハンドリング

```typescript
/**
 * トランザクションエラーの詳細処理
 */
function handleTransactionError(error: any): never {
    if (error.name === 'TransactionCanceledException') {
        const reasons = error.CancellationReasons || [];
        
        for (let i = 0; i < reasons.length; i++) {
            const reason = reasons[i];
            
            logger.error('Transaction item failed', {
                index: i,
                code: reason.Code,
                message: reason.Message,
            });
            
            switch (reason.Code) {
                case 'ConditionalCheckFailed':
                    throw new Error('Condition check failed - possible duplicate or version mismatch');
                
                case 'ItemCollectionSizeLimitExceeded':
                    throw new Error('Item collection size limit exceeded');
                
                case 'ProvisionedThroughputExceeded':
                    throw new Error('Provisioned throughput exceeded - retry with backoff');
                
                case 'ResourceNotFound':
                    throw new Error('Table not found');
                
                case 'ValidationError':
                    throw new Error(`Validation error: ${reason.Message}`);
                
                default:
                    throw new Error(`Unknown error: ${reason.Code}`);
            }
        }
    }
    
    throw error;
}
```

**実装場所:** `src/utils/dynamodb-transactions.ts`

---

## テスト戦略

### ユニットテスト（モック使用）

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDisclosureWithTwoPhaseCommit } from '../collector/two-phase-commit';
import * as s3Module from '@aws-sdk/client-s3';
import * as dynamoModule from '@aws-sdk/lib-dynamodb';

// モックの設定
vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/lib-dynamodb');

describe('Two-Phase Commit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    
    it('should successfully save disclosure with two-phase commit', async () => {
        // Arrange
        const mockS3Send = vi.fn().mockResolvedValue({});
        const mockDynamoSend = vi.fn().mockResolvedValue({});
        
        vi.spyOn(s3Module, 'S3Client').mockImplementation(() => ({
            send: mockS3Send,
        } as any));
        
        vi.spyOn(dynamoModule, 'DynamoDBDocumentClient').mockImplementation(() => ({
            send: mockDynamoSend,
        } as any));
        
        const disclosure = {
            disclosure_id: '20240115_7203_001',
            company_code: '7203',
            company_name: 'トヨタ自動車',
            disclosure_type: '決算短信',
            title: '2024年3月期 決算短信',
            disclosed_at: '2024-01-15T15:00:00+09:00',
        };
        
        const pdfBuffer = Buffer.from('mock pdf content');
        
        // Act
        await saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer);
        
        // Assert
        expect(mockS3Send).toHaveBeenCalledTimes(3); // PUT, COPY, DELETE
        expect(mockDynamoSend).toHaveBeenCalledTimes(2); // PUT, UPDATE
    });
    
    it('should rollback on prepare phase failure', async () => {
        // Arrange
        const mockS3Send = vi.fn()
            .mockResolvedValueOnce({}) // PUT成功
            .mockRejectedValueOnce(new Error('DynamoDB error')); // DynamoDB失敗
        
        const mockDynamoSend = vi.fn().mockRejectedValue(new Error('DynamoDB error'));
        
        // ... モック設定
        
        // Act & Assert
        await expect(
            saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer)
        ).rejects.toThrow('DynamoDB error');
        
        // ロールバックが呼ばれたことを確認
        expect(mockS3Send).toHaveBeenCalledWith(
            expect.objectContaining({
                input: expect.objectContaining({
                    Key: expect.stringContaining('temp/'),
                }),
            })
        );
    });
});
```

**実装場所:** `tests/unit/two-phase-commit.test.ts`

### 統合テスト（実際のAWSリソース使用）

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { saveDisclosureWithTwoPhaseCommit } from '../collector/two-phase-commit';

describe('Two-Phase Commit Integration Tests', () => {
    const s3Client = new S3Client({ region: 'ap-northeast-1' });
    const dynamoClient = DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: 'ap-northeast-1' })
    );
    
    const testDisclosureId = `TEST_${Date.now()}_7203_001`;
    
    afterAll(async () => {
        // テストデータのクリーンアップ
        await s3Client.send(new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: `pdfs/${testDisclosureId}.pdf`,
        }));
        
        await dynamoClient.send(new DeleteCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Key: { disclosure_id: testDisclosureId },
        }));
    });
    
    it('should save disclosure with actual AWS resources', async () => {
        // Arrange
        const disclosure = {
            disclosure_id: testDisclosureId,
            company_code: '7203',
            company_name: 'トヨタ自動車（テスト）',
            disclosure_type: '決算短信',
            title: 'テスト用決算短信',
            disclosed_at: new Date().toISOString(),
        };
        
        const pdfBuffer = Buffer.from('%PDF-1.4\nTest PDF Content\n%%EOF');
        
        // Act
        await saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer);
        
        // Assert - S3にファイルが存在することを確認
        const s3Object = await s3Client.send(new HeadObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: `pdfs/${testDisclosureId}.pdf`,
        }));
        expect(s3Object).toBeDefined();
        
        // Assert - DynamoDBにレコードが存在することを確認
        const dynamoRecord = await dynamoClient.send(new GetCommand({
            TableName: process.env.DYNAMODB_TABLE!,
            Key: { disclosure_id: testDisclosureId },
        }));
        expect(dynamoRecord.Item).toBeDefined();
        expect(dynamoRecord.Item.status).toBe('committed');
    }, 30000); // 30秒タイムアウト
});
```

**実装場所:** `tests/integration/two-phase-commit.integration.test.ts`

**実行方法:**

```bash
# 統合テスト用の環境変数を設定
export AWS_REGION=ap-northeast-1
export S3_BUCKET=tdnet-data-test
export DYNAMODB_TABLE=tdnet-disclosures-test

# 統合テストを実行
npm run test:integration
```

### カオステスト（障害注入）

```typescript
import { describe, it, expect } from 'vitest';
import { saveDisclosureWithTwoPhaseCommit } from '../collector/two-phase-commit';
import { injectFault } from '../utils/chaos-testing';

describe('Chaos Tests - Two-Phase Commit', () => {
    it('should handle S3 network timeout', async () => {
        // S3へのネットワークタイムアウトを注入
        injectFault('s3', 'timeout', { duration: 5000 });
        
        const disclosure = createTestDisclosure();
        const pdfBuffer = createTestPDF();
        
        // タイムアウトエラーが発生することを確認
        await expect(
            saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer)
        ).rejects.toThrow('timeout');
    });
    
    it('should handle DynamoDB throttling', async () => {
        // DynamoDBのスロットリングを注入
        injectFault('dynamodb', 'throttling', { rate: 0.5 });
        
        const disclosure = createTestDisclosure();
        const pdfBuffer = createTestPDF();
        
        // リトライ後に成功することを確認
        await expect(
            saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer)
        ).resolves.not.toThrow();
    });
    
    it('should handle partial S3 failure during commit', async () => {
        // Commit中のS3障害を注入
        injectFault('s3', 'failure', {
            operation: 'CopyObject',
            probability: 1.0,
        });
        
        const disclosure = createTestDisclosure();
        const pdfBuffer = createTestPDF();
        
        // Prepare成功、Commit失敗を確認
        await expect(
            saveDisclosureWithTwoPhaseCommit(disclosure, pdfBuffer)
        ).rejects.toThrow();
        
        // status='pending'のレコードが残ることを確認
        const record = await getDisclosureRecord(disclosure.disclosure_id);
        expect(record.status).toBe('pending');
    });
});
```

**実装場所:** `tests/chaos/two-phase-commit.chaos.test.ts`

---

## 監視とアラート

### 整合性エラーの検知

**監視対象:**

1. **status='pending'のレコード数**
   - メトリクス: `PendingRecordsCount`
   - 閾値: 10件以上で警告、50件以上でアラート
   - 頻度: 1時間ごと

2. **status='failed'のレコード数**
   - メトリクス: `FailedRecordsCount`
   - 閾値: 1件以上でアラート
   - 頻度: 1時間ごと

3. **整合性チェックバッチの失敗**
   - メトリクス: `IntegrityCheckErrors`
   - 閾値: 1件以上でアラート
   - 頻度: 実行ごと

4. **孤立したS3オブジェクト**
   - メトリクス: `OrphanedS3Objects`
   - 閾値: 10件以上で警告
   - 頻度: 1日1回

### CloudWatchメトリクス

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });

/**
 * カスタムメトリクスを送信
 */
async function publishMetric(
    metricName: string,
    value: number,
    unit: string = 'Count'
): Promise<void> {
    await cloudwatch.send(new PutMetricDataCommand({
        Namespace: 'TDnetCollector/DataIntegrity',
        MetricData: [
            {
                MetricName: metricName,
                Value: value,
                Unit: unit,
                Timestamp: new Date(),
                Dimensions: [
                    {
                        Name: 'Environment',
                        Value: process.env.ENVIRONMENT || 'production',
                    },
                ],
            },
        ],
    }));
}

/**
 * 整合性チェック結果をメトリクスとして送信
 */
export async function publishIntegrityMetrics(
    result: IntegrityCheckResult
): Promise<void> {
    await Promise.all([
        publishMetric('PendingRecordsCount', result.total),
        publishMetric('FixedRecordsCount', result.fixed),
        publishMetric('FailedRecordsCount', result.failed),
        publishMetric('IntegrityCheckErrors', result.errors.length),
    ]);
    
    logger.info('Integrity metrics published', result);
}
```

**実装場所:** `src/utils/cloudwatch-metrics.ts`

### アラート設定（CDK）

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export class IntegrityAlarmsConstruct extends Construct {
    constructor(scope: Construct, id: string, props: {
        alertTopic: sns.Topic;
    }) {
        super(scope, id);
        
        // 1. Pending Records アラーム
        const pendingRecordsAlarm = new cloudwatch.Alarm(this, 'PendingRecordsAlarm', {
            alarmName: 'TDnet-PendingRecords-High',
            alarmDescription: 'Too many pending records detected',
            metric: new cloudwatch.Metric({
                namespace: 'TDnetCollector/DataIntegrity',
                metricName: 'PendingRecordsCount',
                statistic: 'Maximum',
                period: cdk.Duration.hours(1),
            }),
            threshold: 50,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        
        pendingRecordsAlarm.addAlarmAction(new actions.SnsAction(props.alertTopic));
        
        // 2. Failed Records アラーム
        const failedRecordsAlarm = new cloudwatch.Alarm(this, 'FailedRecordsAlarm', {
            alarmName: 'TDnet-FailedRecords-Detected',
            alarmDescription: 'Failed records detected',
            metric: new cloudwatch.Metric({
                namespace: 'TDnetCollector/DataIntegrity',
                metricName: 'FailedRecordsCount',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        
        failedRecordsAlarm.addAlarmAction(new actions.SnsAction(props.alertTopic));
        
        // 3. Integrity Check Errors アラーム
        const integrityErrorsAlarm = new cloudwatch.Alarm(this, 'IntegrityErrorsAlarm', {
            alarmName: 'TDnet-IntegrityCheck-Errors',
            alarmDescription: 'Integrity check encountered errors',
            metric: new cloudwatch.Metric({
                namespace: 'TDnetCollector/DataIntegrity',
                metricName: 'IntegrityCheckErrors',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        
        integrityErrorsAlarm.addAlarmAction(new actions.SnsAction(props.alertTopic));
        
        // 4. Lambda Function Errors アラーム
        const lambdaErrorsAlarm = new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
            alarmName: 'TDnet-IntegrityChecker-Errors',
            alarmDescription: 'Integrity checker Lambda function errors',
            metric: new cloudwatch.Metric({
                namespace: 'AWS/Lambda',
                metricName: 'Errors',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
                dimensionsMap: {
                    FunctionName: 'IntegrityCheckerFunction',
                },
            }),
            threshold: 1,
            evaluationPeriods: 1,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });
        
        lambdaErrorsAlarm.addAlarmAction(new actions.SnsAction(props.alertTopic));
    }
}
```

**実装場所:** `cdk/lib/constructs/integrity-alarms-construct.ts`

### CloudWatch Dashboardの作成

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export class IntegrityDashboardConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        
        const dashboard = new cloudwatch.Dashboard(this, 'IntegrityDashboard', {
            dashboardName: 'TDnet-DataIntegrity',
        });
        
        // Pending Records グラフ
        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'Pending Records',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'TDnetCollector/DataIntegrity',
                        metricName: 'PendingRecordsCount',
                        statistic: 'Maximum',
                        period: cdk.Duration.hours(1),
                    }),
                ],
                width: 12,
            })
        );
        
        // Fixed vs Failed Records グラフ
        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'Fixed vs Failed Records',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'TDnetCollector/DataIntegrity',
                        metricName: 'FixedRecordsCount',
                        statistic: 'Sum',
                        period: cdk.Duration.hours(1),
                        label: 'Fixed',
                        color: cloudwatch.Color.GREEN,
                    }),
                    new cloudwatch.Metric({
                        namespace: 'TDnetCollector/DataIntegrity',
                        metricName: 'FailedRecordsCount',
                        statistic: 'Sum',
                        period: cdk.Duration.hours(1),
                        label: 'Failed',
                        color: cloudwatch.Color.RED,
                    }),
                ],
                width: 12,
            })
        );
        
        // Integrity Check Errors グラフ
        dashboard.addWidgets(
            new cloudwatch.GraphWidget({
                title: 'Integrity Check Errors',
                left: [
                    new cloudwatch.Metric({
                        namespace: 'TDnetCollector/DataIntegrity',
                        metricName: 'IntegrityCheckErrors',
                        statistic: 'Sum',
                        period: cdk.Duration.hours(1),
                    }),
                ],
                width: 12,
            })
        );
    }
}
```

**実装場所:** `cdk/lib/constructs/integrity-dashboard-construct.ts`

---

## 関連ドキュメント

### 設計・要件

- **要件定義書**: `../requirements.md` - データ整合性要件の詳細
- **設計書**: `../design.md` - システム全体の設計
- **データバリデーション**: `../../steering/development/data-validation.md` - バリデーションルール

### 実装ガイドライン

- **エラーハンドリング**: `../../steering/core/error-handling-patterns.md` - エラー処理の基本原則
- **エラーハンドリング実装**: `../../steering/development/error-handling-implementation.md` - 詳細な実装パターン
- **Lambda実装**: `../../steering/development/lambda-implementation.md` - Lambda関数の実装ガイドライン

### インフラストラクチャ

- **監視とアラート**: `../../steering/infrastructure/monitoring-alerts.md` - CloudWatch設定
- **パフォーマンス最適化**: `../../steering/infrastructure/performance-optimization.md` - コスト削減とパフォーマンス

### テスト

- **テスト戦略**: `../../steering/development/testing-strategy.md` - テスト全般の戦略

---

## まとめ

このドキュメントでは、TDnet Data Collectorにおけるデータ整合性保証の詳細設計を説明しました。

**主要な実装パターン:**

1. **Two-Phase Commit**: DynamoDBとS3間の整合性を保証
2. **整合性チェックバッチ**: 定期的な検証と自動修復
3. **S3 Object Lock**: 誤削除・改ざんの防止
4. **DynamoDB Transactions**: アトミックな操作の実現

**運用上の注意点:**

- 整合性チェックバッチは1時間ごとに自動実行
- `status='pending'`のレコードは24時間以内に修復または調査
- `status='failed'`のレコードは即座に調査が必要
- CloudWatchアラートを監視し、異常を早期検知

**次のステップ:**

1. Two-Phase Commit実装（`src/collector/two-phase-commit.ts`）
2. 整合性チェックバッチ実装（`src/batch/integrity-checker.ts`）
3. CDK構成の実装（`cdk/lib/constructs/`）
4. テストの実装（`tests/`）
5. 監視・アラート設定（CloudWatch）

---

**作成日時:** 2026-02-07  
**バージョン:** 1.0  
**ステータス:** Draft  
**次回レビュー:** Phase 1実装前

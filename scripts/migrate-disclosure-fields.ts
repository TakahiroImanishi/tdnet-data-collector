/**
 * DynamoDBデータ移行スクリプト
 * 
 * Disclosureモデルのフィールド名変更に対応するデータ移行を実行します：
 * - s3_key → pdf_s3_key
 * - collected_at → downloaded_at
 * 
 * 実行方法:
 * ```bash
 * npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-dev --dry-run
 * npx ts-node scripts/migrate-disclosure-fields.ts --table-name tdnet-disclosures-prod
 * ```
 */

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { parseArgs } from 'node:util';

interface MigrationStats {
  scanned: number;
  migrated: number;
  skipped: number;
  errors: number;
}

async function migrateDisclosureFields(
  tableName: string,
  dryRun: boolean = false
): Promise<MigrationStats> {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
  const stats: MigrationStats = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`\n=== DynamoDB Disclosure Fields Migration ===`);
  console.log(`Table: ${tableName}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    // テーブルをスキャン
    const scanCommand = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const scanResult = await client.send(scanCommand);
    const items = scanResult.Items || [];

    console.log(`Scanned ${items.length} items...`);

    // 各アイテムを処理
    for (const item of items) {
      stats.scanned++;

      try {
        const disclosureId = item.disclosure_id?.S;
        if (!disclosureId) {
          console.warn(`Skipping item without disclosure_id`);
          stats.skipped++;
          continue;
        }

        // 移行が必要かチェック
        const hasOldS3Key = item.s3_key?.S !== undefined;
        const hasOldCollectedAt = item.collected_at?.S !== undefined;
        const hasNewPdfS3Key = item.pdf_s3_key?.S !== undefined;
        const hasNewDownloadedAt = item.downloaded_at?.S !== undefined;

        if (!hasOldS3Key && !hasOldCollectedAt) {
          // 既に移行済み
          stats.skipped++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would migrate: ${disclosureId}`);
          if (hasOldS3Key) console.log(`  - s3_key → pdf_s3_key: ${item.s3_key.S}`);
          if (hasOldCollectedAt) console.log(`  - collected_at → downloaded_at: ${item.collected_at.S}`);
          stats.migrated++;
          continue;
        }

        // 更新式を構築
        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};
        const removeExpressions: string[] = [];

        // s3_key → pdf_s3_key
        if (hasOldS3Key && !hasNewPdfS3Key) {
          updateExpressions.push('#pdf_s3_key = :pdf_s3_key');
          expressionAttributeNames['#pdf_s3_key'] = 'pdf_s3_key';
          expressionAttributeValues[':pdf_s3_key'] = item.s3_key;
          removeExpressions.push('#old_s3_key');
          expressionAttributeNames['#old_s3_key'] = 's3_key';
        }

        // collected_at → downloaded_at
        if (hasOldCollectedAt && !hasNewDownloadedAt) {
          updateExpressions.push('#downloaded_at = :downloaded_at');
          expressionAttributeNames['#downloaded_at'] = 'downloaded_at';
          expressionAttributeValues[':downloaded_at'] = item.collected_at;
          removeExpressions.push('#old_collected_at');
          expressionAttributeNames['#old_collected_at'] = 'collected_at';
        }

        if (updateExpressions.length === 0) {
          stats.skipped++;
          continue;
        }

        // DynamoDBを更新
        const updateExpression = `SET ${updateExpressions.join(', ')} REMOVE ${removeExpressions.join(', ')}`;

        const updateCommand = new UpdateItemCommand({
          TableName: tableName,
          Key: {
            disclosure_id: { S: disclosureId },
          },
          UpdateExpression: updateExpression,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        });

        await client.send(updateCommand);
        stats.migrated++;

        if (stats.migrated % 100 === 0) {
          console.log(`Migrated ${stats.migrated} items...`);
        }
      } catch (error) {
        console.error(`Error migrating item:`, error);
        stats.errors++;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\n=== Migration Complete ===`);
  console.log(`Scanned: ${stats.scanned}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Completed at: ${new Date().toISOString()}\n`);

  return stats;
}

// メイン処理
async function main() {
  const { values } = parseArgs({
    options: {
      'table-name': {
        type: 'string',
        short: 't',
      },
      'dry-run': {
        type: 'boolean',
        short: 'd',
        default: false,
      },
    },
  });

  const tableName = values['table-name'];
  const dryRun = values['dry-run'] || false;

  if (!tableName) {
    console.error('Error: --table-name is required');
    console.error('Usage: npx ts-node scripts/migrate-disclosure-fields.ts --table-name <table-name> [--dry-run]');
    process.exit(1);
  }

  try {
    await migrateDisclosureFields(tableName, dryRun);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();

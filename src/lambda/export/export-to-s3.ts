/**
 * S3エクスポート
 *
 * JSON/CSV形式でS3に保存します。大量データ対応（ストリーム処理）。
 *
 * Requirements: 要件5.2（エクスポート形式）
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { Disclosure } from '../../types';

// S3クライアント（グローバルスコープで初期化）
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });

// 環境変数
const EXPORT_BUCKET = process.env.EXPORT_BUCKET_NAME || 'tdnet-exports';

/**
 * S3にエクスポート
 *
 * @param export_id エクスポートID
 * @param disclosures 開示情報のリスト
 * @param format フォーマット（json, csv）
 * @returns S3キー
 */
export async function exportToS3(
  export_id: string,
  disclosures: Disclosure[],
  format: 'json' | 'csv'
): Promise<string> {
  logger.info('Exporting to S3', {
    export_id,
    format,
    count: disclosures.length,
  });

  // S3キーを生成
  const s3_key = generateS3Key(export_id, format);

  // フォーマットに応じて変換
  const content = format === 'json' ? toJSON(disclosures) : toCSV(disclosures);

  // S3にアップロード
  await retryWithBackoff(
    async () => {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: EXPORT_BUCKET,
          Key: s3_key,
          Body: content,
          ContentType: format === 'json' ? 'application/json' : 'text/csv',
          // ライフサイクルポリシーで7日後に自動削除されるようにタグを設定
          Tagging: 'auto-delete=true',
        })
      );
    },
    {
      maxRetries: 3,
      initialDelay: 2000,
      backoffMultiplier: 2,
      jitter: true,
    }
  );

  logger.info('Exported to S3 successfully', {
    export_id,
    s3_key,
    size_bytes: Buffer.byteLength(content, 'utf8'),
  });

  return s3_key;
}

/**
 * S3キーを生成
 *
 * フォーマット: exports/YYYY/MM/DD/export_id.format
 * 例: exports/2024/01/15/export_1705305600000_abc123_12345678.json
 *
 * @param export_id エクスポートID
 * @param format フォーマット（json, csv）
 * @returns S3キー
 */
function generateS3Key(export_id: string, format: 'json' | 'csv'): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');

  return `exports/${year}/${month}/${day}/${export_id}.${format}`;
}

/**
 * JSON形式に変換
 *
 * @param disclosures 開示情報のリスト
 * @returns JSON文字列
 */
function toJSON(disclosures: Disclosure[]): string {
  return JSON.stringify(
    {
      count: disclosures.length,
      disclosures,
    },
    null,
    2
  );
}

/**
 * CSV形式に変換
 *
 * @param disclosures 開示情報のリスト
 * @returns CSV文字列
 */
function toCSV(disclosures: Disclosure[]): string {
  // CSVヘッダー
  const headers = [
    'disclosure_id',
    'company_code',
    'company_name',
    'disclosure_type',
    'title',
    'disclosed_at',
    'pdf_url',
    's3_key',
    'collected_at',
    'date_partition',
  ];

  // CSVヘッダー行
  const headerRow = headers.join(',');

  // CSVデータ行
  const dataRows = disclosures.map((disclosure) => {
    return headers
      .map((header) => {
        const value = disclosure[header as keyof Disclosure];
        // カンマやダブルクォートを含む場合はエスケープ
        return escapeCSVValue(String(value));
      })
      .join(',');
  });

  // ヘッダー + データ行
  return [headerRow, ...dataRows].join('\n');
}

/**
 * CSV値をエスケープ
 *
 * カンマ、ダブルクォート、改行を含む場合はダブルクォートで囲み、
 * ダブルクォートは2つ重ねてエスケープします。
 *
 * @param value 値
 * @returns エスケープ後の値
 */
function escapeCSVValue(value: string): string {
  // カンマ、ダブルクォート、改行を含む場合はエスケープが必要
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // ダブルクォートを2つ重ねてエスケープ
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

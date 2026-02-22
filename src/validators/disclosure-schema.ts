/**
 * Zodスキーマ定義
 *
 * 開示情報のバリデーションスキーマを定義します。
 * Zodを使用することで、型安全なバリデーションとTypeScript型の自動生成が可能になります。
 *
 * Requirements: 要件2.1, 2.2, 2.3（メタデータ管理）
 */

import { z } from 'zod';

/**
 * ISO 8601形式の日時文字列スキーマ
 *
 * フォーマット: YYYY-MM-DDTHH:mm:ss.sssZ または YYYY-MM-DDTHH:mm:ss±HH:mm
 * 例: "2024-01-15T10:30:00Z", "2024-01-15T10:30:00.123Z", "2024-01-15T10:30:00+09:00"
 */
const iso8601Schema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([Z]|[+-]\d{2}:\d{2})$/,
    'ISO 8601形式の日時文字列である必要があります（例: "2024-01-15T10:30:00Z"）'
  )
  .refine(
    (dateStr) => {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return false;
      }

      // 日付の正規化チェック（例: 2024-02-30 → 2024-03-01 のような変換を検出）
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, yearStr, monthStr, dayStr] = match;
        const inputYear = parseInt(yearStr, 10);
        const inputMonth = parseInt(monthStr, 10);
        const inputDay = parseInt(dayStr, 10);

        if (
          date.getUTCFullYear() !== inputYear ||
          date.getUTCMonth() + 1 !== inputMonth ||
          date.getUTCDate() !== inputDay
        ) {
          return false;
        }
      }

      // 範囲チェック（1970-01-01 以降、現在時刻+1日以内）
      const minDate = new Date('1970-01-01T00:00:00Z');
      const maxDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return date >= minDate && date <= maxDate;
    },
    {
      message:
        '有効な日付である必要があります（1970-01-01以降、現在時刻+1日以内、存在する日付）',
    }
  );

/**
 * 企業コードスキーマ
 *
 * フォーマット: 4桁の数字（1000-9999）
 * 例: "7203", "1234", "9999"
 */
const companyCodeSchema = z
  .string()
  .regex(/^\d{4}$/, '企業コードは4桁の数字である必要があります')
  .refine(
    (code) => {
      const num = parseInt(code, 10);
      return num >= 1000 && num <= 9999;
    },
    { message: '企業コードは1000から9999の範囲である必要があります' }
  );

/**
 * date_partitionスキーマ
 *
 * フォーマット: YYYY-MM形式（JST基準）
 * 例: "2024-01", "2024-12"
 */
const datePartitionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'date_partitionはYYYY-MM形式である必要があります')
  .refine(
    (partition) => {
      const [, monthStr] = partition.split('-');
      const month = parseInt(monthStr, 10);
      return month >= 1 && month <= 12;
    },
    { message: '月は01から12の範囲である必要があります' }
  );

/**
 * URLスキーマ（オプショナル）
 */
const urlSchema = z.string().url('有効なURLである必要があります').optional();

/**
 * S3キースキーマ（オプショナル）
 *
 * フォーマット: YYYY/MM/disclosure_id.pdf
 * 例: "2024/01/20240115_7203_001.pdf"
 */
const s3KeySchema = z
  .string()
  .regex(
    /^\d{4}\/\d{2}\/\d{8}_\d{4}_\d{3}\.pdf$/,
    'S3キーはYYYY/MM/YYYYMMDD_CCCC_SSS.pdf形式である必要があります'
  )
  .optional();

/**
 * ファイルサイズスキーマ（オプショナル）
 *
 * 範囲: 0バイト以上、100MB以下
 */
const fileSizeSchema = z
  .number()
  .int('ファイルサイズは整数である必要があります')
  .min(0, 'ファイルサイズは0以上である必要があります')
  .max(100 * 1024 * 1024, 'ファイルサイズは100MB以下である必要があります')
  .optional();

/**
 * 開示情報スキーマ
 *
 * TDnetから取得した開示情報のメタデータを表します。
 */
export const disclosureSchema = z.object({
  /** 開示ID（一意識別子）: 日付_企業コード_連番形式 */
  disclosure_id: z
    .string()
    .regex(
      /^\d{8}_\d{4}_\d{3}$/,
      '開示IDはYYYYMMDD_CCCC_SSS形式である必要があります（例: "20240115_7203_001"）'
    ),

  /** 企業コード（4桁の数字、1000-9999） */
  company_code: companyCodeSchema,

  /** 企業名 */
  company_name: z.string().min(1, '企業名は必須です'),

  /** 開示種類（例: 決算短信、有価証券報告書、適時開示） */
  disclosure_type: z.string().min(1, '開示種類は必須です'),

  /** タイトル */
  title: z.string().min(1, 'タイトルは必須です'),

  /** 開示日時(ISO 8601形式、UTC推奨）: "2024-01-15T10:30:00Z" */
  disclosed_at: iso8601Schema,

  /** PDF URL（オプショナル） */
  pdf_url: urlSchema,

  /** S3キー（PDFファイルの保存先、オプショナル） */
  pdf_s3_key: s3KeySchema,

  /** ファイルサイズ（バイト、オプショナル） */
  file_size: fileSizeSchema,

  /** ダウンロード日時（ISO 8601形式、UTC）: "2024-01-15T10:35:00Z" */
  downloaded_at: iso8601Schema,

  /** date_partition（YYYY-MM形式、JST基準）: "2024-01" */
  date_partition: datePartitionSchema,
});

/**
 * Zodスキーマから推論されたDisclosure型
 */
export type DisclosureZod = z.infer<typeof disclosureSchema>;

/**
 * 収集結果スキーマ
 */
export const collectionResultSchema = z.object({
  /** 実行ID */
  execution_id: z.string().min(1, '実行IDは必須です'),

  /** 成功件数 */
  success_count: z.number().int().min(0, '成功件数は0以上である必要があります'),

  /** 失敗件数 */
  failed_count: z.number().int().min(0, '失敗件数は0以上である必要があります'),

  /** 収集した開示情報のリスト */
  disclosures: z.array(disclosureSchema),

  /** エラーメッセージのリスト */
  errors: z.array(
    z.object({
      disclosure_id: z.string().optional(),
      error_message: z.string(),
      error_type: z.string(),
    })
  ),
});

/**
 * 実行状態スキーマ
 */
export const executionStatusSchema = z.object({
  /** 実行ID */
  execution_id: z.string().min(1, '実行IDは必須です'),

  /** 状態（pending, running, completed, failed） */
  status: z.enum(['pending', 'running', 'completed', 'failed']),

  /** 開始日時（ISO 8601形式、UTC） */
  started_at: iso8601Schema,

  /** 終了日時（ISO 8601形式、UTC） */
  completed_at: iso8601Schema.optional(),

  /** 進捗率（0〜100） */
  progress: z.number().int().min(0).max(100, '進捗率は0から100の範囲である必要があります'),

  /** 成功件数 */
  success_count: z.number().int().min(0, '成功件数は0以上である必要があります'),

  /** 失敗件数 */
  failed_count: z.number().int().min(0, '失敗件数は0以上である必要があります'),

  /** エラーメッセージ */
  error_message: z.string().optional(),

  /** TTL（Unix timestamp、30日後に自動削除） */
  ttl: z.number().int().positive('TTLは正の整数である必要があります'),
});

/**
 * クエリフィルタースキーマ
 */
export const queryFilterSchema = z.object({
  /** 企業コード */
  company_code: companyCodeSchema.optional(),

  /** 開始日（ISO 8601形式） */
  start_date: iso8601Schema.optional(),

  /** 終了日（ISO 8601形式） */
  end_date: iso8601Schema.optional(),

  /** 開示種類 */
  disclosure_type: z.string().optional(),

  /** 取得件数の上限 */
  limit: z.number().int().min(1).max(1000, '取得件数は1から1000の範囲である必要があります').optional(),

  /** オフセット（ページネーション用） */
  offset: z.number().int().min(0, 'オフセットは0以上である必要があります').optional(),
});

/**
 * Disclosureをバリデーション
 *
 * @param data - バリデーション対象のデータ
 * @returns バリデーション済みのDisclosure
 * @throws {z.ZodError} バリデーションエラーの場合
 */
export function validateDisclosureWithZod(data: unknown): DisclosureZod {
  return disclosureSchema.parse(data);
}

/**
 * Disclosureをバリデーション（安全版）
 *
 * @param data - バリデーション対象のデータ
 * @returns バリデーション結果
 */
export function safeValidateDisclosure(data: unknown): z.SafeParseReturnType<unknown, DisclosureZod> {
  return disclosureSchema.safeParse(data);
}


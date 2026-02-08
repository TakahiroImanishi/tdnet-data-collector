/**
 * Lambda Export型定義
 *
 * エクスポート機能で使用する型定義を集約します。
 *
 * Requirements: 要件5.1, 5.2, 5.4（エクスポート機能）
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

/**
 * エクスポートイベント（API Gateway経由）
 */
export interface ExportEvent extends APIGatewayProxyEvent {
  body: string; // JSON文字列
}

/**
 * エクスポートリクエストボディ
 */
export interface ExportRequestBody {
  /** フォーマット（json, csv） */
  format: 'json' | 'csv';

  /** クエリフィルター */
  filter: {
    /** 企業コード */
    company_code?: string;

    /** 開始日（ISO 8601形式、YYYY-MM-DD） */
    start_date?: string;

    /** 終了日（ISO 8601形式、YYYY-MM-DD） */
    end_date?: string;

    /** 開示種類 */
    disclosure_type?: string;
  };
}

/**
 * エクスポートレスポンス
 */
export interface ExportResponse {
  /** エクスポートID */
  export_id: string;

  /** 状態（pending, processing, completed, failed） */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** メッセージ */
  message: string;

  /** 進捗率（0〜100） */
  progress: number;

  /** ダウンロードURL（署名付きURL、有効期限7日） */
  download_url?: string;

  /** エラーメッセージ */
  error_message?: string;
}

/**
 * エクスポートステータス（DynamoDB保存用）
 */
export interface ExportStatusItem {
  /** エクスポートID（パーティションキー） */
  export_id: string;

  /** 状態（pending, processing, completed, failed） */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** リクエスト日時（ISO 8601形式、UTC） */
  requested_at: string;

  /** 完了日時（ISO 8601形式、UTC） */
  completed_at?: string;

  /** 進捗率（0〜100） */
  progress: number;

  /** S3キー（エクスポートファイルの保存先） */
  s3_key?: string;

  /** ダウンロードURL（署名付きURL、有効期限7日） */
  download_url?: string;

  /** エラーメッセージ */
  error_message?: string;

  /** TTL（Unix timestamp、30日後に自動削除） */
  ttl: number;

  /** フォーマット（json, csv） */
  format: 'json' | 'csv';

  /** クエリフィルター（JSON文字列） */
  filter: string;
}

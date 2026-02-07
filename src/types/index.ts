/**
 * TypeScript型定義
 * 
 * TDnet Data Collectorで使用する型定義を集約します。
 * 
 * Requirements: 要件2.1, 2.2, 2.3（メタデータ管理）
 */

/**
 * 開示情報
 * 
 * TDnetから取得した開示情報のメタデータを表します。
 */
export interface Disclosure {
  /** 開示ID（一意識別子）: 日付_企業コード_連番形式 */
  disclosure_id: string;
  
  /** 企業コード（4桁の数字） */
  company_code: string;
  
  /** 企業名 */
  company_name: string;
  
  /** 開示種類（例: 決算短信、有価証券報告書、適時開示） */
  disclosure_type: string;
  
  /** タイトル */
  title: string;
  
  /** 開示日時（ISO 8601形式、UTC推奨）: "2024-01-15T10:30:00Z" */
  disclosed_at: string;
  
  /** PDF URL */
  pdf_url: string;
  
  /** S3キー（PDFファイルの保存先） */
  s3_key: string;
  
  /** 収集日時（ISO 8601形式、UTC）: "2024-01-15T10:35:00Z" */
  collected_at: string;
  
  /** date_partition（YYYY-MM形式、JST基準）: "2024-01" */
  date_partition: string;
}

/**
 * 収集結果
 * 
 * データ収集処理の結果を表します。
 */
export interface CollectionResult {
  /** 実行ID */
  execution_id: string;
  
  /** 成功件数 */
  success_count: number;
  
  /** 失敗件数 */
  failed_count: number;
  
  /** 収集した開示情報のリスト */
  disclosures: Disclosure[];
  
  /** エラーメッセージのリスト */
  errors: Array<{
    disclosure_id?: string;
    error_message: string;
    error_type: string;
  }>;
}

/**
 * 実行状態
 * 
 * データ収集処理の実行状態を表します。
 */
export interface ExecutionStatus {
  /** 実行ID */
  execution_id: string;
  
  /** 状態（pending, running, completed, failed） */
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  /** 開始日時（ISO 8601形式、UTC） */
  started_at: string;
  
  /** 終了日時（ISO 8601形式、UTC） */
  completed_at?: string;
  
  /** 進捗率（0〜100） */
  progress: number;
  
  /** 成功件数 */
  success_count: number;
  
  /** 失敗件数 */
  failed_count: number;
  
  /** エラーメッセージ */
  error_message?: string;
  
  /** TTL（Unix timestamp、30日後に自動削除） */
  ttl: number;
}

/**
 * クエリフィルター
 * 
 * 開示情報の検索条件を表します。
 */
export interface QueryFilter {
  /** 企業コード */
  company_code?: string;
  
  /** 開始日（ISO 8601形式） */
  start_date?: string;
  
  /** 終了日（ISO 8601形式） */
  end_date?: string;
  
  /** 開示種類 */
  disclosure_type?: string;
  
  /** 取得件数の上限 */
  limit?: number;
  
  /** オフセット（ページネーション用） */
  offset?: number;
}

/**
 * DynamoDBアイテム型
 * 
 * DynamoDBに保存する際の型定義。
 * AWS SDK v3のAttributeValue型を使用します。
 */
export interface DynamoDBItem {
  [key: string]: any;
}

/**
 * エクスポートリクエスト
 * 
 * データエクスポート処理のリクエストを表します。
 */
export interface ExportRequest {
  /** エクスポートID */
  export_id: string;
  
  /** フォーマット（json, csv） */
  format: 'json' | 'csv';
  
  /** クエリフィルター */
  filter: QueryFilter;
  
  /** リクエスト日時（ISO 8601形式、UTC） */
  requested_at: string;
}

/**
 * エクスポート状態
 * 
 * データエクスポート処理の状態を表します。
 */
export interface ExportStatus {
  /** エクスポートID */
  export_id: string;
  
  /** 状態（pending, processing, completed, failed） */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  /** リクエスト日時（ISO 8601形式、UTC） */
  requested_at: string;
  
  /** 完了日時（ISO 8601形式、UTC） */
  completed_at?: string;
  
  /** 進捗率（0〜100） */
  progress: number;
  
  /** ダウンロードURL（署名付きURL、有効期限7日） */
  download_url?: string;
  
  /** エラーメッセージ */
  error_message?: string;
  
  /** TTL（Unix timestamp、30日後に自動削除） */
  ttl: number;
}

/**
 * Lambda Collectorイベント
 * 
 * Lambda Collector関数に渡されるイベント型。
 */
export interface CollectorEvent {
  /** モード（batch: 日次バッチ、ondemand: オンデマンド） */
  mode: 'batch' | 'ondemand';
  
  /** 開始日（ISO 8601形式、YYYY-MM-DD） */
  start_date?: string;
  
  /** 終了日（ISO 8601形式、YYYY-MM-DD） */
  end_date?: string;
}

/**
 * Lambda Collectorレスポンス
 * 
 * Lambda Collector関数のレスポンス型。
 */
export interface CollectorResponse {
  /** 実行ID */
  execution_id: string;
  
  /** 状態 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  /** メッセージ */
  message: string;
}

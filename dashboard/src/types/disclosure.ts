// 開示情報の型定義

export interface Disclosure {
  disclosure_id: string;
  company_code: string;
  company_name: string;
  title: string;
  disclosed_at: string;
  disclosure_type: string;
  pdf_url?: string;
  xbrl_url?: string;
  date_partition: string;
  created_at: string;
  updated_at: string;
}

export interface SearchParams {
  company_name?: string;
  company_code?: string;
  start_date?: string;
  end_date?: string;
  disclosure_type?: string;
  page?: number;
  limit?: number;
  sort_by?: 'disclosed_at' | 'company_name';
  sort_order?: 'asc' | 'desc';
}

export interface PaginationInfo {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  message?: string;
}

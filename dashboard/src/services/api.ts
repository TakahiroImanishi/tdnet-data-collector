// API通信サービス
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Disclosure, SearchParams, ApiResponse } from '../types/disclosure';

// 環境変数からAPI設定を取得
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4566';
const API_KEY = process.env.REACT_APP_API_KEY || '';

// Axiosインスタンスを作成
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
});

// レスポンスインターセプター（エラーハンドリング）
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // サーバーからのエラーレスポンス
      const status = error.response.status;
      const message = (error.response.data as any)?.message || 'サーバーエラーが発生しました';
      
      if (status === 401 || status === 403) {
        throw new Error('認証エラー: APIキーを確認してください');
      } else if (status === 404) {
        throw new Error('リソースが見つかりません');
      } else if (status >= 500) {
        throw new Error(`サーバーエラー: ${message}`);
      } else {
        throw new Error(message);
      }
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      throw new Error('サーバーに接続できません。ネットワークを確認してください。');
    } else {
      // リクエスト設定時のエラー
      throw new Error(`リクエストエラー: ${error.message}`);
    }
  }
);

/**
 * 開示情報を検索
 */
export const searchDisclosures = async (
  params: SearchParams
): Promise<ApiResponse<Disclosure[]>> => {
  try {
    const response = await apiClient.get<ApiResponse<Disclosure[]>>('/disclosures', {
      params: {
        ...params,
        page: params.page || 1,
        limit: params.limit || 20,
        sort_by: params.sort_by || 'disclosed_at',
        sort_order: params.sort_order || 'desc',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('開示情報の検索に失敗しました:', error);
    throw error;
  }
};

/**
 * 開示情報の詳細を取得
 */
export const getDisclosureById = async (
  disclosureId: string
): Promise<ApiResponse<Disclosure>> => {
  try {
    const response = await apiClient.get<ApiResponse<Disclosure>>(
      `/disclosures/${disclosureId}`
    );
    
    return response.data;
  } catch (error) {
    console.error('開示情報の取得に失敗しました:', error);
    throw error;
  }
};

/**
 * 開示種類の一覧を取得
 */
export const getDisclosureTypes = async (): Promise<string[]> => {
  try {
    // TODO: 実際のAPIエンドポイントに置き換える
    // 現時点では固定値を返す
    return [
      '決算短信',
      '有価証券報告書',
      '四半期報告書',
      '臨時報告書',
      '適時開示',
      'その他',
    ];
  } catch (error) {
    console.error('開示種類の取得に失敗しました:', error);
    throw error;
  }
};

/**
 * PDFの署名付きURLを取得
 */
export const getPdfDownloadUrl = async (
  disclosureId: string
): Promise<ApiResponse<{ url: string; expires_in: number }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ url: string; expires_in: number }>>(
      `/disclosures/${disclosureId}/pdf`
    );
    
    return response.data;
  } catch (error) {
    console.error('PDF署名付きURLの取得に失敗しました:', error);
    throw error;
  }
};

/**
 * エクスポートジョブを作成
 */
export const createExportJob = async (
  params: {
    start_date: string;
    end_date: string;
    company_code?: string;
    disclosure_type?: string;
  }
): Promise<ApiResponse<{ export_id: string; status: string }>> => {
  try {
    const response = await apiClient.post<ApiResponse<{ export_id: string; status: string }>>(
      '/exports',
      params
    );
    
    return response.data;
  } catch (error) {
    console.error('エクスポートジョブの作成に失敗しました:', error);
    throw error;
  }
};

/**
 * エクスポートジョブの状態を取得
 */
export const getExportStatus = async (
  exportId: string
): Promise<ApiResponse<{
  export_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}>> => {
  try {
    const response = await apiClient.get(
      `/exports/${exportId}`
    );
    
    return response.data;
  } catch (error) {
    console.error('エクスポート状態の取得に失敗しました:', error);
    throw error;
  }
};

/**
 * 収集実行の状態を取得
 */
export const getCollectionStatus = async (
  executionId: string
): Promise<ApiResponse<{
  execution_id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  total_items: number;
  processed_items: number;
  failed_items: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
}>> => {
  try {
    const response = await apiClient.get(
      `/collect/${executionId}`
    );
    
    return response.data;
  } catch (error) {
    console.error('収集実行状態の取得に失敗しました:', error);
    throw error;
  }
};

export default apiClient;

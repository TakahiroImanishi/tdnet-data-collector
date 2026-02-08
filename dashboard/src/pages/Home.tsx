// ホームページ - 開示情報検索・一覧表示
import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  AppBar,
  Toolbar,
  Alert,
} from '@mui/material';
import { Business as BusinessIcon } from '@mui/icons-material';
import SearchFilter from '../components/SearchFilter';
import DisclosureList from '../components/DisclosureList';
import { searchDisclosures } from '../services/api';
import { Disclosure, SearchParams, PaginationInfo } from '../types/disclosure';

const Home: React.FC = () => {
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // 検索パラメータの状態
  const [searchParams, setSearchParams] = useState<SearchParams>({
    page: 1,
    limit: 20,
    sort_by: 'disclosed_at',
    sort_order: 'desc',
  });

  // 開示情報を取得
  const fetchDisclosures = useCallback(async (params: SearchParams) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await searchDisclosures(params);
      
      if (response.success) {
        setDisclosures(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || '開示情報の取得に失敗しました');
      }
    } catch (err) {
      console.error('開示情報の取得エラー:', err);
      setError(
        err instanceof Error
          ? err.message
          : '開示情報の取得中にエラーが発生しました'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回読み込み
  useEffect(() => {
    fetchDisclosures(searchParams);
  }, [fetchDisclosures, searchParams]);

  // 検索実行
  const handleSearch = (params: SearchParams) => {
    const newParams: SearchParams = {
      ...params,
      page: 1, // 検索時はページをリセット
      limit: searchParams.limit,
      sort_by: searchParams.sort_by,
      sort_order: searchParams.sort_order,
    };
    
    setSearchParams(newParams);
  };

  // ページ変更
  const handlePageChange = (page: number) => {
    setSearchParams({
      ...searchParams,
      page,
    });
  };

  // 表示件数変更
  const handleRowsPerPageChange = (limit: number) => {
    setSearchParams({
      ...searchParams,
      page: 1,
      limit,
    });
  };

  // ソート変更
  const handleSortChange = (
    sortBy: 'disclosed_at' | 'company_name',
    sortOrder: 'asc' | 'desc'
  ) => {
    setSearchParams({
      ...searchParams,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <AppBar position="static" elevation={2}>
        <Toolbar>
          <BusinessIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            TDnet 開示情報ダッシュボード
          </Typography>
        </Toolbar>
      </AppBar>

      {/* メインコンテンツ */}
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flexGrow: 1 }}>
        {/* 検索フィルター */}
        <SearchFilter onSearch={handleSearch} loading={loading} />

        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* 開示情報一覧 */}
        <DisclosureList
          disclosures={disclosures}
          pagination={pagination}
          loading={loading}
          error={error}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
          onSortChange={handleSortChange}
        />
      </Container>

      {/* フッター */}
      <Box
        component="footer"
        sx={{
          py: 3,
          px: 2,
          mt: 'auto',
          backgroundColor: (theme) =>
            theme.palette.mode === 'light'
              ? theme.palette.grey[200]
              : theme.palette.grey[800],
        }}
      >
        <Container maxWidth="xl">
          <Typography variant="body2" color="text.secondary" align="center">
            © 2026 TDnet Data Collector. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Home;

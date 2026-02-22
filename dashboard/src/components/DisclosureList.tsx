// 開示情報一覧コンポーネント
import React, { useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Typography,
  Link,
  Chip,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import {
  Code as XbrlIcon,
} from '@mui/icons-material';
import { Disclosure, PaginationInfo } from '../types/disclosure';
import PdfDownload from './PdfDownload';

interface DisclosureListProps {
  disclosures: Disclosure[];
  pagination?: PaginationInfo;
  loading?: boolean;
  error?: string;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onSortChange: (sortBy: 'disclosed_at' | 'company_name', sortOrder: 'asc' | 'desc') => void;
}

const DisclosureList: React.FC<DisclosureListProps> = ({
  disclosures,
  pagination,
  loading = false,
  error,
  onPageChange,
  onRowsPerPageChange,
  onSortChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [sortBy, setSortBy] = useState<'disclosed_at' | 'company_name'>('disclosed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ソート変更ハンドラー
  const handleSortChange = (field: 'disclosed_at' | 'company_name') => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);
    onSortChange(field, newOrder);
  };

  // 日時フォーマット
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ローディング表示
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // エラー表示
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // データなし
  if (!disclosures || disclosures.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        開示情報が見つかりませんでした。検索条件を変更してください。
      </Alert>
    );
  }

  // モバイル表示（カード形式）
  if (isMobile) {
    return (
      <Box>
        <Stack spacing={2}>
          {disclosures.map((disclosure) => (
            <Card key={disclosure.disclosure_id} elevation={2}>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {disclosure.company_code} - {disclosure.company_name}
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {disclosure.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={disclosure.disclosure_type}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip
                    label={formatDateTime(disclosure.disclosed_at)}
                    size="small"
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {disclosure.pdf_url && (
                    <PdfDownload
                      disclosureId={disclosure.disclosure_id}
                      fileName={`${disclosure.company_code}_${disclosure.title.substring(0, 20)}.pdf`}
                    />
                  )}
                  {disclosure.xbrl_url && (
                    <Link
                      href={disclosure.xbrl_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <XbrlIcon fontSize="small" />
                      XBRL
                    </Link>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
        
        {pagination && (
          <TablePagination
            component="div"
            count={pagination.total_items}
            page={pagination.current_page - 1}
            onPageChange={(_, page) => onPageChange(page + 1)}
            rowsPerPage={pagination.items_per_page}
            onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
            labelRowsPerPage="表示件数:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
          />
        )}
      </Box>
    );
  }

  // デスクトップ・タブレット表示（テーブル形式）
  return (
    <Paper elevation={2}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'disclosed_at'}
                  direction={sortBy === 'disclosed_at' ? sortOrder : 'desc'}
                  onClick={() => handleSortChange('disclosed_at')}
                >
                  開示日時
                </TableSortLabel>
              </TableCell>
              {!isTablet && <TableCell>企業コード</TableCell>}
              <TableCell>
                <TableSortLabel
                  active={sortBy === 'company_name'}
                  direction={sortBy === 'company_name' ? sortOrder : 'asc'}
                  onClick={() => handleSortChange('company_name')}
                >
                  企業名
                </TableSortLabel>
              </TableCell>
              <TableCell>タイトル</TableCell>
              <TableCell>開示種類</TableCell>
              <TableCell align="center">ファイル</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {disclosures.map((disclosure) => (
              <TableRow key={disclosure.disclosure_id} hover>
                <TableCell>
                  <Typography variant="body2" noWrap>
                    {formatDateTime(disclosure.disclosed_at)}
                  </Typography>
                </TableCell>
                {!isTablet && (
                  <TableCell>
                    <Typography variant="body2">{disclosure.company_code}</Typography>
                  </TableCell>
                )}
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {disclosure.company_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300 }}>
                    {disclosure.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={disclosure.disclosure_type}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {disclosure.pdf_url && (
                      <PdfDownload
                        disclosureId={disclosure.disclosure_id}
                        fileName={`${disclosure.company_code}_${disclosure.title.substring(0, 20)}.pdf`}
                      />
                    )}
                    {disclosure.xbrl_url && (
                      <Link
                        href={disclosure.xbrl_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="XBRLを開く"
                      >
                        <XbrlIcon color="primary" />
                      </Link>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {pagination && (
        <TablePagination
          component="div"
          count={pagination.total_items}
          page={pagination.current_page - 1}
          onPageChange={(_, page) => onPageChange(page + 1)}
          rowsPerPage={pagination.items_per_page}
          onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
          labelRowsPerPage="表示件数:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      )}
    </Paper>
  );
};

export default DisclosureList;

// 検索・フィルタリングコンポーネント
import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  MenuItem,
  Paper,
  Typography,
  Collapse,
  IconButton,
  Grid,
} from '@mui/material';
import { Search as SearchIcon, FilterList as FilterIcon } from '@mui/icons-material';
import { SearchParams } from '../types/disclosure';
import { getDisclosureTypes } from '../services/api';

interface SearchFilterProps {
  onSearch: (params: SearchParams) => void;
  loading?: boolean;
}

const SearchFilter: React.FC<SearchFilterProps> = ({ onSearch, loading = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [disclosureTypes, setDisclosureTypes] = useState<string[]>([]);
  
  // フォームの状態
  const [formData, setFormData] = useState<SearchParams>({
    company_name: '',
    company_code: '',
    start_date: '',
    end_date: '',
    disclosure_type: '',
  });

  // 開示種類の一覧を取得
  useEffect(() => {
    const fetchDisclosureTypes = async () => {
      try {
        const types = await getDisclosureTypes();
        setDisclosureTypes(types);
      } catch (error) {
        console.error('開示種類の取得に失敗しました:', error);
      }
    };
    
    fetchDisclosureTypes();
  }, []);

  // フォーム入力の変更ハンドラー
  const handleChange = (field: keyof SearchParams) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  // 検索実行
  const handleSearch = () => {
    // 空の値を除外
    const params: SearchParams = {};
    
    if (formData.company_name) params.company_name = formData.company_name;
    if (formData.company_code) params.company_code = formData.company_code;
    if (formData.start_date) params.start_date = formData.start_date;
    if (formData.end_date) params.end_date = formData.end_date;
    if (formData.disclosure_type) params.disclosure_type = formData.disclosure_type;
    
    onSearch(params);
  };

  // フォームのリセット
  const handleReset = () => {
    setFormData({
      company_name: '',
      company_code: '',
      start_date: '',
      end_date: '',
      disclosure_type: '',
    });
    onSearch({});
  };

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h2">
          開示情報検索
        </Typography>
        <IconButton
          onClick={() => setExpanded(!expanded)}
          sx={{ ml: 'auto' }}
          aria-label="フィルター表示切替"
        >
          <FilterIcon />
        </IconButton>
      </Box>

      {/* 基本検索フィールド */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="企業名"
            placeholder="例: トヨタ自動車"
            value={formData.company_name}
            onChange={handleChange('company_name')}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            fullWidth
            label="企業コード"
            placeholder="例: 7203"
            value={formData.company_code}
            onChange={handleChange('company_code')}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={4}>
          <TextField
            fullWidth
            select
            label="開示種類"
            value={formData.disclosure_type}
            onChange={handleChange('disclosure_type')}
            disabled={loading}
          >
            <MenuItem value="">すべて</MenuItem>
            {disclosureTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {/* 詳細フィルター（折りたたみ可能） */}
      <Collapse in={expanded}>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="開示日（開始）"
              value={formData.start_date}
              onChange={handleChange('start_date')}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={loading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="date"
              label="開示日（終了）"
              value={formData.end_date}
              onChange={handleChange('end_date')}
              slotProps={{ inputLabel: { shrink: true } }}
              disabled={loading}
            />
          </Grid>
        </Grid>
      </Collapse>

      {/* アクションボタン */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          onClick={handleReset}
          disabled={loading}
        >
          リセット
        </Button>
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          disabled={loading}
        >
          検索
        </Button>
      </Box>
    </Paper>
  );
};

export default SearchFilter;

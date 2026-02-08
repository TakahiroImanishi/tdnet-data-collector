// エクスポートダイアログコンポーネント
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  CircularProgress,
  Alert,
  LinearProgress,
  Box,
  Typography,
  Link,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { createExportJob, getExportStatus } from '../services/api';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * エクスポートダイアログコンポーネント
 * エクスポートリクエストを送信し、状態をポーリングして結果を表示
 */
const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [disclosureType, setDisclosureType] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [exportId, setExportId] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ポーリング処理
  useEffect(() => {
    if (!exportId || status === 'completed' || status === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await getExportStatus(exportId);
        
        if (response.success) {
          setStatus(response.data.status);
          
          if (response.data.status === 'completed' && response.data.download_url) {
            setDownloadUrl(response.data.download_url);
            clearInterval(pollInterval);
          } else if (response.data.status === 'failed') {
            setError(response.data.error_message || 'エクスポートに失敗しました');
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        console.error('Export status polling error:', err);
        setError('エクスポート状態の取得に失敗しました');
        clearInterval(pollInterval);
      }
    }, 5000); // 5秒間隔でポーリング

    return () => clearInterval(pollInterval);
  }, [exportId, status]);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setError('開始日と終了日を入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setExportId(null);
    setStatus(null);
    setDownloadUrl(null);

    try {
      const response = await createExportJob({
        start_date: startDate,
        end_date: endDate,
        company_code: companyCode || undefined,
        disclosure_type: disclosureType || undefined,
      });

      if (response.success) {
        setExportId(response.data.export_id);
        setStatus(response.data.status as ExportStatus);
      } else {
        throw new Error(response.message || 'エクスポートの開始に失敗しました');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'エクスポートの開始に失敗しました';
      setError(errorMessage);
      console.error('Export creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // リセット
    setStartDate('');
    setEndDate('');
    setCompanyCode('');
    setDisclosureType('');
    setExportId(null);
    setStatus(null);
    setDownloadUrl(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>データエクスポート</DialogTitle>
      
      <DialogContent>
        {/* エラー表示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* エクスポート中の状態表示 */}
        {exportId && status && status !== 'completed' && status !== 'failed' && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              エクスポート中... ({status})
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {/* 完了時のダウンロードリンク */}
        {status === 'completed' && downloadUrl && (
          <Alert severity="success" sx={{ mb: 2 }}>
            エクスポートが完了しました
            <Box sx={{ mt: 1 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
                size="small"
              >
                ダウンロード
              </Button>
            </Box>
          </Alert>
        )}

        {/* エクスポート設定フォーム */}
        {!exportId && (
          <>
            <TextField
              label="開始日"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
            
            <TextField
              label="終了日"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
            
            <TextField
              label="企業コード（オプション）"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="例: 7203"
            />
            
            <TextField
              label="開示種類（オプション）"
              value={disclosureType}
              onChange={(e) => setDisclosureType(e.target.value)}
              fullWidth
              margin="normal"
              placeholder="例: 決算短信"
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {status === 'completed' ? '閉じる' : 'キャンセル'}
        </Button>
        
        {!exportId && (
          <Button
            onClick={handleExport}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {loading ? 'エクスポート中...' : 'エクスポート'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;

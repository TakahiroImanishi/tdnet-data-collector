// PDFダウンロードコンポーネント
import React, { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { getPdfDownloadUrl } from '../services/api';

interface PdfDownloadProps {
  disclosureId: string;
  fileName?: string;
}

/**
 * PDFダウンロードボタンコンポーネント
 * 署名付きURLを取得してPDFをダウンロード
 */
const PdfDownload: React.FC<PdfDownloadProps> = ({ disclosureId, fileName }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);

    try {
      // 署名付きURLを取得
      const response = await getPdfDownloadUrl(disclosureId);
      
      if (response.success && response.data.url) {
        // 新しいウィンドウでダウンロード
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = fileName || `${disclosureId}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('PDFのURLを取得できませんでした');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PDFのダウンロードに失敗しました';
      setError(errorMessage);
      console.error('PDF download error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
        onClick={handleDownload}
        disabled={loading}
        size="small"
      >
        {loading ? 'ダウンロード中...' : 'PDFダウンロード'}
      </Button>

      {/* エラー表示 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PdfDownload;

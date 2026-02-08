// 実行状態表示コンポーネント
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { getCollectionStatus } from '../services/api';

interface ExecutionStatusProps {
  executionId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

type CollectionStatus = 'running' | 'completed' | 'failed';

/**
 * 収集実行状態表示コンポーネント
 * 収集実行の進捗をポーリングして表示
 */
const ExecutionStatus: React.FC<ExecutionStatusProps> = ({
  executionId,
  onComplete,
  onError,
}) => {
  const [status, setStatus] = useState<CollectionStatus>('running');
  const [progress, setProgress] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [failedItems, setFailedItems] = useState(0);
  const [startedAt, setStartedAt] = useState<string>('');
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ポーリング処理
  useEffect(() => {
    if (!executionId) {
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;
    let isMounted = true;
    let inFlight = false; // 二重呼び出し防止

    const fetchStatus = async () => {
      // 二重呼び出し防止
      if (inFlight) {
        return;
      }
      
      inFlight = true;
      
      try {
        const response = await getCollectionStatus(executionId);
        
        if (!isMounted) return;
        
        if (response.success) {
          const data = response.data;
          
          setStatus(data.status);
          setProgress(data.progress);
          setTotalItems(data.total_items);
          setProcessedItems(data.processed_items);
          setFailedItems(data.failed_items);
          setStartedAt(data.started_at);
          setCompletedAt(data.completed_at || null);
          setErrorMessage(data.error_message || null);
          setLoading(false);

          // 完了時にインターバルをクリア
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            
            // コールバック実行
            if (data.status === 'completed' && onComplete) {
              onComplete();
            } else if (data.status === 'failed' && onError) {
              onError(data.error_message || '収集に失敗しました');
            }
          }
        }
      } catch (err) {
        if (!isMounted) return;
        
        console.error('Collection status fetch error:', err);
        setErrorMessage('実行状態の取得に失敗しました');
        setStatus('failed');
        setLoading(false);
        
        // エラー時もインターバルをクリア
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        
        if (onError) {
          onError('実行状態の取得に失敗しました');
        }
      } finally {
        inFlight = false;
      }
    };

    // 初回実行
    fetchStatus();

    // ポーリング開始
    pollInterval = setInterval(fetchStatus, 5000); // 5秒間隔でポーリング

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [executionId, onComplete, onError]); // statusを依存配列から削除

  // ステータスアイコンとカラー
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <HourglassEmptyIcon color="primary" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (): 'default' | 'primary' | 'success' | 'error' => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'running':
        return '実行中';
      case 'completed':
        return '完了';
      case 'failed':
        return '失敗';
      default:
        return '不明';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            実行状態を取得中...
          </Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getStatusIcon()}
          <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
            収集実行状態
          </Typography>
          <Chip label={getStatusLabel()} color={getStatusColor()} />
        </Box>

        {/* エラーメッセージ */}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* 進捗バー */}
        {status === 'running' && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                進捗
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {/* 統計情報 */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            flexWrap: 'wrap',
            '& > *': {
              flex: { xs: '0 0 calc(50% - 8px)', sm: '0 0 calc(25% - 12px)' },
              minWidth: 0,
            },
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              総件数
            </Typography>
            <Typography variant="h6">{totalItems}</Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              処理済み
            </Typography>
            <Typography variant="h6" color="primary">
              {processedItems}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              失敗
            </Typography>
            <Typography variant="h6" color="error">
              {failedItems}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              成功率
            </Typography>
            <Typography variant="h6" color="success.main">
              {totalItems > 0
                ? `${Math.round(((processedItems - failedItems) / totalItems) * 100)}%`
                : '0%'}
            </Typography>
          </Box>
        </Stack>

        {/* タイムスタンプ */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            開始時刻: {new Date(startedAt).toLocaleString('ja-JP')}
          </Typography>
          {completedAt && (
            <Typography variant="body2" color="text.secondary">
              完了時刻: {new Date(completedAt).toLocaleString('ja-JP')}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ExecutionStatus;

// 実行状態表示コンポーネントのテスト
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExecutionStatus from '../ExecutionStatus';
import * as api from '../../services/api';

// APIモジュールをモック
jest.mock('../../services/api');

describe('ExecutionStatus', () => {
  const mockExecutionId = 'exec-123';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('正常にレンダリングされる', async () => {
    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 50,
        total_items: 100,
        processed_items: 50,
        failed_items: 5,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    await waitFor(() => {
      expect(screen.getByText('収集実行状態')).toBeInTheDocument();
      expect(screen.getByText('実行中')).toBeInTheDocument();
    });
  });

  it('実行中の進捗バーを表示する', async () => {
    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 75,
        total_items: 100,
        processed_items: 75,
        failed_items: 3,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    await waitFor(() => {
      expect(screen.getByText('進捗')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });
  });

  it('統計情報を正しく表示する', async () => {
    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 60,
        total_items: 200,
        processed_items: 120,
        failed_items: 10,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    await waitFor(() => {
      expect(screen.getByText('200')).toBeInTheDocument(); // 総件数
      expect(screen.getByText('120')).toBeInTheDocument(); // 処理済み
      expect(screen.getByText('10')).toBeInTheDocument(); // 失敗
      // 成功率: (120-10)/200 = 55%
      expect(screen.getByText('55%')).toBeInTheDocument();
    });
  });

  it('完了状態を表示する', async () => {
    const mockOnComplete = jest.fn();

    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'completed',
        progress: 100,
        total_items: 100,
        processed_items: 100,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
      },
    });

    await act(async () => {
      render(
        <ExecutionStatus executionId={mockExecutionId} onComplete={mockOnComplete} />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('完了')).toBeInTheDocument();
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('失敗状態とエラーメッセージを表示する', async () => {
    const errorMessage = '収集処理でエラーが発生しました';
    const mockOnError = jest.fn();

    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'failed',
        progress: 30,
        total_items: 100,
        processed_items: 30,
        failed_items: 30,
        started_at: '2024-01-15T10:00:00Z',
        error_message: errorMessage,
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} onError={mockOnError} />);
    });

    await waitFor(() => {
      expect(screen.getByText('失敗')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('5秒間隔でポーリングする', async () => {
    const mockGetCollectionStatus = jest.spyOn(api, 'getCollectionStatus');
    
    // 初回
    mockGetCollectionStatus.mockResolvedValueOnce({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 25,
        total_items: 100,
        processed_items: 25,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    // 2回目
    mockGetCollectionStatus.mockResolvedValueOnce({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 50,
        total_items: 100,
        processed_items: 50,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    // 初回呼び出し
    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledTimes(1);
    });

    // 5秒後のポーリング
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledTimes(2);
    });
  });

  it('完了後はポーリングを停止する', async () => {
    const mockGetCollectionStatus = jest.spyOn(api, 'getCollectionStatus');
    
    // 初回: 実行中
    mockGetCollectionStatus.mockResolvedValueOnce({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'running',
        progress: 90,
        total_items: 100,
        processed_items: 90,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
      },
    });

    // 2回目: 完了
    mockGetCollectionStatus.mockResolvedValueOnce({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'completed',
        progress: 100,
        total_items: 100,
        processed_items: 100,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    // 初回呼び出し
    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledTimes(1);
    });

    // 5秒後のポーリング（完了状態になる）
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledTimes(2);
    });

    // さらに5秒後（ポーリング停止を確認）
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(mockGetCollectionStatus).toHaveBeenCalledTimes(2); // 増えない
    });
  });

  it('API呼び出し失敗時にエラーを表示する', async () => {
    const mockOnError = jest.fn();
    jest.spyOn(api, 'getCollectionStatus').mockRejectedValue(
      new Error('API呼び出しに失敗しました')
    );

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} onError={mockOnError} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/実行状態の取得に失敗しました/i)).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  it('タイムスタンプを正しく表示する', async () => {
    jest.spyOn(api, 'getCollectionStatus').mockResolvedValue({
      success: true,
      data: {
        execution_id: mockExecutionId,
        status: 'completed',
        progress: 100,
        total_items: 100,
        processed_items: 100,
        failed_items: 0,
        started_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:30:00Z',
      },
    });

    await act(async () => {
      render(<ExecutionStatus executionId={mockExecutionId} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/開始時刻:/i)).toBeInTheDocument();
      expect(screen.getByText(/完了時刻:/i)).toBeInTheDocument();
    });
  });
});

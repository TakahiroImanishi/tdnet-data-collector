// エクスポートダイアログコンポーネントのテスト
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExportDialog from '../ExportDialog';
import * as api from '../../services/api';

// APIモジュールをモック
jest.mock('../../services/api');

describe('ExportDialog', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('正常にレンダリングされる', () => {
    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('データエクスポート')).toBeInTheDocument();
    expect(screen.getByLabelText(/開始日/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/終了日/i)).toBeInTheDocument();
  });

  it('開いていない場合は表示されない', () => {
    render(<ExportDialog open={false} onClose={mockOnClose} />);
    
    expect(screen.queryByText('データエクスポート')).not.toBeInTheDocument();
  });

  it('必須フィールドが未入力の場合にエラーを表示する', async () => {
    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    const exportButton = screen.getByRole('button', { name: /エクスポート$/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText(/開始日と終了日を入力してください/i)).toBeInTheDocument();
    });
  });

  it('エクスポートジョブを作成し、ポーリングを開始する', async () => {
    const mockExportId = 'export-123';
    const mockCreateExportJob = jest.spyOn(api, 'createExportJob').mockResolvedValue({
      success: true,
      data: { export_id: mockExportId, status: 'pending' },
    });

    const mockGetExportStatus = jest.spyOn(api, 'getExportStatus').mockResolvedValue({
      success: true,
      data: {
        export_id: mockExportId,
        status: 'processing',
        created_at: '2024-01-15T10:00:00Z',
      },
    });

    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    // フォーム入力
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/開始日/i), {
        target: { value: '2024-01-01' },
      });
      fireEvent.change(screen.getByLabelText(/終了日/i), {
        target: { value: '2024-01-31' },
      });
    });

    // エクスポート実行
    const exportButton = screen.getByRole('button', { name: /エクスポート$/i });
    await act(async () => {
      fireEvent.click(exportButton);
      // handleExportの非同期処理が完了するまで待機
      await waitFor(() => {
        expect(mockCreateExportJob).toHaveBeenCalled();
      });
    });

    // ポーリング開始を確認（fake timersで5秒進める）
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(mockGetExportStatus).toHaveBeenCalledWith(mockExportId);
    });
  });

  it('エクスポート完了時にダウンロードリンクを表示する', async () => {
    const mockExportId = 'export-123';
    const mockDownloadUrl = 'https://s3.amazonaws.com/exports/file.csv';

    jest.spyOn(api, 'createExportJob').mockResolvedValue({
      success: true,
      data: { export_id: mockExportId, status: 'pending' },
    });

    jest.spyOn(api, 'getExportStatus').mockResolvedValue({
      success: true,
      data: {
        export_id: mockExportId,
        status: 'completed',
        download_url: mockDownloadUrl,
        created_at: '2024-01-15T10:00:00Z',
        completed_at: '2024-01-15T10:05:00Z',
      },
    });

    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    // フォーム入力とエクスポート実行
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/開始日/i), {
        target: { value: '2024-01-01' },
      });
      fireEvent.change(screen.getByLabelText(/終了日/i), {
        target: { value: '2024-01-31' },
      });
    });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /エクスポート$/i }));
      // handleExportの非同期処理が完了するまで待機
      await waitFor(() => {
        expect(api.createExportJob).toHaveBeenCalled();
      });
    });

    // ポーリング実行（fake timersで5秒進める）
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(screen.getByText(/エクスポートが完了しました/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ダウンロード/i })).toBeInTheDocument();
    });
  });

  it('エクスポート失敗時にエラーメッセージを表示する', async () => {
    const mockExportId = 'export-123';
    const errorMessage = 'エクスポート処理に失敗しました';

    jest.spyOn(api, 'createExportJob').mockResolvedValue({
      success: true,
      data: { export_id: mockExportId, status: 'pending' },
    });

    jest.spyOn(api, 'getExportStatus').mockResolvedValue({
      success: true,
      data: {
        export_id: mockExportId,
        status: 'failed',
        error_message: errorMessage,
        created_at: '2024-01-15T10:00:00Z',
      },
    });

    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    // フォーム入力とエクスポート実行
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/開始日/i), {
        target: { value: '2024-01-01' },
      });
      fireEvent.change(screen.getByLabelText(/終了日/i), {
        target: { value: '2024-01-31' },
      });
    });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /エクスポート$/i }));
      // handleExportの非同期処理が完了するまで待機
      await waitFor(() => {
        expect(api.createExportJob).toHaveBeenCalled();
      });
    });

    // ポーリング実行（fake timersで5秒進める）
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve(); // マイクロタスクキューをフラッシュ
    });

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('キャンセルボタンでダイアログを閉じる', () => {
    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    const cancelButton = screen.getByRole('button', { name: /キャンセル/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('オプションフィールドを含めてエクスポートできる', async () => {
    const mockCreateExportJob = jest.spyOn(api, 'createExportJob').mockResolvedValue({
      success: true,
      data: { export_id: 'export-123', status: 'pending' },
    });

    render(<ExportDialog open={true} onClose={mockOnClose} />);
    
    // すべてのフィールドを入力
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/開始日/i), {
        target: { value: '2024-01-01' },
      });
      fireEvent.change(screen.getByLabelText(/終了日/i), {
        target: { value: '2024-01-31' },
      });
      fireEvent.change(screen.getByLabelText(/企業コード/i), {
        target: { value: '7203' },
      });
      fireEvent.change(screen.getByLabelText(/開示種類/i), {
        target: { value: '決算短信' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /エクスポート$/i }));
    });

    await waitFor(() => {
      expect(mockCreateExportJob).toHaveBeenCalledWith({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        company_code: '7203',
        disclosure_type: '決算短信',
      });
    });
  });
});

// 検索・フィルタリングコンポーネントのテスト
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchFilter from '../SearchFilter';
import * as api from '../../services/api';

// APIモジュールをモック
jest.mock('../../services/api');

describe('SearchFilter', () => {
  const mockOnSearch = jest.fn();
  const mockDisclosureTypes = ['決算短信', '有価証券報告書', '適時開示'];

  beforeEach(() => {
    jest.clearAllMocks();
    // getDisclosureTypesのデフォルトモック
    (api.getDisclosureTypes as jest.Mock).mockResolvedValue(mockDisclosureTypes);
  });

  it('正常にレンダリングされる', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByText('開示情報検索')).toBeInTheDocument();
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
      expect(screen.getByLabelText('企業コード')).toBeInTheDocument();
      expect(screen.getByLabelText('開示種類')).toBeInTheDocument();
    });
  });

  it('開示種類の一覧を取得して表示する', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(api.getDisclosureTypes).toHaveBeenCalled();
    });

    // 開示種類のセレクトボックスをクリック
    const selectElement = screen.getByLabelText('開示種類');
    await act(async () => {
      fireEvent.mouseDown(selectElement);
    });

    await waitFor(() => {
      expect(screen.getByText('決算短信')).toBeInTheDocument();
      expect(screen.getByText('有価証券報告書')).toBeInTheDocument();
      expect(screen.getByText('適時開示')).toBeInTheDocument();
    });
  });

  it('フォーム入力が正しく動作する', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // 企業名を入力
    const companyNameInput = screen.getByLabelText('企業名');
    await act(async () => {
      fireEvent.change(companyNameInput, { target: { value: 'トヨタ自動車' } });
    });

    expect(companyNameInput).toHaveValue('トヨタ自動車');

    // 企業コードを入力
    const companyCodeInput = screen.getByLabelText('企業コード');
    await act(async () => {
      fireEvent.change(companyCodeInput, { target: { value: '7203' } });
    });

    expect(companyCodeInput).toHaveValue('7203');
  });

  it('検索ボタンクリックで検索パラメータを送信する', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // フォーム入力
    await act(async () => {
      fireEvent.change(screen.getByLabelText('企業名'), {
        target: { value: 'トヨタ自動車' },
      });
      fireEvent.change(screen.getByLabelText('企業コード'), {
        target: { value: '7203' },
      });
    });

    // 検索ボタンをクリック
    const searchButton = screen.getByRole('button', { name: /検索/i });
    await act(async () => {
      fireEvent.click(searchButton);
    });

    expect(mockOnSearch).toHaveBeenCalledWith({
      company_name: 'トヨタ自動車',
      company_code: '7203',
    });
  });

  it('リセットボタンでフォームをクリアする', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // フォーム入力
    const companyNameInput = screen.getByLabelText('企業名');
    await act(async () => {
      fireEvent.change(companyNameInput, { target: { value: 'トヨタ自動車' } });
    });

    expect(companyNameInput).toHaveValue('トヨタ自動車');

    // リセットボタンをクリック
    const resetButton = screen.getByRole('button', { name: /リセット/i });
    await act(async () => {
      fireEvent.click(resetButton);
    });

    expect(companyNameInput).toHaveValue('');
    expect(mockOnSearch).toHaveBeenCalledWith({});
  });

  it('詳細フィルターを展開・折りたたみできる', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // 初期状態では日付フィールドは非表示
    expect(screen.queryByLabelText('開示日（開始）')).not.toBeVisible();

    // フィルターアイコンをクリックして展開
    const filterButton = screen.getByLabelText('フィルター表示切替');
    await act(async () => {
      fireEvent.click(filterButton);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('開示日（開始）')).toBeVisible();
      expect(screen.getByLabelText('開示日（終了）')).toBeVisible();
    });
  });

  it('日付範囲を含めて検索できる', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // 詳細フィルターを展開
    const filterButton = screen.getByLabelText('フィルター表示切替');
    await act(async () => {
      fireEvent.click(filterButton);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('開示日（開始）')).toBeVisible();
    });

    // 日付を入力
    await act(async () => {
      fireEvent.change(screen.getByLabelText('開示日（開始）'), {
        target: { value: '2024-01-01' },
      });
      fireEvent.change(screen.getByLabelText('開示日（終了）'), {
        target: { value: '2024-01-31' },
      });
    });

    // 検索ボタンをクリック
    const searchButton = screen.getByRole('button', { name: /検索/i });
    await act(async () => {
      fireEvent.click(searchButton);
    });

    expect(mockOnSearch).toHaveBeenCalledWith({
      start_date: '2024-01-01',
      end_date: '2024-01-31',
    });
  });

  it('空の値は検索パラメータに含めない', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeInTheDocument();
    });

    // 企業コードのみ入力
    await act(async () => {
      fireEvent.change(screen.getByLabelText('企業コード'), {
        target: { value: '7203' },
      });
    });

    // 検索ボタンをクリック
    const searchButton = screen.getByRole('button', { name: /検索/i });
    await act(async () => {
      fireEvent.click(searchButton);
    });

    // 企業コードのみが含まれる
    expect(mockOnSearch).toHaveBeenCalledWith({
      company_code: '7203',
    });
  });

  it('ローディング中はフォームが無効化される', async () => {
    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} loading={true} />);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('企業名')).toBeDisabled();
      expect(screen.getByLabelText('企業コード')).toBeDisabled();
      // MUI Selectはaria-disabledを使用するため、親要素で確認
      const selectElement = screen.getByLabelText('開示種類');
      expect(selectElement).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /検索/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /リセット/i })).toBeDisabled();
    });
  });

  it('開示種類の取得に失敗してもエラーを表示しない', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    (api.getDisclosureTypes as jest.Mock).mockRejectedValue(
      new Error('API呼び出しに失敗しました')
    );

    await act(async () => {
      render(<SearchFilter onSearch={mockOnSearch} />);
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '開示種類の取得に失敗しました:',
        expect.any(Error)
      );
    });

    // コンポーネントは正常にレンダリングされる
    expect(screen.getByText('開示情報検索')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});

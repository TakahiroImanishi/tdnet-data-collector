// PDFダウンロードコンポーネントのテスト
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PdfDownload from '../PdfDownload';
import * as api from '../../services/api';

// APIモジュールをモック
jest.mock('../../services/api');

describe('PdfDownload', () => {
  const mockDisclosureId = 'TD20240115001';
  const mockFileName = 'test-disclosure.pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('正常にレンダリングされる', () => {
    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('ダウンロードボタンクリック時に署名付きURLを取得する', async () => {
    const mockUrl = 'https://s3.amazonaws.com/bucket/file.pdf?signature=xxx';
    const mockGetPdfDownloadUrl = jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
      success: true,
      data: { url: mockUrl, expires_in: 3600 },
    });

    // リンククリックをモック
    const mockClick = jest.fn();
    const mockCreateElement = jest.spyOn(document, 'createElement');
    mockCreateElement.mockReturnValue({
      click: mockClick,
      href: '',
      download: '',
      target: '',
    } as any);

    render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGetPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
      expect(mockClick).toHaveBeenCalled();
    });
  });

  it('ダウンロード中はボタンが無効化される', async () => {
    jest.spyOn(api, 'getPdfDownloadUrl').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // ダウンロード中
    expect(button).toBeDisabled();
    expect(screen.getByText(/ダウンロード中/i)).toBeInTheDocument();
  });

  it('エラー時にエラーメッセージを表示する', async () => {
    const errorMessage = 'PDFの取得に失敗しました';
    jest.spyOn(api, 'getPdfDownloadUrl').mockRejectedValue(new Error(errorMessage));

    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('APIレスポンスが不正な場合にエラーを表示する', async () => {
    jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
      success: false,
      data: { url: '', expires_in: 0 },
    });

    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/PDFのURLを取得できませんでした/i)).toBeInTheDocument();
    });
  });
});

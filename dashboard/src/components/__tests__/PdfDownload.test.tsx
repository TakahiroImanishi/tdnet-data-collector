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
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    const mockLink = {
      click: mockClick,
      href: '',
      download: '',
      target: '',
      style: {},
    };
    
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    jest.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);

    render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGetPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
    });
  });

  it('ダウンロード中はボタンが無効化される', async () => {
    let resolvePromise: any;
    const mockPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    jest.spyOn(api, 'getPdfDownloadUrl').mockReturnValue(mockPromise as any);
    
    // DOM操作をモック
    const mockLink = { click: jest.fn(), href: '', download: '', target: '', style: {} };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
    jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());

    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // ダウンロード中
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByText(/ダウンロード中/i)).toBeInTheDocument();
    });
    
    // プロミスを解決
    resolvePromise({ success: true, data: { url: 'http://test.com/file.pdf', expires_in: 3600 } });
  });

  it('エラー時にエラーメッセージを表示する', async () => {
    const errorMessage = 'PDFの取得に失敗しました';
    jest.spyOn(api, 'getPdfDownloadUrl').mockRejectedValue(new Error(errorMessage));
    
    // DOM操作をモック
    const mockLink = { click: jest.fn(), href: '', download: '', target: '', style: {} };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
    jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());

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
    
    // DOM操作をモック
    const mockLink = { click: jest.fn(), href: '', download: '', target: '', style: {} };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    jest.spyOn(document.body, 'appendChild').mockImplementation(jest.fn());
    jest.spyOn(document.body, 'removeChild').mockImplementation(jest.fn());

    render(<PdfDownload disclosureId={mockDisclosureId} />);
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/PDFのURLを取得できませんでした/i)).toBeInTheDocument();
    });
  });
});

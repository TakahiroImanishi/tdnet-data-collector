// PDFダウンロードコンポーネントのテスト
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    // DOM操作のモックをリセット
    jest.restoreAllMocks();
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

    // 実際のHTMLAnchorElementを使用
    const mockLink = document.createElement('a');
    const clickSpy = jest.spyOn(mockLink, 'click').mockImplementation(() => {});
    
    // 無限再帰を防ぐため、元のcreateElementを保存
    const originalCreateElement = document.createElement.bind(document);
    
    const createElementSpy = jest.spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        // 他の要素は通常通り生成（無限再帰防止）
        return originalCreateElement(tagName);
      });
    
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    // act()でラップしてDOM更新を適切に処理
    await act(async () => {
      render(<PdfDownload disclosureId={mockDisclosureId} fileName={mockFileName} />);
    });
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockGetPdfDownloadUrl).toHaveBeenCalledWith(mockDisclosureId);
      expect(clickSpy).toHaveBeenCalled();
      expect(mockLink.href).toBe(mockUrl);
      expect(mockLink.download).toBe(mockFileName);
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
    });
    
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('ダウンロード中はボタンが無効化される', async () => {
    let resolvePromise: any;
    const mockPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    
    jest.spyOn(api, 'getPdfDownloadUrl').mockReturnValue(mockPromise as any);

    // 実際のHTMLAnchorElementを使用
    const mockLink = document.createElement('a');
    jest.spyOn(mockLink, 'click').mockImplementation(() => {});
    
    // 無限再帰を防ぐため、元のcreateElementを保存
    const originalCreateElement = document.createElement.bind(document);
    
    const createElementSpy = jest.spyOn(document, 'createElement')
      .mockImplementation((tagName) => {
        if (tagName === 'a') {
          return mockLink;
        }
        // 他の要素は通常通り生成（無限再帰防止）
        return originalCreateElement(tagName);
      });
    
    const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);

    await act(async () => {
      render(<PdfDownload disclosureId={mockDisclosureId} />);
    });
    
    const button = screen.getByRole('button');
    
    await act(async () => {
      fireEvent.click(button);
    });

    // ダウンロード中
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(screen.getByText(/ダウンロード中/i)).toBeInTheDocument();
    });
    
    // プロミスを解決
    await act(async () => {
      resolvePromise({ success: true, data: { url: 'http://test.com/file.pdf', expires_in: 3600 } });
    });
    
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('エラー時にエラーメッセージを表示する', async () => {
    const errorMessage = 'PDFの取得に失敗しました';
    jest.spyOn(api, 'getPdfDownloadUrl').mockRejectedValue(new Error(errorMessage));

    await act(async () => {
      render(<PdfDownload disclosureId={mockDisclosureId} />);
    });
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      // Snackbar内のエラーメッセージを確認
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(errorMessage);
    });
  });

  it('APIレスポンスが不正な場合にエラーを表示する', async () => {
    jest.spyOn(api, 'getPdfDownloadUrl').mockResolvedValue({
      success: false,
      data: { url: '', expires_in: 0 },
    });

    await act(async () => {
      render(<PdfDownload disclosureId={mockDisclosureId} />);
    });
    
    const button = screen.getByRole('button', { name: /PDFダウンロード/i });
    
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      // Snackbar内のエラーメッセージを確認
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/PDFのURLを取得できませんでした/i);
    });
  });
});

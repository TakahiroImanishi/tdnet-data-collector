import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// APIモックの設定
jest.mock('./services/api', () => ({
  searchDisclosures: jest.fn().mockResolvedValue({
    success: true,
    data: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_items: 0,
      items_per_page: 20,
    },
  }),
  getDisclosureTypes: jest.fn().mockResolvedValue([]),
}));

describe('App', () => {
  it('TDnetダッシュボードのタイトルが表示される', async () => {
    await act(async () => {
      render(<App />);
    });
    
    // タイトルが表示されるまで待機
    await waitFor(() => {
      const titleElement = screen.getByText(/TDnet 開示情報ダッシュボード/i);
      expect(titleElement).toBeInTheDocument();
    });
  });

  it('検索フィルターが表示される', async () => {
    await act(async () => {
      render(<App />);
    });
    
    // 検索ボタンが表示されるまで待機
    await waitFor(() => {
      const searchButton = screen.getByRole('button', { name: /検索/i });
      expect(searchButton).toBeInTheDocument();
    });
  });
});

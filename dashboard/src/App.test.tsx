import React from 'react';
import { render, screen } from '@testing-library/react';
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
  getDisclosureTypes: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
}));

test('renders TDnet dashboard title', () => {
  render(<App />);
  const titleElement = screen.getByText(/TDnet 開示情報ダッシュボード/i);
  expect(titleElement).toBeInTheDocument();
});

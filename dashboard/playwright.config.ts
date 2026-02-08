import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2Eテスト設定
 * 
 * ダッシュボードのE2Eテストを実行するための設定
 */
export default defineConfig({
  testDir: './src/__tests__/e2e',
  
  // テストタイムアウト
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  // 並列実行設定
  fullyParallel: true,
  
  // 失敗時のリトライ
  retries: process.env.CI ? 2 : 0,
  
  // ワーカー数
  workers: process.env.CI ? 1 : undefined,

  // レポーター
  reporter: 'html',

  // 共通設定
  use: {
    // ベースURL（開発サーバー）
    baseURL: 'http://localhost:3000',
    
    // トレース設定
    trace: 'on-first-retry',
    
    // スクリーンショット
    screenshot: 'only-on-failure',
    
    // ビデオ
    video: 'retain-on-failure',
  },

  // プロジェクト設定（ブラウザ）
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 必要に応じて他のブラウザを追加
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // 開発サーバー設定
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});

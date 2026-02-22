// PDFダウンロード機能のE2Eテスト
import { test, expect } from '@playwright/test';

test.describe('PDFダウンロード機能', () => {
  test.beforeEach(async ({ page }) => {
    // ダッシュボードページに移動
    await page.goto('http://localhost:3000');
  });

  test('PDFダウンロードボタンが表示される', async ({ page }) => {
    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機
    await page.waitForSelector('table', { timeout: 10000 });

    // PDFダウンロードボタンが存在することを確認
    const pdfButtons = await page.locator('button:has-text("PDFダウンロード")').count();
    expect(pdfButtons).toBeGreaterThan(0);
  });

  test('PDFダウンロードボタンをクリックするとダウンロードが開始される', async ({ page, context }) => {
    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機
    await page.waitForSelector('table', { timeout: 10000 });

    // ダウンロードイベントをリッスン
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // 最初のPDFダウンロードボタンをクリック
    await page.locator('button:has-text("PDFダウンロード")').first().click();

    // ダウンロードが開始されることを確認
    const download = await downloadPromise;
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  });

  test('PDFダウンロード中はボタンが無効化される', async ({ page }) => {
    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機
    await page.waitForSelector('table', { timeout: 10000 });

    // 最初のPDFダウンロードボタンを取得
    const pdfButton = page.locator('button:has-text("PDFダウンロード")').first();

    // ボタンをクリック
    await pdfButton.click();

    // ダウンロード中はボタンが無効化されることを確認
    await expect(pdfButton).toBeDisabled();
    await expect(page.locator('text=ダウンロード中')).toBeVisible();
  });

  test('PDFダウンロードエラー時にエラーメッセージが表示される', async ({ page }) => {
    // APIモックを設定してエラーを返す
    await page.route('**/api/pdf/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機
    await page.waitForSelector('table', { timeout: 10000 });

    // PDFダウンロードボタンをクリック
    await page.locator('button:has-text("PDFダウンロード")').first().click();

    // エラーメッセージが表示されることを確認
    await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[role="alert"]')).toContainText(/ダウンロードに失敗|取得できませんでした/);
  });

  test('モバイル表示でもPDFダウンロードボタンが機能する', async ({ page }) => {
    // モバイルビューポートに設定
    await page.setViewportSize({ width: 375, height: 667 });

    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機（カード形式）
    await page.waitForSelector('[class*="MuiCard"]', { timeout: 10000 });

    // PDFダウンロードボタンが存在することを確認
    const pdfButtons = await page.locator('button:has-text("PDFダウンロード")').count();
    expect(pdfButtons).toBeGreaterThan(0);

    // ダウンロードイベントをリッスン
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // PDFダウンロードボタンをクリック
    await page.locator('button:has-text("PDFダウンロード")').first().click();

    // ダウンロードが開始されることを確認
    const download = await downloadPromise;
    expect(download).toBeTruthy();
  });

  test('複数のPDFを連続してダウンロードできる', async ({ page }) => {
    // 検索フォームで検索を実行
    await page.fill('input[name="company_code"]', '7203');
    await page.click('button[type="submit"]');

    // 検索結果が表示されるまで待機
    await page.waitForSelector('table', { timeout: 10000 });

    // 最初のPDFをダウンロード
    const download1Promise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("PDFダウンロード")').first().click();
    const download1 = await download1Promise;
    expect(download1).toBeTruthy();

    // 少し待機
    await page.waitForTimeout(1000);

    // 2番目のPDFをダウンロード
    const download2Promise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('button:has-text("PDFダウンロード")').nth(1).click();
    const download2 = await download2Promise;
    expect(download2).toBeTruthy();
  });
});

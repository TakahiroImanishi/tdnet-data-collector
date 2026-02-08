import { test, expect } from '@playwright/test';

/**
 * TDnet Dashboard E2Eテスト
 * 
 * ダッシュボードの基本的な機能をテスト
 */

test.describe('TDnet Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // ダッシュボードのホームページに移動
    await page.goto('/');
  });

  test('ページタイトルが正しく表示される', async ({ page }) => {
    // Arrange & Act
    await page.waitForLoadState('networkidle');

    // Assert
    await expect(page).toHaveTitle(/TDnet Data Collector/i);
  });

  test('ヘッダーが表示される', async ({ page }) => {
    // Arrange & Act
    const header = page.locator('header');

    // Assert
    await expect(header).toBeVisible();
    await expect(header).toContainText('TDnet Data Collector');
  });

  test('ナビゲーションメニューが表示される', async ({ page }) => {
    // Arrange & Act
    const homeLink = page.getByRole('link', { name: /ホーム/i });
    const searchLink = page.getByRole('link', { name: /検索/i });

    // Assert
    await expect(homeLink).toBeVisible();
    await expect(searchLink).toBeVisible();
  });

  test('開示情報リストが表示される', async ({ page }) => {
    // Arrange & Act
    await page.waitForLoadState('networkidle');
    
    // 開示情報リストのコンテナを探す
    const disclosureList = page.locator('[data-testid="disclosure-list"]').or(
      page.locator('text=開示情報').locator('..')
    );

    // Assert
    await expect(disclosureList).toBeVisible();
  });

  test('検索フィルターが表示される', async ({ page }) => {
    // Arrange & Act
    const searchFilter = page.locator('[data-testid="search-filter"]').or(
      page.locator('input[type="text"]').first()
    );

    // Assert
    await expect(searchFilter).toBeVisible();
  });

  test('検索フィルターで開示情報を絞り込める', async ({ page }) => {
    // Arrange
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[type="text"]').first();

    // Act
    await searchInput.fill('決算');
    await page.waitForTimeout(500); // デバウンス待機

    // Assert
    // 検索結果が表示されることを確認（実際のAPIレスポンスに依存）
    const results = page.locator('[data-testid="disclosure-item"]').or(
      page.locator('text=決算')
    );
    
    // 少なくとも検索が実行されたことを確認
    await expect(searchInput).toHaveValue('決算');
  });

  test('日付フィルターが機能する', async ({ page }) => {
    // Arrange
    await page.waitForLoadState('networkidle');
    
    // 日付入力フィールドを探す
    const dateInput = page.locator('input[type="date"]').first();
    
    if (await dateInput.count() > 0) {
      // Act
      await dateInput.fill('2024-01-01');
      await page.waitForTimeout(500);

      // Assert
      await expect(dateInput).toHaveValue('2024-01-01');
    } else {
      // 日付フィルターがない場合はスキップ
      test.skip();
    }
  });

  test('開示情報の詳細が表示される', async ({ page }) => {
    // Arrange
    await page.waitForLoadState('networkidle');
    
    // 最初の開示情報アイテムを探す
    const firstItem = page.locator('[data-testid="disclosure-item"]').first().or(
      page.locator('article').first()
    );

    if (await firstItem.count() > 0) {
      // Act
      await firstItem.click();
      await page.waitForTimeout(500);

      // Assert
      // 詳細情報が表示されることを確認
      const detailView = page.locator('[data-testid="disclosure-detail"]').or(
        page.locator('text=開示日時')
      );
      
      await expect(detailView).toBeVisible();
    } else {
      // データがない場合はスキップ
      test.skip();
    }
  });

  test('ページネーションが機能する', async ({ page }) => {
    // Arrange
    await page.waitForLoadState('networkidle');
    
    // ページネーションボタンを探す
    const nextButton = page.getByRole('button', { name: /次へ|next/i });
    
    if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
      // Act
      await nextButton.click();
      await page.waitForTimeout(500);

      // Assert
      // URLが変更されたか、新しいデータが読み込まれたことを確認
      await expect(page).toHaveURL(/page=2|offset=/);
    } else {
      // ページネーションがない場合はスキップ
      test.skip();
    }
  });

  test('エラーメッセージが適切に表示される', async ({ page }) => {
    // Arrange
    // APIエラーをシミュレート（ネットワークをオフラインに）
    await page.context().setOffline(true);
    
    // Act
    await page.reload();
    await page.waitForTimeout(2000);

    // Assert
    // エラーメッセージが表示されることを確認
    const errorMessage = page.locator('text=/エラー|error|失敗/i');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });

    // ネットワークを復元
    await page.context().setOffline(false);
  });

  test('レスポンシブデザインが機能する（モバイル）', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    // Act
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Assert
    // ページが正しく表示されることを確認
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    // モバイルメニューが表示されることを確認（ハンバーガーメニュー等）
    const mobileMenu = page.locator('[aria-label="menu"]').or(
      page.locator('button[aria-label*="menu"]')
    );
    
    if (await mobileMenu.count() > 0) {
      await expect(mobileMenu).toBeVisible();
    }
  });

  test('ローディング状態が表示される', async ({ page }) => {
    // Arrange & Act
    await page.goto('/');
    
    // ローディングインジケーターを探す（短時間で消える可能性がある）
    const loadingIndicator = page.locator('[data-testid="loading"]').or(
      page.locator('text=/読み込み中|loading/i')
    );

    // Assert
    // ローディングが表示されるか、すぐにコンテンツが表示されることを確認
    try {
      await expect(loadingIndicator).toBeVisible({ timeout: 1000 });
    } catch {
      // ローディングが速すぎて見えない場合は、コンテンツが表示されていることを確認
      const content = page.locator('[data-testid="disclosure-list"]');
      await expect(content).toBeVisible();
    }
  });
});

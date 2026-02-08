import { test, expect } from '@playwright/test';

/**
 * API統合E2Eテスト
 * 
 * ダッシュボードとAPIの統合をテスト
 */

test.describe('API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('開示情報一覧APIが正しく呼び出される', async ({ page }) => {
    // Arrange
    let apiCalled = false;
    let apiResponse: any = null;

    // APIリクエストを監視
    page.on('response', async (response) => {
      if (response.url().includes('/api/disclosures') || response.url().includes('/disclosures')) {
        apiCalled = true;
        try {
          apiResponse = await response.json();
        } catch (e) {
          // JSONパースエラーは無視
        }
      }
    });

    // Act
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert
    expect(apiCalled).toBeTruthy();
    
    if (apiResponse) {
      // レスポンスの構造を確認
      expect(apiResponse).toHaveProperty('items');
      expect(Array.isArray(apiResponse.items)).toBeTruthy();
    }
  });

  test('検索クエリがAPIに正しく送信される', async ({ page }) => {
    // Arrange
    let searchQuery = '';
    
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/api/disclosures') || url.pathname.includes('/disclosures')) {
        searchQuery = url.searchParams.get('query') || url.searchParams.get('search') || '';
      }
    });

    // Act
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('決算短信');
    await page.waitForTimeout(1000); // デバウンス待機

    // Assert
    expect(searchQuery).toContain('決算');
  });

  test('日付範囲フィルターがAPIに正しく送信される', async ({ page }) => {
    // Arrange
    let startDate = '';
    let endDate = '';
    
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/api/disclosures') || url.pathname.includes('/disclosures')) {
        startDate = url.searchParams.get('start_date') || url.searchParams.get('from') || '';
        endDate = url.searchParams.get('end_date') || url.searchParams.get('to') || '';
      }
    });

    // Act
    const startDateInput = page.locator('input[type="date"]').first();
    if (await startDateInput.count() > 0) {
      await startDateInput.fill('2024-01-01');
      await page.waitForTimeout(1000);

      // Assert
      expect(startDate).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('APIエラー時に適切なエラーメッセージが表示される', async ({ page }) => {
    // Arrange
    // APIリクエストを失敗させる
    await page.route('**/api/disclosures*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // Act
    await page.reload();
    await page.waitForTimeout(2000);

    // Assert
    const errorMessage = page.locator('text=/エラー|error|失敗/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('API認証エラー時に適切なメッセージが表示される', async ({ page }) => {
    // Arrange
    await page.route('**/api/disclosures*', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    // Act
    await page.reload();
    await page.waitForTimeout(2000);

    // Assert
    const errorMessage = page.locator('text=/認証|unauthorized|権限/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('ページネーションパラメータがAPIに正しく送信される', async ({ page }) => {
    // Arrange
    let pageParam = '';
    let limitParam = '';
    
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/api/disclosures') || url.pathname.includes('/disclosures')) {
        pageParam = url.searchParams.get('page') || url.searchParams.get('offset') || '';
        limitParam = url.searchParams.get('limit') || url.searchParams.get('size') || '';
      }
    });

    // Act
    await page.waitForLoadState('networkidle');
    const nextButton = page.getByRole('button', { name: /次へ|next/i });
    
    if (await nextButton.count() > 0 && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Assert
      expect(pageParam || limitParam).toBeTruthy();
    } else {
      test.skip();
    }
  });

  test('APIレスポンスが正しくレンダリングされる', async ({ page }) => {
    // Arrange
    const mockData = {
      items: [
        {
          disclosure_id: 'TD20240115001',
          company_name: 'テスト株式会社',
          title: 'テスト開示情報',
          disclosed_at: '2024-01-15T10:00:00Z',
          document_type: '決算短信',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    await page.route('**/api/disclosures*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    });

    // Act
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert
    await expect(page.locator('text=テスト株式会社')).toBeVisible();
    await expect(page.locator('text=テスト開示情報')).toBeVisible();
    await expect(page.locator('text=決算短信')).toBeVisible();
  });

  test('空のAPIレスポンス時に適切なメッセージが表示される', async ({ page }) => {
    // Arrange
    await page.route('**/api/disclosures*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0 }),
      });
    });

    // Act
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert
    const emptyMessage = page.locator('text=/データがありません|no data|empty/i');
    await expect(emptyMessage).toBeVisible({ timeout: 5000 });
  });

  test('APIリクエストにタイムアウトが設定されている', async ({ page }) => {
    // Arrange
    let requestStartTime = 0;
    let requestEndTime = 0;

    page.on('request', (request) => {
      if (request.url().includes('/api/disclosures') || request.url().includes('/disclosures')) {
        requestStartTime = Date.now();
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('/api/disclosures') || response.url().includes('/disclosures')) {
        requestEndTime = Date.now();
      }
    });

    // 遅延レスポンスをシミュレート
    await page.route('**/api/disclosures*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // 15秒遅延
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    // Act
    await page.reload();
    await page.waitForTimeout(12000); // 12秒待機

    // Assert
    // タイムアウトエラーまたはローディング状態が表示されることを確認
    const errorOrLoading = page.locator('text=/タイムアウト|timeout|読み込み中/i');
    await expect(errorOrLoading).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from '@playwright/test';

test.describe('OmniDash UI Screenshots', () => {
  test('capture desktop screenshots', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const newPage = await context.newPage();

    // Set OMNIDASH_ENABLED=1
    await newPage.addInitScript(() => {
      window.localStorage.setItem('OMNIDASH_ENABLED', '1');
      // Mock admin access
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: () => JSON.stringify({ user: { email: 'admin@example.com' } }),
          setItem: () => {},
        },
        writable: true,
      });
    });

    await newPage.goto('/omnidash');
    await newPage.waitForLoadState('networkidle');

    // Take screenshot
    await newPage.screenshot({
      path: 'artifacts/omnidash-ui/desktop-home.png',
      fullPage: true,
    });

    // Navigate to pipeline
    await newPage.goto('/omnidash/pipeline');
    await newPage.waitForLoadState('networkidle');

    await newPage.screenshot({
      path: 'artifacts/omnidash-ui/desktop-pipeline.png',
      fullPage: true,
    });

    await context.close();
  });

  test('capture mobile screenshots', async ({ page, browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    });
    const newPage = await context.newPage();

    // Set OMNIDASH_ENABLED=1
    await newPage.addInitScript(() => {
      window.localStorage.setItem('OMNIDASH_ENABLED', '1');
      // Mock admin access
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: () => JSON.stringify({ user: { email: 'admin@example.com' } }),
          setItem: () => {},
        },
        writable: true,
      });
    });

    await newPage.goto('/omnidash');
    await newPage.waitForLoadState('networkidle');

    // Take screenshot
    await newPage.screenshot({
      path: 'artifacts/omnidash-ui/mobile-home.png',
      fullPage: true,
    });

    // Navigate to pipeline
    await newPage.goto('/omnidash/pipeline');
    await newPage.waitForLoadState('networkidle');

    await newPage.screenshot({
      path: 'artifacts/omnidash-ui/mobile-pipeline.png',
      fullPage: true,
    });

    await context.close();
  });
});
import { test, expect } from '@playwright/test';

/**
 * Runtime Render Smoke Tests
 *
 * These tests catch deployment issues that pass build but fail at runtime:
 * - React context duplication (createContext TypeError)
 * - Blank page due to chunk loading failures
 * - Fatal console errors preventing render
 *
 * @see docs/CI_RUNTIME_GATES.md
 */

test.describe('Runtime Render Smoke Tests', () => {
  // Collect console errors during test
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      consoleErrors.push(`PAGE ERROR: ${error.message}`);
    });
  });

  test('app shell renders without fatal errors', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app shell to be visible
    // This catches React hydration failures and chunk loading issues
    const appShell = page.locator('[data-testid="app-shell"]');
    await expect(appShell).toBeVisible({ timeout: 15_000 });

    // Ensure no fatal React errors occurred
    const fatalErrors = consoleErrors.filter((err) =>
      err.includes('createContext') ||
      err.includes('Cannot read properties of undefined') ||
      err.includes('ChunkLoadError') ||
      err.includes('Loading chunk') ||
      err.includes('Failed to fetch dynamically imported module')
    );

    expect(fatalErrors, `Fatal console errors detected:\n${fatalErrors.join('\n')}`).toHaveLength(0);
  });

  test('app renders interactive content', async ({ page }) => {
    await page.goto('/');

    // Wait for app shell
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();

    // The page should have meaningful content (not blank)
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    // Should not show a blank/error state
    const pageContent = await page.content();
    expect(pageContent).not.toContain('chunk failed');
    expect(pageContent).not.toContain('Loading chunk');
  });

  test('no React context duplication errors', async ({ page }) => {
    await page.goto('/');

    // Wait for initial render
    await page.waitForTimeout(2000);

    // Check for the specific createContext error that indicates React duplication
    const contextErrors = consoleErrors.filter(
      (err) =>
        err.includes('createContext') ||
        err.includes('Invalid hook call') ||
        err.includes('multiple copies of React')
    );

    expect(
      contextErrors,
      `React context/hook errors detected (possible React duplication):\n${contextErrors.join('\n')}`
    ).toHaveLength(0);
  });

  test('health page loads successfully', async ({ page }) => {
    // Health page is a good canary - simpler than dashboard
    await page.goto('/health');

    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();

    // Should render health content
    const content = await page.content();
    expect(content.toLowerCase()).toContain('health');
  });

  test('auth page loads without errors', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();

    // Auth page should have form elements
    await page.waitForTimeout(1000);

    // No fatal errors during auth page load
    const fatalErrors = consoleErrors.filter(
      (err) =>
        err.includes('createContext') ||
        err.includes('Cannot read properties')
    );
    expect(fatalErrors).toHaveLength(0);
  });
});

test.describe('Critical Asset Access', () => {
  test('manifest.webmanifest returns 200', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');

    // This catches 401/403 errors that break PWA functionality
    expect(response.status(), 'manifest.webmanifest should return 200, not 401/403').toBe(200);

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/manifest+json');
  });

  test('favicon.ico is accessible', async ({ request }) => {
    const response = await request.get('/favicon.ico');
    expect(response.status()).toBe(200);
  });

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    // robots.txt might not exist, but if it does it should be 200
    expect([200, 404]).toContain(response.status());
  });
});

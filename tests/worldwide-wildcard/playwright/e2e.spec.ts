import { test, expect } from '@playwright/test';

test('omnilink UI is reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
});

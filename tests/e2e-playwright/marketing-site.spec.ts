import { test, expect } from '@playwright/test';

test.describe('Marketing Site Polish', () => {
  test('home page matches visual requirements and hierarchy', async ({ page }) => {
    // Debug: Listen for console logs and errors
    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER ERROR]: ${err.message}`));

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Debug: Log content to see if we satisfy hydration
    // console.log(await page.content());

    // 1. Verify Header
    const logo = page.getByTestId('header-logo');
    await expect(logo).toBeVisible();
    
    // Explicit debug screenshot
    await page.screenshot({ path: 'debug-evidence.png', fullPage: true });

    // Verify Theme Toggle exists and has two options
    const themeToggle = page.getByTestId('theme-toggle');
    await expect(themeToggle).toBeVisible();
    await expect(page.getByTestId('theme-toggle-white-fortress')).toBeVisible();
    await expect(page.getByTestId('theme-toggle-night-watch')).toBeVisible();

    // 2. Verify Hero
    const hero = page.getByTestId('hero');
    await expect(hero).toBeVisible();

    // Verify Hierarchy
    const h1 = page.getByTestId('hero-headline');
    await expect(h1).toHaveClass(/text-5xl/); 
    await expect(h1).toHaveText('APEX OmniHub');

    const subhead = page.getByTestId('hero-subhead');
    await expect(subhead).toBeVisible();

    const cta = page.getByTestId('hero-cta-primary');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText('Explore Apps');
  });
});

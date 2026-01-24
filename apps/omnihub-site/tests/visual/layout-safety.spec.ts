import { test, expect } from '@playwright/test';

test.describe('Layout safety', () => {
  test('desktop navbar and MAN Mode stay constrained', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const noHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1
    );
    expect(noHorizontalOverflow).toBeTruthy();

    const wordmarkHeight = await page.$eval('.nav__logo-wordmark', (el) =>
      (el as HTMLElement).getBoundingClientRect().height
    );
    expect(wordmarkHeight).toBeLessThanOrEqual(28);

    const navHeight = await page.$eval('.nav__inner', (el) =>
      (el as HTMLElement).getBoundingClientRect().height
    );
    expect(navHeight).toBeLessThanOrEqual(110);

    await page.locator('#man-mode').scrollIntoViewIfNeeded();

    const manIconHeight = await page.$eval('.manmode__icon-img', (el) =>
      (el as HTMLElement).getBoundingClientRect().height
    );
    const viewportHeight = page.viewportSize()?.height ?? 800;
    const maxManHeight = Math.min(viewportHeight * 0.6, 520) + 2;
    expect(manIconHeight).toBeLessThanOrEqual(maxManHeight);
  });

  test('mobile menu works without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const burger = page.locator('.nav__burger-btn');
    await expect(burger).toBeVisible();

    await burger.click();
    const mobileMenu = page.locator('.nav__mobile-menu');
    await expect(mobileMenu).toBeVisible();

    const firstMobileLink = page.locator('.nav__mobile-link').first();
    await firstMobileLink.click();
    await expect(mobileMenu).toBeHidden();

    const noHorizontalOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1
    );
    expect(noHorizontalOverflow).toBeTruthy();
  });
});

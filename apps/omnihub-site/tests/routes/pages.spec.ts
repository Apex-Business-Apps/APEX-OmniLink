import { test, expect } from '@playwright/test';

/**
 * Marketing Site Routing Tests
 *
 * Ensures all marketing pages are reachable via both:
 * 1. Clean URLs (e.g., /demo)
 * 2. Portable .html URLs (e.g., /demo.html)
 *
 * This prevents 404s and validates the Vercel rewrite configuration.
 */

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

// Page test matrix: [route, expectedContent]
const PAGE_TESTS = [
  { route: '/', htmlRoute: '/index.html', content: 'Intelligence Designed', description: 'Homepage hero title' },
  { route: '/demo', htmlRoute: '/demo.html', content: 'See It In Action', description: 'Demo page title' },
  { route: '/tech-specs', htmlRoute: '/tech-specs.html', content: 'Technical Specifications', description: 'Tech specs page title' },
  { route: '/request-access', htmlRoute: '/request-access.html', content: 'Request Access', description: 'Request access page title' },
  { route: '/login', htmlRoute: '/login.html', content: 'Welcome Back', description: 'Login page title' },
  { route: '/privacy', htmlRoute: '/privacy.html', content: 'Privacy', description: 'Privacy page heading' },
  { route: '/terms', htmlRoute: '/terms.html', content: 'Terms', description: 'Terms page heading' },
];

test.describe('Marketing Site Routing', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const pageTest of PAGE_TESTS) {
    test(`${pageTest.route} → displays ${pageTest.description}`, async ({ page }) => {
      await page.goto(pageTest.route);

      // Wait for content to be visible
      await page.waitForSelector('body', { state: 'visible' });

      // Check for expected content
      const content = await page.textContent('body');
      expect(content).toContain(pageTest.content);

      // Verify no error page
      expect(content).not.toContain('404');
      expect(content).not.toContain('Not Found');
    });

    test(`${pageTest.htmlRoute} → displays ${pageTest.description}`, async ({ page }) => {
      await page.goto(pageTest.htmlRoute);

      // Wait for content to be visible
      await page.waitForSelector('body', { state: 'visible' });

      // Check for expected content
      const content = await page.textContent('body');
      expect(content).toContain(pageTest.content);

      // Verify no error page
      expect(content).not.toContain('404');
      expect(content).not.toContain('Not Found');
    });

    // Test trailing slash for clean URLs
    if (pageTest.route !== '/') {
      test(`${pageTest.route}/ → displays ${pageTest.description}`, async ({ page }) => {
        await page.goto(`${pageTest.route}/`);

        // Wait for content to be visible
        await page.waitForSelector('body', { state: 'visible' });

        // Check for expected content
        const content = await page.textContent('body');
        expect(content).toContain(pageTest.content);

        // Verify no error page
        expect(content).not.toContain('404');
        expect(content).not.toContain('Not Found');
      });
    }
  }
});

test.describe('Routing Regression Guards', () => {
  test('restricted page should not exist', async ({ page }) => {
    const response = await page.goto('/restricted', { waitUntil: 'load' });

    // Should 404 or redirect, not return 200 OK
    expect(response?.status()).not.toBe(200);
  });

  test('restricted.html should not exist', async ({ page }) => {
    const response = await page.goto('/restricted.html', { waitUntil: 'load' });

    // Should 404 or redirect, not return 200 OK
    expect(response?.status()).not.toBe(200);
  });

  test('unknown route should 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist', { waitUntil: 'load' });

    // Should return 404
    expect(response?.status()).toBe(404);
  });
});

test.describe('Navigation Links', () => {
  test('all nav links are reachable', async ({ page }) => {
    await page.goto('/');

    // Wait for navigation to be visible
    await page.waitForSelector('nav', { state: 'visible' });

    // Get all navigation links
    const navLinks = await page.locator('nav a[href]').all();

    // Verify each link is reachable
    for (const link of navLinks) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        const response = await page.goto(href, { waitUntil: 'load' });
        expect(response?.status()).toBe(200);

        // Go back to home
        await page.goto('/');
        await page.waitForSelector('nav', { state: 'visible' });
      }
    }
  });

  test('all footer links are reachable', async ({ page }) => {
    await page.goto('/');

    // Wait for footer to be visible
    await page.waitForSelector('footer', { state: 'visible' });

    // Get all footer links
    const footerLinks = await page.locator('footer a[href]').all();

    // Verify each link is reachable
    for (const link of footerLinks) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#')) {
        const response = await page.goto(href, { waitUntil: 'load' });
        expect(response?.status()).toBe(200);

        // Go back to home
        await page.goto('/');
        await page.waitForSelector('footer', { state: 'visible' });
      }
    }
  });
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for OmniLink APEX runtime smoke tests.
 *
 * These tests validate that the deployed app actually renders
 * and critical assets are accessible - catching issues like:
 * - React context duplication (createContext errors)
 * - 401/403 on manifest.webmanifest
 * - Blank page deployments
 */
export default defineConfig({
  testDir: './tests/e2e-playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // Fast timeout for smoke tests
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Add Vercel deployment protection bypass for CI preview testing
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {},
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start a server - we expect it to be running already
  // (started by CI or manually)
});

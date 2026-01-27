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
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start preview server before running tests
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000, // 2 minutes for build + preview startup
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for visual regression testing
 * Tests homepage against reference mockups at specific viewports
 */
export default defineConfig({
    testDir: './tests/visual',
    snapshotDir: './tests/visual/snapshots',
    updateSnapshots: 'missing',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run dev -- --host --port 3000',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});

import { defineConfig } from '@playwright/test';
import { playwrightProjects } from './projects';

export default defineConfig({
  testDir: __dirname,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: playwrightProjects,
});

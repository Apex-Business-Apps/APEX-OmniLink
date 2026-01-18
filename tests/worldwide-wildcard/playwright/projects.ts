import { devices } from '@playwright/test';

export const deviceProfiles = {
  'desktop-chrome': {
    name: 'Desktop Chrome',
    use: { ...devices['Desktop Chrome'] },
  },
  'ios-safari': {
    name: 'iOS Safari',
    use: { ...devices['iPhone 13'] },
  },
  'android-chrome': {
    name: 'Android Chrome',
    use: { ...devices['Pixel 7'] },
  },
};

export const playwrightProjects = Object.values(deviceProfiles);

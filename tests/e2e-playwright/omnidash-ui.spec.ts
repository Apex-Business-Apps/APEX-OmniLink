import { test } from '@playwright/test';
import {
  setupOmnidashContext,
  captureOmnidashScreenshots,
} from './helpers/omnidash-helpers';

test.describe('OmniDash UI Screenshots', () => {
  test('capture desktop screenshots', async ({ browser }) => {
    const context = await setupOmnidashContext(browser, {
      viewport: { width: 1440, height: 900 },
    });

    await captureOmnidashScreenshots(context, 'desktop');
    await context.close();
  });

  test('capture mobile screenshots', async ({ browser }) => {
    const context = await setupOmnidashContext(browser, {
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    });

    await captureOmnidashScreenshots(context, 'mobile');
    await context.close();
  });
});
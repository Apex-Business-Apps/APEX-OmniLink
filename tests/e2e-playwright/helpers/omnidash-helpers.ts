import { Browser, BrowserContext, Page } from '@playwright/test';

export interface OmnidashContextOptions {
    viewport: { width: number; height: number };
    userAgent?: string;
}

/**
 * Sets up an Omnidash test context with the required localStorage and session mocking.
 * Eliminates duplicate setup code between desktop and mobile tests.
 */
export async function setupOmnidashContext(
    browser: Browser,
    options: OmnidashContextOptions
): Promise<BrowserContext> {
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
        viewport: options.viewport,
    };

    if (options.userAgent) {
        contextOptions.userAgent = options.userAgent;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Set OMNIDASH_ENABLED=1 and mock admin access
    await page.addInitScript(() => {
        window.localStorage.setItem('OMNIDASH_ENABLED', '1');
        Object.defineProperty(window, 'sessionStorage', {
            value: {
                getItem: () => JSON.stringify({ user: { email: 'admin@example.com' } }),
                setItem: () => { },
            },
            writable: true,
        });
    });

    await page.close(); // Close the setup page, tests will create new pages
    return context;
}

/**
 * Takes screenshots for both home and pipeline pages.
 */
export async function captureOmnidashScreenshots(
    context: BrowserContext,
    prefix: string
): Promise<void> {
    const page = await context.newPage();

    // Home page
    await page.goto('/omnidash');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
        path: `artifacts/omnidash-ui/${prefix}-home.png`,
        fullPage: true,
    });

    // Pipeline page
    await page.goto('/omnidash/pipeline');
    await page.waitForLoadState('networkidle');
    await page.screenshot({
        path: `artifacts/omnidash-ui/${prefix}-pipeline.png`,
        fullPage: true,
    });

    await page.close();
}

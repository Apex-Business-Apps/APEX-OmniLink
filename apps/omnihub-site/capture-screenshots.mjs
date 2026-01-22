import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }
});
const page = await context.newPage();

// Screenshot 1: Homepage (light theme)
await page.goto('http://localhost:3000');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: '/tmp/screenshot-homepage-light.png', fullPage: true });
console.log('Captured: Homepage (Light Theme)');

// Screenshot 2: Homepage header close-up (light theme)
await page.screenshot({
  path: '/tmp/screenshot-header-light.png',
  clip: { x: 0, y: 0, width: 1920, height: 100 }
});
console.log('Captured: Header Close-up (Light Theme)');

// Screenshot 3: Switch to dark theme
const darkLabel = await page.locator('label:has(input[value="dark"])');
await darkLabel.click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/screenshot-homepage-dark.png', fullPage: true });
console.log('Captured: Homepage (Dark Theme)');

// Screenshot 4: Homepage header close-up (dark theme)
await page.screenshot({
  path: '/tmp/screenshot-header-dark.png',
  clip: { x: 0, y: 0, width: 1920, height: 100 }
});
console.log('Captured: Header Close-up (Dark Theme)');

await browser.close();
console.log('All screenshots captured successfully!');

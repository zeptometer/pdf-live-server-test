import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { resolve } from 'path';

test('retains active page position on browser reload', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, '');
  }

  // 1. Go to page
  await page.goto('/');

  // 2. Wait for placeholder to be rendered
  await page.waitForSelector('.page-container');

  // 3. Move to next page
  await page.click('#nav-right');

  // Wait a bit for scroll to complete and observer to trigger
  await page.waitForTimeout(500);

  // 4. Reload the browser
  await page.reload();
  await page.waitForSelector('.page-container');

  // Wait a bit for restoring scroll
  await page.waitForTimeout(500);

  // 5. Verify that page 2 is in the viewport (scroll position restored)
  const page2 = page.locator('.page-container[data-page-num="2"]');
  await expect(page2).toBeInViewport();
});

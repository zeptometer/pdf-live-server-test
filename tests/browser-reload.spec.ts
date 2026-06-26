import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { resolve } from 'path';

test('retains active page position on browser reload', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath) || fs.statSync(dummyPdfPath).size < 100) {
    const context = await page.context();
    const newPage = await context.newPage();
    await newPage.setContent('<html><body><div style="height:100vh">Page 1</div><div style="height:100vh">Page 2</div></body></html>');
    await newPage.pdf({ path: dummyPdfPath });
    await newPage.close();
  }

  // 1. Go to page
  await page.goto('/');

  // 2. Wait for placeholder to be rendered
  await page.waitForSelector('.page-container');

  // 3. Move to next page
  await page.click('#nav-right');

  // Wait for the URL to update
  await expect(page).toHaveURL(/.*#page=2/);

  // 4. Reload the browser
  await page.reload();
  await page.waitForSelector('.page-container');

  await expect(page).toHaveURL(/.*#page=2/);

  // 5. Verify that page 2 is in the viewport
  const page2 = page.locator('.page-container[data-page-num="2"]');
  await expect(page2).toBeInViewport();
});

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { resolve } from 'path';

test('PDF reloads and maintains active page on file change', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  
  if (!fs.existsSync(dummyPdfPath) || fs.statSync(dummyPdfPath).size < 100) {
    const context = await page.context();
    const newPage = await context.newPage();
    await newPage.setContent('<html><body><div style="height:100vh">Page 1</div><div style="height:100vh">Page 2</div></body></html>');
    await newPage.pdf({ path: dummyPdfPath });
    await newPage.close();
  }

  // 1. Go to the page
  await page.goto('/');

  // 2. Wait for initial PDF render
  await page.waitForSelector('.page-container');

  // 3. Navigate to page 2
  await page.click('#nav-right');
  await expect(page).toHaveURL(/.*#page=2/);

  // 4. Modify the PDF file to trigger reload via SSE
  console.log('Modifying dummy.pdf to trigger SSE reload...');
  fs.appendFileSync(dummyPdfPath, ' ');

  // Wait for the DOM to update (container gets cleared and recreated)
  // We can just wait for the network or a short timeout, and verify the hash remains
  await page.waitForTimeout(1500);

  // 5. Verify page hash was maintained
  await expect(page).toHaveURL(/.*#page=2/);
  
  // Verify that the rendered container is still page 2
  const page2 = page.locator('.page-container[data-page-num="2"]');
  await expect(page2).toBeVisible();
});

test.use({ deviceScaleFactor: 2 });
test('Canvas resolution scales with devicePixelRatio', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, '');
  }

  await page.goto('/');
  await page.waitForSelector('.page-container');

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Evaluate the canvas properties
  const { width, clientWidth } = await canvas.evaluate((node: HTMLCanvasElement) => {
    return {
      width: node.width,
      clientWidth: node.clientWidth
    };
  });

  // The physical width should be 2x the client width since deviceScaleFactor is 2
  expect(width).toBeGreaterThan(clientWidth);
  expect(Math.round(width / clientWidth)).toBe(2);
});

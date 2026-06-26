import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { resolve } from 'path';

test('re-renders PDF to fit new height on viewport resize', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath) || fs.statSync(dummyPdfPath).size < 100) {
    const context = await page.context();
    const newPage = await context.newPage();
    await newPage.setContent('<html><body><div style="height:100vh">Page 1</div></body></html>');
    await newPage.pdf({ path: dummyPdfPath });
    await newPage.close();
  }

  // Set initial viewport
  await page.setViewportSize({ width: 800, height: 600 });
  
  await page.addInitScript(() => {
    localStorage.setItem('zoomMode', 'height');
  });

  await page.goto('/');

  // Wait for load
  await page.waitForSelector('.page-container');

  // Measure container height
  const initialContainer = await page.locator('.page-container').first();
  const initialBox = await initialContainer.boundingBox();
  expect(initialBox?.height).toBeCloseTo(600, -1); // Roughly 600

  // Scroll to page 2 BEFORE resizing
  await page.click('#nav-right');
  await expect(page).toHaveURL(/.*#page=2/);

  // Resize viewport to 900 height (simulating fullscreen or maximize)
  await page.setViewportSize({ width: 800, height: 900 });

  // Wait for debounce and re-render
  await page.waitForTimeout(1000);

  // Check URL hash is still #page=2
  await expect(page).toHaveURL(/.*#page=2/);

  // Measure container height again
  const newContainer = await page.locator('.page-container').first();
  const newBox = await newContainer.boundingBox();
  
  // Should have adapted to 900
  expect(newBox?.height).toBeCloseTo(900, -1);
  
  // Verify that page 2 is actually still in the viewport!
  const page2 = page.locator('.page-container[data-page-num="2"]');
  await expect(page2).toBeInViewport();
});

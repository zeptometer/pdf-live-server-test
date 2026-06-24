import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { resolve } from 'path';

test('PDF reloads and maintains scroll position on file change', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  
  // Ensure dummy.pdf exists for the test
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, '');
  }

  // 1. Go to the page
  await page.goto('/');

  // 2. Wait for initial PDF render
  // The frontend outputs 'PDF rendered, scroll restored to: ...' to the console when done.
  await page.waitForEvent('console', msg => msg.text().includes('PDF rendered'));

  // Ensure canvas is attached
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Force body to be tall enough to scroll
  await page.evaluate(() => {
    document.body.style.minHeight = '2000px';
  });

  // 3. Scroll down
  // Evaluate scroll in browser
  await page.evaluate(() => {
    window.scrollTo(0, 500);
  });

  // Verify scroll was applied
  let scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBe(500);

  // 4. Modify the PDF file to trigger reload
  // Wait for the NEXT 'PDF rendered' console message which indicates the reload is complete
  const renderPromise = page.waitForEvent('console', msg => msg.text().includes('PDF rendered'));
  
  console.log('Modifying dummy.pdf...');
  fs.appendFileSync(dummyPdfPath, ' ');

  // Wait for the re-render to complete
  await renderPromise;

  // 5. Verify scroll position was maintained
  scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBe(500);
});

test.use({ deviceScaleFactor: 2 });
test('Canvas resolution scales with devicePixelRatio', async ({ page }) => {
  const dummyPdfPath = resolve(process.cwd(), 'dummy.pdf');
  if (!fs.existsSync(dummyPdfPath)) {
    fs.writeFileSync(dummyPdfPath, '');
  }

  await page.goto('/');
  await page.waitForEvent('console', msg => msg.text().includes('PDF rendered'));

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();

  // Evaluate the canvas properties
  const { width, styleWidth } = await canvas.evaluate((node: HTMLCanvasElement) => {
    return {
      width: node.width,
      styleWidth: node.style.width
    };
  });

  // styleWidth should be in format "123px"
  const cssWidth = parseInt(styleWidth.replace('px', ''), 10);
  
  // The physical width should be 2x the CSS width since deviceScaleFactor is 2
  expect(width).toBeGreaterThan(cssWidth);
  expect(Math.round(width / cssWidth)).toBe(2);
});

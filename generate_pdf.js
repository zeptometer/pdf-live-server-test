const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<html><head><style>@page { size: A4; margin: 0; } .page { height: 100vh; page-break-after: always; }</style></head><body><div class="page">Page 1</div><div class="page">Page 2</div></body></html>');
  await page.pdf({ path: 'dummy.pdf' });
  await browser.close();
})();

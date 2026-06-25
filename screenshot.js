const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', exception => console.log('BROWSER ERROR:', exception));

  await page.goto('http://localhost:8080');
  await page.waitForTimeout(2000);

  const containerHTML = await page.evaluate(() => document.getElementById('pdf-container').innerHTML.substring(0, 500));
  console.log('HTML preview:', containerHTML);
  
  await browser.close();
})();

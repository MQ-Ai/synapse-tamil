// Renders docs/share/og-image.html to assets/og-image.png (1200x630).
// Run from the repo root: node docs/share/render.js
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
  const browser = await chromium.launch({ proxy });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.resolve(__dirname, 'og-image.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.resolve(__dirname, '../../assets/og-image.png') });
  await browser.close();
})();

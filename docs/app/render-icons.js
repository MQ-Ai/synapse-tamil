/* Renders docs/app/icon.html into the PNG app icons (needs Playwright + Chromium).
   FONT=/path/to/tiro-tamil.woff2 embeds the font when Chromium cannot reach Google Fonts. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const p = await b.newPage({ deviceScaleFactor: 1 });
  await p.goto('file://' + path.join(__dirname, 'icon.html'));
  if (process.env.FONT) {
    const b64 = require('fs').readFileSync(process.env.FONT).toString('base64');
    await p.addStyleTag({ content: `@font-face{font-family:'Tiro Tamil';src:url(data:font/woff2;base64,${b64}) format('woff2')}` });
  }
  await p.evaluate(() => document.fonts.ready);
  const out = path.join(__dirname, '../../assets/icons');
  const shots = [['any', 512, 'icon-512.png'], ['any', 192, 'icon-192.png'], ['maskable', 512, 'maskable-512.png'], ['apple', 180, 'apple-touch-icon.png']];
  for (const [id, size, file] of shots) {
    const el = await p.$('#' + id);
    const buf = await el.screenshot({ omitBackground: true });
    const q = await b.newPage({ viewport: { width: size, height: size } });
    await q.setContent(`<body style="margin:0;background:transparent"><img src="data:image/png;base64,${buf.toString('base64')}" width="${size}" height="${size}">`);
    await q.screenshot({ path: path.join(out, file), omitBackground: true });
    await q.close();
  }
  await b.close();
})();

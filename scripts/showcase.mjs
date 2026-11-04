// Renders the homepage/navigation showcase images from the live experiences.
// Usage: (dev server running) node scripts/showcase.mjs [baseUrl]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'http://localhost:5173';
const out = join(root, 'public', 'showcase');
await mkdir(out, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
  ({ chromium } = await import(pathToFileURL(join(g, 'playwright', 'index.mjs')).href));
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1250 }, deviceScaleFactor: 1 });
// controls drawn over a stage are not part of the picture
const hideControls = () =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('main *')) {
      if (el.tagName === 'CANVAS' || el.querySelector('canvas')) continue;
      const pos = getComputedStyle(el).position;
      if (pos === 'absolute' || pos === 'fixed' || el.tagName === 'BUTTON') el.style.visibility = 'hidden';
    }
  });
// watch: live configurator, overlays hidden
await page.goto(`${base}/watches?model=regent-automatic&clean=1`);
await page.waitForTimeout(7500);
await hideControls();
await writeFile(join(out, 'watches.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
// jewellery: 3D showroom
await page.goto(`${base}/jewellery`);
await page.getByRole('tab', { name: '3D Showroom' }).click();
await page.waitForTimeout(6000);
await hideControls();
await writeFile(join(out, 'jewellery.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
// tee: the garment alone, with the starter print
await page.setViewportSize({ width: 1100, height: 1100 });
await page.goto(`${base}/studio.html?tee=regular-half-round&print=1&color=%23f2efe6&bg=%23ece7df`);
await page.waitForFunction(() => window.__studioReady, null, { timeout: 60000 });
await page.evaluate(() => window.__tee.view('front'));
await page.waitForTimeout(1500);
await writeFile(join(out, 'tshirt.png'), await page.screenshot({ timeout: 90000 }));
await page.setViewportSize({ width: 1440, height: 1250 });
// curtains: the bright sample room with linen curtains
await page.goto(`${base}/curtains`);
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /Belgian Linen/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'after', exact: true }).click();
await page.waitForTimeout(1500);
await hideControls();
await writeFile(join(out, 'curtains.png'), await page.locator('main canvas[role=img]').first().screenshot({ timeout: 90000 }));
await browser.close();
execFileSync('python', ['-c', `
import glob, os
from PIL import Image
for p in glob.glob(os.path.join(r'''${out}''', '*.png')):
    im = Image.open(p).convert('RGB'); im.thumbnail((1400, 1400)); im.save(p[:-4] + '.webp', 'WEBP', quality=84, method=6); os.remove(p)
print('webp done')
`], { stdio: 'inherit' });

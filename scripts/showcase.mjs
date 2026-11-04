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
// watch: live configurator, overlays hidden
await page.goto(`${base}/watches?model=regent-automatic&clean=1`);
await page.waitForTimeout(7500);
await writeFile(join(out, 'watches.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
// jewellery: 3D showroom
await page.goto(`${base}/jewellery`);
await page.getByRole('tab', { name: '3D Showroom' }).click();
await page.waitForTimeout(6000);
await writeFile(join(out, 'jewellery.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
// tee: stage with the starter print
await page.goto(`${base}/tshirt`);
await page.waitForTimeout(3500);
await page.getByRole('button', { name: 'front', exact: true }).click().catch(() => {});
await page.waitForTimeout(1800);
await writeFile(join(out, 'tshirt.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
// curtains: warm room, linen
await page.goto(`${base}/curtains`);
await page.waitForTimeout(3000);
await page.locator('aside button img').nth(1).click();
await page.waitForTimeout(2500);
await writeFile(join(out, 'curtains.png'), await page.locator('main canvas').first().screenshot({ timeout: 90000 }));
await browser.close();
execFileSync('python', ['-c', `
import glob, os
from PIL import Image
for p in glob.glob(os.path.join(r'''${out}''', '*.png')):
    im = Image.open(p).convert('RGB'); im.thumbnail((1400, 1400)); im.save(p[:-4] + '.webp', 'WEBP', quality=84, method=6); os.remove(p)
print('webp done')
`], { stdio: 'inherit' });

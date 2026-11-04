// Renders each watch in the live configurator (overlays hidden) and saves a WebP thumbnail.
// Usage: (dev server running) node scripts/watch-thumbs.mjs [baseUrl]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'http://localhost:5173';
const out = join(root, 'public', 'watches', 'thumbs');
await mkdir(out, { recursive: true });
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
  ({ chromium } = await import(pathToFileURL(join(g, 'playwright', 'index.mjs')).href));
}
const src = await readFile(join(root, 'src', 'config', 'watches.ts'), 'utf8');
const ids = [...src.matchAll(/id: '([a-z0-9-]+)',\r?\n\s+name:/g)].map((m) => m[1]);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });
for (const id of ids) {
  await page.goto(`${base}/watches?model=${id}&clean=1`);
  await page.waitForTimeout(7500);
  const png = await page.locator('canvas').first().screenshot({ timeout: 90000, omitBackground: true });
  await writeFile(join(out, `${id}.png`), png);
  console.log('rendered', id);
}
await browser.close();
execFileSync('python', ['-c', `
import glob, os
from PIL import Image
for p in glob.glob(os.path.join(r'''${out}''', '*.png')):
    im = Image.open(p).convert('RGBA'); w, h = im.size
    im = im.crop((int(w*0.12), int(h*0.1), int(w*0.88), int(h*0.92)))
    im.thumbnail((420, 420)); im.save(p[:-4] + '.webp', 'WEBP', quality=86, method=6); os.remove(p)
print('webp done')
`], { stdio: 'inherit' });

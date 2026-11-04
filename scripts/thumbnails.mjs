// Renders every catalogue product in the 3D studio page and saves a WebP card image.
// Usage: (dev server running) node scripts/thumbnails.mjs [baseUrl]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'http://localhost:5173';
const out = join(root, 'public', 'thumbs');
await mkdir(out, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const globalRoot = execFileSync('npm', ['root', '-g'], { shell: true }).toString().trim();
  ({ chromium } = await import(pathToFileURL(join(globalRoot, 'playwright', 'index.mjs')).href));
}

const src = await readFile(join(root, 'src', 'config', 'catalog.ts'), 'utf8');
const ids = [...src.matchAll(/id: '([a-z0-9-]+)',\n\s+name:/g)].map((m) => m[1]);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
for (const id of ids) {
  await page.goto(`${base}/studio.html?id=${id}`);
  await page.waitForFunction(() => window.__studioReady === true, null, { timeout: 60000 });
  const png = await page.locator('canvas').screenshot({ omitBackground: true });
  await writeFile(join(out, `${id}.png`), png);
  console.log('rendered', id);
}
await browser.close();
// convert to WebP with alpha (Pillow)
execFileSync('python', ['-c', `
import glob, os
from PIL import Image
for p in glob.glob(os.path.join(r'''${out}''', '*.png')):
    im = Image.open(p).convert('RGBA')
    bbox = im.getbbox()
    if bbox:
        l, t, r, b = bbox; s = max(r - l, b - t); pad = int(s * 0.06); cx, cy = (l + r) // 2, (t + b) // 2; h = s // 2 + pad
        im = im.crop((cx - h, cy - h, cx + h, cy + h))
    im = im.resize((480, 480), Image.LANCZOS)
    im.save(p[:-4] + '.webp', 'WEBP', quality=88, method=6)
    os.remove(p)
print('webp done')
`], { stdio: 'inherit' });

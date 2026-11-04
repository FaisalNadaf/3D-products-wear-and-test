// Renders each curtain with the real 3D engine into public/curtains/<id>.webp
// (run with the dev server up: npx vite --port 5173, then node scripts/curtain-thumbs.mjs)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'curtains');
mkdirSync(out, { recursive: true });

const global = execSync('npm root -g').toString().trim();
const pw = await import(pathToFileURL(join(global, 'playwright', 'index.mjs')).href);
const { chromium } = pw;
const base = process.env.URL || 'http://localhost:5173';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 480, height: 480 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(`${base}/studio.html?curtains=list`);
await p.waitForFunction(() => window.__curtainIds);
const ids = await p.evaluate(() => window.__curtainIds);
for (const id of ids) {
  const url = await p.evaluate((i) => window.__renderCurtain(i), id);
  writeFileSync(join(out, `${id}.webp`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(id);
}
await b.close();

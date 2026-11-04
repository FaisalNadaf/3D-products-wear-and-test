/**
 * Bakes draped garments to public/garment/<fit>-<sleeve>-<neck>.bin
 *   npx tsx scripts/garment/bake.ts            all 30 styles
 *   npx tsx scripts/garment/bake.ts regular-half-round   one style
 *
 * File layout, per panel in order front, back, sleeveL, sleeveR:
 *   Int16  xyz per grid point (cm x 200)
 * then the same order again:
 *   Uint8  outside ambient occlusion, inside ambient occlusion
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { draftPattern, gridIndex, type Fit, type GarmentStyle, type Neck, type Panel, type SleeveLen } from '../../src/features/tshirt/garment/pattern';
import { simulate, type SimResult } from './sim';

const FITS: Fit[] = ['regular', 'oversized', 'slim'];
const SLEEVES: SleeveLen[] = ['half', 'full'];
const NECKS: Neck[] = ['round', 'vneck', 'scoop', 'polo', 'henley'];

/** Rasterises the cloth into a voxel grid, then marches hemisphere rays for ambient occlusion. */
function bakeAO(panels: Panel[], sim: SimResult) {
  const res = 1.1;
  const min = [-95, -100, -40];
  const dims = [174, 110, 74];
  const grid = new Uint8Array(dims[0] * dims[1] * dims[2]);
  const mark = (x: number, y: number, z: number) => {
    const ix = Math.floor((x - min[0]) / res);
    const iy = Math.floor((y - min[1]) / res);
    const iz = Math.floor((z - min[2]) / res);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= dims[0] || iy >= dims[1] || iz >= dims[2]) return;
    grid[ix + iy * dims[0] + iz * dims[0] * dims[1]] = 1;
  };
  const { x } = sim;
  const normals = new Float64Array(sim.count * 3);
  for (const p of panels) {
    const ids = sim.map.get(p.name)!;
    for (let j = 0; j < p.nr; j++)
      for (let i = 0; i < p.nc; i++) {
        const a = ids[gridIndex(p, i, j)] * 3;
        const b = ids[gridIndex(p, i + 1, j)] * 3;
        const c = ids[gridIndex(p, i, j + 1)] * 3;
        const d = ids[gridIndex(p, i + 1, j + 1)] * 3;
        for (let s = 0; s <= 2; s++)
          for (let t = 0; t <= 2; t++) {
            const u = s / 2;
            const v = t / 2;
            const w = (k: number) => x[a + k] * (1 - u) * (1 - v) + x[b + k] * u * (1 - v) + x[c + k] * (1 - u) * v + x[d + k] * u * v;
            mark(w(0), w(1), w(2));
          }
      }
  }
  // normals pointing out of the garment: flip each panel so they face away from its core
  const flip = new Map<string, number>();
  for (const p of panels) {
    const ids = sim.map.get(p.name)!;
    let sum = 0;
    const cy = p.name.startsWith('sleeve') ? 0 : -36;
    for (let j = 0; j < p.nr; j++)
      for (let i = 0; i < p.nc; i++) {
        const a = ids[gridIndex(p, i, j)] * 3;
        const b = ids[gridIndex(p, i + 1, j)] * 3;
        const c = ids[gridIndex(p, i, j + 1)] * 3;
        const ux = x[b] - x[a];
        const uy = x[b + 1] - x[a + 1];
        const uz = x[b + 2] - x[a + 2];
        const vx = x[c] - x[a];
        const vy = x[c + 1] - x[a + 1];
        const vz = x[c + 2] - x[a + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        if (p.name === 'front') sum += nz;
        else if (p.name === 'back') sum -= nz;
        else {
          // sleeve: outward from its own axis (average of ring centres at this row)
          let mx = 0;
          let my = 0;
          let mz = 0;
          for (let k = 0; k <= p.nc; k++) {
            const q = ids[gridIndex(p, k, j)] * 3;
            mx += x[q];
            my += x[q + 1];
            mz += x[q + 2];
          }
          const r = p.nc + 1;
          sum += nx * (x[a] - mx / r) + ny * (x[a + 1] - my / r) + nz * (x[a + 2] - mz / r);
        }
      }
    void cy;
    flip.set(p.name, sum >= 0 ? 1 : -1);
    for (let j = 0; j < p.nr; j++)
      for (let i = 0; i < p.nc; i++) {
        const a = ids[gridIndex(p, i, j)];
        const b = ids[gridIndex(p, i + 1, j)];
        const c = ids[gridIndex(p, i, j + 1)];
        const d = ids[gridIndex(p, i + 1, j + 1)];
        const ux = x[d * 3] - x[a * 3];
        const uy = x[d * 3 + 1] - x[a * 3 + 1];
        const uz = x[d * 3 + 2] - x[a * 3 + 2];
        const vx = x[c * 3] - x[b * 3];
        const vy = x[c * 3 + 1] - x[b * 3 + 1];
        const vz = x[c * 3 + 2] - x[b * 3 + 2];
        const s = flip.get(p.name)!;
        const nx = (uy * vz - uz * vy) * s;
        const ny = (uz * vx - ux * vz) * s;
        const nz = (ux * vy - uy * vx) * s;
        for (const q of [a, b, c, d]) {
          normals[q * 3] += nx;
          normals[q * 3 + 1] += ny;
          normals[q * 3 + 2] += nz;
        }
      }
  }
  const rays: [number, number, number][] = [];
  const nRays = 40;
  for (let i = 0; i < nRays; i++) {
    // fibonacci hemisphere
    const y = (i + 0.5) / nRays;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    rays.push([r * Math.cos(th), y, r * Math.sin(th)]);
  }
  const sample = (px: number, py: number, pz: number, nx: number, ny: number, nz: number) => {
    // tangent frame around n
    const ax = Math.abs(nx) < 0.8 ? 1 : 0;
    const ay = ax ? 0 : 1;
    let tx = ny * 0 - nz * ay;
    let ty = nz * ax - nx * 0;
    let tz = nx * ay - ny * ax;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    let open = 0;
    let weight = 0;
    for (const [rx, ry, rz] of rays) {
      const dx = rx * tx + ry * nx + rz * bx;
      const dy = rx * ty + ry * ny + rz * by;
      const dz = rx * tz + ry * nz + rz * bz;
      let vis = 1;
      for (let d = 2.4; d < 42; d *= 1.22) {
        const ix = Math.floor((px + dx * d - min[0]) / res);
        const iy = Math.floor((py + dy * d - min[1]) / res);
        const iz = Math.floor((pz + dz * d - min[2]) / res);
        if (ix < 0 || iy < 0 || iz < 0 || ix >= dims[0] || iy >= dims[1] || iz >= dims[2]) break;
        if (grid[ix + iy * dims[0] + iz * dims[0] * dims[1]]) {
          // close geometry occludes completely, far geometry only partly
          vis = Math.min(1, 0.05 + Math.pow(d / 42, 1.2) * 0.7);
          break;
        }
      }
      open += vis * ry;
      weight += ry;
    }
    return open / weight;
  };
  const aoOut = new Uint8Array(sim.count);
  const aoIn = new Uint8Array(sim.count);
  for (let i = 0; i < sim.count; i++) {
    const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
    const nx = normals[i * 3] / l;
    const ny = normals[i * 3 + 1] / l;
    const nz = normals[i * 3 + 2] / l;
    aoOut[i] = Math.round(255 * sample(x[i * 3], x[i * 3 + 1], x[i * 3 + 2], nx, ny, nz));
    aoIn[i] = Math.round(255 * sample(x[i * 3], x[i * 3 + 1], x[i * 3 + 2], -nx, -ny, -nz));
  }
  blurAO(panels, sim, aoOut);
  blurAO(panels, sim, aoIn);
  return { aoOut, aoIn };
}

/** Voxel occlusion is grainy: smooth it across the cloth so it reads as soft light. */
function blurAO(panels: Panel[], sim: SimResult, ao: Uint8Array) {
  const value = Float32Array.from(ao);
  for (let pass = 0; pass < 5; pass++) {
    const sum = new Float32Array(sim.count);
    const n = new Float32Array(sim.count);
    for (const p of panels) {
      const ids = sim.map.get(p.name)!;
      for (let j = 0; j <= p.nr; j++)
        for (let i = 0; i <= p.nc; i++) {
          const a = ids[gridIndex(p, i, j)];
          sum[a] += value[a] * 2;
          n[a] += 2;
          if (i < p.nc) {
            const b = ids[gridIndex(p, i + 1, j)];
            sum[a] += value[b];
            n[a]++;
            sum[b] += value[a];
            n[b]++;
          }
          if (j < p.nr) {
            const b = ids[gridIndex(p, i, j + 1)];
            sum[a] += value[b];
            n[a]++;
            sum[b] += value[a];
            n[b]++;
          }
        }
    }
    for (let i = 0; i < sim.count; i++) value[i] = sum[i] / n[i];
  }
  for (let i = 0; i < sim.count; i++) ao[i] = Math.round(value[i]);
}

function bake(style: GarmentStyle, outDir: string) {
  const t0 = Date.now();
  const pt = draftPattern(style);
  const panels = [pt.front, pt.back, pt.sleeveL, pt.sleeveR];
  const key = `${style.fit}-${style.sleeve}-${style.neck}`;
  const sim = simulate(pt, { log: (s) => console.log(`  ${key}: ${s}`) });
  const { aoOut, aoIn } = bakeAO(panels, sim);
  const grids = panels.reduce((a, p) => a + (p.nc + 1) * (p.nr + 1), 0);
  const buf = new ArrayBuffer(grids * 6 + grids * 2);
  const pos = new Int16Array(buf, 0, grids * 3);
  const ao = new Uint8Array(buf, grids * 6, grids * 2);
  let n = 0;
  let minY = 1e9;
  let maxY = -1e9;
  let maxX = 0;
  for (const p of panels) {
    const ids = sim.map.get(p.name)!;
    for (let g = 0; g < ids.length; g++, n++) {
      const q = ids[g];
      for (let k = 0; k < 3; k++) pos[n * 3 + k] = Math.round(sim.x[q * 3 + k] * 200);
      ao[n * 2] = aoOut[q];
      ao[n * 2 + 1] = aoIn[q];
      minY = Math.min(minY, sim.x[q * 3 + 1]);
      maxY = Math.max(maxY, sim.x[q * 3 + 1]);
      maxX = Math.max(maxX, Math.abs(sim.x[q * 3]));
    }
  }
  writeFileSync(resolve(outDir, `${key}.bin`), Buffer.from(buf));
  console.log(`${key}: y ${minY.toFixed(1)}..${maxY.toFixed(1)}, |x| ${maxX.toFixed(1)}, ${(buf.byteLength / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

function main() {
  const outDir = resolve('public/garment');
  mkdirSync(outDir, { recursive: true });
  const only = process.argv[2];
  for (const fit of FITS)
    for (const sleeve of SLEEVES)
      for (const neck of NECKS) {
        if (only && only !== `${fit}-${sleeve}-${neck}`) continue;
        bake({ fit, sleeve, neck }, outDir);
      }
}

main();

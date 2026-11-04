/**
 * Offline cloth simulation (position-based dynamics). Panels are sewn into one
 * particle system, then gravity drapes them over the dress form. Stretch is
 * resisted firmly and compression weakly, the way knit fabric behaves, so
 * surplus cloth buckles into natural folds.
 */
import { BodySDF } from './body';
import { gridIndex, seams, type Panel, type Pattern } from '../../src/features/tshirt/garment/pattern';

export interface SimResult {
  /** particle positions */
  x: Float64Array;
  /** panel grid to particle index */
  map: Map<string, Int32Array>;
  count: number;
}

const LIFT = 1.5; // the pattern's high shoulder point starts this far above y = 0

/** Small seeded generator: bakes must be reproducible. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(pt: Pattern, opts: { steps?: number; seed?: number; log?: (s: string) => void } = {}): SimResult {
  const steps = opts.steps ?? 1500;
  const panels: Panel[] = [pt.front, pt.back, pt.sleeveL, pt.sleeveR];
  // sew: union-find over all grid points
  let total = 0;
  const offset = new Map<string, number>();
  for (const p of panels) {
    offset.set(p.name, total);
    total += (p.nc + 1) * (p.nr + 1);
  }
  const parent = new Int32Array(total).map((_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const refIdx = (p: Panel, i: number, j: number) => offset.get(p.name)! + gridIndex(p, i, j);
  const sewn = seams(pt);
  for (let s = 0; s < sewn.length; s += 2) {
    const a = sewn[s];
    const b = sewn[s + 1];
    for (let k = 0; k < a.length; k++) parent[find(refIdx(a[k][0], a[k][1], a[k][2]))] = find(refIdx(b[k][0], b[k][1], b[k][2]));
  }
  const ids = new Int32Array(total).fill(-1);
  let count = 0;
  const remap = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    const r = find(i);
    if (ids[r] < 0) ids[r] = count++;
    remap[i] = ids[r];
  }
  const map = new Map<string, Int32Array>();
  for (const p of panels) {
    const off = offset.get(p.name)!;
    const n = (p.nc + 1) * (p.nr + 1);
    const m = new Int32Array(n);
    for (let i = 0; i < n; i++) m[i] = remap[off + i];
    map.set(p.name, m);
  }

  const sdf = new BodySDF({ cw: pt.m.cw, sw: pt.m.sw, sl: pt.m.sl });
  const ARM = sdf.arm;
  // initial placement: body panels wrap the form, meeting along the shoulders
  const x = new Float64Array(count * 3);
  const placed = new Uint8Array(count);
  const place = (idx: number, px: number, py: number, pz: number) => {
    if (placed[idx]) return;
    x[idx * 3] = px;
    x[idx * 3 + 1] = py;
    x[idx * 3 + 2] = pz;
    placed[idx] = 1;
  };
  const { m } = pt;
  for (const p of [pt.front, pt.back]) {
    const sg = p.name === 'front' ? 1 : -1;
    const ids2 = map.get(p.name)!;
    for (let j = 0; j <= p.nr; j++)
      for (let i = 0; i <= p.nc; i++) {
        const [px, py] = p.pts[gridIndex(p, i, j)];
        const y = py + LIFT;
        const half = Math.max(Math.abs(p.pts[gridIndex(p, 0, j)][0]), Math.abs(p.pts[gridIndex(p, p.nc, j)][0]), 1);
        const t = Math.min(1, Math.abs(px) / half);
        const b = sdf.section(y)[1];
        // depth fades to nothing at the shoulder line so the seam closes
        const shoulderY = -(m.sl * Math.max(0, Math.abs(px) - m.nw)) / Math.max(1, m.sw - m.nw) + LIFT;
        const fade = Math.min(1, Math.max(0, (shoulderY - y) / 9));
        const onShoulder = j === 0 && i >= 0 && (i <= pt.ns || i >= p.nc - pt.ns);
        const depth = onShoulder ? 0 : (b + 3.5) * Math.sqrt(1 - t * t) * (fade * fade * (3 - 2 * fade));
        place(ids2[gridIndex(p, i, j)], px, y, sg * Math.max(depth, onShoulder ? 0 : 0.01));
      }
  }
  // sleeves: loft from the armhole ring to a ring around the arm
  for (const [p, side] of [
    [pt.sleeveL, 1],
    [pt.sleeveR, -1],
  ] as [Panel, number][]) {
    const ids2 = map.get(p.name)!;
    const ax = Math.sin(ARM.angle) * side;
    const ay = -Math.cos(ARM.angle);
    // perpendicular to the arm, pointing up and out
    const nx = Math.cos(ARM.angle) * side;
    const ny = Math.sin(ARM.angle);
    const tip = ids2[gridIndex(p, pt.ra, 0)];
    const cuffR = m.cuff / Math.PI + 0.6;
    const cx = x[tip * 3] + ax * m.sll - nx * cuffR;
    const cy = x[tip * 3 + 1] + ay * m.sll - ny * cuffR;
    for (let c = 0; c <= p.nc; c++) {
      const th = (c / p.nc) * Math.PI * 2;
      const ex = cx - Math.cos(th) * cuffR * nx;
      const ey = cy - Math.cos(th) * cuffR * ny;
      const ez = Math.sin(th) * cuffR;
      const s0 = ids2[gridIndex(p, c, 0)];
      const sx = x[s0 * 3];
      const sy = x[s0 * 3 + 1];
      const sz = x[s0 * 3 + 2];
      for (let j = 1; j <= p.nr; j++) {
        const t = j / p.nr;
        place(ids2[gridIndex(p, c, j)], sx + (ex - sx) * t, sy + (ey - sy) * t, sz + (ez - sz) * t);
      }
    }
  }
  // a little asymmetry, so the folds do not mirror
  const rand = rng(opts.seed ?? 7);
  for (let i = 0; i < count * 3; i++) x[i] += (rand() - 0.5) * 0.12;

  // constraints from the flat pattern: structural, shear, bending, firm neck edge
  const ca: number[] = [];
  const cb: number[] = [];
  const rest: number[] = [];
  const kind: number[] = [];
  const seen = new Set<number>();
  const add = (a: number, b: number, l: number, k: number) => {
    if (a === b) return;
    const key = a < b ? a * count + b : b * count + a;
    if (seen.has(key)) return;
    seen.add(key);
    ca.push(a);
    cb.push(b);
    rest.push(l);
    kind.push(k);
  };
  for (const p of [pt.front, pt.back]) {
    const ids2 = map.get(p.name)!;
    for (let i = pt.ns; i < pt.ns + pt.nk; i++) {
      const a = p.pts[gridIndex(p, i, 0)];
      const b = p.pts[gridIndex(p, i + 1, 0)];
      add(ids2[gridIndex(p, i, 0)], ids2[gridIndex(p, i + 1, 0)], Math.hypot(a[0] - b[0], a[1] - b[1]), 3);
    }
  }
  for (const p of panels) {
    const ids2 = map.get(p.name)!;
    const dist = (i0: number, j0: number, i1: number, j1: number) => {
      const a = p.pts[gridIndex(p, i0, j0)];
      const b = p.pts[gridIndex(p, i1, j1)];
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    for (let j = 0; j <= p.nr; j++)
      for (let i = 0; i <= p.nc; i++) {
        const id = ids2[gridIndex(p, i, j)];
        const link = (di: number, dj: number, k: number) => {
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii > p.nc || jj > p.nr) return;
          add(id, ids2[gridIndex(p, ii, jj)], dist(i, j, ii, jj), k);
        };
        link(1, 0, 0);
        link(0, 1, 0);
        link(1, 1, 1);
        link(1, -1, 1);
        link(2, 0, 2);
        link(0, 2, 2);
      }
  }
  const nA = new Int32Array(ca);
  const nB = new Int32Array(cb);
  const nL = new Float64Array(rest);
  const nK = new Uint8Array(kind);
  const nCon = nA.length;
  opts.log?.(`particles ${count}, constraints ${nCon}`);

  const prev = Float64Array.from(x);
  const dt = 1 / 120;
  const g = 420 * dt * dt;
  const out = new Float64Array(4);
  const margin = 0.5;
  const stiffStretch = [1, 0.8, 0.16, 1];
  const stiffCompress = [0.4, 0.3, 0.16, 0.9];
  const iters = 12;
  for (let step = 0; step < steps; step++) {
    const damp = step < steps * 0.65 ? 0.985 : 0.93;
    const grav = g * Math.min(1, step / 150);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      for (let a = 0; a < 3; a++) {
        const cur = x[i3 + a];
        let v = (cur - prev[i3 + a]) * damp;
        if (a === 1) v -= grav;
        prev[i3 + a] = cur;
        x[i3 + a] = cur + v;
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < nCon; c++) {
        const a = nA[c] * 3;
        const b = nB[c] * 3;
        const dx = x[b] - x[a];
        const dy = x[b + 1] - x[a + 1];
        const dz = x[b + 2] - x[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
        const err = d - nL[c];
        const k = err > 0 ? stiffStretch[nK[c]] : stiffCompress[nK[c]];
        const f = (0.5 * k * err) / d;
        x[a] += dx * f;
        x[a + 1] += dy * f;
        x[a + 2] += dz * f;
        x[b] -= dx * f;
        x[b + 1] -= dy * f;
        x[b + 2] -= dz * f;
      }
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        sdf.sample(x[i3], x[i3 + 1], x[i3 + 2], out);
        if (out[0] < margin) {
          const push = margin - out[0];
          x[i3] += out[1] * push;
          x[i3 + 1] += out[2] * push;
          x[i3 + 2] += out[3] * push;
          // friction against the form
          const mx = x[i3] - prev[i3];
          const my = x[i3 + 1] - prev[i3 + 1];
          const mz = x[i3 + 2] - prev[i3 + 2];
          const n = mx * out[1] + my * out[2] + mz * out[3];
          const fr = 0.1;
          x[i3] -= (mx - n * out[1]) * fr;
          x[i3 + 1] -= (my - n * out[2]) * fr;
          x[i3 + 2] -= (mz - n * out[3]) * fr;
        }
      }
    }
    if (opts.log && step % 500 === 0) opts.log(`step ${step}`);
  }

  if (opts.log) {
    let maxS = 0;
    let sum = 0;
    let n = 0;
    for (let c = 0; c < nCon; c++) {
      if (nK[c] !== 0) continue;
      const a = nA[c] * 3;
      const b = nB[c] * 3;
      const s = Math.hypot(x[b] - x[a], x[b + 1] - x[a + 1], x[b + 2] - x[a + 2]) / nL[c];
      maxS = Math.max(maxS, s);
      sum += s;
      n++;
    }
    opts.log(`stretch mean ${(sum / n).toFixed(3)} max ${maxS.toFixed(3)}`);
  }
  return { x, map, count };
}

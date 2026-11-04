import { draftPattern, gridIndex, type GarmentStyle, type Panel, type Pattern } from './pattern';
import { TILE_CM } from './fabric';

/**
 * Turns a baked drape (scripts/garment/bake.ts) into render parts. Everything
 * is expressed as flat arrays with stable sizes per part name, so the engine
 * can morph between styles by interpolating them.
 */
export const W = 1536;
export const H = 2100;
/** Print canvas scale: prints keep their real size on every fit. */
export const PX_PER_CM = 28;
const TOP_CM = 3; // canvas y = 0 is this far above the high shoulder point
export const UNIT = 1 / 30; // world units per cm
export const CENTRE_Y = 37; // cm added to y so the garment is centred on the origin

type V3 = [number, number, number];
export type PartMaterial = 'trim' | 'rib' | 'stitch' | 'crease' | 'button' | 'hole';

export interface Part {
  key: string;
  material: PartMaterial | 'garment';
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  uv: Float32Array;
  uv1?: Float32Array;
  ao?: Float32Array;
  /** [start, count] of body and sleeve triangles, for the two-material garment parts */
  groups?: [number, number][];
}

export interface Build {
  front: Part;
  back: Part;
  details: Part[];
  /** coarse copies used for pointer picking */
  pickFront: Part;
  pickBack: Part;
  /** sleeve print polygons per canvas (canvas px) */
  zones: Record<'front' | 'back', Record<'sleeveL' | 'sleeveR', [number, number][]>>;
  size: { width: number; height: number; depth: number; centreY: number };
}

interface Grid {
  panel: Panel;
  cols: number;
  rows: number;
  p: Float32Array; // cm
  n: Float32Array;
  ao: Float32Array; // outside, inside
  flat: Float32Array; // pattern x,y
}

const cache = new Map<string, Promise<ArrayBuffer>>();
export const styleKey = (s: GarmentStyle) => `${s.fit}-${s.sleeve}-${s.neck}`;

export function fetchDrape(s: GarmentStyle) {
  const key = styleKey(s);
  let hit = cache.get(key);
  if (!hit) {
    hit = fetch(`${import.meta.env.BASE_URL}garment/${key}.bin`).then((r) => {
      if (!r.ok) throw new Error(`Garment ${key} is missing (${r.status})`);
      return r.arrayBuffer();
    });
    hit.catch(() => cache.delete(key));
    cache.set(key, hit);
  }
  return hit;
}

/** Four-point interpolating subdivision: passes through every simulated point. */
function subdivide(src: Float32Array, stride: number, cols: number, rows: number, s: number) {
  if (s === 1) return src;
  const nc = cols * s;
  const nr = rows * s;
  const out = new Float32Array((nc + 1) * (nr + 1) * stride);
  const put = (i: number, j: number, k: number, v: number) => (out[(j * (nc + 1) + i) * stride + k] = v);
  const get = (i: number, j: number, k: number) => src[(Math.min(rows, Math.max(0, j)) * (cols + 1) + Math.min(cols, Math.max(0, i))) * stride + k];
  const w = [-1 / 16, 9 / 16, 9 / 16, -1 / 16];
  for (let k = 0; k < stride; k++) {
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        put(i * 2, j * 2, k, get(i, j, k));
        if (i < cols) put(i * 2 + 1, j * 2, k, w[0] * get(i - 1, j, k) + w[1] * get(i, j, k) + w[2] * get(i + 1, j, k) + w[3] * get(i + 2, j, k));
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i <= nc; i++) {
        const at = (r: number) => out[(Math.min(nr, Math.max(0, r * 2)) * (nc + 1) + i) * stride + k];
        put(i, j * 2 + 1, k, w[0] * at(j - 1) + w[1] * at(j) + w[2] * at(j + 1) + w[3] * at(j + 2));
      }
  }
  return out;
}

function readGrids(buf: ArrayBuffer, pt: Pattern, s: number): Grid[] {
  const panels = [pt.front, pt.back, pt.sleeveL, pt.sleeveR];
  const total = panels.reduce((a, p) => a + (p.nc + 1) * (p.nr + 1), 0);
  const pos = new Int16Array(buf, 0, total * 3);
  const ao = new Uint8Array(buf, total * 6, total * 2);
  let off = 0;
  return panels.map((panel) => {
    const n = (panel.nc + 1) * (panel.nr + 1);
    const p0 = new Float32Array(n * 3);
    const a0 = new Float32Array(n * 2);
    const f0 = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) p0[i * 3 + k] = pos[(off + i) * 3 + k] / 200;
      a0[i * 2] = ao[(off + i) * 2] / 255;
      a0[i * 2 + 1] = ao[(off + i) * 2 + 1] / 255;
      f0[i * 2] = panel.pts[i][0];
      f0[i * 2 + 1] = panel.pts[i][1];
    }
    off += n;
    const cols = panel.nc * s;
    const rows = panel.nr * s;
    return {
      panel,
      cols,
      rows,
      p: subdivide(p0, 3, panel.nc, panel.nr, s),
      a0,
      ao: subdivide(a0, 2, panel.nc, panel.nr, s),
      flat: subdivide(f0, 2, panel.nc, panel.nr, s),
      n: new Float32Array((cols + 1) * (rows + 1) * 3),
    };
  });
}

/** Smooth normals across all panels, with vertices on sewn seams welded together. */
function computeNormals(grids: Grid[]) {
  const shared = new Map<string, number[]>();
  const hashAt = (g: Float32Array, i: number) => `${Math.round(g[i * 3] * 400)},${Math.round(g[i * 3 + 1] * 400)},${Math.round(g[i * 3 + 2] * 400)}`;
  grids.forEach((g) => {
    const stride = g.cols + 1;
    // outward direction decides the panel's orientation
    let score = 0;
    const out = g.panel.name === 'front' ? 1 : g.panel.name === 'back' ? -1 : 0;
    const accum = new Float32Array(g.n.length);
    for (let j = 0; j < g.rows; j++)
      for (let i = 0; i < g.cols; i++) {
        const a = j * stride + i;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        const ux = g.p[d * 3] - g.p[a * 3];
        const uy = g.p[d * 3 + 1] - g.p[a * 3 + 1];
        const uz = g.p[d * 3 + 2] - g.p[a * 3 + 2];
        const vx = g.p[c * 3] - g.p[b * 3];
        const vy = g.p[c * 3 + 1] - g.p[b * 3 + 1];
        const vz = g.p[c * 3 + 2] - g.p[b * 3 + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        for (const q of [a, b, c, d]) {
          accum[q * 3] += nx;
          accum[q * 3 + 1] += ny;
          accum[q * 3 + 2] += nz;
        }
        if (out) score += nz * out;
        else {
          // sleeves point away from the centre of their own ring
          let mx = 0;
          let my = 0;
          let mz = 0;
          const m = 6;
          for (let t = 0; t < m; t++) {
            const r = j * stride + Math.floor((t * g.cols) / m);
            mx += g.p[r * 3];
            my += g.p[r * 3 + 1];
            mz += g.p[r * 3 + 2];
          }
          score += nx * (g.p[a * 3] - mx / m) + ny * (g.p[a * 3 + 1] - my / m) + nz * (g.p[a * 3 + 2] - mz / m);
        }
      }
    const flip = score >= 0 ? 1 : -1;
    (g as Grid & { flip: number }).flip = flip;
    for (let i = 0; i < accum.length; i++) g.n[i] = accum[i] * flip;
    const nv = (g.cols + 1) * (g.rows + 1);
    for (let i = 0; i < nv; i++) {
      const onEdge = i < stride || i >= nv - stride || i % stride === 0 || i % stride === g.cols;
      if (!onEdge) continue;
      const key = hashAt(g.p, i);
      let e = shared.get(key);
      if (!e) shared.set(key, (e = [0, 0, 0]));
      e[0] += g.n[i * 3];
      e[1] += g.n[i * 3 + 1];
      e[2] += g.n[i * 3 + 2];
    }
  });
  grids.forEach((g) => {
    const stride = g.cols + 1;
    const nv = stride * (g.rows + 1);
    for (let i = 0; i < nv; i++) {
      const onEdge = i < stride || i >= nv - stride || i % stride === 0 || i % stride === g.cols;
      if (onEdge) {
        const e = shared.get(hashAt(g.p, i))!;
        g.n[i * 3] = e[0];
        g.n[i * 3 + 1] = e[1];
        g.n[i * 3 + 2] = e[2];
      }
      const l = Math.hypot(g.n[i * 3], g.n[i * 3 + 1], g.n[i * 3 + 2]) || 1;
      g.n[i * 3] /= l;
      g.n[i * 3 + 1] /= l;
      g.n[i * 3 + 2] /= l;
    }
  });
}

const toX = (x: number) => x * UNIT;
const toY = (y: number) => (y + CENTRE_Y) * UNIT;
const toZ = (z: number) => z * UNIT;

/** Bilinear sample of a grid at fractional column/row, in cm. */
function sample(g: Grid, ci: number, rj: number): { p: V3; n: V3 } {
  const i = Math.min(g.cols - 1e-4, Math.max(0, ci));
  const j = Math.min(g.rows - 1e-4, Math.max(0, rj));
  const i0 = Math.floor(i);
  const j0 = Math.floor(j);
  const u = i - i0;
  const v = j - j0;
  const s = g.cols + 1;
  const mix = (a: Float32Array, k: number) =>
    (a[(j0 * s + i0) * 3 + k] * (1 - u) + a[(j0 * s + i0 + 1) * 3 + k] * u) * (1 - v) + (a[((j0 + 1) * s + i0) * 3 + k] * (1 - u) + a[((j0 + 1) * s + i0 + 1) * 3 + k] * u) * v;
  return { p: [mix(g.p, 0), mix(g.p, 1), mix(g.p, 2)], n: [mix(g.n, 0), mix(g.n, 1), mix(g.n, 2)] };
}

/** One side of the garment: its body panel and the matching half of each sleeve. */
function buildSide(side: 'front' | 'back', grids: Grid[], pt: Pattern, s: number, key: string): Part {
  const body = grids[side === 'front' ? 0 : 1];
  const pieces: { g: Grid; c0: number; c1: number; sleeve: 'L' | 'R' | null }[] = [{ g: body, c0: 0, c1: body.cols, sleeve: null }];
  const half = pt.ra * s;
  for (const [g, sl] of [
    [grids[2], 'L'],
    [grids[3], 'R'],
  ] as [Grid, 'L' | 'R'][])
    pieces.push({ g, c0: side === 'front' ? 0 : half, c1: side === 'front' ? half : 2 * half, sleeve: sl });
  let nv = 0;
  let ni = 0;
  for (const q of pieces) {
    nv += (q.c1 - q.c0 + 1) * (q.g.rows + 1);
    ni += (q.c1 - q.c0) * q.g.rows * 6;
  }
  const position = new Float32Array(nv * 3);
  const normal = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const uv1 = new Float32Array(nv * 2);
  const ao = new Float32Array(nv * 2);
  const index = new Uint32Array(ni);
  const groups: [number, number][] = [];
  let v = 0;
  let t = 0;
  const bw = pt.m.bw;
  const off = (768 - bw * PX_PER_CM) / 2;
  const capTop = pt.capHeight + 1;
  for (const q of pieces) {
    const { g, c0, c1, sleeve } = q;
    const stride = g.cols + 1;
    const start = v;
    const flip = (g as Grid & { flip: number }).flip;
    for (let j = 0; j <= g.rows; j++)
      for (let c = c0; c <= c1; c++, v++) {
        const i = j * stride + c;
        position[v * 3] = toX(g.p[i * 3]);
        position[v * 3 + 1] = toY(g.p[i * 3 + 1]);
        position[v * 3 + 2] = toZ(g.p[i * 3 + 2]);
        normal[v * 3] = g.n[i * 3];
        normal[v * 3 + 1] = g.n[i * 3 + 1];
        normal[v * 3 + 2] = g.n[i * 3 + 2];
        const fx = g.flat[i * 2];
        const fy = g.flat[i * 2 + 1];
        let px: number;
        let py: number;
        if (!sleeve) {
          px = W / 2 + (side === 'front' ? fx : -fx) * PX_PER_CM;
          py = (TOP_CM - fy) * PX_PER_CM;
        } else {
          // see Build.zones: each sleeve half keeps its own half of the sleeve canvas
          py = (capTop - fy) * PX_PER_CM;
          if (side === 'front') px = sleeve === 'L' ? 768 + off + (fx + bw) * PX_PER_CM : off - fx * PX_PER_CM;
          else px = sleeve === 'L' ? off + fx * PX_PER_CM : 768 + off + (bw - fx) * PX_PER_CM;
        }
        uv[v * 2] = px / W;
        uv[v * 2 + 1] = 1 - py / H;
        uv1[v * 2] = fx / TILE_CM;
        uv1[v * 2 + 1] = fy / TILE_CM;
        ao[v * 2] = g.ao[i * 2];
        ao[v * 2 + 1] = g.ao[i * 2 + 1];
      }
    const w = c1 - c0 + 1;
    const first = t;
    for (let j = 0; j < g.rows; j++)
      for (let c = 0; c < c1 - c0; c++) {
        const a = start + j * w + c;
        const b = a + 1;
        const d = a + w;
        const e = d + 1;
        if (flip > 0) {
          index[t++] = a;
          index[t++] = b;
          index[t++] = d;
          index[t++] = b;
          index[t++] = e;
          index[t++] = d;
        } else {
          index[t++] = a;
          index[t++] = d;
          index[t++] = b;
          index[t++] = b;
          index[t++] = d;
          index[t++] = e;
        }
      }
    if (!sleeve) groups.push([first, t - first]);
    else if (groups.length === 1) groups.push([first, t - first]);
    else groups[1][1] += t - first;
  }
  return { key, material: 'garment', position, normal, index, uv, uv1, ao, groups };
}

/** A strip laid over the cloth along a line of samples (stitch rows and seam lines). */
function ribbon(key: string, material: PartMaterial, line: { p: V3; n: V3 }[], widthCm: number, repeatCm: number, liftCm: number): Part {
  const n = line.length;
  const position = new Float32Array(n * 6);
  const normal = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  const index = new Uint32Array((n - 1) * 6);
  let along = 0;
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)].p;
    const b = line[Math.min(n - 1, i + 1)].p;
    const nn = line[i].n;
    const l0 = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    const nx = nn[0] / l0;
    const ny = nn[1] / l0;
    const nz = nn[2] / l0;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    let tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const sx = ny * tz - nz * ty;
    const sy = nz * tx - nx * tz;
    const sz = nx * ty - ny * tx;
    if (i) {
      const q = line[i - 1].p;
      along += Math.hypot(line[i].p[0] - q[0], line[i].p[1] - q[1], line[i].p[2] - q[2]);
    }
    const [px, py, pz] = line[i].p;
    for (const [e, side] of [
      [0, -1],
      [1, 1],
    ]) {
      const v = i * 2 + e;
      position[v * 3] = toX(px + sx * side * widthCm * 0.5 + nx * liftCm);
      position[v * 3 + 1] = toY(py + sy * side * widthCm * 0.5 + ny * liftCm);
      position[v * 3 + 2] = toZ(pz + sz * side * widthCm * 0.5 + nz * liftCm);
      normal[v * 3] = nx;
      normal[v * 3 + 1] = ny;
      normal[v * 3 + 2] = nz;
      uv[v * 2] = along / repeatCm;
      uv[v * 2 + 1] = e;
    }
    if (i < n - 1) {
      const a0 = i * 2;
      const t = i * 6;
      index.set([a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3], t);
    }
  }
  return { key, material, position, normal, index, uv };
}

/** A loft: rings of points along the seam, joined across a cross-section profile. */
function loft(key: string, material: PartMaterial, rings: V3[][], arcCm: number[], profileCm: number[], closed: boolean): Part {
  const n = rings.length;
  const m = rings[0].length;
  const nv = n * m;
  const position = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const uv1 = new Float32Array(nv * 2);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const v = i * m + j;
      position[v * 3] = toX(rings[i][j][0]);
      position[v * 3 + 1] = toY(rings[i][j][1]);
      position[v * 3 + 2] = toZ(rings[i][j][2]);
      uv1[v * 2] = arcCm[i] / TILE_CM;
      uv1[v * 2 + 1] = profileCm[j] / TILE_CM;
      uv[v * 2] = 0;
      uv[v * 2 + 1] = 0;
    }
  const segs = closed ? n : n - 1;
  const index = new Uint32Array(segs * (m - 1) * 6);
  let t = 0;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % n;
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = i2 * m + j;
      index.set([a, b, a + 1, b, b + 1, a + 1], t);
      t += 6;
    }
  }
  // smooth normals over the loft
  const normal = new Float32Array(nv * 3);
  for (let k = 0; k < index.length; k += 3) {
    const [a, b, c] = [index[k], index[k + 1], index[k + 2]];
    const ux = position[b * 3] - position[a * 3];
    const uy = position[b * 3 + 1] - position[a * 3 + 1];
    const uz = position[b * 3 + 2] - position[a * 3 + 2];
    const vx = position[c * 3] - position[a * 3];
    const vy = position[c * 3 + 1] - position[a * 3 + 1];
    const vz = position[c * 3 + 2] - position[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) {
      normal[q * 3] += nx;
      normal[q * 3 + 1] += ny;
      normal[q * 3 + 2] += nz;
    }
  }
  if (closed)
    for (let j = 0; j < m; j++) {
      const a = j;
      const b = (n - 1) * m + j;
      void a;
      void b;
    }
  for (let i = 0; i < nv; i++) {
    const l = Math.hypot(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]) || 1;
    normal[i * 3] /= l;
    normal[i * 3 + 1] /= l;
    normal[i * 3 + 2] /= l;
  }
  return { key, material, position, normal, index, uv, uv1 };
}

const rowsFromEdge = (g: Grid, cm: number, cmLong: number) => g.rows - (cm / cmLong) * g.rows;

export function buildGarment(style: GarmentStyle, buf: ArrayBuffer, s: 1 | 2): Build {
  const pt = draftPattern(style);
  const grids = readGrids(buf, pt, s);
  computeNormals(grids);
  const [front, back, sleeveL, sleeveR] = grids;
  const details: Part[] = [];
  const ns = pt.ns * s;
  const nk = pt.nk * s;
  const ra = pt.ra * s;
  const nc = front.cols;
  const nr = front.rows;

  /** samples along constant row (or column) */
  const row = (g: Grid, j: number, c0 = 0, c1 = g.cols, step = 1) => {
    const out: { p: V3; n: V3 }[] = [];
    for (let c = c0; c <= c1 + 1e-6; c += step) out.push(sample(g, c, j));
    return out;
  };
  const col = (g: Grid, c: number, j0: number, j1: number, step = 1) => {
    const out: { p: V3; n: V3 }[] = [];
    for (let j = j0; j <= j1 + 1e-6; j += step) out.push(sample(g, c, j));
    return out;
  };

  // twin-needle hems and cuffs
  const hemCm = pt.m.len - pt.m.ad;
  const hemRow = (d: number, g: Grid) => rowsFromEdge(g, d, hemCm * (g.rows / (pt.rs * s)));
  for (const [g, name] of [
    [front, 'F'],
    [back, 'B'],
  ] as [Grid, string][]) {
    for (const d of [2.1, 2.7]) details.push(ribbon(`hem${name}${d}`, 'stitch', row(g, hemRow(d, g)), 0.17, 0.3, 0.03));
    details.push(ribbon(`hemCrease${name}`, 'crease', row(g, hemRow(2.4, g)), 0.9, 1, 0.02));
  }
  for (const [g, name] of [
    [sleeveL, 'L'],
    [sleeveR, 'R'],
  ] as [Grid, string][]) {
    const cuffRow = (d: number) => rowsFromEdge(g, d, pt.m.sll);
    for (const d of [2, 2.6]) details.push(ribbon(`cuff${name}${d}`, 'stitch', row(g, cuffRow(d)), 0.17, 0.3, 0.03));
    details.push(ribbon(`cuffCrease${name}`, 'crease', row(g, cuffRow(2.3)), 0.9, 1, 0.02));
    // armhole seam, with a single row of topstitching on the body side
    details.push(ribbon(`arm${name}`, 'crease', row(g, 0), 0.7, 1, 0.02));
    details.push(ribbon(`armStitch${name}`, 'stitch', row(g, 0.55 * s), 0.15, 0.3, 0.03));
    // sleeve underarm seam
    details.push(ribbon(`under${name}`, 'crease', col(g, 0, 0, g.rows), 0.6, 1, 0.02));
  }
  // side seams and shoulder seams
  details.push(ribbon('sideR', 'crease', col(front, 0, ra, nr), 0.7, 1, 0.02));
  details.push(ribbon('sideL', 'crease', col(front, nc, ra, nr), 0.7, 1, 0.02));
  details.push(ribbon('shoulderR', 'crease', row(front, 0, 0, ns), 0.6, 1, 0.02));
  details.push(ribbon('shoulderL', 'crease', row(front, 0, nc - ns, nc), 0.6, 1, 0.02));
  // neck: seam against the rib, and topstitching just below it
  const neckF = row(front, 0, ns, ns + nk);
  const neckB = row(back, 0, ns, ns + nk);
  details.push(ribbon('neckCreaseF', 'crease', neckF, 0.6, 1, 0.02));
  details.push(ribbon('neckCreaseB', 'crease', neckB, 0.6, 1, 0.02));
  const stitchNeck = 0.55 * s;
  details.push(ribbon('neckStitchF', 'stitch', row(front, stitchNeck, ns, ns + nk), 0.15, 0.3, 0.03));
  details.push(ribbon('neckStitchB', 'stitch', row(back, stitchNeck, ns, ns + nk), 0.15, 0.3, 0.03));

  // open edges have real thickness: the cloth turns inward at the hem and cuffs
  const turnUp = (key: string, line: { p: V3; n: V3 }[], up: { p: V3; n: V3 }[]) => {
    const rings: V3[][] = line.map((e, i) => {
      const u = up[i].p;
      const n = e.n;
      const t = 0.11;
      return [
        [e.p[0], e.p[1], e.p[2]],
        [e.p[0] - n[0] * t * 0.5, e.p[1] - n[1] * t * 0.5 - 0.05, e.p[2] - n[2] * t * 0.5],
        [e.p[0] - n[0] * t, e.p[1] - n[1] * t, e.p[2] - n[2] * t],
        [u[0] - n[0] * t, u[1] - n[1] * t, u[2] - n[2] * t],
      ];
    });
    let arc = 0;
    const arcs = line.map((e, i) => {
      if (i) arc += Math.hypot(e.p[0] - line[i - 1].p[0], e.p[1] - line[i - 1].p[1], e.p[2] - line[i - 1].p[2]);
      return arc;
    });
    details.push(loft(key, 'trim', rings, arcs, [0, 0.1, 0.2, 2.4], false));
  };
  for (const [g, name] of [
    [front, 'F'],
    [back, 'B'],
  ] as [Grid, string][])
    turnUp(`hemIn${name}`, row(g, g.rows), row(g, hemRow(2.4, g)));
  for (const [g, name] of [
    [sleeveL, 'L'],
    [sleeveR, 'R'],
  ] as [Grid, string][])
    turnUp(`cuffIn${name}`, row(g, g.rows), row(g, rowsFromEdge(g, 2.3, pt.m.sll)));

  buildNeck(style, pt, details, neckF, neckB, front, s);

  const pick = 1 as const;
  const size = measure(grids);
  const coarse = pick && s === 1 ? null : readGrids(buf, pt, 1);
  if (coarse) computeNormals(coarse);
  const pickGrids = coarse ?? grids;

  const bw = pt.m.bw;
  const off = (768 - bw * PX_PER_CM) / 2;
  const capTop = pt.capHeight + 1;
  const outline = (x0: number, wPx: number): [number, number][] => [
    [x0 - 4, 0],
    [x0 + wPx + 4, 0],
    [x0 + wPx + 4, (capTop + pt.m.sll + 1) * PX_PER_CM],
    [x0 - 4, (capTop + pt.m.sll + 1) * PX_PER_CM],
  ];
  const wPx = bw * PX_PER_CM;
  return {
    front: buildSide('front', grids, pt, s, 'front'),
    back: buildSide('back', grids, pt, s, 'back'),
    pickFront: buildSide('front', pickGrids, pt, 1, 'pickFront'),
    pickBack: buildSide('back', pickGrids, pt, 1, 'pickBack'),
    details,
    zones: {
      front: { sleeveR: outline(off, wPx), sleeveL: outline(768 + off, wPx) },
      back: { sleeveL: outline(off, wPx), sleeveR: outline(768 + off, wPx) },
    },
    size,
  };
}

function measure(grids: Grid[]) {
  let maxX = 0;
  let maxZ = 0;
  let minY = 1e9;
  let maxY = -1e9;
  for (const g of grids)
    for (let i = 0; i < g.p.length; i += 3) {
      maxX = Math.max(maxX, Math.abs(g.p[i]));
      maxZ = Math.max(maxZ, Math.abs(g.p[i + 2]));
      minY = Math.min(minY, g.p[i + 1]);
      maxY = Math.max(maxY, g.p[i + 1]);
    }
  return { width: maxX * 2 * UNIT, height: (maxY - minY) * UNIT, depth: maxZ * 2 * UNIT, centreY: toY((maxY + minY) / 2) };
}

/** Rib collar, polo collar, placket and buttons, all sewn to the draped neckline. */
function buildNeck(style: GarmentStyle, pt: Pattern, details: Part[], neckF: { p: V3; n: V3 }[], neckB: { p: V3; n: V3 }[], front: Grid, s: number) {
  const ring: { p: V3; n: V3 }[] = [...neckF, ...neckB.slice(1, -1).reverse()];
  let cx = 0;
  let cz = 0;
  for (const r of ring) {
    cx += r.p[0];
    cz += r.p[2];
  }
  cx /= ring.length;
  cz /= ring.length;
  let arc = 0;
  const arcs = ring.map((r, i) => {
    if (i) {
      const q = ring[i - 1].p;
      arc += Math.hypot(r.p[0] - q[0], r.p[1] - q[1], r.p[2] - q[2]);
    }
    return arc;
  });
  const radial = (p: V3): V3 => {
    const x = p[0] - cx;
    const z = p[2] - cz;
    const l = Math.hypot(x, z) || 1;
    return [x / l, 0, z / l];
  };
  const isPolo = style.neck === 'polo';
  // rib: outer face, rounded fold at the top, inner face back down to the seam
  const h = style.neck === 'vneck' ? 1.7 : isPolo ? 1.2 : 2.1;
  const rib = [
    [0.04, 0],
    [0.09, h * 0.35],
    [0.06, h * 0.8],
    [-0.02, h],
    [-0.14, h + 0.05],
    [-0.27, h * 0.96],
    [-0.3, h * 0.5],
    [-0.26, 0],
  ];
  const rings: V3[][] = ring.map((r) => {
    const o = radial(r.p);
    // the band leans in toward the neck, more at the back where it stands tall
    const lean = 0.34;
    return rib.map(([off, up]) => [r.p[0] + o[0] * (off - lean * up), r.p[1] + up, r.p[2] + o[2] * (off - lean * up)] as V3);
  });
  rings.push(rings[0]);
  const ribProfile = rib.map((_, j) => j * (h / 3));
  details.push(loft('rib', 'rib', rings, [...arcs, arc], ribProfile, false));

  if (style.neck !== 'polo' && style.neck !== 'henley') return;

  // placket: a strip stitched down the centre front
  const midC = front.cols / 2;
  const len = (isPolo ? 13 : 15) * s;
  const halfW = 1.6;
  const stripRows: V3[][] = [];
  const stripArc: number[] = [];
  const stripEdgeL: { p: V3; n: V3 }[] = [];
  const stripEdgeR: { p: V3; n: V3 }[] = [];
  const cmPerCol = (front.flat[(front.cols / 2 + 1) * 2] - front.flat[(front.cols / 2) * 2]) || 0.5;
  const colOff = halfW / Math.abs(cmPerCol);
  const rowsPerCm = 1;
  for (let j = 0; j <= len; j += rowsPerCm) {
    const sL = sample(front, midC - colOff, j);
    const sC = sample(front, midC, j);
    const sR = sample(front, midC + colOff, j);
    const lift = 0.09;
    const point = (q: { p: V3; n: V3 }, d: number): V3 => [q.p[0] + q.n[0] * d, q.p[1] + q.n[1] * d, q.p[2] + q.n[2] * d];
    stripRows.push([point(sL, 0.01), point(sL, lift), point(sC, lift + 0.02), point(sR, lift), point(sR, 0.01)]);
    stripArc.push(sC.p[1]);
    stripEdgeL.push({ p: point(sample(front, midC - colOff * 0.82, j), lift), n: sC.n });
    stripEdgeR.push({ p: point(sample(front, midC + colOff * 0.82, j), lift), n: sC.n });
  }
  details.push(loft('placket', 'trim', stripRows, stripArc, [0, 0.8, 1.6, 2.4, 3.2], false));
  details.push(ribbon('placketL', 'stitch', stripEdgeL, 0.15, 0.3, 0.04));
  details.push(ribbon('placketR', 'stitch', stripEdgeR, 0.15, 0.3, 0.04));

  // buttons with four sewing holes
  const spots = isPolo ? [3.2, 8.6] : [3.5, 8, 12.5];
  spots.forEach((cm, k) => {
    const q = sample(front, midC, cm * s);
    details.push(...button(`btn${k}`, q));
  });

  if (!isPolo) return;
  // fold-over collar: leaves that lie on the shoulders, open at the front
  // stand, fold, then the fall lying close over the stand and onto the shoulders
  const prof: [number, number][] = [
    [0, 0.3],
    [-0.35, 1.8],
    [-0.2, 2.5],
    [0.35, 2.75],
    [1.05, 2.25],
    [1.75, 0.9],
    [2.3, -0.7],
    [2.6, -1.8],
  ];
  const profLen = [0, 1.5, 2.2, 2.8, 3.7, 5.3, 7.2, 8.4];
  const leaf: V3[][] = [];
  const leafArc: number[] = [];
  const n = ring.length;
  // the ring starts at the left of the front neckline; skip the centre opening
  const gap = Math.round(pt.nk * s * 0.06);
  const startAt = Math.floor(neckF.length / 2) + gap;
  const count = n - 2 * gap;
  for (let k = 0; k <= count; k++) {
    const r = ring[(startAt + k) % n];
    const o = radial(r.p);
    const t = k / count;
    // collar points flare forward and down at each end
    const endT = Math.min(t, 1 - t);
    const pointy = Math.pow(Math.max(0, 1 - endT / 0.1), 2);
    leaf.push(
      prof.map(([off, up], j) => {
        const f = j / (prof.length - 1);
        const stretch = 1 + pointy * 0.35 * f;
        return [r.p[0] + o[0] * off * stretch, r.p[1] + up - pointy * 1.6 * f, r.p[2] + o[2] * off * stretch + pointy * 0.4 * f] as V3;
      }),
    );
    leafArc.push((k / count) * arc);
  }
  details.push(loft('collar', 'rib', leaf, leafArc, profLen, false));
}

function button(key: string, q: { p: V3; n: V3 }): Part[] {
  const R = 0.55;
  const seg = 20;
  const prof = [
    [0, 0.26],
    [R * 0.55, 0.2],
    [R * 0.72, 0.25],
    [R * 0.96, 0.25],
    [R, 0.14],
    [R * 0.96, 0.02],
  ];
  const [nx, ny, nz] = q.n;
  const ax = Math.abs(ny) < 0.9 ? 0 : 1;
  const ay = ax ? 0 : 1;
  let ux = ay * nz;
  let uy = -ax * nz;
  let uz = ax * ny - ay * nx;
  const l = Math.hypot(ux, uy, uz) || 1;
  ux /= l;
  uy /= l;
  uz /= l;
  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;
  const lift = 0.12;
  const at = (r: number, a: number, h: number): V3 => [
    q.p[0] + ux * Math.cos(a) * r + vx * Math.sin(a) * r + nx * (h + lift),
    q.p[1] + uy * Math.cos(a) * r + vy * Math.sin(a) * r + ny * (h + lift),
    q.p[2] + uz * Math.cos(a) * r + vz * Math.sin(a) * r + nz * (h + lift),
  ];
  const rings: V3[][] = [];
  for (let i = 0; i <= seg; i++) rings.push(prof.map(([r, h]) => at(r, (i / seg) * Math.PI * 2, h)));
  const body = loft(key, 'button', rings, rings.map((_, i) => i), prof.map((_, i) => i), false);
  // sewing holes as small dark discs just above the button's dish
  const holes: Part[] = [];
  const hr: V3[][] = [];
  const positions: number[] = [];
  const idx: number[] = [];
  const normals: number[] = [];
  [0, 1, 2, 3].forEach((k) => {
    const a0 = Math.PI / 4 + (k * Math.PI) / 2;
    const c = at(R * 0.24, a0, 0.215);
    const start = positions.length / 3;
    positions.push(toX(c[0]), toY(c[1]), toZ(c[2]));
    normals.push(nx, ny, nz);
    for (let i = 0; i <= 8; i++) {
      const b = (i / 8) * Math.PI * 2;
      const rr = 0.065;
      positions.push(toX(c[0] + (ux * Math.cos(b) + vx * Math.sin(b)) * rr), toY(c[1] + (uy * Math.cos(b) + vy * Math.sin(b)) * rr), toZ(c[2] + (uz * Math.cos(b) + vz * Math.sin(b)) * rr));
      normals.push(nx, ny, nz);
      if (i < 8) idx.push(start, start + i + 1, start + i + 2);
    }
  });
  void hr;
  holes.push({ key: `${key}h`, material: 'hole', position: new Float32Array(positions), normal: new Float32Array(normals), index: new Uint32Array(idx), uv: new Float32Array((positions.length / 3) * 2) });
  return [body, ...holes];
}

export { gridIndex };

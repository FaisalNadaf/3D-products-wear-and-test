/**
 * Garment patterns, in centimetres, the way a pattern maker drafts them:
 * flat front, back and sleeve panels as structured grids (Coons patches), so
 * seams can be sewn vertex to vertex. x = wearer-facing horizontal, y = up,
 * y = 0 at the high point of the shoulder.
 */
export type Fit = 'regular' | 'oversized' | 'slim';
export type SleeveLen = 'half' | 'full';
export type Neck = 'round' | 'vneck' | 'scoop' | 'polo' | 'henley';

export interface GarmentStyle {
  fit: Fit;
  sleeve: SleeveLen;
  neck: Neck;
}

type P = [number, number];

export interface Panel {
  name: 'front' | 'back' | 'sleeveL' | 'sleeveR';
  nc: number;
  nr: number;
  /** (nc+1)*(nr+1) pattern points */
  pts: P[];
}

export interface Pattern {
  front: Panel;
  back: Panel;
  sleeveL: Panel;
  sleeveR: Panel;
  ns: number;
  nk: number;
  ra: number;
  rs: number;
  sc: number;
  sr: number;
  m: Measurements;
  capHeight: number;
}

export interface Measurements {
  /** half flat chest width */
  cw: number;
  /** half shoulder width */
  sw: number;
  /** shoulder drop */
  sl: number;
  /** armhole depth from the high shoulder point */
  ad: number;
  /** body length from the high shoulder point */
  len: number;
  /** half hem width */
  hw: number;
  /** half sleeve width at the underarm */
  bw: number;
  /** half sleeve width at the cuff */
  cuff: number;
  /** sleeve length below the cap */
  sll: number;
  /** half neck width */
  nw: number;
  /** front and back neck depth */
  nf: number;
  nb: number;
}

const FIT: Record<Fit, Omit<Measurements, 'nw' | 'nf' | 'nb' | 'sll' | 'cuff'> & { half: number; full: number; cuffH: number; cuffF: number }> = {
  regular: { cw: 26.5, sw: 22.5, sl: 4.2, ad: 25, len: 72, hw: 27, bw: 20, half: 20, full: 60, cuffH: 18.5, cuffF: 10.5 },
  oversized: { cw: 32.5, sw: 31, sl: 5, ad: 30, len: 72, hw: 33, bw: 24, half: 23, full: 57, cuffH: 22, cuffF: 11.5 },
  slim: { cw: 24, sw: 21, sl: 4.2, ad: 23.5, len: 70, hw: 24, bw: 17.5, half: 18, full: 61, cuffH: 16.5, cuffF: 9.5 },
};

const NECK: Record<Neck, { nw: number; nf: number; nb: number }> = {
  round: { nw: 9.2, nf: 9.5, nb: 2.2 },
  vneck: { nw: 9.2, nf: 20, nb: 2.2 },
  scoop: { nw: 11.5, nf: 15, nb: 2.2 },
  polo: { nw: 8.6, nf: 5.5, nb: 2 },
  henley: { nw: 9, nf: 8.5, nb: 2.2 },
};

/** Resamples a polyline to n+1 points, uniformly by arc length. */
function resample(line: P[], n: number): P[] {
  const d = [0];
  for (let i = 1; i < line.length; i++) d.push(d[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
  const total = d[d.length - 1];
  const out: P[] = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * total;
    while (k < d.length - 2 && d[k + 1] < t) k++;
    const f = (t - d[k]) / Math.max(1e-9, d[k + 1] - d[k]);
    out.push([line[k][0] + (line[k + 1][0] - line[k][0]) * f, line[k][1] + (line[k + 1][1] - line[k][1]) * f]);
  }
  return out;
}

const arc = (line: P[]) => line.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - line[i][0], p[1] - line[i][1]), 0);

/** Coons patch through four boundary polylines. */
function coons(top: P[], bottom: P[], left: P[], right: P[]): P[] {
  const nc = top.length - 1;
  const nr = left.length - 1;
  const pts: P[] = [];
  for (let j = 0; j <= nr; j++) {
    const v = j / nr;
    for (let i = 0; i <= nc; i++) {
      const u = i / nc;
      const f = (a: number) =>
        (1 - v) * top[i][a] + v * bottom[i][a] + (1 - u) * left[j][a] + u * right[j][a] -
        ((1 - u) * (1 - v) * top[0][a] + u * (1 - v) * top[nc][a] + (1 - u) * v * bottom[0][a] + u * v * bottom[nc][a]);
      pts.push([f(0), f(1)]);
    }
  }
  return pts;
}

function neckShape(neck: Neck, t: number) {
  const q = Math.max(0, 1 - t * t);
  if (neck === 'vneck') return 1 - Math.abs(t);
  if (neck === 'scoop') return Math.pow(q, 0.55);
  return Math.pow(q, 0.72);
}

export function draftPattern(style: GarmentStyle): Pattern {
  const f = FIT[style.fit];
  const k = NECK[style.neck];
  const m: Measurements = {
    cw: f.cw, sw: f.sw, sl: f.sl, ad: f.ad, len: f.len, hw: f.hw, bw: f.bw,
    sll: style.sleeve === 'half' ? f.half : f.full,
    cuff: style.sleeve === 'half' ? f.cuffH : f.cuffF,
    nw: k.nw, nf: k.nf, nb: k.nb,
  };
  const ns = 19;
  const nk = 26;
  const nc = 2 * ns + nk;
  const ra = 26;
  const rs = 48;
  const nr = ra + rs;

  const armhole = (side: 1 | -1): P[] => {
    const line: P[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      // scoops toward the body below the shoulder point, then meets the side seam
      const x = m.sw + (m.cw - m.sw) * Math.pow(t, 3) - 2.4 * Math.sin(t * Math.PI) * (style.fit === 'oversized' ? 0.5 : 1);
      line.push([side * x, -m.sl - (m.ad - m.sl) * t]);
    }
    return line;
  };
  const sideSeam = (side: 1 | -1): P[] => [
    [side * m.cw, -m.ad],
    [side * m.hw, -m.len],
  ];
  const makeBody = (name: 'front' | 'back', depth: number): Panel => {
    const leftShoulder = resample([[-m.sw, -m.sl], [-m.nw, 0]], ns);
    const rightShoulder = resample([[m.nw, 0], [m.sw, -m.sl]], ns);
    const neckLine: P[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = -1 + i / 40;
      neckLine.push([t * m.nw, -depth * neckShape(name === 'front' ? style.neck : 'round', t)]);
    }
    const neck = resample(neckLine, nk);
    const top = [...leftShoulder, ...neck.slice(1), ...rightShoulder.slice(1)];
    // a gently curved hem, as cut
    const bottom = resample(Array.from({ length: 41 }, (_, i): P => {
      const t = -1 + i / 20;
      return [t * m.hw, -m.len - 0.6 * (1 - t * t)];
    }), nc);
    const side = (s: 1 | -1) => [...resample(armhole(s), ra), ...resample(sideSeam(s), rs).slice(1)];
    return { name, nc, nr, pts: coons(top, bottom, side(-1), side(1)) };
  };
  const front = makeBody('front', m.nf);
  const back = makeBody('back', m.nb);

  // sleeve: cap length is solved to match the armhole it is sewn to
  const armLen = arc(armhole(1));
  let lo = 0.5;
  let hi = 40;
  const capLine = (h: number): P[] =>
    Array.from({ length: 81 }, (_, i): P => {
      const t = i / 80;
      return [(-1 + 2 * t) * m.bw, h * Math.pow(Math.sin(t * Math.PI), 1.2)];
    });
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (arc(capLine(mid)) < armLen * 2) lo = mid;
    else hi = mid;
  }
  const H = (lo + hi) / 2;
  const sc = 2 * ra;
  // constant topology across every style, so the garment can morph between them
  const sr = 40;
  const makeSleeve = (name: 'sleeveL' | 'sleeveR'): Panel => {
    const top = resample(capLine(H), sc);
    const bottom = resample([[-m.cuff, -m.sll], [m.cuff, -m.sll]], sc);
    const left = resample([[-m.bw, 0], [-m.cuff, -m.sll]], sr);
    const right = resample([[m.bw, 0], [m.cuff, -m.sll]], sr);
    return { name, nc: sc, nr: sr, pts: coons(top, bottom, left, right) };
  };
  return { front, back, sleeveL: makeSleeve('sleeveL'), sleeveR: makeSleeve('sleeveR'), ns, nk, ra, rs, sc, sr, m, capHeight: H };
}

export const gridIndex = (p: Panel, i: number, j: number) => j * (p.nc + 1) + i;

/** Pairs of (panel, i, j) that are sewn together. Each entry is a list of matching grid points. */
export function seams(pt: Pattern) {
  const { front, back, sleeveL, sleeveR, ns, nk, ra, rs, sc, sr } = pt;
  const nc = front.nc;
  type Ref = [Panel, number, number];
  const out: Ref[][] = [];
  // shoulders
  const sh1: Ref[] = [];
  const sh1b: Ref[] = [];
  const sh2: Ref[] = [];
  const sh2b: Ref[] = [];
  for (let i = 0; i <= ns; i++) {
    sh1.push([front, i, 0]);
    sh1b.push([back, i, 0]);
    sh2.push([front, nc - i, 0]);
    sh2b.push([back, nc - i, 0]);
  }
  out.push(sh1, sh1b, sh2, sh2b);
  // side seams
  const nr = ra + rs;
  for (const col of [0, nc]) {
    const a: Ref[] = [];
    const b: Ref[] = [];
    for (let j = ra; j <= nr; j++) {
      a.push([front, col, j]);
      b.push([back, col, j]);
    }
    out.push(a, b);
  }
  // sleeve caps into armholes: c = 0 underarm (front) → ra tip → 2ra underarm (back)
  for (const [sl, col] of [
    [sleeveR, 0],
    [sleeveL, nc],
  ] as [Panel, number][]) {
    const a: Ref[] = [];
    const b: Ref[] = [];
    for (let c = 0; c <= sc; c++) {
      a.push([sl, c, 0]);
      b.push(c <= ra ? [front, col, ra - c] : [back, col, c - ra]);
    }
    out.push(a, b);
    // underarm seam of the sleeve
    const u0: Ref[] = [];
    const u1: Ref[] = [];
    for (let j = 0; j <= sr; j++) {
      u0.push([sl, 0, j]);
      u1.push([sl, sc, j]);
    }
    out.push(u0, u1);
  }
  void nk;
  return out; // consecutive pairs: out[2k] ↔ out[2k+1]
}

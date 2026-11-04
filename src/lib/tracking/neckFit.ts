import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Measures the wearer's real neck from the image, on the device.
 *
 * Each person's own skin tone is sampled from their cheeks and chin, then the
 * rows below the chin are scanned: the skin run through the neck gives its true
 * width and centre, and where that run ends (a crew collar) or flares out (an
 * open neckline into the shoulders) gives the height a necklace actually rests
 * at. Chroma is used rather than brightness so the shadow under the chin does
 * not read as the end of the neck.
 */
export interface NeckMeasure {
  /** neck centre at its base, normalised image x */
  cx: number;
  /** resting height of a necklace (collar / base of the neck), normalised image y */
  baseY: number;
  /** half the neck width, as a fraction of image width */
  halfW: number;
  /** how the base was found */
  base: 'collar' | 'open';
  /** 0..1 */
  confidence: number;
}

const W = 112;
const SEEDS = [205, 425, 187, 411, 200, 175, 199, 214, 434];

export class NeckSolver {
  private canvas = Object.assign(document.createElement('canvas'), { width: W, height: 96 });
  private ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

  measure(source: CanvasImageSource, srcW: number, srcH: number, lms: NormalizedLandmark[]): NeckMeasure | null {
    const chin = lms[152];
    const top = lms[10];
    const a = lms[234];
    const b = lms[454];
    const nose = lms[1];
    if (!chin || !top || !a || !b || !nose) return null;
    // everything below is in image-height units so it is aspect-independent
    const asp = srcW / srcH;
    const faceW = Math.hypot((a.x - b.x) * asp, a.y - b.y);
    const faceH = Math.hypot((top.x - chin.x) * asp, top.y - chin.y);
    if (faceW < 0.04 || faceH < 0.05) return null;

    // region: from the nose (so cheeks are available as skin seeds) to the upper chest
    const halfX = (faceW * 1.05) / asp;
    const x0 = Math.max(0, chin.x - halfX);
    const x1 = Math.min(1, chin.x + halfX);
    const y0 = Math.max(0, nose.y);
    const y1 = Math.min(1, chin.y + faceH * 0.95);
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02 || chin.y > 0.985) return null;
    const pxW = (x1 - x0) * srcW;
    const pxH = (y1 - y0) * srcH;
    const H = Math.max(24, Math.min(160, Math.round((W * pxH) / pxW)));
    if (this.canvas.height !== H) this.canvas.height = H;
    this.ctx.drawImage(source, x0 * srcW, y0 * srcH, pxW, pxH, 0, 0, W, H);
    const d = this.ctx.getImageData(0, 0, W, H).data;

    const toCol = (x: number) => Math.round(((x - x0) / (x1 - x0)) * (W - 1));
    const toRow = (y: number) => Math.round(((y - y0) / (y1 - y0)) * (H - 1));
    const chroma = (i: number): [number, number, number] => {
      const r = d[i];
      const g = d[i + 1];
      const bl = d[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * bl;
      return [Y, -0.169 * r - 0.331 * g + 0.5 * bl, 0.5 * r - 0.419 * g - 0.081 * bl];
    };

    // this person's skin: median chroma from around the lower face
    const ys: number[] = [];
    const cbs: number[] = [];
    const crs: number[] = [];
    for (const k of SEEDS) {
      const lm = lms[k];
      if (!lm) continue;
      const cx = toCol(lm.x);
      const cy = toRow(lm.y);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const [Y, cb, cr] = chroma((py * W + px) * 4);
          ys.push(Y);
          cbs.push(cb);
          crs.push(cr);
        }
    }
    if (cbs.length < 12) return null;
    const med = (v: number[]) => [...v].sort((p, q) => p - q)[v.length >> 1];
    const mY = med(ys);
    const mCb = med(cbs);
    const mCr = med(crs);
    const spread = (v: number[], m: number) => med(v.map((x) => Math.abs(x - m))) * 1.48;
    const sCb = Math.max(3.5, spread(cbs, mCb));
    const sCr = Math.max(3.5, spread(crs, mCr));

    const skin = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const [Y, cb, cr] = chroma(i * 4);
      const m = Math.hypot((cb - mCb) / sCb, (cr - mCr) / sCr);
      if (m < 2.8 && Y > mY * 0.22 && Y < Math.min(255, mY * 1.75)) skin[i] = 1;
    }

    // scan down from the chin following the run of skin through the neck
    const rowStart = Math.max(1, toRow(chin.y + faceH * 0.03));
    const rows: { y: number; l: number; r: number; w: number }[] = [];
    let centre = toCol(chin.x);
    let misses = 0;
    let collarRow = -1;
    const pxPerH = (H - 1) / (y1 - y0); // analysis rows per image-height unit
    const colsPerH = ((W - 1) / (x1 - x0)) / asp; // analysis columns per image-height unit
    for (let y = rowStart; y < H; y++) {
      const at = (x: number) => x >= 0 && x < W && skin[y * W + x] === 1;
      let c = centre;
      if (!at(c)) {
        // the centre may be a highlight or a chain of hair: look nearby first
        let found = -1;
        const reach = Math.round(faceW * colsPerH * 0.12);
        for (let o = 1; o <= reach && found < 0; o++) {
          if (at(c - o)) found = c - o;
          else if (at(c + o)) found = c + o;
        }
        if (found < 0) {
          misses++;
          if (misses >= 3) {
            collarRow = y - misses;
            break;
          }
          continue;
        }
        c = found;
      }
      misses = 0;
      let l = c;
      let r = c;
      const grow = (dir: -1 | 1, from: number) => {
        let x = from;
        let gap = 0;
        for (;;) {
          const n = x + dir * (gap + 1);
          if (n < 0 || n >= W) return x;
          if (at(n)) {
            x = n;
            gap = 0;
          } else if (++gap > 1) return x;
        }
      };
      l = grow(-1, l);
      r = grow(1, r);
      rows.push({ y, l, r, w: r - l + 1 });
      centre = Math.round(centre * 0.7 + ((l + r) / 2) * 0.3);
    }
    if (rows.length < 4) return null;

    // width: the narrow part of the run, ignoring the jaw above and shoulders below
    const faceCols = faceW * colsPerH;
    const narrow = rows.slice(0, Math.max(4, Math.round(rows.length * 0.6))).map((r) => r.w).sort((p, q) => p - q);
    const neckCols = narrow[Math.floor(narrow.length * 0.25)];
    const ratio = neckCols / faceCols;
    if (ratio < 0.42 || ratio > 1.08) return null;

    // base: the run flaring into the shoulders, unless a collar ended it first
    let flareRow = -1;
    for (let i = 2; i < rows.length - 1; i++) {
      if (rows[i].w > neckCols * 1.34 && rows[i + 1].w > neckCols * 1.34 && rows[i].y - rowStart > faceH * pxPerH * 0.12) {
        flareRow = rows[i].y;
        break;
      }
    }
    const lastRow = rows[rows.length - 1].y;
    const chinRow = toRow(chin.y);
    let baseRow: number;
    let base: NeckMeasure['base'];
    if (flareRow >= 0 && (collarRow < 0 || flareRow < collarRow)) {
      // the sternal notch sits below where the trapezius starts to flare
      baseRow = flareRow + neckCols * ((H - 1) / (y1 - y0) / colsPerH) * 0.42;
      base = 'open';
    } else if (collarRow >= 0) {
      baseRow = collarRow;
      base = 'collar';
    } else if (lastRow >= H - 2) {
      return null; // the frame ends before the neck does
    } else {
      baseRow = lastRow;
      base = 'collar';
    }
    const baseDrop = ((baseRow - chinRow) / pxPerH) / faceH;
    if (baseDrop < 0.24 || baseDrop > 0.95) return null;

    const near = rows.filter((r) => r.y <= baseRow && r.y > baseRow - (faceH * pxPerH) * 0.22 && r.w < neckCols * 1.3);
    if (near.length < 2) return null;
    const midCol = near.reduce((s, r) => s + (r.l + r.r) / 2, 0) / near.length;
    // the neck is under the chin: a centre far from it means the skin match went wrong (coloured light, a skin-toned top)
    if (Math.abs(midCol - toCol(chin.x)) > faceCols * 0.36) return null;
    const steadiness = 1 - Math.min(1, near.reduce((s, r) => s + Math.abs((r.l + r.r) / 2 - midCol), 0) / near.length / (neckCols * 0.25));
    return {
      cx: x0 + (midCol / (W - 1)) * (x1 - x0),
      baseY: y0 + (baseRow / (H - 1)) * (y1 - y0),
      halfW: ((neckCols / 2) / (W - 1)) * (x1 - x0),
      base,
      confidence: 0.4 + 0.6 * steadiness,
    };
  }
}

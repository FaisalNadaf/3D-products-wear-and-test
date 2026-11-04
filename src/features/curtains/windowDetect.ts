import { loadInteractiveSegmenter } from '../../lib/tracking/segmenter';

/** Window corners in normalised image coords, order: TL, TR, BR, BL. */
export type Quad = [[number, number], [number, number], [number, number], [number, number]];

/**
 * Fits a perspective quad to a binary mask: the extreme points along the two
 * diagonals give the corners of a (possibly skewed) window.
 */
function quadFromMask(mask: Uint8Array, w: number, h: number): Quad | null {
  let tl = Infinity, tr = -Infinity, br = -Infinity, bl = Infinity;
  let TL: [number, number] = [0, 0], TR: [number, number] = [0, 0], BR: [number, number] = [0, 0], BL: [number, number] = [0, 0];
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      n++;
      const s = x + y;
      const d = x - y;
      if (s < tl) [tl, TL] = [s, [x, y]];
      if (s > br) [br, BR] = [s, [x, y]];
      if (d > tr) [tr, TR] = [d, [x, y]];
      if (d < bl) [bl, BL] = [d, [x, y]];
    }
  if (n < w * h * 0.01) return null;
  const nrm = (p: [number, number]): [number, number] => [p[0] / w, p[1] / h];
  // trust the diagonal-extreme corners only when they form a clean window
  // (near-level top/bottom, near-vertical sides); otherwise use the bounding box
  const slope = (a: [number, number], b: [number, number]) => Math.abs((b[1] - a[1]) / Math.max(1, b[0] - a[0]));
  const lean = (a: [number, number], b: [number, number]) => Math.abs((b[0] - a[0]) / Math.max(1, b[1] - a[1]));
  const clean = slope(TL, TR) < 0.18 && slope(BL, BR) < 0.18 && lean(TL, BL) < 0.2 && lean(TR, BR) < 0.2;
  if (!clean) {
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (mask[y * w + x]) {
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    return [nrm([minX, minY]), nrm([maxX + 1, minY]), nrm([maxX + 1, maxY + 1]), nrm([minX, maxY + 1])];
  }
  return [nrm(TL), nrm(TR), nrm(BR), nrm(BL)];
}

/** Largest 4-connected component of a binary mask (in place), returns its size. */
function largestComponent(mask: Uint8Array, w: number, h: number, scoreFn?: (minX: number, minY: number, maxX: number, maxY: number, n: number) => number) {
  const label = new Int32Array(w * h).fill(-1);
  let best = -1;
  let bestScore = -Infinity;
  const stack: number[] = [];
  let id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] >= 0) continue;
    let n = 0, minX = w, minY = h, maxX = 0, maxY = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const x = j % w;
      const y = (j / w) | 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      for (const k of [j - 1, j + 1, j - w, j + w]) {
        if (k < 0 || k >= w * h || !mask[k] || label[k] >= 0) continue;
        if ((k === j - 1 && x === 0) || (k === j + 1 && x === w - 1)) continue;
        label[k] = id;
        stack.push(k);
      }
    }
    const score = scoreFn ? scoreFn(minX, minY, maxX, maxY, n) : n;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
    id++;
  }
  for (let i = 0; i < w * h; i++) mask[i] = label[i] === best ? 1 : 0;
  return bestScore;
}

/**
 * Automatic window finder (heuristic, instant, on-device): daylight windows
 * are the brightest large, rectangular regions in a room photo. We threshold
 * the top luminance band, close small gaps (window bars), and keep the
 * component that is large, rectangular and in the upper part of the frame.
 */
export function detectWindowAuto(img: CanvasImageSource, iw: number, ih: number): Quad | null {
  const w = 192;
  const h = Math.max(1, Math.round((w * ih) / iw));
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const l = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    lum[i] = l;
    hist[Math.min(255, l | 0)]++;
  }
  // threshold at the 88th percentile, but never below a "bright" floor
  let acc = 0;
  let th = 255;
  for (let v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc > w * h * 0.12) {
      th = v;
      break;
    }
  }
  th = Math.max(th, 150);
  let mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = lum[i] >= th ? 1 : 0;
  // morphological close (dilate then erode) to bridge glazing bars
  const morph = (m: Uint8Array, dilate: boolean, r: number) => {
    const o = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let v = dilate ? 0 : 1;
        for (let dy = -r; dy <= r && (dilate ? !v : v); dy++)
          for (let dx = -r; dx <= r; dx++) {
            const xx = Math.min(w - 1, Math.max(0, x + dx));
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            const s = m[yy * w + xx];
            if (dilate && s) { v = 1; break; }
            if (!dilate && !s) { v = 0; break; }
          }
        o[y * w + x] = v;
      }
    return o;
  };
  mask = morph(morph(mask, true, 3), false, 3);
  const score = largestComponent(mask, w, h, (minX, minY, maxX, maxY, n) => {
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const rect = n / (bw * bh);
    const area = n / (w * h);
    const centreY = (minY + maxY) / 2 / h;
    const aspect = bh / bw;
    // bright bands along the ceiling/edges are not windows
    const edges = +(minX <= 1) + +(maxX >= w - 2) + +(minY <= 1) + +(maxY >= h - 2);
    if (area < 0.012 || area > 0.6 || rect < 0.45 || centreY > 0.75) return -1;
    if (bw < w * 0.05 || bh < h * 0.08 || aspect < 0.45 || aspect > 4.5 || edges >= 2) return -1;
    const shape = Math.min(1, aspect / 0.8) * Math.min(1, 3 / aspect);
    return area * rect * shape * (edges ? 0.5 : 1) * (1.2 - centreY * 0.4);
  });
  if (score <= 0) return null;
  return quadFromMask(mask, w, h);
}

/**
 * Tap-to-select (ML): MediaPipe's interactive segmenter returns the object
 * under the tapped point; we fit a quad to that mask. Fully on-device.
 */
export async function detectWindowAt(img: HTMLCanvasElement | HTMLImageElement, x: number, y: number): Promise<{ quad: Quad | null; mask: Uint8Array; w: number; h: number }> {
  const seg = await loadInteractiveSegmenter();
  const res = seg.segment(img, { keypoint: { x, y } });
  const m = res.confidenceMasks?.[0];
  if (!m) throw new Error('No mask returned');
  const w = m.width;
  const h = m.height;
  const data = m.getAsFloat32Array();
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i] > 0.5 ? 1 : 0;
  res.close();
  largestComponent(mask, w, h);
  return { quad: quadFromMask(mask, w, h), mask, w, h };
}

/** Sensible starting quad when nothing is detected: centred upper window. */
export const defaultQuad = (): Quad => [
  [0.36, 0.2],
  [0.64, 0.2],
  [0.64, 0.6],
  [0.36, 0.6],
];

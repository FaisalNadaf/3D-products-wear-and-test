import { CanvasTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';

/**
 * Tiling knit textures, generated once per fabric from a height function: a
 * normal map for the loops of the yarn plus a detail map (R = cavity, the
 * shadow between loops; G = fleck, the colour variation in the yarn). Mipmaps
 * fade them smoothly with distance, so close-ups stay sharp and far views never
 * shimmer. One tile covers TILE_CM of cloth at 170 pixels per centimetre.
 */
export type KnitId = 'jersey' | 'heather' | 'washed' | 'pique' | 'slub' | 'rib';
export const TILE_CM = 6;
const SIZE = 1024;

export interface KnitTextures {
  normal: DataTexture;
  detail: DataTexture;
}

/** Deterministic hash, so a fabric looks the same on every load. */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Value noise that repeats every `period` cells. */
function noise(x: number, y: number, period: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period);
  return (h(xi, yi) * (1 - ux) + h(xi + 1, yi) * ux) * (1 - uy) + (h(xi, yi + 1) * (1 - ux) + h(xi + 1, yi + 1) * ux) * uy;
}

/** Plain jersey: columns of interlocked V-shaped loops. */
function jersey(u: number, v: number, wales: number, courses: number) {
  const cu = u * wales;
  const cv = v * courses;
  const row = Math.floor(cv);
  const fv = cv - row;
  // each loop leans into the next row, which gives the knit its V
  const lean = Math.abs(fv - 0.5) * 0.5;
  const fu = cu - Math.floor(cu);
  const legA = Math.exp(-Math.pow((fu - 0.25 - lean * 0.5) / 0.17, 2));
  const legB = Math.exp(-Math.pow((fu - 0.75 + lean * 0.5) / 0.17, 2));
  const yarn = 0.86 + 0.28 * hash((Math.floor(cu) % wales) + 3, (row % courses) + 7);
  return Math.max(legA, legB) * (0.72 + 0.28 * Math.cos((fv - 0.5) * Math.PI * 2) * 0.5 + 0.14) * yarn;
}

function heightAt(id: KnitId, u: number, v: number) {
  switch (id) {
    case 'rib': {
      // 1x1 rib, 2.4 mm repeat: broad raised columns with fine loops on them
      const ribs = Math.round(TILE_CM / 0.24);
      const c = 0.5 + 0.5 * Math.cos(u * ribs * Math.PI * 2);
      return Math.pow(c, 0.7) * 0.86 + 0.14 * jersey(u, v, 96, 120);
    }
    case 'pique': {
      // honeycomb cells of a polo knit, 1.6 mm repeat
      const n = Math.round(TILE_CM / 0.16);
      const a = u * n;
      const b = v * n;
      const row = Math.floor(b);
      const fa = a + (row % 2) * 0.5;
      const dx = fa - Math.floor(fa) - 0.5;
      const dy = b - row - 0.5;
      const cell = Math.max(0, 1 - Math.hypot(dx, dy * 1.05) * 2.1);
      const wall = Math.min(1, Math.hypot(dx, dy) * 2);
      return 0.72 * wall + 0.18 * (1 - cell) + 0.1 * jersey(u, v, 96, 120);
    }
    case 'slub': {
      // irregular thick-and-thin yarn running across the cloth
      const k = jersey(u, v, 88, 104);
      const band = noise(u * 7, v * 62, 62) * noise(u * 19, v * 62, 62);
      const thick = Math.max(0, band - 0.36) * 2.6;
      return k * 0.72 + thick * 0.62;
    }
    case 'washed':
      return jersey(u, v, 88, 110) * 0.8 + (noise(u * 90, v * 90, 90) - 0.5) * 0.18;
    default:
      return jersey(u, v, 96, 120) + (noise(u * 40, v * 40, 40) - 0.5) * 0.09;
  }
}

function detailAt(id: KnitId, u: number, v: number, h: number) {
  const cavity = Math.min(1, 0.62 + h * 0.5);
  let fleck = 0.5;
  if (id === 'heather') {
    // individual fibres of a darker and lighter yarn, stretched along the courses
    const f = noise(u * 120, v * 480, 480) * 0.55 + noise(u * 260, v * 600, 600) * 0.45;
    fleck = Math.min(1, Math.max(0, (f - 0.5) * 2.6 + 0.5));
  } else if (id === 'washed') {
    fleck = 0.5 + (noise(u * 60, v * 60, 60) - 0.5) * 0.5 + (noise(u * 150, v * 150, 150) - 0.5) * 0.4;
  } else if (id === 'slub') {
    fleck = 0.5 + (noise(u * 7, v * 62, 62) * noise(u * 19, v * 62, 62) - 0.25) * 1.1;
  }
  return [cavity, Math.min(1, Math.max(0, fleck))];
}

const cache = new Map<KnitId, KnitTextures>();

export function knitTextures(id: KnitId, anisotropy: number): KnitTextures {
  const hit = cache.get(id);
  if (hit) return hit;
  const heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) heights[y * SIZE + x] = heightAt(id, x / SIZE, y / SIZE);
  const normal = new Uint8Array(SIZE * SIZE * 4);
  const detail = new Uint8Array(SIZE * SIZE * 4);
  const strength = id === 'rib' ? 3.2 : 2.4;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const dx = heights[y * SIZE + ((x + 1) % SIZE)] - heights[y * SIZE + ((x + SIZE - 1) % SIZE)];
      const dy = heights[((y + 1) % SIZE) * SIZE + x] - heights[((y + SIZE - 1) % SIZE) * SIZE + x];
      const nx = -dx * strength;
      const ny = -dy * strength;
      const l = 1 / Math.hypot(nx, ny, 1);
      normal[i * 4] = (nx * l * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = (ny * l * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (l * 0.5 + 0.5) * 255;
      normal[i * 4 + 3] = 255;
      const [c, f] = detailAt(id, x / SIZE, y / SIZE, heights[i]);
      detail[i * 4] = c * 255;
      detail[i * 4 + 1] = f * 255;
      detail[i * 4 + 3] = 255;
    }
  const make = (data: Uint8Array) => {
    const t = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = anisotropy;
    t.channel = 1;
    t.needsUpdate = true;
    return t;
  };
  const out = { normal: make(normal), detail: make(detail) };
  cache.set(id, out);
  return out;
}

/**
 * Stitch tile for ribbons laid along seams. Colour is multiplied by the thread
 * colour and alpha decides coverage, so one tile serves every garment colour.
 */
export function stitchTexture(anisotropy: number) {
  const c = Object.assign(document.createElement('canvas'), { width: 128, height: 64 });
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 128, 64);
  // needle holes pull the cloth in: a soft shadow along the row
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.5, 'rgba(0,0,0,.14)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 64);
  // the thread itself, a rounded dash between two holes
  const t = x.createLinearGradient(0, 22, 0, 42);
  t.addColorStop(0, '#d6d6d6');
  t.addColorStop(0.45, '#ffffff');
  t.addColorStop(1, '#a8a8a8');
  x.fillStyle = t;
  x.beginPath();
  x.roundRect(14, 22, 100, 20, 10);
  x.fill();
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

/** A soft dark line for seams where two panels meet. */
export function creaseTexture() {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 64 });
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.4, 'rgba(0,0,0,.1)');
  g.addColorStop(0.5, 'rgba(0,0,0,.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,.1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 64);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  return tex;
}

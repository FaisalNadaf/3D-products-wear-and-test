import { CanvasTexture, Color, DoubleSide, MeshPhysicalMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { CaseMetal } from '../../config/watches';

/** Physical metal definitions (base colour is the specular F0 tint). */
export const METAL_PBR: Record<CaseMetal, { color: string; roughness: number }> = {
  steel: { color: '#d7d9dc', roughness: 0.16 },
  yellow: { color: '#f2c46c', roughness: 0.15 },
  rose: { color: '#eab39d', roughness: 0.16 },
  platinum: { color: '#e7e7e4', roughness: 0.12 },
  titanium: { color: '#aeaca6', roughness: 0.3 },
  dlc: { color: '#2a2a2e', roughness: 0.26 },
};

export const metal = (m: CaseMetal, brushed = false) => {
  const d = METAL_PBR[m];
  return new MeshPhysicalMaterial({
    color: new Color(d.color),
    metalness: 1,
    roughness: brushed ? Math.min(0.42, d.roughness + 0.16) : d.roughness,
    envMapIntensity: 1.25,
    clearcoat: brushed ? 0 : 0.35,
    clearcoatRoughness: 0.08,
  });
};

export function setMetal(mat: MeshPhysicalMaterial, m: CaseMetal, brushed = false) {
  const d = METAL_PBR[m];
  mat.color.set(d.color);
  mat.metalness = 1;
  mat.roughness = brushed ? Math.min(0.42, d.roughness + 0.16) : d.roughness;
  mat.clearcoat = brushed ? 0 : 0.35;
  mat.needsUpdate = true;
}

/** Ceramic / lacquer: glossy dielectric. Metallic hexes (gold/steel) become metal. */
export function setBezelFinish(mat: MeshPhysicalMaterial, hex: string) {
  const metallic = hex === '#c9a35a' || hex === '#d4d6da';
  mat.color.set(metallic ? (hex === '#c9a35a' ? '#f0c46c' : '#d9dbde') : hex);
  mat.metalness = metallic ? 1 : 0;
  mat.roughness = metallic ? 0.15 : 0.1;
  mat.clearcoat = 1;
  mat.clearcoatRoughness = 0.03;
  mat.needsUpdate = true;
}

export const sapphire = () =>
  new MeshPhysicalMaterial({
    color: new Color('#f7fbff'),
    metalness: 0,
    roughness: 0,
    transmission: 1,
    thickness: 1.2,
    ior: 1.77,
    iridescence: 0.25,
    iridescenceIOR: 1.38,
    iridescenceThicknessMinimum: 300,
    iridescenceThicknessMaximum: 420,
    // anti-reflective coating: reflections stay subtle so the dial reads clearly
    envMapIntensity: 0.55,
    transparent: true,
    side: DoubleSide,
  });

export const lumeMat = (hex: string) =>
  new MeshPhysicalMaterial({ color: new Color(hex).multiplyScalar(0.9), emissive: new Color(hex), emissiveIntensity: 0.35, roughness: 0.55 });

export const ruby = () =>
  new MeshPhysicalMaterial({ color: '#c0102c', metalness: 0.4, roughness: 0.05, clearcoat: 1, emissive: '#5a0612', emissiveIntensity: 0.3 });

/* ───────────────────────── canvas textures (cached per key) */

const cache = new Map<string, CanvasTexture>();
function tex(key: string, size: [number, number], draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true) {
  let t = cache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  [c.width, c.height] = size;
  draw(c.getContext('2d')!, c.width, c.height);
  t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Radial anisotropy directions for a sunray dial (RG = direction, B = strength). */
export const sunrayAnisotropy = () =>
  tex(
    'sunray-aniso',
    [512, 512],
    (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const a = Math.atan2(y - h / 2, x - w / 2) + Math.PI / 2;
          const i = (y * w + x) * 4;
          img.data[i] = (Math.cos(a) * 0.5 + 0.5) * 255;
          img.data[i + 1] = (Math.sin(a) * 0.5 + 0.5) * 255;
          img.data[i + 2] = 255;
          img.data[i + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    },
    false,
  );

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, size * Math.random() + 0.6, size * Math.random() + 0.6);
  }
}

/** Leather: pebbled grain + saddle stitching along both edges (top face = u∈[0,0.5]). */
export const leatherMaps = (hex: string) => {
  const color = tex(`leather-${hex}`, [512, 1024], (ctx, w, h) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 26000, 0.05, 3);
    ctx.strokeStyle = new Color(hex).offsetHSL(0, -0.05, 0.22).getStyle();
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]);
    for (const u of [0.07, 0.43]) {
      ctx.beginPath();
      ctx.moveTo(u * w, 0);
      ctx.lineTo(u * w, h);
      ctx.stroke();
    }
  });
  const bump = tex(
    'leather-bump',
    [512, 1024],
    (ctx, w, h) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        const r = 2 + Math.random() * 5;
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.08 + Math.random() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, r, r * (0.6 + Math.random()), Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 6;
      ctx.setLineDash([16, 12]);
      for (const u of [0.07, 0.43]) {
        ctx.beginPath();
        ctx.moveTo(u * w, 0);
        ctx.lineTo(u * w, h);
        ctx.stroke();
      }
    },
    false,
  );
  [color, bump].forEach((t) => {
    t.wrapS = t.wrapT = RepeatWrapping;
  });
  return { color, bump };
};

export const rubberBump = () => {
  const t = tex(
    'rubber-bump',
    [256, 512],
    (ctx, w, h) => {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#5a5a5a';
      for (let y = 0; y < h; y += 32) ctx.fillRect(w * 0.08, y, w * 0.34, 10);
    },
    false,
  );
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
};

export const meshBump = () => {
  const t = tex(
    'mesh-bump',
    [256, 256],
    (ctx, w, h) => {
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d8d8d8';
      ctx.lineWidth = 2.2;
      for (let y = -h; y < h * 2; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + w * 0.5);
        ctx.stroke();
      }
    },
    false,
  );
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 24);
  return t;
};

export const natoMap = (hex: string) => {
  const t = tex(`nato-${hex}`, [256, 512], (ctx, w, h) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    const accent = new Color(hex).getHSL({ h: 0, s: 0, l: 0 }).l > 0.5 ? '#2a3140' : '#d8c8a6';
    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.2, 0, w * 0.04, h);
    ctx.fillRect(w * 0.26, 0, w * 0.04, h);
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = `rgba(0,0,0,${y % 6 ? 0.06 : 0.12})`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
};

/** Côtes de Genève + perlage finish for movement plates. */
export const movementTexture = () =>
  tex('movement', [512, 512], (ctx, w, h) => {
    ctx.fillStyle = '#c7c9cc';
    ctx.fillRect(0, 0, w, h);
    for (let y = -40; y < h + 40; y += 28)
      for (let x = -40; x < w + 40; x += 28) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(120,120,125,0.2)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
  });

export const disposeTextures = () => {
  cache.forEach((t) => t.dispose());
  cache.clear();
};

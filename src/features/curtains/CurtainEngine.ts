import {
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CurtainSettings, Header, Pattern, Weave } from '../../config/curtains';
import type { Quad } from './windowDetect';

/* ───────────────────────────── perspective from the window quad */

/** Solves the 3×3 homography mapping unit-square (u,v) → points. */
function homography(dst: [number, number][]): number[] {
  const src = [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0],
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = src[i];
    const [x, y] = dst[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  // Gaussian elimination
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export interface WindowPose {
  /** window plane frame: origin = bottom-left corner, +X along width, +Y up, +Z out of the wall */
  matrix: Matrix4;
  /** window height in world units (width = 1) */
  aspect: number;
  fov: number;
}

/**
 * Recovers a camera-relative pose of the window rectangle from its four image
 * corners, assuming a pinhole camera with focal length ≈ 0.85 × the long side
 * (typical phone photo) and a centred principal point.
 */
export function poseFromQuad(quad: Quad, iw: number, ih: number): WindowPose {
  const f = 0.85 * Math.max(iw, ih);
  const pts = quad.map(([x, y]) => [(x * iw - iw / 2) / f, -(y * ih - ih / 2) / f] as [number, number]);
  const Hm = homography(pts);
  const h1 = new Vector3(Hm[0], Hm[3], Hm[6]);
  const h2 = new Vector3(Hm[1], Hm[4], Hm[7]);
  const h3 = new Vector3(Hm[2], Hm[5], Hm[8]);
  let lambda = 1 / h1.length();
  // the window must be in front of the camera (camera looks down −Z)
  if (h3.z * lambda < 0) lambda = -lambda;
  const flip = (v: Vector3) => new Vector3(v.x, v.y, -v.z);
  // keep the homography's own plane basis (slightly sheared for skewed photos)
  // so the window corners reproject exactly; the normal is the true plane normal
  const ex = flip(h1.clone().multiplyScalar(lambda));
  const aspect = h2.length() / h1.length();
  const ey = flip(h2.clone().multiplyScalar(lambda / aspect));
  const ez = new Vector3().crossVectors(ex, ey).normalize();
  const t = flip(h3.clone().multiplyScalar(lambda));
  const m = new Matrix4().makeBasis(ex, ey, ez).setPosition(t);
  // window plane sits at a realistic distance; scale everything so width = 1
  const fov = (2 * Math.atan(ih / 2 / f) * 180) / Math.PI;
  return { matrix: m, aspect, fov };
}

/* ───────────────────────────── fabric textures */

const texCache = new Map<string, Texture>();
function canvasTex(key: string, size: number, draw: (c: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const k = `${key}:${size}`;
  let t = texCache.get(k);
  if (t) return t;
  const cv = Object.assign(document.createElement('canvas'), { width: size, height: size });
  draw(cv.getContext('2d')!, size);
  t = new CanvasTexture(cv);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 16;
  if (srgb) t.colorSpace = SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

function weaveBump(weave: Weave) {
  return canvasTex(`bump-${weave}`, 512, (c, s) => {
    c.fillStyle = '#808080';
    c.fillRect(0, 0, s, s);
    if (weave === 'velvet' || weave === 'blackout') {
      for (let i = 0; i < 48000; i++) {
        c.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},0.05)`;
        c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      return;
    }
    const step = weave === 'sheer' ? 3 : weave === 'linen' ? 4 : 3;
    for (let y = 0; y < s; y += step) {
      c.fillStyle = `rgba(255,255,255,${weave === 'linen' ? 0.25 + Math.random() * 0.25 : 0.25})`;
      c.fillRect(0, y, s, 1);
    }
    for (let x = 0; x < s; x += step) {
      c.fillStyle = `rgba(0,0,0,${weave === 'linen' ? 0.2 + Math.random() * 0.3 : 0.2})`;
      c.fillRect(x, 0, 1, s);
    }
    if (weave === 'linen')
      for (let i = 0; i < 140; i++) {
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(0, Math.random() * s, s * (0.3 + Math.random() * 0.7), 1.5);
      }
  }, false);
}

function patternMap(pattern: Pattern, color: string) {
  return canvasTex(`pat-${pattern}-${color}`, 512, (c, s) => {
    const base = new Color(color);
    const light = base.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;
    const accent = base.clone().offsetHSL(0, -0.05, light ? -0.18 : 0.14).getStyle();
    c.fillStyle = color;
    c.fillRect(0, 0, s, s);
    c.fillStyle = c.strokeStyle = accent;
    switch (pattern) {
      case 'stripe':
        for (let x = 0; x < s; x += 128) {
          c.fillRect(x + 10, 0, 34, s);
          c.fillRect(x + 54, 0, 8, s);
        }
        break;
      case 'herringbone':
        c.lineWidth = 5;
        for (let x = 0; x < s; x += 32)
          for (let y = -32; y < s + 32; y += 16) {
            c.beginPath();
            const dir = (x / 32) % 2 ? 1 : -1;
            c.moveTo(x, y);
            c.lineTo(x + 32, y + dir * 16);
            c.stroke();
          }
        break;
      case 'trellis':
        c.lineWidth = 6;
        for (let y = 0; y < s; y += 128)
          for (let x = 0; x < s; x += 128) {
            c.beginPath();
            c.ellipse(x + 64, y + 64, 60, 60, 0, 0, Math.PI * 2);
            c.stroke();
            c.beginPath();
            c.arc(x, y, 60, 0, Math.PI * 2);
            c.stroke();
          }
        break;
      case 'damask':
        for (let y = 0; y < s; y += 256)
          for (let x = 0; x < s; x += 256)
            for (const [ox, oy] of [
              [128, 128],
              [0, 0],
              [256, 0],
              [0, 256],
              [256, 256],
            ]) {
              c.save();
              c.translate(x + ox, y + oy);
              for (let k = 0; k < 8; k++) {
                c.rotate(Math.PI / 4);
                c.beginPath();
                c.moveTo(0, 0);
                c.bezierCurveTo(20, -30, 50, -40, 0, -96);
                c.bezierCurveTo(-50, -40, -20, -30, 0, 0);
                c.globalAlpha = 0.75;
                c.fill();
              }
              c.globalAlpha = 1;
              c.restore();
            }
        break;
      case 'floral':
        // brick-offset sprigs, drawn wrapped so the repeat has no visible seam
        for (let i = 0; i < 16; i++) {
          const gx = i % 4;
          const gy = Math.floor(i / 4);
          const x = ((gx + (gy % 2) * 0.5 + 0.25) * s) / 4 + ((i * 37) % 23) - 11;
          const y = ((gy + 0.3) * s) / 4 + ((i * 53) % 19) - 9;
          c.save();
          c.translate(x, y);
          c.rotate((i * 2.4) % (Math.PI * 2));
          c.fillStyle = base.clone().offsetHSL(0.92, 0.25, light ? -0.25 : 0.2).getStyle();
          for (let k = 0; k < 5; k++) {
            c.rotate((Math.PI * 2) / 5);
            c.beginPath();
            c.ellipse(0, -18, 11, 20, 0, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = '#d8b25a';
          c.beginPath();
          c.arc(0, 0, 7, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#6f8a5b';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(0, 22);
          c.quadraticCurveTo(14, 46, 4, 70);
          c.stroke();
          c.restore();
        }
        break;
      default:
        for (let i = 0; i < 9000; i++) {
          c.fillStyle = `rgba(${light ? '0,0,0' : '255,255,255'},0.025)`;
          c.fillRect(Math.random() * s, Math.random() * s, 2, 1);
        }
    }
  });
}

/* ───────────────────────────── engine */

const M = 1 / 1.2; // world units per metre (window width ≈ 1.2 m)

export class CurtainEngine {
  readonly renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(50, 1, 0.01, 200);
  private frame = new Group();
  private curtains = new Group();
  private fabric = new MeshPhysicalMaterial({ side: DoubleSide, roughness: 0.85, vertexColors: true });
  private hardware = new MeshStandardMaterial({ color: '#8c8a86', metalness: 1, roughness: 0.35 });
  private wall: Mesh;
  private floorShadow: Mesh;
  private glow = { uGlow: { value: 0 }, uTint: { value: new Color('#ffffff') }, uA: { value: 1 }, uSheer: { value: 0 } };
  private key: DirectionalLight;
  private back: DirectionalLight;
  private hemi: HemisphereLight;
  private pose: WindowPose | null = null;
  private photo: Texture | null = null;
  private size = { w: 1, h: 1 };
  private raf = 0;
  private dirty = true;
  private windowKey = '';
  private floorShadowOn = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NeutralToneMapping; // keeps fabric colours true to the swatch
    r.toneMappingExposure = 1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    this.scene.add(this.frame);
    this.frame.add(this.curtains);
    this.frame.matrixAutoUpdate = false;
    this.hemi = new HemisphereLight('#fff6ea', '#7a6a58', 1.1);
    this.scene.add(this.hemi);
    this.key = new DirectionalLight('#fff4e6', 1.1);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.radius = 8;
    this.key.shadow.bias = -0.0005;
    Object.assign(this.key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 10 });
    this.frame.add(this.key, this.key.target);
    // daylight from the window: back-lights sheers
    this.back = new DirectionalLight('#ffffff', 0.9);
    this.frame.add(this.back, this.back.target);
    // shadow-catching wall around the window
    this.wall = new Mesh(new PlaneGeometry(8, 6), new ShadowMaterial({ opacity: 0.22 }));
    this.wall.receiveShadow = true;
    this.frame.add(this.wall);
    // soft contact shadow where floor-length curtains meet the floor
    const sc = Object.assign(document.createElement('canvas'), { width: 8, height: 64 });
    const sx = sc.getContext('2d')!;
    const sg = sx.createLinearGradient(0, 0, 0, 64);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,.42)');
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 8, 64);
    const shadowTex = new CanvasTexture(sc);
    shadowTex.colorSpace = SRGBColorSpace;
    this.floorShadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.floorShadow.rotation.x = -Math.PI / 2;
    this.frame.add(this.floorShadow);
    // daylight glowing through the cloth where it covers the window
    this.fabric.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.glow);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFrame;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFrame = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFrame;\nuniform float uGlow;\nuniform float uA;\nuniform float uSheer;\nuniform vec3 uTint;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          if (uSheer > 0.5) diffuseColor.a = mix(0.46, 0.9, smoothstep(1.0, 0.9, vColor.r));`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float inWin = smoothstep(-0.05, 0.05, vFrame.x) * smoothstep(1.05, 0.95, vFrame.x) * smoothstep(-0.05, 0.05, vFrame.y) * smoothstep(uA + 0.05, uA - 0.05, vFrame.y);
          totalEmissiveRadiance += diffuseColor.rgb * uTint * uGlow * inWin * (0.45 + 0.55 * vColor.r);`,
        );
    };
    const loop = () => {
      if (this.dirty) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  setPhoto(img: HTMLImageElement | HTMLCanvasElement, w: number, h: number) {
    this.photo?.dispose();
    const t = new Texture(img);
    t.colorSpace = SRGBColorSpace;
    t.needsUpdate = true;
    this.photo = t;
    this.scene.background = t;
    this.size = { w, h };
    this.windowKey = '';
    this.estimateLight(img, w, h);
    this.dirty = true;
  }

  /** Average room colour/brightness drives the hemisphere & key lights. */
  private estimateLight(img: CanvasImageSource, w: number, h: number) {
    const c = Object.assign(document.createElement('canvas'), { width: 32, height: Math.max(1, Math.round((32 * h) / w)) });
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const avg = (y0: number, y1: number) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor(y0 * c.height); y < Math.ceil(y1 * c.height); y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
      return new Color(r / n / 255, g / n / 255, b / n / 255);
    };
    const top = avg(0, 0.5);
    const bottom = avg(0.5, 1);
    const lum = (top.r + top.g + top.b) / 3;
    this.hemi.color.copy(top).lerp(new Color('#ffffff'), 0.55);
    this.hemi.groundColor.copy(bottom).lerp(new Color('#6a5c4c'), 0.3);
    this.hemi.intensity = 1.55 + lum * 0.6;
    this.key.intensity = 1.25 + lum * 1.1;
    this.renderer.toneMappingExposure = 0.85 + lum * 0.35;
  }

  setWindow(quad: Quad) {
    const { w, h } = this.size;
    this.pose = poseFromQuad(quad, w, h);
    this.camera.fov = this.pose.fov;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame.matrix.copy(this.pose.matrix);
    this.frame.matrixWorldNeedsUpdate = true;
    this.measureWindow(quad);
    this.dirty = true;
  }

  /** Brightness and colour of the daylight in the window, read from the photo itself. */
  private measureWindow(quad: Quad) {
    const img = this.photo?.image as CanvasImageSource | undefined;
    if (!img) return;
    const key = quad.flat().map((v) => v.toFixed(2)).join();
    if (key === this.windowKey) return;
    this.windowKey = key;
    const x0 = Math.min(...quad.map((p) => p[0]));
    const x1 = Math.max(...quad.map((p) => p[0]));
    const y0 = Math.min(...quad.map((p) => p[1]));
    const y1 = Math.max(...quad.map((p) => p[1]));
    const c = Object.assign(document.createElement('canvas'), { width: 12, height: 12 });
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const { w, h } = this.size;
    ctx.drawImage(img, x0 * w, y0 * h, Math.max(1, (x1 - x0) * w), Math.max(1, (y1 - y0) * h), 0, 0, 12, 12);
    const d = ctx.getImageData(0, 0, 12, 12).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = 144 * 255;
    this.glow.uTint.value.setRGB(r / n, g / n, b / n, SRGBColorSpace);
  }

  /** Before/after: hides everything added to the photo. */
  setVisible(on: boolean) {
    this.curtains.visible = on;
    this.wall.visible = on;
    this.floorShadow.visible = on && this.floorShadowOn;
    this.dirty = true;
  }

  resize(cssW: number, cssH: number) {
    this.renderer.setSize(cssW, cssH, false);
    this.dirty = true;
  }

  update(s: CurtainSettings) {
    if (!this.pose) return;
    const a = this.pose.aspect;
    // clear
    this.curtains.traverse((o) => (o as Mesh).geometry?.dispose());
    this.curtains.clear();
    // fabric material
    const f = this.fabric;
    const sheer = s.weave === 'sheer';
    f.map = patternMap(s.pattern, s.color);
    // print scale: one repeat of each pattern at a realistic size on the cloth
    const repeat: Record<Pattern, number> = { plain: 3, stripe: 2.2, herringbone: 6, trellis: 2.4, damask: 1.5, floral: 1.15 };
    f.map.repeat.setScalar(repeat[s.pattern]);
    f.bumpMap = weaveBump(s.weave);
    f.bumpMap.repeat.set(14, 14);
    f.bumpScale = s.weave === 'velvet' ? 0.6 : 1.4;
    f.color.set('#ffffff');
    f.roughness = s.weave === 'silk' ? 0.42 : s.weave === 'velvet' ? 0.9 : 0.86;
    f.sheen = s.weave === 'velvet' ? 1 : s.weave === 'silk' ? 0.5 : 0.25;
    f.sheenColor = new Color(s.color).lerp(new Color('#ffffff'), s.weave === 'velvet' ? 0.35 : 0.6);
    f.sheenRoughness = s.weave === 'velvet' ? 0.35 : 0.6;
    f.transparent = sheer;
    f.depthWrite = !sheer;
    f.needsUpdate = true;
    this.glow.uA.value = a;
    this.glow.uSheer.value = sheer ? 1 : 0;
    const light = new Color(s.color).getHSL({ h: 0, s: 0, l: 0 }).l;
    const glowByWeave: Record<Weave, number> = { sheer: 0.55, linen: 0.34, cotton: 0.26, silk: 0.18, velvet: 0.03, blackout: 0 };
    this.glow.uGlow.value = glowByWeave[s.weave] * (0.35 + 0.65 * light);

    const top = a + s.mount * M;
    const bottom = -Math.max(0, s.drop) * M + 0.005;
    const floorY = -s.floor * M;
    const length = top - Math.max(bottom, floorY + 0.012);
    const zWall = 0.004;

    if (s.header === 'roller' || s.header === 'roman') {
      // fitted to the window recess
      const w = 1.02;
      const visible = Math.max(0.06, a * (1 - s.open * 0.85));
      const g = s.header === 'roman' ? this.romanGeometry(w, visible, a) : this.flatGeometry(w, visible);
      g.translate(0.5, a + 0.015, 0);
      const mesh = new Mesh(g, f);
      mesh.position.z = zWall + 0.035;
      mesh.castShadow = mesh.receiveShadow = true;
      this.curtains.add(mesh);
      const tube = new Mesh(new CylinderGeometry(0.022, 0.022, w + 0.04, 24), s.header === 'roller' ? this.hardware : f);
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0.5, a + 0.03, zWall + 0.04);
      this.curtains.add(tube);
      const bar = new Mesh(new CylinderGeometry(0.008, 0.008, w, 12), this.hardware);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0.5, a + 0.015 - visible, zWall + 0.04);
      this.curtains.add(bar);
    } else {
      // pair of panels on a pole/track spanning beyond the window
      const ext = s.extend;
      const trackL = -ext;
      const trackR = 1 + ext;
      const span = trackR - trackL;
      const closedHalf = span / 2;
      const stack = closedHalf * (0.2 + 0.08 / s.fullness);
      const width = closedHalf - (closedHalf - stack) * s.open;
      for (const side of [-1, 1] as const) {
        const x0 = side < 0 ? trackL : trackR - width;
        const g = this.panelGeometry(x0, top, width, length, closedHalf, closedHalf * s.fullness, s.header, side < 0 ? 1.3 : 4.1, sheer);
        const mesh = new Mesh(g, f);
        mesh.position.z = zWall + 0.03;
        mesh.castShadow = !sheer;
        mesh.receiveShadow = !sheer;
        this.curtains.add(mesh);
      }
      // pole + finials (+ rings/eyelets)
      const pole = new Mesh(new CylinderGeometry(0.011, 0.011, span + 0.12, 24), this.hardware);
      pole.rotation.z = Math.PI / 2;
      pole.position.set(0.5, top + 0.01, zWall + 0.09);
      pole.castShadow = true;
      this.curtains.add(pole);
      for (const x of [trackL - 0.06, trackR + 0.06]) {
        const fin = new Mesh(new SphereGeometry(0.022, 20, 14), this.hardware);
        fin.position.set(x, top + 0.01, zWall + 0.09);
        this.curtains.add(fin);
        const br = new Mesh(new CylinderGeometry(0.006, 0.006, 0.09, 10), this.hardware);
        br.rotation.x = Math.PI / 2;
        br.position.set(x + (x < 0.5 ? 0.04 : -0.04), top + 0.01, zWall + 0.045);
        this.curtains.add(br);
      }
      if (s.header === 'eyelet' || s.header === 'pinch' || s.header === 'box') {
        const n = Math.max(4, Math.round((width / 0.08) * 1));
        for (const side of [-1, 1]) {
          const x0 = side < 0 ? trackL : trackR - width;
          for (let i = 0; i <= n; i++) {
            const ring = new Mesh(new TorusGeometry(s.header === 'eyelet' ? 0.018 : 0.014, 0.003, 8, 20), this.hardware);
            ring.position.set(x0 + (i / n) * width, top + 0.005, zWall + 0.09);
            this.curtains.add(ring);
          }
        }
      }
    }
    // lights in the window frame: key from room-front-top, daylight from behind the window
    this.key.position.set(2.1, a + 1.3, 2.1);
    this.key.target.position.set(0.5, a * 0.4, 0);
    this.back.position.set(0.5, a * 0.7, -2);
    this.back.target.position.set(0.5, a * 0.5, 1);
    this.back.intensity = sheer ? 1.6 : 0.5;
    this.wall.position.set(0.5, a * 0.3, zWall - 0.002);
    // contact shadow: only when the cloth actually reaches the floor
    const isBlind = s.header === 'roller' || s.header === 'roman';
    this.floorShadowOn = !isBlind && s.drop >= s.floor - 0.03;
    this.floorShadow.visible = this.floorShadowOn && this.curtains.visible;
    this.floorShadow.position.set(0.5, floorY + 0.002, zWall + 0.13);
    this.floorShadow.scale.set(1 + 2 * s.extend + 0.05, 0.22, 1);
    this.dirty = true;
  }

  /**
   * Pleated panel in window-frame space, hanging from its top-left corner.
   * Fold depth is solved from the cloth actually available, so a panel pushed
   * aside stacks into tight deep folds while a closed one hangs in soft waves.
   */
  private panelGeometry(x0: number, top: number, width: number, length: number, closedWidth: number, flat: number, header: Header, seed: number, sheer: boolean) {
    const smooth = (a: number, b: number, t: number) => {
      const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const pitch = header === 'wave' ? 0.115 : header === 'eyelet' ? 0.13 : 0.095;
    // the number of folds is fixed by the heading; pushing the panel aside only compresses them
    const folds = Math.max(4, Math.round(closedWidth / pitch));
    const cols = Math.min(420, Math.max(220, folds * 26));
    const L = width / folds;
    const arc = flat / folds;
    const amp = Math.min(0.052, Math.max(0.012, (L / Math.PI) * Math.sqrt(Math.max(0.04, arc / L - 1))));
    const foldVar = Array.from({ length: folds + 2 }, (_, k) => 0.8 + 0.34 * (0.5 + 0.5 * Math.sin(k * 12.9898 + seed * 78.233)));
    // rows are denser at the hem so its stitched turn-up stays crisp
    const vs: number[] = [];
    const rows = 64;
    for (let j = 0; j <= rows; j++) vs.push(j / rows);
    const hemH = Math.min(0.08, 0.07 / Math.max(0.2, length));
    vs.push(1 - hemH, 1 - hemH + 0.002, 1 - hemH - 0.002);
    vs.sort((p, q) => p - q);
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const col: number[] = [];
    for (const v of vs) {
      const hang = smooth(0.02, 0.4, v);
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        // folds are not ruled lines: they wander a little and drift toward the hem
        const w = u + 0.011 * Math.sin(u * 17 + seed) + 0.006 * Math.sin(u * 43 + seed * 2.3) + v * v * 0.018 * Math.sin(u * 7 + seed * 1.7);
        const ph = w * folds * Math.PI * 2;
        let wave = Math.sin(ph);
        if (header === 'box') wave = wave * hang + (1 - hang) * Math.sign(wave) * Math.pow(Math.abs(wave), 0.4);
        if (header === 'pinch') {
          // stitched pinch at the heading, opening into a rounded fold below
          const pinch = Math.pow(Math.abs(Math.sin(ph / 2)), 3);
          wave = wave * hang + (1 - hang) * (pinch * 1.5 - 0.5);
        }
        const k = foldVar[Math.max(0, Math.min(folds + 1, Math.floor(w * folds + 0.5)))];
        const depth = amp * k * (0.72 + 0.32 * hang);
        const z = (wave + 1) * depth + v * v * 0.014 * Math.sin(u * 5 + seed);
        const x = x0 + u * width + Math.sin(ph * 2) * depth * 0.1 + Math.cos(ph) * depth * 0.14;
        // the crest of each fold hangs a touch lower than the valley
        const y = top - v * length - Math.pow(v, 8) * wave * 0.007;
        pos.push(x, y, z);
        uv.push((u * flat) / 0.4, (v * length) / 0.4);
        const open = 0.5 + 0.5 * wave;
        let ao = sheer ? 0.9 + 0.1 * open : 0.5 + 0.5 * Math.pow(open, 0.7);
        ao *= 0.96 + 0.04 * hang; // heading is a little shaded by the pole
        if (Math.abs(v - (1 - hemH)) < 0.0025) ao *= 0.86; // hem stitch line
        col.push(ao, ao, ao);
      }
    }
    const n = vs.length - 1;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const c = a + cols + 1;
        idx.push(a, c, a + 1, c, c + 1, a + 1);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private flatGeometry(width: number, height: number) {
    const g = new PlaneGeometry(width, height, 10, 10);
    g.translate(0, -height / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / 0.4, (uv.getY(i) * height) / 0.4);
    g.setAttribute('color', new Float32BufferAttribute(new Array(uv.count * 3).fill(1), 3));
    return g;
  }

  /** Roman blind: horizontal soft folds stacked at the top. */
  private romanGeometry(width: number, height: number, full: number) {
    const rows = 80;
    const cols = 10;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const folded = Math.max(0, full - height);
    const nFolds = Math.min(6, Math.max(1, Math.round(folded / 0.12)));
    const col: number[] = [];
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      const y = -v * height;
      const foldZone = Math.min(1, (folded * 0.6) / Math.max(height, 0.01));
      const t = v / Math.max(foldZone, 0.001);
      const z = v < foldZone ? Math.abs(Math.sin(t * nFolds * Math.PI)) * 0.03 : 0.002 * Math.sin(v * 20);
      const ao = v < foldZone ? 0.68 + 0.32 * Math.abs(Math.sin(t * nFolds * Math.PI)) : 1;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        pos.push((u - 0.5) * width, y, z);
        uv.push((u * width) / 0.4, (v * full) / 0.4);
        col.push(ao, ao, ao);
      }
    }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = j * (cols + 1) + i;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** Composite image at the photo's native resolution. */
  capture(): HTMLCanvasElement {
    const prev = this.renderer.getPixelRatio();
    const css = this.canvas.getBoundingClientRect();
    this.renderer.setPixelRatio(Math.min(3, this.size.w / Math.max(1, css.width)));
    this.renderer.render(this.scene, this.camera);
    const out = Object.assign(document.createElement('canvas'), { width: this.canvas.width, height: this.canvas.height });
    out.getContext('2d')!.drawImage(this.canvas, 0, 0);
    this.renderer.setPixelRatio(prev);
    this.dirty = true;
    return out;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.curtains.traverse((o) => (o as Mesh).geometry?.dispose());
    this.photo?.dispose();
    this.floorShadow.geometry.dispose();
    const shadowMat = this.floorShadow.material as MeshBasicMaterial;
    shadowMat.map?.dispose();
    shadowMat.dispose();
    this.fabric.dispose();
    this.hardware.dispose();
    this.renderer.dispose();
  }
}

import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  RingGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WatchGeometry, WatchSpec } from '../../config/watches';
import { brilliant } from '../../lib/three/builders/core';
import { getSharedMaterial } from '../../lib/three/materials';
import { paintBezelInsert, paintDial } from './dial';
import {
  leatherMaps,
  lumeMat,
  meshBump,
  metal,
  movementTexture,
  natoMap,
  rubberBump,
  ruby,
  sapphire,
  setBezelFinish,
  setMetal,
  sunrayAnisotropy,
} from './materials';

/*
 * Parametric watch, authored in millimetres (group scaled ×0.01 so it shares
 * units with the reference GLB: 1 unit = 100 mm). Dial faces +Y, 12 o'clock
 * is −Z, the crown is at +X. The bottom of the case rests at y = −6 mm, the
 * top of the display cushion.
 */
export const CUSHION = { cy: -29.5, ry: 23.6, rz: 41 };

/**
 * Cross-section of the display cushion, measured from the GLB's own vertices
 * (projected onto the YZ plane, max radius per angle bin). Straps are draped
 * along this contour so they hug the cushion exactly.
 */
let profile: { cy: number; cz: number; r: Float32Array } | null = null;
const BINS = 180;
export function setCushionProfile(mesh: Mesh, scale = 100) {
  // meshopt-quantised GLBs store normalised ints + a node transform, so read
  // through the attribute and the world matrix rather than the raw array
  mesh.updateWorldMatrix(true, false);
  const attr = mesh.geometry.attributes.position;
  const v = new Vector3();
  const positions = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) {
    v.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
  }
  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i + 1] * scale);
    maxY = Math.max(maxY, positions[i + 1] * scale);
    minZ = Math.min(minZ, positions[i + 2] * scale);
    maxZ = Math.max(maxZ, positions[i + 2] * scale);
  }
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const r = new Float32Array(BINS);
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1] * scale - cy;
    const z = positions[i + 2] * scale - cz;
    const a = Math.atan2(z, y);
    const b = Math.floor((((a / (Math.PI * 2)) % 1) + 1) % 1 * BINS) % BINS;
    r[b] = Math.max(r[b], Math.hypot(y, z));
  }
  // fill empty bins and smooth
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < BINS; i++) {
      if (!r[i]) r[i] = Math.max(r[(i + BINS - 1) % BINS], r[(i + 1) % BINS]);
    }
  const sm = new Float32Array(BINS);
  for (let i = 0; i < BINS; i++) sm[i] = (r[(i + BINS - 1) % BINS] + 2 * r[i] + r[(i + 1) % BINS]) / 4;
  profile = { cy, cz, r: sm };
}
function cushionRadius(theta: number) {
  if (!profile) return 0;
  const f = ((((theta / (Math.PI * 2)) % 1) + 1) % 1) * BINS;
  const i = Math.floor(f) % BINS;
  const t = f - Math.floor(f);
  return profile.r[i] * (1 - t) + profile.r[(i + 1) % BINS] * t;
}

export type PartName = 'crystal' | 'bezel' | 'dial' | 'hands' | 'case' | 'movement' | 'caseback' | 'strap';

/** Where each part travels in the exploded view (mm). */
export const EXPLODE: Record<PartName, [number, number, number]> = {
  // true assembly order, stacked upward so nothing disappears into the cushion
  crystal: [0, 50, 0],
  bezel: [0, 40, 0],
  hands: [0, 31, 0],
  dial: [0, 22, 0],
  movement: [0, 12, 0],
  case: [0, 0, 0],
  caseback: [0, 0, 0],
  strap: [0, 0, 0],
};

const toMesh = (geos: BufferGeometry[], mat: Material, name: string) => {
  const g = mergeGeometries(geos, false)!;
  const m = new Mesh(g, mat);
  m.name = name;
  m.castShadow = m.receiveShadow = true;
  geos.forEach((x) => x.dispose());
  return m;
};
const clean = (g: BufferGeometry) => {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
};
const at = (g: BufferGeometry, m: Matrix4) => clean(g.applyMatrix4(m));
const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
const RY = (a: number) => new Matrix4().makeRotationY(a);
const RX = (a: number) => new Matrix4().makeRotationX(a);
const RZ = (a: number) => new Matrix4().makeRotationZ(a);
const mul = (...ms: Matrix4[]) => ms.reduce((a, b) => a.multiply(b), new Matrix4());

export class ParametricWatch {
  readonly root = new Group();
  readonly parts = {} as Record<PartName, Group>;
  /** anchors for hotspots (mm, root-local before scaling) */
  readonly anchors: Record<'crown' | 'bezel' | 'dial' | 'crystal' | 'strap' | 'caseback', Vector3>;

  private spec!: WatchSpec;
  private readonly R: number;
  private readonly y0 = -6;
  private readonly yDial: number;
  private readonly yTop: number;
  private readonly dialR: number;

  // live-updated materials
  private caseMat = metal('steel');
  private brushedMat = metal('steel', true);
  private goldMat = metal('yellow');
  private handsMat = metal('steel');
  private accentMat = new MeshPhysicalMaterial({ color: '#d23b2e', metalness: 0.2, roughness: 0.3, clearcoat: 1 });
  private bezelInsertMat = new MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1, metalness: 0 });
  private bezelColorMat = new MeshPhysicalMaterial({ roughness: 0.1, clearcoat: 1 });
  private lume = lumeMat('#c9f59a');
  private dialMat = new MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  private strapMat = new MeshPhysicalMaterial({ roughness: 0.6 });
  private glass = sapphire();
  private rubyMat = ruby();
  private plateMat = new MeshPhysicalMaterial({ color: '#cfd2d6', metalness: 1, roughness: 0.32, map: movementTexture() });
  private gears: { mesh: Object3D; speed: number }[] = [];
  private balance: Object3D | null = null;
  private rotor: Object3D | null = null;
  private hand = {} as Record<'hour' | 'minute' | 'second' | 'sub', Object3D[]>;

  constructor(
    private readonly geo: WatchGeometry,
    private readonly modelName: string,
    spec: WatchSpec,
    /** only build the strap (used to re-strap the reference chronograph) */
    private readonly strapOnly = false,
  ) {
    this.R = geo.diameter / 2;
    this.yDial = this.y0 + geo.thickness * 0.62;
    this.yTop = this.y0 + geo.thickness * 0.78;
    this.dialR = this.R * 0.82;
    for (const p of Object.keys(EXPLODE) as PartName[]) {
      const g = new Group();
      g.name = p;
      this.parts[p] = g;
      this.root.add(g);
    }
    this.root.scale.setScalar(0.01);
    this.anchors = {
      crown: new Vector3(this.R + 3.4, this.y0 + geo.thickness * 0.5, 0),
      bezel: new Vector3(0, this.yTop + 2, -this.R * 0.93),
      dial: new Vector3(-this.dialR * 0.45, this.yDial + 0.5, this.dialR * 0.25),
      crystal: new Vector3(this.dialR * 0.35, this.yTop + 2.8, -this.dialR * 0.3),
      strap: new Vector3(0, CUSHION.cy + 4, CUSHION.rz + 4),
      caseback: new Vector3(0, this.y0 - 0.5, this.R * 0.4),
    };
    this.dialMat.anisotropyMap = sunrayAnisotropy();
    this.spec = spec;
    if (!strapOnly) {
      this.buildCase();
      this.buildCrystal();
      this.buildMovement();
    }
    this.apply(spec, true);
  }

  /** Rebuilds only the parts affected by changed options. */
  apply(s: WatchSpec, force = false) {
    const prev = this.spec;
    this.spec = s;
    const changed = (k: keyof WatchSpec) => force || prev[k] !== s[k];
    // materials
    setMetal(this.caseMat, s.caseMetal);
    setMetal(this.brushedMat, s.caseMetal, true);
    setMetal(this.handsMat, s.caseMetal === 'dlc' || s.caseMetal === 'titanium' ? 'steel' : s.caseMetal);
    this.accentMat.color.set(s.accent === 'none' ? '#d7d9dc' : s.accent);
    this.accentMat.metalness = s.accent === 'none' ? 1 : 0.2;
    this.lume.color.set(s.lume).multiplyScalar(0.9);
    this.lume.emissive.set(s.lume);
    setBezelFinish(this.bezelColorMat, s.bezelColor);
    if (this.strapOnly) {
      if (changed('strap') || changed('strapColor') || changed('twoTone') || changed('caseMetal')) this.buildStrap();
      return;
    }
    if (changed('bezel') || changed('bezelColor')) this.buildBezel();
    if (changed('dialColor') || changed('dialFinish') || changed('markers') || changed('date')) this.buildDial();
    if (changed('hands') || changed('accent')) this.buildHands();
    if (changed('strap') || changed('strapColor') || changed('twoTone')) this.buildStrap();
    if (changed('exhibitionBack')) this.buildCaseback();
    this.parts.movement.visible = s.dialFinish === 'skeleton' || s.exhibitionBack || this.exploded > 0.02;
  }

  private exploded = 0;
  setExplode(e: number) {
    this.exploded = e;
    for (const p of Object.keys(EXPLODE) as PartName[]) {
      const [x, y, z] = EXPLODE[p];
      this.parts[p].position.set(x * e, y * e, z * e);
    }
    this.parts.movement.visible = this.spec.dialFinish === 'skeleton' || this.spec.exhibitionBack || e > 0.02;
  }

  /** Advances hands to the current time and animates the movement. */
  tick(now: Date, dt: number) {
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    this.hand.hour?.forEach((o) => (o.rotation.y = -(h / 12) * Math.PI * 2));
    this.hand.minute?.forEach((o) => (o.rotation.y = -(m / 60) * Math.PI * 2));
    // automatic sweep: 8 beats per second
    const sweep = Math.floor(s * 8) / 8;
    this.hand.second?.forEach((o) => (o.rotation.y = -(sweep / 60) * Math.PI * 2));
    this.hand.sub?.forEach((o) => (o.rotation.y = -(sweep / 60) * Math.PI * 2));
    if (this.parts.movement.visible) {
      for (const g of this.gears) g.mesh.rotation.y += g.speed * dt;
      if (this.balance) this.balance.rotation.y = Math.sin(performance.now() / 1000 * Math.PI * 8) * 1.6;
      if (this.rotor) this.rotor.rotation.y += dt * 0.6;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    (this.dialMat.map as { dispose?: () => void } | null)?.dispose?.();
  }

  /* ────────────────────────────────────────────── builders */

  private clear(p: PartName) {
    const g = this.parts[p];
    g.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    g.clear();
    return g;
  }

  private buildCase() {
    const { R, y0 } = this;
    const H = this.geo.thickness;
    const g = this.clear('case');
    const prof = [
      [R * 0.62, y0 + 0.1],
      [R * 0.86, y0],
      [R * 0.95, y0 + 0.7],
      [R * 0.99, y0 + H * 0.24],
      [R, y0 + H * 0.36],
      [R, y0 + H * 0.68],
      [R * 0.97, y0 + H * 0.78],
      [R * 0.84, y0 + H * 0.78],
      [R * 0.84, this.yDial - 0.4],
      [R * 0.62, this.yDial - 0.4],
    ].map(([r, y]) => new Vector2(r, y));
    const shell = new LatheGeometry(prof, 128);
    g.add(toMesh([clean(shell)], this.caseMat, 'case-shell'));

    // lugs (side profile extruded across x)
    const L = this.R * 0.45;
    const lugShape = new Shape();
    lugShape.moveTo(R * 0.7, y0 + H * 0.72);
    lugShape.bezierCurveTo(R * 0.95, y0 + H * 0.78, R + L * 0.6, y0 + H * 0.62, R + L, y0 + H * 0.34);
    lugShape.lineTo(R + L, y0 + H * 0.08);
    lugShape.bezierCurveTo(R + L * 0.5, y0 + H * 0.12, R * 0.95, y0 + H * 0.05, R * 0.7, y0 + H * 0.12);
    lugShape.closePath();
    const lugGeo = new ExtrudeGeometry(lugShape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.55, bevelSegments: 4, curveSegments: 16 });
    const lugs: BufferGeometry[] = [];
    const brushed: BufferGeometry[] = [];
    for (const sz of [1, -1])
      for (const sx of [1, -1]) {
        const e1 = new Vector3(0, 0, sz);
        const e2 = new Vector3(0, 1, 0);
        const e3 = new Vector3().crossVectors(e1, e2);
        const basis = new Matrix4().makeBasis(e1, e2, e3);
        const x = sx * (this.geo.lugWidth / 2 + 1.4);
        lugs.push(at(lugGeo.clone(), mul(T(x - e3.x * 1.05, 0, 0), basis)));
        // spring bar
        if (sx > 0) brushed.push(at(new CylinderGeometry(0.6, 0.6, this.geo.lugWidth + 1, 12), mul(T(0, y0 + H * 0.22, sz * (R + L - 1.6)), RZ(Math.PI / 2))));
      }
    g.add(toMesh(lugs, this.brushedMat, 'lugs'));

    // crown with knurling (+ guards for sports cases)
    const crown = new CylinderGeometry(2.6, 2.6, 3.4, 108, 6);
    const pa = crown.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const a = Math.atan2(pa.getZ(i), pa.getX(i));
      const k = 1 + 0.05 * Math.sign(Math.cos(a * 18));
      if (Math.abs(pa.getY(i)) < 1.5) {
        pa.setX(i, pa.getX(i) * k);
        pa.setZ(i, pa.getZ(i) * k);
      }
    }
    crown.computeVertexNormals();
    const yc = y0 + H * 0.5;
    const parts = [at(crown, mul(T(R + 2.3, yc, 0), RZ(Math.PI / 2))), at(new CylinderGeometry(1.4, 1.4, 1.5, 24), mul(T(R + 0.4, yc, 0), RZ(Math.PI / 2)))];
    if (this.geo.crownGuards)
      for (const sz of [1, -1]) {
        const sh = new Shape();
        sh.moveTo(0, -2);
        sh.quadraticCurveTo(3.2, -1.2, 3, 2);
        sh.lineTo(0, 2);
        sh.closePath();
        parts.push(at(new ExtrudeGeometry(sh, { depth: 2.2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 2 }), mul(T(R - 0.4, yc, sz * 4.2 - 1.1), RX(0))));
      }
    if (this.geo.layout === 'chrono')
      for (const a of [-0.62, 0.62]) parts.push(at(new CylinderGeometry(1.5, 1.5, 3.2, 32), mul(RY(a), T(R + 1.6, yc, 0), RZ(Math.PI / 2))));
    g.add(toMesh(parts, this.caseMat, 'crown'));
    this.buildCaseback();
  }

  private buildCaseback() {
    const g = this.clear('caseback');
    const { R, y0 } = this;
    if (this.spec?.exhibitionBack) {
      const ring = new RingGeometry(R * 0.5, R * 0.86, 96);
      g.add(toMesh([at(ring, mul(T(0, y0 - 0.05, 0), RX(Math.PI / 2)))], this.caseMat, 'back-ring'));
      const glass = new Mesh(new CircleGeometry(R * 0.5, 64), this.glass);
      glass.geometry.applyMatrix4(mul(T(0, y0 - 0.02, 0), RX(Math.PI / 2)));
      g.add(glass);
    } else {
      const disc = new CircleGeometry(R * 0.86, 96);
      g.add(toMesh([at(disc, mul(T(0, y0 - 0.05, 0), RX(Math.PI / 2)))], this.brushedMat, 'caseback'));
    }
  }

  private buildCrystal() {
    const g = this.clear('crystal');
    const r = this.R * 0.84;
    const dome = new SphereGeometry(r * 4, 96, 8, 0, Math.PI * 2, 0, Math.asin(1 / 4));
    dome.translate(0, -r * 4 * Math.cos(Math.asin(1 / 4)) + this.yTop + 1.6, 0);
    const m = new Mesh(dome, this.glass);
    m.name = 'crystal';
    m.renderOrder = 10;
    g.add(m);
  }

  private buildBezel() {
    const g = this.clear('bezel');
    const { R, yTop } = this;
    const s = this.spec;
    const ri = R * 0.84;
    const ro = R * 0.995;
    const bh = s.bezel === 'fluted' ? 2.4 : 1.9;
    const prof = [
      [ri, yTop],
      [ro, yTop],
      [ro, yTop + bh * 0.4],
      [ro - 0.5, yTop + bh * 0.85],
      [ro - 1.2, yTop + bh],
      [ri + 0.4, yTop + bh],
      [ri, yTop + bh * 0.7],
    ].map(([r, y]) => new Vector2(r, y));
    const lathe = new LatheGeometry(prof, s.bezel === 'fluted' ? 360 : 128);
    if (s.bezel === 'fluted') {
      const p = lathe.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const r = Math.hypot(x, z);
        if (r > ri + 1) {
          const k = 1 - 0.022 * Math.max(0, Math.cos(Math.atan2(z, x) * 60));
          p.setX(i, x * k);
          p.setZ(i, z * k);
        }
      }
      lathe.computeVertexNormals();
    }
    g.add(toMesh([clean(lathe)], this.caseMat, 'bezel'));
    if (s.bezel === 'diver' || s.bezel === 'tachymeter') {
      const insert = new RingGeometry(ri + 0.6, ro - 0.9, 128, 1);
      this.bezelInsertMat.map?.dispose();
      this.bezelInsertMat.map = paintBezelInsert(s.bezel, s.bezelColor);
      this.bezelInsertMat.metalness = s.bezelColor === '#c9a35a' || s.bezelColor === '#d4d6da' ? 0.9 : 0;
      this.bezelInsertMat.needsUpdate = true;
      // planar UVs: remap from ring extents to [0,1]
      const uv = insert.attributes.uv;
      const pos = insert.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (2 * ro) + 0.5, pos.getY(i) / (2 * ro) + 0.5);
      const m = new Mesh(insert.applyMatrix4(mul(T(0, yTop + bh + 0.02, 0), RX(-Math.PI / 2))), this.bezelInsertMat);
      m.name = 'bezel-insert';
      g.add(m);
      if (s.bezel === 'diver') {
        // lume pip at 12
        const pip = new Mesh(new CylinderGeometry(0.8, 0.8, 0.4, 20), this.lume);
        pip.position.set(0, yTop + bh + 0.2, -(ri + ro) / 2 + 0.2);
        g.add(pip);
      }
    }
    if (s.bezel === 'diamond') {
      const stones: BufferGeometry[] = [];
      const n = 48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = (ri + ro) / 2 - 0.2;
        stones.push(at(brilliant(1.9), mul(T(Math.cos(a) * r, yTop + bh + 0.1, Math.sin(a) * r), RX(-Math.PI / 2))));
      }
      g.add(toMesh(stones, getSharedMaterial('diamond'), 'bezel-diamonds'));
    }
  }

  private buildDial() {
    const g = this.clear('dial');
    const s = this.spec;
    const layout = this.geo.layout;
    this.dialMat.map?.dispose();
    const print = paintDial(s, layout, this.modelName);
    this.dialMat.map = print.texture;
    this.dialMat.transparent = print.transparent;
    this.dialMat.alphaTest = print.transparent ? 0.5 : 0;
    this.dialMat.anisotropy = s.dialFinish === 'sunray' ? 0.85 : 0;
    this.dialMat.metalness = s.dialFinish === 'sunray' ? 0.45 : s.dialFinish === 'enamel' ? 0 : 0.1;
    this.dialMat.roughness = s.dialFinish === 'enamel' ? 0.08 : s.dialFinish === 'matte' ? 0.75 : 0.3;
    this.dialMat.clearcoat = s.dialFinish === 'matte' ? 0 : s.dialFinish === 'enamel' ? 1 : 0.35;
    this.dialMat.color.set('#ffffff');
    this.dialMat.needsUpdate = true;
    const disc = new CircleGeometry(this.R * 0.84, 128);
    disc.applyMatrix4(mul(T(0, this.yDial, 0), RX(-Math.PI / 2)));
    const dm = new Mesh(disc, this.dialMat);
    dm.name = 'dial';
    dm.receiveShadow = true;
    g.add(dm);
    // rehaut (inner flange)
    const reh = new CylinderGeometry(this.R * 0.845, this.R * 0.845, this.yTop - this.yDial + 0.6, 128, 1, true);
    g.add(toMesh([at(reh, T(0, (this.yTop + this.yDial) / 2, 0))], this.brushedMat, 'rehaut'));

    // applied indices
    const rm = this.dialR * 0.83;
    const applied: BufferGeometry[] = [];
    const lumeGeo: BufferGeometry[] = [];
    const gems: BufferGeometry[] = [];
    const y = this.yDial + 0.35;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (layout === 'small-seconds' && i === 6) continue;
      if (s.date && layout !== 'chrono' && i === 3) continue;
      if (layout === 'day-date' && i === 0) continue;
      if (layout === 'chrono' && (i === 3 || i === 9 || i === 6)) continue;
      const place = (g0: BufferGeometry, r = rm) => at(g0, mul(RY(-a), T(0, y, -r)));
      switch (s.markers) {
        case 'baton':
          // 12 o'clock gets a double baton
          for (const dx of i === 0 ? [-1.5, 1.5] : [0]) {
            applied.push(at(new RoundedBoxGeometry(i % 3 === 0 ? 2 : 1.4, 0.7, this.dialR * 0.16, 2, 0.25), mul(RY(-a), T(dx, y, -rm))));
            lumeGeo.push(at(new BoxGeometry(i % 3 === 0 ? 0.9 : 0.6, 0.75, this.dialR * 0.12), mul(RY(-a), T(dx, y, -rm))));
          }
          break;
        case 'dots':
          if (i % 3 === 0) {
            const tri = new Shape();
            tri.moveTo(0, 2.4);
            tri.lineTo(1.9, -1.4);
            tri.lineTo(-1.9, -1.4);
            tri.closePath();
            if (i === 0) lumeGeo.push(at(new ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }), mul(RY(-a), T(0, y, -rm), RX(-Math.PI / 2))));
            else lumeGeo.push(place(new BoxGeometry(2, 0.7, this.dialR * 0.15)));
          } else lumeGeo.push(place(new CylinderGeometry(1.3, 1.3, 0.7, 24)));
          applied.push(place(new CylinderGeometry(i % 3 ? 1.55 : 0.01, i % 3 ? 1.55 : 0.01, 0.55, 24)));
          break;
        case 'diamond':
          gems.push(at(brilliant(i % 3 === 0 ? 2.4 : 1.8), mul(RY(-a), T(0, y + 0.4, -rm), RX(-Math.PI / 2))));
          applied.push(place(new CylinderGeometry(i % 3 === 0 ? 1.35 : 1.05, i % 3 === 0 ? 1.35 : 1.05, 0.6, 24)));
          break;
        case 'minimal':
          if (i % 3 === 0) applied.push(place(new BoxGeometry(0.7, 0.4, this.dialR * 0.08)));
          break;
        default:
          // printed numerals: small applied dot outside the numeral ring
          applied.push(place(new CylinderGeometry(0.5, 0.5, 0.35, 16), this.dialR * 0.93));
      }
    }
    // centre pinion + sub-dial pinions
    applied.push(at(new CylinderGeometry(1.1, 1.1, 2.2, 24), T(0, this.yDial + 1.1, 0)));
    const subs = layout === 'small-seconds' ? [[0, 0.5]] : layout === 'chrono' ? [[0, 0.5], [0.5, 0], [-0.5, 0]] : [];
    for (const [sx, sz] of subs) applied.push(at(new CylinderGeometry(0.5, 0.5, 1, 16), T(sx * this.R * 0.84, this.yDial + 0.5, sz * this.R * 0.84)));
    if (applied.length) g.add(toMesh(applied, this.handsMat, 'indices'));
    if (lumeGeo.length) g.add(toMesh(lumeGeo, this.lume, 'lume'));
    if (gems.length) g.add(toMesh(gems, getSharedMaterial('diamond'), 'diamond-markers'));
  }

  private handShape(style: string, L: number, w: number) {
    const sh = new Shape();
    switch (style) {
      case 'dauphine':
      case 'baton':
      case 'mercedes': {
        const tip = style === 'dauphine' ? 0 : w * 0.38;
        sh.moveTo(-w * 0.5, -L * 0.12);
        sh.lineTo(w * 0.5, -L * 0.12);
        sh.lineTo(style === 'dauphine' ? w * 0.55 : w * 0.42, style === 'dauphine' ? L * 0.12 : L * 0.9);
        sh.lineTo(tip, L);
        sh.lineTo(-tip, L);
        sh.lineTo(style === 'dauphine' ? -w * 0.55 : -w * 0.42, style === 'dauphine' ? L * 0.12 : L * 0.9);
        sh.closePath();
        break;
      }
      case 'sword':
        sh.moveTo(-w * 0.32, -L * 0.14);
        sh.lineTo(w * 0.32, -L * 0.14);
        sh.lineTo(w * 0.55, L * 0.62);
        sh.lineTo(0, L);
        sh.lineTo(-w * 0.55, L * 0.62);
        sh.closePath();
        break;
      default: {
        // leaf
        sh.moveTo(0, -L * 0.14);
        sh.bezierCurveTo(w * 0.35, -L * 0.1, w * 0.75, L * 0.45, 0, L);
        sh.bezierCurveTo(-w * 0.75, L * 0.45, -w * 0.35, -L * 0.1, 0, -L * 0.14);
      }
    }
    return sh;
  }

  private buildHands() {
    const g = this.clear('hands');
    const s = this.spec;
    this.hand = { hour: [], minute: [], second: [], sub: [] };
    const make = (kind: 'hour' | 'minute', L: number, w: number, y: number) => {
      const pivot = new Group();
      pivot.position.y = y;
      const style = s.hands === 'mercedes' && kind === 'minute' ? 'sword' : s.hands;
      const sh = this.handShape(style, L, w);
      const ex = new ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: style === 'dauphine' ? 0.5 : 0.12, bevelSegments: style === 'dauphine' ? 1 : 2, curveSegments: 24 });
      ex.applyMatrix4(RX(-Math.PI / 2));
      ex.applyMatrix4(RY(Math.PI));
      const m = new Mesh(ex, this.handsMat);
      m.castShadow = true;
      pivot.add(m);
      if (style !== 'leaf' && style !== 'dauphine') {
        const lume = new Shape();
        const lw = w * 0.28;
        lume.moveTo(-lw, L * 0.2);
        lume.lineTo(lw, L * 0.2);
        lume.lineTo(lw * 0.8, L * 0.86);
        lume.lineTo(-lw * 0.8, L * 0.86);
        lume.closePath();
        const lg = new ExtrudeGeometry(lume, { depth: 0.1, bevelEnabled: false });
        lg.applyMatrix4(RX(-Math.PI / 2));
        lg.applyMatrix4(RY(Math.PI));
        lg.translate(0, 0.5, 0);
        pivot.add(new Mesh(lg, this.lume));
      }
      if (style === 'mercedes' && kind === 'hour') {
        const ring = new Mesh(new TorusGeometry(w * 0.55, 0.28, 8, 32), this.handsMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.25, -L * 0.72);
        pivot.add(ring);
        const disc = new Mesh(new CylinderGeometry(w * 0.5, w * 0.5, 0.2, 32), this.lume);
        disc.position.set(0, 0.25, -L * 0.72);
        pivot.add(disc);
      }
      g.add(pivot);
      this.hand[kind].push(pivot);
    };
    const r = this.dialR;
    make('hour', r * 0.56, 3.0, this.yDial + 1.0);
    make('minute', r * 0.88, 2.4, this.yDial + 1.5);
    // seconds: needle with counterweight (accent colour)
    const sec = new Group();
    sec.position.y = this.yDial + 2;
    const needle = new BoxGeometry(0.35, 0.2, r * 1.15);
    needle.translate(0, 0, -r * 0.4);
    const cw = new CylinderGeometry(1.1, 1.1, 0.3, 24);
    cw.translate(0, 0, r * 0.15);
    const hub = new CylinderGeometry(0.9, 0.9, 0.6, 24);
    const secMat = s.accent === 'none' ? this.handsMat : this.accentMat;
    sec.add(toMesh([clean(needle), clean(cw), clean(hub)], secMat, 'second'));
    const tipLume = new Mesh(new CylinderGeometry(0.7, 0.7, 0.25, 16), this.lume);
    tipLume.position.set(0, 0.05, -r * 0.62);
    sec.add(tipLume);
    const layout = this.geo.layout;
    if (layout === 'small-seconds' || layout === 'chrono') {
      // running seconds move to the sub-dial at 6
      const small = new Group();
      small.position.set(0, this.yDial + 0.9, this.R * 0.84 * 0.5);
      const n = new BoxGeometry(0.3, 0.15, this.R * 0.84 * 0.22);
      n.translate(0, 0, -this.R * 0.84 * 0.09);
      small.add(new Mesh(n, secMat));
      g.add(small);
      this.hand.sub.push(small);
      if (layout === 'chrono') {
        for (const sx of [0.5, -0.5]) {
          const sub = new Group();
          sub.position.set(sx * this.R * 0.84, this.yDial + 0.9, 0);
          const nn = new BoxGeometry(0.3, 0.15, this.R * 0.84 * 0.2);
          nn.translate(0, 0, -this.R * 0.84 * 0.08);
          sub.add(new Mesh(nn, this.handsMat));
          g.add(sub);
        }
        g.add(sec);
        this.hand.second.push(sec);
      }
    } else {
      g.add(sec);
      this.hand.second.push(sec);
    }
  }

  private buildMovement() {
    const g = this.clear('movement');
    this.gears = [];
    const { R } = this;
    const yPlate = this.y0 + 1.2;
    const plate = new CylinderGeometry(R * 0.8, R * 0.8, 1.2, 96);
    const pm = new Mesh(plate, this.plateMat);
    pm.position.y = yPlate;
    g.add(pm);
    const gear = (teeth: number, r: number, h: number) => {
      const sh = new Shape();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const rr = i % 2 ? r * 0.9 : r;
        if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      sh.closePath();
      // spokes: four windows
      for (let k = 0; k < 4; k++) {
        const hole = new Shape();
        const a0 = (k / 4) * Math.PI * 2 + 0.25;
        hole.absarc(0, 0, r * 0.72, a0, a0 + 1.1, false);
        hole.absarc(0, 0, r * 0.3, a0 + 1.1, a0, true);
        sh.holes.push(hole);
      }
      const ge = new ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 });
      ge.applyMatrix4(RX(-Math.PI / 2));
      return ge;
    };
    const gold = getSharedMaterial('gold18k');
    const layout: [number, number, number, number, number][] = [
      // x, z, radius, teeth, speed
      [0, 0, R * 0.36, 60, 0.3],
      [R * 0.36, -R * 0.28, R * 0.22, 40, -0.9],
      [-R * 0.35, -R * 0.3, R * 0.2, 36, 1.1],
      [-R * 0.3, R * 0.32, R * 0.18, 32, -1.6],
      [R * 0.4, R * 0.18, R * 0.12, 24, 2.4],
    ];
    for (const [x, z, r, n, speed] of layout) {
      const m = new Mesh(gear(n, r, 0.6), gold);
      m.position.set(x, yPlate + 0.7, z);
      m.castShadow = true;
      g.add(m);
      this.gears.push({ mesh: m, speed });
      const jewel = new Mesh(new CylinderGeometry(0.7, 0.7, 0.5, 16), this.rubyMat);
      jewel.position.set(x, yPlate + 1.6, z);
      g.add(jewel);
    }
    // bridges
    const bridge = new Shape();
    bridge.moveTo(-R * 0.7, -1.6);
    bridge.bezierCurveTo(-R * 0.2, -3, R * 0.2, 3, R * 0.7, 1.6);
    bridge.lineTo(R * 0.7, 4);
    bridge.bezierCurveTo(R * 0.2, 6, -R * 0.2, 0, -R * 0.7, 2);
    bridge.closePath();
    const bm = new Mesh(new ExtrudeGeometry(bridge, { depth: 0.7, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }), this.plateMat);
    bm.geometry.applyMatrix4(RX(-Math.PI / 2));
    bm.position.y = yPlate + 1.6;
    bm.rotation.y = 0.6;
    g.add(bm);
    // balance wheel
    const bal = new Group();
    bal.position.set(R * 0.38, yPlate + 2.2, R * 0.38);
    const rim = new Mesh(new TorusGeometry(R * 0.17, 0.35, 8, 48), gold);
    rim.rotation.x = Math.PI / 2;
    bal.add(rim);
    for (let i = 0; i < 3; i++) {
      const sp = new Mesh(new BoxGeometry(R * 0.34, 0.25, 0.4), gold);
      sp.rotation.y = (i / 3) * Math.PI;
      bal.add(sp);
    }
    g.add(bal);
    this.balance = bal;
    // rotor (visible through the exhibition back)
    const rotorShape = new Shape();
    rotorShape.absarc(0, 0, R * 0.78, 0, Math.PI, false);
    rotorShape.absarc(0, 0, R * 0.2, Math.PI, 0, true);
    const rotor = new Mesh(new ExtrudeGeometry(rotorShape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }), gold);
    rotor.geometry.applyMatrix4(RX(Math.PI / 2));
    const rg = new Group();
    rg.position.y = this.y0 + 0.4;
    rg.add(rotor);
    g.add(rg);
    this.rotor = rg;
  }

  /** Strap path around the display cushion (mm, in the YZ plane). */
  private strapCurve() {
    const R = this.R;
    const L = R * 0.45;
    const yl = this.y0 + this.geo.thickness * 0.2;
    const pts: Vector3[] = [];
    const off = 1.9;
    const ry = CUSHION.ry + off;
    const rz = CUSHION.rz + off;
    pts.push(new Vector3(0, yl, R + L - 1.6));
    if (profile) {
      const { cy, cz } = profile;
      const zl = R + L;
      const t1 = Math.atan2(zl - cz, yl - cy) + 0.16;
      const t2 = Math.PI * 2 - (Math.atan2(-zl - cz, yl - cy) + Math.PI * 2) % (Math.PI * 2) + 0.16;
      const n = 48;
      for (let i = 0; i <= n; i++) {
        const t = t1 + (i / n) * (Math.PI * 2 - t1 - t2);
        const r = cushionRadius(t) + off;
        pts.push(new Vector3(0, cy + r * Math.cos(t), cz + r * Math.sin(t)));
      }
    } else {
      pts.push(new Vector3(0, yl - 3.5, R + L + 2.2));
      const t1 = 0.98;
      for (let i = 0; i <= 24; i++) {
        const t = t1 + (i / 24) * (Math.PI * 2 - 2 * t1);
        pts.push(new Vector3(0, CUSHION.cy + ry * Math.cos(t), rz * Math.sin(t)));
      }
      pts.push(new Vector3(0, yl - 3.5, -(R + L + 2.2)));
    }
    pts.push(new Vector3(0, yl, -(R + L - 1.6)));
    return new CatmullRomCurve3(pts, false, 'centripetal');
  }

  private ribbon(curve: CatmullRomCurve3, width: (t: number) => number, thick: (t: number) => number, segs = 220) {
    const ring = 18;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const len = curve.getLength();
    const P = new Vector3();
    const Tg = new Vector3();
    const X = new Vector3(1, 0, 0);
    const N = new Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, P);
      curve.getTangentAt(t, Tg);
      N.crossVectors(Tg, X).normalize(); // outward from cushion
      if (N.dot(new Vector3(0, P.y - (profile?.cy ?? CUSHION.cy), P.z - (profile?.cz ?? 0)).normalize()) < 0) N.negate();
      const w = width(t) / 2;
      const h = thick(t) / 2;
      for (let j = 0; j <= ring; j++) {
        // rounded rectangle profile, u: 0..0.5 top face, 0.5..1 underside
        const a = (j / ring) * Math.PI * 2;
        const cx = Math.cos(a);
        const cy = Math.sin(a);
        const sx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.25) * w;
        const sy = Math.sign(cy) * Math.pow(Math.abs(cy), 0.35) * h;
        pos.push(P.x + X.x * sx + N.x * sy, P.y + X.y * sx + N.y * sy, P.z + X.z * sx + N.z * sy);
        uv.push(j / ring, (t * len) / 60);
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < ring; j++) {
        const a = i * (ring + 1) + j;
        const b = a + ring + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /**
   * One bracelet link: a rounded bar swept along the strap curve between t0
   * and t1, offset x across the strap. `dome` crowns its top face; the ends
   * are radiused so neighbouring links read as separate pieces.
   */
  private linkSweep(curve: CatmullRomCurve3, t0: number, t1: number, x: number, width: number, thick: number, dome: number) {
    const along = 10;
    const ring = 20;
    const len = curve.getLength() * (t1 - t0);
    const pos: number[] = [];
    const idx: number[] = [];
    const P = new Vector3();
    const Tg = new Vector3();
    const X = new Vector3(1, 0, 0);
    const N = new Vector3();
    const cy = profile?.cy ?? CUSHION.cy;
    const cz = profile?.cz ?? 0;
    const endR = Math.min(0.45, len * 0.18);
    for (let i = 0; i <= along; i++) {
      const u = i / along;
      curve.getPointAt(t0 + (t1 - t0) * u, P);
      curve.getTangentAt(t0 + (t1 - t0) * u, Tg);
      N.crossVectors(Tg, X).normalize();
      if (N.dot(new Vector3(0, P.y - cy, P.z - cz).normalize()) < 0) N.negate();
      // radiused ends: the section shrinks over the last endR millimetres
      const d = Math.min(u, 1 - u) * len;
      const e = d >= endR ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(1 - d / endR, 2)));
      // machined links: square ends with a small chamfer, not pillows
      const w = (width / 2) * (0.93 + 0.07 * e);
      const h = (thick / 2) * (0.82 + 0.18 * e);
      for (let j = 0; j <= ring; j++) {
        const a = (j / ring) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const sx = Math.sign(ca) * Math.pow(Math.abs(ca), 0.12) * w;
        let sy = Math.sign(sa) * Math.pow(Math.abs(sa), 0.14) * h;
        if (sa > 0) sy += dome * (1 - Math.pow(sx / Math.max(w, 1e-3), 2)) * e;
        pos.push(P.x + x + X.x * sx + N.x * sy, P.y + N.y * sy, P.z + N.z * sy);
      }
    }
    for (let i = 0; i < along; i++)
      for (let j = 0; j < ring; j++) {
        const a = i * (ring + 1) + j;
        const b = a + ring + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    // end caps
    for (const i of [0, along]) {
      const base = i * (ring + 1);
      let mx = 0;
      let my = 0;
      let mz = 0;
      for (let j = 0; j < ring; j++) {
        mx += pos[(base + j) * 3];
        my += pos[(base + j) * 3 + 1];
        mz += pos[(base + j) * 3 + 2];
      }
      const c = pos.length / 3;
      pos.push(mx / ring, my / ring, mz / ring);
      for (let j = 0; j < ring; j++) idx.push(...(i === 0 ? [c, base + j + 1, base + j] : [c, base + j, base + j + 1]));
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private buildStrap() {
    const g = this.clear('strap');
    const s = this.spec;
    const curve = this.strapCurve();
    const lw = this.geo.lugWidth;
    const taper = (t: number) => lw * (1 - 0.2 * Math.sin(t * Math.PI));
    if (s.strap === 'bracelet' || s.strap === 'jubilee') {
      // every link is swept along the cushion, so it follows its curve with
      // only a hairline between neighbours, like a real bracelet
      const len = curve.getLength();
      const pitch = s.strap === 'jubilee' ? 4.6 : 6.4;
      const n = Math.min(200, Math.floor(len / pitch));
      const gap = 0.22 / len;
      const outer: BufferGeometry[] = [];
      const centre: BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const t0 = i / n + gap / 2;
        const t1 = (i + 1) / n - gap / 2;
        const tm = (t0 + t1) / 2;
        const w = taper(tm);
        if (Math.abs(tm - 0.5) < 0.05) {
          // fold-over clasp cover: one wide, polished plate
          centre.push(this.linkSweep(curve, t0, t1, 0, w * 0.96, 3, 0.55));
          continue;
        }
        if (s.strap === 'jubilee') {
          // five rows: brushed outer links, small polished links between them
          outer.push(this.linkSweep(curve, t0, t1, -0.385 * w, 0.23 * w, 2.6, 0.12));
          outer.push(this.linkSweep(curve, t0, t1, 0.385 * w, 0.23 * w, 2.6, 0.12));
          for (const x of [-0.165, 0.165]) centre.push(this.linkSweep(curve, t0, t1, x * w, 0.12 * w, 2.3, 0.35));
          // the middle row sits half a link along, as on a five-piece bracelet
          const half = (t1 - t0 + gap) / 2;
          if (i < n - 1) centre.push(this.linkSweep(curve, t0 + half, t1 + half, 0, 0.12 * w, 2.3, 0.35));
        } else {
          outer.push(this.linkSweep(curve, t0, t1, -0.355 * w, 0.285 * w, 2.8, 0.1));
          outer.push(this.linkSweep(curve, t0, t1, 0.355 * w, 0.285 * w, 2.8, 0.1));
          centre.push(this.linkSweep(curve, t0, t1, 0, 0.405 * w, 2.6, 0.28));
        }
      }
      g.add(toMesh(outer, this.brushedMat, 'bracelet-outer'));
      if (centre.length) {
        setMetal(this.goldMat, s.twoTone ? (s.caseMetal === 'rose' ? 'rose' : 'yellow') : s.caseMetal);
        g.add(toMesh(centre, s.twoTone ? this.goldMat : this.caseMat, 'bracelet-centre'));
      }
      return;
    }
    const thick = s.strap === 'nato' ? () => 1.4 : s.strap === 'mesh' ? () => 2 : (t: number) => 3.6 - 1.1 * Math.sin(t * Math.PI);
    const width = s.strap === 'nato' ? () => lw * 0.96 : taper;
    const geo = this.ribbon(curve, width, thick);
    const m = this.strapMat;
    m.map = null;
    m.bumpMap = null;
    m.metalness = 0;
    m.sheen = 0;
    m.clearcoat = 0;
    m.color.set('#ffffff');
    if (s.strap === 'leather') {
      const maps = leatherMaps(s.strapColor);
      m.map = maps.color;
      m.bumpMap = maps.bump;
      m.bumpScale = 1.2;
      m.roughness = 0.55;
      m.clearcoat = 0.25;
      m.clearcoatRoughness = 0.5;
    } else if (s.strap === 'rubber') {
      m.color.set(s.strapColor);
      m.bumpMap = rubberBump();
      m.bumpScale = 1;
      m.roughness = 0.62;
      m.sheen = 0.4;
      m.sheenColor = new Color('#ffffff');
    } else if (s.strap === 'mesh') {
      setMetal(m, s.caseMetal, true);
      m.bumpMap = meshBump();
      m.bumpScale = 1.5;
    } else {
      m.map = natoMap(s.strapColor);
      m.roughness = 0.85;
      m.sheen = 0.6;
      m.sheenColor = new Color('#ffffff');
    }
    m.needsUpdate = true;
    const strap = new Mesh(geo, m);
    strap.name = 'strap';
    strap.castShadow = strap.receiveShadow = true;
    g.add(strap);
    // buckle at the bottom of the cushion
    const P = curve.getPointAt(0.5);
    const frame: BufferGeometry[] = [];
    const bw = lw * 0.92;
    const bz = 9;
    for (const [w, d, x, z] of [
      [bw, 1.3, 0, -bz / 2],
      [bw, 1.3, 0, bz / 2],
      [1.3, bz, -bw / 2, 0],
      [1.3, bz, bw / 2, 0],
    ])
      frame.push(at(new RoundedBoxGeometry(w, 1.6, d, 2, 0.5), T(x, P.y - 2.6, P.z + z + 6)));
    frame.push(at(new RoundedBoxGeometry(1, 1, bz * 1.1, 2, 0.4), T(0, P.y - 3, P.z + 6)));
    g.add(toMesh(frame, this.caseMat, 'buckle'));
  }
}


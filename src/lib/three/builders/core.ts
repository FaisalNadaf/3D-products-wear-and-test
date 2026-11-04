import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Curve,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  CylinderGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createMaterial, type MaterialName } from '../materials';

/*
 * Procedural jewellery toolkit. All dimensions are real-world centimetres so
 * models need no per-product scale fudging once placed on a tracked face.
 */

const tmpM = new Matrix4();

/** Collects geometry per material and merges each bucket into one mesh. */
export class JewelBuilder {
  private buckets = new Map<MaterialName, BufferGeometry[]>();

  add(material: MaterialName, geometry: BufferGeometry, matrix?: Matrix4) {
    const g = prepare(geometry);
    if (matrix) g.applyMatrix4(matrix);
    const list = this.buckets.get(material) ?? [];
    list.push(g);
    this.buckets.set(material, list);
    return this;
  }

  /** Adds every bucket of another builder transformed by `matrix`. */
  merge(other: JewelBuilder, matrix?: Matrix4) {
    for (const [mat, list] of other.buckets) for (const g of list) this.add(mat, g, matrix);
    return this;
  }

  build(name: string): Group {
    const group = new Group();
    group.name = name;
    for (const [mat, list] of this.buckets) {
      const merged = mergeGeometries(list, false);
      if (!merged) throw new Error(`Could not merge geometry for ${name}/${mat}`);
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new Mesh(merged, createMaterial(mat));
      mesh.name = `${name}_${mat}`;
      mesh.castShadow = true;
      group.add(mesh);
      list.forEach((g) => g.dispose());
    }
    this.buckets.clear();
    return group;
  }
}

/** Normalises any geometry to indexed position+normal so buckets can merge. */
function prepare(src: BufferGeometry): BufferGeometry {
  const g = src.clone();
  for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.index) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new BufferAttribute(idx, 1));
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

export const m4 = () => new Matrix4();
export const T = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z);
export const S = (x: number, y = x, z = x) => new Matrix4().makeScale(x, y, z);
export const RX = (a: number) => new Matrix4().makeRotationX(a);
export const RY = (a: number) => new Matrix4().makeRotationY(a);
export const RZ = (a: number) => new Matrix4().makeRotationZ(a);
/** Compose matrices left→right as written: chain(A, B, C) = A·B·C */
export const chain = (...ms: Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), new Matrix4());
export const deg = (d: number) => (d * Math.PI) / 180;

/* ------------------------------------------------------------------ gems */

export interface GemCut {
  /** crown height as fraction of mean radius */
  crown?: number;
  /** pavilion depth as fraction of mean radius */
  pavilion?: number;
  /** table size as fraction of outline */
  table?: number;
  girdle?: number;
}

/**
 * Faceted gemstone from a convex outline (CCW, XY plane). The table faces +Z.
 * Facet layout mirrors a modified brilliant: table, star + kite crown facets,
 * upper girdle facets, girdle band, lower girdle + pavilion mains, culet.
 * Flat normals give crisp light-catching facets.
 */
export function facetedGem(outline: Vector2[], cut: GemCut = {}): BufferGeometry {
  const { crown = 0.34, pavilion = 0.86, table = 0.56, girdle = 0.035 } = cut;
  const n = outline.length;
  const c = outline.reduce((a, p) => a.add(p), new Vector2()).divideScalar(n);
  const r = outline.reduce((a, p) => a + p.distanceTo(c), 0) / n;
  const g = girdle * r;
  const zt = g + crown * r;
  const zm = g + crown * r * 0.42;
  const zp = -g - pavilion * r * 0.55;
  const zc = -g - pavilion * r;
  const rel = (p: Vector2, s: number) => new Vector2().subVectors(p, c).multiplyScalar(s).add(c);
  const mid = (i: number) => outline[i].clone().add(outline[(i + 1) % n]).multiplyScalar(0.5);
  const v3 = (p: Vector2, z: number) => new Vector3(p.x, p.y, z);

  const t = outline.map((p) => v3(rel(p, table), zt));
  const m = outline.map((_, i) => v3(rel(mid(i), 0.84 / Math.cos(Math.PI / n)), zm));
  const gt = outline.map((p) => v3(p, g));
  const gb = outline.map((p) => v3(p, -g));
  const pm = outline.map((_, i) => v3(rel(mid(i), 0.5), zp));
  const top = new Vector3(c.x, c.y, zt);
  const culet = new Vector3(c.x, c.y, zc);
  const center = new Vector3(c.x, c.y, 0);

  const pos: number[] = [];
  const tri = (a: Vector3, b: Vector3, d: Vector3) => {
    const nrm = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(d, a));
    const centroid = new Vector3().add(a).add(b).add(d).divideScalar(3).sub(center);
    if (nrm.dot(centroid) < 0) pos.push(a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z);
    else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(top, t[i], t[j]); // table
    tri(t[i], m[i], t[j]); // star
    tri(t[j], m[i], gt[j]); // kite (two halves)
    tri(t[j], gt[j], m[j]);
    tri(m[i], gt[i], gt[j]); // upper girdle
    tri(gt[i], gb[i], gb[j]); // girdle band
    tri(gt[i], gb[j], gt[j]);
    tri(pm[i], gb[j], gb[i]); // lower girdle
    tri(gb[j], pm[j], culet); // pavilion main (kite halves)
    tri(gb[j], culet, pm[i]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export const circleOutline = (r: number, n = 16, phase = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return new Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });

export const ovalOutline = (rx: number, ry: number, n = 20) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new Vector2(Math.cos(a) * rx, Math.sin(a) * ry);
  });

/** Pear/teardrop, point upward (+Y), length = total height, width = max width. */
export const pearOutline = (length: number, width: number, n = 22) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2; // start at bottom
    const s = Math.sin(a);
    const yy = s; // -1 bottom … 1 top
    const taper = Math.pow((1 - yy) / 2, 0.78);
    return new Vector2(Math.cos(a) * (width / 2) * taper * 1.12, (yy * length) / 2);
  });

/** Marquise / navette, points along ±Y. */
export const marquiseOutline = (length: number, width: number, n = 20) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    return new Vector2(Math.sign(c) * Math.pow(Math.abs(c), 1.25) * (width / 2), Math.sin(a) * (length / 2));
  });

/** Round brilliant cut of the given diameter (table toward +Z). */
export const brilliant = (diameter: number) => facetedGem(circleOutline(diameter / 2, 16, Math.PI / 16));

/** Polki / kundan: flat, shallow, large table "uncut" style. */
export const kundanStone = (outline: Vector2[]) => facetedGem(outline, { crown: 0.16, pavilion: 0.2, table: 0.78 });

/** Smooth cabochon dome. */
export function cabochon(rx: number, ry: number, h: number): BufferGeometry {
  const g = new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  g.applyMatrix4(RX(Math.PI / 2));
  g.applyMatrix4(S(rx, ry, h));
  return g;
}

/* ------------------------------------------------------------- settings */

/** Prong (claw) setting for a round stone of the given diameter seated at z=0. */
export function prongSetting(b: JewelBuilder, mat: MaterialName, diameter: number, prongs = 4, phase = Math.PI / 4) {
  const r = diameter / 2;
  const wire = Math.max(0.028, diameter * 0.075);
  for (let i = 0; i < prongs; i++) {
    const a = phase + (i / prongs) * Math.PI * 2;
    const curve = new CatmullRomCurve3([
      new Vector3(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, -r * 0.95),
      new Vector3(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, -r * 0.35),
      new Vector3(Math.cos(a) * r * 1.03, Math.sin(a) * r * 1.03, r * 0.05),
      new Vector3(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.34),
    ]);
    b.add(mat, new TubeGeometry(curve, 14, wire, 8, false));
    b.add(mat, new SphereGeometry(wire * 1.22, 12, 8), T(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, r * 0.34));
  }
  // basket gallery rings
  b.add(mat, new TorusGeometry(r * 0.8, wire * 0.75, 8, 40), T(0, 0, -r * 0.42));
  b.add(mat, new TorusGeometry(r * 0.48, wire * 0.7, 8, 32), T(0, 0, -r * 0.85));
}

/** Rub-over bezel that follows any outline. */
export function bezel(b: JewelBuilder, mat: MaterialName, outline: Vector2[], wall = 0.035, scale = 1.04) {
  const curve = new CatmullRomCurve3(
    outline.map((p) => new Vector3(p.x * scale, p.y * scale, 0)),
    true,
    'centripetal',
  );
  const tube = new TubeGeometry(curve, outline.length * 6, wall, 8, true);
  tube.applyMatrix4(S(1, 1, 1.6));
  b.add(mat, tube);
  // back plate cup
  const back = new TubeGeometry(
    new CatmullRomCurve3(outline.map((p) => new Vector3(p.x * 0.7, p.y * 0.7, -0.05)), true, 'centripetal'),
    outline.length * 4,
    wall * 0.8,
    6,
    true,
  );
  b.add(mat, back, T(0, 0, -wall * 2));
}

/** Small round stones evenly spaced around a closed outline (micro-pavé halo). */
export function halo(
  b: JewelBuilder,
  outline: Vector2[],
  offset: number,
  stone: number,
  stoneMat: MaterialName,
  metalMat: MaterialName,
  z = 0,
) {
  const centroid = outline.reduce((a, p) => a.add(p), new Vector2()).divideScalar(outline.length);
  const pts = outline.map((p) => {
    const d = new Vector2().subVectors(p, centroid);
    const len = d.length();
    return new Vector3(p.x + (d.x / len) * offset, p.y + (d.y / len) * offset, z);
  });
  const curve = new CatmullRomCurve3(pts, true, 'centripetal');
  const length = curve.getLength();
  const count = Math.max(6, Math.floor(length / (stone * 1.12)));
  const gem = brilliant(stone);
  const bead = new SphereGeometry(stone * 0.16, 8, 6);
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(i / count);
    b.add(stoneMat, gem, T(p.x, p.y, p.z));
    const q = curve.getPointAt((i + 0.5) / count);
    b.add(metalMat, bead, T(q.x, q.y, q.z + stone * 0.2));
  }
  // halo frame (inner + outer rails)
  for (const k of [-0.62, 0.62]) {
    const rail = new CatmullRomCurve3(
      outline.map((p) => {
        const d = new Vector2().subVectors(p, centroid);
        const len = d.length();
        const o = offset + k * stone;
        return new Vector3(p.x + (d.x / len) * o, p.y + (d.y / len) * o, z - stone * 0.25);
      }),
      true,
      'centripetal',
    );
    b.add(metalMat, new TubeGeometry(rail, count * 3, stone * 0.11, 6, true));
  }
}

/* ------------------------------------------------------------ wire work */

export function wire(b: JewelBuilder, mat: MaterialName, points: Vector3[], radius: number, closed = false) {
  const curve = new CatmullRomCurve3(points, closed, 'centripetal');
  b.add(mat, new TubeGeometry(curve, Math.max(16, points.length * 12), radius, 10, closed));
  return curve;
}

/** Tube whose radius varies along its length (tapered hoops, crescents). */
export function taperedTube(
  curve: Curve<Vector3>,
  segments: number,
  radial: number,
  radius: (t: number) => [number, number],
  closed = false,
): BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, closed);
  const pos: number[] = [];
  const idx: number[] = [];
  const P = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const N = frames.normals[Math.min(i, frames.normals.length - 1)];
    const B = frames.binormals[Math.min(i, frames.binormals.length - 1)];
    const [rn, rb] = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(
        P.x + rn * Math.cos(a) * N.x + rb * Math.sin(a) * B.x,
        P.y + rn * Math.cos(a) * N.y + rb * Math.sin(a) * B.y,
        P.z + rn * Math.cos(a) * N.z + rb * Math.sin(a) * B.z,
      );
    }
  }
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b2 = (i + 1) * (radial + 1) + j;
      idx.push(a, b2, a + 1, b2, b2 + 1, a + 1);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type ChainStyle = 'cable' | 'rope' | 'box' | 'fine';

/**
 * Real interlocking chain: oval links distributed by arc length along a curve,
 * each rotated 90° to its neighbour (rope: progressive twist).
 */
export function chainAlong(
  b: JewelBuilder,
  mat: MaterialName,
  curve: Curve<Vector3>,
  opts: { link: number; wire: number; style?: ChainStyle; from?: number; to?: number; up?: Vector3 },
) {
  const { link, wire: w, style = 'cable', from = 0, to = 1, up = new Vector3(0, 1, 0) } = opts;
  const len = curve.getLength() * (to - from);
  const pitch = style === 'rope' ? link * 0.36 : link * 0.74;
  const count = Math.max(2, Math.floor(len / pitch));
  const radialSeg = style === 'box' ? 4 : 6;
  const tubular = style === 'box' ? 4 : 12;
  const base = new TorusGeometry(link * 0.32, w, radialSeg, tubular);
  if (style === 'box') base.applyMatrix4(RZ(Math.PI / 4));
  base.applyMatrix4(S(style === 'box' ? 1.0 : 1.45, 1, 1));
  const tangent = new Vector3();
  const p = new Vector3();
  const side = new Vector3();
  const normal = new Vector3();
  const basis = new Matrix4();
  const twist = new Quaternion();
  for (let i = 0; i < count; i++) {
    const t = from + ((i + 0.5) / count) * (to - from);
    curve.getPointAt(t, p);
    curve.getTangentAt(t, tangent);
    side.crossVectors(tangent, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    normal.crossVectors(side, tangent).normalize();
    basis.makeBasis(tangent, normal, side);
    const angle = style === 'rope' ? i * deg(52) : i % 2 ? Math.PI / 2 : 0;
    twist.setFromAxisAngle(new Vector3(1, 0, 0), angle);
    tmpM.makeRotationFromQuaternion(twist);
    const mat4 = new Matrix4().copy(basis).multiply(tmpM);
    mat4.setPosition(p);
    b.add(mat, base, mat4);
  }
  base.dispose();
}

/** Beads along a curve (pearls, gold granulation). */
export function beadsAlong(
  b: JewelBuilder,
  mat: MaterialName,
  curve: Curve<Vector3>,
  radius: number | ((t: number) => number),
  spacing: number,
  from = 0,
  to = 1,
) {
  const len = curve.getLength() * (to - from);
  const count = Math.max(1, Math.floor(len / spacing));
  const p = new Vector3();
  for (let i = 0; i <= count; i++) {
    const t = from + (i / count) * (to - from);
    curve.getPointAt(Math.min(1, t), p);
    const r = typeof radius === 'number' ? radius : radius(t);
    b.add(mat, new SphereGeometry(r, r > 0.12 ? 18 : r > 0.05 ? 10 : 7, r > 0.12 ? 12 : r > 0.05 ? 7 : 5), T(p.x, p.y, p.z));
  }
}

export function pearl(b: JewelBuilder, r: number, at: Matrix4, capMat: MaterialName = 'gold22k', elongation = 1) {
  b.add('pearl', new SphereGeometry(r, 28, 20), chain(at, S(1, elongation, 1)));
  const cap = new SphereGeometry(r * 0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  b.add(capMat, cap, chain(at, T(0, r * elongation * 0.82, 0)));
  b.add(capMat, new TorusGeometry(r * 0.2, r * 0.07, 6, 12), chain(at, T(0, r * elongation + r * 0.2, 0)));
}

/** Jump ring linking two parts. */
export function jumpRing(b: JewelBuilder, mat: MaterialName, at: Matrix4, r = 0.06, w = 0.018) {
  b.add(mat, new TorusGeometry(r, w, 8, 18), at);
}

/** Classic shepherd-hook ear wire starting at the piercing (origin). */
export function earHook(b: JewelBuilder, mat: MaterialName, dropTo = -0.32) {
  wire(
    b,
    mat,
    [
      new Vector3(0, dropTo, 0.02),
      new Vector3(0, -0.12, 0.03),
      new Vector3(0, 0.12, -0.08),
      new Vector3(0, 0.3, -0.38),
      new Vector3(0, 0.24, -0.72),
      new Vector3(0, -0.15, -0.86),
      new Vector3(0, -0.75, -0.82),
    ],
    0.028,
  );
}

/** Stud post + butterfly back (mostly hidden by the lobe occluder). */
export function studPost(b: JewelBuilder, mat: MaterialName) {
  const post = new CylinderGeometry(0.03, 0.03, 1.0, 10);
  b.add(mat, post, chain(T(0, 0, -0.45), RX(Math.PI / 2)));
  const back = new TorusGeometry(0.16, 0.05, 8, 20);
  b.add(mat, back, chain(T(0, 0, -0.62), S(1.15, 0.8, 0.5)));
}

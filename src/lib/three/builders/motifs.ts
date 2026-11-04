import {
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Matrix4,
} from 'three';
import type { MaterialName } from '../materials';
import {
  JewelBuilder,
  T,
  RZ,
  RX,
  S,
  chain,
  brilliant,
  kundanStone,
  circleOutline,
  bezel,
  beadsAlong,
  cabochon,
  pearl,
  deg,
  facetedGem,
  ovalOutline,
} from './core';

/* Reusable decorative motifs shared by earrings, nose pieces and necklaces. */

export function petalShape(length: number, width: number) {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-width * 0.62, length * 0.28, -width * 0.55, length * 0.86, 0, length);
  s.bezierCurveTo(width * 0.55, length * 0.86, width * 0.62, length * 0.28, 0, 0);
  return s;
}

export function extrude(shape: Shape, depth: number, bevel: number) {
  const g = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: 2,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** Gold flower with a centre stone; lies in XY, faces +Z. */
export function flower(
  b: JewelBuilder,
  at: Matrix4,
  opts: { radius: number; petals?: number; metal: MaterialName; centre: MaterialName; petalStones?: MaterialName },
) {
  const { radius, petals = 6, metal, centre, petalStones } = opts;
  const petal = extrude(petalShape(radius, radius * 0.62), radius * 0.1, radius * 0.07);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    b.add(metal, petal, chain(at, RZ(a), T(0, radius * 0.12, 0), RX(deg(-14))));
    if (petalStones) {
      b.add(petalStones, brilliant(radius * 0.28), chain(at, RZ(a), T(0, radius * 0.6, radius * 0.11)));
    }
  }
  const cr = radius * 0.4;
  if (centre === 'diamond') {
    b.add('diamond', brilliant(cr * 1.6), chain(at, T(0, 0, radius * 0.16)));
  } else {
    b.add(centre, facetedGem(circleOutline(cr * 0.8, 14), { crown: 0.42, table: 0.5 }), chain(at, T(0, 0, radius * 0.16)));
  }
  // granulation ring around the centre
  const ring = new CatmullRomCurve3(
    circleOutline(cr * 1.05, 24).map((p) => new Vector3(p.x, p.y, radius * 0.13)),
    true,
  );
  const grains = new JewelBuilder();
  beadsAlong(grains, metal, ring, radius * 0.06, radius * 0.135);
  b.merge(grains, at);
}

/** Kundan stone in a gold collet with a beaded rim. */
export function kundanCollet(b: JewelBuilder, at: Matrix4, rx: number, ry: number, metal: MaterialName = 'gold22k') {
  const outline = ovalOutline(rx, ry, 20);
  const inner = new JewelBuilder();
  inner.add('kundan', kundanStone(outline), T(0, 0, 0.02));
  bezel(inner, metal, outline, Math.min(rx, ry) * 0.16, 1.06);
  b.merge(inner, at);
}

/** Gold dome (jhumka bell) with radial ridges, outer and inner wall. */
export function bellGeometry(radius: number, height: number, ridges = 20) {
  const pts: Vector2[] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const r = radius * (0.14 + 0.86 * Math.pow(Math.sin((s * Math.PI) / 2), 1.15));
    pts.push(new Vector2(r, -height * s));
  }
  // rolled lip
  pts.push(new Vector2(radius * 1.05, -height * 1.02));
  pts.push(new Vector2(radius * 1.03, -height * 1.06));
  pts.push(new Vector2(radius * 0.96, -height * 1.03));
  // inner wall back up
  for (let i = steps; i >= 0; i--) {
    const s = i / steps;
    const r = radius * 0.92 * (0.12 + 0.86 * Math.pow(Math.sin((s * Math.PI) / 2), 1.15));
    pts.push(new Vector2(Math.max(0.01, r), -height * s - 0.03));
  }
  const g = new LatheGeometry(pts, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const s = -y / height;
    if (s > 0.12 && s < 0.92) {
      const phi = Math.atan2(z, x);
      const k = 1 + 0.045 * Math.cos(ridges * phi) * Math.sin(((s - 0.12) / 0.8) * Math.PI);
      p.setX(i, x * k);
      p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Pearl fringe hanging from points along a curve. */
export function pearlFringe(
  b: JewelBuilder,
  curve: CatmullRomCurve3,
  count: number,
  r: number,
  drop: number,
  metal: MaterialName,
  from = 0,
  to = 1,
) {
  for (let i = 0; i < count; i++) {
    const t = from + ((i + 0.5) / count) * (to - from);
    const p = curve.getPointAt(t);
    b.add(metal, new TorusGeometry(r * 0.32, r * 0.09, 6, 14), chain(T(p.x, p.y - r * 0.35, p.z), RZ(Math.PI / 2)));
    if (drop > r * 0.4) {
      const len = drop;
      b.add(metal, new CylinderGeometry(r * 0.08, r * 0.08, len, 6), T(p.x, p.y - r * 0.35 - len / 2, p.z));
    }
    pearl(b, r, T(p.x, p.y - drop - r * 1.9, p.z), metal, 1.12);
  }
}

/** Round temple-style coin motif with ruby cabochon and rope rim. */
export function templeCoin(b: JewelBuilder, at: Matrix4, r: number, metal: MaterialName, stone: MaterialName) {
  const disc = new Shape();
  disc.absarc(0, 0, r, 0, Math.PI * 2, false);
  b.add(metal, extrude(disc, r * 0.12, r * 0.06), at);
  b.add(metal, new TorusGeometry(r * 0.98, r * 0.07, 8, 48), chain(at, T(0, 0, r * 0.1)));
  const rim = new CatmullRomCurve3(circleOutline(r * 0.78, 28).map((p) => new Vector3(p.x, p.y, r * 0.12)), true);
  const grains = new JewelBuilder();
  beadsAlong(grains, metal, rim, r * 0.055, r * 0.15);
  b.merge(grains, at);
  b.add(stone, cabochon(r * 0.42, r * 0.42, r * 0.28), chain(at, T(0, 0, r * 0.12)));
  b.add(metal, new TorusGeometry(r * 0.45, r * 0.05, 6, 32), chain(at, T(0, 0, r * 0.13)));
}

/** Small gold granule (used as spacer). */
export const granule = (b: JewelBuilder, metal: MaterialName, at: Matrix4, r: number) =>
  b.add(metal, new SphereGeometry(r, 12, 8), at);

export { S };

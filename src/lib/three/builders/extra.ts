import { CatmullRomCurve3, CylinderGeometry, Matrix4, Shape, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { MaterialName } from '../materials';
import {
  JewelBuilder,
  T,
  RX,
  RY,
  RZ,
  S,
  chain,
  brilliant,
  facetedGem,
  pearOutline,
  marquiseOutline,
  ovalOutline,
  circleOutline,
  bezel,
  halo,
  prongSetting,
  studPost,
  jumpRing,
  beadsAlong,
  chainAlong,
  pearl,
  wire,
  deg,
} from './core';
import { extrude, flower, kundanCollet, pearlFringe, petalShape, granule } from './motifs';
import { chestNormal, necklaceCurve } from '../../tracking/bodyFrame';
import { FACE_ANCHORS, NOSE_PIN_YAW } from '../../tracking/anchors';
import { liftOverFace } from './faceSurface';

/* Second collection: pearls, statement, traditional, layered, bridal, matha patti. */

const UP = new Vector3(0, 1, 0);

/* ───────────── earrings (ear frame: origin = piercing, hangs −Y, face +Z) */

export function pearlDrop() {
  const b = new JewelBuilder();
  // diamond-set cap stud
  b.add('diamond', brilliant(0.26), T(0, 0, 0.18));
  const s = new JewelBuilder();
  prongSetting(s, 'gold18k', 0.26, 4);
  b.merge(s, T(0, 0, 0.18));
  studPost(b, 'gold18k');
  jumpRing(b, 'gold18k', chain(T(0, -0.25, 0.08), RY(Math.PI / 2)), 0.06, 0.018);
  b.add('gold18k', new CylinderGeometry(0.018, 0.018, 0.5, 8), T(0, -0.55, 0.08));
  // cultured south-sea drop pearl with a pavé cap
  pearl(b, 0.42, T(0, -1.32, 0.08), 'gold18k', 1.22);
  const cap = new CatmullRomCurve3(circleOutline(0.2, 18).map((p) => new Vector3(p.x, -0.8, p.y + 0.08)), true);
  beadsAlong(b, 'diamond', cap, 0.035, 0.07);
  return b.build('pearl-drop');
}

export function pearlStud() {
  const b = new JewelBuilder();
  b.add('pearl', new SphereGeometry(0.4, 40, 28), T(0, 0, 0.36));
  b.add('gold22k', new SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), chain(T(0, 0, 0.02), RX(-Math.PI / 2), S(1, 0.4, 1)));
  studPost(b, 'gold22k');
  return b.build('pearl-stud');
}

export function goldBallStud() {
  const b = new JewelBuilder();
  b.add('gold22k', new SphereGeometry(0.28, 40, 28), T(0, 0, 0.3));
  // granulation collar
  const ring = new CatmullRomCurve3(circleOutline(0.3, 30).map((p) => new Vector3(p.x, p.y, 0.15)), true);
  beadsAlong(b, 'gold22k', ring, 0.045, 0.1);
  const ring2 = new CatmullRomCurve3(circleOutline(0.2, 24).map((p) => new Vector3(p.x, p.y, 0.53)), true);
  beadsAlong(b, 'gold22k', ring2, 0.028, 0.065);
  granule(b, 'gold22k', T(0, 0, 0.6), 0.05);
  studPost(b, 'gold22k');
  return b.build('gold-ball-stud');
}

export function statementChandelier() {
  const b = new JewelBuilder();
  const metal: MaterialName = 'whiteGold';
  // round cluster top
  b.add('diamond', brilliant(0.3), T(0, 0, 0.2));
  halo(b, circleOutline(0.15, 16), 0.1, 0.085, 'diamond', metal, 0.15);
  studPost(b, metal);
  // tiers of pear diamonds on fine bars
  const tiers = [
    { y: -0.85, n: 3, spread: 0.55, len: 0.5, w: 0.3 },
    { y: -1.75, n: 5, spread: 1.0, len: 0.55, w: 0.3 },
    { y: -2.75, n: 7, spread: 1.4, len: 0.7, w: 0.42 },
  ];
  b.add(metal, new CylinderGeometry(0.02, 0.02, 0.5, 8), T(0, -0.35, 0.08));
  let prev = [new Vector3(0, -0.6, 0.08)];
  for (const t of tiers) {
    // curved bar for the tier
    const arc = new CatmullRomCurve3(
      Array.from({ length: 9 }, (_, i) => {
        const u = i / 8 - 0.5;
        return new Vector3(u * t.spread * 2, t.y + 0.25 - Math.cos(u * Math.PI) * 0.18, 0.08);
      }),
    );
    chainAlong(b, metal, arc, { link: 0.1, wire: 0.012, style: 'fine' });
    beadsAlong(b, 'diamond', arc, 0.03, 0.09);
    const pts: Vector3[] = [];
    for (let i = 0; i < t.n; i++) {
      const u = t.n === 1 ? 0.5 : i / (t.n - 1);
      const p = arc.getPointAt(u);
      const pend = new JewelBuilder();
      const out = pearOutline(t.len, t.w * (i % 2 ? 0.8 : 1), 18);
      pend.add('diamond', facetedGem(out, { crown: 0.36 }));
      bezel(pend, metal, out, 0.02, 1.05);
      b.merge(pend, T(p.x, p.y - t.len / 2 - 0.08, p.z));
      pts.push(new Vector3(p.x, p.y - t.len - 0.1, p.z));
    }
    // links from previous tier
    for (const q of prev) wire(b, metal, [q, new Vector3(q.x * 0.9, t.y + 0.3, 0.08)], 0.012);
    prev = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
  }
  return b.build('statement-chandelier');
}

export function meenakariDrop() {
  const b = new JewelBuilder();
  kundanCollet(b, T(0, 0, 0.12), 0.18, 0.18);
  flower(b, T(0, 0, 0.04), { radius: 0.36, petals: 8, metal: 'gold22k', centre: 'kundan' });
  studPost(b, 'gold22k');
  jumpRing(b, 'gold22k', chain(T(0, -0.42, 0.06), RY(Math.PI / 2)), 0.06, 0.02);
  // teardrop frame with enamel petals
  const cy = -1.35;
  const frame = pearOutline(1.5, 1.1, 32);
  const shape = new Shape(frame.map((p) => p.clone()));
  b.add('gold22k', extrude(shape, 0.06, 0.03), T(0, cy, 0));
  const inner = new JewelBuilder();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    inner.add(i % 2 ? 'enamelGreen' : 'enamelRed', extrude(petalShape(0.36, 0.24), 0.04, 0.02), chain(RZ(a), T(0, 0.1, 0.06)));
  }
  kundanCollet(inner, T(0, 0, 0.1), 0.15, 0.15);
  b.merge(inner, T(0, cy - 0.12, 0.02));
  const rimB = new JewelBuilder();
  bezel(rimB, 'gold22k', frame, 0.03, 1.0);
  b.merge(rimB, T(0, cy, 0.01));
  const rim = new CatmullRomCurve3(frame.map((p) => new Vector3(p.x * 1.04, p.y * 1.04 + cy, 0.04)), true);
  beadsAlong(b, 'gold22k', rim, 0.03, 0.08);
  const low = new CatmullRomCurve3(
    Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI + deg(30) + (i / 8) * (Math.PI - deg(60));
      return new Vector3(Math.cos(a) * 0.5, cy - 0.35 + Math.sin(a) * 0.45, 0.04);
    }),
  );
  pearlFringe(b, low, 7, 0.065, 0.05, 'gold22k');
  return b.build('meenakari-drop');
}

/* ───────────── nose pins (nose frame) */

export function nosePinSolitaire() {
  const b = new JewelBuilder();
  const face = chain(RY(NOSE_PIN_YAW), T(0, 0, 0.1));
  b.add('diamond', brilliant(0.24), face);
  const s = new JewelBuilder();
  prongSetting(s, 'gold18k', 0.24, 3, Math.PI / 2);
  b.merge(s, face);
  b.add('gold18k', new CylinderGeometry(0.025, 0.025, 0.6, 8), chain(RY(NOSE_PIN_YAW), T(0, 0, -0.25), RX(Math.PI / 2)));
  return b.build('nosepin-solitaire');
}

export function nosePinRubyFlower() {
  const b = new JewelBuilder();
  const face = chain(RY(NOSE_PIN_YAW), T(0, 0, 0.08));
  b.add('ruby', facetedGem(circleOutline(0.09, 14), { crown: 0.42 }), chain(face, T(0, 0, 0.08)));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    b.add('diamond', facetedGem(marquiseOutline(0.2, 0.1, 16)), chain(face, RZ(a), T(0, 0.17, 0.04)));
  }
  b.add('gold22k', new TorusGeometry(0.1, 0.02, 8, 24), chain(face, T(0, 0, 0.05)));
  b.add('gold22k', new CylinderGeometry(0.025, 0.025, 0.6, 8), chain(RY(NOSE_PIN_YAW), T(0, 0, -0.25), RX(Math.PI / 2)));
  return b.build('nosepin-ruby-flower');
}

/* ───────────── necklaces (body frame) */

function frameOnChest(curve: CatmullRomCurve3, u: number) {
  const p = curve.getPointAt(u);
  const n = chestNormal(p.x, p.y);
  const y = UP.clone().sub(n.clone().multiplyScalar(UP.dot(n))).normalize();
  const x = new Vector3().crossVectors(y, n).normalize();
  return new Matrix4().makeBasis(x, y, n).setPosition(p);
}

function clasp(b: JewelBuilder, mat: MaterialName, curve: CatmullRomCurve3) {
  const p = curve.getPointAt(0);
  b.add(mat, new TorusGeometry(0.15, 0.04, 8, 20), chain(T(p.x, p.y, p.z), RX(Math.PI / 2)));
}

export function layeredNecklace() {
  const b = new JewelBuilder();
  const m: MaterialName = 'gold18k';
  const c1 = necklaceCurve({ drop: 3.6, clearance: 0.12, lift: 0.5 });
  const c2 = necklaceCurve({ drop: 8, clearance: 0.2 });
  const c3 = necklaceCurve({ drop: 13, clearance: 0.28, lift: -0.3 });
  chainAlong(b, m, c1, { link: 0.2, wire: 0.022, style: 'cable', from: 0.01, to: 0.99 });
  chainAlong(b, m, c2, { link: 0.26, wire: 0.03, style: 'box', from: 0.01, to: 0.99 });
  chainAlong(b, m, c3, { link: 0.34, wire: 0.045, style: 'rope', from: 0.01, to: 0.99 });
  // diamond stations on the choker strand
  for (const u of [0.42, 0.5, 0.58]) {
    const f = frameOnChest(c1, u);
    b.add('diamond', brilliant(0.18), chain(f, T(0, 0, 0.08)));
    b.add(m, new TorusGeometry(0.1, 0.022, 6, 20), chain(f, T(0, 0, 0.05)));
  }
  // gold coin on the middle strand
  const f2 = frameOnChest(c2, 0.5);
  const disc = new Shape();
  disc.absarc(0, 0, 0.55, 0, Math.PI * 2, false);
  b.add(m, extrude(disc, 0.05, 0.03), chain(f2, T(0, -0.7, 0.08)));
  b.add(m, new TorusGeometry(0.5, 0.035, 8, 40), chain(f2, T(0, -0.7, 0.12)));
  b.add('diamond', brilliant(0.14), chain(f2, T(0, -0.7, 0.14)));
  jumpRing(b, m, chain(f2, RY(Math.PI / 2)), 0.1, 0.025);
  // teardrop pendant on the long strand
  const f3 = frameOnChest(c3, 0.5);
  const out = pearOutline(1.1, 0.75, 22);
  const pend = new JewelBuilder();
  pend.add('emerald', facetedGem(out, { crown: 0.4 }));
  bezel(pend, m, out, 0.03, 1.04);
  b.merge(pend, chain(f3, T(0, -0.85, 0.12)));
  jumpRing(b, m, chain(f3, RY(Math.PI / 2)), 0.1, 0.03);
  clasp(b, m, c1);
  return b.build('layered-necklace');
}

export function raniHaar() {
  const b = new JewelBuilder();
  const m: MaterialName = 'gold22k';
  const drops = [13, 16.5, 20];
  drops.forEach((d, k) => {
    const c = necklaceCurve({ drop: d, clearance: 0.3 + k * 0.08 });
    // pearl and gold bead strands
    const L = c.getLength();
    const n = Math.floor((L * 0.9) / 0.42);
    for (let i = 0; i < n; i++) {
      const u = 0.05 + (i / n) * 0.9;
      const p = c.getPointAt(u);
      if (i % 4 === 0) b.add(m, new SphereGeometry(0.12, 14, 10), T(p.x, p.y, p.z));
      else b.add('pearl', new SphereGeometry(0.17, 18, 12), T(p.x, p.y, p.z));
    }
  });
  // kundan pendant on the longest strand
  const c = necklaceCurve({ drop: drops[2], clearance: 0.46 });
  const f = frameOnChest(c, 0.5);
  const pend = new JewelBuilder();
  const out = ovalOutline(1.05, 1.35, 28);
  pend.add(m, extrude(new Shape(out), 0.08, 0.04), T(0, 0, 0));
  kundanCollet(pend, T(0, 0.1, 0.12), 0.48, 0.62);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    kundanCollet(pend, chain(T(Math.cos(a) * 0.86, Math.sin(a) * 1.1, 0.1), RZ(a)), 0.1, 0.08);
  }
  const low = new CatmullRomCurve3(
    Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI + deg(25) + (i / 8) * (Math.PI - deg(50));
      return new Vector3(Math.cos(a) * 1.05, Math.sin(a) * 1.35, 0.06);
    }),
  );
  pearlFringe(pend, low, 9, 0.11, 0.12, m);
  pend.add('emerald', facetedGem(pearOutline(0.6, 0.42, 18), { crown: 0.4 }), T(0, -1.95, 0.12));
  b.merge(pend, chain(f, T(0, -1.25, 0.14)));
  // side spacer plaques where strands gather
  for (const sx of [-1, 1]) {
    const p = necklaceCurve({ drop: drops[1], clearance: 0.4 }).getPointAt(sx > 0 ? 0.3 : 0.7);
    kundanCollet(b, chain(T(p.x, p.y, p.z + 0.1), RZ(sx * 0.6)), 0.3, 0.55);
  }
  chainAlong(b, m, necklaceCurve({ drop: drops[0], clearance: 0.3 }), { link: 0.28, wire: 0.035, from: 0.95, to: 1 });
  return b.build('rani-haar');
}

export function diamondCollar() {
  const b = new JewelBuilder();
  const m: MaterialName = 'whiteGold';
  const c = necklaceCurve({ drop: 6.2, clearance: 0.22 });
  const L = c.getLength();
  const spots: number[] = [0.5];
  for (let u = 0.5 + 0.42 / L; u < 0.71; u += 0.42 / L) spots.push(u, 1 - u);
  spots.forEach((su) => {
    const f = frameOnChest(c, su);
    const k = Math.abs(su - 0.5);
    const size = 0.42 - k * 0.8;
    b.add('diamond', brilliant(Math.max(0.2, size)), chain(f, T(0, 0, 0.1)));
    b.add(m, new TorusGeometry(Math.max(0.2, size) * 0.54, 0.03, 6, 22), chain(f, T(0, 0, 0.08)));
    // pear drops hang from alternate stones, longest at the centre
    if (Math.round((k * L) / 0.42) % 2 === 0 && k < 0.15) {
      const len = 0.9 - k * 3.5;
      const out = pearOutline(Math.max(0.35, len), Math.max(0.25, len * 0.62), 20);
      const d = new JewelBuilder();
      d.add('diamond', facetedGem(out, { crown: 0.36 }));
      bezel(d, m, out, 0.022, 1.05);
      b.merge(d, chain(f, T(0, -size * 0.5 - Math.max(0.35, len) / 2 - 0.12, 0.12)));
      b.add(m, new CylinderGeometry(0.016, 0.016, 0.14, 6), chain(f, T(0, -size * 0.5 - 0.05, 0.1)));
    }
  });
  chainAlong(b, m, c, { link: 0.24, wire: 0.028, from: Math.max(...spots) + 0.004, to: 1 });
  chainAlong(b, m, c, { link: 0.24, wire: 0.028, from: 0, to: Math.min(...spots) - 0.004 });
  clasp(b, m, c);
  return b.build('diamond-collar');
}

export function pendantEmeraldOval() {
  const b = new JewelBuilder();
  const m: MaterialName = 'gold18k';
  const c = necklaceCurve({ drop: 9, clearance: 0.14 });
  chainAlong(b, m, c, { link: 0.22, wire: 0.024, from: 0.012, to: 0.988 });
  clasp(b, m, c);
  const f = frameOnChest(c, 0.5);
  b.add(m, new TorusGeometry(0.13, 0.035, 8, 20), chain(f, RY(Math.PI / 2)));
  const out = ovalOutline(0.42, 0.56, 24);
  const p = new JewelBuilder();
  p.add('emerald', facetedGem(out, { crown: 0.4, table: 0.6 }));
  bezel(p, m, out, 0.03, 1.04);
  halo(p, out, 0.12, 0.1, 'diamond', m, -0.02);
  b.merge(p, chain(f, T(0, -0.85, 0.12)));
  return b.build('pendant-emerald-oval');
}

/* ───────────── matha patti (forehead frame: origin = centre hairline) */

const BROW = new Vector3(...FACE_ANCHORS.forehead.position);

export function mathaPatti() {
  const b = new JewelBuilder();
  const m: MaterialName = 'gold22k';
  // hairline landmarks of the canonical face, raised into the hair line
  const right = [
    [0, 8.26, 4.48],
    [1.89, 8.24, 4.28],
    [3.52, 8.01, 3.73],
    [5.13, 7.49, 2.66],
    [6.28, 6.62, 1.43],
    [7.09, 5.43, 0.1],
    [7.45, 4.3, -0.9],
  ];
  const strand = (lift: number, sag: number, side: 1 | -1) => {
    const pts = right.map(([x, y, z], i) => new Vector3(side * x * 1.02, y + lift - sag * Math.sin((i / (right.length - 1)) * Math.PI), z + 0.35));
    return new CatmullRomCurve3(liftOverFace(pts, 0.3).map((p) => p.sub(BROW)), false, 'centripetal');
  };
  for (const side of [1, -1] as const) {
    const main = strand(0.35, 0, side);
    const lower = strand(-0.15, 0.55, side);
    chainAlong(b, m, main, { link: 0.22, wire: 0.024, from: 0.04, to: 1, up: new Vector3(0, 0, 1) });
    chainAlong(b, m, lower, { link: 0.2, wire: 0.02, from: 0.06, to: 1, up: new Vector3(0, 0, 1) });
    // kundan stations along the main strand with pearl drops
    for (const u of [0.28, 0.52, 0.76]) {
      const p = main.getPointAt(u);
      kundanCollet(b, T(p.x, p.y, p.z + 0.05), 0.13, 0.13);
      b.add('gold22k', new CylinderGeometry(0.015, 0.015, 0.25, 6), T(p.x, p.y - 0.25, p.z));
      pearl(b, 0.07, T(p.x, p.y - 0.48, p.z), m, 1.1);
    }
    const end = main.getPointAt(1);
    b.add(m, new TorusGeometry(0.14, 0.03, 8, 20), chain(T(end.x, end.y, end.z), RY(Math.PI / 2)));
  }
  // centre ornament (small tikka) at the hairline
  const centre = new JewelBuilder();
  kundanCollet(centre, T(0, -0.55, 0.16), 0.32, 0.32);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    centre.add('ruby', new SphereGeometry(0.05, 10, 8), T(Math.cos(a) * 0.42, -0.55 + Math.sin(a) * 0.42, 0.14));
  }
  const fr = new CatmullRomCurve3([new Vector3(-0.35, -0.95, 0.12), new Vector3(0, -1.05, 0.12), new Vector3(0.35, -0.95, 0.12)]);
  pearlFringe(centre, fr, 5, 0.06, 0.05, m);
  b.merge(centre, chain(RX(-0.31), T(0, 0, 0.12)));
  return b.build('matha-patti');
}

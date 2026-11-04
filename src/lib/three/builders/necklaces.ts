import { CatmullRomCurve3, CylinderGeometry, Matrix4, Shape, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import type { MaterialName } from '../materials';
import {
  JewelBuilder,
  T,
  RX,
  RY,
  RZ,
  chain,
  brilliant,
  chainAlong,
  beadsAlong,
  pearl,
  prongSetting,
  facetedGem,
  pearOutline,
  bezel,
  halo,
  jumpRing,
  type ChainStyle,
  circleOutline,
} from './core';
import { extrude, flower, kundanCollet, templeCoin } from './motifs';
import { chestNormal, chokerCurve, necklaceCurve, NECK_RADIUS } from '../../tracking/bodyFrame';

/* Body-frame pieces (see bodyFrame.ts). */

const UP = new Vector3(0, 1, 0);

/** Frame on the chest at curve parameter u: X along chain, Z out of skin. */
function frameAt(curve: CatmullRomCurve3, u: number, normalFn?: (p: Vector3) => Vector3) {
  const p = curve.getPointAt(((u % 1) + 1) % 1);
  const t = curve.getTangentAt(((u % 1) + 1) % 1);
  const n = normalFn ? normalFn(p) : chestNormal(p.x, p.y);
  const x = t.clone().sub(n.clone().multiplyScalar(t.dot(n))).normalize();
  const y = new Vector3().crossVectors(n, x).normalize();
  if (y.dot(UP) < 0) {
    x.negate();
    y.negate();
  }
  return new Matrix4().makeBasis(x, y, n).setPosition(p);
}

/** Frame for a hanging pendant at the front centre: Y = up along the chest. */
function pendantFrame(curve: CatmullRomCurve3) {
  const p = curve.getPointAt(0.5);
  const n = chestNormal(p.x, p.y);
  const y = UP.clone().sub(n.clone().multiplyScalar(UP.dot(n))).normalize();
  const x = new Vector3().crossVectors(y, n).normalize();
  return new Matrix4().makeBasis(x, y, n).setPosition(p);
}

/** Walks outward from the front centre placing items of varying width. */
function placeSymmetric(curve: CatmullRomCurve3, widths: (i: number) => number, maxU: number, gap = 0.04) {
  const L = curve.getLength();
  const out: { u: number; w: number; i: number }[] = [{ u: 0.5, w: widths(0), i: 0 }];
  let u = 0.5;
  let prev = widths(0);
  for (let i = 1; ; i++) {
    const w = widths(i);
    u += (prev / 2 + w / 2 + gap) / L;
    if (u > 0.5 + maxU) break;
    out.push({ u, w, i }, { u: 1 - u, w, i });
    prev = w;
  }
  return out;
}

function backChain(b: JewelBuilder, mat: MaterialName, curve: CatmullRomCurve3, from: number, style: ChainStyle = 'cable', link = 0.28, w = 0.03) {
  chainAlong(b, mat, curve, { link, wire: w, style, from: 0.5 + from, to: 1 });
  chainAlong(b, mat, curve, { link, wire: w, style, from: 0, to: 0.5 - from });
  clasp(b, mat, curve);
}

function clasp(b: JewelBuilder, mat: MaterialName, curve: CatmullRomCurve3) {
  const f = frameAt(curve, 0.0, (p) => new Vector3(p.x, 0, p.z).normalize());
  b.add(mat, new TorusGeometry(0.16, 0.045, 8, 20), chain(f, RX(Math.PI / 2)));
  b.add(mat, new CylinderGeometry(0.05, 0.05, 0.36, 10), chain(f, T(0.26, 0, 0), RZ(Math.PI / 2)));
}

export function necklaceDiamondRiviera() {
  const b = new JewelBuilder();
  const curve = necklaceCurve({ drop: 5.6, clearance: 0.22 });
  const spots = placeSymmetric(curve, (i) => 0.46 - Math.min(0.22, i * 0.0085), 0.2, 0.035);
  const cup = new TorusGeometry(1, 0.08, 6, 24);
  for (const { u, w } of spots) {
    const f = frameAt(curve, u);
    b.add('diamond', brilliant(w), chain(f, T(0, 0, 0.1)));
    b.add('whiteGold', cup, chain(f, T(0, 0, 0.08), new Matrix4().makeScale(w * 0.54, w * 0.54, w * 0.9)));
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      b.add('whiteGold', new SphereGeometry(w * 0.075, 8, 6), chain(f, T(Math.cos(a) * w * 0.47, Math.sin(a) * w * 0.47, 0.1 + w * 0.17)));
    }
  }
  const lastU = Math.max(...spots.map((s) => s.u));
  backChain(b, 'whiteGold', curve, lastU - 0.5 + 0.004, 'cable', 0.24, 0.028);
  return b.build('necklace-diamond-riviera');
}

export function necklaceTempleGold() {
  const b = new JewelBuilder();
  const metal: MaterialName = 'antiqueGold';
  const curve = necklaceCurve({ drop: 9.5, clearance: 0.25 });
  const spots = placeSymmetric(curve, (i) => (i === 0 ? 2.1 : 1.32 - Math.min(0.5, i * 0.06)), 0.19, 0.06);
  for (const { u, w, i } of spots) {
    const f = frameAt(curve, u);
    if (i === 0) continue;
    const r = w / 2;
    templeCoin(b, chain(f, T(0, -r * 0.82, 0.08)), r, metal, i % 2 ? 'ruby' : 'emerald');
    b.add(metal, new TorusGeometry(0.09, 0.03, 6, 14), chain(f, T(0, 0, 0.05), RY(Math.PI / 2)));
    pearl(b, r * 0.2, chain(f, T(0, -r * 1.85 - r * 0.25, 0.1)), metal, 1.1);
  }
  // central lotus pendant
  const pf = pendantFrame(curve);
  b.add(metal, new TorusGeometry(0.14, 0.04, 8, 18), chain(pf, T(0, -0.05, 0.08), RY(Math.PI / 2)));
  flower(b, chain(pf, T(0, -1.2, 0.12)), { radius: 0.95, petals: 10, metal, centre: 'ruby' });
  templeCoin(b, chain(pf, T(0, -1.2, 0.02)), 1.12, metal, 'ruby');
  for (let k = -2; k <= 2; k++) {
    const x = k * 0.38;
    const y = -2.45 - (2 - Math.abs(k)) * 0.12;
    b.add(metal, new CylinderGeometry(0.02, 0.02, 0.3, 6), chain(pf, T(x, y + 0.22, 0.1)));
    pearl(b, 0.13, chain(pf, T(x, y - 0.1, 0.12)), metal, 1.15);
  }
  b.add('emerald', facetedGem(pearOutline(0.42, 0.3, 16), { crown: 0.4 }), chain(pf, T(0, -3.05, 0.14)));
  // back: antique rope chain
  const lastU = Math.max(...spots.map((s) => s.u));
  backChain(b, metal, curve, lastU - 0.5 + 0.006, 'rope', 0.34, 0.05);
  return b.build('necklace-temple-gold');
}

export function chokerKundan() {
  const b = new JewelBuilder();
  const curve = chokerCurve(3.2, 0.6);
  const neckNormal = (p: Vector3) =>
    new Vector3(p.x / (NECK_RADIUS.x * NECK_RADIUS.x), 0, p.z / (NECK_RADIUS.z * NECK_RADIUS.z)).normalize();
  const L = curve.getLength();
  const blockW = 0.62;
  const count = Math.floor((L * 0.46) / blockW);
  const frame = new Shape();
  const hw = 0.29;
  const hh = 0.36;
  frame.moveTo(-hw, -hh);
  frame.lineTo(hw, -hh);
  frame.lineTo(hw, hh);
  frame.lineTo(-hw, hh);
  frame.lineTo(-hw, -hh);
  const plate = extrude(frame, 0.06, 0.03);
  for (let i = 0; i < count; i++) {
    const u = 0.5 + (i - (count - 1) / 2) * (blockW / L);
    const f = frameAt(curve, u, neckNormal);
    const centre = i === Math.floor(count / 2);
    b.add('gold22k', plate, chain(f, T(0, 0, 0.04)));
    kundanCollet(b, chain(f, T(0, 0.02, 0.12)), centre ? 0.24 : 0.2, centre ? 0.3 : 0.26);
    b.add('emerald', new SphereGeometry(0.055, 12, 8), chain(f, T(0, -hh - 0.08, 0.06)));
    b.add('gold22k', new CylinderGeometry(0.015, 0.015, 0.22, 6), chain(f, T(0, -hh - 0.24, 0.06)));
    pearl(b, centre ? 0.13 : 0.1, chain(f, T(0, -hh - 0.48 - (centre ? 0.06 : 0), 0.07)), 'gold22k', 1.15);
    if (centre) {
      const outline = pearOutline(0.55, 0.38, 18);
      const drop = new JewelBuilder();
      drop.add('ruby', facetedGem(outline, { crown: 0.4 }));
      bezel(drop, 'gold22k', outline, 0.025);
      b.merge(drop, chain(f, T(0, -hh - 1.15, 0.12)));
    }
    // gold bead rails above and below
    for (const y of [hh + 0.05, -hh - 0.02]) b.add('gold22k', new SphereGeometry(0.035, 10, 6), chain(f, T(-hw, y, 0.07)));
  }
  const edgeFrom = 0.5 - (count / 2) * (blockW / L);
  chainAlong(b, 'gold22k', curve, { link: 0.26, wire: 0.03, from: 0.5 + (0.5 - edgeFrom), to: 1 });
  chainAlong(b, 'gold22k', curve, { link: 0.26, wire: 0.03, from: 0, to: edgeFrom });
  return b.build('choker-kundan');
}

export function necklacePearlStrand() {
  const b = new JewelBuilder();
  const curve = necklaceCurve({ drop: 7.5, clearance: 0.36 });
  beadsAlong(b, 'pearl', curve, (u) => 0.27 + 0.1 * Math.pow(Math.cos((u - 0.5) * Math.PI), 2), 0.68, 0.03, 0.97);
  clasp(b, 'gold18k', curve);
  return b.build('necklace-pearl-strand');
}

function plainChain(id: string, mat: MaterialName, style: ChainStyle, link: number, w: number, drop: number) {
  const b = new JewelBuilder();
  const curve = necklaceCurve({ drop, clearance: w * 1.4 + 0.06 });
  chainAlong(b, mat, curve, { link, wire: w, style, from: 0.01, to: 0.99 });
  clasp(b, mat, curve);
  return b.build(id);
}

export const chainCableGold = () => plainChain('chain-cable-gold', 'gold22k', 'cable', 0.42, 0.05, 8);
export const chainRopeGold = () => plainChain('chain-rope-gold', 'gold22k', 'rope', 0.36, 0.055, 9);
export const chainBoxWhite = () => plainChain('chain-box-white', 'whiteGold', 'box', 0.3, 0.042, 7);

function pendantOnChain(id: string, mat: MaterialName, drop: number, buildPendant: (p: JewelBuilder) => void) {
  const b = new JewelBuilder();
  const curve = necklaceCurve({ drop, clearance: 0.14 });
  chainAlong(b, mat, curve, { link: 0.24, wire: 0.026, style: 'cable', from: 0.012, to: 0.988 });
  clasp(b, mat, curve);
  const pf = pendantFrame(curve);
  // bail
  b.add(mat, new TorusGeometry(0.13, 0.035, 8, 20), chain(pf, RY(Math.PI / 2)));
  const p = new JewelBuilder();
  buildPendant(p);
  b.merge(p, chain(pf, T(0, -0.16, 0.12)));
  return b.build(id);
}

export const pendantSolitaire = () =>
  pendantOnChain('pendant-solitaire', 'whiteGold', 8.5, (p) => {
    const d = 0.8;
    p.add('diamond', brilliant(d), T(0, -0.55, 0.3));
    const s = new JewelBuilder();
    prongSetting(s, 'whiteGold', d, 6, 0);
    p.merge(s, T(0, -0.55, 0.3));
    jumpRing(p, 'whiteGold', T(0, -0.08, 0.1), 0.07, 0.02);
  });

export const pendantRubyDrop = () =>
  pendantOnChain('pendant-ruby-drop', 'gold18k', 9.5, (p) => {
    p.add('diamond', brilliant(0.18), T(0, -0.18, 0.12));
    bezel(p, 'gold18k', circleOutline(0.09, 16), 0.02, 1.08);
    const outline = pearOutline(1.25, 0.86, 26);
    const drop = new JewelBuilder();
    drop.add('ruby', facetedGem(outline, { crown: 0.4, table: 0.52 }));
    bezel(drop, 'gold18k', outline, 0.03, 1.04);
    halo(drop, outline, 0.14, 0.12, 'diamond', 'gold18k', -0.02);
    p.merge(drop, T(0, -1.12, 0.1));
  });

export const pendantLotusGold = () =>
  pendantOnChain('pendant-lotus-gold', 'gold22k', 9, (p) => {
    jumpRing(p, 'gold22k', T(0, -0.05, 0.08), 0.08, 0.022);
    flower(p, T(0, -0.95, 0.1), { radius: 0.78, petals: 10, metal: 'gold22k', centre: 'emerald' });
    flower(p, chain(T(0, -0.95, 0.03), RZ(Math.PI / 10)), { radius: 0.9, petals: 10, metal: 'gold22k', centre: 'emerald' });
    pearl(p, 0.12, T(0, -2.05, 0.08), 'gold22k', 1.1);
  });

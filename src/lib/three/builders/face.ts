import { CatmullRomCurve3, Matrix4, SphereGeometry, TorusGeometry, Vector3, CylinderGeometry } from 'three';
import {
  JewelBuilder,
  T,
  RX,
  RY,
  RZ,
  chain,
  brilliant,
  taperedTube,
  beadsAlong,
  chainAlong,
  deg,
  facetedGem,
  pearOutline,
  bezel,
  halo,
  circleOutline,
  jumpRing,
  cabochon,
} from './core';
import { flower, kundanCollet, pearlFringe, granule } from './motifs';
import { FACE_ANCHORS, FOREHEAD_TILT, NOSE_PIN_YAW } from '../../tracking/anchors';
import { faceClearance, liftOverFace } from './faceSurface';

/*
 * Nose pieces: frame = head orientation, origin at the left-ala piercing.
 * Tikkas: frame = head orientation tilted to the brow, origin at the hairline.
 */

const NOSE = new Vector3(...FACE_ANCHORS.noseLeft.position);
const BROW = new Vector3(...FACE_ANCHORS.forehead.position);

export function nosePinDiamond() {
  const b = new JewelBuilder();
  const face = chain(RY(NOSE_PIN_YAW), T(0, 0, 0.08));
  b.add('diamond', brilliant(0.2), chain(face, T(0, 0, 0.1)));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add('diamond', brilliant(0.12), chain(face, T(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.06)));
    granule(b, 'gold18k', chain(face, T(Math.cos(a + 0.52) * 0.2, Math.sin(a + 0.52) * 0.2, 0.06)), 0.022);
  }
  b.add('gold18k', new TorusGeometry(0.11, 0.022, 8, 24), chain(face, T(0, 0, 0.05)));
  b.add('gold18k', new SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), chain(face, RX(-Math.PI / 2), T(0, -0.02, 0), new Matrix4().makeScale(1, 0.25, 1)));
  b.add('gold18k', new CylinderGeometry(0.025, 0.025, 0.6, 8), chain(face, T(0, 0, -0.3), RX(Math.PI / 2)));
  return b.build('nosepin-diamond');
}

export function noseRingGold() {
  const b = new JewelBuilder();
  const R = 0.4;
  const ring = new CatmullRomCurve3(
    Array.from({ length: 36 }, (_, i) => {
      const a = Math.PI / 2 + (i / 36) * Math.PI * 2;
      return new Vector3(Math.cos(a) * R, -R + Math.sin(a) * R, 0);
    }),
    true,
  );
  const place = chain(RY(NOSE_PIN_YAW + 0.35), RX(deg(-20)), T(0, 0.12, 0));
  const g = new JewelBuilder();
  g.add('gold22k', taperedTube(ring, 120, 10, (t) => {
    const f = Math.sin(t * Math.PI);
    return [0.025 + 0.02 * f, 0.025 + 0.02 * f];
  }, true));
  g.add('gold22k', new SphereGeometry(0.065, 16, 10), T(0, -2 * R, 0));
  g.add('diamond', brilliant(0.09), T(0, -2 * R, 0.065));
  beadsAlong(g, 'gold22k', ring, 0.026, 0.07, 0.38, 0.45);
  beadsAlong(g, 'gold22k', ring, 0.026, 0.07, 0.55, 0.62);
  b.merge(g, place);
  return b.build('nosering-gold');
}

export function nathBridal() {
  const b = new JewelBuilder();
  const R = 1.3;
  const ringPts = Array.from({ length: 64 }, (_, i) => {
    const a = Math.PI / 2 + (i / 64) * Math.PI * 2;
    return new Vector3(Math.cos(a) * R, -R + Math.sin(a) * R, 0);
  });
  // find the smallest forward tilt that keeps the whole ring clear of the face
  let place = new Matrix4();
  for (let a = 0; a <= 60; a += 2) {
    place = chain(RY(deg(28)), RZ(deg(16)), RX(deg(-a)));
    const inHead = ringPts.map((p) => p.clone().applyMatrix4(place).add(NOSE));
    if (faceClearance(inHead) > 0.28) break;
  }
  const ring = new CatmullRomCurve3(ringPts, true);
  const g = new JewelBuilder();
  g.add('gold22k', taperedTube(ring, 220, 10, () => [0.032, 0.032], true));
  // beadwork on the lower arc: pearls between gold granules and ruby beads
  const n = 13;
  for (let i = 0; i < n; i++) {
    const t = 0.3 + (i / (n - 1)) * 0.4;
    const p = ring.getPointAt(t);
    if (i % 3 === 1) g.add('ruby', new SphereGeometry(0.075, 16, 10), T(p.x, p.y, p.z));
    else if (i % 3 === 0) g.add('pearl', new SphereGeometry(0.085, 20, 14), T(p.x, p.y, p.z));
    else g.add('gold22k', new SphereGeometry(0.06, 14, 10), T(p.x, p.y, p.z));
  }
  // kundan ornament on the outer side of the ring
  const orn = ring.getPointAt(0.78);
  kundanCollet(g, T(orn.x + 0.05, orn.y, orn.z + 0.06), 0.16, 0.16);
  flower(g, T(orn.x + 0.05, orn.y, orn.z + 0.01), { radius: 0.3, petals: 8, metal: 'gold22k', centre: 'kundan', petalStones: 'ruby' });
  const fr = new CatmullRomCurve3([
    new Vector3(orn.x - 0.2, orn.y - 0.25, orn.z),
    new Vector3(orn.x + 0.05, orn.y - 0.33, orn.z),
    new Vector3(orn.x + 0.3, orn.y - 0.25, orn.z),
  ]);
  pearlFringe(g, fr, 3, 0.055, 0.04, 'gold22k');
  b.merge(g, place);

  // decorative chain from the ornament to the hair above the ear (head space)
  const start = orn.clone().applyMatrix4(place).add(NOSE);
  const ear = new Vector3(6.9, 3.6, -1.6);
  const raw = [
    start,
    new Vector3(start.x + 1.4, start.y - 0.45, 0),
    new Vector3(4.6, -1.4, 0),
    new Vector3(5.9, 0.6, 0),
    new Vector3(6.6, 2.4, 0),
    ear,
  ].map((p, i, arr) => (i === 0 || i === arr.length - 1 ? p : new Vector3(p.x, p.y, -10)));
  const draped = liftOverFace(raw, 0.32).map((p) => p.sub(NOSE));
  const c = new CatmullRomCurve3(draped, false, 'centripetal');
  chainAlong(b, 'gold22k', c, { link: 0.2, wire: 0.018, style: 'cable', from: 0.02, to: 1 });
  beadsAlong(b, 'pearl', c, 0.05, 1.1, 0.15, 0.85);
  return b.build('nath-bridal');
}

/** Tikka chain over the parting, built in head space then made relative to the brow. */
function tikkaChain(b: JewelBuilder, metal: 'gold22k' | 'whiteGold', pearls: boolean) {
  const raw = [
    new Vector3(0, 8.28, 4.72),
    new Vector3(0, 9.7, 4.25),
    new Vector3(0, 11.2, 2.9),
    new Vector3(0, 12.35, 0.4),
    new Vector3(0, 12.95, -2.6),
  ];
  // the tikka frame shares the head's orientation, so head-space points only need re-centring
  const pts = liftOverFace(raw, 0.25).map((p) => p.sub(BROW));
  const curve = new CatmullRomCurve3(pts, false, 'centripetal');
  chainAlong(b, metal, curve, { link: 0.22, wire: 0.02, style: 'cable', up: new Vector3(1, 0, 0) });
  if (pearls) beadsAlong(b, 'pearl', curve, 0.07, 1.25, 0.12, 0.95);
  const end = curve.getPointAt(1);
  b.add(metal, new TorusGeometry(0.14, 0.03, 8, 20), chain(T(end.x, end.y, end.z), RY(Math.PI / 2)));
}

export function tikkaKundan() {
  const b = new JewelBuilder();
  const g = new JewelBuilder();
  // top connector
  kundanCollet(g, T(0, -0.22, 0.12), 0.11, 0.15);
  jumpRing(g, 'gold22k', T(0, 0.02, 0.1), 0.06, 0.018);
  // medallion
  const cy = -1.08;
  const ringCurve = new CatmullRomCurve3(circleOutline(0.6, 40).map((p) => new Vector3(p.x, p.y + cy, 0.12)), true);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    kundanCollet(g, chain(T(Math.cos(a) * 0.55, cy + Math.sin(a) * 0.55, 0.14), RZ(a)), 0.1, 0.075);
  }
  flower(g, T(0, cy, 0.1), { radius: 0.36, petals: 8, metal: 'gold22k', centre: 'ruby' });
  g.add('gold22k', taperedTube(ringCurve, 120, 8, () => [0.05, 0.03], true), T(0, 0, -0.02));
  const outer = new CatmullRomCurve3(circleOutline(0.74, 48).map((p) => new Vector3(p.x, p.y + cy, 0.08)), true);
  beadsAlong(g, 'gold22k', outer, 0.032, 0.085);
  // backplate
  g.add('gold22k', cabochon(0.72, 0.72, 0.06), chain(T(0, cy, 0.02), RX(Math.PI)));
  // pearl and emerald drops
  const fringeArc = new CatmullRomCurve3(
    Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI + deg(35) + (i / 8) * (Math.PI - deg(70));
      return new Vector3(Math.cos(a) * 0.78, cy + Math.sin(a) * 0.78, 0.1);
    }),
  );
  pearlFringe(g, fringeArc, 7, 0.07, 0.06, 'gold22k');
  g.add('emerald', facetedGem(pearOutline(0.3, 0.22, 16), { crown: 0.4 }), T(0, cy - 1.0, 0.12));
  b.merge(g, chain(RX(FOREHEAD_TILT), T(0, 0, 0.16)));
  tikkaChain(b, 'gold22k', true);
  return b.build('tikka-kundan');
}

export function tikkaDiamondDrop() {
  const b = new JewelBuilder();
  const g = new JewelBuilder();
  g.add('diamond', brilliant(0.22), T(0, -0.2, 0.12));
  bezel(g, 'whiteGold', circleOutline(0.11, 16), 0.022, 1.08);
  jumpRing(g, 'whiteGold', chain(T(0, -0.42, 0.08), RY(Math.PI / 2)), 0.05, 0.016);
  const outline = pearOutline(0.95, 0.62, 24);
  const drop = new JewelBuilder();
  drop.add('diamond', facetedGem(outline, { crown: 0.38, table: 0.5 }));
  bezel(drop, 'whiteGold', outline, 0.028, 1.04);
  halo(drop, outline, 0.12, 0.1, 'diamond', 'whiteGold', -0.02);
  g.merge(drop, T(0, -1.05, 0.12));
  b.merge(g, chain(RX(FOREHEAD_TILT), T(0, 0, 0.16)));
  tikkaChain(b, 'whiteGold', false);
  return b.build('tikka-diamond-drop');
}

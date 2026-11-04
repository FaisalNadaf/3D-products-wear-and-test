import { CatmullRomCurve3, Shape, SphereGeometry, TorusGeometry, Vector3, CylinderGeometry, Vector2 } from 'three';
import {
  JewelBuilder,
  T,
  RX,
  RY,
  RZ,
  S,
  chain,
  brilliant,
  prongSetting,
  studPost,
  earHook,
  taperedTube,
  facetedGem,
  pearOutline,
  bezel,
  halo,
  beadsAlong,
  cabochon,
  pearl,
  jumpRing,
  wire,
  deg,
  circleOutline,
} from './core';
import { flower, bellGeometry, extrude, kundanCollet, pearlFringe, granule } from './motifs';

/*
 * Earring frame: origin = piercing point, +Y up, hanging toward −Y, display
 * face toward +Z. Authored for the LEFT ear; the renderer mirrors for the right.
 */

export function studSolitaire() {
  const b = new JewelBuilder();
  const d = 0.56;
  b.add('diamond', brilliant(d), T(0, 0, 0.3));
  const setting = new JewelBuilder();
  prongSetting(setting, 'whiteGold', d, 4);
  b.merge(setting, T(0, 0, 0.3));
  studPost(b, 'whiteGold');
  return b.build('stud-solitaire');
}

export function studGoldFlower() {
  const b = new JewelBuilder();
  flower(b, T(0, 0, 0.12), { radius: 0.52, petals: 6, metal: 'gold22k', centre: 'ruby' });
  // second, rotated layer of smaller petals for depth
  flower(b, chain(T(0, 0, 0.05), RZ(Math.PI / 6)), { radius: 0.44, petals: 6, metal: 'gold22k', centre: 'ruby' });
  studPost(b, 'gold22k');
  return b.build('stud-gold-flower');
}

export function hoopGold() {
  const b = new JewelBuilder();
  const R = 1.25;
  const circle = new CatmullRomCurve3(
    Array.from({ length: 48 }, (_, i) => {
      const a = Math.PI / 2 + (i / 48) * Math.PI * 2; // start at top
      return new Vector3(Math.cos(a) * R, -R + Math.sin(a) * R, 0);
    }),
    true,
  );
  // knife-edge hoop: slim at the top (through the lobe) and fuller at the bottom
  b.add(
    'gold22k',
    taperedTube(circle, 160, 18, (t) => {
      const fullness = Math.sin(t * Math.PI);
      return [0.05 + 0.07 * fullness, 0.06 + 0.1 * fullness];
    }, true),
  );
  // fine engraved bands
  for (const t of [0.3, 0.7]) {
    const p = circle.getPointAt(t);
    b.add('gold22k', new TorusGeometry(0.17, 0.02, 6, 24), chain(T(p.x, p.y, p.z), RZ(Math.atan2(p.y + R, p.x)), RX(Math.PI / 2), S(1, 1.25, 1)));
  }
  return b.build('hoop-gold');
}

export function hoopDiamondHuggie() {
  const b = new JewelBuilder();
  const R = 0.72;
  const circle = new CatmullRomCurve3(
    Array.from({ length: 40 }, (_, i) => {
      const a = Math.PI / 2 + (i / 40) * Math.PI * 2;
      return new Vector3(Math.cos(a) * R, -R + Math.sin(a) * R, 0);
    }),
    true,
  );
  b.add('whiteGold', taperedTube(circle, 140, 6, () => [0.1, 0.16], true));
  const stones = 11;
  for (let i = 0; i < stones; i++) {
    const t = 0.18 + (i / (stones - 1)) * 0.64;
    const p = circle.getPointAt(t);
    const out = new Vector3(p.x, p.y + R, 0).normalize();
    // stones sit on the outer face of the band, tables facing outward/forward
    const ang = Math.atan2(out.y, out.x);
    b.add('diamond', brilliant(0.15), chain(T(p.x + out.x * 0.07, p.y + out.y * 0.07, 0.11), RZ(ang), RX(deg(-25))));
    b.add('whiteGold', new SphereGeometry(0.03, 8, 6), T(p.x + out.x * 0.1, p.y + out.y * 0.1, 0.18));
  }
  return b.build('hoop-diamond-huggie');
}

export function jhumkaTemple() {
  const b = new JewelBuilder();
  // top flower stud
  flower(b, T(0, 0, 0.1), { radius: 0.48, petals: 8, metal: 'gold22k', centre: 'ruby' });
  studPost(b, 'gold22k');
  // links
  jumpRing(b, 'gold22k', chain(T(0, -0.55, 0.05), RY(Math.PI / 2)), 0.08, 0.022);
  jumpRing(b, 'gold22k', T(0, -0.7, 0.05), 0.07, 0.02);
  granule(b, 'gold22k', T(0, -0.82, 0.05), 0.07);
  // bell
  const top = -0.88;
  const R = 0.78;
  const H = 1.05;
  b.add('gold22k', bellGeometry(R, H, 22), T(0, top, 0.05));
  b.add('gold22k', new SphereGeometry(0.14, 20, 12), T(0, top - 0.02, 0.05));
  // granulation rows around the dome
  for (const [s, rr] of [
    [0.35, 0.53],
    [0.72, 0.86],
  ] as const) {
    const ring = new CatmullRomCurve3(
      circleOutline(R * rr + 0.04, 40).map((p) => new Vector3(p.x, top - H * s, p.y + 0.05)),
      true,
    );
    beadsAlong(b, 'gold22k', ring, 0.032, 0.085);
  }
  // ruby cabochons around the middle band
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = R * 0.73 + 0.05;
    b.add(
      'ruby',
      cabochon(0.07, 0.09, 0.05),
      chain(T(Math.cos(a) * rr, top - H * 0.55, Math.sin(a) * rr + 0.05), RY(Math.PI / 2 - a), RX(deg(-8))),
    );
  }
  // rim beads + pearl fringe
  const rim = new CatmullRomCurve3(
    circleOutline(R * 1.06, 48).map((p) => new Vector3(p.x, top - H * 1.04, p.y + 0.05)),
    true,
  );
  beadsAlong(b, 'gold22k', rim, 0.04, 0.09);
  pearlFringe(b, rim, 16, 0.085, 0.12, 'gold22k');
  // clapper visible under the bell
  b.add('gold22k', new CylinderGeometry(0.02, 0.02, 0.7, 6), T(0, top - H * 0.6, 0.05));
  pearl(b, 0.13, T(0, top - H - 0.08, 0.05), 'gold22k');
  return b.build('jhumka-temple');
}

export function dropSapphireHalo() {
  const b = new JewelBuilder();
  earHook(b, 'whiteGold', -0.28);
  // vertical line of three bezel-set diamonds
  for (let i = 0; i < 3; i++) {
    const y = -0.4 - i * 0.22;
    const s = 0.15 + i * 0.012;
    b.add('diamond', brilliant(s), T(0, y, 0.06));
    bezel(b, 'whiteGold', circleOutline(s / 2, 16), 0.022, 1.08);
    b.add('whiteGold', new TorusGeometry(s * 0.58, 0.02, 6, 20), T(0, y, 0.02));
  }
  jumpRing(b, 'whiteGold', chain(T(0, -0.98, 0.03), RY(Math.PI / 2)), 0.06, 0.018);
  // pear sapphire with diamond halo (point upward)
  const outline = pearOutline(1.05, 0.72, 24);
  const cy = -1.7;
  const centre = new JewelBuilder();
  centre.add('sapphire', facetedGem(outline, { crown: 0.4, table: 0.52 }));
  bezel(centre, 'whiteGold', outline, 0.03, 1.04);
  halo(centre, outline, 0.13, 0.11, 'diamond', 'whiteGold', -0.02);
  b.merge(centre, T(0, cy, 0.05));
  return b.build('drop-sapphire-halo');
}

export function chandbaliKundan() {
  const b = new JewelBuilder();
  // top stud: kundan collet with petal frame
  kundanCollet(b, T(0, 0, 0.1), 0.2, 0.2);
  flower(b, T(0, 0, 0.02), { radius: 0.4, petals: 8, metal: 'gold22k', centre: 'kundan' });
  studPost(b, 'gold22k');

  // crescent plate
  const k = 0.82;
  const Ro = 1.35 * k;
  const Ri = 1.1 * k;
  const off = 0.45 * k;
  const hy = 0.9056 * k;
  const hx = 1.0012 * k;
  const aO = Math.atan2(hy, hx);
  const aI = Math.atan2(hy - off, hx);
  const crescent = new Shape();
  crescent.absarc(0, 0, Ro, aO, Math.PI - aO, true);
  crescent.absarc(0, off, Ri, Math.PI - aI, Math.PI * 2 + aI, false);
  const cy = -0.62 - hy;
  b.add('gold22k', extrude(crescent, 0.07, 0.035), T(0, cy, 0.02));

  // kundan stones along the crescent band
  const stones = 9;
  for (let i = 0; i < stones; i++) {
    const a = Math.PI + deg(32) + (i / (stones - 1)) * (Math.PI - deg(64));
    // band mid-line between the two circles
    const outer = new Vector2(Math.cos(a) * Ro, Math.sin(a) * Ro);
    const dir = outer.clone().sub(new Vector2(0, off)).normalize();
    const inner = new Vector2(0, off).add(dir.multiplyScalar(Ri));
    const m = outer.add(inner).multiplyScalar(0.5);
    const big = i === Math.floor(stones / 2);
    kundanCollet(b, chain(T(m.x, cy + m.y, 0.11), RZ(a + Math.PI / 2)), big ? 0.16 : 0.12, big ? 0.13 : 0.1);
  }
  // beaded outer edge
  const edge = new CatmullRomCurve3(
    Array.from({ length: 40 }, (_, i) => {
      const a = Math.PI + aO * 0.2 + (i / 39) * (Math.PI - aO * 0.4);
      return new Vector3(Math.cos(a) * (Ro + 0.05), cy + Math.sin(a) * (Ro + 0.05), 0.04);
    }),
  );
  beadsAlong(b, 'gold22k', edge, 0.035, 0.085);
  // pearl fringe hanging from the lower arc
  pearlFringe(b, edge, 13, 0.07, 0.08, 'gold22k', 0.08, 0.92);
  // suspension: twin beaded wires from the stud to the horns
  for (const sx of [-1, 1]) {
    const c = wire(
      b,
      'gold22k',
      [new Vector3(0, -0.36, 0.05), new Vector3(sx * hx * 0.55, -0.48, 0.05), new Vector3(sx * hx, cy + hy + 0.02, 0.05)],
      0.022,
    );
    beadsAlong(b, 'gold22k', c, 0.04, 0.14, 0.2, 0.95);
  }
  // central ruby drop inside the crescent opening
  const pear = pearOutline(0.42, 0.3, 18);
  const drop = new JewelBuilder();
  drop.add('ruby', facetedGem(pear, { crown: 0.4 }));
  bezel(drop, 'gold22k', pear, 0.022);
  b.merge(drop, T(0, -0.86, 0.08));
  pearl(b, 0.075, T(0, -1.25, 0.06), 'gold22k');
  return b.build('chandbali-kundan');
}

